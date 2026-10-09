/**
 * ADR-0025: contrato de la campaña de mailing orquestada con LangGraph.
 *
 * Lo comparten la API (estado del grafo, proyeccion por email, eventos de
 * pausa/reanudacion) y la pantalla (estado de cada email). El grafo solo
 * ordena pasos: estos tipos no llevan cifras de rendimiento ni ingresos.
 */
import { z } from "zod";

/** Reintentos de redaccion tras un rechazo de la revision automatica. */
export const MAILING_GRAPH_MAX_AUTO_RETRIES = 2;
/** Reintentos propios del rechazo humano (aprobador o consultor): no se gastan con los automaticos. */
export const MAILING_GRAPH_MAX_HUMAN_RETRIES = 2;
/** Version mas alta de un email (la 0 es la primera redaccion). */
export const MAILING_GRAPH_MAX_ATTEMPT = MAILING_GRAPH_MAX_AUTO_RETRIES + MAILING_GRAPH_MAX_HUMAN_RETRIES;
/** Redacciones de A11 en paralelo dentro de una campaña. */
export const MAILING_GRAPH_MAX_CONCURRENCY = 3;
/** Un hilo sin pausa y sin checkpoint nuevo en este tiempo se puede reanudar a mano. */
export const MAILING_GRAPH_STALE_MS = 15 * 60 * 1_000;

export const mailingEmailStatusSchema = z.enum([
  "queued",
  "drafting",
  "reviewing",
  "awaiting_approval",
  "awaiting_consultant_review",
  "approved",
  "scheduled",
  "rejected",
  "failed",
]);
export type MailingEmailStatus = z.infer<typeof mailingEmailStatusSchema>;

export const MAILING_EMAIL_TERMINAL_STATUSES: readonly MailingEmailStatus[] = [
  "scheduled",
  "rejected",
  "failed",
];

export const MAILING_EMAIL_STATUS_LABELS: Record<MailingEmailStatus, string> = {
  queued: "En cola",
  drafting: "Redactando",
  reviewing: "Revisión automática",
  awaiting_approval: "Esperando aprobación",
  awaiting_consultant_review: "Revisión del consultor",
  approved: "Aprobado",
  scheduled: "Programado",
  rejected: "Rechazado",
  failed: "Fallido",
};

export const mailingRejectionSourceSchema = z.enum([
  "auto_review",
  "human",
  "consultant_review",
]);

export const mailingRejectionSchema = z.object({
  attempt: z.number().int().min(0).max(MAILING_GRAPH_MAX_ATTEMPT),
  source: mailingRejectionSourceSchema,
  reasons: z.array(z.string().min(1).max(500)).min(1).max(20),
  at: z.string().datetime(),
});
export type MailingRejection = z.infer<typeof mailingRejectionSchema>;

export const mailingApproverRoleSchema = z.enum(["consultant", "platform", "client"]);
export type MailingApproverRole = z.infer<typeof mailingApproverRoleSchema>;

/** Estado de un email dentro del grafo (y de su fila de proyeccion). */
export const mailingEmailStateSchema = z.object({
  sequence_number: z.number().int().min(1).max(7),
  title: z.string().min(1).max(300),
  scheduled_for: z.string().datetime(),
  brief: z.string().min(1).max(20_000),
  image_url: z.string().max(2_000).nullable(),
  status: mailingEmailStatusSchema,
  attempt: z.number().int().min(0).max(MAILING_GRAPH_MAX_ATTEMPT),
  draft_id: z.string().uuid().nullable(),
  auto_review_passed: z.boolean().nullable(),
  rejections: z.array(mailingRejectionSchema).max(10),
  last_error: z.string().max(500).nullable(),
  decided_by: z.string().uuid().nullable(),
  decided_role: mailingApproverRoleSchema.nullable(),
  /** Rol de membresia de quien aprobo (owner, manager...); null para staff sin membresia. */
  decided_membership_role: z.string().max(32).nullable().optional(),
});
export type MailingEmailState = z.infer<typeof mailingEmailStateSchema>;

/** Estado del grafo de campaña. organization_id y store_id salen de la sesion. */
export const mailingCampaignGraphStateSchema = z.object({
  sequence_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  store_id: z.string().uuid().nullable(),
  requires_consultant_review: z.boolean(),
  emails: z.array(mailingEmailStateSchema).min(1).max(7),
  results: z.array(mailingEmailStateSchema),
  closed: z.boolean(),
});
export type MailingCampaignGraphState = z.infer<typeof mailingCampaignGraphStateSchema>;

/** Lo que deja una pausa: el borrador sigue en pending_approval en su tabla. */
export const mailingInterruptSchema = z.object({
  kind: z.enum(["approval", "consultant_review", "retry"]),
  sequence_number: z.number().int().min(1).max(7),
  /** Null solo en "retry" cuando el email fallo antes de tener borrador. */
  draft_id: z.string().uuid().nullable(),
});
export type MailingInterrupt = z.infer<typeof mailingInterruptSchema>;

