import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createOptionalLangSmithTraceable,
  resolveLangSmithRuntimeConfig,
} from "./langsmith-observability.js";

test("LangSmith permanece desactivado sin tracing y sin API key", async () => {
  const config = resolveLangSmithRuntimeConfig({
    LANGSMITH_TRACING: "true",
  });
  assert.equal(config.tracing, false);

  const operation = createOptionalLangSmithTraceable(
    "test-operation",
    async (input: { value: string }) => input.value,
    config,
  );
  assert.equal(await operation({ value: "ok" }), "ok");
});

test("la configuración activa conserva proyecto y entorno sin exponer secretos", () => {
  const config = resolveLangSmithRuntimeConfig({
    LANGSMITH_TRACING: "true",
    LANGSMITH_API_KEY: "ls-secret",
    LANGSMITH_PROJECT: "pilot",
    APP_ENV: "shadow",
  });
  assert.deepEqual(config, {
    tracing: true,
    project: "pilot",
    environment: "shadow",
    capturePayloads: false,
  });
});
