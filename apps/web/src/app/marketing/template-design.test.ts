import assert from "node:assert/strict";
import { test } from "node:test";

import { designFromAiBlocks, renderTemplateHtml } from "./template-design";

test("designFromAiBlocks mapea el contrato a11 al modelo del builder", () => {
  const design = designFromAiBlocks([
    { type: "heading", content: "Rebajas", href: null, alt: null },
    { type: "text", content: "Hasta -50%", href: null, alt: null },
    { type: "text", content: "   ", href: null, alt: null }, // vacío -> se descarta
    { type: "button", content: "Comprar", href: "https://tienda.com", alt: null },
    { type: "image", content: "https://cdn/x.jpg", href: "not-a-url", alt: "hero" },
    { type: "columns", content: "col a | col b", href: null, alt: null },
    { type: "divider", content: "", href: null, alt: null },
    { type: "spacer", content: "", href: null, alt: null },
    { type: "desconocido", content: "ignorar", href: null, alt: null },
  ]);

  assert.deepEqual(
    design.blocks.map((b) => b.type),
    ["heading", "text", "button", "image", "text", "divider", "spacer"],
  );

  const button = design.blocks.find((b) => b.type === "button");
  assert.equal(button?.type === "button" && button.href, "https://tienda.com");

  const image = design.blocks.find((b) => b.type === "image");
  assert.equal(image?.type === "image" && image.src, "https://cdn/x.jpg");
  assert.equal(image?.type === "image" && image.href, ""); // href no-https se descarta

  // el render no rompe y respeta el sanitizado
  assert.match(renderTemplateHtml(design), /Rebajas/);
});
