import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SYSTEM_TEMPLATES,
  brandFromProfile,
  defaultBrand,
  emptyDesign,
  newBlock,
  normalizeDesign,
  renderEmailHtml,
  reviewPiece,
  withUtm,
  type StudioDesign,
} from "./studio-design";

const ctx = {
  brand: defaultBrand({ logo: "CASA BRAVA" }),
  storeUrl: "https://casabrava.es",
  products: [
    { id: "p1", title: "Mantel de lino", price: "49,00 €", image: "https://cdn.shopify.com/a.jpg", url: "https://casabrava.es/products/mantel" },
    { id: "p2", title: "Servilletas", price: "24,00 €", image: "https://cdn.shopify.com/b.jpg", url: "https://casabrava.es/products/servilletas" },
    { id: "p3", title: "Cojín", price: "29,00 €", image: "https://cdn.shopify.com/c.jpg", url: "https://casabrava.es/products/cojin" },
  ],
};

function launch(): StudioDesign {
  const template = SYSTEM_TEMPLATES.find((item) => item.id === "lanzamiento")!;
  return { ...emptyDesign(ctx.brand), blocks: template.build(ctx) };
}

test("el HTML es apto para email: tablas, sin flex/grid/script, con baja de Klaviyo", () => {
  const html = renderEmailHtml(launch(), { preheader: "Hola", campaign: "Lino verano" });
  assert.match(html, /<table role="presentation"/);
  assert.doesNotMatch(html, /display:\s*(flex|grid)|<script|<svg/i);
  assert.match(html, /\{% unsubscribe 'Darse de baja' %\}/);
  assert.match(html, /utm_campaign=lino-verano/);
  assert.match(html, /Mantel de lino/);
  assert.match(html, /display:none;max-height:0/);
});

test("el texto se escapa y los enlaces no https se anulan", () => {
  const design = { ...emptyDesign(), blocks: [newBlock("text", { text: "<b>hola</b>" }), newBlock("button", { url: "javascript:alert(1)", utm: false })] };
  const html = renderEmailHtml(design);
  assert.match(html, /&lt;b&gt;hola&lt;\/b&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /href="#"/);
});

test("withUtm no pisa UTM existentes", () => {
  const url = withUtm("https://x.es/p?utm_source=meta", "Campaña Otoño");
  assert.match(url, /utm_source=meta/);
  assert.match(url, /utm_campaign=campana-otono/);
  assert.equal(withUtm("no-es-url", "x"), "no-es-url");
});

test("la plantilla de sistema no se deja mandar con huecos sin rellenar", () => {
  const checks = reviewPiece("email", launch(), { subject: "Ya está aquí: la nueva colección", preheader: "Las favoritas" }, 20_000);
  const placeholder = checks.find((check) => check.title.startsWith("Sin textos de plantilla"));
  assert.equal(placeholder?.state, "bad");
  assert.match(placeholder?.fix?.action ?? "", /^select:/);
});

test("revisión: falta pie legal, sin alt, botón sin enlace y contraste bajo", () => {
  const design = {
    ...emptyDesign(),
    blocks: [
      newBlock("image", { src: "https://cdn/x.jpg", alt: "" }),
      newBlock("button", { url: "", bg: "#f2f2f2" }),
    ],
  };
  const byTitle = Object.fromEntries(reviewPiece("email", design, { subject: "", preheader: "" }).map((check) => [check.title, check.state]));
  assert.equal(byTitle["Pie legal con enlace de baja"], "bad");
  assert.equal(byTitle["Imágenes con texto alternativo"], "bad");
  assert.equal(byTitle["Enlaces que llevan a algún sitio"], "bad");
  assert.equal(byTitle["Botones legibles (contraste AA)"], "bad");
  assert.equal(byTitle["Asunto de 20 a 50 caracteres"], "bad");
});

test("normalizeDesign abre diseños del editor anterior, bloques de IA y HTML suelto", () => {
  const v1 = normalizeDesign({
    version: 1,
    styles: { fontFamily: "Arial", background: "#fff", containerBackground: "#ffffff", text: "#111111", primary: "#1d4ed8" },
    blocks: [
      { id: "a", type: "heading", text: "Hola", align: "left", size: "lg", color: null },
      { id: "b", type: "columns", columns: [{ text: "izq", imageSrc: "" }, { text: "der", imageSrc: "https://x/y.png" }] },
    ],
  });
  assert.equal(v1.version, 2);
  assert.deepEqual(v1.blocks.map((block) => block.type), ["heading", "text", "image", "text"]);
  assert.equal(v1.brand.primary, "#1d4ed8");

  const ai = normalizeDesign(null, { aiBlocks: [{ type: "text", content: "Texto IA" }] });
  assert.deepEqual(ai.blocks.map((block) => block.type), ["text"]);

  const html = normalizeDesign(null, { html: "<p>Klaviyo</p>" });
  assert.equal(html.blocks[0]?.type, "html");

  const v2 = normalizeDesign({ ...launch(), blocks: [...launch().blocks, { id: "z", type: "desconocido", props: {} }] });
  assert.equal(v2.blocks.length, launch().blocks.length);
});

test("brandFromProfile reconoce roles con nombres habituales", () => {
  const brand = brandFromProfile({ brand_name: "Casa Brava", palette: { Principal: "#173d35", fondo: "#fafafa", raro: "no-hex" } });
  assert.equal(brand.logo, "CASA BRAVA");
  assert.equal(brand.primary, "#173d35");
  assert.equal(brand.bg, "#fafafa");
});

test("revisión de Meta exige texto, enlace e imagen", () => {
  const design = emptyDesign();
  const states = reviewPiece("meta", design, { subject: "", preheader: "" }).filter((check) => check.state === "bad").map((check) => check.title);
  assert.deepEqual(states, ["Texto principal escrito", "Enlace de destino", "Imagen elegida"]);
});

test("revisión: un producto sin enlace cuenta como enlace roto", () => {
  const products = newBlock("products", { items: [{ id: "1", title: "Mantel", price: "", image: "", url: "" }] });
  const check = reviewPiece("email", { ...emptyDesign(), blocks: [products] }, { subject: "", preheader: "" }).find((item) => item.title === "Enlaces que llevan a algún sitio");
  assert.equal(check?.state, "bad");
  assert.equal(check?.fix?.action, `select:${products.id}`);
});

test("con 2 por fila se ven los 6 productos, en 3 filas", () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: String(i), title: `Producto ${i}`, price: "", image: "", url: "https://x.es/p" }));
  const html = renderEmailHtml({ ...emptyDesign(), blocks: [newBlock("products", { cols: "2", items })] });
  assert.match(html, /Producto 5/);
});
