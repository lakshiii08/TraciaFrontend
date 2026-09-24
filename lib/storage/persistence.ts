import fs from "fs/promises";
import path from "path";
import type { ExtendedCaseItem } from "@/types/cases";
import type { FirRecord, EvidenceFile, AuditEntry } from "@/lib/store";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readArrayFile<T>(filename: string): Promise<T[]> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeArrayFile<T>(filename: string, rows: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getPersistentCases(): Promise<ExtendedCaseItem[]> {
  return readArrayFile<ExtendedCaseItem>("cases.json");
}

export async function savePersistentCases(cases: ExtendedCaseItem[]): Promise<void> {
  await writeArrayFile("cases.json", cases);
}

export async function appendPersistentCase(newCase: ExtendedCaseItem): Promise<void> {
  const current = await getPersistentCases();
  const filtered = current.filter((c) => c.id.toUpperCase() !== newCase.id.toUpperCase());
  await savePersistentCases([newCase, ...filtered]);
}

export async function updatePersistentCase(
  id: string,
  patch: Partial<ExtendedCaseItem>
): Promise<ExtendedCaseItem | null> {
  const current = await getPersistentCases();
  let updated: ExtendedCaseItem | null = null;
  const next = current.map((c) => {
    if (c.id.toUpperCase() === id.toUpperCase()) {
      updated = { ...c, ...patch };
      return updated;
    }
    return c;
  });
  if (updated) {
    await savePersistentCases(next);
  }
  return updated;
}

export async function getPersistentFirs(): Promise<FirRecord[]> {
  return readArrayFile<FirRecord>("firs.json");
}

export async function savePersistentFirs(firs: FirRecord[]): Promise<void> {
  await writeArrayFile("firs.json", firs);
}

export async function appendPersistentFir(newFir: FirRecord): Promise<void> {
  const current = await getPersistentFirs();
  const filtered = current.filter((f) => f.id !== newFir.id);
  await savePersistentFirs([newFir, ...filtered]);
}

export async function getPersistentEvidence(): Promise<EvidenceFile[]> {
  return readArrayFile<EvidenceFile>("evidence.json");
}

export async function savePersistentEvidence(files: EvidenceFile[]): Promise<void> {
  await writeArrayFile("evidence.json", files);
}

export async function appendPersistentEvidence(files: EvidenceFile[]): Promise<void> {
  const current = await getPersistentEvidence();
  const existingIds = new Set(current.map((e) => e.id));
  const newFiles = files.filter((f) => !existingIds.has(f.id));
  await savePersistentEvidence([...newFiles, ...current]);
}

export async function getPersistentAudit(): Promise<AuditEntry[]> {
  return readArrayFile<AuditEntry>("audit_logs.json");
}

export async function appendPersistentAudit(entry: AuditEntry): Promise<void> {
  const current = await getPersistentAudit();
  await writeArrayFile("audit_logs.json", [entry, ...current].slice(0, 500));
}
