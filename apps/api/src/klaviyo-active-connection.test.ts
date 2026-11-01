import assert from "node:assert/strict";
import test from "node:test";
import { pickActiveKlaviyoConnection } from "./klaviyo.js";

test("gana la cuenta asignada a una tienda aunque otra se sincronizara después", () => {
  const rows = [{ id: "agencia" }, { id: "tienda" }]; // más reciente primero
  assert.equal(pickActiveKlaviyoConnection(rows, ["tienda"]), "tienda");
});

test("sin ninguna asignada, la más reciente", () => {
  assert.equal(pickActiveKlaviyoConnection([{ id: "a" }, { id: "b" }], []), "a");
});

test("sin cuentas, nada", () => {
  assert.equal(pickActiveKlaviyoConnection([], []), null);
});
