import { summarizeKlaviyoFlowArchitecture } from "./klaviyo-flow-architect-output.js";

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
  flow_architecture?: NonNullable<ReturnType<typeof summarizeKlaviyoFlowArchitecture>>;
  mailing_strategy?: {
    plan_name: string;
    strategy_decision: string;
    objective_rationale: string;
    audience_rationale: string;
    cadence_recommendation: string;
    requested_schedule_assessment: string;
    confidence: string;
    sources: Array<{ kind: string; reference: string; period: string | null }>;
    email_angles: Array<{
      sequence_number: number;
      title: string;
      sequence_role: string;
      angle: string;
      subject_direction: string;
      cta: string;
      copy_brief: string;
      evidence: Array<{
        label: string;
        value: string;
        period: string | null;
        source: string;
      }>;
    }>;
  };
};

const RELEVANT_MARKETING_PEERS = new Set([
  "a01_analista_llamadas",
  "a02_monitor_negocio",
  "a05_estrategia_campanas",
  "a27_planificador_mailing",
  "a12_analista_email",
  "a17_plan_semanal",
  "a18_plan_mensual",
  "a23_creatividad_meta",
  "a24_medicion_meta",
  "a25_cambios_meta",
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
  options: {
    now?: Date;
    maxAgeDaysByCode?: Readonly<Record<string, number>>;
  } = {},
): MarketingPeerSummary[] {
  const summaries: MarketingPeerSummary[] = [];
  const seen = new Set<string>();
  const now = options.now ?? new Date();

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
    const maxAgeDays = options.maxAgeDaysByCode?.[code];
    if (maxAgeDays !== undefined) {
      const generatedAtMs = Date.parse(generatedAt);
      if (
        !Number.isFinite(generatedAtMs) ||
        generatedAtMs > now.getTime() ||
        now.getTime() - generatedAtMs > maxAgeDays * 86_400_000
      ) continue;
    }

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
    const text = (value: unknown, limit: number) =>
      typeof value === "string" ? value.trim().slice(0, limit) : "";
    const cadence = typeof output.cadence === "object" && output.cadence !== null
      ? output.cadence as Record<string, unknown>
      : {};
    const mailingStrategy = code === "a27_planificador_mailing"
      ? {
          plan_name: text(output.plan_name, 180),
          strategy_decision: text(output.strategy_decision, 700),
          objective_rationale: text(output.objective_rationale, 400),
          audience_rationale: text(output.audience_rationale, 400),
          cadence_recommendation: text(cadence.recommendation, 400),
          requested_schedule_assessment: text(cadence.requested_schedule_assessment, 400),
          confidence: text(output.confidence, 20),
          sources: Array.isArray(output.sources)
            ? output.sources.slice(0, 8).flatMap((item) => {
                if (typeof item !== "object" || item === null) return [];
                const source = item as Record<string, unknown>;
                const reference = text(source.reference, 180);
                const kind = text(source.kind, 40);
                if (!reference || !kind) return [];
                return [{
                  kind,
                  reference,
                  period: text(source.period, 120) || null,
                }];
              })
            : [],
          email_angles: Array.isArray(output.emails)
            ? output.emails.slice(0, 5).flatMap((item) => {
                if (typeof item !== "object" || item === null) return [];
                const email = item as Record<string, unknown>;
                if (typeof email.sequence_number !== "number" || !Number.isInteger(email.sequence_number)) return [];
                return [{
                  sequence_number: email.sequence_number,
                  title: text(email.title, 140),
                  sequence_role: text(email.sequence_role, 120),
                  angle: text(email.angle, 240),
                  subject_direction: text(email.subject_direction, 200),
                  cta: text(email.cta, 160),
                  copy_brief: text(email.copy_brief, 320),
                  evidence: Array.isArray(email.evidence)
                    ? email.evidence.slice(0, 2).flatMap((item) => {
                        if (typeof item !== "object" || item === null) return [];
                        const evidence = item as Record<string, unknown>;
                        const label = text(evidence.label, 120);
                        const value = text(evidence.value, 180);
                        const source = text(evidence.source, 40);
                        if (!label || !value || !source) return [];
                        return [{
                          label,
                          value,
                          period: text(evidence.period, 100) || null,
                          source,
                        }];
                      })
                    : [],
                }];
              })
            : [],
        }
      : null;
    const conclusion = [
      output.answer,
      output.strategy_decision,
      output.diagnosis,
      output.summary,
    ]
      .find((value): value is string => typeof value === "string")
      ?.slice(0, 700) ?? "";
    const agent = typeof definition?.name === "string" ? definition.name : code;
    const flowArchitecture = code === "a28_arquitecto_flujos"
      ? summarizeKlaviyoFlowArchitecture(output.flow_architecture)
      : null;

    summaries.push({
      agent,
      code,
      generated_at: generatedAt,
      status: row.status,
      conclusion,
      findings,
      warnings,
      recommendations,
      ...(flowArchitecture ? { flow_architecture: flowArchitecture } : {}),
      ...(mailingStrategy ? { mailing_strategy: mailingStrategy } : {}),
    });
    seen.add(code);
    if (summaries.length >= Math.max(0, Math.floor(maxAgents))) break;
  }

  return summaries;
}
