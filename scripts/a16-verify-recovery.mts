import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { resolveAuthContext, isAuthContextError } from "../apps/api/src/auth-context.js";
import { draftInstagramOverlayText } from "../apps/api/src/instagram-image-bank.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env=loadApiEnv(process.env);assert.equal(new URL(env.SUPABASE_URL).hostname,"kopcblejsxpkxoykldyh.supabase.co");
const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const org="5ebc7b02-ca86-402e-bd61-9abd22f1ee04",overlay="9322f8db-08ce-4d13-9039-8e548e488b34";
const link=await db.auth.admin.generateLink({type:"magiclink",email:"borregorafa99@gmail.com"});assert.ifError(link.error);
const client=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.verifyOtp({type:"magiclink",token_hash:link.data.properties.hashed_token});assert.ifError(login.error);
try {
  const auth=await resolveAuthContext(env,`Bearer ${login.data.session!.access_token}`);if(isAuthContextError(auth))throw new Error("auth_failed");
  const payload={slide_index:0,idempotency_key:`verification-${crypto.randomUUID()}`};
  let captured:{runId:string;contextBlocks:Array<{label:string;data:unknown}>}|null=null;
  // Deliberately stop BEFORE the provider. No model API call is possible in this test.
  const capture=await draftInstagramOverlayText(env,auth.context,org,overlay,payload,{beforeModel:async prepared=>{captured=prepared;throw new Error("A16_TEST_CAPTURE_NO_MODEL_CALL")}});
  assert.ok(!capture.ok);assert.ok(captured,JSON.stringify(capture));
  const capturedRun=captured as {runId:string;contextBlocks:Array<{label:string;data:unknown}>};
  const run=await db.from("agent_runs").select("store_id,status").eq("id",capturedRun.runId).single();assert.ifError(run.error);assert.equal(run.data.store_id,"5e84efa9-6e7f-4759-8b87-22119401bd81");
  assert.ok(capturedRun.contextBlocks.some(block=>block.label.includes("marca y slides")));
  const report=JSON.parse(await readFile(".e-nora-test-lab/ai-models/report.json","utf8"));
  const candidate=report.results.find((row:any)=>row.case_id==="a16_texto_sobre_imagen:real-store-runtime-2026-11-06-product-coordinates-v7"&&row.model_id==="claude-opus-5-5");assert.ok(candidate);
  const output=parseOutput(candidate.raw_response);
  const stored=await db.from("agent_outputs").insert({organization_id:org,run_id:capturedRun.runId,schema_version:"1.0",approval_required:false,status:"published",published_at:new Date().toISOString(),output});assert.ifError(stored.error);
  const finished=await db.from("agent_runs").update({status:"succeeded",execution_mode:"shadow",finished_at:new Date().toISOString(),objective:"TEST A16 · recuperación de respuesta CLI previa; sin API",error_message:null,estimated_cost_usd:0}).eq("id",capturedRun.runId);assert.ifError(finished.error);
  let calls=0;
  const replay=await draftInstagramOverlayText(env,auth.context,org,overlay,payload,{beforeModel:async()=>{calls++;throw new Error("UNEXPECTED_MODEL_CALL")}});
  assert.ok(replay.ok,JSON.stringify(replay));if(!replay.ok)throw new Error("replay_failed");
  assert.equal(replay.data.recovered,true);assert.equal(replay.data.run_id,capturedRun.runId);assert.equal(calls,0);assert.deepEqual(replay.data.draft,output);
  const changed=await draftInstagramOverlayText(env,auth.context,org,overlay,{...payload,objective:"Cambio de encargo para comprobar la clave"},{beforeModel:async()=>{calls++;throw new Error("UNEXPECTED_MODEL_CALL")}});
  assert.equal(changed.ok,false);if(changed.ok)throw new Error("key_reused");assert.equal(changed.statusCode,409);assert.equal(changed.error,"overlay_request_changed");assert.equal(calls,0);
  const receipt={checked_at:new Date().toISOString(),run_id:capturedRun.runId,provider_api_calls:0,store_scope_verified:true,brand_and_carousel_context:true,recovered:true,changed_request_rejected:true,source:"prior Opus CLI response used as persisted fixture"};
  // Keep simulated successful outputs out of A23's live specialist feed.
  const cleanup=await db.from("agent_runs").update({status:"failed",error_message:"A16_TEST_FIXTURE_NO_PROVIDER_CALL"}).eq("organization_id",org).eq("execution_mode","shadow").eq("objective","TEST A16 · recuperación de respuesta CLI previa; sin API");assert.ifError(cleanup.error);
  await writeFile(".e-nora-test-lab/a16-real-2026-11-06/recovery-verification.json",JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally {await client.auth.signOut({scope:"local"});}
