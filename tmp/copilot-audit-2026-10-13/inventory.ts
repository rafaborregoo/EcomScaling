import fs from 'node:fs';
import { TOOL_REGISTRY, TOOL_CONTRACTS } from '../../packages/ai/src/tool-layer.ts';
import { sanitizeForTelemetry } from '../../packages/observability/src/index.ts';
const rows = TOOL_REGISTRY.map(t => ({name:t.name,status:t.status,permission:t.permission,connector:t.connector,contract:!!TOOL_CONTRACTS[t.name]}));
fs.writeFileSync('tmp/copilot-audit-2026-10-13/tool-inventory.json', JSON.stringify(rows,null,2));
const reportPath = 'docs/AUDITORIA_INTEGRAL_COPILOTO_2026-10-13.md';
const table = ['| Tool | Estado | Permiso | Conector | Contrato |','|---|---|---|---|---|',...rows.map(t=>`| \`${t.name}\` | ${t.status==='planned'?'Planificada':'Parcial'} | ${t.permission} | ${t.connector??'Ninguno'} | ${t.contract?'Sí':'No'} |`)].join('\n');
let report = fs.readFileSync(reportPath,'utf8');
if (report.includes('### H14 · P1')) {
  const rename: Record<string,string> = {H14:'H10',H10:'H11',H11:'H12',H12:'H13',H13:'H14'};
  report=report.replace(/\bH(?:10|11|12|13|14)\b/g,id=>rename[id]);
  fs.writeFileSync(reportPath,report);
}
if (!report.includes('| Tool | Estado | Permiso | Conector | Contrato |')) fs.appendFileSync(reportPath,table+'\n');
const probes = {missingContracts:rows.filter(t=>t.status==='implemented_partial'&&!t.contract).map(t=>t.name),syntheticTextRedaction:sanitizeForTelemetry({message:'Bearer TOKEN_FICTICIO'}),syntheticKeyRedaction:sanitizeForTelemetry({access_token:'TOKEN_FICTICIO'})};
fs.writeFileSync('tmp/copilot-audit-2026-10-13/probes.json',JSON.stringify(probes,null,2));
console.log(JSON.stringify({total:rows.length,implemented:rows.filter(t=>t.status==='implemented_partial').length,planned:rows.filter(t=>t.status==='planned').length,probes}));
