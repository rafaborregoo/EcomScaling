import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadMarketingCreativeContext, loadMarketingDesignPrinciples } from "./marketing-creative-context.js";
import { marketingCreativeRequestSchema, marketingProductVisionImages, marketingCreativeMethodMetadata } from "./marketing-creative-method.js";

const org = "11111111-1111-4111-8111-111111111111";
const store = "22222222-2222-4222-8222-222222222222";
const product = "33333333-3333-4333-8333-333333333333";
const connection = "44444444-4444-4444-8444-444444444444";
const draft = "55555555-5555-4555-8555-555555555555";
function mockDb(options: { fail?: string; sourceConnection?: string; noProducts?: boolean } = {}) {
  const calls: URL[] = [];
  const db = createClient("https://test.supabase.co", "test-service-key", { global: { fetch: async (input) => {
    const url = new URL(String(input)); calls.push(url);
    const table = url.pathname.split("/").at(-1)!;
    if (options.fail === table) return new Response(JSON.stringify({ message: "database unavailable" }), { status: 503 });
    let value: unknown = null;
    if (table === "organizations") value = { display_name: "Tienda TEST", currency_code: "EUR" };
    if (table === "shopify_stores") value = { id: store, connection_id: connection, is_active: true };
    if (table === "marketing_brand_profiles") value = url.searchParams.get("store_id") === "is.null" ? { brand_name: "Marca org", claim_restrictions: ["No atribuir beneficios médicos"] } : { brand_name: "Marca tienda" };
    if (table.startsWith("marketing_studio_products")) value = options.noProducts ? [] : [{ product_id: product, title: "Producto real", price: 0, image_url: "https://cdn.shopify.com/a.jpg" }];
    if (table === "marketing_content_drafts") value = url.searchParams.has("id") ? { id: draft, request: { store_id: options.sourceConnection ?? connection }, plain_text: "Texto origen", version: 2 } : [{ id: draft, subject: "Anterior", status: "draft" }];
    if (table === "internal_mailing_playbook_entries") value = [{ kind: "strategy", status: "published", title: "Producto", objective: "Producto real", source_type: "internal", rights_confirmed: true, sequence_arc: "Producto → argumento → acción", updated_at: "2026-11-01" }];
    return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
  } }, auth: { persistSession: false } });
  return { db, calls };
}
test("contexto conserva IDs reales, cero conocido y marca heredada; todas las lecturas de cliente se acotan", async () => {
  const { db, calls } = mockDb();
  const result = await loadMarketingCreativeContext(db, org, store, "Producto", marketingCreativeRequestSchema.parse({ product_ids: [product] }));
  const first = result.products[0]; assert.ok(first);
  assert.equal(first.id, product);
  assert.equal(first.price, 0);
  assert.equal(first.currency, null);
  assert.equal(first.inventory_status, "not_checked");
  assert.equal(result.brand.profile?.brand_name, "Marca tienda");
  assert.deepEqual(result.brand.profile?.claim_restrictions, ["No atribuir beneficios médicos"]);
  for (const call of calls.filter((url) => !url.pathname.includes("/rpc/"))) assert.equal(call.searchParams.get(call.pathname.endsWith("organizations") ? "id" : "organization_id"), `eq.${org}`);
  assert.ok(calls.some((url) => url.searchParams.get("request->>store_id") === `eq.${connection}`));
  assert.ok(calls.some((url) => url.searchParams.get("request->ai_lab") === "is.null"));
});
test("sin tienda nunca consulta catálogo ni historial de varias tiendas", async () => {
  const { db, calls } = mockDb();
  const result = await loadMarketingCreativeContext(db, org, null, "Crear", marketingCreativeRequestSchema.parse({}));
  assert.equal(result.products.length, 0);
  assert.equal(calls.some((url) => /rpc|marketing_content_drafts/.test(url.pathname)), false);
  assert.ok(result.warnings.length > 0);
});
test("rechaza producto seleccionado ausente y fuente de otra tienda", async () => {
  await assert.rejects(loadMarketingCreativeContext(mockDb({ noProducts: true }).db, org, store, "Producto", marketingCreativeRequestSchema.parse({ product_ids: [product] })), /selected_product_not_available/);
  await assert.rejects(loadMarketingCreativeContext(mockDb({ sourceConnection: org }).db, org, store, "Adapta", marketingCreativeRequestSchema.parse({ source_draft_id: draft, creative_task: "adapt" })), /source_scope_invalid/);
  await assert.rejects(loadMarketingCreativeContext(mockDb().db, org, store, "Variantes", marketingCreativeRequestSchema.parse({ creative_task: "hooks" })), /source_draft_required/);
});
test("variación incluye la pieza verificada y su versión", async () => {
  const result = await loadMarketingCreativeContext(mockDb().db, org, store, "Variantes", marketingCreativeRequestSchema.parse({ source_draft_id: draft, creative_task: "hooks" }));
  assert.ok(result.blocks.some((block) => block.label.includes("Pieza origen")));
});
test("fallo de datos no produce un contexto aparentemente vacío", async () => {
  await assert.rejects(loadMarketingCreativeContext(mockDb({ fail: "marketing_brand_profiles" }).db, org, store, "Crear", marketingCreativeRequestSchema.parse({})), /verified_context_unavailable/);
  await assert.rejects(loadMarketingCreativeContext(mockDb({ fail: "marketing_content_drafts" }).db, org, store, "Crear", marketingCreativeRequestSchema.parse({})), /history_unavailable/);
});
test("referencias son principios publicados compactos, sin HTML ni metadata privada", async () => {
  const { db, calls } = mockDb();
  const result = await loadMarketingDesignPrinciples(db, "Producto real");
  assert.equal(result.selected.length, 1);
  const call = calls[0]; assert.ok(call);
  assert.equal(call.searchParams.get("kind"), "eq.strategy");
  assert.equal(call.searchParams.get("status"), "eq.published");
  assert.equal(/raw_html|rights_confirmed|entry_key/.test(JSON.stringify(result)), false);
});
test("inputs acotan referencias, variantes y productos", () => {
  assert.equal(marketingCreativeRequestSchema.safeParse({ variant_count: 11 }).success, false);
  assert.equal(marketingCreativeRequestSchema.safeParse({ research_references: [{ url: "http://example.com", observed_at: "2026-11-01T12:00:00Z", observation: "Activo" }] }).success, false);
  assert.equal(marketingCreativeRequestSchema.parse({ arbitrary: "ignored" }).creative_mode, "original");
  assert.equal("variant_count" in marketingCreativeMethodMetadata(marketingCreativeRequestSchema.parse({})), false);
  assert.equal(marketingCreativeMethodMetadata(marketingCreativeRequestSchema.parse({ creative_task: "hooks", variant_count: 5 })).variant_count, 5);
});

test("visión no transmite URLs externas, credenciales, puertos o duplicados; acota coste", () => {
  const rejected = ["http://cdn.shopify.com/a.jpg", "https://cdn.shopify.com.evil.test/a.jpg", "https://cdn.shopify.com@evil.test/a.jpg", "https://user@cdn.shopify.com/a.jpg", "https://cdn.shopify.com:444/a.jpg", "not-a-url"];
  const real = Array.from({ length: 12 }, (_, i) => ({ image_url: `https://cdn.shopify.com/${i}.jpg` }));
  assert.deepEqual(marketingProductVisionImages(rejected.map((image_url) => ({ image_url })), [], true), []);
  assert.equal(marketingProductVisionImages(real, [], false).length, 2);
  assert.equal(marketingProductVisionImages(real, [], true).length, 6);
  const selected = marketingProductVisionImages(real, [{ url: real[0]!.image_url, role: "referencia" }], false);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((image) => image.url)).size, 3);
});
