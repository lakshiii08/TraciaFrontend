import type { CdrMetrics, CdrRecord, CdrRelayChain } from "@/types/cdr";

const CANONICAL_CDR_RECORDS: CdrRecord[] = [
  {
    id: "cdr-001",
    caller: "+91 9123456780",
    callerName: "Person A (Burner Line)",
    receiver: "+91 9876543210",
    receiverName: "Person B (Registered Line)",
    durationSec: 342,
    timestamp: "2025-04-18 14:32:10",
    towerLocation: "Bandra Kurla Complex (BKC), Mumbai",
    crossCaseOverlap: true,
  },
  {
    id: "cdr-002",
    caller: "+91 9876543210",
    receiver: "+91 9123456780",
    callerName: "Person B (Registered Line)",
    receiverName: "Person A (Burner Line)",
    durationSec: 185,
    timestamp: "2025-04-18 15:10:44",
    towerLocation: "Connaught Place / Rohini, New Delhi",
    crossCaseOverlap: true,
  },
  {
    id: "cdr-003",
    caller: "+91 9123456780",
    receiver: "+91 9820012345",
    callerName: "Person A (Burner Line)",
    receiverName: "XYZ Logistics Transit Desk",
    durationSec: 94,
    timestamp: "2025-04-19 09:14:02",
    towerLocation: "Bandra Kurla Complex (BKC), Mumbai",
    crossCaseOverlap: false,
  },
  {
    id: "cdr-004",
    caller: "+91 9876543210",
    receiver: "+91 9811098765",
    callerName: "Person B (Registered Line)",
    receiverName: "Fleet Handler MH01AB1234",
    durationSec: 215,
    timestamp: "2025-04-19 16:22:30",
    towerLocation: "NH-48 Corridor Checkpoint, Delhi-Jaipur Highway",
    crossCaseOverlap: true,
  },
  {
    id: "cdr-005",
    caller: "+91 9123456780",
    receiver: "+91 9876543210",
    callerName: "Person A (Burner Line)",
    receiverName: "Person B (Registered Line)",
    durationSec: 412,
    timestamp: "2025-04-20 11:05:18",
    towerLocation: "Nariman Point Financial Hub, Mumbai",
    crossCaseOverlap: true,
  },
];

let cdrStore: CdrRecord[] = [...CANONICAL_CDR_RECORDS];

export function getCdrRecords(): CdrRecord[] {
  return [...cdrStore];
}

export function addCdrRecord(record: CdrRecord): CdrRecord[] {
  cdrStore = [record, ...cdrStore];
  return getCdrRecords();
}

export function getCdrRelayChain(): CdrRelayChain {
  return {
    nodes: [
      {
        id: "rc-node-1",
        name: "Person A",
        phone: "+91 9123456780",
        role: "Primary Syndicate Hub",
        tone: "rose",
      },
      {
        id: "rc-node-2",
        name: "Person B",
        phone: "+91 9876543210",
        role: "Logistics Coordinator",
        tone: "amber",
      },
      {
        id: "rc-node-3",
        name: "XYZ Logistics Transit",
        phone: "+91 9820012345",
        role: "Transport Fleet Dispatch",
        tone: "primary",
      },
      {
        id: "rc-node-4",
        name: "Account Desk (Account 4567)",
        phone: "+91 9811098765",
        role: "Settlement Desk",
        tone: "emerald",
      },
    ],
    steps: [
      {
        fromNodeId: "rc-node-1",
        toNodeId: "rc-node-2",
        durationSec: 342,
        callCount: 6,
      },
      {
        fromNodeId: "rc-node-2",
        toNodeId: "rc-node-3",
        durationSec: 185,
        callCount: 4,
      },
      {
        fromNodeId: "rc-node-1",
        toNodeId: "rc-node-4",
        durationSec: 94,
        callCount: 2,
      },
    ],
  };
}

export function getCdrMetrics(): CdrMetrics {
  return {
    frequentContactsCount: 14,
    frequentContactsHighlight: "Burner +91 9123456780 <-> +91 9876543210 (342s peak call)",
    sharedContactsCount: 3,
    sharedContactsHighlight: "XYZ Logistics Transit Hub & Bank Desk",
    communicationClustersCount: 2,
    communicationClustersHighlight: "Mumbai BKC & Delhi Rohini Triangulations",
    crossCaseOverlapsCount: 2,
    crossCaseOverlapsHighlight: "Overlaps Case #209 and Case #317",
  };
}
