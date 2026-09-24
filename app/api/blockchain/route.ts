
import { NextRequest, NextResponse } from "next/server";
import { getPersistentEvidenceLedger } from "@/lib/server/evidenceLedger";

const BLOCKCHAIN_URL = (
  process.env.BLOCKCHAIN_SERVICE_URL ||
  "https://tracia-blockchain-2.onrender.com"
).replace(/\/+$/, "");

export async function GET() {
  try {
    const response = await fetch(
      `${BLOCKCHAIN_URL}/api/evidence`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch blockchain evidence records" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Blockchain records error:", error);

    // Fall back to the existing local ledger if the API is unavailable.
    try {
      const ledger = await getPersistentEvidenceLedger();

      const records = ledger.map((item) => ({
        evidenceId: item.evidence_id,
        filename: item.file_name,
        sha256Hash: item.original_sha256 || item.sha256,
        txId: item.transaction_hash,
        timestamp: item.registered_at,
        custodian: item.registered_by,
        verifiedStatus: item.is_tampered
          ? "Mismatch"
          : item.status === "PENDING"
          ? "Pending"
          : "Verified",
      }));

      return NextResponse.json(records);
    } catch {
      return NextResponse.json(
        { error: "Blockchain service and local ledger unavailable" },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { evidenceId, filename, fileHash } = body;

    if (!evidenceId) {
      return NextResponse.json(
        { error: "evidenceId is required for blockchain verification" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BLOCKCHAIN_URL}/api/evidence/${encodeURIComponent(
        evidenceId
      )}/verify`,
      { cache: "no-store" }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        data || { error: "Blockchain verification failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Blockchain verification error:", error);

    return NextResponse.json(
      { error: "Failed to verify evidence against blockchain service" },
      { status: 500 }
    );
  }
}