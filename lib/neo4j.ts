import neo4j, { Driver, Integer, Node, Relationship } from "neo4j-driver";
import { GraphNode, GraphEdge, EntityType, graphNodes as fallbackNodes, graphEdges as fallbackEdges } from "./graphData";

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

let driverInstance: Driver | null = null;

export function getNeo4jDriver(): Driver | null {
  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) return null;

  if (!driverInstance) {
    try {
      driverInstance = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
        { disableLosslessIntegers: true }
      );
    } catch {
      driverInstance = null;
    }
  }
  return driverInstance;
}

export async function checkNeo4jConnection(): Promise<boolean> {
  const driver = getNeo4jDriver();
  if (!driver) return false;
  try {
    await driver.verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

// Convert Neo4j values to standard JS types (handles Neo4j Integers if any)
function toNative(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "object" && val !== null && "low" in val && "high" in val) {
    return (val as Integer).toNumber();
  }
  if (Array.isArray(val)) return val.map(toNative);
  if (typeof val === "object" && val !== null) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = toNative(v);
    }
    return res;
  }
  return val;
}

function parseNeo4jNode(node: Node): GraphNode {
  const props = (toNative(node.properties) as Record<string, unknown>) || {};
  const labels = node.labels || [];

  const rawType =
    (props.entity_type as string) ||
    (props.type as string) ||
    labels.find((l) => l !== "Entity")?.toLowerCase() ||
    labels[0]?.toLowerCase() ||
    "person";

  const lowerType = rawType.toLowerCase();
  let type: EntityType = "person";
  if (lowerType.includes("phone")) type = "phone";
  else if (lowerType.includes("bank") || lowerType.includes("account")) type = "account";
  else if (lowerType.includes("org")) type = "organization";
  else if (lowerType.includes("loc")) type = "location";
  else if (lowerType.includes("veh")) type = "vehicle";
  else if (lowerType.includes("case")) type = "case";
  else if (lowerType.includes("evid")) type = "evidence";
  else if (lowerType.includes("email")) type = "account";

  const id = String(props.entity_id || props.id || node.elementId || node.identity);
  const label = String(props.name || props.label || id);
  const isHighRisk =
    props.risk === "high" ||
    (typeof props.pagerank === "number" && props.pagerank > 0.01) ||
    (typeof props.degree_centrality === "number" && props.degree_centrality > 0.03);

  return {
    id,
    label,
    type,
    risk: isHighRisk ? "high" : "low",
    details: {
      subtitle: props.entity_type
        ? `${props.entity_type} · Comm ${props.community_id ?? "N/A"}`
        : labels.join(", "),
      idLabel: id,
      connections:
        typeof props.connections === "number"
          ? props.connections
          : typeof props.degree_centrality === "number"
          ? Math.round(props.degree_centrality * 100)
          : undefined,
      riskScore:
        typeof props.riskScore === "number"
          ? props.riskScore
          : typeof props.pagerank === "number"
          ? Math.round(props.pagerank * 1000)
          : undefined,
      extra: [
        { label: "Community", value: String(props.community_id ?? "-") },
        { label: "Degree Centrality", value: String(props.degree_centrality ?? "-") },
        { label: "PageRank", value: String(props.pagerank ?? "-") },
      ],
    },
  };
}

export async function queryGraphFromNeo4j(cypherQuery?: string, params?: Record<string, unknown>): Promise<{
  connected: boolean;
  cypher: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}>;
export async function queryGraphFromNeo4j(
  cypherQuery?: string,
  params?: Record<string, unknown>
): Promise<{
  connected: boolean;
  cypher: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}> {
  const defaultCypher = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 150";
  const queryToRun = cypherQuery && cypherQuery.trim() ? cypherQuery : defaultCypher;

  const connected = await checkNeo4jConnection();
  if (!connected) {
    return {
      connected: false,
      cypher: queryToRun,
      nodes: [],
      edges: [],
      error: "Neo4j database not connected. Check NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.",
    };
  }

  const driver = getNeo4jDriver();
  if (!driver) {
    return {
      connected: false,
      cypher: queryToRun,
      nodes: [],
      edges: [],
      error: "Failed to initialize Neo4j driver.",
    };
  }

  const session = driver.session();
  try {
    const result = await session.run(queryToRun, params || {});
    const nodeMap = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>();
    const elementIdToEntityId = new Map<string, string>();

    // Pass 1: Parse and index all Nodes first
    for (const record of result.records) {
      for (const key of record.keys) {
        const item = record.get(key);
        if (!item) continue;

        if (typeof item === "object" && "labels" in item && "properties" in item) {
          const parsedNode = parseNeo4jNode(item as Node);
          nodeMap.set(parsedNode.id, parsedNode);

          const rawNode = item as Node;
          if (rawNode.elementId) {
            elementIdToEntityId.set(String(rawNode.elementId), parsedNode.id);
          }
          if (rawNode.identity) {
            elementIdToEntityId.set(String(rawNode.identity), parsedNode.id);
          }
        }
      }
    }

    // Pass 2: Parse all Relationships using the fully indexed elementIdToEntityId map
    for (const record of result.records) {
      for (const key of record.keys) {
        const item = record.get(key);
        if (!item) continue;

        if (typeof item === "object" && "type" in item && "start" in item && "end" in item) {
          const rel = item as Relationship;
          const startElId = String(rel.startNodeElementId || rel.start);
          const endElId = String(rel.endNodeElementId || rel.end);

          const startId = elementIdToEntityId.get(startElId) || startElId;
          const endId = elementIdToEntityId.get(endElId) || endElId;

          const parsedEdge: GraphEdge = {
            id: String(rel.properties?.id || rel.elementId || rel.identity),
            from: startId,
            to: endId,
            label: String(rel.properties?.label || rel.type.toLowerCase().replace(/_/g, " ")),
            kind: (rel.properties?.kind as GraphEdge["kind"]) || "direct",
          };
          edgeMap.set(parsedEdge.id, parsedEdge);
        }
      }
    }

    return {
      connected: true,
      cypher: queryToRun,
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      connected: true,
      cypher: queryToRun,
      nodes: [],
      edges: [],
      error: `Cypher Execution Error: ${errorMsg}`,
    };
  } finally {
    await session.close();
  }
}

export async function seedNeo4jData(): Promise<{ success: boolean; message: string; nodesCreated: number; edgesCreated: number }> {
  const connected = await checkNeo4jConnection();
  if (!connected) {
    return { success: false, message: "Cannot seed: Neo4j database is not connected.", nodesCreated: 0, edgesCreated: 0 };
  }
  const { generateAiKnowledgeGraph, deployAiGraphToNeo4j } = await import("@/lib/aiGraphGenerator");
  const aiGraph = await generateAiKnowledgeGraph();
  return deployAiGraphToNeo4j(aiGraph);
}
