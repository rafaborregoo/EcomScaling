export const KNOWLEDGE_GAP_REVIEW_WINDOW_DAYS = 14;

const TOPIC_RULES = [
  {
    id: "email_marketing",
    label: "Email marketing, Klaviyo y automatizaciones",
    terms: ["klaviyo", "email", "mailing", "correo", "newsletter", "flow", "flows", "automatizacion", "automatización"],
  },
  {
    id: "acquisition_meta",
    label: "Adquisición y publicidad en Meta",
    terms: ["meta ads", "facebook ads", "instagram ads", "campaña", "campana", "ads", "publicidad", "cac", "roas", "cpa"],
  },
  {
    id: "fulfillment_delivery",
    label: "Preparación, envío y entrega de pedidos",
    terms: ["envio", "envío", "entrega", "pedido", "fulfillment", "transportista", "aduana", "devolucion", "devolución", "reembolso"],
  },
  {
    id: "inventory_products",
    label: "Inventario, catálogo y producto",
    terms: ["stock", "inventario", "producto", "variante", "catalogo", "catálogo", "proveedor", "reposicion", "reposición"],
  },
  {
    id: "sales_conversion",
    label: "Ventas, conversión y experiencia de compra",
    terms: ["venta", "ventas", "conversion", "conversión", "checkout", "carrito", "funnel", "embudo", "shopify"],
  },
  {
    id: "margin_costs",
    label: "Margen, costes y rentabilidad",
    terms: ["margen", "coste", "costo", "beneficio", "rentabilidad", "descuento", "pricing", "precio", "gasto"],
  },
  {
    id: "customer_retention",
    label: "Retención, recurrencia y clientes",
    terms: ["retencion", "retención", "recurrencia", "recompra", "churn", "cohorte", "cliente", "clientes", "fidelizacion", "fidelización"],
  },
] as const;

type JsonRecord = Record<string, unknown>;

export type KnowledgeGapSearchCall = {
  run_id: string;
  created_at: string;
  input: unknown;
  output: unknown;
  is_error: boolean;
  agent_code: string | null;
  store_id: string | null;
};

export type KnowledgeGapRejectedDecision = {
  id: string;
  run_id: string;
  decided_at: string;
  reason: unknown;
};

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function matchedTopics(query: string) {
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return TOPIC_RULES.filter((topic) => topic.terms.some((term) => {
    const normalizedTerm = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalized);
  }));
}

function explicitlyRejectsForMissingKnowledge(reason: unknown) {
  if (typeof reason !== "string") return false;
  const normalized = reason.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(falta|faltan|faltaba|faltaban|sin|insuficiente|insuficientes|no hay|no tenemos|no encuentro|no se encontro|missing|lacks|lack of|not enough|insufficient)\b.{0,48}\b(informacion|datos?|evidencia|fuente|contexto|information|data|evidence|source|context)\b/.test(normalized)
    || /\b(informacion|datos?|evidencia|fuente|contexto|information|data|evidence|source|context)\b.{0,48}\b(faltante|incompleto|insuficiente|missing|incomplete|insufficient|not found)\b/.test(normalized);
}

/**
 * Summarize only repeated, successful zero-result RAG searches. Raw queries are
 * classified locally and never returned to the model; categories and source
 * run metadata are sufficient for A08 to prioritize a content review.
 */
