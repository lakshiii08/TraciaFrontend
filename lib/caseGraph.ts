import { getPersistentCases } from "@/lib/storage/persistence";

export function normalizeCaseLookup(caseId: string) {
  const needle = caseId.trim().toLowerCase();
  return {
    needle,
    compact: needle.replace(/[^a-z0-9]/g, ""),
    lookups: [{ needle, compact: needle.replace(/[^a-z0-9]/g, "") }],
  };
}

function lookupFor(value: string) {
  const needle = value.trim().toLowerCase();
  return { needle, compact: needle.replace(/[^a-z0-9]/g, "") };
}

function extractGraphCaseIds(text: string) {
  const ids = new Set<string>();
  for (const match of text.matchAll(/case\s*#?\s*([a-z0-9_-]+)/gi)) {
    ids.add(`case_${match[1].toLowerCase()}`);
  }
  for (const match of text.matchAll(/\b(tr-?\d+|case-?\d+)/gi)) {
    ids.add(match[0].toLowerCase());
  }
  return Array.from(ids);
}

function extractEntityTerms(text: string) {
  const terms = new Set<string>();
  const patterns = [
    /\bmadhav\b/gi,
    /\bmrinal\b/gi,
    /\braj\b/gi,
    /\bpriya\b/gi,
    /\bpooja\b/gi,
    /\blalita\b/gi,
    /\bvanguard\b/gi,
    /\balibaug\b/gi,
    /\bbandra\b/gi,
    /\bmumbai\b/gi,
    /\bpune\b/gi,
    /\bdelhi\b/gi,
    /\bgoa\b/gi,
    /\+\d[\d\s-]{6,}\d/g,
    /\b[A-Z]{2}\d{2}[A-Z]{2}\d{4}\b/g,
    /\b(hdfc|icici)[a-z0-9-]*\b/gi,
    /\bndps\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      terms.add(match[0].trim().toLowerCase());
    }
  }

  return Array.from(terms);
}

export async function resolveCaseGraphParams(caseId: string) {
  const effectiveId = caseId.toUpperCase() === "TR-102" ? "TR-302" : caseId;
  const lookups = [lookupFor(effectiveId)];
  if (effectiveId !== caseId) {
    lookups.push(lookupFor(caseId));
  }

  const cases = await getPersistentCases();
  const selected = cases.find(
    (item) => item.id.toLowerCase() === effectiveId.toLowerCase() || item.id.toLowerCase() === caseId.toLowerCase()
  );
  const aliasText = selected ? `${selected.id} ${selected.name} ${selected.desc}` : effectiveId;
  const terms = extractEntityTerms(aliasText);

  for (const alias of extractGraphCaseIds(aliasText)) {
    const lookup = lookupFor(alias);
    if (!lookups.some((existing) => existing.compact === lookup.compact)) {
      lookups.push(lookup);
    }
  }

  return {
    needle: lookups[0].needle,
    compact: lookups[0].compact,
    lookups,
    terms,
  };
}

export function buildCaseGraphCypher() {
  return `
    WITH coalesce($lookups, [{needle: $needle, compact: $compact}]) AS lookups,
         coalesce($terms, []) AS terms
    MATCH (caseNode)
    WHERE any(lookup IN lookups WHERE
      toLower(coalesce(caseNode.id, caseNode.entity_id, "")) = lookup.needle OR
      toLower(coalesce(caseNode.name, caseNode.label, "")) = lookup.needle OR
      replace(toLower(coalesce(caseNode.name, caseNode.label, "")), "#", "") CONTAINS lookup.compact OR
      replace(toLower(coalesce(caseNode.id, caseNode.entity_id, "")), "-", "") CONTAINS lookup.compact
    ) OR any(term IN terms WHERE
      toLower(coalesce(caseNode.name, caseNode.label, caseNode.id, caseNode.entity_id, "")) CONTAINS term
    )
    OPTIONAL MATCH (caseNode)-[*1..2]-(neighbor)
    WITH collect(DISTINCT caseNode) + collect(DISTINCT neighbor) AS scopedNodes
    UNWIND scopedNodes AS n
    WITH DISTINCT n, scopedNodes
    OPTIONAL MATCH (n)-[r]-(m)
    WHERE m IN scopedNodes
    RETURN n, r, m
    LIMIT 250
  `;
}

export function buildCaseSummaryCypher() {
  return `
    WITH coalesce($lookups, [{needle: $needle, compact: $compact}]) AS lookups,
         coalesce($terms, []) AS terms
    MATCH (caseNode)
    WHERE any(lookup IN lookups WHERE
      toLower(coalesce(caseNode.id, caseNode.entity_id, "")) = lookup.needle OR
      toLower(coalesce(caseNode.name, caseNode.label, "")) = lookup.needle OR
      replace(toLower(coalesce(caseNode.name, caseNode.label, "")), "#", "") CONTAINS lookup.compact OR
      replace(toLower(coalesce(caseNode.id, caseNode.entity_id, "")), "-", "") CONTAINS lookup.compact
    ) OR any(term IN terms WHERE
      toLower(coalesce(caseNode.name, caseNode.label, caseNode.id, caseNode.entity_id, "")) CONTAINS term
    )
    OPTIONAL MATCH (caseNode)-[*1..2]-(neighbor)
    WITH caseNode, collect(DISTINCT neighbor) AS neighbors
    UNWIND neighbors AS n
    OPTIONAL MATCH (n)-[r]-(m)
    WHERE m IN neighbors OR m = caseNode
    RETURN
      coalesce(caseNode.id, caseNode.entity_id, elementId(caseNode)) AS caseId,
      coalesce(caseNode.name, caseNode.label, caseNode.id, caseNode.entity_id, "Case") AS caseName,
      collect(DISTINCT {
        id: coalesce(n.id, n.entity_id, elementId(n)),
        name: coalesce(n.name, n.label, n.id, n.entity_id, "Entity"),
        type: coalesce(n.type, n.entity_type, head(labels(n)), "Entity"),
        risk: coalesce(n.risk, ""),
        riskScore: coalesce(n.riskScore, 0)
      }) AS entities,
      collect(DISTINCT {
        from: coalesce(n.name, n.label, n.id, n.entity_id, "Entity"),
        rel: type(r),
        to: coalesce(m.name, m.label, m.id, m.entity_id, "Entity")
      }) AS paths
    LIMIT 1
  `;
}
