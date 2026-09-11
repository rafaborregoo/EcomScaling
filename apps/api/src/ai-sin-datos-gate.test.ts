import assert from "node:assert/strict";
import test from "node:test";
import { organizationHasIngestedData } from "./ai-runtime.js";

// Una cuenta recien creada veia "organization_provider_circuit_open" en las
// tres tarjetas de IA: los agentes se lanzaban sin nada que analizar.
test("organizacion nueva: sin conexiones no se ejecuta nada", () => {
  assert.equal(organizationHasIngestedData([]), false);
});

test("conectada pero sin sincronizar todavia: tampoco", () => {
  assert.equal(
    organizationHasIngestedData([{ status: "connected", last_sync_at: null }]),
    false,
  );
});

test("conexion a medias o rota no cuenta como datos", () => {
  assert.equal(
    organizationHasIngestedData([
      { status: "pending", last_sync_at: null },
      { status: "error", last_sync_at: "2026-09-11T06:00:00Z" },
      { status: "pending_deletion", last_sync_at: "2026-09-11T06:00:00Z" },
    ]),
    false,
  );
});

test("una sola conexion viva ya sincronizada basta", () => {
  assert.equal(
    organizationHasIngestedData([
      { status: "pending", last_sync_at: null },
      { status: "connected", last_sync_at: "2026-09-11T06:59:38Z" },
    ]),
    true,
  );
});
