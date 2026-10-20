import assert from "node:assert/strict";
import test from "node:test";
import { cleanOpProps, normalizeStudioOps, selectedStudioProductIds } from "./studio-ai-chat.js";

const product = { id: "p1", title: "Zapatilla", price: "89,00 €", image: "https://cdn/p1.jpg", url: "https://t/p1" };
const known = { images: new Set(["https://cdn/p1.jpg"]), products: new Map([["p1", product]]) };
const design = { blocks: [{ id: "a", type: "heading" }, { id: "b", type: "button" }] };
const op = (over: Record<string, string>) => ({ op: "set", block_id: "", type: "", after_id: "", field: "", value: "", props_json: "{}", ...over }) as never;

test("recupera IDs exactos de productos seleccionados y descarta valores inválidos", () => {
  const id = "d9428888-122b-4f03-9d36-8fdca4dad123";
  assert.deepEqual(selectedStudioProductIds([
    { type: "products", props: { items: [{ id }, { id: "bad" }], product_ids: [id, "11111111-1111-4111-8111-111111111111"] } },
    { type: "hero", props: { product_ids: ["00000000-0000-0000-0000-000000000002"] } },
  ]), [id, "11111111-1111-4111-8111-111111111111"]);
});

test("imagenes y enlaces inventados se descartan", () => {
  const props = cleanOpProps({ img: "https://evil/x.jpg", src: "https://cdn/p1.jpg", url: "javascript:alert(1)", text: "hola" }, known);
  assert.deepEqual(props, { src: "https://cdn/p1.jpg", text: "hola" });
});

test("los productos entran por id con el precio real", () => {
  const props = cleanOpProps({ product_ids: ["p1", "inventado"] }, known);
  assert.deepEqual(props, { items: [product], source: "manual" });
});

test("ops sobre bloques que no existen se descartan", () => {
  const ops = normalizeStudioOps(
    { answer: "ok", ops: [op({ block_id: "a", props_json: '{"text":"Nuevo"}' }), op({ block_id: "zzz", props_json: '{"text":"x"}' }), op({ op: "add", type: "nada" }), op({ op: "header", field: "subject", value: " Hola " })] },
    design,
    known,
  );
  assert.deepEqual(ops, [{ op: "set", block_id: "a", props: { text: "Nuevo" } }, { op: "header", field: "subject", value: "Hola" }]);
});
