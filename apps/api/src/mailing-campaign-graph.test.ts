import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "@langchain/langgraph";
import type { MailingEmailState, MailingFailureDecision, MailingRejection } from "@e-nora/contracts";
import {
  buildMailingCampaignGraph,
  listMailingInterrupts,
  type MailingConsultantReview,
  type MailingDraftDecision,
  type MailingGraphDeps,
} from "./mailing-campaign-graph.js";
import {
  MailingCampaignCheckpointSaver,
  createMemoryCheckpointStore,
  createSupabaseCheckpointStore,
} from "./mailing-campaign-checkpointer.js";
import { reviewMailingDraft } from "./mailing-campaign-review.js";

const SEQ = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const STORE = "33333333-3333-4333-8333-333333333333";
const draftIdFor = (n: number, attempt: number) => `00000000-0000-4000-8000-0000000${n}000${attempt}`.slice(0, 36);

const GOOD = { subject: "Vuelve tu favorito", preheader: "Tu pedido te espera", html: '<a href="https://tienda.es/p">Comprar</a>', plain_text: "Comprar" };
const BAD = { subject: "x".repeat(80), preheader: "Tu pedido te espera", html: '<a href="#">Comprar</a>', plain_text: "" };

function email(n: number): MailingEmailState {
  return {
    sequence_number: n,
    title: `Email ${n}`,
    scheduled_for: `2026-10-1${n}T07:00:00.000Z`,
    brief: `brief ${n}`,
    image_url: null,
    status: "queued",
    attempt: 0,
    draft_id: null,
    auto_review_passed: null,
    rejections: [],
    last_error: null,
    decided_by: null,
    decided_role: null,
  };
}

function harness(options: {
  badDrafts?: (n: number, attempt: number) => boolean;
  /** call = veces que se ha llamado a A11 para ese email, empezando en 1. */
  failDraft?: (n: number, call: number) => boolean;
  failScheduleOnce?: (n: number) => boolean;
  crashProjectOnce?: (email: MailingEmailState) => boolean;
} = {}) {
  const drafts: Array<{ n: number; attempt: number; feedback: readonly string[] }> = [];
  const scheduled: number[] = [];
  const retries: Array<{ n: number; rejection: MailingRejection }> = [];
  const projection = new Map<number, MailingEmailState>();
  const decisions = new Map<string, MailingDraftDecision>();
  const reviews = new Map<number, MailingConsultantReview>();
  const failures = new Map<number, MailingFailureDecision>();
  const draftCalls = new Map<number, number>();
  let scheduleFailed = false;
  let closed: MailingEmailState[] | null = null;
  let crashed = false;
  const deps: MailingGraphDeps = {
    async draft(item, feedback) {
      drafts.push({ n: item.sequence_number, attempt: item.attempt, feedback });
      const call = (draftCalls.get(item.sequence_number) ?? 0) + 1;
      draftCalls.set(item.sequence_number, call);
      if (options.failDraft?.(item.sequence_number, call)) return { ok: false, error: "budget_exceeded" };
      const id = draftIdFor(item.sequence_number, item.attempt);
      if (!decisions.has(id)) decisions.set(id, { status: "pending_approval" });
      return { ok: true, draftId: id, content: options.badDrafts?.(item.sequence_number, item.attempt) ? BAD : GOOD };
    },
    review: reviewMailingDraft,
    async readDecision(draftId) {
      return decisions.get(draftId) ?? { status: "pending_approval" };
    },
    async readConsultantReview(n) {
      return reviews.get(n) ?? null;
    },
    async readFailureDecision(n) {
      return failures.get(n) ?? null;
    },
    async schedule(item) {
      if (!scheduleFailed && options.failScheduleOnce?.(item.sequence_number)) {
        scheduleFailed = true;
        return { ok: false, error: "klaviyo_down" };
      }
      scheduled.push(item.sequence_number);
      return { ok: true };
    },
    async project(item) {
      if (!crashed && options.crashProjectOnce?.(item)) {
        crashed = true;
        throw new Error("process_killed");
      }
      projection.set(item.sequence_number, item);
    },
    async recordRetry(item, rejection) {
      retries.push({ n: item.sequence_number, rejection });
    },
    async closeCampaign(results) {
      closed = [...results];
    },
    now: () => new Date("2026-10-08T10:00:00.000Z"),
  };
  const store = createMemoryCheckpointStore();
  const build = () =>
    buildMailingCampaignGraph(deps, new MailingCampaignCheckpointSaver(store, { organizationId: ORG, storeId: STORE, sequenceId: SEQ }));
  const config = { configurable: { thread_id: SEQ }, maxConcurrency: 3 };
  const input = (n = 3, requiresConsultantReview = false) => ({
    sequence_id: SEQ,
    organization_id: ORG,
    store_id: STORE,
    requires_consultant_review: requiresConsultantReview,
    emails: Array.from({ length: n }, (_, index) => email(index + 1)),
  });
  /** Simula la decision humana en su tabla y avisa al grafo, como hace la API. */
  async function decide(graph: ReturnType<typeof build>, n: number, decision: MailingDraftDecision, kind: "approval" | "consultant_review" = "approval") {
    const pending = (await listMailingInterrupts(graph, SEQ)).find((item) => item.value.sequence_number === n && item.value.kind === kind);
    if (!pending) return null;
    if (kind === "approval") decisions.set(pending.value.draft_id!, decision);
    return graph.invoke(new Command({ resume: { [pending.id]: { sequence_number: n } } }), config);
  }
  /** Una persona reintenta o descarta un email fallido, y se avisa al grafo como hace la API. */
  async function decideFailure(graph: ReturnType<typeof build>, n: number, decision: MailingFailureDecision) {
    const pending = (await listMailingInterrupts(graph, SEQ)).find((item) => item.value.sequence_number === n && item.value.kind === "retry");
    if (!pending) return null;
    failures.set(n, decision);
    const result = await graph.invoke(new Command({ resume: { [pending.id]: { sequence_number: n } } }), config);
    failures.delete(n); // la proyeccion real lo limpia al salir de "failed"
    return result;
  }
  return { deps, build, config, input, decide, decideFailure, failures, drafts, scheduled, retries, projection, decisions, reviews, store, closed: () => closed };
}

