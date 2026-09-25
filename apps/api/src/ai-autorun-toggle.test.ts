/**
 * Interruptor de desarrollo: con AI_AUTORUN_ENABLED=false ningun agente se
 * lanza por su cuenta. Sin el, el VPS gastaba de fondo en cada tick del cron y
 * en cada carga de pagina con la cache vencida.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAgentAutorunEnabled } from "./ai-runtime.js";
import type { LoadedApiEnv } from "@e-nora/config";

const env = (value?: "true" | "false") =>
  ({ ...(value ? { AI_AUTORUN_ENABLED: value } : {}) }) as LoadedApiEnv;

test("el autorun solo se apaga con un 'false' explicito", () => {
  assert.equal(isAgentAutorunEnabled(env("false")), false);
  assert.equal(isAgentAutorunEnabled(env("true")), true);
  // Sin la variable, todo sigue como estaba: no se apaga produccion por olvido.
  assert.equal(isAgentAutorunEnabled(env()), true);
});