export function summarizeKnowledgeGapSignals(
  calls: readonly KnowledgeGapSearchCall[],
  now = new Date(),
  rejectedDecisions: readonly KnowledgeGapRejectedDecision[] = [],
) {
  const groups = new Map<string, {
    topic_id: string;
    topic: string;
    store_id: string | null;
    audience: "client_visible" | "consultant_only" | "unspecified";
    runs: Map<string, { created_at: string; agent_code: string | null }>;
    decisions: Map<string, { id: string; decided_at: string }>;
  }>();

  for (const call of calls) {
    if (call.is_error || call.agent_code === "a08_gestor_conocimiento") continue;
    const output = record(call.output);
    if (output?.match_count !== 0) continue;
    const input = record(call.input);
    const query = typeof input?.query === "string" ? input.query : "";
    if (!query || !Number.isFinite(Date.parse(call.created_at))) continue;

    const audiences = Array.isArray(input?.audiences) ? input.audiences : [];
    const audience = audiences.includes("consultant_only")
      ? "consultant_only"
      : audiences.includes("client_visible")
        ? "client_visible"
        : "unspecified";
    for (const topic of matchedTopics(query)) {
      const key = [topic.id, call.store_id ?? "all_stores", audience].join(":");
      let group = groups.get(key);
      if (!group) {
        group = {
          topic_id: topic.id,
          topic: topic.label,
          store_id: call.store_id,
          audience,
          runs: new Map(),
          decisions: new Map(),
        };
        groups.set(key, group);
      }
      if (!group.runs.has(call.run_id)) {
        group.runs.set(call.run_id, {
          created_at: call.created_at,
          agent_code: call.agent_code,
        });
      }
    }
  }

  const groupsByRun = new Map<string, Set<string>>();
  for (const [key, group] of groups) {
    for (const runId of group.runs.keys()) {
      const keys = groupsByRun.get(runId) ?? new Set<string>();
      keys.add(key);
      groupsByRun.set(runId, keys);
    }
  }
  for (const decision of rejectedDecisions) {
    if (!explicitlyRejectsForMissingKnowledge(decision.reason) || !Number.isFinite(Date.parse(decision.decided_at))) continue;
    const candidateKeys = [...(groupsByRun.get(decision.run_id) ?? [])];
    const reasonTopics = new Set<string>(
      typeof decision.reason === "string"
        ? matchedTopics(decision.reason).map((topic) => topic.id)
        : [],
    );
    for (const key of candidateKeys) {
      const group = groups.get(key);
      if (!group) continue;
      // A generic rejection linked to a run with searches in several domains
      // is not enough evidence to assign the rejection to every domain.
      if (reasonTopics.size > 0 && !reasonTopics.has(group.topic_id)) continue;
      if (reasonTopics.size === 0 && candidateKeys.length !== 1) continue;
      const decisions = groups.get(key)?.decisions;
      if (decisions && !decisions.has(decision.run_id)) {
        decisions.set(decision.run_id, {
          id: decision.id,
          decided_at: decision.decided_at,
        });
      }
    }
  }

  const windowMs = KNOWLEDGE_GAP_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return [...groups.values()]
    .map((group) => {
      const runs = [...group.runs.entries()].sort((a, b) =>
        a[1].created_at.localeCompare(b[1].created_at),
      );
      const timestamps = runs.map(([, run]) => run.created_at).sort();
      const lastSeen = timestamps.at(-1)!;
      const reviewMs = new Date(lastSeen).getTime() + windowMs;
      const agentCodes = [...new Set(runs.map(([, run]) => run.agent_code).filter(
        (code): code is string => Boolean(code),
      ))];
      const decisions = [...group.decisions.values()].sort((a, b) =>
        a.decided_at.localeCompare(b.decided_at),
      );
      return {
        topic_id: group.topic_id,
        topic: group.topic,
        store_id: group.store_id,
        audience: group.audience,
        unique_zero_result_runs: runs.length,
        explicit_missing_knowledge_rejection_runs: decisions.length,
        rejected_decision_ids: decisions.slice(-5).map(({ id }) => id),
        evidence_basis: decisions.length
          ? runs.length >= 2 ? "repeated_empty_search_and_explicit_rejection" : "explicit_rejection_linked_to_empty_search"
          : "repeated_empty_search",
        recurrent: runs.length >= 2,
        source: "agent_tool_calls.search_knowledge.match_count=0",
        source_agent_codes: agentCodes,
        source_run_ids: runs.slice(-5).map(([runId]) => runId),
        first_seen_at: timestamps[0],
        last_seen_at: lastSeen,
        suggested_review_by: new Date(Math.max(reviewMs, now.getTime())).toISOString(),
        review_window_days: KNOWLEDGE_GAP_REVIEW_WINDOW_DAYS,
        responsible_team: "E-NORA · responsable del conocimiento",
      };
    })
    .filter((signal) => signal.recurrent || signal.explicit_missing_knowledge_rejection_runs > 0)
    .sort((a, b) =>
      b.explicit_missing_knowledge_rejection_runs - a.explicit_missing_knowledge_rejection_runs ||
      Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at) ||
      b.unique_zero_result_runs - a.unique_zero_result_runs ||
      a.topic_id.localeCompare(b.topic_id))
    .slice(0, 12);
}
