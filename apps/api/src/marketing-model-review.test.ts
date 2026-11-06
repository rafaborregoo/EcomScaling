import test from "node:test";
import assert from "node:assert/strict";
import { reviewMarketingModelOutput } from "./marketing-model-review.js";
const products = [{ title: "Tabla", price: 600, image_url: "https://cdn.shopify.com/tabla.jpg", product_url: "https://shop.test/products/tabla" }, { title: "Cera", price: 9.95, image_url: "https://cdn.shopify.com/cera.jpg", product_url: "https://shop.test/products/cera" }];
test("acepta importes europeos y decimales y fotos/enlaces exactos", () => {
  const result = reviewMarketingModelOutput("email_klaviyo", { html: '<p>600,00 € · 9.95 EUR</p><img src="https://cdn.shopify.com/tabla.jpg"><a href="https://shop.test/products/tabla?utm_source=email">Ver</a>' }, products);
  assert.deepEqual(result.evidence.prices, [600, 9.95]);
  assert.equal(result.checks.some((check) => check.status !== "pass"), false);
});
test("señala importes, ofertas, links y fotos inventadas sin puntuar el diseño", () => {
  const result = reviewMarketingModelOutput("email_klaviyo", { html: '<p>300 € · 50% · últimas unidades</p><img src="https://evil.test/a.jpg"><a href="https://shop.test/products/falso">Ver</a>' }, products);
  assert.equal(result.checks.filter((check) => check.status === "fail").length, 4);
  assert.equal("score" in result, false);
});
test("no clasifica un brief social como una imagen terminada", () => {
  const result = reviewMarketingModelOutput("meta_ads", { primary_text: "Una elección para tu próxima salida.", destination_url: "https://shop.test/products/tabla" }, products);
  assert.equal(result.checks.find((check) => check.label === "Composición visual")?.status, "warning");
});

test("disponibilidad no verificada también cuenta como una afirmación a revisar", () => {
  const result = reviewMarketingModelOutput("meta_ads", { primary_text: "La cera está disponible por 9,95 €." }, products);
  assert.equal(result.checks.find((check) => check.label === "Oferta y disponibilidad")?.status, "fail");
  const email = reviewMarketingModelOutput("email_klaviyo", { html: "<p>Consulta la ficha</p>", plain_text: "Está disponible por 600 €." }, products);
  assert.equal(email.checks.find((check) => check.label === "Oferta y disponibilidad")?.status, "fail");
});
