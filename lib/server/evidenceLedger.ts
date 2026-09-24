import crypto from "node:crypto";
import type { EvidenceRecord } from "@/types/evidenceIntegrity";
import type { EvidenceFile, FirRecord } from "@/lib/store";
import {
  getPersistentEvidence,
  getPersistentFirs,
  savePersistentEvidence,
  savePersistentFirs,
} from "@/lib/storage/persistence";

type StoredEvidence = EvidenceFile & {
  caseId?: string;
  sha256?: string;
  sha256Hash?: string;
  originalSha256?: string;
  original_sha256?: string;
  isTampered?: boolean;
  is_tampered?: boolean;
  blockchainNetwork?: string;
  blockchain_network?: string;
  contractAddress?: string;
  contract_address?: string;
  transactionHash?: string;
  transaction_hash?: string;
  blockNumber?: number;
  block_number?: number;
  registeredAt?: string;
  registered_at?: string;
  registeredBy?: string;
  registered_by?: string;
  explorerUrl?: string;
  explorer_url?: string;
  fileSizeBytes?: number;
  file_size_bytes?: number;
  mimeType?: string;
  mime_type?: string;
};

type StoredFir = FirRecord & {
  originalSha256?: string;
  original_sha256?: string;
  isTampered?: boolean;
  is_tampered?: boolean;
};

const FALLBACK_HASH_INPUT = "tracia-empty-evidence-record";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function configuredContractAddress(): string {
  return process.env.EVIDENCE_REGISTRY_CONTRACT_ADDRESS || "";
}

function configuredNetwork(): string {
  return process.env.BLOCKCHAIN_NETWORK_NAME || "Configured Evidence Ledger";
}

function deterministicTxHash(evidenceId: string, hash: string): string {
  return `0x${sha256Hex(`${evidenceId}:${hash}:tx`)}`;
}

function deterministicBlockNumber(evidenceId: string): number {
  const hex = sha256Hex(`${evidenceId}:block`).slice(0, 8);
  return Number.parseInt(hex, 16);
}

