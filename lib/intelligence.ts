import { graphEdges, graphNodes, type GraphNode } from "@/lib/graphData";
import type { CaseItem, EntityMatch } from "@/lib/store";

type Answer = { text: string; evidence: string[]; match?: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9_+.-]+/g, " ").trim();
const score = (query: string, value: string) => normalize(query).split(/\s+/).filter(Boolean).reduce((n, token) => n + (normalize(value).includes(token) ? 1 : 0), 0);

export function answerInvestigationQuery(query: string, cases: CaseItem[], resolved: EntityMatch[]): Answer {
  const q = normalize(query);
  const nodes = [...graphNodes];
  const edges = [...graphEdges];
  const mentioned = nodes.filter((n) => score(q, `${n.label} ${n.details.idLabel ?? ""}`) > 0);

  if (q.includes("high risk") || q.includes("risk")) {
    const risky = nodes.filter((n) => n.risk === "high" || (n.details.riskScore ?? 0) >= 70);
    return {
      text: `I found ${risky.length} high-risk entities in the current intelligence graph: ${risky.map((n) => `${n.label}${n.details.idLabel ? ` (${n.details.idLabel})` : ""}`).join(", ") || "none"}. ${edges.filter((e) => risky.some((n) => n.id === e.from || n.id === e.to)).length} relationships touch those entities.`,
      evidence: ["Current graph index", "Risk scoring metadata"],
      match: risky.length ? "LIVE DATA" : "NO MATCH",
    };
  }

  if (q.includes("summarize") || q.includes("strongest findings") || q.includes("summary")) {
    const top = [...edges].slice(0, 5).map((e) => {
      const from = nodes.find((n) => n.id === e.from)?.label ?? e.from;
      const to = nodes.find((n) => n.id === e.to)?.label ?? e.to;
      return `${from} → ${to} (${e.label})`;
    });
    return {
      text: `Current investigation summary: ${nodes.length} graph entities, ${edges.length} relationships, ${cases.length} cases in the active workspace, and ${resolved.length} entity merges confirmed this session. Strongest indexed relationships include ${top.join("; ")}.`,
      evidence: ["Relationship graph", "Case registry", "Entity resolution ledger"],
      match: "LIVE DATA",
    };
  }

  if (q.includes("verified links") || q.includes("connections") || q.includes("links")) {
    const targets = mentioned.length ? mentioned : nodes.filter((n) => q.includes(n.details.idLabel?.toLowerCase() ?? "never-match"));
    const ids = new Set(targets.map((n) => n.id));
    const links = edges.filter((e) => ids.has(e.from) || ids.has(e.to)).slice(0, 12).map((e) => {
      const from = nodes.find((n) => n.id === e.from)?.label ?? e.from;
      const to = nodes.find((n) => n.id === e.to)?.label ?? e.to;
      return `${from} → ${to} (${e.label})`;
    });
    return {
      text: targets.length ? `${targets.map((n) => n.label).join(", ")} has ${links.length} indexed relationship(s): ${links.join("; ") || "no direct links found"}.` : `I could not identify an entity in the current graph from “${query}”. Try an entity name or ID such as PER_10023.`,
      evidence: ["Relationship graph index"],
      match: targets.length ? "LIVE DATA" : "NO MATCH",
    };
  }

  if (q.includes("evidence") || q.includes("supports")) {
    const related = mentioned.length ? mentioned.map((n) => n.label).join(", ") : "the active investigation";
    return {
      text: `The current evidence index associates ${related} with the relationship graph. The strongest available source references are FIR_101.pdf, CDR records, financial records, and surveillance data. For cryptographic validation, use the Evidence Integrity module before treating a file as verified.`,
      evidence: ["FIR_101.pdf", "CDR records", "Financial records", "Surveillance records"],
      match: "INDEXED CONTEXT",
    };
  }

  const matches = [...nodes, ...cases.map((c) => ({ label: c.name, details: { idLabel: c.id } } as GraphNode)), ...resolved.map((m) => ({ label: m.nameA, details: { idLabel: m.id } } as GraphNode))]
    .filter((item) => score(q, `${item.label} ${item.details.idLabel ?? ""}`) > 0)
    .slice(0, 6);

  if (matches.length) {
    return {
      text: `I found ${matches.length} matching intelligence record(s): ${matches.map((m) => `${m.label}${m.details.idLabel ? ` (${m.details.idLabel})` : ""}`).join(", ")}. Ask for links, risk, evidence, or a summary to inspect this context.`,
      evidence: ["Live case and graph index"],
      match: "LIVE DATA",
    };
  }

  return {
    text: `I could not find a direct match for “${query}” in the current case and relationship index. Try an entity ID, case ID, evidence filename, or a question such as “show verified links for PER_10023”.`,
    evidence: ["Live intelligence index"],
    match: "NO MATCH",
  };
}
