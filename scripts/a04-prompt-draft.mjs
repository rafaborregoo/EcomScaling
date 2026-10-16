// Inserta en TEST un borrador de prompt de A04 (v10 + scripts/a04-prompt-v11-section.txt) y una version
// inactiva gpt-6-luna que lo usa, para iterar con npm run eval:a04:fixtures. Se niega a tocar produccion.
// Uso (desde la raiz): node scripts/a04-prompt-draft.mjs <prompt_version> <agent_version>
import pg from "pg"; import fs from "fs"; import crypto from "crypto";
const [promptVersion, agentVersion] = process.argv.slice(2);
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
if (/eu-west-3/.test(env.SUPABASE_DB_URL)) throw new Error("no en produccion");
const c=new pg.Client({connectionString:env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});await c.connect();
const base=(await c.query("select content from prompt_versions where code='a04_generador_tareas_system' and version='v10'")).rows[0].content;
const content=base+fs.readFileSync("scripts/a04-prompt-v11-section.txt","utf8").replace(/\r\n/g,"\n").replace(/\n+$/,"");
await c.query("insert into prompt_versions(code,version,content,checksum) values('a04_generador_tareas_system',$1,$2,$3) on conflict (code,version) do nothing",[promptVersion,content,crypto.createHash("sha256").update(content).digest("hex")]);
const r=await c.query("insert into agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active) select id,$1,'gpt-6-luna','a04_generador_tareas_system',$2,'[\"sql_select\",\"search_knowledge\"]'::jsonb,'required_before_publish',false from agent_definitions where code='a04_generador_tareas' on conflict (definition_id,version) do nothing returning id",[agentVersion,promptVersion]);
console.log(r.rows[0]?.id ?? "ya existia");
await c.end();
