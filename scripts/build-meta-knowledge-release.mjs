import { readFile, writeFile, readdir } from "node:fs/promises";
import { RAG_EMBEDDING_PROFILE } from "@e-nora/ai";
import { checksumDe } from "./ingest-conocimiento.mjs";
import { releaseText } from "./knowledge-release.mjs";

const phase = "conocimiento/fase-05/01-rag-produccion/";
const meta = "conocimiento/meta-ads/01-rag-produccion/";
const targets = {
  acquisition: phase + "5.01-playbooks-de-adquisicion-y-diversificacion.md",
  structure: phase + "5.02-estructura-audiencias-creative-y-testing.md",
  attribution: phase + "5.02-atribucion-incrementalidad-calidad-y-madurez.md",
  economics: phase + "5.04-oferta-pricing-y-economics.md",
  bundles: phase + "5.04-aov-bundles-cross-sell-y-ofertas-de-valor.md",
  retention: phase + "5.05-retencion-cohortes-ltv-y-economia-de-relacion.md",
  incidents: meta + "META-K01_activos_medicion_e_incidencias.md",
  research: meta + "META-K02_investigacion_personas_y_evidencia_creativa.md",
  briefs: meta + "META-K03_briefs_inventario_y_brechas_creativas.md",
};
const verification =
  "conocimiento/fase-08/01-rag-produccion/8.15-verificacion-de-ejecucion.md";
const decisions = [
  [
    "META-001",
    "merge",
    ["incidents"],
    "Activos y accesos observables; no presumir facturación o permisos de escritura.",
  ],
  [
    "META-002",
    "extend",
    ["attribution", "incidents"],
    "A24 y fuentes compatibles; discrepancia no prueba error de píxel.",
  ],
  [
    "META-003",
    "extend",
    ["structure"],
    "Objetivo y estructura contextual; consolidación no universal.",
  ],
  [
    "META-004",
    "extend",
    ["acquisition", "attribution"],
    "Embudo con denominadores compatibles y causas por contrastar.",
  ],
  [
    "ECO-001",
    "extend",
    ["economics"],
    "Usar el motor financiero; no confundir ROAS atribuido con beneficio.",
  ],
  [
    "META-005",
    "merge",
    ["structure", "briefs"],
    "Hipótesis, activos observados y evaluación; no producción audiovisual inventada.",
  ],
  [
    "META-006",
    "extend",
    ["structure"],
    "Cadencia según señal, riesgo y economía; sin porcentajes ni días obligatorios.",
  ],
  [
    "META-007",
    "merge",
    ["incidents"],
    "Incidente observado, hipótesis y siguiente comprobación.",
  ],
  [
    "META-008",
    "reuse",
    [],
    "Reutilizar verificación y autorización existentes; no indexar promoción de proveedores.",
  ],
  [
    "GAP-VIDEO",
    "defer",
    [],
    "No acredita producción audiovisual; se conserva para IMP-11 fuera del índice.",
  ],
  [
    "META-SB-001",
    "extend",
    ["structure"],
    "Eliminar cortes universales de presupuesto y explicitar escenarios de señal.",
  ],
  [
    "META-SB-002",
    "extend",
    ["structure"],
    "Separar monitorización urgente e intervención; no inferir resets de aprendizaje.",
  ],
  [
    "META-SB-003",
    "extend",
    ["structure"],
    "Comparación descriptiva frente a experimento; sin significación automática.",
  ],
  [
    "META-SB-004",
    "merge",
    ["research", "retention"],
    "Necesidad y valor agregado como hipótesis; no perfiles sensibles ni targeting implícito.",
  ],
  [
    "META-SB-005",
    "merge",
    ["research"],
    "Permanencia de anuncio no demuestra resultados económicos.",
  ],
  [
    "META-SB-006",
    "extend",
    ["structure"],
    "Evaluar objetivo aprobado; no invalidar awareness por presupuesto.",
  ],
  [
    "META-SB-007",
    "merge",
    ["briefs"],
    "Orgánico aporta hipótesis, no validación de rentabilidad pagada.",
  ],
  [
    "META-SB-008",
    "extend",
    ["structure"],
    "Concentrar señal solo con restricciones y justificación de estructura.",
  ],
  [
    "ECO-SB-001",
    "extend",
    ["economics", "retention"],
    "Contribución, horizonte, payback y caja; no financiar pérdidas con LTV sin evidencia.",
  ],
  [
    "META-CR-001",
    "merge",
    ["briefs"],
    "Brief con problema, objetivo, hipótesis y condiciones de revisión.",
  ],
  [
    "META-CR-002",
    "merge",
    ["research", "bundles"],
    "Promesa y prueba, producto real y viabilidad económica.",
  ],
  [
    "META-CR-003",
    "merge",
    ["research"],
    "Muestra autorizada, sesgos y procedencia; no simular rastreo externo.",
  ],
  [
    "META-CR-004",
    "merge",
    ["research"],
    "Deduplicar, minimizar identificadores y exigir citas respaldadas.",
  ],
  [
    "META-CR-005",
    "merge",
    ["research"],
    "Personas como hipótesis agrupadas; no inferir salud individual.",
  ],
  [
    "META-CR-006",
    "merge",
    ["briefs"],
    "Separar ángulo, concepto, hook, formato, placement y objetivo; sin cuotas.",
  ],
  [
    "META-CR-007",
    "merge",
    ["research"],
    "Resolver el conflicto V2/V3 como inspiración abstracta y prueba propia.",
  ],
  [
    "META-CR-008",
    "merge",
    ["briefs"],
    "Brecha potencial frente a ausencia no evaluable o exclusión intencional.",
  ],
  [
    "META-CR-009",
    "merge",
    ["briefs"],
    "Planificación ligada a responsables y capacidad; no publicación implícita.",
  ],
  [
    "META-CR-010",
    "exclude",
    [],
    "Casos de marcas sin métricas verificadas; no indexar como evidencia de éxito.",
  ],
  [
    "ECO-CR-001",
    "extend",
    ["bundles"],
    "AOV proyectado no equivale a contribución; validar composición, costes y stock.",
  ],
];
const packagePath = (id) =>
  "Meta Ads-Instagram/" +
  (id.includes("-SB-")
    ? "ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2"
    : id.includes("-CR-")
      ? "ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3"
      : "ENORA_MetaAds_Conocimiento_Auditoria");
