// Registro de accesos de LECTURA a datos protegidos de cliente.
//
// Shopify (Nivel 2 de datos protegidos) pide poder demostrar quien ha leido
// datos de cliente, no solo quien los ha modificado. `audit_logs` cubria lo
// segundo -- se escribe desde recordAuditLog en cada accion que cambia algo --
// y las lecturas no dejaban rastro de ninguna clase.
//
// Se reusa `audit_logs` en vez de crear una tabla aparte: ya tiene RLS por
// organizacion, la pantalla de /admin/logs que lo enseña, retencion decidida
// (ADR-0018) y purga al dar de baja una organizacion. Lo que distingue una
// lectura de una escritura es la `action`, que siempre empieza por
// `protected_data.`; asi se filtran por separado sin duplicar infraestructura.
//
// ponytail: una fila por peticion, no por registro leido. Si el volumen llega a
// molestar, el siguiente paso es agrupar por (actor, recurso, hora) antes de
// insertar -- no dejar de registrar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditLog } from "./audit-log.js";

/** Prefijo de `audit_logs.action` para toda lectura de datos protegidos. */
export const PROTECTED_DATA_ACTION_PREFIX = "protected_data.";

/** De donde sale la lectura. El motivo importa tanto como el actor: "un agente
 * de IA leyo cohortes" y "un consultor exporto la organizacion entera" son
 * hechos distintos aunque la tabla sea la misma. */
export type ProtectedDataSurface =
  | "shopify_insights"
  | "ai_agent_context"
  | "ai_sql_gateway"
  | "organization_export";

/** Tablas y vistas con datos de cliente cuyo acceso hay que registrar.
 *
 * `shopify_customers` no guarda nombre, email ni telefono -- solo
 * `customer_reference_hash` y contadores -- pero sigue siendo dato de cliente a
 * ojos de Shopify, y el requisito es sobre el acceso, no sobre el formato. */
export const PROTECTED_TABLES = new Set(["shopify_customers"]);

/** Las tablas protegidas que toca una consulta, para no registrar accesos que
 * no han ocurrido: un agente que solo mira productos no lee datos de cliente. */
export function protectedTablesTouched(tables: Iterable<string>): string[] {
  const touched = new Set<string>();
  for (const table of tables) {
    // El gateway expone las vistas del esquema `ai` con el mismo nombre.
    const bare = table.includes(".") ? table.split(".").pop()! : table;
    if (PROTECTED_TABLES.has(bare)) touched.add(bare);
  }
  return [...touched].sort();
}

export async function recordProtectedDataAccess(
  supabase: SupabaseClient,
  entry: {
    organizationId: string | null;
    actorUserId: string | null;
    surface: ProtectedDataSurface;
    /** Que se ha leido: tablas, vistas o funciones de metricas. */
    resources: string[];
    /** Para que, en una frase corta y estable (se filtra por ella). */
    purpose: string;
    storeId?: string | null;
    requestId?: string | null;
    /** Contexto extra que ayude a auditar sin volver a mirar el codigo. */
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await recordAuditLog(supabase, {
    organizationId: entry.organizationId,
    actorUserId: entry.actorUserId,
    action: `${PROTECTED_DATA_ACTION_PREFIX}${entry.surface}`,
    entityType: "protected_customer_data",
    // Sin entidad: se lee un conjunto, no una fila concreta. La columna es uuid
    // y meter aqui el nombre de una tabla la rompe.
    entityId: null,
    newData: {
      resources: entry.resources,
      purpose: entry.purpose,
      store_id: entry.storeId ?? null,
      ...entry.detail,
    },
    requestId: entry.requestId ?? null,
  });
}