const approve = (role: "consultant" | "client" = "consultant"): MailingDraftDecision =>
  ({ status: "approved", decidedBy: "44444444-4444-4444-8444-444444444444", role, reason: null });

test("camino feliz: N emails en paralelo, pausa por email y cierre tras la union", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  assert.equal(h.drafts.length, 3);
  assert.deepEqual([...h.projection.values()].map((item) => item.status), ["awaiting_approval", "awaiting_approval", "awaiting_approval"]);
  assert.equal(h.scheduled.length, 0, "nada se programa sin decision humana");
  assert.equal(h.closed(), null);
  for (const n of [1, 2, 3]) await h.decide(graph, n, approve());
  assert.deepEqual(h.scheduled.sort(), [1, 2, 3]);
  assert.deepEqual(h.closed()?.map((item) => item.status), ["scheduled", "scheduled", "scheduled"]);
});

test("rechazo de la revision automatica: vuelve a A11 con el motivo y registra el reintento", async () => {
  const h = harness({ badDrafts: (n, attempt) => n === 2 && attempt === 0 });
  await h.build().invoke(h.input(), h.config);
  const second = h.drafts.filter((item) => item.n === 2);
  assert.equal(second.length, 2);
  assert.ok(second[1]!.feedback.some((reason) => reason.includes("asunto")));
  assert.equal(h.retries.length, 1);
  assert.equal(h.retries[0]!.rejection.source, "auto_review");
  assert.equal(h.projection.get(2)?.attempt, 1);
  assert.equal(h.projection.get(2)?.status, "awaiting_approval");
  assert.equal(h.projection.get(2)?.auto_review_passed, true);
});

test("tope de reintentos: tras 2 reintentos el email pasa a revision humana marcado", async () => {
  const h = harness({ badDrafts: (n) => n === 1 });
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  assert.equal(h.drafts.filter((item) => item.n === 1).length, 3, "1 + 2 reintentos, ni uno mas");
  assert.equal(h.retries.length, 2);
  const first = h.projection.get(1)!;
  assert.equal(first.status, "awaiting_approval");
  assert.equal(first.auto_review_passed, false);
  assert.equal(first.rejections.length, 3);
  await h.decide(graph, 1, approve());
  assert.ok(h.scheduled.includes(1));
});

test("un email que falla no tumba a los demas ni cierra la campaña: espera a una persona", async () => {
  const h = harness({ failDraft: (n) => n === 2 });
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  assert.equal(h.projection.get(2)?.status, "failed");
  assert.equal(h.projection.get(2)?.last_error, "budget_exceeded");
  assert.equal(h.projection.get(1)?.status, "awaiting_approval");
  await h.decide(graph, 1, approve());
  await h.decide(graph, 3, approve());
  assert.equal(h.closed(), null, "con un email fallido sin decidir la campaña sigue abierta");
  assert.ok((await listMailingInterrupts(graph, SEQ)).some((item) => item.value.kind === "retry" && item.value.draft_id === null));
});

