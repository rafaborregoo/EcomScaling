import assert from "node:assert/strict";
import test from "node:test";
import { extractKlaviyoSubject } from "./klaviyo-sync.js";

test("resuelve el asunto en la forma reciente (definition.content.subject)", () => {
  assert.equal(
    extractKlaviyoSubject({
      definition: { content: { subject: "Rebajas de verano" } },
    }),
    "Rebajas de verano",
  );
});

test("resuelve el asunto en la forma antigua (content.subject)", () => {
  assert.equal(
    extractKlaviyoSubject({ content: { subject: "Bienvenido" } }),
    "Bienvenido",
  );
});

test("devuelve null cuando no hay asunto o la forma es desconocida", () => {
  assert.equal(extractKlaviyoSubject(null), null);
  assert.equal(extractKlaviyoSubject({ definition: { content: {} } }), null);
  assert.equal(extractKlaviyoSubject({ subject_line: "otra ruta" }), null);
  assert.equal(extractKlaviyoSubject({ content: { subject: "   " } }), null);
});
