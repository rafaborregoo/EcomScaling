import assert from "node:assert/strict";
import test from "node:test";
import { resolveProviderModel } from "./ai-runtime.js";

test("el routing por agente elige el modelo del proveedor configurado", () => {
  const routing = {
    a02_monitor_negocio: {
      anthropicModel: "claude-sonnet-custom",
      openaiModel: "gpt-4.1-mini",
    },
  };

  assert.equal(
    resolveProviderModel(
      "a02_monitor_negocio",
      "anthropic",
      "claude-default",
      routing,
    ),
    "claude-sonnet-custom",
  );
  assert.equal(
    resolveProviderModel(
      "a02_monitor_negocio",
      "openai",
      "gpt-default",
      routing,
    ),
    "gpt-4.1-mini",
  );
});

test("el routing conserva el fallback cuando no hay override del agente", () => {
  assert.equal(
    resolveProviderModel(
      "a09_copiloto_consultor",
      "anthropic",
      "claude-default",
      {
        a02_monitor_negocio: { anthropicModel: "claude-sonnet-custom" },
      },
    ),
    "claude-default",
  );
});
