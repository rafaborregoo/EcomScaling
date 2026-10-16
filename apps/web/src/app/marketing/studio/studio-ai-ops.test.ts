import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDesign, newBlock } from "./studio-design";
import { applyStudioOps } from "./studio-ai-ops";

const header = { subject: "Hola", preheader: "" };

test("set solo toca propiedades que el bloque tiene y coacciona números", () => {
  const title = newBlock("heading");
  const design = { ...emptyDesign(), blocks: [title] };
  const out = applyStudioOps(design, header, [{ op: "set", block_id: title.id, props: { text: "Nuevo", size: "30", inventada: 1, align: 5 } }]);
  assert.deepEqual(out.design.blocks[0]!.props, { ...title.props, text: "Nuevo", size: 30 });
  assert.deepEqual(out.touched, [title.id]);
});

test("add, move, remove y asunto", () => {
  const a = newBlock("text");
  const b = newBlock("button");
  const design = { ...emptyDesign(), blocks: [a, b] };
  const out = applyStudioOps(design, header, [
    { op: "add", type: "coupon", props: { code: "VERANO" }, after_id: "inicio" },
    { op: "move", block_id: b.id, after_id: "inicio" },
    { op: "remove", block_id: a.id },
    { op: "header", field: "subject", value: "Nuevo asunto" },
    { op: "add", type: "nada", props: {}, after_id: null },
  ]);
  assert.deepEqual(out.design.blocks.map((block) => block.type), ["button", "coupon"]);
  assert.equal(out.header.subject, "Nuevo asunto");
});
