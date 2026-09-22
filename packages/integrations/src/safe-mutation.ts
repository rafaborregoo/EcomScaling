import type { IntegrationProvider } from "./index.js";

/**
 * F8.07 - safe execution and change control.
 *
 * Pure pre-commit gate. It decides whether an approved change may touch a
 * provider, and it is the only place that may answer COMMIT. Nothing here
 * performs I/O: the runner in `executeSafeMutation` does, and it refuses to
 * move unless this gate said COMMIT.
 */

export const safeMutationDecisions = [
  "COMMIT",
  "BLOCKED",
  "DUPLICATE",
  "DRIFT",
  "NO_OP",
] as const;
export type SafeMutationDecision = (typeof safeMutationDecisions)[number];

export const safeMutationOutcomes = [
  "APPLIED",
  "DEVIATED",
  "UNKNOWN",
  "REFUSED",
  "FAILED",
] as const;
export type SafeMutationOutcome = (typeof safeMutationOutcomes)[number];

export type SafeMutationTarget = {
  organizationId: string;
  provider: IntegrationProvider;
  accountId: string;
  objectType: string;
  objectId: string;
  environment: "UNKNOWN" | "TEST" | "STAGING" | "PRODUCTION";
};

/** Evidence that this idempotency key already reached the provider. */
export type SafeMutationEvidence = {
  idempotencyKey: string;
  outcome: SafeMutationOutcome;
  externalId: string | null;
};

export type SafeMutationRequest = {
  /** Target read from live credentials right now. */
  target: SafeMutationTarget;
  /** Target as frozen in the approved plan. Divergence is never tolerated. */
  approvedTarget: SafeMutationTarget;
  idempotencyKey: string;
  /** Fields the change wants to write. */
  fields: Record<string, unknown>;
  /** Fields the action envelope (F8.05) allows. */
  allowedFields: string[];
  envelopeZone: "INSIDE" | "INSIDE_WITH_CONDITIONS" | "OUTSIDE" | "FORBIDDEN";
  remainingAuthority: boolean;
  /** State the plan was built against. */
  expectedCurrentState: Record<string, unknown>;
  /** State read from the provider just now. */
  observedCurrentState: Record<string, unknown>;
  retrySafe: boolean;
  attempt: number;
  maxAttempts: number;
  previousEvidence: SafeMutationEvidence | null;
  freezeWindowActive: boolean;
  unresolvedDependencies: string[];
};

export type SafeMutationPlan = {
  decision: SafeMutationDecision;
  /** Minimum mutation: allowed fields whose value actually changes. */
  effectiveFields: Record<string, unknown>;
  /** Fields dropped because they already hold the desired value. */
  noOpFields: string[];
  /** Fields refused because the envelope does not cover them. */
  refusedFields: string[];
  /** Keys whose live value diverges from what the plan was built against. */
  driftedKeys: string[];
  blockers: string[];
  reasons: string[];
  /** Always false here. Committing is the runner's job, never the gate's. */
  committed: false;
};

const sameTarget = (a: SafeMutationTarget, b: SafeMutationTarget) =>
  a.organizationId === b.organizationId &&
  a.provider === b.provider &&
  a.accountId === b.accountId &&
  a.objectType === b.objectType &&
  a.objectId === b.objectId &&
  a.environment === b.environment;

const stable = (value: unknown) => JSON.stringify(value ?? null);

const nonEmpty = (value: string | undefined | null) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Pre-commit validation: target, scope, authorization, parameters,
 * dependencies, freeze window and current state (spec 8.07 section 10).
 */
