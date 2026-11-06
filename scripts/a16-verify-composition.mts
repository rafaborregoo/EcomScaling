import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { prepareOverlayForMarketing } from "../apps/api/src/instagram-image-bank.js";
import { resolveAuthContext, isAuthContextError } from "../apps/api/src/auth-context.js";
const env = loadApiEnv(process.env);
assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", overlay = "9322f8db-08ce-4d13-9039-8e548e488b34";
const receipts = [];
let fixtureDraftId: string | null = null;
for (const email of ["borregorafa99@gmail.com", "rafael@noraapp.es"]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error);
  try {
    const url = `http://localhost:${env.API_PORT}/v1/organizations/${org}/instagram/overlays/${overlay}/render?slide_index=0`;
    const response = await fetch(url, { headers: { authorization: `Bearer ${login.data.session!.access_token}` } });
    assert.equal(response.status, 200, `private_image_export_failed:${response.status}:${await response.clone().text().then(t=>t.slice(0,160))}`);
    assert.match(response.headers.get("content-type") ?? "", /image\/png/);
    const png = Buffer.from(await response.arrayBuffer()); assert.equal(png.subarray(1,4).toString(), "PNG");
    await writeFile(`.e-nora-test-lab/a16-real-2026-11-06/render-${receipts.length}.png`, png);
    const anonymous = await fetch(url); assert.equal(anonymous.status, 401);
    const auth = await resolveAuthContext(env, `Bearer ${login.data.session!.access_token}`); assert.equal(isAuthContextError(auth),false);
    if (isAuthContextError(auth)) throw new Error("auth_failed");
    const prepared = await prepareOverlayForMarketing(env, auth.context, org, overlay);
    assert.ok(prepared.ok, JSON.stringify(prepared.ok ? null : prepared));
    if (!prepared.ok) throw new Error("composition_failed");
    assert.equal(prepared.data.store_id,"5e84efa9-6e7f-4759-8b87-22119401bd81");
    assert.equal(prepared.data.assets.length,1);
    const privatePreview=await fetch(prepared.data.assets[0]!.url); assert.equal(privatePreview.status,200);
    const publicPath=`${env.SUPABASE_URL}/storage/v1/object/public/${prepared.data.assets[0]!.storage_bucket}/${prepared.data.assets[0]!.storage_path}`;
    const publicAttempt=await fetch(publicPath); assert.notEqual(publicAttempt.status,200);
    const wrongOrg=await fetch(url.replace(org,"00000000-0000-4000-8000-000000000000"),{headers:{authorization:`Bearer ${login.data.session!.access_token}`}});assert.ok([403,404].includes(wrongOrg.status));
    if (!fixtureDraftId) {
      const previous=await db.from("marketing_content_drafts").select("id").eq("organization_id",org).contains("request",{source:"a16_composition_verification"}).maybeSingle();assert.ifError(previous.error);
      const asset=prepared.data.assets[0]!;
      const fixture={request:{source:"a16_composition_verification",channel:"instagram_organic",store_id:prepared.data.connection_id,overlay_composition:prepared.data},
        summary:"Prueba técnica de composición A16; texto Opus de la comparación previa. Caption de prueba, no nueva generación A11.",
        template_name:"A16 · Composición integrada · The Hidden Snowboard",subject:"The Hidden Snowboard",preheader:"",
        from_name:"",reply_to:null,purpose:"Verificar la unión de imagen y borrador",audience:"Prueba interna",locale:"es",tone:"brand",
        plain_text:"The Hidden Snowboard. Negro y capas de color. Prueba técnica de integración A16.",
        html:`<img src="${asset.url}" alt="${asset.alt_text}" />`,blocks:[{type:"image",content:asset.url,href:null,alt:asset.alt_text}],
        personalization_tokens:[],compliance_notes:[],sources:[],confidence:"medium",warnings:["Prueba de integración; no es una nueva respuesta A11."]};
      const saved=previous.data?await db.from("marketing_content_drafts").update(fixture).eq("id",previous.data.id).eq("organization_id",org).eq("status","draft").select("id").single():await db.from("marketing_content_drafts").insert({...fixture,organization_id:org,created_by:"ead62983-1938-4da6-af8f-13cb64d8cd3e",status:"draft",content_type:"campaign"}).select("id").single();
      assert.ifError(saved.error);fixtureDraftId=saved.data.id;
    }
    const drafts=await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${org}/marketing/drafts?connection_id=${prepared.data.connection_id}`,{headers:{authorization:`Bearer ${login.data.session!.access_token}`}});
    assert.equal(drafts.status,200);
    const list=await drafts.json() as any;
    const linked=list.drafts?.find((draft:any)=>draft.id===fixtureDraftId);assert.ok(linked,`linked_draft_hidden:${email}`);
    assert.equal(linked.request.overlay_composition.overlay_id,overlay);
    const assetPreview=await fetch(linked.request.overlay_composition.assets[0].url);assert.equal(assetPreview.status,200);
    receipts.push({ role: receipts.length ? "consultor" : "cliente", private_render_status: response.status, anonymous_status: anonymous.status, bytes: png.length, private_asset_preview_status:privatePreview.status, public_asset_denied:true, wrong_org_status:wrongOrg.status, linked_draft:fixtureDraftId, linked_asset_preview:assetPreview.status });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
await writeFile(".e-nora-test-lab/a16-real-2026-11-06/composition-verification.json", JSON.stringify(receipts,null,2));
console.log(JSON.stringify(receipts));
