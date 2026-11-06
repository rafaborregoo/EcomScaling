export type A02SectionKey = "ventas" | "finanzas" | "stock" | "meta" | "klaviyo" | "operativa" | "integraciones";

export type A02Finding = {
  title: string;
  severity: string;
  area?: string;
  evidence?: unknown;
  figures?: Array<{ label: string; value: string; previous?: string | null; change_pct?: number | null; metric_key?: string | null }> | null;
};
export type A02Recommendation = { action: string; priority?: string; owner?: string; expected_impact?: string };
export type A02Diagnostic = {
  generated_at: string;
  stale?: boolean;
  output_status?: string;
  result_scope?: string;
  requested_scope?: string;
  scope_label?: string;
  preview?: { transport: "codex_cli"; environment: "test" };
  envelope?: { freshness?: { status?: string; validUntil?: string; reason?: string }; quality?: { dataCompleteness?: string } };
  output: {
    headline?: string;
    answer?: string;
    confidence?: string;
    warnings?: string[];
    sections?: Array<{ key: string; label: string; findings: A02Finding[]; recommendations?: A02Recommendation[] }>;
    findings?: A02Finding[];
    recommendations?: A02Recommendation[];
  };
};

// Stable location IDs, shared by the web and mobile interfaces.
export const A02_SPOTS = {
  home: { id: "01", label: "Salud del negocio", scope: "overview", sections: [] },
  shopify: { id: "02", label: "Lectura de Shopify", scope: "shopify", sections: ["ventas", "finanzas", "stock", "operativa"] },
  meta: { id: "03", label: "Lectura de Meta Ads", scope: "meta", sections: ["meta"] },
  klaviyo: { id: "04", label: "Lectura de Klaviyo", scope: "klaviyo", sections: ["klaviyo"] },
  profitability: { id: "05", label: "Lectura de rentabilidad", scope: "panel", sections: ["finanzas", "ventas", "meta"] },
  integrations: { id: "06", label: "Fiabilidad de los datos", scope: "overview", sections: ["integraciones"] },
  camino: { id: "07", label: "Contexto del negocio para el plan", scope: "overview", sections: ["ventas", "finanzas"] },
  tasks: { id: "08", label: "Contexto para priorizar el trabajo", scope: "overview", sections: [] },
  mobile: { id: "09", label: "Salud del negocio", scope: "overview", sections: [] },
} as const;
export type A02Spot = keyof typeof A02_SPOTS;
export type A02ReadingState = "loading" | "pending" | "unavailable" | "laboratory" | "stale" | "limited" | "not_covered" | "empty" | "ready";
export const a02PlainText = (text?: string | null) => text?.replace(/\*\*|__|`/g, "").trim() ?? "";

const rank: Record<string, number> = { critical: 0, business_threat: 0, urgent: 0, error: 0, high: 1, warning: 2, medium: 2, moderate: 2, low: 3, info: 4, positive: 4 };
export const a02SeverityLabel = (severity: string) => (rank[severity] ?? 4) === 0 ? "Urgente" : rank[severity] === 1 ? "Prioridad alta" : rank[severity] === 2 ? "Revisar" : severity === "positive" ? "Señal positiva" : "Contexto";
export function a02EvidenceText(value: unknown): string {
  if (typeof value === "string") return a02PlainText(value);
  if (!value || typeof value !== "object" || !("label" in value) || !("value" in value)) return "";
  const parts = [`${value.label}: ${value.value}`];
  if ("period" in value && typeof value.period === "string" && value.period) parts.push(value.period);
  if ("source" in value && typeof value.source === "string" && value.source) parts.push(value.source);
  return a02PlainText(parts.join(" · "));
}
export function isA02Laboratory(diagnostic: unknown): boolean {
  if (!diagnostic || typeof diagnostic !== "object" || !("output" in diagnostic)) return false;
  const output = diagnostic.output;
  if (!output || typeof output !== "object" || !("warnings" in output) || !Array.isArray(output.warnings)) return false;
  return output.warnings.some((text) => typeof text === "string" && /Codex CLI|resultado de laboratorio|datos de TEST|no es una ejecuci[oó]n.*API/i.test(text));
}

export function projectA02Reading({ diagnostic, spot, loading = false, error, errorCode, now = Date.now() }: {
  diagnostic?: A02Diagnostic | null;
  spot: A02Spot;
  loading?: boolean;
  error?: string | null;
  errorCode?: string | null;
  now?: number;
}) {
  const config = A02_SPOTS[spot];
  const base = { id: config.id, label: config.label, findings: [] as Array<A02Finding & { section?: string }>, recommendations: [] as A02Recommendation[], generatedAt: diagnostic?.generated_at ?? null, generalFallback: false };
  const state = (value: A02ReadingState, summary: string) => ({ ...base, state: value, summary });
  if (!diagnostic) {
    if (loading) return state("loading", "Cargando la lectura de A02…");
    if (errorCode === "agent_diagnostic_test_only") return state("laboratory", "Esta lectura es de prueba. Esperando un análisis válido del negocio.");
    if (errorCode === "agent_diagnostic_pending" || !error) return state("pending", "La lectura de A02 todavía no está disponible. Se prepara automáticamente.");
    if (errorCode?.startsWith("agent_sin_datos")) return state("unavailable", "A02 necesita datos sincronizados para preparar esta lectura.");
    return state("unavailable", "No se ha podido cargar la lectura de A02.");
  }
  if (isA02Laboratory(diagnostic) && !diagnostic.preview) return state("laboratory", "Esta lectura es de prueba. Esperando un análisis válido del negocio.");
  if (diagnostic.output_status === "rejected" || !Number.isFinite(Date.parse(diagnostic.generated_at))) return state("unavailable", "No hay una lectura válida de A02 para mostrar.");
  if (!diagnostic.output || (!Array.isArray(diagnostic.output.sections) && !Array.isArray(diagnostic.output.findings))) return state("unavailable", "La lectura disponible no contiene un diagnóstico válido.");
  const resultScope = diagnostic.result_scope ?? diagnostic.requested_scope;
  if (resultScope === "panel" && config.scope !== "panel") return state("unavailable", "Esta lectura pertenece al panel del consultor.");
  if (resultScope && resultScope !== config.scope && resultScope !== "overview") return state("not_covered", "La última lectura corresponde a otra vista.");
  const sections: readonly string[] = config.sections;
  const selected = (diagnostic.output.sections ?? []).filter((section) => !sections.length || sections.includes(section.key));
  const findings = selected.flatMap((section) => section.findings.map((finding) => ({ ...finding, section: section.key })));
  for (const finding of diagnostic.output.findings ?? []) {
    if (!sections.length || (finding.area && sections.includes(finding.area))) findings.push({ ...finding, section: finding.area ?? "" });
  }
  const seen = new Set<string>();
  base.findings = findings.filter((finding) => {
    const key = a02PlainText(finding.title).toLocaleLowerCase("es");
    if (!a02PlainText(finding.title) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  base.recommendations = selected.flatMap((section) => section.recommendations ?? []);
  if (!sections.length && !selected.length) base.recommendations = diagnostic.output.recommendations ?? [];
  base.generalFallback = resultScope === "overview" && config.scope !== "overview";
  const expiry = diagnostic.envelope?.freshness?.validUntil;
  const stale = diagnostic.stale || diagnostic.envelope?.freshness?.status === "stale" || (diagnostic.envelope?.freshness?.reason !== "no_activity_since" && expiry && Date.parse(expiry) < now);
  if (stale) return state("stale", "La última lectura está pendiente de actualización.");
  const headline = a02PlainText(diagnostic.output.headline ?? diagnostic.output.answer);
  const covered = !sections.length || selected.length > 0 || base.findings.length > 0;
  if (!covered) return state("not_covered", "La última lectura de A02 no incluye esta área.");
  if (!base.findings.length && !base.recommendations.length) {
    if (diagnostic.output.confidence === "low" || ["partial", "insufficient", "unavailable"].includes(diagnostic.envelope?.quality?.dataCompleteness ?? "")) return state("limited", "A02 no dispone de evidencia suficiente para valorar esta área.");
    return state("empty", "A02 no ha señalado hallazgos en esta área en su última lectura.");
  }
  const useHeadline = (spot === "home" || spot === "mobile" || config.scope === resultScope) && !base.generalFallback;
  return state("ready", (useHeadline && headline) || a02PlainText(base.findings[0]?.title) || a02PlainText(base.recommendations[0]?.action));
}
