import assert from "node:assert/strict";
import { test } from "node:test";
import { agentTaskNotificationBatches, authorizeAgentOutputScope, type AgentOutputScope } from "./agent-output-authorization.js";
import { getAgentOutputDetail } from "./ai-output-detail.js";
import { decideAgentOutput } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const org="10000000-0000-4000-8000-000000000001", store="20000000-0000-4000-8000-000000000001";
const scope: AgentOutputScope={organization_id:org,store_id:store,agent_code:"a14_operativa_meta",objective:"diagnostic"};
function context(role="user", scoped=false): AuthContext {
  const membership={organization_id:org,role:"owner",accessSource:"membership" as const,organization:null,
    ...(scoped?{access_scope:"store" as const,store_ids:[store]}:{})};
  return { user:{id:org},profile:{id:org,full_name:null,avatar_url:null,is_active:true,platform_role:role},
    memberships:scoped?[]:[membership],storeMemberships:scoped?[membership]:[],subscriptions:[] };
}
test("client, assigned consultant and admin keep their existing decision roles",()=>{
  for(const role of ["user","consultant","platform_admin"])assert.equal(authorizeAgentOutputScope(context(role),org,scope).ok,true);
});
test("a store-scoped owner sees only their exact store and never the aggregate",()=>{
  const c=context("user",true);
  assert.equal(authorizeAgentOutputScope(c,org,scope).ok,true);
  assert.equal(authorizeAgentOutputScope(c,org,{...scope,store_id:"other-store"}).ok,false);
  assert.equal(authorizeAgentOutputScope(c,org,{...scope,store_id:null}).ok,false);
});
test("foreign scope, missing agent, revoked membership and inactive profile fail closed",()=>{
  assert.equal(authorizeAgentOutputScope(context(),org,{...scope,organization_id:"other"}).ok,false);
  assert.equal(authorizeAgentOutputScope(context(),org,{...scope,agent_code:null}).ok,false);
  assert.equal(authorizeAgentOutputScope({...context(),memberships:[]},org,scope).ok,false);
  const c=context();c.profile.is_active=false;
  assert.equal(authorizeAgentOutputScope(c,org,scope).ok,false);
});
test("knowledge audit and consultant panel stay internal even with an output ID",()=>{
  for(const internal of [{...scope,agent_code:"a08_gestor_conocimiento"},{...scope,objective:"[dashboard_scope=panel]"}]){
    assert.equal(authorizeAgentOutputScope(context(),org,internal).ok,false);
    assert.equal(authorizeAgentOutputScope(context("consultant"),org,internal).ok,true);
  }
});

