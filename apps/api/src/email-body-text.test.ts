import assert from "node:assert/strict";
import test from "node:test";
import { emailHtmlToText, emailHtmlToPlainText, emailHtmlToTextExcerpt } from "./email-body-text.js";

test("no deja que el CSS pase por copy", () => {
  const { text } = emailHtmlToText(
    "<style>.btn{color:#fff;background:red}</style><p>Hola</p>",
  );
  assert.equal(text, "Hola");
});

test("separa bloques en vez de pegar el final de uno con el principio del otro", () => {
  const { text } = emailHtmlToText("<p>Primera</p><p>Segunda</p>");
  assert.equal(text, "Primera\nSegunda");
  // El caso que motiva la funcion: tablas anidadas, como el HTML de Klaviyo.
  const tabla = emailHtmlToText(
    "<table><tr><td>Envío gratis</td></tr><tr><td>Solo hoy</td></tr></table>",
  );
  assert.equal(tabla.text, "Envío gratis\nSolo hoy");
});

test("saca los enlaces con su texto, que es la llamada a la accion", () => {
  const { links } = emailHtmlToText(
    '<a href="https://tienda.com/rebajas">Ver rebajas</a>',
  );
  assert.deepEqual(links, [
    { text: "Ver rebajas", href: "https://tienda.com/rebajas" },
  ]);
});

test("un enlace sin texto no es una CTA (pixel de seguimiento, imagen suelta)", () => {
  const { links } = emailHtmlToText(
    '<a href="https://t.co/abc"><img src="x.png"></a>',
  );
  assert.deepEqual(links, []);
});

test("el mismo boton repetido (version movil) cuenta una vez", () => {
  const { links } = emailHtmlToText(
    '<a href="https://x.com/a">Comprar</a><a href="https://x.com/a">Comprar</a>',
  );
  assert.equal(links.length, 1);
});

test("menu y CTA al mismo destino son dos enlaces distintos", () => {
  // Caso real: en una plantilla de Klaviyo el logo, el menu y el boton
  // apuntaban todos a la home. Deduplicar por href dejaba solo "CRM" y perdia
  // la CTA, que es la que importa.
  const { links } = emailHtmlToText(
    '<a href="https://nora.es">CRM</a><a href="https://nora.es">CONECTAR POR API</a>',
  );
  assert.deepEqual(
    links.map((link) => link.text),
    ["CRM", "CONECTAR POR API"],
  );
});

test("decodifica las entidades que salen de verdad en un email", () => {
  const { text } = emailHtmlToText("<p>Env&iacute;o&nbsp;gratis &amp; m&aacute;s</p>");
  assert.match(text, /gratis & m/);
  assert.ok(!text.includes("&nbsp;"), "nbsp debe quedar como espacio");
});

test("avisa cuando ha cortado, para que el agente no lo lea como el email entero", () => {
  const largo = emailHtmlToText(`<p>${"a".repeat(500)}</p>`, 100);
  assert.equal(largo.truncated, true);
  assert.equal(largo.text.length, 100);

  const corto = emailHtmlToText("<p>corto</p>", 100);
  assert.equal(corto.truncated, false);
});

test("A26 keeps the email opening and final CTA while bounding long-copy context", () => {
  const html = `<p>${"Contexto inicial ".repeat(190)}</p><p>Detalles intermedios ${"detalle ".repeat(400)}</p><a href="https://store.test/offer">Ver oferta final</a>`;
  const excerpt = emailHtmlToTextExcerpt(html, 2000);
  assert.equal(excerpt.truncated, true);
  assert.ok(excerpt.text.length <= 2000);
  assert.ok(excerpt.text.startsWith("Contexto inicial"));
  assert.match(excerpt.text, /Ver oferta final/);
  assert.deepEqual(excerpt.links, [{ text: "Ver oferta final", href: "https://store.test/offer" }]);
  assert.match(excerpt.text, /contenido intermedio omitido/);
});

test("A26 bounds oversized source HTML separately from the excerpt budget", () => {
  const html = `<p>Inicio</p>${" ".repeat(150_000)}<p>Más allá del límite</p>`;
  const excerpt = emailHtmlToTextExcerpt(html, 2000);
  assert.equal(excerpt.truncated, true);
  assert.match(excerpt.text, /contenido posterior no analizado/);
  assert.ok(!excerpt.text.includes("Más allá del límite"));
});

test("HTML vacio o ausente no revienta", () => {
  assert.deepEqual(emailHtmlToText(null), {
    text: "",
    links: [],
    truncated: false,
  });
  assert.equal(emailHtmlToPlainText("   "), "");
});
