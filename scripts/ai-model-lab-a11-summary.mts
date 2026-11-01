import { readFile, writeFile } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

const dir = ".e-nora-test-lab/ai-models";
const path = `${dir}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
const rows = JSON.parse(await readFile(`${dir}/a11-drafts.prepared.json`, "utf8"));
const issue = report.issues.find(i => i.id === "a11-draft-metadata-storage-limits");
if (issue) Object.assign(issue, {
  title: "A11 podía generar un borrador válido que no cabía en la base de datos",
  detail: "El contrato de email admite tone hasta 300 caracteres, pero la columna admite 120. Instagram puede producir creative_brief de hasta 2000 para un preheader de 255 y resúmenes de 2000 para purpose de 500. La inserción inicial de los borradores falló de forma atómica, sin filas parciales.",
  resolution: "Se ajustan los metadatos al límite de almacenamiento y se conserva el original en request.generated_field_overflow y el output nativo. No cambia el copy. Corrección local pendiente de despliegue.",
});
const old = report.issues.find(i => i.id === "a08-historical-model-manifest-reconciled");
if (old) Object.assign(old, {
  title: "Manifiesto histórico de A08 reconciliado con las ejecuciones archivadas",
  detail: "El caso histórico declaraba Terra y omitía Astra, pero sus resultados archivados incluyen Astra y no Terra. Se corrige la lista del caso para describir la evidencia existente; no cambian respuestas ni asignaciones.",
  resolution: "Astra permanece solo como archivo histórico. Las comparaciones nuevas de A11 lo excluyen.",
});
await writeFile(path, JSON.stringify(report, null, 2));
const lines = [
  "# A11 · Revisión humana de marketing", "",
  "29 de octubre de 2026. Estado: evaluación pendiente del propietario; modelo sin reasignar.", "",
  "Cuenta: borregorafa99@gmail.com. Entorno TEST ES IA, organización del propietario, tienda E-NORA Demo.", "",
  "18 borradores: seis emails, seis anuncios de Meta y seis publicaciones de Instagram. Todos en estado draft, sin fecha de envío ni publicación. Busca [LAB A11] en Marketing > Contenido y abre cada pieza en el Estudio.", "",
  "Tres casos sintéticos por seis modelos, con prompt activo v11 y 18/18 contratos válidos. No son productos reales. No se ejecutan herramientas ni se generan imágenes. Astra excluido. Claude confirma el ID solicitado; Codex no confirma el ID servido. Se completó también Terra sobre el snapshot histórico, conservado aparte.", "",
  "| Canal | Modelo | API estimada USD | Borrador |", "| --- | --- | --- | --- |",
  ...rows.map((r: any) => `| ${r.request.channel} | ${r.request.ai_lab.model_label} | ${r.request.ai_lab.estimated_api_cost_low.toFixed(4)}–${r.request.ai_lab.estimated_api_cost_high.toFixed(4)} | ${r.id} |`), "",
  "El precio estima tarifas API sobre consumo CLI con sobrecarga; no es factura ni medición de rendimiento API. A11 es manual: la referencia de cuatro generaciones al mes debe ajustarse a la frecuencia elegida por el propietario.", "",
  "## Qué revisar", "",
  "Voz de marca, claridad, literal obligatorio, fidelidad a atributos y precio, estructura y paleta del email, enlace de baja, CTA y formato de cada canal. Comprobar primero si la pieza sirve y después su precio. Los blancos y grises añadidos requieren criterio editorial; no se clasifican automáticamente como fallo.", "",
  "Los seis modelos mantuvieron destination_url=null ante la URL ausente y approval_required=true. En Instagram, los seis devolvieron carousel y captions dentro del límite. Esto no certifica calidad editorial ni envío real.", "",
  "## Fallos y verificación", "",
  "- Corregido el desbordamiento de tone, preheader y purpose al guardar. El original se conserva y el borrador muestra una advertencia; no se cambia el copy. Dos pruebas de regresión correctas. Corrección de runtime local, pendiente de despliegue.",
  "- Reconciliado un manifiesto histórico de A08 que declaraba Terra donde sus resultados archivados incluían Astra. No cambia ninguna respuesta ni decisión de modelo.",
  "- Artefactos del laboratorio verificados: hashes de prompts, contextos y esquemas; 57 casos y 356 combinaciones históricas en total.",
  "- Los 18 borradores tienen snapshot inicial de versión 1. La exportación usa IDs estables y no sobrescribe posteriores revisiones humanas.",
  "- Visibilidad comprobada con el rol authenticated y el UID del propietario: 18 borradores visibles, todos sin programación. Esto comprueba acceso en base de datos, no sustituye una inspección visual del navegador.", "",
  "Artefactos privados en .e-nora-test-lab/ai-models: report.json, a11-drafts.prepared.json, a11-drafts.manifest.json y receipts. Resumen reproducible: scripts/ai-model-lab-a11-summary.mts.",
];
await writeFile("docs/A11_REVISION_HUMANA_MARKETING_2026-10-29.md", lines.join("\n") + "\n");
console.log(JSON.stringify({ agent: "a11_generador_marketing", drafts: rows.length, verdict: "pending_human_review" }));