function makeExplorerUrl(txHash: string): string | undefined {
  const base = process.env.BLOCKCHAIN_EXPLORER_TX_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/${txHash}` : undefined;
}

function statusForEvidence(file: EvidenceFile): EvidenceRecord["status"] {
  if (file.status === "Uploaded" || file.status === "OCR Scanning") return "PENDING";
  return "CONFIRMED";
}

function recordFromEvidence(file: StoredEvidence, fir?: FirRecord): EvidenceRecord {
  const registeredHash =
    file.originalSha256 ||
    file.original_sha256 ||
    file.sha256 ||
    file.sha256Hash ||
    fir?.sha256Hash ||
    sha256Hex(file.filename || FALLBACK_HASH_INPUT);
  const currentHash =
    file.sha256 ||
    file.sha256Hash ||
    registeredHash;
  const txHash =
    file.transactionHash ||
    file.transaction_hash ||
    deterministicTxHash(file.id, registeredHash);

  return {
    evidence_id: file.id,
    case_id: file.caseId || fir?.caseId || "UNASSIGNED",
    version: 1,
    file_name: file.filename,
    sha256: currentHash,
    blockchain_network: file.blockchainNetwork || file.blockchain_network || configuredNetwork(),
    contract_address: file.contractAddress || file.contract_address || configuredContractAddress(),
    transaction_hash: txHash,
    block_number: file.blockNumber || file.block_number || deterministicBlockNumber(file.id),
    status: file.isTampered || file.is_tampered ? "TAMPERED" : statusForEvidence(file),
    registered_at: file.registeredAt || file.registered_at || fir?.timestamp || new Date().toISOString(),
    registered_by: file.registeredBy || file.registered_by || process.env.EVIDENCE_LEDGER_REGISTERED_BY || "TRACIA_SYSTEM",
    explorer_url: file.explorerUrl || file.explorer_url || makeExplorerUrl(txHash),
    file_size_bytes: file.fileSizeBytes || file.file_size_bytes,
    mime_type: file.mimeType || file.mime_type || file.type,
    is_tampered: Boolean(file.isTampered || file.is_tampered),
    original_sha256: registeredHash,
  };
}

function recordFromFir(fir: StoredFir): EvidenceRecord {
  const registeredHash = fir.originalSha256 || fir.original_sha256 || fir.sha256Hash || sha256Hex(fir.fileName || fir.firNumber);
  const currentHash = fir.sha256Hash || registeredHash;
  const evidenceId = fir.id || fir.firNumber;
  const txHash = deterministicTxHash(evidenceId, registeredHash);

  return {
    evidence_id: evidenceId,
    case_id: fir.caseId || "UNASSIGNED",
    version: 1,
    file_name: fir.fileName || `${fir.firNumber.replace(/\//g, "_")}.pdf`,
    sha256: currentHash,
    blockchain_network: configuredNetwork(),
    contract_address: configuredContractAddress(),
    transaction_hash: txHash,
    block_number: deterministicBlockNumber(evidenceId),
    status: fir.isTampered || fir.is_tampered ? "TAMPERED" : "CONFIRMED",
    registered_at: fir.timestamp || new Date().toISOString(),
    registered_by: process.env.EVIDENCE_LEDGER_REGISTERED_BY || fir.policeStation || "TRACIA_SYSTEM",
    explorer_url: makeExplorerUrl(txHash),
    mime_type: "First Information Report",
    is_tampered: Boolean(fir.isTampered || fir.is_tampered),
    original_sha256: registeredHash,
  };
}

export async function getPersistentEvidenceLedger(): Promise<EvidenceRecord[]> {
  const [evidenceFiles, firs] = await Promise.all([
    getPersistentEvidence(),
    getPersistentFirs(),
  ]);
  const firsByFile = new Map(firs.map((fir) => [fir.fileName?.toLowerCase(), fir]));
  const usedFirIds = new Set<string>();

  const evidenceRecords = evidenceFiles.map((file) => {
    const fir = firsByFile.get(file.filename?.toLowerCase());
    if (fir) usedFirIds.add(fir.id);
    return recordFromEvidence(file as StoredEvidence, fir);
  });

  const firRecords = firs
    .filter((fir) => !usedFirIds.has(fir.id))
    .map((fir) => recordFromFir(fir as StoredFir));

  return [...evidenceRecords, ...firRecords];
}

export async function getPersistentLedgerRecord(id: string): Promise<EvidenceRecord | null> {
  const records = await getPersistentEvidenceLedger();
  return records.find((record) => record.evidence_id.toLowerCase() === id.toLowerCase()) || null;
}

export async function simulatePersistentEvidenceTamper(id: string): Promise<EvidenceRecord | null> {
  const [evidenceFiles, firs] = await Promise.all([
    getPersistentEvidence(),
    getPersistentFirs(),
  ]);
  const evidenceIndex = evidenceFiles.findIndex((file) => file.id.toLowerCase() === id.toLowerCase());

  if (evidenceIndex >= 0) {
    const file = evidenceFiles[evidenceIndex] as StoredEvidence;
    const original = file.originalSha256 || file.original_sha256 || file.sha256 || file.sha256Hash || sha256Hex(file.filename);
    evidenceFiles[evidenceIndex] = {
      ...file,
      originalSha256: original,
      sha256: `bad0${original.slice(4)}`,
      isTampered: true,
    } as StoredEvidence;
    await savePersistentEvidence(evidenceFiles);
    return getPersistentLedgerRecord(id);
  }

  const firIndex = firs.findIndex((fir) => fir.id.toLowerCase() === id.toLowerCase());
  if (firIndex >= 0) {
    const fir = firs[firIndex] as StoredFir;
    const original = fir.originalSha256 || fir.original_sha256 || fir.sha256Hash || sha256Hex(fir.fileName || fir.firNumber);
    firs[firIndex] = {
      ...fir,
      originalSha256: original,
      sha256Hash: `bad0${original.slice(4)}`,
      isTampered: true,
    } as StoredFir;
    await savePersistentFirs(firs);
    return getPersistentLedgerRecord(id);
  }

  return null;
}

export async function restorePersistentEvidence(id: string): Promise<EvidenceRecord | null> {
  const [evidenceFiles, firs] = await Promise.all([
    getPersistentEvidence(),
    getPersistentFirs(),
  ]);
  const evidenceIndex = evidenceFiles.findIndex((file) => file.id.toLowerCase() === id.toLowerCase());

  if (evidenceIndex >= 0) {
    const file = evidenceFiles[evidenceIndex] as StoredEvidence;
    const original = file.originalSha256 || file.original_sha256 || file.sha256 || file.sha256Hash || sha256Hex(file.filename);
    evidenceFiles[evidenceIndex] = {
      ...file,
      originalSha256: original,
      sha256: original,
      isTampered: false,
    } as StoredEvidence;
    await savePersistentEvidence(evidenceFiles);
    return getPersistentLedgerRecord(id);
  }

  const firIndex = firs.findIndex((fir) => fir.id.toLowerCase() === id.toLowerCase());
  if (firIndex >= 0) {
    const fir = firs[firIndex] as StoredFir;
    const original = fir.originalSha256 || fir.original_sha256 || fir.sha256Hash || sha256Hex(fir.fileName || fir.firNumber);
    firs[firIndex] = {
      ...fir,
      originalSha256: original,
      sha256Hash: original,
      isTampered: false,
    } as StoredFir;
    await savePersistentFirs(firs);
    return getPersistentLedgerRecord(id);
  }

  return null;
}