test("email fallido: reintentar vuelve a A11 (error pasajero) y la campaña cierra completa", async () => {
  const h = harness({ failDraft: (n, call) => n === 2 && call === 1 });
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  assert.equal(h.projection.get(2)?.status, "failed");
  await h.decideFailure(graph, 2, "retry");
  assert.equal(h.projection.get(2)?.status, "awaiting_approval");
  assert.equal(h.projection.get(2)?.last_error, null);
  assert.equal(h.drafts.filter((item) => item.n === 2).length, 2);
  for (const n of [1, 2, 3]) await h.decide(graph, n, approve());
  assert.deepEqual(h.closed()?.map((item) => item.status), ["scheduled", "scheduled", "scheduled"]);
});

test("email fallido: descartar lo da por rechazado y deja cerrar la campaña", async () => {
  const h = harness({ failDraft: (n) => n === 2 });
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  await h.decideFailure(graph, 2, "discard");
  assert.equal(h.projection.get(2)?.status, "rejected");
  await h.decide(graph, 1, approve());
  await h.decide(graph, 3, approve());
  assert.deepEqual(h.closed()?.map((item) => item.status), ["scheduled", "rejected", "scheduled"]);
});

test("fallo al programar: reintentar solo repite ese paso, no vuelve a redactar", async () => {
  const h = harness({ failScheduleOnce: (n) => n === 1 });
  const graph = h.build();
  await graph.invoke(h.input(1), h.config);
  await h.decide(graph, 1, approve());
  assert.equal(h.projection.get(1)?.status, "failed");
  assert.ok(h.projection.get(1)?.last_error?.startsWith("programar: "));
  assert.equal(h.closed(), null);
  await h.decideFailure(graph, 1, "retry");
  assert.deepEqual(h.scheduled, [1]);
  assert.equal(h.drafts.length, 1, "no se redacta de nuevo");
  assert.equal(h.closed()?.[0]?.status, "scheduled");
});

test("reintentos: el rechazo humano tiene presupuesto propio aunque se agotaran los automaticos", async () => {
  const h = harness({ badDrafts: (n, attempt) => n === 1 && attempt <= 2 });
  const graph = h.build();
  await graph.invoke(h.input(1), h.config);
  assert.equal(h.drafts.length, 3, "1 + 2 reintentos automaticos");
  assert.equal(h.projection.get(1)?.auto_review_passed, false);
  await h.decide(graph, 1, { status: "rejected", decidedBy: null, role: "consultant", reason: "Cambia el gancho" });
  assert.equal(h.drafts.length, 4, "una persona todavia puede pedir otra version");
  assert.equal(h.projection.get(1)?.attempt, 3);
  assert.ok(h.drafts[3]!.feedback.includes("Cambia el gancho"));
  await h.decide(graph, 1, { status: "rejected", decidedBy: null, role: "consultant", reason: "Aun no" });
  assert.equal(h.drafts.length, 5);
  assert.equal(h.projection.get(1)?.attempt, 4);
  await h.decide(graph, 1, { status: "rejected", decidedBy: null, role: "consultant", reason: "Tampoco" });
  assert.equal(h.drafts.length, 5, "agotados los 2 humanos, queda rechazado");
  assert.equal(h.projection.get(1)?.status, "rejected");
});

test("al cerrar la campaña solo se conserva el ultimo checkpoint", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(2), h.config);
  assert.ok(h.store.rows.length > 2);
  for (const n of [1, 2]) await h.decide(graph, n, approve());
  assert.ok(h.closed());
  await new MailingCampaignCheckpointSaver(h.store, { organizationId: ORG, storeId: STORE, sequenceId: SEQ }).pruneKeepingLatest();
  assert.equal(h.store.rows.length, 1);
  assert.equal(h.store.rows[0]!.checkpoint_ns, "");
  assert.ok(h.store.writes.every((write) => write.checkpoint_id === h.store.rows[0]!.checkpoint_id));
  assert.equal((await graph.getState(h.config)).values.closed, true, "el estado final sigue legible");
});

test("rol de membresia del aprobador queda en la proyeccion", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(1), h.config);
  await h.decide(graph, 1, { status: "approved", decidedBy: null, role: "client", membershipRole: "owner", reason: null });
  assert.equal(h.projection.get(1)?.decided_role, "client");
  assert.equal(h.projection.get(1)?.decided_membership_role, "owner");
});

test("reanudacion tras pausa: aprobar uno no mueve a los demas ni cierra la campaña", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(), h.config);
  await h.decide(graph, 2, approve());
  assert.deepEqual(h.scheduled, [2]);
  assert.equal(h.projection.get(1)?.status, "awaiting_approval");
  assert.equal(h.closed(), null);
  assert.equal(h.drafts.length, 3, "reanudar no vuelve a redactar");
  assert.deepEqual(
    (await listMailingInterrupts(graph, SEQ)).map((item) => item.value.sequence_number).sort(),
    [1, 3],
    "la pausa del email ya terminado no sigue abierta",
  );
  // Un proceso nuevo (otro grafo, mismo almacen) sigue donde se quedo.
  const later = h.build();
  await h.decide(later, 1, approve());
  await h.decide(later, 3, approve());
  assert.deepEqual(h.scheduled.sort(), [1, 2, 3]);
  assert.ok(h.closed());
});

