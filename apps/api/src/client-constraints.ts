// Reglas del cliente (tabla `client_constraints`, AI-07 seccion 8).
//
// La tabla existe desde AI-07 y `loadCriticalClientConstraints` la inyecta en
// el contexto de TODOS los agentes y del copiloto -- siempre, sin competir por
// un sitio en el top-k de knowledge_search. Hasta ahora no habia forma de
// crear una fila: la capacidad estaba construida y sin puerta, con una unica
// referencia en todo el repo (la lectura).
//
// Diferencia con un documento de conocimiento, que es la que la UI tiene que
// dejar clara:
//   - regla     -> el copiloto la tiene delante en cada turno.
//   - documento -> el copiloto la usa si sale en la busqueda.
//
// Escrituras por service role + chequeo manual de rol (patron ADR-0006 #7):
// la RLS de la tabla solo concede `select` a authenticated.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createUserScopedClient, type AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { requireKnowledgeManager } from "./knowledge.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const CONSTRAINT_CATEGORIES = [
  "pricing",
  "discounts",
  "inventory",
  "brand",
  "campaigns",
  "operations",
] as const;

// Una regla entra en el prompt de cada ejecucion de agente. Un texto largo no
// es una regla: es un documento, y ahi tiene su sitio sin gravar cada turno.
const CONSTRAINT_MAX_LENGTH = 400;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function listClientConstraints(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const gate = requireKnowledgeManager(context, organizationId);
  if (gate.ok === false) return gate;

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("client_constraints")
    .select(
      "id, category, statement, status, priority, store_id, valid_from, valid_until, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "client_constraints_list_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: { organization_id: organizationId, constraints: data ?? [] },
  };
}

export async function createClientConstraint(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: {
    category?: unknown;
    statement?: unknown;
    storeId?: unknown;
    validUntil?: unknown;
  },
) {
  const gate = requireKnowledgeManager(context, organizationId);
  if (gate.ok === false) return gate;

  const statement =
    typeof payload.statement === "string" ? payload.statement.trim() : "";
  if (!statement) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "statement_requerido",
      message: "Escribe la regla.",
    };
  }
  if (statement.length > CONSTRAINT_MAX_LENGTH) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "statement_demasiado_largo",
      message: `Una regla no puede pasar de ${CONSTRAINT_MAX_LENGTH} caracteres: entra en el contexto de cada respuesta del copiloto. Si necesitas mas espacio, es un documento.`,
    };
  }

  const category =
    typeof payload.category === "string" ? payload.category : "operations";
  if (!(CONSTRAINT_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false as const, statusCode: 400, error: "categoria_invalida" };
  }

  const validUntil =
    typeof payload.validUntil === "string" && payload.validUntil.trim()
      ? payload.validUntil.trim()
      : null;
  if (validUntil !== null && !ISO_DATE.test(validUntil)) {
    return { ok: false as const, statusCode: 400, error: "fecha_invalida" };
  }
  // El check de DB (`valid_until >= valid_from`) rechazaria esto con un 500
  // opaco; y una fecha ya pasada nace muerta: no se inyectaria jamas.
  const today = new Date().toISOString().slice(0, 10);
  if (validUntil !== null && validUntil < today) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "fecha_pasada",
      message: "Esa fecha ya pasó: la regla no llegaria a aplicarse nunca.",
    };
  }

  const storeId = typeof payload.storeId === "string" ? payload.storeId : null;

  const supabase = createServiceClient(env);

  // `loadCriticalClientConstraints` filtra `priority = 'critical'`: una regla
  // guardada como 'normal' iria a una tabla que no lee nadie y no haria nada.
  // Por eso no hay selector de prioridad -- una regla es, por definicion, lo
  // que el copiloto tiene siempre delante.
  const { data, error } = await supabase
    .from("client_constraints")
    .insert({
      organization_id: organizationId,
      store_id: storeId,
      category,
      statement,
      status: "active",
      priority: "critical",
      created_by: context.user.id,
      valid_until: validUntil,
    })
    .select("id, category, statement, status, valid_from, valid_until")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "client_constraint_create_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "knowledge.create_constraint",
    entityType: "client_constraint",
    entityId: data.id,
    newData: { category, statement, valid_until: validUntil },
  });

  return { ok: true as const, data };
}

/**
 * Activar / desactivar. No se borra: el historico de que se le pidio al
 * copiloto y cuando dejo de pedirse es parte de la trazabilidad del consultor.
 */
export async function setClientConstraintStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  constraintId: string,
  status: unknown,
) {
  const gate = requireKnowledgeManager(context, organizationId);
  if (gate.ok === false) return gate;

  if (status !== "active" && status !== "inactive") {
    return { ok: false as const, statusCode: 400, error: "status_invalido" };
  }

  const supabase = createServiceClient(env);

  // El `.eq("organization_id")` no es decorativo: sin el, un id de otro tenant
  // pasaria el gate de ESTA organizacion y editaria la regla de otra.
  const { data, error } = await supabase
    .from("client_constraints")
    .update({ status })
    .eq("id", constraintId)
    .eq("organization_id", organizationId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "client_constraint_update_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "constraint_no_encontrada",
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "knowledge.update_constraint",
    entityType: "client_constraint",
    entityId: constraintId,
    newData: { status },
  });

  return { ok: true as const, data };
}
