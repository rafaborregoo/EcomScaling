import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { instagramOverlayDraftSchema } from "../packages/ai/src/index.js";
import { parseOutput } from "./ai-model-lab-core.js";

const env = loadApiEnv(process.env);
assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const ownerEmail = "borregorafa99@gmail.com";
const productImageId = "ab5ba081-a505-4ce9-939a-d132a20ac1c6";
const draftName = "A16 · Texto Opus · The Hidden Snowboard (prueba)";
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const review = JSON.parse(await readFile(".e-nora-test-lab/a16-real-2026-11-06/review.json", "utf8"));
const report = JSON.parse(await readFile(".e-nora-test-lab/ai-models/report.json", "utf8"));
const productCase = "a16_texto_sobre_imagen:real-store-runtime-2026-11-06-product-coordinates-v7";
const candidate = report.results.find((row: any) => row.case_id === productCase && row.model_id === review.primary);
assert.ok(candidate && candidate.status === "completed");
const draft = instagramOverlayDraftSchema.parse(parseOutput(candidate.raw_response));
const user = await db.auth.admin.getUserById("ead62983-1938-4da6-af8f-13cb64d8cd3e");
assert.equal(user.data.user?.email, ownerEmail);

const roleSessions: Array<{ role: string; email: string; token: string; client: ReturnType<typeof createClient> }> = [];
for (const [role, email] of [["cliente", ownerEmail], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
  roleSessions.push({ role, email, token: login.data.session.access_token, client });
}
const authorization = `Bearer ${roleSessions[0]!.token}`;
const api = `http://localhost:${env.API_PORT}/v1/organizations/${orgId}/instagram/overlays`;
const existing = await db.from("instagram_image_overlays").select("id").eq("organization_id", orgId).eq("name", draftName).maybeSingle();
assert.ifError(existing.error);
let overlayId = existing.data?.id as string | undefined;
if (!overlayId) {
  const response = await fetch(api, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ name: draftName, creative_brief: "Borrador de laboratorio A16 generado por Claude Opus 5.5 con suscripción CLI. No publicado; pendiente de revisión humana.", channel: "instagram_organic", format: "single", ratio: "1:1", image_ids: [productImageId] }) });
  const body: any = await response.json(); assert.equal(response.status, 201, JSON.stringify(body)); overlayId = body.overlay.id;
}
const fontSize: Record<string, number> = { kicker: 30, headline: 78, subheadline: 44, cta: 38 };
const blocks = draft.blocks.map((item) => ({
  id: crypto.randomUUID().slice(0, 8),
  text: item.text,
  xPct: Math.min(100 - item.position.width_pct, item.position.x_pct),
  yPct: Math.min(90, item.position.y_pct),
  widthPct: item.position.width_pct,
  fontSize: Math.round(fontSize[item.role] * Math.min(1, item.position.width_pct / 84)),
  align: item.align,
  weight: item.emphasis === "strong" || item.role === "headline" ? 800 : 600,
  color: draft.palette.text_hex,
  bgColor: item.role === "cta" ? draft.palette.accent_hex : null,
  lineHeight: 1.1,
}));
const patch = await fetch(`${api}/${overlayId}`, { method: "PATCH", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ slides: [{ image_id: productImageId, blocks }] }) });
const patched: any = await patch.json(); assert.equal(patch.status, 200, JSON.stringify(patched));
const checks = [];
for (const role of roleSessions) {
  const response = await fetch(api, { headers: { authorization: `Bearer ${role.token}` } });
  const body: any = await response.json(); assert.equal(response.status, 200, JSON.stringify(body));
  const visible = body.overlays.find((row: any) => row.id === overlayId); assert.ok(visible, `${role.role} cannot see A16 draft; payload=${JSON.stringify(body.overlays?.map((row: any) => ({id:row.id,name:row.name})) ?? body)}`);
  assert.equal(visible.channel, "instagram_organic"); assert.equal(visible.format, "single");
  assert.equal(visible.slides[0].blocks.length, draft.blocks.length);
  checks.push({ role: role.role, visible: true, blocks: visible.slides[0].blocks.length });
}
const page = await fetch(`http://localhost:3001/marketing/imagenes/${overlayId}`);
assert.equal(page.status, 200);
for (const role of roleSessions) await role.client.auth.signOut({ scope: "local" });
console.log(JSON.stringify({ overlay_id: overlayId, href: `/marketing/imagenes/${overlayId}`, model: review.primary, source: "CLI comparison response", status: "draft_not_published", account_roles: checks, editor_http_status: page.status }));