export function evaluateSafeMutation(request: SafeMutationRequest): SafeMutationPlan {
  const blockers: string[] = [];
  const reasons: string[] = [];

  // 15. Duplicate prevention runs first: evidence of a previous commit for this
  // key means we must not send a second transaction, whatever else is true.
  if (request.previousEvidence && request.previousEvidence.idempotencyKey === request.idempotencyKey) {
    const previous = request.previousEvidence;
    if (previous.outcome === "APPLIED" || previous.outcome === "UNKNOWN") {
      return {
        decision: "DUPLICATE",
        effectiveFields: {},
        noOpFields: [],
        refusedFields: [],
        driftedKeys: [],
        blockers: ["duplicate_execution_evidence"],
        reasons: [
          previous.outcome === "APPLIED"
            ? "Esta clave de idempotencia ya se aplico; repetirla duplicaria la transaccion."
            : "Esta clave quedo en UNKNOWN: hay que verificar el estado real antes de reintentar, no reenviar.",
        ],
        committed: false,
      };
    }
  }

  // 6. Target verification: tenant, account, object, environment.
  if (!sameTarget(request.target, request.approvedTarget)) {
    blockers.push("target_mismatch");
    reasons.push("El objetivo vivo no coincide con el objetivo aprobado; no se escribe sobre otro objeto.");
  }
  if (!nonEmpty(request.idempotencyKey)) {
    blockers.push("idempotency_key_missing");
    reasons.push("Sin clave de idempotencia no se puede garantizar at-most-once.");
  }
  if (request.target.environment === "UNKNOWN") {
    blockers.push("environment_unknown");
    reasons.push("Entorno desconocido: no se escribe sin saber si es produccion.");
  }

  // 7. Scope revalidation immediately before the mutation.
  if (request.envelopeZone === "OUTSIDE" || request.envelopeZone === "FORBIDDEN") {
    blockers.push("envelope_outside");
    reasons.push("La accion cayo fuera del envelope vigente en la revalidacion previa al commit.");
  }
  if (!request.remainingAuthority) {
    blockers.push("authority_exhausted");
    reasons.push("La autoridad restante se agoto; hace falta nueva aprobacion.");
  }
  if (request.freezeWindowActive) {
    blockers.push("freeze_window");
    reasons.push("Hay una ventana de congelacion activa.");
  }
  if (request.unresolvedDependencies.length) {
    blockers.push("unresolved_dependencies");
    reasons.push(`Dependencias sin resolver: ${request.unresolvedDependencies.join(", ")}.`);
  }

  // 14. Retry control: bounded and conditional.
  if (request.attempt > 1 && !request.retrySafe) {
    blockers.push("retry_not_safe");
    reasons.push("La accion no es segura de reintentar y este no es el primer intento.");
  }
  if (request.attempt > request.maxAttempts) {
    blockers.push("retry_budget_exhausted");
    reasons.push("Se agoto el presupuesto de reintentos.");
  }

  // 5. Current-state read: compare against the state the plan assumed.
  const driftedKeys = Object.keys(request.expectedCurrentState).filter(
    (key) => stable(request.expectedCurrentState[key]) !== stable(request.observedCurrentState[key]),
  );

  // 2. Minimum mutation: only envelope-allowed fields that actually change.
  const refusedFields = Object.keys(request.fields).filter(
    (key) => !request.allowedFields.includes(key),
  );
  const noOpFields = Object.keys(request.fields).filter(
    (key) =>
      !refusedFields.includes(key) &&
      stable(request.fields[key]) === stable(request.observedCurrentState[key]),
  );
  const effectiveFields = Object.fromEntries(
    Object.entries(request.fields).filter(
      ([key]) => !refusedFields.includes(key) && !noOpFields.includes(key),
    ),
  );

  if (refusedFields.length) {
    blockers.push("fields_outside_envelope");
    reasons.push(`El envelope no cubre: ${refusedFields.join(", ")}.`);
  }

  if (blockers.length) {
    return {
      decision: "BLOCKED",
      effectiveFields: {},
      noOpFields,
      refusedFields,
      driftedKeys,
      blockers: [...new Set(blockers)],
      reasons,
      committed: false,
    };
  }

  // Drift is not a blocker, it is a different decision: the plan was built
  // against a state that no longer holds, so it must be rebuilt, not forced.
  if (driftedKeys.length) {
    return {
      decision: "DRIFT",
      effectiveFields: {},
      noOpFields,
      refusedFields,
      driftedKeys,
      blockers: [],
      reasons: [
        `El estado vivo cambio desde que se construyo el plan: ${driftedKeys.join(", ")}. Hay que reconstruirlo, no forzarlo.`,
      ],
      committed: false,
    };
  }

  if (!Object.keys(effectiveFields).length) {
    return {
      decision: "NO_OP",
      effectiveFields: {},
      noOpFields,
      refusedFields,
      driftedKeys,
      blockers: [],
      reasons: ["El estado deseado ya se cumple; no hay mutacion que aplicar."],
      committed: false,
    };
  }

  return {
    decision: "COMMIT",
    effectiveFields,
    noOpFields,
    refusedFields,
    driftedKeys,
    blockers: [],
    reasons: noOpFields.length
      ? [`Se omiten campos ya correctos: ${noOpFields.join(", ")}.`]
      : [],
    committed: false,
  };
}

export type SafeMutationApproval = {
  approved: true;
  approvedBy: string;
  approvalId?: string;
};

export type SafeMutationOperations = {
  /** Snapshot kept as pre-state evidence (spec 8.07 section 8). */
  capturePreState: () => Promise<Record<string, unknown>>;
  /** Applies only `effectiveFields`. Must send the idempotency key. */
  commit: (
    effectiveFields: Record<string, unknown>,
    context: { idempotencyKey: string; target: SafeMutationTarget },
  ) => Promise<{ externalId: string | null }>;
  /** Re-reads the object after the write (spec 8.07 section 12). */
  readAfterWrite: () => Promise<Record<string, unknown>>;
};

