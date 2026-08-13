// AI-04: ingestion y busqueda de conocimiento (RAG con pgvector).
// Decision de arquitectura: pgvector dentro de Supabase con proveedor de
// embeddings intercambiable (VoyageEmbeddingProvider hoy); si algun dia se
// migra a una base vectorial separada, cambia esta capa y nada mas.
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { chunkText, VoyageEmbeddingProvider } from "@ecomscaling/ai";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv;

const EMBEDDING_BATCH_SIZE = 64;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireEmbeddings(env: ApiEnv) {
  if (!env.VOYAGE_API_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "embeddings_not_configured",
      message: "VOYAGE_API_KEY no esta configurada en el servidor.",
    };
  }

  return {
    ok: true as const,
    provider: new VoyageEmbeddingProvider(env.VOYAGE_API_KEY),
  };
}

type KnowledgeSearchRpcInput = {
  targetOrganizationId: string;
  queryEmbedding: string;
  queryText: string;
  audienceAllowed: string[];
  targetStoreId?: string | null | undefined;
  matchCount?: number;
};

function isHybridSearchMissing(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("knowledge_search_hybrid") &&
    (normalized.includes("does not exist") ||
      normalized.includes("could not find function") ||
      normalized.includes("could not find the function") ||
      normalized.includes("not found"))
  );
}

/** Shared RPC boundary for human search and agent tool search. */
export async function executeKnowledgeSearch(
  supabase: SupabaseClient,
  input: KnowledgeSearchRpcInput,
) {
  const hybrid = await supabase.rpc("knowledge_search_hybrid", {
    target_organization_id: input.targetOrganizationId,
    query_embedding: input.queryEmbedding,
    query_text: input.queryText,
    audience_allowed: input.audienceAllowed,
    target_store_id: input.targetStoreId ?? null,
    match_count: input.matchCount ?? 8,
  });

  if (!hybrid.error || !isHybridSearchMissing(hybrid.error.message)) {
    return hybrid;
  }

  // Safe deployment window: code may reach the API before the migration is
  // applied. The old semantic function has the same isolation contract.
  return supabase.rpc("knowledge_search", {
    target_organization_id: input.targetOrganizationId,
    query_embedding: input.queryEmbedding,
    audience_allowed: input.audienceAllowed,
    target_store_id: input.targetStoreId ?? null,
    match_count: input.matchCount ?? 8,
  });
}

function requireKnowledgeManager(
  context: AuthContext,
  organizationId: string | null,
) {
  // Conocimiento global = metodologia de la plataforma: solo platform admin.
  if (organizationId === null) {
    if (context.profile.platform_role !== "platform_admin") {
      return {
        ok: false as const,
        statusCode: 403,
        error: "global_knowledge_denied",
        message: "Solo un platform admin puede gestionar conocimiento global.",
      };
    }
    return { ok: true as const };
  }

  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );

  const canManage =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    (membership !== undefined &&
      ["owner", "manager"].includes(membership.role));

  if (!canManage) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "knowledge_access_denied",
      message:
        "Solo owner, manager, consultor o platform admin pueden gestionar conocimiento.",
    };
  }

  return { ok: true as const };
}

/**
 * Ingesta un documento: chunking por parrafos, embeddings por lotes y
 * persistencia de documento + chunks. `organizationId` null = conocimiento
 * global (metodologia EcomScaling); la visibilidad queda fijada aqui y el
 * constraint de DB impide estados incoherentes (lo privado nunca pasa a
 * global de forma implicita, criterio AI-04).
 */
