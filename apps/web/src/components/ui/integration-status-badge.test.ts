import assert from "node:assert/strict";
import test from "node:test";
import { getIntegrationStatusPresentation } from "./integration-status.js";

test("muestra credenciales pendientes aunque exista un estado de conexión inconsistente", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "credentials_missing",
      connectionStatus: "connected",
    }),
    { label: "Credenciales pendientes", tone: "warn" },
  );
});

test("muestra un feature flag desactivado antes que cualquier conexión", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "feature_disabled",
      connectionStatus: "connected",
    }),
    { label: "Desactivado", tone: "warn" },
  );
});

test("mantiene visible que faltan credenciales sin cuenta conectada", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "credentials_missing",
      connectionStatus: null,
    }),
    { label: "Credenciales pendientes", tone: "warn" },
  );
});

test("representa una conexión real saludable", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "configured",
      connectionStatus: "connected",
      healthStatus: "healthy",
    }),
    { label: "Conectado", tone: "success" },
  );
});

test("prioriza una reautorización pendiente sobre la salud anterior", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "configured",
      connectionStatus: "revoked",
      healthStatus: "healthy",
    }),
    { label: "Reautorizar", tone: "warn" },
  );
});

test("no oculta stale o degradado bajo el estado conectado", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "configured",
      connectionStatus: "connected",
      healthStatus: "stale",
    }),
    { label: "Desactualizado", tone: "warn" },
  );
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: true,
      configurationStatus: "configured",
      connectionStatus: "connected",
      healthStatus: "reauthorization_required",
    }),
    { label: "Reautorizar", tone: "warn" },
  );
});

test("mantiene un conector futuro no disponible sin ofrecer una acción", () => {
  assert.deepEqual(
    getIntegrationStatusPresentation({
      available: false,
      configurationStatus: "not_implemented",
    }),
    { label: "No disponible todavía", tone: "neutral" },
  );
});
