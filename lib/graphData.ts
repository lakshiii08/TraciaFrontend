import type { EntityType, GraphNode, GraphEdge } from "@/types/graph";
import { getFallbackMurderCaseGraph } from "@/lib/aiGraphGenerator";

export type { EntityType, GraphNode, GraphEdge };

export const entityColors: Record<EntityType, string> = {
  person: "#3B82F6",
  phone: "#22C55E",
  vehicle: "#F59E0B",
  location: "#F97316",
  organization: "#A855F7",
  account: "#14B8A6",
  case: "#A855F7",
  evidence: "#c1c6d8",
};

/**
 * Live Canonical Knowledge Graph (Operation Nightshade Homicide Investigation)
 * Mirrored directly from the live Neo4j Aura cloud database:
 * neo4j+s://ba15f687.databases.neo4j.io
 */
const fallbackGraph = getFallbackMurderCaseGraph();

export const graphNodes: GraphNode[] = fallbackGraph.nodes;
export const graphEdges: GraphEdge[] = fallbackGraph.edges;