export type SafeMutationReport = {
  outcome: SafeMutationOutcome;
  decision: SafeMutationDecision;
  externalId: string | null;
  preState: Record<string, unknown> | null;
  postState: Record<string, unknown> | null;
  /** Fields that did not end up holding the value we asked for. */
  deviatedFields: string[];
  reasons: string[];
  retryAdvised: boolean;
};

/**
 * Runs an approved change end to end. Never commits unless the pure gate said
 * COMMIT and a human approval is attached.
 *
 * An ambiguous provider response is reported as UNKNOWN and never as FAILED,
 * and never advises a retry: the state has to be inspected first (spec 13).
 */
export async function executeSafeMutation(
  request: SafeMutationRequest,
  approval: SafeMutationApproval | null,
  operations: SafeMutationOperations,
): Promise<SafeMutationReport> {
  const refused = (reason: string, decision: SafeMutationDecision = "BLOCKED"): SafeMutationReport => ({
    outcome: "REFUSED",
    decision,
    externalId: null,
    preState: null,
    postState: null,
    deviatedFields: [],
    reasons: [reason],
    retryAdvised: false,
  });

  if (!approval?.approved) return refused("Falta aprobacion humana explicita para ejecutar.");
  if (!nonEmpty(approval.approvedBy)) return refused("La aprobacion no identifica a quien aprueba.");

  const plan = evaluateSafeMutation(request);
  if (plan.decision !== "COMMIT") {
    return {
      outcome: "REFUSED",
      decision: plan.decision,
      externalId: plan.decision === "DUPLICATE" ? request.previousEvidence?.externalId ?? null : null,
      preState: null,
      postState: null,
      deviatedFields: [],
      reasons: plan.reasons.length ? plan.reasons : plan.blockers,
      retryAdvised: false,
    };
  }

  const preState = await operations.capturePreState();

  let externalId: string | null = null;
  try {
    const committed = await operations.commit(plan.effectiveFields, {
      idempotencyKey: request.idempotencyKey,
      target: request.target,
    });
    externalId = committed.externalId;
  } catch (error) {
    // The provider may have applied the change before failing to answer. We do
    // not get to call this a failure until read-after-write says so.
    let postState: Record<string, unknown> | null = null;
    try {
      postState = await operations.readAfterWrite();
    } catch {
      return {
        outcome: "UNKNOWN",
        decision: "COMMIT",
        externalId: null,
        preState,
        postState: null,
        deviatedFields: [],
        reasons: [
          `La llamada fallo y el estado posterior no se pudo leer: ${error instanceof Error ? error.message : "error desconocido"}. Verificar antes de reintentar.`,
        ],
        retryAdvised: false,
      };
    }
    const applied = Object.keys(plan.effectiveFields).filter(
      (key) => stable(postState?.[key]) === stable(plan.effectiveFields[key]),
    );
    if (applied.length === Object.keys(plan.effectiveFields).length) {
      return {
        outcome: "APPLIED",
        decision: "COMMIT",
        externalId: null,
        preState,
        postState,
        deviatedFields: [],
        reasons: ["La llamada devolvio error pero el estado final es el esperado; no se reintenta."],
        retryAdvised: false,
      };
    }
    return {
      outcome: applied.length ? "UNKNOWN" : "FAILED",
      decision: "COMMIT",
      externalId: null,
      preState,
      postState,
      deviatedFields: Object.keys(plan.effectiveFields).filter((key) => !applied.includes(key)),
      reasons: [
        applied.length
          ? "La mutacion quedo parcialmente aplicada; no se reintenta sin revision."
          : `La mutacion no se aplico: ${error instanceof Error ? error.message : "error desconocido"}.`,
      ],
      retryAdvised: applied.length === 0 && request.retrySafe && request.attempt < request.maxAttempts,
    };
  }

  const postState = await operations.readAfterWrite();
  const deviatedFields = Object.keys(plan.effectiveFields).filter(
    (key) => stable(postState[key]) !== stable(plan.effectiveFields[key]),
  );

  if (deviatedFields.length) {
    return {
      outcome: "DEVIATED",
      decision: "COMMIT",
      externalId,
      preState,
      postState,
      deviatedFields,
      reasons: [
        `El estado final no coincide con el cambio pedido en: ${deviatedFields.join(", ")}. No se reintenta automaticamente.`,
      ],
      retryAdvised: false,
    };
  }

  return {
    outcome: "APPLIED",
    decision: "COMMIT",
    externalId,
    preState,
    postState,
    deviatedFields: [],
    reasons: [],
    retryAdvised: false,
  };
}
