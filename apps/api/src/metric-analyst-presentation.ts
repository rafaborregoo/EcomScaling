import { METRIC_SPECS, type MetricAnalysis, type MetricUnit } from "@e-nora/contracts";
import type { AgentOutput } from "@e-nora/ai";

/** All factual fields shown to the user come from the validated observation. */
export function metricAnalystPresentation(analysis: MetricAnalysis): AgentOutput {
  const spec = METRIC_SPECS[analysis.metric];
  const format = (value: number | null, unit: MetricUnit, currency = analysis.currency_code) => {
    if (value == null || !Number.isFinite(value)) return null;
    const text = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(unit === "rate" ? value * 100 : value);
    return unit === "rate" ? `${text} %` : unit === "ratio" ? `${text}×` : `${text}${currency ? ` ${currency}` : ""}`;
  };
  const labels = { good: "Va bien", watch: "Conviene vigilarla", bad: "Requiere atención", insufficient: "Faltan datos fiables para valorarla" };
  const severity = { good: "info", watch: "medium", bad: "high", insufficient: "low" } as const;
  const period = analysis.measurement_period;
  const findings: AgentOutput["findings"] = [{
    title: `${analysis.label}: ${labels[analysis.verdict].toLowerCase()}`,
    severity: severity[analysis.verdict], area: analysis.metric,
    evidence: analysis.reasons.map((reason) => reason.text).slice(0, 2).join(" "),
    figures: analysis.value == null ? [] : [{ label: analysis.label, value: format(analysis.value, spec.unit)!, previous: format(analysis.previous, spec.unit), change_pct: analysis.change_pct }],
  }];
  for (const driver of analysis.drivers.filter((driver) => driver.effect === "hurts").slice(0, 2)) {
    const driverSpec = spec.drivers.find((item) => item.id === driver.id);
    if (!driverSpec || driver.value == null) continue;
    findings.push({ title: `${driver.label}: movimiento desfavorable`, severity: "low", area: analysis.metric,
      evidence: "Coincide con la evolución observada; por sí solo no demuestra la causa.",
      figures: [{ label: driver.label, value: format(driver.value, driverSpec.unit, driver.currency_code)!, previous: format(driver.previous, driverSpec.unit, driver.currency_code), change_pct: driver.change_pct }],
    });
  }
  const warnings = analysis.attributed_by ? [`La atribución de ${analysis.attributed_by === "meta" ? "Meta" : "Klaviyo"} no demuestra ventas incrementales ni beneficio.`] : [];
  if (analysis.verdict === "insufficient") warnings.push(analysis.reasons[0]?.text ?? "No hay datos suficientes para comparar.");
  if (!analysis.currency_code && spec.unit === "money") warnings.push("La moneda del importe no está verificada.");
  if (analysis.drivers.some((driver) => spec.drivers.find((item) => item.id === driver.id)?.unit === "money" && driver.value != null && !driver.currency_code)) {
    warnings.push("Hay importes auxiliares cuya moneda no esta confirmada.");
  }
  return {
    answer: `${analysis.label}: ${labels[analysis.verdict].toLowerCase()}.`, findings,
    confidence: analysis.confidence, warnings, proposed_writes: [], approval_required: false,
    recommendations: [], sources: [{ kind: "metric", reference: analysis.metric, period: period ? `${period.start} – ${period.end}` : null }],
  };
}
