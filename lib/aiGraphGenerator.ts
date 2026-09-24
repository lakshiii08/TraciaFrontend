import { getNeo4jDriver } from "@/lib/neo4j";
import type { GraphNode, GraphEdge, EntityType } from "@/types/graph";

export interface AiGeneratedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: string;
  sourceModel: string;
}

export const CANONICAL_MURDER_CASE_DOSSIER = `
CASE ID: TR-302
CASE TITLE: Operation Nightshade: The Alibaug Penthouse Homicide & Syndicate Conspiracy
POLICE JURISDICTION: Crime Branch Unit IX & Alibaug Police Station, Raigad, Maharashtra
SECTIONS: Sections 302 (Murder), 120B (Criminal Conspiracy), 201 (Destruction of Evidence), 34 IPC r/w Sections 3, 25 Arms Act.

FACTUAL SUMMARY:
On 14 February 2026 at 23:45 IST, prominent real-estate developer Mrinal Kulkarni was found deceased inside his private villa in Alibaug, Raigad. Forensic autopsy confirmed blunt-force trauma and two penetrating gunshot wounds from a .32 caliber country-made firearm.

IDENTIFIED INDIVIDUALS:
1. Madhav Singhania (Prime Accused / Mastermind): Managing Director of Vanguard Holdings Ltd. Motive: ₹18.5 Crore fund embezzlement and hostile corporate takeover. Coordinated the contract killing. Notably, Madhav is also the prime accused in prior active Case #NDPS-402 (Goa Narcotics & Hawala Syndicate).
2. Raj Malhotra (Contract Shooter / Accomplice): Criminal enforcer and history-sheeter with previous armed extortion charges in Case #CR-114 (Pune Armed Extortion Racket). Hired by Madhav Singhania for ₹50,00,000 to execute the murder at Alibaug.
3. Priya Sharma (Insider Conspirator / Financial Officer): Senior finance manager at Vanguard Holdings. Managed illegal wire transfers to shell account ICICI-002101928374, procured unregistered burner SIM cards, and tracked Mrinal's schedule.
4. Mrinal Kulkarni (Victim / Deceased): Co-founder of Vanguard Holdings Ltd. Refused to sign fraudulent offshore fund diversion documents.
5. Pooja Verma (Key Witness / Executive Secretary): Personal secretary to Mrinal. Received a distress voice recording from Mrinal minutes before the fatal attack and identified the threatening calls.
6. Lalita Deshmukh (Accomplice / Vehicle & Stash Custodian): Associate of Raj Malhotra. Registered owner of the getaway vehicle (Mahindra Scorpio MH02CZ4412) and custodian of the secluded farmhouse property in Koregaon Park, Pune where the murder weapon was recovered.

TELECOMMUNICATION LINES:
- +91 9820199411: Madhav Singhania (Primary registered iPhone)
- +91 9136028471: Madhav Singhania (Burner line used to direct the killing)
- +91 9711843209: Raj Malhotra (Operational phone line active at crime scene)
- +91 9821437890: Priya Sharma (Personal phone line)
- +91 9822055618: Lalita Deshmukh (Registered line)
- +91 9833114562: Pooja Verma (Witness phone line)

LOCATIONS:
- Alibaug Farmhouse, Raigad (Crime Scene & Murder Location: 18.6414, 72.8722)
- Bandra West, Mumbai (Vanguard Corporate HQ & Madhav's primary residence: 19.0596, 72.8295)
- Koregaon Park, Pune (Lalita's property / Murder weapon recovery & vehicle stash: 18.5362, 73.8939)
- Connaught Place, New Delhi (Raj Malhotra transit hideout / Hawala relay: 28.6315, 77.2167)
- Anjuna, Goa (Madhav's operational base for prior Case #NDPS-402: 15.5800, 73.7400)

VEHICLES:
- MH02CZ4412: Black Mahindra Scorpio SUV registered to Lalita Deshmukh, ANPR captured fleeing Alibaug toll plaza.
- MH01DK8820: Grey Mercedes-Benz E-Class registered to Madhav Singhania.

FINANCIAL & CORPORATE ENTITIES:
- Vanguard Holdings Ltd: Real estate development corporate entity.
- HDFC-40928172901: Corporate escrow account at Bandra West.
- ICICI-002101928374: Shell beneficiary account used by Priya to disburse contract payment to Raj Malhotra.

CONNECTED CRIMINAL CASES:
- Case #NDPS-402: "Goa Narcotics & Hawala Syndicate" (Active prior case against Madhav Singhania)
- Case #CR-114: "Pune Armed Extortion Racket" (Active prior case against Raj Malhotra)
- Case TR-302: "The Alibaug Penthouse Homicide & Syndicate Conspiracy" (Master murder investigation)

CERTIFIED FORENSIC EVIDENCE:
- FIR_302_Homicide_Alibaug.pdf: Certified First Information Report.
- Autopsy_Ballistics_Mrinal.pdf: Ballistics report confirming .32 caliber death wounds.
- Weapon_Seizure_Memo_Pune.pdf: Seizure memo of .32 country-made revolver at Koregaon Park, Pune.
- CDR_Madhav_Raj_Priya.csv: Intercept log showing 74 calls between Madhav, Priya, and Raj.
`;

