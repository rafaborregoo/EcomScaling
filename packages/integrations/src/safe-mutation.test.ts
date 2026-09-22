import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSafeMutation,
  executeSafeMutation,
  type SafeMutationOperations,
  type SafeMutationRequest,
} from "./safe-mutation.js";

const target = {
  organizationId: "org-1",
  provider: "shopify" as const,
  accountId: "tienda.myshopify.com",
  objectType: "product",
  objectId: "gid://shopify/Product/1",
  environment: "PRODUCTION" as const,
};

function request(overrides: Partial<SafeMutationRequest> = {}): SafeMutationRequest {
  return {
    target,
    approvedTarget: target,
    idempotencyKey: "key-1",
    fields: { title: "Nuevo titulo" },
    allowedFields: ["title"],
    envelopeZone: "INSIDE",
    remainingAuthority: true,
    expectedCurrentState: { title: "Titulo viejo" },
    observedCurrentState: { title: "Titulo viejo" },
    retrySafe: true,
    attempt: 1,
    maxAttempts: 3,
    previousEvidence: null,
    freezeWindowActive: false,
    unresolvedDependencies: [],
    ...overrides,
  };
}

const approval = { approved: true as const, approvedBy: "rafa" };

function operations(overrides: Partial<SafeMutationOperations> = {}): SafeMutationOperations {
  return {
    capturePreState: async () => ({ title: "Titulo viejo" }),
    commit: async () => ({ externalId: "ext-1" }),
    readAfterWrite: async () => ({ title: "Nuevo titulo" }),
    ...overrides,
  };
}

test("el camino feliz commitea solo los campos que cambian", () => {
  const plan = evaluateSafeMutation(request());
  assert.equal(plan.decision, "COMMIT");
  assert.deepEqual(plan.effectiveFields, { title: "Nuevo titulo" });
  assert.equal(plan.committed, false);
});

test("un objetivo distinto del aprobado bloquea la escritura", () => {
  const plan = evaluateSafeMutation(
    request({ target: { ...target, objectId: "gid://shopify/Product/999" } }),
  );
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("target_mismatch"));
});

test("un entorno desconocido bloquea la escritura", () => {
  const plan = evaluateSafeMutation(
    request({
      target: { ...target, environment: "UNKNOWN" },
      approvedTarget: { ...target, environment: "UNKNOWN" },
    }),
  );
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("environment_unknown"));
});

test("fuera del envelope no se commitea", () => {
  for (const envelopeZone of ["OUTSIDE", "FORBIDDEN"] as const) {
    const plan = evaluateSafeMutation(request({ envelopeZone }));
    assert.equal(plan.decision, "BLOCKED");
    assert.ok(plan.blockers.includes("envelope_outside"));
  }
});

test("sin autoridad restante no se commitea", () => {
  const plan = evaluateSafeMutation(request({ remainingAuthority: false }));
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("authority_exhausted"));
});

test("un campo fuera del envelope se rechaza entero, no se recorta en silencio", () => {
  const plan = evaluateSafeMutation(
    request({ fields: { title: "Nuevo titulo", price: 10 }, allowedFields: ["title"] }),
  );
  assert.equal(plan.decision, "BLOCKED");
  assert.deepEqual(plan.refusedFields, ["price"]);
});

test("la deriva de estado no se fuerza: se pide reconstruir el plan", () => {
  const plan = evaluateSafeMutation(
    request({ observedCurrentState: { title: "Lo cambio alguien a mano" } }),
  );
  assert.equal(plan.decision, "DRIFT");
  assert.deepEqual(plan.driftedKeys, ["title"]);
  assert.deepEqual(plan.effectiveFields, {});
});

test("si el estado deseado ya se cumple, no hay mutacion", () => {
  const plan = evaluateSafeMutation(
    request({
      fields: { title: "Titulo viejo" },
      expectedCurrentState: { title: "Titulo viejo" },
      observedCurrentState: { title: "Titulo viejo" },
    }),
  );
  assert.equal(plan.decision, "NO_OP");
  assert.deepEqual(plan.noOpFields, ["title"]);
});

test("una clave ya aplicada no se reenvia", () => {
  const plan = evaluateSafeMutation(
    request({
      previousEvidence: { idempotencyKey: "key-1", outcome: "APPLIED", externalId: "ext-1" },
    }),
  );
  assert.equal(plan.decision, "DUPLICATE");
});

