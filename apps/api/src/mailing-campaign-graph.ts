/**
 * ADR-0025: grafo de la campaña de mailing.
 *
 *   preparar ──Send×N──▶ email (subgrafo) ──▶ cerrar
 *
 *   subgrafo email:
 *   redactar (A11) → revisar (codigo) ─┬─ falla y quedan reintentos → redactar
 *                                      └─ pasa o tope → esperar_aprobacion (pausa)
 *   esperar_aprobacion ─┬─ rechazo → redactar (si quedan reintentos humanos) | rechazado
 *                       ├─ aprueba cliente con consultor → esperar_revision (pausa)
 *                       └─ aprueba → programar
 *   redactar / programar fallan → esperar_reintento (pausa) ─┬─ reintentar → redactar | programar
 *                                                            └─ descartar → rechazado
 *
 * Presupuesto de reintentos: el rechazo automatico gasta MAILING_GRAPH_MAX_AUTO_RETRIES
 * y el humano (aprobador o consultor) MAILING_GRAPH_MAX_HUMAN_RETRIES, por separado:
 * un email que agoto los automaticos todavia puede rehacerse si una persona lo pide.
 *
 * LangGraph solo ordena. Presupuesto, breaker, validacion de salida, permisos y
 * aprobacion siguen en los runners que llegan por `deps`; los tests pasan dobles.
 * Las pausas no deciden nada: al reanudar, el nodo relee la decision de su
 * tabla (marketing_content_drafts / revision del consultor).
 */
