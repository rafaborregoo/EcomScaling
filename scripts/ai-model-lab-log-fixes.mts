import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { FINDINGS } from "../apps/web/src/app/admin/auditoria-ia/audit-data.js";

const path = resolve(".e-nora-test-lab/ai-models/report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
if (report.results.some((r) => r.status === "running"))
  throw new Error("runner_still_active");
for (const [index, finding] of FINDINGS.entries()) {
  const id = `audit:${index}`;
  report.issues = report.issues.filter((i) => i.id !== id);
  report.issues.push({
    id,
    title: finding.title,
    severity: finding.priority === "Alta" ? "high" : "medium",
    detail: finding.detail,
    status: "resolved" in finding && finding.resolved ? "fixed" : "open",
    agent_code: null,
    evidence: finding.evidence,
    resolution: finding.action,
  });
}
const extra: typeof report.issues = [
  {
    id: "integration-context-scope",
    severity: "medium",
    title: "El contexto de integraciones no identifica cada tienda",
    detail:
      "Los casos originales incluyen estados de integraciones de la organización sin identificadores de tienda. No permiten deducir un único estado de conexión de la tienda activa ni la causa de un snapshot vacío. Algunas respuestas requieren revisión por esa atribución.",
    status: "limited",
    agent_code: null,
    evidence: "scripts/ai-model-lab-export.mts · integration_status_at_export",
    resolution:
      "Conservar los casos congelados; añadir la limitación explícita a futuras exportaciones y contrastar cualquier atribución con la conexión de la tienda antes de usarla para seleccionar modelos.",
  },
  {
    id: "strict-output-schema",
    severity: "high",
    title: "JSON Schema estricto podía rechazar salidas de agentes",
    detail:
      "Se declaraban seis propiedades de proposed_writes sin incluirlas en required. Los proveedores con salida estricta pueden rechazar ese esquema antes de generar una respuesta.",
    status: "fixed",
    agent_code: null,
    evidence:
      "packages/ai/src/index.ts · agentOutputJsonSchema; prueba de todos los contratos JSON estrictos",
    resolution:
      "Incluidos los seis campos en required y eliminadas duplicaciones al extender contratos A13/A14/A26. Suite IA: 97/97 pruebas aprobadas.",
  },
  {
    id: "stale-test-fixtures",
    severity: "medium",
    title: "Fixtures de A23 y análisis de imágenes desactualizados",
    detail:
      "Las pruebas no incluían campos que los contratos actuales ya requieren. Esto generaba fallos aunque la validación estuviera funcionando como se diseñó.",
    status: "fixed",
    agent_code: null,
    evidence: "packages/ai/src/index.test.ts",
    resolution:
      "Actualizadas las entradas de prueba, manteniendo los controles de abstención, medición y formato. No se relajaron los contratos de producción.",
  },
  {
    id: "provider-quotas",
    severity: "medium",
    title: "Las suscripciones han limitado esta tanda",
    detail: `Claude y Codex devolvieron límites de uso reales en la primera tanda. Tras la reanudación, el estado actual conserva ${report.results.filter((r) => r.status === "completed").length} respuestas, ${report.results.filter((r) => r.status === "failed").length} fallos y ${report.results.filter((r) => r.status === "blocked").length} combinaciones bloqueadas. Los intentos anteriores se conservan en el informe archivado.`,
    status: "limited",
    agent_code: null,
    evidence: "report.json y recibos de los proveedores",
    resolution:
      "Reanudar solo lo bloqueado y lo pendiente cuando vuelva la cuota, sin usar API de pago ni repetir respuestas terminadas.",
  },
  {
    id: "camino-timeout",
    severity: "high",
    title:
      "El arquitecto de Mi camino necesita una prueba con límites adecuados",
    detail:
      "Cinco modelos superaron el límite común de 150 segundos. Luna devolvió texto que no se pudo interpretar como JSON. Estos resultados no permiten concluir qué modelo razona mejor para este entregable largo.",
    status: "open",
    agent_code: "a19_arquitecto_camino",
    evidence: "Seis recibos de a19_arquitecto_camino:ffc6422fd3c3",
    resolution:
      "Añadida una tanda separada con hasta 420 segundos y contrato nativo de salida. Conservar los primeros intentos y comparar duración, cumplimiento del contrato y contenido; las herramientas del runtime siguen pendientes.",
  },
  {
    id: "history-not-current",
    severity: "medium",
    title: "No interpretar inventario histórico como estado actual",
    detail:
      "En respuestas de la tanda hay afirmaciones operativas sobre hoy basadas en contextos de octubre. Son señales de revisión del contenido, no una conclusión sobre el inventario vigente.",
    status: "open",
    agent_code: null,
    evidence: "Respuestas originales y revisión automática de A04",
    resolution:
      "Contrastar fecha y cita del dato en cada recomendación. La siguiente tanda debe incluir casos de datos caducados y reglas explícitas de frescura.",
  },
];
for (const issue of extra) {
  report.issues = report.issues.filter((i) => i.id !== issue.id);
  report.issues.push(issue);
}
report.updated_at = new Date().toISOString();
await writeFile(
  path,
  JSON.stringify(aiModelLabReportSchema.parse(report), null, 2),
);
console.log(
  `Registro actualizado: ${report.issues.length} incidencias generales y por agente.`,
);