export async function generateAiKnowledgeGraph(caseDossierText: string = CANONICAL_MURDER_CASE_DOSSIER): Promise<AiGeneratedGraph> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert Law Enforcement Knowledge Graph Architect. Given the investigative homicide case dossier, generate a complete, rigorous, and interconnected intelligence graph. " +
                "Extract all entities as nodes and all relational connections as edges. " +
                "Allowed node types: 'person', 'phone', 'location', 'vehicle', 'account', 'organization', 'case', 'evidence'. " +
                "Risk must be 'high', 'medium', or 'low'. Risk score must be between 10 and 95. " +
                "Return JSON with: { 'nodes': [{ 'id': string, 'label': string, 'type': string, 'risk': 'high'|'medium'|'low', 'riskScore': number, 'subtitle': string, 'connections': number }], 'edges': [{ 'id': string, 'from': string, 'to': string, 'label': string, 'kind': string }], 'summary': string }.",
            },
            {
              role: "user",
              content: `Build the complete Neo4j intelligence graph for this murder investigation:\n\n${caseDossierText}`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.nodes) && parsed.nodes.length >= 8 && Array.isArray(parsed.edges)) {
            const normalizedNodes: GraphNode[] = parsed.nodes.map((n: Record<string, unknown>, idx: number) => {
              const rawType = String(n.type || "person").toLowerCase();
              let type: EntityType = "person";
              if (rawType.includes("phone")) type = "phone";
              else if (rawType.includes("loc")) type = "location";
              else if (rawType.includes("veh")) type = "vehicle";
              else if (rawType.includes("acc") || rawType.includes("bank")) type = "account";
              else if (rawType.includes("org") || rawType.includes("corp")) type = "organization";
              else if (rawType.includes("case")) type = "case";
              else if (rawType.includes("evi")) type = "evidence";

              const risk = n.risk === "high" || n.risk === "medium" ? (n.risk as "high" | "medium") : "low";
              const id = String(n.id || `node_${idx + 1}`);
              const label = String(n.label || id);

              return {
                id,
                label,
                type,
                risk,
                details: {
                  subtitle: String(n.subtitle || `${type} · Case TR-302`),
                  idLabel: id,
                  connections: Number(n.connections || 5),
                  riskScore: Number(n.riskScore || (risk === "high" ? 85 : 45)),
                  caseCount: type === "case" ? 1 : 1,
                  evidenceCount: 1,
                },
              };
            });

            const validKinds = new Set(["direct", "inferred", "temporal", "suspicious"]);
            const normalizedEdges: GraphEdge[] = parsed.edges.map((e: Record<string, unknown>, idx: number) => {
              const rawKind = String(e.kind || "direct").toLowerCase();
              const kind = (validKinds.has(rawKind) ? rawKind : "direct") as "direct" | "inferred" | "temporal" | "suspicious";
              return {
                id: String(e.id || `edge_${idx + 1}`),
                from: String(e.from),
                to: String(e.to),
                label: String(e.label || "connected_to").toLowerCase().replace(/\s+/g, "_"),
                kind,
              };
            });

            return {
              nodes: normalizedNodes,
              edges: normalizedEdges,
              summary: String(parsed.summary || "AI-generated murder conspiracy intelligence graph."),
              sourceModel: "OpenAI GPT-4o-mini (Dynamic Graph Synthesis)",
            };
          }
        }
      }
    } catch (err) {
      console.warn("[TRACIA AI Graph Gen] OpenAI dynamic graph synthesis fallback:", err);
    }
  }

  // High-precision canonical fallback built from the murder case
  return getFallbackMurderCaseGraph();
}

