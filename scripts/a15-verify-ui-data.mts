import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { isCurrentA15VisualAnalysis } from "../apps/api/src/instagram-image-bank.js";
const env=loadApiEnv(process.env);assert.equal(new URL(env.SUPABASE_URL).hostname,"kopcblejsxpkxoykldyh.supabase.co");
const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const org="5ebc7b02-ca86-402e-bd61-9abd22f1ee04",store="5e84efa9-6e7f-4759-8b87-22119401bd81";
const published=JSON.parse(await readFile(".e-nora-test-lab/a15-real-2026-11-05/published.json","utf8"));
const expected=await db.from("instagram_image_bank").select("id,organization_id,checksum,representation_kind,status,analysis,analysis_fingerprint,index_status").eq("organization_id",org).in("id",published.map((row:any)=>row.image_id));assert.ifError(expected.error);assert.equal(expected.data!.length,2);
for(const image of expected.data!)assert.equal(await isCurrentA15VisualAnalysis(db,image),true,`Fingerprint mismatch: ${image.id}`);
const checks=[];
for(const [role,email] of [["cliente","borregorafa99@gmail.com"],["consultor","rafael@noraapp.es"]]){
  const link=await db.auth.admin.generateLink({type:"magiclink",email:email!});assert.ifError(link.error);
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.verifyOtp({type:"magiclink",token_hash:link.data.properties.hashed_token});assert.ifError(login.error);assert.ok(login.data.session);
  const headers={authorization:`Bearer ${login.data.session.access_token}`};
  try{
    const base=`http://localhost:${env.API_PORT}/v1/organizations/${org}/instagram/image-bank`;
    for(const suffix of ["",`?store_id=${store}`]){
      const response=await fetch(base+suffix,{headers});const body:any=await response.json();assert.equal(response.status,200,JSON.stringify(body));
      for(const image of expected.data!){const actual=body.images.find((row:any)=>row.id===image.id);assert.ok(actual,`${role} cannot see ${image.id}`);assert.deepEqual(actual.analysis,image.analysis);assert.equal(actual.status,"analyzed");assert.equal(actual.index_status,"pending");assert.equal(actual.storage_path,undefined);}
    }
    const preview=await fetch(`${base}/${published[1].image_id}/preview`,{headers});assert.equal(preview.status,200);
    const otherScope=await fetch(`${base}?store_connection_id=00000000-0000-4000-8000-000000000000`,{headers});assert.equal(otherScope.status,404);
    checks.push({role,images:2,same_terra_analysis:true,store_scope_checked:true,private_preview_status:preview.status});
  }finally{await client.auth.signOut({scope:"local"});}
}
const page=await fetch("http://localhost:3001/marketing/imagenes");assert.equal(page.status,200);
const anonymous=await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${org}/instagram/image-bank`);assert.equal(anonymous.status,401);
const archived=await db.from("knowledge_documents").select("status").eq("organization_id",org).eq("id","ff9aa36b-9c3a-46e1-aa05-f790508683b8").single();assert.ifError(archived.error);assert.equal(archived.data.status,"archived");
const receipt={checked_at:new Date().toISOString(),checks,href:"/marketing/imagenes",page_status:page.status,old_seed_document_archived:true,indexing:"pending_no_paid_embeddings",visual_ui_review:"not_performed"};
await writeFile(".e-nora-test-lab/a15-real-2026-11-05/visibility.json",JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