import {
  Annotation,
  Command,
  END,
  Send,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import {
  MAILING_GRAPH_MAX_AUTO_RETRIES,
  MAILING_GRAPH_MAX_HUMAN_RETRIES,
  type MailingApproverRole,
  type MailingFailureDecision,
  type MailingEmailState,
  type MailingInterrupt,
  type MailingRejection,
} from "@e-nora/contracts";
import type { MailingReviewDraft, MailingReviewResult } from "./mailing-campaign-review.js";

export type MailingDraftDecision =
  | { status: "pending_approval" }
  | {
      status: "approved" | "rejected";
      decidedBy: string | null;
      role: MailingApproverRole | null;
      /** owner, manager... de quien decidio en esta organizacion; null para staff sin membresia. */
      membershipRole?: string | null;
      reason: string | null;
    };

export type MailingConsultantReview =
  | null
  | { decision: "approved" | "rejected"; reviewedBy: string | null; reason: string | null };

export type MailingGraphDeps = {
  /** A11. Idempotente por (campaña, email, intento). */
  draft(email: MailingEmailState, feedback: readonly string[]): Promise<
    { ok: true; draftId: string; content: MailingReviewDraft } | { ok: false; error: string }
  >;
  /** Revision automatica determinista. */
  review(content: MailingReviewDraft): MailingReviewResult;
  readDecision(draftId: string): Promise<MailingDraftDecision>;
  readConsultantReview(sequenceNumber: number): Promise<MailingConsultantReview>;
  /** Decision de una persona sobre un email fallido; null mientras no la haya. */
  readFailureDecision(sequenceNumber: number): Promise<MailingFailureDecision | null>;
  /** programar(email): hoy fija scheduled_for; nunca escribe en Klaviyo. */
  schedule(email: MailingEmailState): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Proyeccion visible del email. Si falla, el nodo falla (el checkpoint guarda lo anterior). */
  project(email: MailingEmailState): Promise<void>;
  /** agent_run_steps del borrador rechazado, con su motivo. */
  recordRetry(email: MailingEmailState, rejection: MailingRejection): Promise<void>;
  closeCampaign(results: readonly MailingEmailState[]): Promise<void>;
  now?: () => Date;
};

/** Prefijo de last_error que distingue un fallo al programar de uno al redactar. */
export const SCHEDULE_ERROR_PREFIX = "programar: ";

const last = <T>() => Annotation<T>({ reducer: (_current: T, next: T) => next, default: () => undefined as T });

const EmailGraphState = Annotation.Root({
  email: last<MailingEmailState>(),
  requires_consultant_review: last<boolean>(),
  feedback: last<string[]>(),
  content: last<MailingReviewDraft | null>(),
});
type EmailGraphValue = typeof EmailGraphState.State;

const CampaignGraphState = Annotation.Root({
  sequence_id: last<string>(),
  organization_id: last<string>(),
  store_id: last<string | null>(),
  requires_consultant_review: last<boolean>(),
  emails: last<MailingEmailState[]>(),
  results: Annotation<MailingEmailState[]>({
    reducer: (current, next) => {
      const merged = new Map(current.map((email) => [email.sequence_number, email]));
      for (const email of next) merged.set(email.sequence_number, email);
      return [...merged.values()].sort((a, b) => a.sequence_number - b.sequence_number);
    },
    default: () => [],
  }),
  closed: last<boolean>(),
});
export type MailingCampaignGraphInput = {
  sequence_id: string;
  organization_id: string;
  store_id: string | null;
  requires_consultant_review: boolean;
  emails: MailingEmailState[];
};

function buildEmailGraph(deps: MailingGraphDeps) {
  const now = () => (deps.now?.() ?? new Date()).toISOString();

  /** Rechazo (automatico o humano): vuelve a redactar si queda intento. */
  async function reject(
    email: MailingEmailState,
    source: MailingRejection["source"],
    reasons: string[],
    exhausted: "awaiting_approval" | "rejected",
  ) {
    const rejection: MailingRejection = { attempt: email.attempt, source, reasons, at: now() };
    const spentAuto = email.rejections.filter((item) => item.source === "auto_review").length;
    const spentHuman = email.rejections.length - spentAuto;
    const rejections = [...email.rejections, rejection];
    const hasRetryLeft = source === "auto_review"
      ? spentAuto < MAILING_GRAPH_MAX_AUTO_RETRIES
      : spentHuman < MAILING_GRAPH_MAX_HUMAN_RETRIES;
    if (hasRetryLeft) {
      await deps.recordRetry(email, rejection);
      const next: MailingEmailState = {
        ...email,
        rejections,
        attempt: email.attempt + 1,
        status: "queued",
        draft_id: null,
        auto_review_passed: null,
        decided_by: null,
        decided_role: null,
        decided_membership_role: null,
      };
      await deps.project(next);
      return new Command({ goto: "redactar", update: { email: next, feedback: reasons, content: null } });
    }
    // Tope: el fallo automatico pasa a una persona; el rechazo humano cierra.
    const next: MailingEmailState = { ...email, rejections, status: exhausted };
    await deps.project(next);
    return new Command({
      goto: exhausted === "awaiting_approval" ? "esperar_aprobacion" : END,
      update: { email: next, content: null },
    });
  }

  return new StateGraph(EmailGraphState)
    .addNode("redactar", async (state: EmailGraphValue) => {
      const drafting: MailingEmailState = { ...state.email, status: "drafting", last_error: null };
      await deps.project(drafting);
      let result: Awaited<ReturnType<MailingGraphDeps["draft"]>>;
      try {
        result = await deps.draft(drafting, state.feedback ?? []);
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : "draft_failed" };
      }
      if (!result.ok) {
        const failed: MailingEmailState = { ...drafting, status: "failed", last_error: result.error.slice(0, 500) };
        await deps.project(failed);
        return new Command({ goto: "esperar_reintento", update: { email: failed } });
      }
      const reviewing: MailingEmailState = { ...drafting, status: "reviewing", draft_id: result.draftId };
      await deps.project(reviewing);
      return new Command({ goto: "revisar", update: { email: reviewing, content: result.content } });
    }, { ends: ["revisar", "esperar_reintento"] })
    .addNode("revisar", async (state: EmailGraphValue) => {
      const verdict = deps.review(state.content ?? { subject: null, html: null, plain_text: null });
      if (verdict.passed) {
        const next: MailingEmailState = { ...state.email, auto_review_passed: true, status: "awaiting_approval" };
        await deps.project(next);
        return new Command({ goto: "esperar_aprobacion", update: { email: next, content: null } });
      }
      return reject({ ...state.email, auto_review_passed: false }, "auto_review", verdict.reasons, "awaiting_approval");
    }, { ends: ["redactar", "esperar_aprobacion"] })
    .addNode("esperar_aprobacion", async (state: EmailGraphValue) => {
      const draftId = state.email.draft_id!;
      interrupt<MailingInterrupt>({ kind: "approval", sequence_number: state.email.sequence_number, draft_id: draftId });
      const decision = await deps.readDecision(draftId);
      if (decision.status === "pending_approval") {
        // Aviso sin decision registrada (o duplicado): se vuelve a esperar.
        return new Command({ goto: "esperar_aprobacion" });
      }
      const decided: MailingEmailState = {
        ...state.email,
        decided_by: decision.decidedBy,
        decided_role: decision.role,
        decided_membership_role: decision.membershipRole ?? null,
      };
      if (decision.status === "rejected") {
        return reject(decided, "human", [decision.reason?.trim() || "Rechazado sin motivo escrito."], "rejected");
      }
      if (decision.role === "client" && state.requires_consultant_review) {
        const next: MailingEmailState = { ...decided, status: "awaiting_consultant_review" };
        await deps.project(next);
        return new Command({ goto: "esperar_revision", update: { email: next } });
      }
      const next: MailingEmailState = { ...decided, status: "approved" };
      await deps.project(next);
      return new Command({ goto: "programar", update: { email: next } });
    }, { ends: ["esperar_aprobacion", "esperar_revision", "programar", "redactar", END] })
    .addNode("esperar_revision", async (state: EmailGraphValue) => {
      interrupt<MailingInterrupt>({
        kind: "consultant_review",
        sequence_number: state.email.sequence_number,
        draft_id: state.email.draft_id!,
      });
      const review = await deps.readConsultantReview(state.email.sequence_number);
      if (!review) return new Command({ goto: "esperar_revision" });
      if (review.decision === "rejected") {
        return reject(state.email, "consultant_review", [review.reason?.trim() || "El consultor pidió cambios sin motivo escrito."], "rejected");
      }
      const next: MailingEmailState = { ...state.email, status: "approved", decided_by: review.reviewedBy, decided_role: "consultant" };
      await deps.project(next);
      return new Command({ goto: "programar", update: { email: next } });
    }, { ends: ["esperar_revision", "programar", "redactar", END] })
    .addNode("programar", async (state: EmailGraphValue) => {
      // Escritura: sin reintento automatico (ADR-0019). Un fallo queda visible
      // y espera a que una persona decida reintentar o descartar.
      let result: Awaited<ReturnType<MailingGraphDeps["schedule"]>>;
      try {
        result = await deps.schedule(state.email);
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : "schedule_failed" };
      }
      if (!result.ok) {
        const failed: MailingEmailState = {
          ...state.email,
          status: "failed",
          last_error: `${SCHEDULE_ERROR_PREFIX}${result.error}`.slice(0, 500),
        };
        await deps.project(failed);
        return new Command({ goto: "esperar_reintento", update: { email: failed } });
      }
      const next: MailingEmailState = { ...state.email, status: "scheduled" };
      await deps.project(next);
      return new Command({ goto: END, update: { email: next } });
    }, { ends: ["esperar_reintento", END] })
    .addNode("esperar_reintento", async (state: EmailGraphValue) => {
      interrupt<MailingInterrupt>({
        kind: "retry",
        sequence_number: state.email.sequence_number,
        draft_id: state.email.draft_id,
      });
      const decision = await deps.readFailureDecision(state.email.sequence_number);
      if (!decision) return new Command({ goto: "esperar_reintento" });
      if (decision === "discard") {
        const next: MailingEmailState = { ...state.email, status: "rejected", last_error: "Descartado por una persona tras el fallo." };
        await deps.project(next);
        return new Command({ goto: END, update: { email: next } });
      }
      // Si fallo al programar, el borrador ya esta aprobado: solo se reintenta ese paso.
      if (state.email.draft_id && state.email.last_error?.startsWith(SCHEDULE_ERROR_PREFIX)) {
        const next: MailingEmailState = { ...state.email, status: "approved", last_error: null };
        await deps.project(next);
        return new Command({ goto: "programar", update: { email: next } });
      }
      const next: MailingEmailState = { ...state.email, status: "queued", last_error: null };
      await deps.project(next);
      return new Command({ goto: "redactar", update: { email: next } });
    }, { ends: ["esperar_reintento", "programar", "redactar", END] })
    .addEdge(START, "redactar")
    .compile();
}