test("doble aprobacion y aviso sin decision: se programa una sola vez", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(1), h.config);
  const [pending] = await listMailingInterrupts(graph, SEQ);
  // Aviso sin decision registrada: sigue esperando.
  await graph.invoke(new Command({ resume: { [pending!.id]: {} } }), h.config);
  assert.equal(h.scheduled.length, 0);
  assert.equal(h.projection.get(1)?.status, "awaiting_approval");
  await h.decide(graph, 1, approve());
  // Segundo aviso de la misma aprobacion: ya no hay pausa que reanudar.
  assert.equal(await h.decide(graph, 1, approve()), null);
  await graph.invoke(new Command({ resume: { [pending!.id]: {} } }), h.config);
  assert.deepEqual(h.scheduled, [1]);
});

test("proceso interrumpido a mitad: se reanuda sin repetir lo terminado", async () => {
  const h = harness({ crashProjectOnce: (item) => item.sequence_number === 2 && item.status === "reviewing" });
  await assert.rejects(h.build().invoke(h.input(), h.config), /process_killed/);
  const restarted = h.build();
  await restarted.invoke(null, h.config);
  assert.equal(h.drafts.filter((item) => item.n === 1).length, 1);
  assert.equal(h.drafts.filter((item) => item.n === 3).length, 1);
  const second = h.drafts.filter((item) => item.n === 2);
  assert.ok(second.every((item) => item.attempt === 0), "repite con la misma clave de idempotencia");
  assert.deepEqual([...h.projection.values()].map((item) => item.status), ["awaiting_approval", "awaiting_approval", "awaiting_approval"]);
});

test("rechazo humano: vuelve a A11 con el motivo; agotado, queda rechazado", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(1), h.config);
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    await h.decide(graph, 1, { status: "rejected", decidedBy: null, role: "consultant", reason: `Tono demasiado agresivo ${attempt}` });
  }
  assert.equal(h.drafts.length, 3);
  assert.ok(h.drafts[1]!.feedback.includes("Tono demasiado agresivo 0"));
  assert.equal(h.projection.get(1)?.status, "rejected");
  assert.equal(h.scheduled.length, 0);
  assert.equal(h.closed()?.[0]?.status, "rejected");
});

test("cliente con consultor: su aprobacion espera la revision del consultor", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(1, true), h.config);
  await h.decide(graph, 1, approve("client"));
  assert.equal(h.projection.get(1)?.status, "awaiting_consultant_review");
  assert.equal(h.scheduled.length, 0);
  h.reviews.set(1, { decision: "approved", reviewedBy: "55555555-5555-4555-8555-555555555555", reason: null });
  await h.decide(graph, 1, approve(), "consultant_review");
  assert.deepEqual(h.scheduled, [1]);
  assert.equal(h.projection.get(1)?.decided_role, "consultant");
});

test("cliente sin consultor: su aprobacion basta", async () => {
  const h = harness();
  const graph = h.build();
  await graph.invoke(h.input(1, false), h.config);
  await h.decide(graph, 1, approve("client"));
  assert.deepEqual(h.scheduled, [1]);
});

test("aislamiento: el checkpointer no sirve el hilo de otra campaña", async () => {
  const saver = new MailingCampaignCheckpointSaver(createMemoryCheckpointStore(), { organizationId: ORG, storeId: STORE, sequenceId: SEQ });
  await assert.rejects(
    saver.getTuple({ configurable: { thread_id: "99999999-9999-4999-8999-999999999999" } }),
    /mailing_checkpoint_thread_out_of_scope/,
  );
});

test("aislamiento: el almacen de Supabase filtra por organizacion, tienda y campaña", async () => {
  const filters: Array<[string, unknown]> = [];
  const builder: any = {
    select: () => builder, order: () => builder, limit: () => builder, lt: () => builder, delete: () => builder,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
    is: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
    then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
  };
  const store = createSupabaseCheckpointStore({ from: () => builder } as any, { organizationId: ORG, storeId: STORE, sequenceId: SEQ });
  await store.getCheckpoint("");
  await store.getWrites("", "x");
  await store.deleteAll();
  for (const expected of [["organization_id", ORG], ["store_id", STORE], ["thread_id", SEQ]]) {
    assert.equal(filters.filter(([column, value]) => column === expected[0] && value === expected[1]).length, 4, String(expected[0]));
  }
});
