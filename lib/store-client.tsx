"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GraphEdge, GraphNode } from "@/types/graph";
import { addCaseApi, updateCaseApi } from "@/services/api/cases";
import { logAuditEvent } from "@/services/api/auditLogs";
import { resolveEntityMatch } from "@/services/api/entityResolution";
import { uploadEvidenceFile } from "@/services/api/evidence";
import {
  getSocket,
  useSocket,
  broadcastCaseCreated,
  broadcastCaseUpdated,
  broadcastFirRegistered,
  broadcastEvidenceUploaded,
} from "@/lib/socket";

// ---------- Persistent Storage Keys (V2 - Zero Mock Data) ----------
const STORAGE_KEY_CASES = "TRACIA_PROD_CASES_V2";
const STORAGE_KEY_FIRS = "TRACIA_PROD_FIRS_V2";
const STORAGE_KEY_EVIDENCE = "TRACIA_PROD_EVIDENCE_V2";
const STORAGE_KEY_AUDIT = "TRACIA_PROD_AUDIT_V2";
const STORAGE_KEY_SELECTED = "TRACIA_PROD_SELECTED_CASE_V2";

// ---------- Types (Preserved for 100% Backward Compatibility) ----------

export type CaseStatus = "Active" | "Under Review" | "Closed";

export interface Assignee {
  name: string;
  role: string;
  avatar?: string;
}

export interface CaseItem {
  id: string;
  name: string;
  desc: string;
  entities: number;
  date: string;
  status: CaseStatus;
  tone: "person" | "account" | "outline" | "organization";
  icon: string;
  href?: string;
  assignees?: Assignee[];
  category?: string;
}

export interface EntityField {
  label: string;
  value: string;
  matched?: boolean;
}

export interface EntityMatch {
  id: string;
  similarity: number;
  sourceA: string;
  sourceB: string;
  nameA: string;
  nameB: string;
  fieldsA: EntityField[];
  fieldsB: EntityField[];
}

export type EvidenceStatus = "Uploaded" | "OCR Scanning" | "Extracted" | "Indexed";

export interface EvidenceFile {
  id: string;
  filename: string;
  type: string;
  status: EvidenceStatus;
  progress: number;
  caseId?: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  message: string;
  actor: string;
}

export interface CdrRecord {
  id: string;
  caller: string;
  callerName: string;
  receiver: string;
  receiverName: string;
  durationSec: number;
  timestamp: string;
  towerLocation: string;
  crossCaseOverlap: boolean;
}

export interface TimelineEvent {
  id: string;
  time: string;
  date: string;
  title: string;
  category: "Evidence" | "CDR" | "Device" | "Forensics" | "Transfer";
  description: string;
  actor: string;
  evidenceRef?: string;
}

export interface BlockchainRecord {
  evidenceId: string;
  filename: string;
  sha256Hash: string;
  txId: string;
  timestamp: string;
  custodian: string;
  verifiedStatus: "Verified" | "Pending" | "Mismatch";
  history: Array<{ step: string; actor: string; timestamp: string }>;
}

export interface FirRecord {
  id: string;
  caseId: string;
  firNumber: string;
  policeStation: string;
  incidentDate: string;
  sections: string;
  complainant: string;
  accused: string;
  description: string;
  fileName?: string;
  sha256Hash: string;
  status: "Registered" | "Under Investigation" | "Charge Sheet Filed";
  timestamp: string;
}

export interface CyberIntelEvent {
  id: string;
  ipAddress: string;
  macAddress: string;
  deviceId: string;
  suspect: string;
  eventType: string;
  domain: string;
  isVpnOrTor: boolean;
  riskScore: number;
  timestamp: string;
}

interface AppDataContextValue {
  cases: CaseItem[];
  addCase: (input: {
    name: string;
    desc: string;
    category: string;
    priority: string;
    investigator?: string;
    fir?: Partial<FirRecord>;
  }) => CaseItem;
  updateCase: (id: string, patch: Partial<Pick<CaseItem, "name" | "desc" | "status">>) => void;

  selectedCaseId: string | null;
  selectedCase: CaseItem | null;
  setSelectedCaseId: (id: string | null) => void;
  selectCase: (id: string | null) => void;

  firs: FirRecord[];
  addFir: (fir: Omit<FirRecord, "id" | "timestamp">) => FirRecord;

