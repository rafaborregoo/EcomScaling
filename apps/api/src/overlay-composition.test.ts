import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { cropOverlayImage, renderOverlayImage, overlaySlidesSchema } from "./overlay-composition.js";
import { resolveDraftOverlayAssets } from "./overlay-draft-assets.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const block = { id: "title", text: "Invierno & nieve <158>", xPct: 10, yPct: 10, widthPct: 70, fontSize: 60, color: "#ffffff", bgColor: "#000000", align: "left", weight: 800, lineHeight: 1.1 };
test("vision crop and composed PNG use identical target dimensions for each ratio", async () => {
  const original = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#123456" } }).png().toBuffer();
  for (const [ratio, height] of [["1:1",1080],["4:5",1350],["9:16",1920]] as const) {
    const crop = await cropOverlayImage(original, ratio);
    const png = await renderOverlayImage(original, ratio, [block]);
    const [a,b] = await Promise.all([sharp(crop).metadata(),sharp(png).metadata()]);
    assert.equal(a.width,1080); assert.equal(b.width,1080); assert.equal(a.height,height); assert.equal(b.height,height);
    assert.notDeepEqual(crop,png);
  }
});
test("invalid layout and text outside the canvas fail before delivering a clipped export", async () => {
  assert.equal(overlaySlidesSchema.safeParse([{image_id:null,blocks:[{...block,widthPct:-1}]}]).success,false);
  const image = await sharp({create:{width:20,height:20,channels:3,background:"#000"}}).png().toBuffer();
  await assert.rejects(renderOverlayImage(image,"1:1",[{...block,yPct:99}]),/overflow/);
});
test("private draft image URLs refresh in HTML, editor state and metadata; publication needs approval", async () => {
  const org="org", overlay="overlay", path=`${org}/overlays/${overlay}/v1-0.png`;
  const png=Buffer.from("test-png"),sha=crypto.createHash("sha256").update(png).digest("hex");
  const old=`https://test.supabase.co/storage/v1/object/sign/marketing-source-assets/${path}?token=expired`;
  const fresh=old.replace("expired","fresh"); let uploads=0;
  const client={storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:fresh},error:null}), download:async()=>({data:new Blob([png]),error:null}),upload:async()=>{uploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:"https://public.test/image.png"}})})}} as unknown as SupabaseClient;
  const draft={status:"draft",html:`<img src="${old}">`,request:{design:{image:old},overlay_composition:{overlay_id:overlay,assets:[{storage_bucket:"marketing-source-assets",storage_path:path,sha256:sha,url:old,slide_index:0,width:1080,height:1080}]}}};
  const resolved=await resolveDraftOverlayAssets(client,org,draft);
  assert.match(resolved.html,/token=fresh/); assert.equal(resolved.request.design.image,fresh); assert.equal(uploads,0);
  await assert.rejects(resolveDraftOverlayAssets(client,org,draft,true),/not_approved/);
  await assert.rejects(resolveDraftOverlayAssets(client,"other-org",draft),/scope_invalid/);
  const delivered=await resolveDraftOverlayAssets(client,org,{...draft,status:"approved"},true);
  assert.match(delivered.html,/https:\/\/public.test\/image.png/); assert.equal(uploads,1);
});