/**
 * Lo que reanuda una pausa. Es solo un aviso: el nodo relee la decision de
 * marketing_content_drafts / la fila de revision, nunca se fia del payload.
 */
export const mailingResumeEventSchema = z.object({
  sequence_id: z.string().uuid(),
  sequence_number: z.number().int().min(1).max(7),
  draft_id: z.string().uuid().nullable(),
  kind: z.enum(["approval", "consultant_review", "retry"]),
});
export type MailingResumeEvent = z.infer<typeof mailingResumeEventSchema>;

export const mailingCampaignEmailViewSchema = z.object({
  sequence_number: z.number().int(),
  title: z.string(),
  scheduled_for: z.string(),
  status: mailingEmailStatusSchema,
  attempt: z.number().int(),
  draft_id: z.string().uuid().nullable(),
  draft_subject: z.string().nullable(),
  auto_review_passed: z.boolean().nullable(),
  rejections: z.array(mailingRejectionSchema),
  last_error: z.string().nullable(),
  decided_role: mailingApproverRoleSchema.nullable(),
  updated_at: z.string(),
});
export type MailingCampaignEmailView = z.infer<typeof mailingCampaignEmailViewSchema>;

export const mailingCampaignViewSchema = z.object({
  sequence_id: z.string().uuid(),
  campaign_name: z.string(),
  sequence_status: z.string(),
  orchestrator: z.enum(["browser", "graph"]),
  requires_consultant_review: z.boolean(),
  /** Hay un hilo que ni avanza ni espera a una persona: se puede reanudar. */
  needs_resume: z.boolean(),
  emails: z.array(mailingCampaignEmailViewSchema),
});
export type MailingCampaignView = z.infer<typeof mailingCampaignViewSchema>;

/** Lo que se añade al brief al volver a redactar tras un rechazo. */
export function mailingRetryFeedback(reasons: readonly string[]) {
  return `CORRECCIONES OBLIGATORIAS de la version anterior (rechazada): ${reasons.join(" · ")}`;
}

/** Decision de una persona sobre un email fallido. */
export const mailingFailureDecisionSchema = z.enum(["retry", "discard"]);
export type MailingFailureDecision = z.infer<typeof mailingFailureDecisionSchema>;

export function isMailingEmailTerminal(status: MailingEmailStatus) {
  return MAILING_EMAIL_TERMINAL_STATUSES.includes(status);
}

/** Brief de A11 para un email del plan de A27. Una sola redaccion para web y API. */
export function buildWeeklyMailingEmailBrief(input: {
  objective: string;
  audience: string;
  offer: string;
  instructions: string;
  campaignName: string;
  plan: { diagnosis: string; sequence_rationale: string; visual_direction: string };
  email: {
    title: string;
    angle: string;
    objective: string;
    audience: string;
    subject_direction: string;
    preheader_direction: string;
    cta: string;
    copy_brief: string;
    visual_modules: string;
  };
  index: number;
  total: number;
  scheduledDate: string;
}): string {
  const instructions = [
    "PLAN ESTRATEGICO A27: usa lo siguiente como restricciones de trabajo basadas en el historial de esta organizacion.",
    `Diagnostico: ${input.plan.diagnosis}`,
    `Arco de secuencia: ${input.plan.sequence_rationale}`,
    `Dirección visual común propuesta por A27: ${input.plan.visual_direction}`,
    `Este es el email ${input.index + 1} de ${input.total}: ${input.email.title}.`,
    `Angulo: ${input.email.angle}. Objetivo: ${input.email.objective}. Audiencia: ${input.email.audience}.`,
    `Direccion de asunto: ${input.email.subject_direction}. Direccion de preheader: ${input.email.preheader_direction}. CTA: ${input.email.cta}.`,
    `Brief de copy obligatorio: ${input.email.copy_brief}`,
    `Módulos visuales de esta pieza dentro del sistema común: ${input.email.visual_modules}`,
    `CAMPAÑA DE MAILING: ${input.campaignName.trim()}.`,
    `Este es el email ${input.index + 1} de ${input.total}; debe aportar un ángulo distinto y no repetir el anterior.`,
    `Fecha prevista de envío: ${input.scheduledDate} a las 09:00.`,
    input.instructions.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "Canal de destino: email_klaviyo",
    `Objetivo: ${input.objective}`,
    `Audiencia: ${input.audience.trim() || "No especificada; identificar supuestos"}`,
    `Oferta o producto: ${input.offer.trim() || "No especificada; no inventar condiciones"}`,
    "Tono: brand",
    "CTA preferido: Proponer uno coherente con el objetivo",
    `Indicaciones adicionales: ${instructions.trim()}`,
  ].join("\n");
}