const env={SUPABASE_URL:"https://imp03.invalid",SUPABASE_SERVICE_ROLE_KEY:"synthetic-key"} as Parameters<typeof decideAgentOutput>[0];
async function withFetch<T>(respond:(url:URL, init?:RequestInit)=>unknown, work:()=>Promise<T>) {
  const original=globalThis.fetch;
  const calls:string[]=[];
  const failures:unknown[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));calls.push(url.pathname);
    assert.equal(url.hostname,"imp03.invalid","tests must never call a real Supabase endpoint");
    try { return new Response(JSON.stringify(respond(url,init)),{status:200,headers:{"Content-Type":"application/json"}}); }
    catch(error) { failures.push(error); throw error; }
  };
  try{const result=await work();assert.deepEqual(failures,[],"synthetic transport must cover every call");return {result,calls};}finally{globalThis.fetch=original;}
}
test("actual detail endpoint rejects another store before reading receipts, tasks or profiles",async()=>{
  const {result,calls}=await withFetch((url)=>{
    if(url.pathname.endsWith("/agent_outputs"))return {id:org,run_id:org,output:{proposed_writes:[{title:"private"}]},status:"pending_approval"};
    if(url.pathname.endsWith("/agent_runs"))return {organization_id:org,store_id:"other-store",agent_versions:{agent_definitions:{code:"a14_operativa_meta"}}};
    throw Error(`Unexpected privileged read ${url.pathname}`);
  },()=>getAgentOutputDetail(env,context("user",true),org,org));
  assert.equal(result.ok,false);assert.equal(calls.length,2);
});
test("actual detail endpoint rejects internal knowledge before loading its decision",async()=>{
  const {result,calls}=await withFetch((url)=>{
    if(url.pathname.endsWith("/agent_outputs"))return {id:org,run_id:org,output:{summary:"internal"},status:"approved"};
    if(url.pathname.endsWith("/agent_runs"))return {organization_id:org,store_id:null,agent_versions:{agent_definitions:{code:"a08_gestor_conocimiento"}}};
    throw Error(`Unexpected privileged read ${url.pathname}`);
  },()=>getAgentOutputDetail(env,context(),org,org));
  assert.equal(result.ok,false);assert.equal(calls.length,2);
});
test("actual decision endpoint applies store checks to A14, including dismissal",async()=>{
  for(const decision of ["approved","dismiss_proposal"]) {
    const {result,calls}=await withFetch(()=>({agent_runs:{organization_id:org,store_id:"other-store",agent_versions:{agent_definitions:{code:"a14_operativa_meta"}}}}),
      ()=>decideAgentOutput(env,context("user",true),org,org,decision,undefined,decision==="dismiss_proposal"?[{index:0,skip:true}]:undefined));
    assert.equal(result.ok,false);assert.equal(calls.length,1);
  }
});
test("invalid edits are rejected before reading or mutating Supabase",async()=>{
  const {result,calls}=await withFetch(()=>{throw Error("must not read");},()=>decideAgentOutput(env,context(),org,org,"approved",undefined,[{index:-1}]));
  assert.equal(result.ok,false);assert.equal(calls.length,0);
});
test("authorized detail scopes linked tasks to the same store and suppresses an unknown task ID",async()=>{
  const {result}=await withFetch((url)=>{
    if(url.pathname.endsWith("/agent_outputs"))return {id:org,run_id:org,status:"approved",output:{proposed_writes:[{kind:"task",title:"Review"}],proposal_decisions:[{index:0,status:"created",task_id:"foreign-task"}]}};
    if(url.pathname.endsWith("/agent_runs"))return {organization_id:org,store_id:store,agent_versions:{agent_definitions:{code:"a14_operativa_meta"}}};
    if(url.pathname.endsWith("/agent_approvals"))return null;
    if(url.pathname.endsWith("/tasks")){assert.equal(url.searchParams.get("store_id"),`eq.${store}`);return [];}
    throw Error(`Unexpected read ${url.pathname}`);
  },()=>getAgentOutputDetail(env,context("user",true),org,org));
  assert.equal(result.ok,true);
  if(result.ok)assert.equal(result.data.proposals[0]?.task,null);
});
test("notifications contain only visible tasks from the recipient's permitted stores",()=>{
  const batches=agentTaskNotificationBatches([
    {user_id:"owner",access_scope:"organization",store_ids:null,store_id:null},
    {user_id:"store-a-user",access_scope:"store",store_ids:[store],store_id:null},
    {user_id:"store-b-user",access_scope:"store",store_ids:["store-b"],store_id:null},
  ],[
    {id:"a",title:"Store A",store_id:store,is_visible_to_client:true},
    {id:"b",title:"Store B",store_id:"store-b",is_visible_to_client:true},
    {id:"global",title:"Organization",store_id:null,is_visible_to_client:true},
    {id:"internal",title:"Private",store_id:store,is_visible_to_client:false},
  ]);
  assert.deepEqual(batches.map((batch)=>[batch.userId,batch.taskIds]),[["owner",["a","b","global"]],["store-a-user",["a"]],["store-b-user",["b"]]]);
});
test("an actual approval retry keeps the existing task in its receipt without writing another task",async()=>{
  const body={proposed_writes:[{kind:"task",title:"Review costs",priority:"high"}],proposal_decisions:[]};
  let finalReceipt:Record<string,unknown>|null=null;
  let taskWrites=0;
  const existing={id:"existing-task",title:"Review costs",store_id:store,metadata:{}};
  const {result}=await withFetch((url,init)=>{
    const table=url.pathname.split("/").at(-1);
    if(table==="agent_outputs")return url.searchParams.get("select")?.startsWith("agent_runs")
      ? {agent_runs:{organization_id:org,store_id:store,agent_versions:{agent_definitions:{code:"a04_generador_tareas"}}}}
      : {id:org,run_id:org,output:body};
    if(table==="agent_runs")return {organization_id:org,store_id:store,agent_version_id:org,agent_versions:{agent_definitions:{code:"a04_generador_tareas"}}};
    if(table==="agent_versions")return {definition_id:org,agent_definitions:{code:"a04_generador_tareas"}};
    if(table==="agent_definitions")return {code:"a04_generador_tareas"};
    if(table==="claim_agent_output_decision_checked")return {claimed:true,output:{...body,proposal_edits:[],decision_intent:"approved"},context:{edits:[],agent_version_id:org}};
    if(table==="validate_agent_output_decision_claim")return true;
    if(table==="tasks"){
      if(init?.method && init.method!=="GET")taskWrites++;
      return url.searchParams.has("agent_proposal_index")?existing:[existing];
    }
    if(table==="consultant_assignments")return [];
    if(table==="finalize_agent_output_decision"){
      finalReceipt=JSON.parse(String(init?.body));
      return {ok:true,receipt_id:"receipt-1",source_hash:"f".repeat(64)};
    }
    if(table==="audit_logs" || table==="memory_ingestion_queue")return null;
    throw Error(`Unexpected synthetic transport call ${url.pathname}`);
  },()=>decideAgentOutput(env,context("consultant"),org,org,"approved",undefined));
  assert.equal(result.ok,true);assert.equal(taskWrites,0);
  assert.ok(finalReceipt);
  assert.equal((finalReceipt as Record<string,unknown>).p_tasks_created,1);
  assert.deepEqual(((finalReceipt as Record<string,unknown>).p_decisions as Array<Record<string,unknown>>).map((item)=>[item.status,item.task_id]),[["created","existing-task"]]);
});
test("unknown executors and an agent version changed at claim time never fall back to generic task writes",async()=>{
  for(const missingExecutor of [true,false]){
    const {result,calls}=await withFetch((url)=>{
      const table=url.pathname.split("/").at(-1);
      if(table==="agent_outputs")return url.searchParams.get("select")?.startsWith("agent_runs")
        ? {agent_runs:{organization_id:org,store_id:store,agent_versions:{agent_definitions:{code:"a14_operativa_meta"}}}}
        : {id:org,run_id:org,output:{proposed_writes:[{kind:"task",title:"Must not materialize"}]}};
      if(table==="agent_runs")return {agent_version_id:org};
      if(table==="agent_versions")return {agent_definitions:missingExecutor?{}:{code:"a14_operativa_meta"}};
      if(table==="claim_agent_output_decision_checked")return {claimed:true,output:{proposed_writes:[]},context:{edits:[],agent_version_id:"changed-version"}};
      if(table==="release_agent_output_decision")return true;
      throw Error(`Unexpected write/read ${url.pathname}`);
    },()=>decideAgentOutput(env,context("consultant"),org,org,"approved",undefined));
    assert.equal(result.ok,false);
    assert.ok(calls.every((path)=>!path.endsWith("/tasks") && !path.endsWith("/finalize_agent_output_decision")));
  }
});
