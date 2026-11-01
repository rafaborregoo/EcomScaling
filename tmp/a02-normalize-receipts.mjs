import { readFile, readdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
if (!process.env.SUPABASE_URL?.includes('kopcblejsxpkxoykldyh.supabase.co')) throw new Error('TEST only');
const db = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const root='.e-nora-test-lab/a02-kpi-refresh';
let count=0;
for(const dir of await readdir(root,{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  let rows;try{rows=JSON.parse(await readFile(`${root}/${dir.name}/summary.json`,'utf8'));}catch{continue;}
  for(const row of rows.filter(x=>x.ok)){
    const {data,error}=await db.from('agent_outputs').select('output').eq('id',row.output_id).single();if(error)throw error;
    if(data.output.ai_lab?.transport!=='codex_cli')throw new Error('Unexpected output transport');
    const warnings=data.output.warnings??[];
    if(!warnings.some(w=>w.includes('Codex CLI')))warnings.push('Laboratorio: ejecutado con Codex CLI y contexto real de TEST; costes API estimados, modelo solicitado sin ID servido verificado.');
    const saved=await db.from('agent_outputs').update({output:{...data.output,warnings}}).eq('id',row.output_id);if(saved.error)throw saved.error;
    const updated=await db.from('agent_runs').update({reasoning_tokens:row.provenance.cli_usage.reasoning_output_tokens??null}).eq('id',row.run_id);if(updated.error)throw updated.error;
    count++;
  }
}
console.log(JSON.stringify({normalized_receipts:count}));
