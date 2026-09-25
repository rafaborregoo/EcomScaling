/**
 * AI-07: validacion en vivo del pipeline completo de memoria acumulativa
 * (`enqueueMemoryIngestion` -> `processMemoryIngestionQueue` -> `knowledge_search`)
 * contra Voyage real, no contra datos sembrados a mano como hace
 * `db-11-knowledge-search-isolation.test.ts`. Cierra el hueco de evidencia
 * que documentaba AI-07-memoria-acumulativa-consultor-experto.md: hasta
 * ahora solo se probaba `knowledge_search` con chunks insertados
 * directamente, nunca el camino real desde una fuente humana.
 *
 * Cuesta una llamada real a Voyage (dinero, minimo) -- no correr en cada PR.
 * Ejecutar manualmente con `npm run validate:ai07 -w @e-nora/api`.
 */
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { enqueueMemoryIngestion, processMemoryIngestionQueue } from "./memory-ingestion.js";

const env = loadApiEnv(process.env);
const logger = createLogger("validate-ai07-pipeline");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;

async function main() {
  if (!env.VOYAGE_API_KEY) {
    logger.error("VOYAGE_API_KEY no configurada -- no se puede validar el pipeline real");
    process.exitCode = 1;
    return;
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ display_name: `AI-07 Pipeline Validation ${RUN_TAG}`, slug: `ai07-pipeline-${RUN_TAG}`, status: "active" })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(`No se pudo crear la organizacion de prueba: ${orgError?.message}`);
  }

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  const sourceEntityId = crypto.randomUUID();

  try {
    const enqueueResult = await enqueueMemoryIngestion(env, {
      organizationId: org.id,
      storeId: null,
      sourceType: "internal_note",
      sourceEntityType: "task_comment",
      sourceEntityId,
      sourceActorId: null,
      audience: "consultant_only",
      origin: "human_authored",
      authority: "operational",
      title: "Validacion AI-07: nota interna de prueba",
      content:
        "Restriccion de prueba: nunca aplicar descuentos superiores al 20% en la categoria calzado sin autorizacion previa del cliente.",
    });

    checks.push({
      name: "enqueue_succeeds",
      pass: enqueueResult.ok === true,
      detail: JSON.stringify(enqueueResult),
    });

    if (enqueueResult.ok !== true || !enqueueResult.documentId) {
      throw new Error("enqueueMemoryIngestion no devolvio un document_id, no se puede seguir validando");
    }

    const { data: beforeProcessing } = await admin
      .from("knowledge_documents")
      .select("status")
      .eq("id", enqueueResult.documentId)
      .single();

    checks.push({
      name: "document_starts_pending_indexing",
      pass: beforeProcessing?.status === "pending_indexing",
      detail: `status antes de procesar: ${beforeProcessing?.status}`,
    });

    const processResult = await processMemoryIngestionQueue(env);

    checks.push({
      name: "queue_processing_ran_without_failures",
      pass: processResult.failed === 0,
      detail: JSON.stringify(processResult),
    });

    const { data: afterProcessing } = await admin
      .from("knowledge_documents")
      .select("status")
      .eq("id", enqueueResult.documentId)
      .single();

    checks.push({
      name: "document_becomes_active_after_processing",
      pass: afterProcessing?.status === "active",
      detail: `status despues de procesar: ${afterProcessing?.status}`,
    });

    const { data: chunks } = await admin
      .from("knowledge_chunks")
      .select("id")
      .eq("document_id", enqueueResult.documentId);

    checks.push({
      name: "chunks_created",
      pass: (chunks?.length ?? 0) > 0,
      detail: `chunks creados: ${chunks?.length ?? 0}`,
    });

    // Criterio de cierre: audience_allowed=['client_visible'] nunca ve una
    // nota consultant_only real generada por el pipeline (no por un chunk
    // sembrado a mano).
    const { data: embeddingProbe } = await admin.rpc("knowledge_search", {
      target_organization_id: org.id,
      query_embedding: JSON.stringify(Array.from({ length: 1024 }, () => 0)),
      audience_allowed: ["client_visible"],
      match_count: 50,
    });

    const leakedToClient = (embeddingProbe ?? []).some(
      (row: { document_id: string }) => row.document_id === enqueueResult.documentId,
    );

    checks.push({
      name: "consultant_only_not_visible_to_client_audience",
      pass: !leakedToClient,
      detail: `filas devueltas: ${(embeddingProbe ?? []).length}, filtrado correcto: ${!leakedToClient}`,
    });

    const { data: consultantProbe, error: consultantProbeError } = await admin.rpc("knowledge_search", {
      target_organization_id: org.id,
      query_embedding: JSON.stringify(Array.from({ length: 1024 }, () => 0)),
      audience_allowed: ["client_visible", "consultant_only"],
      match_count: 50,
    });

    const visibleToConsultant = (consultantProbe ?? []).some(
      (row: { document_id: string }) => row.document_id === enqueueResult.documentId,
    );

    checks.push({
      name: "consultant_only_visible_to_consultant_audience",
      pass: !consultantProbeError && visibleToConsultant,
      detail: `error: ${consultantProbeError?.message ?? "none"}, encontrado: ${visibleToConsultant}`,
    });

    // Idempotencia: volver a encolar la misma fuente/version no crea un
    // segundo documento.
    const secondEnqueue = await enqueueMemoryIngestion(env, {
      organizationId: org.id,
      storeId: null,
      sourceType: "internal_note",
      sourceEntityType: "task_comment",
      sourceEntityId,
      sourceActorId: null,
      audience: "consultant_only",
      origin: "human_authored",
      authority: "operational",
      title: "Validacion AI-07: nota interna de prueba (reintento)",
      content: "Contenido repetido para probar idempotencia.",
    });

    checks.push({
      name: "duplicate_enqueue_detected_as_duplicate",
      pass: secondEnqueue.ok === true && secondEnqueue.duplicate === true,
      detail: JSON.stringify(secondEnqueue),
    });

    const { count: documentCountAfterDuplicate } = await admin
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id);

    checks.push({
      name: "no_duplicate_document_created",
      pass: documentCountAfterDuplicate === 1,
      detail: `documentos totales para la organizacion de prueba: ${documentCountAfterDuplicate}`,
    });
  } finally {
    await admin.from("organizations").delete().eq("id", org.id);
  }

  const failed = checks.filter((check) => !check.pass);

  logger.info("AI-07 pipeline validation results", { checks });
  for (const check of checks) {
    logger.info(`${check.pass ? "PASS" : "FAIL"} ${check.name}`, { detail: check.detail });
  }

  if (failed.length > 0) {
    logger.error(`${failed.length}/${checks.length} checks fallaron`);
    process.exitCode = 1;
  } else {
    logger.info(`${checks.length}/${checks.length} checks pasaron`);
  }
}

main().catch((error: unknown) => {
  logger.error("AI-07 pipeline validation crashed", error);
  process.exitCode = 1;
});