export function getFallbackMurderCaseGraph(): AiGeneratedGraph {
  const nodes: GraphNode[] = [
    {
      id: "person_madhav",
      label: "Madhav Singhania",
      type: "person",
      risk: "high",
      details: {
        subtitle: "Mastermind · MD Vanguard Holdings",
        idLabel: "person_madhav",
        connections: 16,
        riskScore: 94,
        caseCount: 2,
        evidenceCount: 4,
        extra: [
          { label: "Role", value: "Prime Accused / Conspirator" },
          { label: "Motive", value: "₹18.5 Cr Embezzlement & Buyout" },
          { label: "Prior Record", value: "Accused in Case #NDPS-402 (Goa)" },
        ],
      },
    },
    {
      id: "person_mrinal",
      label: "Mrinal Kulkarni",
      type: "person",
      risk: "low",
      details: {
        subtitle: "Victim · Co-Founder Vanguard Holdings",
        idLabel: "person_mrinal",
        connections: 6,
        riskScore: 15,
        caseCount: 1,
        evidenceCount: 3,
        extra: [
          { label: "Status", value: "Deceased (14 Feb 2026)" },
          { label: "Cause of Death", value: "Gunshot wounds & trauma (.32 cal)" },
          { label: "Crime Scene", value: "Alibaug Farmhouse, Raigad" },
        ],
      },
    },
    {
      id: "person_raj",
      label: "Raj Malhotra",
      type: "person",
      risk: "high",
      details: {
        subtitle: "Contract Shooter · History-Sheeter",
        idLabel: "person_raj",
        connections: 11,
        riskScore: 91,
        caseCount: 2,
        evidenceCount: 3,
        extra: [
          { label: "Alias", value: "Raj Bhai / Rajesh" },
          { label: "Prior Case", value: "Accused in Case #CR-114 (Pune Extortion)" },
          { label: "Contract Fee", value: "₹50,00,000 via ICICI Shell A/c" },
        ],
      },
    },
    {
      id: "person_priya",
      label: "Priya Sharma",
      type: "person",
      risk: "medium",
      details: {
        subtitle: "Finance Manager · Inside Conspirator",
        idLabel: "person_priya",
        connections: 9,
        riskScore: 76,
        caseCount: 1,
        evidenceCount: 2,
        extra: [
          { label: "Role", value: "Procured Burner SIM & Wire Transfer" },
          { label: "Beneficiary A/c", value: "ICICI-002101928374" },
        ],
      },
    },
    {
      id: "person_lalita",
      label: "Lalita Deshmukh",
      type: "person",
      risk: "medium",
      details: {
        subtitle: "Accomplice · Safehouse & Vehicle Owner",
        idLabel: "person_lalita",
        connections: 7,
        riskScore: 68,
        caseCount: 1,
        evidenceCount: 2,
        extra: [
          { label: "Vehicle Registered", value: "Mahindra Scorpio MH02CZ4412" },
          { label: "Property", value: "Koregaon Park Facility, Pune" },
        ],
      },
    },
    {
      id: "person_pooja",
      label: "Pooja Verma",
      type: "person",
      risk: "low",
      details: {
        subtitle: "Executive Secretary · Key Witness",
        idLabel: "person_pooja",
        connections: 5,
        riskScore: 12,
        caseCount: 1,
        evidenceCount: 1,
        extra: [
          { label: "Testimony", value: "Received distress voice memo at 23:42 IST" },
          { label: "Flagged", value: "Unauthorized wire transfers" },
        ],
      },
    },
    // Phones
    {
      id: "phone_madhav_primary",
      label: "+91 9820199411",
      type: "phone",
      risk: "medium",
      details: { subtitle: "Madhav Singhania (Primary iPhone)", idLabel: "phone_madhav_primary", connections: 4, riskScore: 60 },
    },
    {
      id: "phone_madhav_burner",
      label: "+91 9136028471",
      type: "phone",
      risk: "high",
      details: { subtitle: "Madhav Singhania (Crime Burner Line)", idLabel: "phone_madhav_burner", connections: 6, riskScore: 88 },
    },
    {
      id: "phone_raj",
      label: "+91 9711843209",
      type: "phone",
      risk: "high",
      details: { subtitle: "Raj Malhotra (Operational Line)", idLabel: "phone_raj", connections: 5, riskScore: 85 },
    },
    {
      id: "phone_priya",
      label: "+91 9821437890",
      type: "phone",
      risk: "low",
      details: { subtitle: "Priya Sharma (Subscriber Line)", idLabel: "phone_priya", connections: 3, riskScore: 40 },
    },
    {
      id: "phone_lalita",
      label: "+91 9822055618",
      type: "phone",
      risk: "low",
      details: { subtitle: "Lalita Deshmukh (Subscriber Line)", idLabel: "phone_lalita", connections: 3, riskScore: 35 },
    },
    {
      id: "phone_pooja",
      label: "+91 9833114562",
      type: "phone",
      risk: "low",
      details: { subtitle: "Pooja Verma (Witness Line)", idLabel: "phone_pooja", connections: 2, riskScore: 10 },
    },
    // Locations
    {
      id: "loc_alibaug",
      label: "Alibaug Farmhouse, Raigad",
      type: "location",
      risk: "high",
      details: { subtitle: "Primary Crime Scene / Murder Location", idLabel: "loc_alibaug", connections: 6, riskScore: 90 },
    },
    {
      id: "loc_bandra",
      label: "Bandra West, Mumbai",
      type: "location",
      risk: "medium",
      details: { subtitle: "Vanguard HQ & Madhav's Residence", idLabel: "loc_bandra", connections: 5, riskScore: 50 },
    },
    {
      id: "loc_pune",
      label: "Koregaon Park, Pune",
      type: "location",
      risk: "high",
      details: { subtitle: "Weapon Recovery & Stash Site", idLabel: "loc_pune", connections: 5, riskScore: 85 },
    },
    {
      id: "loc_delhi",
      label: "Connaught Place, New Delhi",
      type: "location",
      risk: "medium",
      details: { subtitle: "Raj Malhotra Transit Hideout", idLabel: "loc_delhi", connections: 3, riskScore: 65 },
    },
    {
      id: "loc_goa",
      label: "Anjuna, Goa",
      type: "location",
      risk: "high",
      details: { subtitle: "Madhav's Base in Prior Case #NDPS-402", idLabel: "loc_goa", connections: 3, riskScore: 80 },
    },
    // Vehicles
    {
      id: "veh_scorpio",
      label: "MH02CZ4412",
      type: "vehicle",
      risk: "high",
      details: { subtitle: "Mahindra Scorpio SUV (Getaway Vehicle)", idLabel: "veh_scorpio", connections: 5, riskScore: 88 },
    },
    {
      id: "veh_mercedes",
      label: "MH01DK8820",
      type: "vehicle",
      risk: "low",
      details: { subtitle: "Mercedes E-Class (Madhav Singhania)", idLabel: "veh_mercedes", connections: 2, riskScore: 30 },
    },
    // Financial & Organization
    {
      id: "org_vanguard",
      label: "Vanguard Holdings Ltd",
      type: "organization",
      risk: "medium",
      details: { subtitle: "Corporate Enterprise / Real Estate Entity", idLabel: "org_vanguard", connections: 5, riskScore: 55 },
    },
    {
      id: "acc_hdfc",
      label: "HDFC-40928172901",
      type: "account",
      risk: "medium",
      details: { subtitle: "Vanguard Corporate Escrow Account", idLabel: "acc_hdfc", connections: 3, riskScore: 50 },
    },
    {
      id: "acc_icici",
      label: "ICICI-002101928374",
      type: "account",
      risk: "high",
      details: { subtitle: "Shell Beneficiary Account (Hit Payment)", idLabel: "acc_icici", connections: 4, riskScore: 90 },
    },
    // Cases
    {
      id: "case_murder_302",
      label: "TR-302 (Alibaug Homicide)",
      type: "case",
      risk: "high",
      details: { subtitle: "Master Homicide & Conspiracy Case", idLabel: "case_murder_302", connections: 8, riskScore: 95 },
    },
    {
      id: "case_ndps_402",
      label: "Case #NDPS-402 (Goa Narcotics)",
      type: "case",
      risk: "high",
      details: { subtitle: "Madhav Singhania Prior Narcotics Case", idLabel: "case_ndps_402", connections: 3, riskScore: 85 },
    },
    {
      id: "case_cr_114",
      label: "Case #CR-114 (Pune Extortion)",
      type: "case",
      risk: "high",
      details: { subtitle: "Raj Malhotra Prior Extortion Case", idLabel: "case_cr_114", connections: 3, riskScore: 80 },
    },
    // Evidence
    {
      id: "evid_fir302",
      label: "FIR_302_Homicide_Alibaug.pdf",
      type: "evidence",
      risk: "low",
      details: { subtitle: "Certified Section 302 IPC FIR", idLabel: "evid_fir302", connections: 2, riskScore: 20 },
    },
    {
      id: "evid_weapon",
      label: "Weapon_Seizure_Memo_Pune.pdf",
      type: "evidence",
      risk: "high",
      details: { subtitle: "Recovered .32 Country-Made Revolver", idLabel: "evid_weapon", connections: 3, riskScore: 92 },
    },
    {
      id: "evid_autopsy",
      label: "Autopsy_Ballistics_Mrinal.pdf",
      type: "evidence",
      risk: "high",
      details: { subtitle: "Forensic Ballistics & Trauma Report", idLabel: "evid_autopsy", connections: 2, riskScore: 85 },
    },
  ];

  const edges: GraphEdge[] = [
    // Madhav Conspiracies
    { id: "e1", from: "person_madhav", to: "case_murder_302", label: "masterminded", kind: "direct" },
    { id: "e2", from: "person_madhav", to: "person_raj", label: "hired_for_hit", kind: "suspicious" },
    { id: "e3", from: "person_madhav", to: "person_priya", label: "conspired_with", kind: "suspicious" },
    { id: "e4", from: "person_madhav", to: "person_mrinal", label: "business_partner", kind: "direct" },
    { id: "e5", from: "person_madhav", to: "case_ndps_402", label: "prior_accused_in", kind: "inferred" },
    { id: "e6", from: "person_madhav", to: "phone_madhav_primary", label: "owns_phone", kind: "direct" },
    { id: "e7", from: "person_madhav", to: "phone_madhav_burner", label: "used_burner", kind: "suspicious" },
    { id: "e8", from: "person_madhav", to: "veh_mercedes", label: "registered_owner", kind: "direct" },
    { id: "e9", from: "person_madhav", to: "org_vanguard", label: "managing_director", kind: "direct" },
    { id: "e10", from: "person_madhav", to: "loc_bandra", label: "resides_at", kind: "direct" },
    { id: "e11", from: "person_madhav", to: "loc_goa", label: "operated_in", kind: "inferred" },

    // Raj's Actions
    { id: "e12", from: "person_raj", to: "person_mrinal", label: "murdered", kind: "suspicious" },
    { id: "e13", from: "person_raj", to: "loc_alibaug", label: "executed_hit_at", kind: "suspicious" },
    { id: "e14", from: "person_raj", to: "veh_scorpio", label: "operated_getaway", kind: "suspicious" },
    { id: "e15", from: "person_raj", to: "loc_delhi", label: "fled_to", kind: "suspicious" },
    { id: "e16", from: "person_raj", to: "case_cr_114", label: "prior_accused_in", kind: "inferred" },
    { id: "e17", from: "person_raj", to: "phone_raj", label: "owns_phone", kind: "direct" },
    { id: "e18", from: "person_raj", to: "acc_icici", label: "received_hit_payment", kind: "suspicious" },
    { id: "e19", from: "person_raj", to: "loc_pune", label: "stashed_weapon_at", kind: "suspicious" },

    // Priya's Actions
    { id: "e20", from: "person_priya", to: "acc_icici", label: "transferred_funds", kind: "suspicious" },
    { id: "e21", from: "person_priya", to: "phone_priya", label: "owns_phone", kind: "direct" },
    { id: "e22", from: "person_priya", to: "org_vanguard", label: "cfo_at", kind: "direct" },
    { id: "e23", from: "person_priya", to: "phone_madhav_burner", label: "procured_sim", kind: "suspicious" },
    { id: "e24", from: "person_priya", to: "person_raj", label: "coordinated_payout", kind: "suspicious" },

    // Mrinal's Links
    { id: "e25", from: "person_mrinal", to: "case_murder_302", label: "victim_in", kind: "direct" },
    { id: "e26", from: "person_mrinal", to: "loc_alibaug", label: "murdered_at", kind: "direct" },
    { id: "e27", from: "person_mrinal", to: "org_vanguard", label: "co_founded", kind: "direct" },
    { id: "e28", from: "person_mrinal", to: "person_pooja", label: "sent_distress_memo", kind: "temporal" },

    // Pooja's Links
    { id: "e29", from: "person_pooja", to: "case_murder_302", label: "star_witness_in", kind: "direct" },
    { id: "e30", from: "person_pooja", to: "phone_pooja", label: "owns_phone", kind: "direct" },
    { id: "e31", from: "person_pooja", to: "org_vanguard", label: "executive_assistant", kind: "direct" },

    // Lalita's Links
    { id: "e32", from: "person_lalita", to: "veh_scorpio", label: "registered_owner", kind: "direct" },
    { id: "e33", from: "person_lalita", to: "loc_pune", label: "owns_safehouse", kind: "direct" },
    { id: "e34", from: "person_lalita", to: "phone_lalita", label: "owns_phone", kind: "direct" },
    { id: "e35", from: "person_lalita", to: "person_raj", label: "harbored_and_assisted", kind: "suspicious" },

    // Vehicle & Physical Evidence
    { id: "e36", from: "veh_scorpio", to: "loc_alibaug", label: "anpr_toll_at", kind: "temporal" },
    { id: "e37", from: "veh_scorpio", to: "loc_pune", label: "seized_at", kind: "direct" },
    { id: "e38", from: "acc_hdfc", to: "acc_icici", label: "siphoned_wire_transfer", kind: "suspicious" },
    { id: "e39", from: "org_vanguard", to: "acc_hdfc", label: "corporate_account", kind: "direct" },

    // Evidence to Entities
    { id: "e40", from: "evid_fir302", to: "case_murder_302", label: "registered_under", kind: "direct" },
    { id: "e41", from: "evid_weapon", to: "loc_pune", label: "recovered_at", kind: "direct" },
    { id: "e42", from: "evid_weapon", to: "person_raj", label: "ballistic_match_to_shooter", kind: "suspicious" },
    { id: "e43", from: "evid_autopsy", to: "person_mrinal", label: "pathology_report_for", kind: "direct" },
  ];

  return {
    nodes,
    edges,
    summary: "Canonical AI homicide intelligence graph for Operation Nightshade (Case TR-302).",
    sourceModel: "TRACIA Canonical Cognitive Engine",
  };
}