const sources = [];
for (const [id, decision, keys, reason] of decisions) {
  const folder = packagePath(id);
  const source =
    id === "GAP-VIDEO"
      ? folder + "/05-experience-learning/GAP_VIDEO_CREATIVOS_Y_PLAN_FUENTES.md"
      : folder +
        "/01-rag-produccion/" +
        (await readdir(folder + "/01-rag-produccion")).find((file) =>
          file.startsWith(id + "_"),
        );
  sources.push({
    id,
    path: source,
    checksum: checksumDe(releaseText(await readFile(source, "utf8"))),
    decision,
    targets:
      id === "META-008" ? [verification] : keys.map((key) => targets[key]),
    reason,
    evidence_kind: "provided_transcript_editorial_synthesis",
  });
}
const basesFile = "conocimiento/meta-ads/99-auditoria/bases.json";
const bases = JSON.parse(await readFile(basesFile, "utf8"));
const documents = [];
for (const target of Object.values(targets)) {
  const content = releaseText(await readFile(target, "utf8"));
  documents.push({
    path: target,
    title: content
      .split("\n")
      .find((line) => line.startsWith("# "))
      .slice(2)
      .trim(),
    checksum: checksumDe(content),
    base_id: bases[target]?.id ?? null,
  });
}
const questions = [
  [
    "incidents",
    "¿Un anuncio activo sin impresiones demuestra un problema creativo si no puedo comprobar la facturación?",
  ],
  [
    "attribution",
    "¿Una discrepancia entre compras Shopify y compras Meta prueba que el píxel está roto?",
  ],
  [
    "structure",
    "¿Con dos compras puedo declarar un ganador y cambiar presupuesto tras siete días fijos?",
  ],
  [
    "economics",
    "¿Un ROAS alto confirma beneficio si faltan costes y devoluciones conciliadas?",
  ],
  [
    "retention",
    "¿El LTV futuro previsto permite financiar pérdidas de adquisición sin comprobar payback y caja?",
  ],
  [
    "bundles",
    "¿Priorizar un bundle con AOV más alto aunque aporte menos contribución y falte stock?",
  ],
  [
    "research",
    "¿Cómo analizar reseñas duplicadas y evitar inferir atributos sensibles de personas?",
  ],
  [
    "research",
    "¿Un anuncio de competidor activo seis meses demuestra su ROAS o rentabilidad?",
  ],
  [
    "briefs",
    "¿Una miniatura permite describir el guion y audio completo de un vídeo?",
  ],
  [
    "briefs",
    "¿Una celda creativa vacía demuestra una brecha cuando el inventario está incompleto?",
  ],
  [
    "briefs",
    "¿Cómo ligar el brief y roadmap creativo a responsables, capacidad y revisión sin publicar automáticamente?",
  ],
  [
    "acquisition",
    "¿Muchos clics y pocas visitas prueban que la landing es lenta sin medir su rendimiento?",
  ],
].map(([key, question], index) => ({
  id: `META-RAG-${String(index + 1).padStart(2, "0")}`,
  question,
  expected_paths: [targets[key]],
  top_k: 8,
}));
const manifest = {
  schema_version: 1,
  release_id: "IMP04-meta-v1",
  prepared_on: "2026-11-03",
  project_ref: "cthjwpeygpzwdmjkxeqa",
  visibility: "global",
  audience: "consultant_only",
  authority: "operational",
  editorial_status: "implementation_review_complete_activation_pending",
  content_origin: "ai_assisted_editorial_synthesis_of_provided_sources",
  human_review: "not_claimed_by_implementation_agent",
  checksum_basis:
    "UTF-8, LF, trimmed; before-images retain their original bytes",
  profile: {
    model: RAG_EMBEDDING_PROFILE.model,
    dimensions: RAG_EMBEDDING_PROFILE.dimensions,
    chunking: RAG_EMBEDDING_PROFILE.version,
  },
  bases_file: basesFile,
  bases_checksum: checksumDe(JSON.stringify(bases)),
  sources,
  targets: documents,
  questions,
};
await writeFile(
  "conocimiento/meta-ads/99-auditoria/release-v1.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    sources: sources.length,
    targets: documents.length,
    new_documents: documents.filter((d) => !d.base_id).length,
    updates: documents.filter((d) => d.base_id).length,
    questions: questions.length,
  }),
);
