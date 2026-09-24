/**
 * Cryptographic hashing utilities for digital forensics and evidence integrity.
 * Uses the native Web Crypto Subtle API for zero-dependency, high-speed in-browser hashing.
 */

export interface HashResult {
  sha256: string;
  sha1: string;
  fileSizeBytes: number;
  fileName: string;
  mimeType: string;
  lastModified: number;
}

/**
 * Compute SHA-256 checksum from an ArrayBuffer.
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute SHA-1 checksum from an ArrayBuffer for forensic redundancy.
 */
export async function computeSha1(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute full cryptographic profile of a File.
 */
export async function hashFile(file: File): Promise<HashResult> {
  const buffer = await file.arrayBuffer();
  const [sha256, sha1] = await Promise.all([
    computeSha256(buffer),
    computeSha1(buffer),
  ]);

  return {
    sha256,
    sha1,
    fileSizeBytes: file.size,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  };
}

/**
 * Format bytes to human readable format (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
