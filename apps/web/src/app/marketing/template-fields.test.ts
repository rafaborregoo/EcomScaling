/**
 * Los tokens fallan callando y en el peor sitio: un `{{first_name}}` mal
 * insertado no rompe el editor ni el guardado, llega literal a la bandeja de
 * un cliente real. Por eso la inserción y la lectura de tokens llevan test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectMergeTokens,
  insertMergeField,
  MERGE_FIELDS,
} from "./template-fields";
import { defaultDesign, type TemplateDesign } from "./template-design";

function designWith(blocks: TemplateDesign["blocks"]): TemplateDesign {
  return { ...defaultDesign(), blocks };
}

const textBlock = {
  id: "b1",
  type: "text" as const,
  text: "Hola",
  align: "left" as const,
  color: null,
};

const imageBlock = {
  id: "b2",
  type: "image" as const,
  src: "https://example.com/a.png",
  alt: "",
  align: "left" as const,
  href: "",
};

test("el campo cae en el bloque de texto seleccionado, separado con un espacio", () => {
  const next = insertMergeField(designWith([textBlock]), "b1", "{{first_name}}");
  assert.equal(next?.blocks[0] && "text" in next.blocks[0] ? next.blocks[0].text : null, "Hola {{first_name}}");
});

test("no se duplica el espacio si el texto ya termina en uno", () => {
  const next = insertMergeField(
    designWith([{ ...textBlock, text: "Hola " }]),
    "b1",
    "{{first_name}}",
  );
  assert.equal(next?.blocks[0] && "text" in next.blocks[0] ? next.blocks[0].text : null, "Hola {{first_name}}");
});

test("un bloque vacio se queda solo con el token", () => {
  const next = insertMergeField(
    designWith([{ ...textBlock, text: "" }]),
    "b1",
    "{{email}}",
  );
  assert.equal(next?.blocks[0] && "text" in next.blocks[0] ? next.blocks[0].text : null, "{{email}}");
});

test("sin seleccion, o sobre un bloque sin texto, no hay donde insertar", () => {
  // Devolver null y no el diseño intacto: quien llama tiene que poder mandar
  // el token al asunto en vez de creer que ya lo ha colocado.
  assert.equal(insertMergeField(designWith([textBlock]), null, "{{email}}"), null);
  assert.equal(insertMergeField(designWith([imageBlock]), "b2", "{{email}}"), null);
});

test("los demas bloques no se tocan", () => {
  const next = insertMergeField(
    designWith([textBlock, { ...textBlock, id: "b3", text: "Otro" }]),
    "b1",
    "{{email}}",
  );
  assert.equal(next?.blocks[1] && "text" in next.blocks[1] ? next.blocks[1].text : null, "Otro");
});

test("los tokens se leen del contenido, sin repetir y ordenados", () => {
  const tokens = collectMergeTokens(
    "<p>Hola {{first_name}}, {{first_name}}</p>",
    "Oferta para {{ location.city }}",
    "",
  );
  assert.deepEqual(tokens, ["first_name", "location.city"]);
});

test("un token con filtro de Klaviyo cuenta como el mismo token", () => {
  assert.deepEqual(
    collectMergeTokens('Hola {{ first_name|default:"" }}'),
    ["first_name"],
  );
});

test("texto sin tokens no declara ninguno", () => {
  assert.deepEqual(collectMergeTokens("<p>Sin personalizacion</p>"), []);
});

test("todos los campos ofrecidos son tokens que luego sabemos leer", () => {
  for (const field of MERGE_FIELDS) {
    assert.deepEqual(
      collectMergeTokens(field.token),
      [field.name],
      `${field.label} declara ${field.name} pero su token es ${field.token}`,
    );
  }
});
