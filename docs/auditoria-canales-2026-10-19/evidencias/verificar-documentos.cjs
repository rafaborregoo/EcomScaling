const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const dir = path.join(root,'docs/auditoria-canales-2026-10-19');
const docs = [path.join(root,'docs/PLAN_ORGANIZACION_CANALES_STOCK_Y_AUDITORIA_2026-10-19.md'), ...fs.readdirSync(dir).filter(p=>p.endsWith('.md')).map(p=>path.join(dir,p))];
const missing = [];
let checked = 0;
for (const file of docs) {
  const body = fs.readFileSync(file,'utf8');
  if (body.includes('\uFFFD')) missing.push({file:path.relative(root,file),reason:'replacement-character'});
  for (const match of body.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g,'');
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    checked++;
    const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!fs.existsSync(path.resolve(path.dirname(file),clean))) missing.push({file:path.relative(root,file),target});
  }
}
const result = {audit_date:'2026-10-19',documents:docs.length,local_links_checked:checked,errors:missing};
fs.writeFileSync(path.join(dir,'evidencias/verificacion-documentos.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(missing.length) process.exitCode=1;