export function buildMailingCampaignGraph(deps: MailingGraphDeps, checkpointer: BaseCheckpointSaver) {
  const emailGraph = buildEmailGraph(deps);
  return new StateGraph(CampaignGraphState)
    .addNode("preparar", async (state: typeof CampaignGraphState.State) => {
      for (const email of state.emails) await deps.project(email);
      return {};
    })
    .addNode("email", async (input: { email: MailingEmailState; requires_consultant_review: boolean }, config) => {
      const final = await emailGraph.invoke(
        { email: input.email, requires_consultant_review: input.requires_consultant_review, feedback: [], content: null },
        config,
      );
      return { results: [final.email] };
    })
    .addNode("cerrar", async (state: typeof CampaignGraphState.State) => {
      await deps.closeCampaign(state.results);
      return { closed: true };
    })
    .addEdge(START, "preparar")
    .addConditionalEdges(
      "preparar",
      (state: typeof CampaignGraphState.State) =>
        state.emails.map((email) => new Send("email", { email, requires_consultant_review: state.requires_consultant_review })),
      ["email"],
    )
    .addEdge("email", "cerrar")
    .addEdge("cerrar", END)
    .compile({ checkpointer });
}

export type MailingCampaignGraph = ReturnType<typeof buildMailingCampaignGraph>;

/**
 * Pausas abiertas del hilo, con el id que LangGraph necesita para reanudar cada una.
 * Mientras el superpaso no termina, getState sigue listando la pausa de un email
 * ya reanudado y terminado: se descartan las tareas que ya tienen escrituras
 * propias (no especiales) en el checkpoint.
 */
export async function listMailingInterrupts(graph: MailingCampaignGraph, threadId: string) {
  const config = { configurable: { thread_id: threadId } };
  const [snapshot, tuple] = await Promise.all([graph.getState(config), (graph.checkpointer as BaseCheckpointSaver).getTuple(config)]);
  const finished = new Set(
    (tuple?.pendingWrites ?? []).filter(([, channel]: [string, string, unknown]) => !channel.startsWith("__")).map(([taskId]) => taskId),
  );
  return snapshot.tasks.filter((task) => !finished.has(task.id)).flatMap((task) =>
    (task.interrupts ?? []).map((item) => ({ id: item.id as string, value: item.value as MailingInterrupt })),
  );
}
