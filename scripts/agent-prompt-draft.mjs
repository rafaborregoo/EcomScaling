// Inserta en TEST un borrador de prompt (prompt base + sección) y una versión
// inactiva gpt-6-luna que lo usa, para iterar con npm run eval:agent:fixtures.
// Se niega a tocar produccion.
// Uso (desde la raiz): node scripts/agent-prompt-draft.mjs <agent_code> <prompt_base> <seccion.txt> <prompt_version> <agent_version>
import pg from "pg"; import fs from "fs"; import crypto from "crypto";
const [agentCode, basePrompt, sectionFile, promptVersion, agentVersion] = process.argv.slice(2);
if (!agentVersion) throw new Error("uso: agent-prompt-draft.mjs <agent_code> <prompt_base> <seccion.txt> <prompt_version> <agent_version>");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
if (/eu-west-3/.test(env.SUPABASE_DB_URL)) throw new Error("no en produccion");
const c=new pg.Client({connectionString:env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});await c.connect();
const active=(await c.query("select v.prompt_code, v.allowed_tools, v.approval_mode from agent_versions v join agent_definitions d on d.id=v.definition_id where d.code=$1 and v.is_active",[agentCode])).rows[0];
const base=(await c.query("select content from prompt_versions where code=$1 and version=$2",[active.prompt_code,basePrompt])).rows[0].content;
const content=base+fs.readFileSync(sectionFile,"utf8").replace(/\r\n/g,"\n").replace(/\n+$/,"");
await c.query("insert into prompt_versions(code,version,content,checksum) values($1,$2,$3,$4) on conflict (code,version) do nothing",[active.prompt_code,promptVersion,content,crypto.createHash("sha256").update(content).digest("hex")]);
const r=await c.query("insert into agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active) select id,$1,'gpt-6-luna',$2,$3,$4::jsonb,$5,false from agent_definitions where code=$6 on conflict (definition_id,version) do nothing returning id",[agentVersion,active.prompt_code,promptVersion,JSON.stringify(active.allowed_tools),active.approval_mode,agentCode]);
console.log(r.rows[0]?.id ?? "ya existia");
await c.end();