test("una clave que quedo en UNKNOWN tampoco se reenvia", () => {
  const plan = evaluateSafeMutation(
    request({
      previousEvidence: { idempotencyKey: "key-1", outcome: "UNKNOWN", externalId: null },
    }),
  );
  assert.equal(plan.decision, "DUPLICATE");
});

test("un reintento de accion no retry-safe se bloquea", () => {
  const plan = evaluateSafeMutation(request({ attempt: 2, retrySafe: false }));
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("retry_not_safe"));
});

test("el presupuesto de reintentos es finito", () => {
  const plan = evaluateSafeMutation(request({ attempt: 4, maxAttempts: 3 }));
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("retry_budget_exhausted"));
});

test("una ventana de congelacion bloquea la escritura", () => {
  const plan = evaluateSafeMutation(request({ freezeWindowActive: true }));
  assert.equal(plan.decision, "BLOCKED");
  assert.ok(plan.blockers.includes("freeze_window"));
});

test("sin aprobacion humana no se llama al proveedor", async () => {
  let called = false;
  const report = await executeSafeMutation(request(), null, operations({
    commit: async () => {
      called = true;
      return { externalId: "ext-1" };
    },
  }));
  assert.equal(report.outcome, "REFUSED");
  assert.equal(called, false);
});

test("una aprobacion sin actor no basta", async () => {
  const report = await executeSafeMutation(
    request(),
    { approved: true, approvedBy: "  " },
    operations(),
  );
  assert.equal(report.outcome, "REFUSED");
});

test("el runner no commitea nada que el gate no haya aprobado", async () => {
  let called = false;
  const report = await executeSafeMutation(
    request({ envelopeZone: "FORBIDDEN" }),
    approval,
    operations({
      commit: async () => {
        called = true;
        return { externalId: "ext-1" };
      },
    }),
  );
  assert.equal(report.outcome, "REFUSED");
  assert.equal(report.decision, "BLOCKED");
  assert.equal(called, false);
});

test("el camino feliz aplica y verifica leyendo despues de escribir", async () => {
  const seen: string[] = [];
  const report = await executeSafeMutation(request(), approval, {
    capturePreState: async () => {
      seen.push("pre");
      return { title: "Titulo viejo" };
    },
    commit: async (fields, context) => {
      seen.push("commit");
      assert.deepEqual(fields, { title: "Nuevo titulo" });
      assert.equal(context.idempotencyKey, "key-1");
      return { externalId: "ext-1" };
    },
    readAfterWrite: async () => {
      seen.push("post");
      return { title: "Nuevo titulo" };
    },
  });
  assert.equal(report.outcome, "APPLIED");
  assert.deepEqual(seen, ["pre", "commit", "post"]);
  assert.deepEqual(report.preState, { title: "Titulo viejo" });
});

test("si el read-after-write no confirma el cambio, no es exito", async () => {
  const report = await executeSafeMutation(
    request(),
    approval,
    operations({ readAfterWrite: async () => ({ title: "Otra cosa" }) }),
  );
  assert.equal(report.outcome, "DEVIATED");
  assert.deepEqual(report.deviatedFields, ["title"]);
  assert.equal(report.retryAdvised, false);
});

test("un error de red con el cambio ya aplicado se reporta como aplicado, no se reintenta", async () => {
  const report = await executeSafeMutation(
    request(),
    approval,
    operations({
      commit: async () => {
        throw new Error("socket hang up");
      },
      readAfterWrite: async () => ({ title: "Nuevo titulo" }),
    }),
  );
  assert.equal(report.outcome, "APPLIED");
  assert.equal(report.retryAdvised, false);
});

test("un resultado ambiguo es UNKNOWN y nunca aconseja reintentar", async () => {
  const report = await executeSafeMutation(
    request(),
    approval,
    operations({
      commit: async () => {
        throw new Error("timeout");
      },
      readAfterWrite: async () => {
        throw new Error("no se puede leer");
      },
    }),
  );
  assert.equal(report.outcome, "UNKNOWN");
  assert.equal(report.retryAdvised, false);
});

test("un fallo limpio si permite reintentar dentro del presupuesto", async () => {
  const report = await executeSafeMutation(
    request(),
    approval,
    operations({
      commit: async () => {
        throw new Error("422 invalid");
      },
      readAfterWrite: async () => ({ title: "Titulo viejo" }),
    }),
  );
  assert.equal(report.outcome, "FAILED");
  assert.equal(report.retryAdvised, true);
});