  entityQueue: EntityMatch[];
  totalEntityMatches: number;
  resolveEntity: (id: string, action: "confirm" | "reject") => void;

  evidenceFiles: EvidenceFile[];
  addEvidenceFiles: (files: { filename: string; type: string }[]) => void;

  auditTrail: AuditEntry[];
  pushAudit: (message: string, actor: string) => void;
  resolvedEntities: EntityMatch[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];

  // Neo4j Integration
  neo4jConnected: boolean;
  isNeo4jLoading: boolean;
  neo4jError: string | null;
  currentCypher: string;
  runCypherQuery: (cypher: string) => Promise<void>;
  seedNeo4j: () => Promise<void>;

  // Blueprint Module Data
  cdrRecords: CdrRecord[];
  timelineEvents: TimelineEvent[];
  blockchainRecords: BlockchainRecord[];
  cyberEvents: CyberIntelEvent[];
  // Real-Time Socket.IO
  socketConnected: boolean;
}

// ---------- Context ----------

const AppDataContext = createContext<AppDataContextValue | null>(null);

let caseCounter = 0;
let evidenceCounter = 0;
let auditCounter = 0;

function nowStamp() {
  return new Date().toISOString().split("T")[1].replace("Z", "") + "Z";
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [firs, setFirs] = useState<FirRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [entityQueue, setEntityQueue] = useState<EntityMatch[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [resolvedEntities, setResolvedEntities] = useState<EntityMatch[]>([]);

  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return cases.find((c) => c.id.toUpperCase() === selectedCaseId.toUpperCase()) || null;
  }, [cases, selectedCaseId]);

  const selectCase = useCallback((id: string | null) => {
    setSelectedCaseId(id);
  }, []);

  // Socket.IO Real-Time Connection
  const { connected: socketConnected } = useSocket();

  // Neo4j State
  const [neo4jConnected, setNeo4jConnected] = useState<boolean>(false);
  const [isNeo4jLoading, setIsNeo4jLoading] = useState<boolean>(false);
  const [neo4jError, setNeo4jError] = useState<string | null>(null);
  const [currentCypher, setCurrentCypher] = useState<string>("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100");
  const graphLoadSeq = useRef(0);
  const [customNodes, setCustomNodes] = useState<GraphNode[]>([]);
  const [customEdges, setCustomEdges] = useState<GraphEdge[]>([]);

  // Blueprint Module Data State
  const [cdrRecords, setCdrRecords] = useState<CdrRecord[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [blockchainRecords, setBlockchainRecords] = useState<BlockchainRecord[]>([]);
  const [cyberEvents, setCyberEvents] = useState<CyberIntelEvent[]>([]);

  const pushAudit = useCallback((message: string, actor: string) => {
    auditCounter += 1;
    const entry: AuditEntry = { id: `audit-${auditCounter}`, time: nowStamp(), message, actor };
    setAuditTrail((prev) => [entry, ...prev]);
    // Dispatch to service layer in background
    logAuditEvent(message, actor).catch(() => {});
  }, []);

  // 1. Client-Side LocalStorage Hydration on Mount
  useEffect(() => {
    try {
      // Purge legacy mock cache keys
      localStorage.removeItem("TRACIA_CASES_V1");
      localStorage.removeItem("TRACIA_FIRS_V1");
      localStorage.removeItem("TRACIA_EVIDENCE_V1");
      localStorage.removeItem("TRACIA_AUDIT_V1");
      localStorage.removeItem("TRACIA_SELECTED_CASE_V1");

      const storedCases = localStorage.getItem(STORAGE_KEY_CASES);
      if (storedCases) {
        const parsed = JSON.parse(storedCases);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCases(parsed);
        }
      }

      const storedFirs = localStorage.getItem(STORAGE_KEY_FIRS);
      if (storedFirs) {
        const parsed = JSON.parse(storedFirs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFirs(parsed);
        }
      }

      const storedEvidence = localStorage.getItem(STORAGE_KEY_EVIDENCE);
      if (storedEvidence) {
        const parsed = JSON.parse(storedEvidence);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvidenceFiles(parsed);
        }
      }

      const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (storedAudit) {
        const parsed = JSON.parse(storedAudit);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAuditTrail(parsed);
        }
      }

      const storedSel = localStorage.getItem(STORAGE_KEY_SELECTED);
      if (storedSel) {
        setSelectedCaseId(storedSel);
      }
    } catch (e) {
      console.warn("[TRACIA Storage] LocalStorage hydration notice:", e);
    }
  }, []);

  // 2. LocalStorage Persistence Sync
  useEffect(() => {
    if (typeof window !== "undefined" && cases.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(cases));
      } catch {}
    }
  }, [cases]);

  useEffect(() => {
    if (typeof window !== "undefined" && firs.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_FIRS, JSON.stringify(firs));
      } catch {}
    }
  }, [firs]);

  useEffect(() => {
    if (typeof window !== "undefined" && evidenceFiles.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_EVIDENCE, JSON.stringify(evidenceFiles));
      } catch {}
    }
  }, [evidenceFiles]);

  useEffect(() => {
    if (typeof window !== "undefined" && auditTrail.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(auditTrail.slice(0, 100)));
      } catch {}
    }
  }, [auditTrail]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (selectedCaseId) {
          localStorage.setItem(STORAGE_KEY_SELECTED, selectedCaseId);
        } else {
          localStorage.removeItem(STORAGE_KEY_SELECTED);
        }
      } catch {}
    }
  }, [selectedCaseId]);

  // 3. Socket.IO Inbound Event Listeners
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const handleCaseCreated = (newCase: CaseItem) => {
      if (!newCase || !newCase.id) return;
      setCases((prev) => {
        if (prev.some((c) => c.id === newCase.id)) return prev;
        return [newCase, ...prev];
      });
      pushAudit(`Remote Case Ingested: ${newCase.name} (${newCase.id})`, "SOCKET.IO");
    };

    const handleCaseUpdated = (data: { id: string; patch: Partial<CaseItem> }) => {
      if (!data || !data.id) return;
      setCases((prev) =>
        prev.map((c) => (c.id === data.id ? { ...c, ...data.patch } : c))
      );
    };

    const handleFirRegistered = (newFir: FirRecord) => {
      if (!newFir || !newFir.id) return;
      setFirs((prev) => {
        if (prev.some((f) => f.id === newFir.id)) return prev;
        return [newFir, ...prev];
      });
      pushAudit(`Remote FIR Received: ${newFir.firNumber}`, "SOCKET.IO");
    };

    const handleEvidenceUploaded = (evd: EvidenceFile) => {
      if (!evd || !evd.id) return;
      setEvidenceFiles((prev) => {
        if (prev.some((e) => e.id === evd.id)) return prev;
        return [evd, ...prev];
      });
    };

    s.on("case:created", handleCaseCreated);
    s.on("case:updated", handleCaseUpdated);
    s.on("fir:registered", handleFirRegistered);
    s.on("evidence:uploaded", handleEvidenceUploaded);

    return () => {
      s.off("case:created", handleCaseCreated);
      s.off("case:updated", handleCaseUpdated);
      s.off("fir:registered", handleFirRegistered);
      s.off("evidence:uploaded", handleEvidenceUploaded);
    };
  }, [pushAudit]);

  const runCypherQuery = useCallback(async (cypher: string) => {
    setIsNeo4jLoading(true);
    setNeo4jError(null);
    setCurrentCypher(cypher);
    try {
      const res = await fetch(`/api/graph?cypher=${encodeURIComponent(cypher)}`);
      const data = await res.json();
      setNeo4jConnected(!!data.connected);
      if (data.error) {
        setNeo4jError(data.error);
      }
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        setCustomNodes(data.nodes);
        setCustomEdges(data.edges);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute Cypher query";
      setNeo4jError(msg);
      setNeo4jConnected(false);
    } finally {
      setIsNeo4jLoading(false);
    }
  }, []);

  const loadGraphForCase = useCallback(async (caseId: string | null) => {
    const seq = ++graphLoadSeq.current;
    setIsNeo4jLoading(true);
    setNeo4jError(null);
    setCustomNodes([]);
    setCustomEdges([]);
    const query = caseId
      ? `/api/graph/data?caseId=${encodeURIComponent(caseId)}`
      : "/api/graph/data";
    setCurrentCypher("MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100");
    try {
      const res = await fetch(query);
      const data = await res.json();
      if (seq !== graphLoadSeq.current) return;
      setNeo4jConnected(!!data.connected);
      if (data.error) setNeo4jError(data.error);
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        setCustomNodes(data.nodes);
        setCustomEdges(data.edges);
      }
    } catch (err: unknown) {
      if (seq !== graphLoadSeq.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load case graph";
      setNeo4jError(msg);
      setNeo4jConnected(false);
    } finally {
      if (seq === graphLoadSeq.current) {
        setIsNeo4jLoading(false);
      }
    }
  }, []);

  // Initial load of live data from Neo4j cluster and API routes
  useEffect(() => {
    async function loadLiveData() {
      // 1. Live Cases from Server & Neo4j
      try {
        const cRes = await fetch("/api/cases");
        if (cRes.ok) {
          const liveCases = await cRes.json();
          if (Array.isArray(liveCases)) {
            setCases(liveCases);
          }
        }
      } catch {}

      // 2. Live FIRs from Server Storage
      try {
        const fRes = await fetch("/api/firs");
        if (fRes.ok) {
          const liveFirs = await fRes.json();
          if (Array.isArray(liveFirs)) {
            setFirs(liveFirs);
          }
        }
      } catch {}

      // 3. Live Entity Resolution Queue from Neo4j & Storage
      try {
        const erRes = await fetch("/api/entity-resolution/queue");
        if (erRes.ok) {
          const liveEr = await erRes.json();
          if (Array.isArray(liveEr)) {
            setEntityQueue(liveEr);
          }
        }
      } catch {}

      // 4. Live Evidence Repository
      try {
        const evdRes = await fetch("/api/evidence");
        if (evdRes.ok) {
          const liveEvd = await evdRes.json();
          if (Array.isArray(liveEvd)) {
            setEvidenceFiles(liveEvd);
          }
        }
      } catch {}

      // 5. Live Cyber Events
      try {
        const cyRes = await fetch("/api/cyber-intel");
        if (cyRes.ok) {
          const cyData = await cyRes.json();
          if (Array.isArray(cyData)) {
            setCyberEvents(cyData);
          }
        }
      } catch {}

      // 6. Live CDR Records
      try {
        const cdrRes = await fetch("/api/cdr");
        if (cdrRes.ok) {
          const cdrData = await cdrRes.json();
          if (Array.isArray(cdrData)) {
            setCdrRecords(cdrData);
          }
        }
      } catch {}

      // 7. Live Timeline Events
      try {
        const tlRes = await fetch("/api/timeline");
        if (tlRes.ok) {
          const tlData = await tlRes.json();
          if (Array.isArray(tlData)) {
            setTimelineEvents(tlData);
          }
        }
      } catch {}

      // 8. Live Blockchain Custody Records
      try {
        const bcRes = await fetch("/api/blockchain");
        if (bcRes.ok) {
          const bcData = await bcRes.json();
          if (Array.isArray(bcData)) {
            setBlockchainRecords(bcData);
          }
        }
      } catch {}

      // Graph data is loaded by the case-specific effect below so rapid case
      // changes cannot be overwritten by this initial data refresh.
    }

    loadLiveData();
  }, []);

  useEffect(() => {
    loadGraphForCase(selectedCaseId);
  }, [loadGraphForCase, selectedCaseId]);

  const seedNeo4j = useCallback(async () => {
    setIsNeo4jLoading(true);
    setNeo4jError(null);
    try {
      const res = await fetch("/api/graph/seed", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setNeo4jError(data.message || "Failed to seed Neo4j");
      } else {
        pushAudit("Neo4j database seeded with criminal network schema", "SYSTEM");
        await runCypherQuery(currentCypher);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to seed Neo4j";
      setNeo4jError(msg);
    } finally {
      setIsNeo4jLoading(false);
    }
  }, [currentCypher, pushAudit, runCypherQuery]);

  const addCase = useCallback<AppDataContextValue["addCase"]>((input) => {
    caseCounter += 1;
    const toneByCategory: Record<string, CaseItem["tone"]> = {
      kidnapping: "person",
      cyber: "account",
      narcotics: "outline",
      money_laundering: "organization",
      arms: "person",
    };
    const iconByCategory: Record<string, string> = {
      kidnapping: "group",
      cyber: "account_balance",
      narcotics: "local_shipping",
      money_laundering: "domain",
      arms: "military_tech",
    };

    const leadInvestigatorName = input.investigator === "smith"
      ? "Det. J. Smith"
      : input.investigator === "doe"
      ? "Agent R. Doe"
      : "Inspector A. Admin";

    const newCase: CaseItem = {
      id: `CASE_${100 + caseCounter}`,
      name: input.name,
      desc: input.desc || "No initial summary provided.",
      entities: 0,
      date: new Date().toISOString().split("T")[0],
      status: "Active",
      tone: toneByCategory[input.category] ?? "outline",
      icon: iconByCategory[input.category] ?? "folder",
      assignees: [
        { name: leadInvestigatorName, role: "Lead Investigator" },
        { name: "Field Tech 02", role: "Assigned Intelligence Officer" },
      ],
    };
    setCases((prev) => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    pushAudit(`Case created: ${newCase.name} (${newCase.id})`, "Inspector A.");

    // Real-Time Socket.IO Broadcast
    broadcastCaseCreated(newCase);

    if (input.fir) {
      const firNumber = input.fir.firNumber || `FIR-${newCase.id}`;
      const newFir: FirRecord = {
        id: `fir-${Date.now().toString().slice(-4)}`,
        caseId: newCase.id,
        firNumber,
        policeStation: input.fir.policeStation || "Cyber Crime Police Station",
        incidentDate: input.fir.incidentDate || new Date().toISOString().split("T")[0],
        sections: input.fir.sections || "Sec 66D IT Act & 420 IPC",
        complainant: input.fir.complainant || "State Cyber Cell",
        accused: input.fir.accused || "Unidentified Cyber Ring",
        description: input.fir.description || input.desc || "First Information Report ingested on case creation.",
        fileName: input.fir.fileName || `${firNumber.replace(/\//g, "_")}.pdf`,
        sha256Hash: input.fir.sha256Hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status: input.fir.status || "Registered",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      };
      setFirs((prev) => [newFir, ...prev]);
      setEvidenceFiles((prev) => [
        {
          id: `evd-${Date.now().toString().slice(-4)}`,
          filename: newFir.fileName || `${firNumber}.pdf`,
          type: "First Information Report (FIR)",
          status: "Indexed",
          progress: 100,
        },
        ...prev,
      ]);
      pushAudit(`FIR ${firNumber} registered and cryptographically anchored to ${newCase.id}`, "IO-101");

      // Persist FIR to server backend storage
      fetch("/api/firs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFir),
      }).catch(() => {});

      // Broadcast FIR registration
      broadcastFirRegistered(newFir);
    }

    // Sync with cases service (which writes to persistent cases storage)
    addCaseApi({
      name: input.name,
      desc: input.desc,
      category: input.category,
      priority: (input.priority as "High" | "Medium" | "Critical" | "Low") || "High",
    }).catch(() => {});

    return newCase;
  }, [pushAudit]);

  const addFir = useCallback<AppDataContextValue["addFir"]>((firData) => {
    const id = `fir-${Date.now().toString().slice(-4)}`;
    const newFir: FirRecord = {
      ...firData,
      id,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    setFirs((prev) => [newFir, ...prev]);
    pushAudit(`FIR Filed & Ingested: ${newFir.firNumber} (${newFir.policeStation})`, "IO-101");

    // Persist to server backend storage
    fetch("/api/firs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newFir),
    }).catch(() => {});

    // Broadcast FIR registration
    broadcastFirRegistered(newFir);

    return newFir;
  }, [pushAudit]);

  const updateCase = useCallback<AppDataContextValue["updateCase"]>((id, patch) => {
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    const changed = Object.keys(patch).join(", ");
    pushAudit(`Case updated: ${id} (${changed})`, "Inspector A.");

    // Broadcast case update
    broadcastCaseUpdated(id, patch);

    // Sync with cases service
    updateCaseApi(id, patch).catch(() => {});
  }, [pushAudit]);

  const resolveEntity = useCallback<AppDataContextValue["resolveEntity"]>((id, action) => {
    setEntityQueue((prev) => {
      const match = prev.find((m) => m.id === id);
      if (match) {
        pushAudit(
          action === "confirm"
            ? `Entity match confirmed: ${match.nameA} ? ${match.nameB} (${match.similarity}%)`
            : `Entity match rejected: ${match.nameA} ? ${match.nameB}`,
          "Inspector A."
        );
        // Sync with entity resolution service with real entity names
        resolveEntityMatch(id, action, match.nameA, match.nameB).catch(() => {});
      } else {
        resolveEntityMatch(id, action).catch(() => {});
      }
      if (match && action === "confirm") setResolvedEntities((current) => [...current, match]);
      return prev.filter((m) => m.id !== id);
    });
  }, [pushAudit]);

  const addEvidenceFiles = useCallback<AppDataContextValue["addEvidenceFiles"]>((files) => {
    files.forEach((f) => {
      evidenceCounter += 1;
      const id = `evd-${evidenceCounter}`;
      const newEvd: EvidenceFile = { id, filename: f.filename, type: f.type, status: "Uploaded", progress: 0 };
      setEvidenceFiles((prev) => [newEvd, ...prev]);
      pushAudit(`Evidence Uploaded: ${f.filename}`, "Inspector A.");

      // Broadcast evidence upload
      broadcastEvidenceUploaded(newEvd);

      uploadEvidenceFile({ filename: f.filename, type: f.type }).catch(() => {});

      // Simulate the ingestion pipeline: Uploaded -> OCR Scanning (progress) -> Extracted -> Indexed
      window.setTimeout(() => {
        setEvidenceFiles((prev) => prev.map((e) => (e.id === id ? { ...e, status: "OCR Scanning", progress: 10 } : e)));
        let progress = 10;
        const interval = window.setInterval(() => {
          progress += 30;
          if (progress >= 100) {
            window.clearInterval(interval);
            setEvidenceFiles((prev) => prev.map((e) => (e.id === id ? { ...e, status: "Extracted", progress: 100 } : e)));
            pushAudit(`OCR Extraction Complete: ${f.filename}`, "SYSTEM");
            window.setTimeout(() => {
              setEvidenceFiles((prev) => prev.map((e) => (e.id === id ? { ...e, status: "Indexed" } : e)));
              pushAudit(`Indexed: ${f.filename}`, "SYSTEM");
            }, 900);
          } else {
            setEvidenceFiles((prev) => prev.map((e) => (e.id === id ? { ...e, progress } : e)));
          }
        }, 500);
      }, 600);
    });
  }, [pushAudit]);

  const graph = useMemo(() => {
    const nodes = [...customNodes];
    const edges = [...customEdges];
    const existingNodeIds = new Set(nodes.map((n) => n.id));
    const existingEdgeIds = new Set(edges.map((e) => e.id));

    resolvedEntities.forEach((match) => {
      const aId = `resolved-${match.id}-a`;
      const bId = `resolved-${match.id}-b`;
      const edgeId = `resolved-edge-${match.id}`;

      if (!existingNodeIds.has(aId)) {
        existingNodeIds.add(aId);
        nodes.push({ id: aId, label: match.nameA, type: "person", details: { subtitle: `Resolved from ${match.sourceA}`, idLabel: match.id, connections: 1 } });
      }
      if (!existingNodeIds.has(bId)) {
        existingNodeIds.add(bId);
        nodes.push({ id: bId, label: match.nameB, type: "person", details: { subtitle: `Resolved from ${match.sourceB}`, idLabel: `${match.id}-B`, connections: 1 } });
      }
      if (!existingEdgeIds.has(edgeId)) {
        existingEdgeIds.add(edgeId);
        edges.push({ id: edgeId, from: aId, to: bId, label: `confirmed ${match.similarity}%`, kind: "inferred" });
      }
    });
    return { nodes, edges };
  }, [customNodes, customEdges, resolvedEntities]);

  const value = useMemo<AppDataContextValue>(() => ({
    cases, addCase, updateCase, selectedCaseId, selectedCase, setSelectedCaseId, selectCase,
    firs, addFir,
    entityQueue, totalEntityMatches: entityQueue.length, resolveEntity,
    evidenceFiles, addEvidenceFiles, auditTrail, pushAudit, resolvedEntities, graphNodes: graph.nodes, graphEdges: graph.edges,
    neo4jConnected, isNeo4jLoading, neo4jError, currentCypher, runCypherQuery, seedNeo4j,
    cdrRecords, timelineEvents, blockchainRecords, cyberEvents,
    socketConnected,
  }), [cases, addCase, updateCase, selectedCaseId, selectedCase, selectCase, firs, addFir, entityQueue, resolveEntity, evidenceFiles, addEvidenceFiles, auditTrail, pushAudit, resolvedEntities, graph, neo4jConnected, isNeo4jLoading, neo4jError, currentCypher, runCypherQuery, seedNeo4j, cdrRecords, timelineEvents, blockchainRecords, cyberEvents, socketConnected]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

