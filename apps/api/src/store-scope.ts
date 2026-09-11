// Asignacion "cuenta de proveedor -> tienda Shopify".
//
// Una tienda es la que tiene conexion Shopify; los datos de Meta y Klaviyo son
// datos DE esa tienda. La columna store_id vive en la entidad cuenta de cada
// proveedor (meta_ad_accounts, klaviyo_accounts), no en integration_connections:
// una sola conexion OAuth de Meta sirve legitimamente a varias tiendas a traves
// de cuentas publicitarias distintas del mismo portfolio.
//
// NULL = sin asignar. Es el estado de todo lo que existia antes de la columna y
// el que queda en clientes con varias tiendas, donde adivinar seria peor que no
// saber. Los consumidores tratan NULL como "no atribuible a una tienda".
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  type AuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv;

// Las dos unicas tablas con store_id de proveedor. Se listan explicitamente en
// vez de aceptar un nombre de tabla del cliente: el nombre llega por HTTP y no
// puede terminar interpolado en una consulta.
const SCOPED_TABLES = {
  meta_ad_accounts: "meta_ad_accounts",
  klaviyo_accounts: "klaviyo_accounts",
} as const;

type ScopedTable = keyof typeof SCOPED_TABLES;

export type StoreScopeAssignment = {
  id: string;
  store_id: string | null;
};

export type StoreScopeInput = Partial<
  Record<ScopedTable, StoreScopeAssignment[]>
>;

/** Fallo de una cuenta concreta, para poder pintarlo en su fila. */
export type StoreScopeFailure = {
  table: ScopedTable;
  id: string;
  message: string;
};

type Failure = {
  ok: false;
  statusCode: number;
  error: string;
  message?: string;
  detail?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ADR-0006 pto 7: se escribe con service role, asi que la membresia se
// comprueba a mano. Un consultor tiene role "consultant" y no entra aqui, igual
// que en el resto de escrituras de integraciones.
function canManageOrganization(
  authContext: AuthContext,
  organizationId: string,
) {
  const operational = requireOperationalOrganization(
    authContext,
    organizationId,
  );
  if (isOperationalOrganizationError(operational)) return false;
  const { membership } = operational;

  return Boolean(
    membership &&
      (authContext.profile.platform_role === "platform_admin" ||
        ["owner", "manager"].includes(membership.role)),
  );
}

export async function listStoreScope(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
) {
  const operational = requireOperationalOrganization(
    authContext,
    organizationId,
  );
  if (isOperationalOrganizationError(operational)) return operational;

  const supabase = createServiceClient(env);

  const { data: stores, error: storesError } = await supabase
    // connection_id: el selector de tienda del header (y ?connectionId=) va
    // por integration_connections.id, no por shopify_stores.id. Sin devolverlo,
    // la UI no puede decir cual de estas tiendas es la que se esta viendo.
    .from("shopify_stores")
    .select("id, connection_id, myshopify_domain, shop_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("shop_name");
  if (storesError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "store_scope_load_failed",
      detail: storesError.message,
    };
  }

  const [metaResult, klaviyoResult] = await Promise.all([
    // connection_id: /integraciones/meta y /integraciones/klaviyo configuran
    // UNA conexion, y sin este campo no hay forma de saber a que tienda
    // pertenece lo que estas tocando. En Klaviyo la cuenta es 1:1 con la
    // conexion (unique (connection_id)), asi que ademas identifica la conexion
    // de la tienda activa.
    supabase
      .from("meta_ad_accounts")
      .select(
        "id, connection_id, account_name, external_ad_account_id, store_id, is_selected",
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    // klaviyo_accounts no tiene ni `account_name` ni `is_active` (a
    // diferencia de meta_ad_accounts): la columna se llama `name` y no hay
    // borrado logico -- pedirlas devolvia 42703 y toda la llamada acababa en
    // 500 store_scope_load_failed. Se renombra en el select para que la
    // respuesta siga teniendo la misma forma para las dos tablas.
    supabase
      .from("klaviyo_accounts")
      .select(
        "id, connection_id, account_name:name, external_account_id, store_id",
      )
      .eq("organization_id", organizationId),
  ]);

  const loadError = metaResult.error ?? klaviyoResult.error;
  if (loadError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "store_scope_load_failed",
      detail: loadError.message,
    };
  }

  const metaRows = metaResult.data ?? [];
  const klaviyoRows = klaviyoResult.data ?? [];

  return {
    ok: true as const,
    data: {
      stores: stores ?? [],
      meta_ad_accounts: metaRows,
      klaviyo_accounts: klaviyoRows,
      // Lo que hace falta saber para el pricing por numero de tiendas y para
      // avisar en la UI de que hay cuentas sin atribuir a ninguna tienda.
      store_count: (stores ?? []).length,
      unassigned_count:
        metaRows.filter((row) => row.store_id === null).length +
        klaviyoRows.filter((row) => row.store_id === null).length,
    },
  };
}

// Parseo separado de la escritura para que la parte que decide se pueda probar
// sin base de datos. Devuelve las tablas presentes en el cuerpo y el conjunto
// de tiendas citadas, que es lo unico que hay que validar contra el cliente.
export function parseStoreScopeInput(input: StoreScopeInput):
  | Failure
  | {
      ok: true;
      entries: Array<{ table: ScopedTable; rows: StoreScopeAssignment[] }>;
      storeIds: string[];
    } {
  // Un cuerpo que no es objeto (una cadena JSON sin parsear, por ejemplo, que
  // es lo que llega si el cliente no manda content-type: application/json)
  // caia en la rama de "no me has mandado ninguna asignacion", que hacia
  // buscar el fallo en el sitio equivocado.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_store_scope_body",
      message:
        "El cuerpo debe ser un objeto JSON (content-type: application/json).",
    };
  }

  const entries = (Object.keys(SCOPED_TABLES) as ScopedTable[])
    .map((table) => ({ table, rows: input[table] }))
    .filter(
      (entry): entry is { table: ScopedTable; rows: StoreScopeAssignment[] } =>
        Array.isArray(entry.rows),
    );

  if (
    entries.length === 0 ||
    entries.every((entry) => entry.rows.length === 0)
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_store_scope",
      message:
        "Envia al menos una asignacion en meta_ad_accounts o klaviyo_accounts.",
    };
  }

  // store_id null es valido y significa desasignar; solo se validan los ids.
  const storeIds = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.rows
          .map((row) => row.store_id)
          .filter((storeId): storeId is string => typeof storeId === "string"),
      ),
    ),
  ];

  return { ok: true, entries, storeIds };
}

