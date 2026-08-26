import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateIntegrationActivation,
  getIntegrationActivationGateKeys,
  INTEGRATION_ACTIVATION_GATE_KEYS,
  type IntegrationActivationEvidence,
} from "./index.js";

const completeEvidence: IntegrationActivationEvidence = Object.fromEntries(
  INTEGRATION_ACTIVATION_GATE_KEYS.map((key) => [key, true]),
) as IntegrationActivationEvidence;

test("Fathom webhook-only no exige gates de OAuth, asset ni sync inicial", () => {
  const capabilities = {
    oauth: false,
    webhooks: true,
    initialSync: false,
    incrementalSync: false,
    assetSelection: false,
  } as const;
  assert.deepEqual(getIntegrationActivationGateKeys(capabilities), [
    "credentialsValid",
    "providerResponseValid",
    "freshnessAvailable",
    "recoverableErrorVerified",
  ]);
  assert.deepEqual(evaluateIntegrationActivation({
    credentialsValid: true,
    providerResponseValid: true,
    freshnessAvailable: true,
    recoverableErrorVerified: true,
  }, capabilities), { ready: true, missing: [] });
});

test("Meta exige OAuth, selección de activo, sync y freshness", () => {
  const keys = getIntegrationActivationGateKeys({
    oauth: true,
    webhooks: false,
    initialSync: true,
    incrementalSync: true,
    assetSelection: true,
  });
  assert.ok(keys.includes("redirectUriExact"));
  assert.ok(keys.includes("scopesGranted"));
  assert.ok(keys.includes("assetSelected"));
  assert.ok(keys.includes("initialSyncSucceeded"));
  assert.ok(keys.includes("freshnessAvailable"));
  assert.ok(keys.includes("reauthorizationVerified"));
});

test("solo declara listo un conector cuando pasan todos los requisitos externos", () => {
  assert.deepEqual(evaluateIntegrationActivation(completeEvidence), {
    ready: true,
    missing: [],
  });
});

test("la evidencia ausente bloquea sin exponer secretos ni payloads", () => {
  const readiness = evaluateIntegrationActivation({
    credentialsValid: true,
    redirectUriExact: true,
    scopesGranted: true,
    providerResponseValid: true,
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing, [
    "assetSelected",
    "initialSyncSucceeded",
    "freshnessAvailable",
    "reauthorizationVerified",
    "recoverableErrorVerified",
  ]);
});

test("false explícito y evidencia parcial se tratan igual de forma conservadora", () => {
  const readiness = evaluateIntegrationActivation({
    ...completeEvidence,
    reauthorizationVerified: false,
  });

  assert.deepEqual(readiness, {
    ready: false,
    missing: ["reauthorizationVerified"],
  });
});
