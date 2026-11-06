import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { A15_MODEL_DECISION } from "../packages/contracts/src/ai-model-decisions.js";
import { instagramImageAnalysisSchema, instagramImageAnalysisToMarkdown } from "../packages/ai/src/index.js";
import { buildVisualAnalysisFingerprint } from "../apps/api/src/visual-asset-sources.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env=loadApiEnv(process.env);assert.equal(new URL(env.SUPABASE_URL).hostname,"kopcblejsxpkxoykldyh.supabase.co");
const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const org="5ebc7b02-ca86-402e-bd61-9abd22f1ee04",store="5e84efa9-6e7f-4759-8b87-22119401bd81",owner="ead62983-1938-4da6-af8f-13cb64d8cd3e";
const checked=async(q:any)=>{const r=await q;assert.ifError(r.error);return r.data;};
const user=await db.auth.admin.getUserById(owner);assert.equal(user.data.user?.email,"borregorafa99@gmail.com");
const root=".e-nora-test-lab/ai-models",report=JSON.parse(await readFile(`${root}/report.json`,"utf8"));assert.ok(!report.active_batch);
const version=await checked(db.from("agent_versions").select("id,version,prompt_code,prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code","a15_analista_imagenes").eq("is_active",true).single());
const prompt=await checked(db.from("prompt_versions").select("content").eq("code",version.prompt_code).eq("version",version.prompt_version).single());
const receipts=[];
for(const suffix of ["visual","shopify"]){
  const scenario=report.cases.find((row:any)=>row.id===`a15_analista_imagenes:real-store-runtime-2026-11-05-${suffix}-contract`);assert.ok(scenario);
  const result=report.results.find((row:any)=>row.case_id===scenario.id&&row.model_id===A15_MODEL_DECISION.model);assert.equal(result.status,"completed");
  const analysis=instagramImageAnalysisSchema.parse(parseOutput(result.raw_response));
  const source=JSON.parse(await readFile(`${root}/a15_analista_imagenes.${scenario.context_hash}.${scenario.prompt_hash}.input.json`,"utf8"));
  const file=source.image_files[0],bytes=await readFile(`${root}/${file.path}`);assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256);
  let image=await checked(db.from("instagram_image_bank").select("id,knowledge_document_id,checksum,analysis,markdown,analysis_fingerprint,index_status,storage_bucket,storage_path").eq("organization_id",org).eq(suffix==="visual"?"id":"checksum",suffix==="visual"?"bf9cbe4c-bc6f-4a95-b5cd-2bab3fb999dd":file.sha256).maybeSingle());
  if(!image){
    assert.equal(suffix,"shopify");
    const storagePath=`${org}/marketing-visual-bank/a15-cli-${file.sha256}.jpg`;
    const upload=await db.storage.from("marketing-source-assets").upload(storagePath,bytes,{contentType:"image/jpeg",upsert:false});
    if(upload.error&&!/already exists|Duplicate/i.test(upload.error.message))throw upload.error;
    image={id:randomUUID(),knowledge_document_id:null};
    await checked(db.from("instagram_image_bank").insert({id:image.id,organization_id:org,store_id:store,storage_bucket:"marketing-source-assets",storage_path:storagePath,public_url:"",original_filename:"A15 · The Hidden Snowboard · Shopify.jpg",content_type:"image/jpeg",byte_size:bytes.length,checksum:file.sha256,pixel_width:1600,pixel_height:1600,representation_kind:"static_image",status:"analyzed",created_by:owner,index_status:"pending"}));
    await checked(db.from("marketing_visual_asset_sources").insert({organization_id:org,image_id:image.id,channel:"instagram",source_kind:"manual_upload",origin_key:image.id,store_id:store,representation_kind:"static_image",origin_host:"cdn.shopify.com",source_metadata:{lab_case:scenario.id,source:"shopify_catalog",product_id:"929a5484-9df1-4b92-989d-6d16201bcf8d",media_id:"4f4ff555-6c30-4f8a-ab79-441cb70a8b2f",execution_source:"cli_simulation",model:A15_MODEL_DECISION.model}}));
  }
  await mkdir(".e-nora-test-lab/a15-real-2026-11-05",{recursive:true});
  await writeFile(`.e-nora-test-lab/a15-real-2026-11-05/before-${suffix}.json`,JSON.stringify(image,null,2),{flag:"wx"}).catch(e=>{if(e.code!=="EEXIST")throw e;});
  if(image.knowledge_document_id){
    const links=await checked(db.from("instagram_image_bank").select("id").eq("organization_id",org).eq("knowledge_document_id",image.knowledge_document_id));assert.equal(links.length,1);
    await checked(db.from("knowledge_documents").update({status:"archived"}).eq("id",image.knowledge_document_id).eq("organization_id",org).eq("source_type","visual_asset"));
  }
  const fingerprint=buildVisualAnalysisFingerprint({agentVersion:version.version,model:A15_MODEL_DECISION.model,promptCode:version.prompt_code,promptVersion:version.prompt_version,promptSha256:createHash("sha256").update(prompt.content).digest("hex"),schemaVersion:"a15-visual-schema-v4",contentChecksum:file.sha256,representationKind:"static_image"});
  const filename=suffix==="visual"?"ejemplo-preventa.png":"The Hidden Snowboard · Shopify.jpg",size=suffix==="visual"?640:1600;
  const markdown=instagramImageAnalysisToMarkdown(analysis,{filename,width:size,height:size,representationKind:"static_image"});
  await checked(db.from("instagram_image_bank").update({analysis,analysis_fingerprint:fingerprint,markdown,checksum:file.sha256,status:"analyzed",pixel_width:size,pixel_height:size,analyzed_at:new Date().toISOString(),knowledge_document_id:null,index_status:"pending",error_reason:null,next_attempt_at:null,claim_token:null,claim_expires_at:null}).eq("id",image.id).eq("organization_id",org));
  if(suffix==="visual")await checked(db.from("marketing_visual_asset_sources").update({store_id:store}).eq("image_id",image.id).eq("organization_id",org).eq("channel","instagram").eq("source_kind","manual_upload"));
  const marker=`cli-lab:a15-${suffix}-2026-11-05`;
  const prior=await checked(db.from("agent_runs").select("id").eq("organization_id",org).eq("deployment_version",marker).maybeSingle());
  const runId=prior?.id??randomUUID();
  if(!prior){const now=new Date().toISOString();await checked(db.from("agent_runs").insert({id:runId,organization_id:org,store_id:scenario.store_id,agent_version_id:version.id,actor_user_id:owner,trigger_type:"manual",status:"succeeded",execution_mode:"shadow",objective:`A15 · análisis visual CLI de ${filename}; Terra principal, Sol fallback. Sin API pagada ni indexación vectorial.`,provider:"openai",model:result.model_id,input_tokens:result.usage.input,output_tokens:result.usage.output,cache_read_tokens:result.usage.cached,estimated_cost_usd:null,cost_basis:null,latency_ms:result.duration_ms,started_at:now,finished_at:now,prompt_code:version.prompt_code,prompt_version:version.prompt_version,deployment_version:marker,stop_reason:"cli_simulation"}));
    await checked(db.from("agent_context_snapshots").insert({run_id:runId,organization_id:org,context_level:"C1",snapshot:{blocks:source.input.context.snapshot,image_id:image.id,source_run_id:scenario.source_run_id,image_sha256:file.sha256,execution_source:"cli_simulation",analysis}}));}
  receipts.push({case_id:scenario.id,image_id:image.id,run_id:runId,model:result.model_id,fingerprint,indexed:false,old_document_archived:image.knowledge_document_id??null});
}
await writeFile(".e-nora-test-lab/a15-real-2026-11-05/published.json",JSON.stringify(receipts,null,2));console.log(JSON.stringify(receipts));