export async function assignStoreScope(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  input: StoreScopeInput,
): Promise<
  Failure | { ok: true; data: { updated: number; failed: StoreScopeFailure[] } }
> {
  if (!canManageOrganization(authContext, organizationId)) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden asignar tiendas.",
    };
  }

  const parsed = parseStoreScopeInput(input);
  if (parsed.ok === false) return parsed;
  const { entries, storeIds } = parsed;

  const supabase = createServiceClient(env);

  // Los ids de tienda se validan contra la organizacion antes de escribir nada.
  // El trigger de la base tambien lo impide, pero fallar aqui devuelve un 400
  // legible en vez de un 500 con el texto de una excepcion de Postgres.
  if (storeIds.length > 0) {
    const { data: validStores, error: storeError } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", storeIds);
    if (storeError) {
      return {
        ok: false,
        statusCode: 500,
        error: "store_scope_validation_failed",
        detail: storeError.message,
      };
    }
    const found = new Set((validStores ?? []).map((row) => row.id as string));
    if (storeIds.some((storeId) => !found.has(storeId))) {
      return {
        ok: false,
        statusCode: 400,
        error: "invalid_store_scope",
        message: "Una o mas tiendas no pertenecen a esta organizacion.",
      };
    }
  }

  // Una fila que falla no invalida las demas: cada cuenta es una decision
  // independiente, y abortar en la primera dejaba al usuario con un error
  // global sin saber cual de las cuentas era la mala ni cuales si se habian
  // guardado. Se intentan todas y se devuelve el fallo pegado a su cuenta.
  let updated = 0;
  const failed: StoreScopeFailure[] = [];
  for (const entry of entries) {
    for (const row of entry.rows) {
      const { error, count } = await supabase
        .from(SCOPED_TABLES[entry.table])
        .update({ store_id: row.store_id }, { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("id", row.id);
      if (error) {
        // El texto de Postgres no sale a la UI (misma regla que
        // sendServiceFailure con `detail`): describe el esquema.
        console.error(
          `store_scope_update_failed[${entry.table}:${row.id}]`,
          error.message,
        );
        failed.push({
          table: entry.table,
          id: row.id,
          message: "No se pudo guardar esta cuenta. Reintenta.",
        });
        continue;
      }
      if ((count ?? 0) === 0) {
        failed.push({
          table: entry.table,
          id: row.id,
          message: "La cuenta ya no existe en este cliente. Recarga la lista.",
        });
        continue;
      }
      updated += count ?? 0;
    }
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: authContext.user.id,
    action: "store_scope_updated",
    entityType: "store_scope",
    newData: {
      meta_ad_accounts: input.meta_ad_accounts?.length ?? 0,
      klaviyo_accounts: input.klaviyo_accounts?.length ?? 0,
      updated,
      failed: failed.length,
    },
  });

  return { ok: true, data: { updated, failed } };
}
