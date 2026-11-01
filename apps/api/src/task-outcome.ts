import { z } from "zod";
import { METRIC_SPECS, type MetricId } from "@e-nora/contracts";

const metricIds = Object.keys(METRIC_SPECS) as MetricId[];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const taskOutcomeSchema = z.object({
  metric_name: z.string().trim().min(1).max(120),
  metric_id: z.string().trim().max(64).optional(),
  before_value: z.number().finite().nullable().optional(),
  after_value: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(40).optional(),
  currency_code: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  source_system: z.enum(["manual", "shopify", "meta", "klaviyo", "other"]).optional(),
  measurement_period_start: dateSchema.optional(),
  measurement_period_end: dateSchema.optional(),
  summary: z.string().trim().max(1_000).optional(),
  measured_at: dateSchema,
}).strict().superRefine((value, ctx) => {
  const parsed = new Date(`${value.measured_at}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.measured_at) {
    ctx.addIssue({ code: "custom", path: ["measured_at"], message: "Fecha de medición inválida." });
  }
  if (value.measured_at > new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({ code: "custom", path: ["measured_at"], message: "La fecha de medición no puede estar en el futuro." });
  }
  if (value.after_value == null && !value.summary?.trim()) {
    ctx.addIssue({ code: "custom", path: ["after_value"], message: "Indica el valor observado o un resumen del resultado." });
  }
  if (value.metric_id && !metricIds.includes(value.metric_id as MetricId)) {
    ctx.addIssue({ code: "custom", path: ["metric_id"], message: "La métrica seleccionada no existe en el catálogo canónico." });
  }
  const hasMeasurementContext = Boolean(value.metric_id || value.source_system || value.measurement_period_start || value.measurement_period_end || value.currency_code);
  if (hasMeasurementContext) {
    if (!value.source_system) ctx.addIssue({ code: "custom", path: ["source_system"], message: "Indica de qué fuente procede la medición." });
    if (!value.measurement_period_start || !value.measurement_period_end) {
      ctx.addIssue({ code: "custom", path: ["measurement_period_start"], message: "Indica el periodo que estás comparando." });
    } else {
      const start = new Date(`${value.measurement_period_start}T00:00:00.000Z`);
      const end = new Date(`${value.measurement_period_end}T00:00:00.000Z`);
      if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== value.measurement_period_start) {
        ctx.addIssue({ code: "custom", path: ["measurement_period_start"], message: "Fecha de inicio inválida." });
      }
      if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== value.measurement_period_end) {
        ctx.addIssue({ code: "custom", path: ["measurement_period_end"], message: "Fecha de fin inválida." });
      }
      if (value.measurement_period_start > value.measurement_period_end) {
        ctx.addIssue({ code: "custom", path: ["measurement_period_end"], message: "El periodo termina antes de empezar." });
      }
      if (value.measurement_period_end > value.measured_at) {
        ctx.addIssue({ code: "custom", path: ["measurement_period_end"], message: "El periodo medido no puede acabar después de la fecha de medición." });
      }
    }
  }
  if (value.metric_id && metricIds.includes(value.metric_id as MetricId) && METRIC_SPECS[value.metric_id as MetricId].unit === "money" && !value.currency_code) {
    ctx.addIssue({ code: "custom", path: ["currency_code"], message: "Indica la moneda de esta métrica." });
  }
});

export type TaskOutcomeInput = z.infer<typeof taskOutcomeSchema>;

export function parseTaskOutcomeInput(value: unknown) {
  if (value === undefined || value === null) return { ok: true as const, data: null };
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if (Object.values(row).every((field) => field === undefined || field === null || field === "")) {
      return { ok: true as const, data: null };
    }
  }
  const parsed = taskOutcomeSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues };
  return {
    ok: true as const,
    data: {
      ...parsed.data,
      metric_name: parsed.data.metric_id ? METRIC_SPECS[parsed.data.metric_id as MetricId].label : parsed.data.metric_name,
      metric_id: parsed.data.metric_id || null,
      unit: parsed.data.metric_id
        ? METRIC_SPECS[parsed.data.metric_id as MetricId].unit === "rate" ? "%" : METRIC_SPECS[parsed.data.metric_id as MetricId].unit === "ratio" ? "x" : null
        : parsed.data.unit || null,
      currency_code: parsed.data.currency_code || null,
      source_system: parsed.data.source_system || null,
      measurement_period_start: parsed.data.measurement_period_start || null,
      measurement_period_end: parsed.data.measurement_period_end || null,
      summary: parsed.data.summary || null,
      before_value: parsed.data.before_value ?? null,
      after_value: parsed.data.after_value ?? null,
    },
  };
}
