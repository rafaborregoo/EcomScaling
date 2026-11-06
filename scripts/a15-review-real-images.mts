import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { instagramImageAnalysisSchema } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { normalizeOutput, parseOutput } from "./ai-model-lab-core.js";
const root = ".e-nora-test-lab/ai-models", path = `${root}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
const notes: Record<string,string[]> = {
  "claude-haiku-5-5": ["Reconoce formas, snowboard y texto principal; precio muy bajo.", "En producto llama inferior a la cara con insertos, una identificación no acreditada; propone aumentar texto/icono del propio diseño. Menor OCR regional que Terra/Sol. En la imagen abstracta tiende a suponer plantilla comercial, sin brief que lo confirme."],
  "claude-sonnet-5-5": ["Descripción y OCR regional útiles; en la tanda final respeta el máximo de ocho colores.", "Añade bastantes valoraciones sin finalidad confirmada, incluso ausencia de producto/mensaje en la composición abstracta. Más extensión no equivale a mayor utilidad. La primera salida con nueve colores pertenecía al fallo de contrato del backend, no se usa para penalizar esta tanda."],
  "claude-opus-5-5": ["La ficha de catálogo es detallada y conserva diferencias entre observación e inferencia.", "En formas abstractas declara que no sirve como pieza final por no tener producto/mensaje/CTA, aunque no hay brief que exija esos elementos. El mayor precio no aporta ventaja suficiente para esta clasificación visual."],
  "gpt-6-luna": ["Conciso, reconoce el producto y los dos textos principales, sin inventar precio ni rendimiento.", "Clasifica el JPEG 1600×1600 como portrait, aunque es square. Confianza alta. Ese error de proporción es relevante para reutilizar imágenes por formato."],
  "gpt-6.1-sol": ["Segundo modelo: descripción fiel, OCR fullstack/<158cm>/S, formato correcto y recomendaciones de detalle/encuadre que conservan la imagen del producto.", "No exige CTA ni producto a la composición abstracta. Más caro que Terra, sin una mejora suficiente en los campos relevantes de estas dos imágenes para ser el principal."],
  "gpt-6.1-terra": ["Principal: formato correcto en ambas imágenes; OCR vacío en formas y fullstack/<158cm>/S en catálogo. Objetos, alt y usos pertinentes sin inventar promociones, SKU visible ni éxito comercial.", "Distingue las dos caras como inferencia y propone zoom/encuadre sin cambiar el producto. Menor coste que Sol con cobertura comparable en esta muestra. Los colores hex son aproximaciones visuales, no mediciones.", "Dos imágenes no prueban calidad en todos los sectores, OCR difícil, vídeos ni carruseles. Sol es fallback de modelo dentro de OpenAI, no ante caída total del proveedor."],
};
const summaries = [];
for (const model of ["claude-haiku-5-5","claude-sonnet-5-5","claude-opus-5-5","gpt-6-luna","gpt-6.1-sol","gpt-6.1-terra"]) {
  const samples = report.results.filter(row => row.model_id === model && row.case_id.startsWith("a15_analista_imagenes:real-store-runtime-2026-11-05-") && row.case_id.endsWith("-contract")); assert.equal(samples.length,2);
  const cases = samples.map(row => {
    assert.equal(row.status,"completed"); const analysis = instagramImageAnalysisSchema.parse(parseOutput(row.raw_response));
    row.normalized = normalizeOutput(row.raw_response);
    row.review = { status:"reviewed",method:"automated",reviewer:"Codex · inspección de imágenes y contraste de campos",verdict:model==="gpt-6.1-terra"?"Terra principal; Sol segundo modelo.":"Comparación visual revisada; ver observaciones.",notes:[...notes[model],"Revisión retrospectiva del asistente sobre los píxeles originales, sin panel humano independiente. Mismos bytes en los seis modelos, sin herramientas ni API pagada. Tarifas guardadas del catálogo; equivalente API, no factura."] };
    const u=row.usage,total=model.startsWith("claude-")?Number(u.input??0)+Number(u.cached??0)+Number(u.cache_creation??0):Number(u.input??0);
    const price=calculateLabApiPrice(model,{input:total,cached:0,cache_creation:0,output:u.output}); assert.ok(price);
    return { case_id:row.case_id,native:true,aspect:analysis.aspect_ratio_estimate,aspect_correct:analysis.aspect_ratio_estimate==="square",ocr:analysis.ocr_text,findings:analysis.design_findings.length,input_total:total,output_tokens:u.output,cold_usd:price.low };
  });
  summaries.push({model,cases,profile:{input_total:cases.reduce((s,c)=>s+c.input_total,0)/2,cache_read:0,output:cases.reduce((s,c)=>s+Number(c.output_tokens),0)/2},mean_usd:cases.reduce((s,c)=>s+c.cold_usd,0)/2,monthly_20_images_usd:cases.reduce((s,c)=>s+c.cold_usd,0)*10,notes:notes[model]});
}
for(const row of report.results.filter(row=>row.case_id.startsWith("a15_analista_imagenes:real-store-runtime-2026-11-05-")&&!row.case_id.endsWith("-contract"))){row.normalized=normalizeOutput(row.raw_response);row.review={status:"reviewed",method:"automated",reviewer:"Codex · auditoría de contrato",verdict:"Tanda inicial sustituida por contrato compartido; originales conservados.",notes:["El contrato JSON manual no comunicaba todos los límites de Zod. No usar para ranking final; ver los dos casos terminados en -contract."]};}
await writeFile(`${path}.tmp`,JSON.stringify(aiModelLabReportSchema.parse(report),null,2));await rename(`${path}.tmp`,path);
await mkdir(".e-nora-test-lab/a15-real-2026-11-05",{recursive:true});await writeFile(".e-nora-test-lab/a15-real-2026-11-05/review.json",JSON.stringify({primary:"gpt-6.1-terra",fallback:"gpt-6.1-sol",summaries},null,2));
console.log(JSON.stringify(summaries.map(({cases,notes,...row})=>row),null,2));
