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

/**
 * El lienzo del editor y el HTML que se envia salen de la MISMA funcion. Si un
 * dia el flag se filtra, el email del cliente saldria con el script del editor
 * dentro: se envia una vez y ya no se puede retirar.
 */
test("el HTML que se guarda no lleva nada del editor", () => {
  const design = designFromAiBlocks([
    { type: "heading", content: "Rebajas" },
    { type: "text", content: "Hasta -50%" },
    { type: "button", content: "Comprar", href: "https://tienda.com" },
  ]);

  const saved = renderTemplateHtml(design);
  assert.doesNotMatch(saved, /<script/i);
  assert.doesNotMatch(saved, /contenteditable/i);
  assert.doesNotMatch(saved, /data-b=/);
  assert.doesNotMatch(saved, /class="eb/);

  // Y el lienzo si lo lleva, o no habria nada que pulsar.
  const canvas = renderTemplateHtml(design, { editable: true });
  assert.match(canvas, /<script/i);
  assert.equal((canvas.match(/data-b=/g) ?? []).length, 3);
  assert.equal((canvas.match(/contenteditable="true"/g) ?? []).length, 3);
});

test("la barra de acciones solo sale en el bloque seleccionado", () => {
  const design = designFromAiBlocks([
    { type: "heading", content: "Uno" },
    { type: "text", content: "Dos" },
    { type: "text", content: "Tres" },
  ]);
  const [first, , last] = design.blocks;

  const sinSeleccion = renderTemplateHtml(design, { editable: true });
  assert.doesNotMatch(sinSeleccion, /class="ebar"/);

  const primero = renderTemplateHtml(design, {
    editable: true,
    selectedId: first.id,
  });
  assert.equal((primero.match(/class="ebar"/g) ?? []).length, 1);
  // El primero no puede subir; el ultimo no puede bajar. Sin esto el bloque
  // desaparece del lienzo al pulsar la flecha que no lleva a ningun sitio.
  assert.match(primero, /data-a="up"[^>]*disabled/);
  assert.doesNotMatch(primero, /data-a="down"[^>]*disabled/);

  const ultimo = renderTemplateHtml(design, {
    editable: true,
    selectedId: last.id,
  });
  assert.match(ultimo, /data-a="down"[^>]*disabled/);
  assert.doesNotMatch(ultimo, /data-a="up"[^>]*disabled/);
});

test("un bloque vacio sigue existiendo en el lienzo aunque no pinte en el email", () => {
  const design = designFromAiBlocks([{ type: "heading", content: "Hola" }]);
  design.blocks.push({
    id: "img-vacia",
    type: "image",
    src: "",
    alt: "",
    align: "center",
    href: "",
  });

  // En el email una imagen sin URL no existe...
  assert.doesNotMatch(renderTemplateHtml(design), /img-vacia/);
  // ...pero en el lienzo tiene que poderse seleccionar para ponerle la URL.
  const canvas = renderTemplateHtml(design, { editable: true });
  assert.match(canvas, /data-b="img-vacia"/);
  assert.match(canvas, /class="ebhint"/);
});
