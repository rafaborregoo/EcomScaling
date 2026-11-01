// AI-04: ingestion y busqueda de conocimiento (RAG con pgvector).
// Decision de arquitectura: pgvector dentro de Supabase con proveedor de
// embeddings intercambiable (VoyageEmbeddingProvider hoy); si algun dia se
// migra a una base vectorial separada, cambia esta capa y nada mas.
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  applyRerank,
  chunkText,
  createRagEmbeddingProvider,
  RAG_RERANK_PROFILE,
  VoyageRerankProvider,
  type RerankProvider,
} from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  type AuthContext,
  createUserScopedClient,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { embedChunksInOrder } from "./embedding-batching.js";

type ApiEnv = LoadedApiEnv;

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
    provider: createRagEmbeddingProvider(env.VOYAGE_API_KEY),
  };
}

/**
 * El reranker es opcional a proposito: sin clave, la busqueda sigue
 * funcionando con el orden del retrieval. Nunca es motivo para devolver un
 * error, solo para devolver peor orden.
 */
export function createReranker(env: ApiEnv): RerankProvider | null {
  return env.VOYAGE_API_KEY
    ? new VoyageRerankProvider(env.VOYAGE_API_KEY)
    : null;
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

/**
 * Shared RPC boundary for human search and agent tool search.
 *
 * Con `reranker`, la busqueda pasa a dos fases: el SQL trae mas candidatos de
 * los que hacen falta y el reranker elige cuales suben. El reranker solo
 * REORDENA lo que la funcion SQL ya filtro, asi que no puede ampliar el
 * alcance de datos: la frontera de tenant / audiencia / tienda sigue estando
 * entera en el WHERE, que es donde tiene que estar (ver BE-01 en
 * searchKnowledge).
 */
export async function executeKnowledgeSearch(
  supabase: SupabaseClient,
  input: KnowledgeSearchRpcInput,
  reranker?: Pick<RerankProvider, "rerank"> | null,
) {
  const finalCount = input.matchCount ?? 8;
  // Sin reranker se pide exactamente lo que se va a devolver: traer de mas
  // para tirarlo seria pagar latencia por nada.
  const candidateCount = reranker
    ? Math.min(
        finalCount * RAG_RERANK_PROFILE.candidateFactor,
        RAG_RERANK_PROFILE.maxCandidates,
      )
    : finalCount;

  const result = await runKnowledgeSearchRpc(supabase, input, candidateCount);
  if (result.error || !reranker) {
    return result;
  }

  const rows = (result.data ?? []) as Array<{ content?: unknown }>;
  if (rows.length <= 1) return result;

  try {
    const ranked = await reranker.rerank(
      input.queryText,
      rows.map((row) => String(row.content ?? "")),
      finalCount,
    );
    return { ...result, data: applyRerank(rows, ranked, finalCount) };
  } catch {
    // El reranker es una mejora, no una dependencia: si el proveedor esta
    // caido o sin cuota, se sirve el orden del retrieval recortado. Devolver
    // un error aqui apagaria el RAG entero por no poder ordenarlo mejor.
    return { ...result, data: rows.slice(0, finalCount) };
  }
}

async function runKnowledgeSearchRpc(
  supabase: SupabaseClient,
  input: KnowledgeSearchRpcInput,
  matchCount: number,
) {
  const hybrid = await supabase.rpc("knowledge_search_hybrid", {
    target_organization_id: input.targetOrganizationId,
    query_embedding: input.queryEmbedding,
    query_text: input.queryText,
    audience_allowed: input.audienceAllowed,
    target_store_id: input.targetStoreId ?? null,
    match_count: matchCount,
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
    match_count: matchCount,
  });
}

export function requireKnowledgeManager(
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
        message: "Solo un administrador de la plataforma puede gestionar conocimiento global.",
      };
    }
    return { ok: true as const };
  }

  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;
  const { membership } = operational;

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
        "Solo el propietario, un gestor o el consultor pueden gestionar conocimiento.",
    };
  }

  return { ok: true as const };
}

