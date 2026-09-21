import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeChatUiActions } from "./copilot-ui-actions.js";

test("el backend conserva acciones de UI que existen en el catalogo compartido", () => {
  const actions = sanitizeChatUiActions([
    {
      kind: "open_insight",
      insight_slug: "continuous-learning",
      label: "Ver evidencia",
      reason: "Revisar el gate de evidencia.",
    },
    {
      kind: "open_insight",
      insight_slug: "inventado-por-el-modelo",
      label: "Abrir card",
      reason: "No debe navegar.",
    },
  ]);

  assert.deepEqual(actions, [
    {
      kind: "open_insight",
      insight_slug: "continuous-learning",
      label: "Ver evidencia",
      reason: "Revisar el gate de evidencia.",
    },
  ]);
});

test("el backend limita acciones y elimina duplicados por destino", () => {
  const actions = sanitizeChatUiActions([
    { kind: "open_insight", insight_slug: "continuous-learning", label: "Ver evidencia", reason: "uno" },
    { kind: "open_insight", insight_slug: "continuous-learning", label: "Abrir card", reason: "dos" },
    { kind: "open_insight", insight_slug: "readiness", label: "Revisar datos faltantes", reason: "tres" },
    { kind: "open_insight", insight_slug: "action-envelope", label: "Abrir card", reason: "cuatro" },
    { kind: "open_insight", insight_slug: "closure-handoff", label: "Abrir card", reason: "cinco" },
  ]);

  assert.deepEqual(actions.map((action) => action.insight_slug), [
    "continuous-learning",
    "readiness",
    "action-envelope",
  ]);
});
