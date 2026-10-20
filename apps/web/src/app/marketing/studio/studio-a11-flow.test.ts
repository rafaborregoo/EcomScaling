import assert from "node:assert/strict";
import test from "node:test";
import { applyStudioOps } from "./studio-ai-ops";
import { defaultBrand, emptyDesign, newBlock, renderEmailHtml } from "./studio-design";

test("recorrido de producto verificado: A11 -> operaciones del editor -> HTML exportable", () => {
  const id = "d9428888-122b-4f03-9d36-8fdca4dad123";
  const product = {
    id,
    title: "Lámpara Nórdica",
    price: "49,90 €",
    image: "https://cdn.example.test/lamp.jpg",
    url: "https://shop.example.test/products/lampara",
  };
  const design = emptyDesign(defaultBrand());
  const block = newBlock("products");
  const seeded = { ...design, blocks: [...design.blocks, block] };
  const operations = [{ op: "set" as const, block_id: block.id, props: { items: [product], source: "manual" } }];
  assert.equal(operations.length, 1);
  const applied = applyStudioOps(seeded, { subject: "Ideas para tu hogar", preheader: "" }, operations);
  const html = renderEmailHtml(applied.design, { preheader: applied.header.preheader });
  assert.match(html, /Lámpara Nórdica/);
  assert.match(html, /49,90/);
  assert.match(html, /https:\/\/shop\.example\.test\/products\/lampara/);
});