/**
 * Ingesta un documento: chunking por parrafos, embeddings por lotes y
 * persistencia de documento + chunks. `organizationId` null = conocimiento
 * global (metodologia E-NORA); la visibilidad queda fijada aqui y el
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
    audience?: unknown;
    /** connectionId from the store selector; never accept a raw store_id. */
    connection_id?: unknown;
  },
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  // AI-07: subir metodologia que el cliente no debe leer (criterios de
  // pricing, notas de como tratar a esta cuenta) exige marcarla
  // `consultant_only`. Antes no habia forma de crearla desde la UI: todo
  // documento nacia `client_visible` por el default de la tabla. Marcarla es
  // privilegio de consultor/platform_admin -- un owner del cliente puede
  // gestionar conocimiento (requireKnowledgeManager) pero no crear material
  // oculto para su propia organizacion.
  const requestedAudience =
    typeof payload.audience === "string" ? payload.audience : "client_visible";

  if (!["client_visible", "consultant_only"].includes(requestedAudience)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "audience_invalida",
    };
  }

  if (
    requestedAudience === "consultant_only" &&
    !["platform_admin", "consultant"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_only_denied",
      message:
        "Solo el consultor puede marcar un documento como interno.",
    };
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

  const vectors = await embedChunksInOrder(chunks, embeddings.provider);

  const supabase = createServiceClient(env);
  let storeId: string | null = null;
  if (typeof payload.connection_id === "string" && payload.connection_id.trim()) {
    if (!organizationId) {
      return { ok: false as const, statusCode: 400, error: "store_scope_requires_organization" };
    }
    const { data: store, error: storeError } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", payload.connection_id.trim())
      .eq("is_active", true)
      .maybeSingle();
    if (storeError) {
      return { ok: false as const, statusCode: 500, error: "knowledge_store_scope_failed", detail: storeError.message };
    }
    if (!store) {
      return { ok: false as const, statusCode: 404, error: "knowledge_store_not_found" };
    }
    storeId = store.id;
  }
  const checksum = crypto.createHash("sha256").update(content).digest("hex");

  const { data: createdDocuments, error: documentError } = await (supabase as any).rpc(
    "create_knowledge_document_index",
    {
      p_organization_id: organizationId,
      p_store_id: storeId,
      p_title: title.slice(0, 255),
      p_description: typeof payload.description === "string" ? payload.description : null,
      p_source_type: sourceType,
      p_visibility: organizationId === null ? "global" : "organization",
      p_audience: requestedAudience,
      p_content: content,
      p_checksum: checksum,
      p_embedding_model: embeddings.provider.model,
      p_created_by: context.user.id,
      p_chunks: chunks.map((chunk, index) => ({
        chunk_index: index,
        content: chunk,
        token_count: Math.ceil(chunk.length / 4),
        embedding: JSON.stringify(vectors[index]),
      })),
    },
  );
  const document = (createdDocuments as Array<Record<string, unknown>> | null)?.[0] as {
    id: string; title: string; visibility: string; audience: string; version: number;
  } | undefined;

  if (documentError || !document) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_document_create_failed",
      detail: documentError?.message,
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
      audience: document.audience,
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
      audience: document.audience,
      chunk_count: chunks.length,
      embedding_model: embeddings.provider.model,
    },
  };
}

/**
 * Actualiza el contenido de un documento existente (mismo titulo, contenido
 * nuevo): re-chunkea y re-embebe desde cero -- los chunks viejos no sirven
 * para un contenido distinto -- y sube `version`. Pensado para conocimiento
 * que se reescribe con el tiempo (perfil de la tienda / cuestionario) en vez
 * de acumular un documento nuevo cada vez que se corrige una respuesta.
 */
