import { z } from "zod";

const taskOutcomeSchema = z.object({
  metric_name: z.string().trim().min(1).max(120),
  before_value: z.number().finite().nullable().optional(),
  after_value: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(1_000).optional(),
  measured_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      unit: parsed.data.unit || null,
      summary: parsed.data.summary || null,
      before_value: parsed.data.before_value ?? null,
      after_value: parsed.data.after_value ?? null,
    },
  };
}