export async function createKnowledgeDocument(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string | null,
  payload: {
    title?: unknown;
    description?: unknown;
    content?: unknown;
    source_type?: unknown;
  },
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const embeddings = requireEmbeddings(env);
  if (embeddings.ok === false) {
    return embeddings;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const content =
    typeof payload.content === "string" ? payload.content.trim() : "";
  const sourceType =
    typeof payload.source_type === "string" ? payload.source_type : "manual";

  if (!title || !content) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "title_y_content_requeridos",
    };
  }

  if (!["manual", "upload", "url", "call_transcript"].includes(sourceType)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "source_type_invalido",
    };
  }

  const chunks = chunkText(content);

  if (chunks.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "contenido_vacio_tras_chunking",
    };
  }

  const vectors: number[][] = [];
  for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const embedded = await embeddings.provider.embed(batch, "document");
    vectors.push(...embedded);
  }

  const supabase = createServiceClient(env);
  const checksum = crypto.createHash("sha256").update(content).digest("hex");

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: organizationId,
      title: title.slice(0, 255),
      description:
        typeof payload.description === "string" ? payload.description : null,
      source_type: sourceType,
      visibility: organizationId === null ? "global" : "organization",
      checksum,
      embedding_model: embeddings.provider.model,
      created_by: context.user.id,
    })
    .select("id, title, visibility, version")
    .single();

  if (documentError || !document) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_document_create_failed",
      detail: documentError?.message,
    };
  }

  const { error: chunksError } = await supabase.from("knowledge_chunks").insert(
    chunks.map((chunk, index) => ({
      document_id: document.id,
      organization_id: organizationId,
      chunk_index: index,
      content: chunk,
      token_count: Math.ceil(chunk.length / 4),
      embedding: JSON.stringify(vectors[index]),
    })),
  );

  if (chunksError) {
    // Sin chunks el documento no sirve: se marca archivado para no dejar
    // basura activa (no se borra: eso lo decide un humano).
    await supabase
      .from("knowledge_documents")
      .update({ status: "archived" })
      .eq("id", document.id);
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_chunks_insert_failed",
      detail: chunksError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "knowledge.create_document",
    entityType: "knowledge_document",
    entityId: document.id,
    newData: {
      visibility: document.visibility,
      source_type: sourceType,
      chunk_count: chunks.length,
    },
  });

  return {
    ok: true as const,
    data: {
      document_id: document.id,
      title: document.title,
      visibility: document.visibility,
      chunk_count: chunks.length,
      embedding_model: embeddings.provider.model,
    },
  };
}

export async function listKnowledgeDocuments(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  // BE-01 (bug de seguridad corregido 2026-07-28): la version anterior dejaba
  // pasar a CUALQUIER consultant/platform_admin sin comprobar membership para
  // ESTA organizacion (`!membership && !isPrivileged` nunca bloqueaba a un
  // rol privilegiado). RLS (`createUserScopedClient` abajo) ya evitaba que
  // esto filtrara documentos privados de otra organizacion, pero la capa de
  // Node no cumplia su propio principio de ser la primera linea de defensa.
  // `context.memberships` ya incluye las organizaciones virtuales de
  // platform_admin (todas) y consultant (solo asignadas), asi que comprobar
  // solo `membership` es correcto y suficiente.
  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_organization_id",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, organization_id, title, description, source_type, visibility, version, status, created_at, updated_at",
    )
    .or(`visibility.eq.global,organization_id.eq.${organizationId}`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_list_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: { organization_id: organizationId, documents: data ?? [] },
  };
}

/**
 * Busqueda semantica con citas: embeddings de la pregunta + knowledge_search
 * (global + privado del tenant, nunca privado de otros tenants).
 */
export async function searchKnowledge(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  query: unknown,
  storeId?: string | null,
) {
  // BE-01 (bug critico de seguridad encontrado y corregido 2026-07-28): a
  // diferencia de `listKnowledgeDocuments`, esta funcion llama a
  // `knowledge_search` via `createServiceClient` (service_role) mas abajo --
  // la funcion SQL confia ciegamente en `target_organization_id` sin RLS ni
  // verificacion propia (no es `security definer` con chequeo de sesion). La
  // version anterior de este gate dejaba pasar a CUALQUIER consultant/
  // platform_admin sin comprobar membership para ESTA organizacion, asi que
  // cualquier consultor de la plataforma (asignado o no) podia leer memoria
  // `consultant_only` (notas internas, decisiones sobre salidas de IA) de
  // CUALQUIER organizacion con solo conocer su `organizationId` -- sin RLS
  // que lo frenara como en el caso de arriba. `context.memberships` ya
  // incluye las organizaciones virtuales correctas (platform_admin: todas;
  // consultant: solo asignadas), comprobar solo `membership` es correcto.
  const isPrivileged = ["platform_admin", "consultant"].includes(
    context.profile.platform_role,
  );

  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const embeddings = requireEmbeddings(env);
  if (embeddings.ok === false) {
    return embeddings;
  }

  const queryText = typeof query === "string" ? query.trim() : "";

  if (!queryText) {
    return { ok: false as const, statusCode: 400, error: "query_requerida" };
  }

  const [embedding] = await embeddings.provider.embed([queryText], "query");
  const supabase = createServiceClient(env);

  // AI-07: busqueda humana desde /conocimiento (no un agente automatico), asi
  // que un consultor/platform_admin si puede ver memoria consultant_only;
  // un cliente con membership normal solo ve lo client_visible.
  const audienceAllowed = isPrivileged
    ? ["client_visible", "consultant_only"]
    : ["client_visible"];

  const { data, error } = await executeKnowledgeSearch(supabase, {
    targetOrganizationId: organizationId,
    queryEmbedding: JSON.stringify(embedding),
    queryText,
    audienceAllowed,
    targetStoreId: storeId,
    matchCount: 8,
  });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_search_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      query: queryText,
      matches: data ?? [],
    },
  };
}