export async function updateKnowledgeDocument(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  documentId: string,
  payload: { content?: unknown },
) {
  const targetOrganizationId =
    organizationId === "global" ? null : organizationId;
  const access = requireKnowledgeManager(context, targetOrganizationId);
  if (access.ok === false) {
    return access;
  }

  const embeddings = requireEmbeddings(env);
  if (embeddings.ok === false) {
    return embeddings;
  }

  const content =
    typeof payload.content === "string" ? payload.content.trim() : "";
  if (!content) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "content_requerido",
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

  const vectors = await embedChunksInOrder(chunks, embeddings.provider);
  const supabase = createServiceClient(env);
  const checksum = crypto.createHash("sha256").update(content).digest("hex");

  const existingQuery = supabase
    .from("knowledge_documents")
    .select("id, version")
    .eq("id", documentId);
  const { data: existing, error: existingError } = await (
    targetOrganizationId === null
      ? existingQuery.is("organization_id", null)
      : existingQuery.eq("organization_id", targetOrganizationId)
  ).maybeSingle();

  if (existingError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_document_load_failed",
      detail: existingError.message,
    };
  }
  if (!existing) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "knowledge_document_not_found",
    };
  }

  const { data: replaced, error: replaceError } = await (supabase as any).rpc(
    "replace_knowledge_document_index",
    {
      p_document_id: documentId,
      p_expected_version: existing.version,
      p_content: content,
      p_checksum: checksum,
      p_embedding_model: embeddings.provider.model,
      p_chunks: chunks.map((chunk, index) => ({
        chunk_index: index,
        content: chunk,
        token_count: Math.ceil(chunk.length / 4),
        embedding: JSON.stringify(vectors[index]),
      })),
    },
  );

  if (replaceError || replaced !== true) {
    return {
      ok: false as const,
      statusCode: replaceError ? 500 : 409,
      error: replaceError ? "knowledge_document_update_failed" : "knowledge_document_version_conflict",
      detail: replaceError?.message,
    };
  }
  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .select("id, title, visibility, audience, version")
    .eq("id", documentId)
    .single();
  if (documentError || !document) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_document_load_after_update_failed",
      detail: documentError?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: targetOrganizationId,
    actorUserId: context.user.id,
    action: "knowledge.update_document",
    entityType: "knowledge_document",
    entityId: document.id,
    newData: {
      version: document.version,
      chunk_count: chunks.length,
    },
  });

  return {
    ok: true as const,
    data: {
      document_id: document.id,
      title: document.title,
      visibility: document.visibility,
      audience: document.audience,
      version: document.version,
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
  // Centinela "global" (mismo que ya usa la ruta de creacion): el catalogo de
  // metodologia de plataforma, que vive en /admin/conocimiento y no cuelga de
  // ningun cliente. Es el unico caso en que este endpoint devuelve globales.
  if (organizationId === "global") {
    if (context.profile.platform_role !== "platform_admin") {
      return {
        ok: false as const,
        statusCode: 403,
        error: "global_knowledge_denied",
      };
    }

    const globalClient = createUserScopedClient(
      env,
      authorization.slice("Bearer ".length),
    );
    // Sin .limit(): es el catalogo de metodologia de plataforma, acotado por
    // cuanto .md exista en conocimiento/ (editorial, no crecimiento de
    // usuario) -- con 100 aqui, scripts/ingest-conocimiento.mjs dejaba de ver
    // los titulos mas antiguos al pasar de 100 documentos globales y los
    // reintentaba, chocando con el indice unico de titulo.
    const { data, error } = await globalClient
      .from("knowledge_documents")
      .select(
        "id, organization_id, title, description, source_type, visibility, version, status, audience, origin, authority, created_at, updated_at",
      )
      .eq("visibility", "global")
      .order("created_at", { ascending: false });

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
      data: { organization_id: null, documents: data ?? [] },
    };
  }

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

  // La metodologia de plataforma (`visibility = 'global'`, nuestra) deja de
  // listarse aqui: este catalogo es el contexto DE ESTE CLIENTE. Antes se
  // mezclaba con un `.or(visibility.eq.global, ...)`, asi que el consultor --
  // y el cliente final, que abre la misma pantalla -- veian el playbook de
  // E-NORA entre sus propios documentos, sin poder tocarlo (el 403 de
  // `requireKnowledgeManager` ya existia). Se gestiona en /admin/conocimiento.
  //
  // Sigue alimentando al copiloto de todos los clientes: el corte es de
  // visibilidad en el catalogo, no de retrieval.
  const query = supabase
    .from("knowledge_documents")
    .select(
      "id, organization_id, title, description, source_type, visibility, version, status, audience, origin, authority, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const { data, error } =
    context.profile.platform_role === "platform_admin"
      ? await query.or(`visibility.eq.global,organization_id.eq.${organizationId}`)
      : await query.eq("organization_id", organizationId);

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
 * Contenido completo de un documento (para "verlo bien" en el panel, no solo
 * su ficha). Mismo criterio de acceso que listar: global = platform_admin,
 * organizacion = membership sobre esa org. No usa RLS (`createServiceClient`)
 * porque el filtro de tenant ya esta aqui, igual que en el resto del modulo.
 */
export async function getKnowledgeDocument(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  documentId: string,
) {
  const isGlobal = organizationId === "global";

  if (isGlobal) {
    if (context.profile.platform_role !== "platform_admin") {
      return {
        ok: false as const,
        statusCode: 403,
        error: "global_knowledge_denied",
      };
    }
  } else if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const supabase = createServiceClient(env);
  const query = supabase
    .from("knowledge_documents")
    .select(
      "id, organization_id, title, description, source_type, visibility, version, status, audience, content, created_at, updated_at",
    )
    .eq("id", documentId);

  const { data: document, error } = await (
    isGlobal ? query.is("organization_id", null) : query.eq("organization_id", organizationId)
  ).maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_document_load_failed",
      detail: error.message,
    };
  }

  if (!document) {
    return { ok: false as const, statusCode: 404, error: "knowledge_document_not_found" };
  }

  return { ok: true as const, data: { document } };
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

  // La metodologia de plataforma no se lista ni se busca fuera de
  // /admin/conocimiento. La funcion SQL no sabe excluirla (su filtro es
  // `global OR de este tenant`), asi que se descarta aqui y se pide el doble
  // de candidatos para no devolver 2 resultados porque 6 eran globales.
  //
  // ponytail: filtrado en Node sobre un top-k ampliado. Si algun dia el
  // conocimiento global crece tanto que copa los 16, toca un parametro
  // `include_global` en knowledge_search_hybrid.
  const hidesGlobal = context.profile.platform_role !== "platform_admin";

  const { data, error } = await executeKnowledgeSearch(
    supabase,
    {
      targetOrganizationId: organizationId,
      queryEmbedding: JSON.stringify(embedding),
      queryText,
      audienceAllowed,
      targetStoreId: storeId,
      matchCount: hidesGlobal ? 16 : 8,
    },
    createReranker(env),
  );

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "knowledge_search_failed",
      detail: error.message,
    };
  }

  const matches = hidesGlobal
    ? ((data ?? []) as Array<{ visibility: string }>)
        .filter((match) => match.visibility !== "global")
        .slice(0, 8)
    : (data ?? []);

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      query: queryText,
      matches,
    },
  };
}
