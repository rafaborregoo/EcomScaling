type PeerDefinition = { code?: unknown; name?: unknown } | null;
type PeerVersion = { agent_definitions?: PeerDefinition | PeerDefinition[] | null } | null;
type PeerRun = {
  store_id?: unknown;
  status?: unknown;
  agent_versions?: PeerVersion | PeerVersion[] | null;
} | null;

export type MarketingPeerHistoryRow = {
  created_at?: unknown;
  status?: unknown;
  output?: unknown;
  agent_runs?: PeerRun | PeerRun[] | null;
};

export type MarketingPeerSummary = {
  agent: string;
  code: string;
  generated_at: string;
  status: "approved" | "published";
  conclusion: string;
  findings: string[];
  warnings: string[];
  recommendations: string[];
};

const RELEVANT_MARKETING_PEERS = new Set([
  "a01_analista_llamadas",
  "a02_monitor_negocio",
  "a05_estrategia_campanas",
  "a12_analista_email",
  "a17_plan_semanal",
  "a18_plan_mensual",
  "a26_contenido_email",
  "a28_arquitecto_flujos",
]);

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function summarizeMarketingPeerHistory(
  rows: readonly MarketingPeerHistoryRow[],
  storeId: string | null,
  maxAgents = 7,
): MarketingPeerSummary[] {
  const summaries: MarketingPeerSummary[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status !== "approved" && row.status !== "published") continue;
    const run = first(row.agent_runs);
    if (!run || run.status !== "succeeded" || (run.store_id ?? null) !== storeId) continue;
    const version = first(run.agent_versions);
    const definition = first(version?.agent_definitions);
    const code = typeof definition?.code === "string" ? definition.code : null;
    if (!code || !RELEVANT_MARKETING_PEERS.has(code) || seen.has(code)) continue;
    const generatedAt = typeof row.created_at === "string" ? row.created_at : null;
    if (!generatedAt) continue;

    const output = typeof row.output === "object" && row.output !== null
      ? row.output as Record<string, unknown>
      : {};
    const findings = Array.isArray(output.findings)
      ? output.findings.slice(0, 4).flatMap((item) => {
          if (typeof item !== "object" || item === null) return [];
          const value = (item as Record<string, unknown>).title ?? (item as Record<string, unknown>).detail;
          return typeof value === "string" && value.trim() ? [value.trim().slice(0, 360)] : [];
        })
      : [];
    const warnings = Array.isArray(output.warnings)
      ? output.warnings.filter((item): item is string => typeof item === "string").slice(0, 3).map((value) => value.slice(0, 240))
      : [];
    const recommendations = [
      ...(Array.isArray(output.recommendations)
        ? output.recommendations.flatMap((item) => {
            if (typeof item !== "object" || item === null) return [];
            const value = (item as Record<string, unknown>).action ?? (item as Record<string, unknown>).description;
            return typeof value === "string" && value.trim() ? [value.trim().slice(0, 300)] : [];
          })
        : []),
      ...(Array.isArray(output.proposed_writes)
        ? output.proposed_writes.flatMap((item) => {
            if (typeof item !== "object" || item === null) return [];
            const proposal = item as Record<string, unknown>;
            if (proposal.kind !== "task") return [];
            const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
            const description = typeof proposal.description === "string" ? proposal.description.trim() : "";
            return title ? [`${title}${description ? `: ${description}` : ""}`.slice(0, 300)] : [];
          })
        : []),
    ].slice(0, 3);
    const conclusion = [output.answer, output.diagnosis, output.summary]
      .find((value): value is string => typeof value === "string")
      ?.slice(0, 700) ?? "";
    const agent = typeof definition?.name === "string" ? definition.name : code;

    summaries.push({
      agent,
      code,
      generated_at: generatedAt,
      status: row.status,
      conclusion,
      findings,
      warnings,
      recommendations,
    });
    seen.add(code);
    if (summaries.length >= Math.max(0, Math.floor(maxAgents))) break;
  }

  return summaries;
}