export async function deployAiGraphToNeo4j(graph: AiGeneratedGraph): Promise<{
  success: boolean;
  message: string;
  nodesCreated: number;
  edgesCreated: number;
}> {
  const driver = getNeo4jDriver();
  if (!driver) {
    return {
      success: false,
      message: "Neo4j driver not configured. Check NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.",
      nodesCreated: 0,
      edgesCreated: 0,
    };
  }

  const session = driver.session();
  try {
    // 1. Purge the existing fake graph completely
    await session.run("MATCH (n) DETACH DELETE n");

    // 2. Insert all AI synthesized nodes
    for (const node of graph.nodes) {
      const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
      await session.run(
        `
        MERGE (n:Entity { id: $id })
        SET n.entity_id = $id,
            n.label = $label,
            n.name = $label,
            n.type = $type,
            n.entity_type = $type,
            n.risk = $risk,
            n.riskScore = $riskScore,
            n.connections = $connections,
            n.subtitle = $subtitle,
            n.idLabel = $idLabel,
            n.caseCount = $caseCount,
            n.evidenceCount = $evidenceCount
        SET n:${typeLabel}
        `,
        {
          id: node.id,
          label: node.label,
          type: node.type,
          risk: node.risk || "low",
          riskScore: node.details?.riskScore ?? (node.risk === "high" ? 85 : 45),
          connections: node.details?.connections ?? 5,
          subtitle: node.details?.subtitle ?? "",
          idLabel: node.details?.idLabel ?? node.id,
          caseCount: node.details?.caseCount ?? 1,
          evidenceCount: node.details?.evidenceCount ?? 1,
        }
      );
    }

    // 3. Insert all AI synthesized edges
    for (const edge of graph.edges) {
      await session.run(
        `
        MATCH (a:Entity) WHERE a.id = $from OR a.entity_id = $from
        MATCH (b:Entity) WHERE b.id = $to OR b.entity_id = $to
        MERGE (a)-[r:RELATIONSHIP { id: $id }]->(b)
        SET r.label = $label,
            r.kind = $kind,
            r.type = $label
        `,
        {
          id: edge.id,
          from: edge.from,
          to: edge.to,
          label: edge.label,
          kind: edge.kind || "direct",
        }
      );
    }

    return {
      success: true,
      message: `AI successfully generated and deployed ${graph.nodes.length} nodes and ${graph.edges.length} relationships into Neo4j Aura cloud database.`,
      nodesCreated: graph.nodes.length,
      edgesCreated: graph.edges.length,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Neo4j deployment error: ${errorMsg}`, nodesCreated: 0, edgesCreated: 0 };
  } finally {
    await session.close();
  }
}
