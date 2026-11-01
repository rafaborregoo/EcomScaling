import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  type AuthContext,
  createUserScopedClient,
  isOperationalOrganizationError,
  requireOperationalOrganization,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function assertCanManage(context: AuthContext, organizationId: string) {
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;
  const { membership } = operational;

  if (
    context.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo el propietario o un gestor pueden gestionar costes.",
    };
  }

  return { ok: true as const };
}

export async function listProductCosts(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("product_costs")
    .select(
      "id, inventory_item_id, unit_cost, currency_code, source, is_override, valid_from, valid_until, created_at, shopify_inventory_items(sku, shopify_variants(title, shopify_products(title)))",
    )
    .eq("organization_id", organizationId)
    .order("valid_from", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "product_costs_load_failed",
      detail: error.message,
    };
  }

  return { ok: true as const, data: data ?? [] };
}

type UpsertCostInput = {
  sku?: string;
  inventoryItemId?: string;
  unitCost: number;
  currencyCode?: string;
  validFrom?: string;
};

export async function findOwnedInventoryItem(
  supabase: SupabaseClient,
  organizationId: string,
  input: Pick<UpsertCostInput, "sku" | "inventoryItemId">,
) {
  const inventoryItemId = input.inventoryItemId ?? null;
  const lookup = supabase
    .from("shopify_inventory_items")
    .select("id")
    .eq("organization_id", organizationId);

  const scopedLookup = inventoryItemId
    ? lookup.eq("id", inventoryItemId)
    : lookup.eq("sku", input.sku!);
  const { data, error } = await scopedLookup.maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: inventoryItemId
        ? "inventory_item_lookup_failed"
        : "sku_lookup_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: inventoryItemId ? "inventory_item_not_found" : "sku_not_found",
    };
  }

  return { ok: true as const, data: { id: data.id as string } };
}

export async function upsertProductCost(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: UpsertCostInput,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
    return { ok: false as const, statusCode: 400, error: "invalid_unit_cost" };
  }

  if (!input.sku && !input.inventoryItemId) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_sku_or_inventory_item_id",
    };
  }

  const supabase = createServiceClient(env);

  let inventoryItemId = input.inventoryItemId ?? null;

  if (inventoryItemId || input.sku) {
    const inventoryLookup = await findOwnedInventoryItem(
      supabase,
      organizationId,
      input,
    );
    if (inventoryLookup.ok === false) {
      return inventoryLookup;
    }
    inventoryItemId = inventoryLookup.data.id;
  }

  const { data, error } = await supabase
    .from("product_costs")
    .insert({
      organization_id: organizationId,
      inventory_item_id: inventoryItemId,
      unit_cost: input.unitCost,
      currency_code: input.currencyCode ?? "EUR",
      source: "manual",
      is_override: true,
      valid_from: input.validFrom ?? new Date().toISOString().slice(0, 10),
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "product_cost_create_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "shopify_product_costs.create_manual_cost",
    entityType: "product_cost",
    entityId: data.id,
    newData: {
      inventory_item_id: inventoryItemId,
      unit_cost: input.unitCost,
      currency_code: input.currencyCode ?? "EUR",
    },
  });
  return { ok: true as const, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Importacion masiva de costes (F3b del panel del manager)
// ---------------------------------------------------------------------------
// Cargar costes de uno en uno es viable con 44 articulos e imposible con 400, y
// sin costes el COGS sale a cero y el margen del panel es ficticio.
//
// Tres decisiones para que esto no pueda romper nada:
//
//  1. SIEMPRE se puede pedir en seco (`dryRun`). La pantalla previsualiza antes
//     de escribir: quien pega 300 lineas ve que va a pasar con cada una.
//  2. REIMPORTAR ES SEGURO. `product_costs` no tiene unique, y el motor de
//     margen resuelve el coste con `order by valid_from desc limit 1`: dos
//     filas del mismo articulo con el mismo `valid_from` harian que el COGS
//     dependiera de cual devuelva Postgres primero. Por eso, si ya hay coste
//     para ese articulo con fecha de hoy, se ACTUALIZA en vez de insertar otro.
//  3. NO SE BORRA NADA. Los costes de dias anteriores se quedan: son el
//     historico con el que el motor valora los pedidos viejos.
//
// El SKU duplicado no se resuelve a ciegas: si dos articulos comparten SKU (dos
// tiendas de la misma organizacion, por ejemplo), esa linea se marca y se deja
// sin tocar. Escribir el coste en "uno de los dos" seria peor que no escribirlo.

const MAX_IMPORT_ROWS = 2000;
// Tamano de lote para `in(...)`: PostgREST manda el filtro en la query string,
// asi que una sola llamada con 2000 SKU seria una URL inmanejable.
const IMPORT_LOOKUP_CHUNK = 200;

export type ProductCostImportRow = {
  sku?: string;
  unitCost?: number;
  currencyCode?: string;
};

type ImportOutcome =
  | "ok"
  | "sku_not_found"
  | "sku_ambiguous"
  | "invalid_cost"
  | "missing_sku"
  | "duplicate_in_input";

export type ProductCostImportResult = {
  line: number;
  sku: string;
  unit_cost: number | null;
  outcome: ImportOutcome;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Resuelve que haria cada linea del pegado, sin tocar la base: validacion y
 * deteccion de SKU repetidos dentro del propio listado.
 *
 * Separada para poder probarla: es la parte con reglas, y la que decide que se
 * escribe y que no.
 */
export function classifyImportRows(
  rows: ProductCostImportRow[],
): ProductCostImportResult[] {
  const seen = new Map<string, number[]>();

  const results: ProductCostImportResult[] = rows.map((row, index) => {
    const sku = typeof row.sku === "string" ? row.sku.trim() : "";
    const unitCost =
      typeof row.unitCost === "number" && Number.isFinite(row.unitCost)
        ? row.unitCost
        : null;

    if (!sku) {
      return {
        line: index + 1,
        sku: "",
        unit_cost: unitCost,
        outcome: "missing_sku" as const,
      };
    }

    seen.set(sku, [...(seen.get(sku) ?? []), index]);

    if (unitCost === null || unitCost < 0) {
      return {
        line: index + 1,
        sku,
        unit_cost: null,
        outcome: "invalid_cost" as const,
      };
    }

    return { line: index + 1, sku, unit_cost: unitCost, outcome: "ok" as const };
  });

  // Dos lineas con el mismo SKU son una contradiccion del usuario, no algo que
  // decidir por el: se marcan todas y no se escribe ninguna.
  for (const [, indexes] of seen) {
    if (indexes.length > 1) {
      for (const index of indexes) {
        results[index]!.outcome = "duplicate_in_input";
      }
    }
  }

  return results;
}

export function summarizeImport(results: ProductCostImportResult[]) {
  const count = (outcome: ImportOutcome) =>
    results.filter((row) => row.outcome === outcome).length;

  return {
    total: results.length,
    applicable: count("ok"),
    sku_not_found: count("sku_not_found"),
    sku_ambiguous: count("sku_ambiguous"),
    invalid_cost: count("invalid_cost"),
    missing_sku: count("missing_sku"),
    duplicate_in_input: count("duplicate_in_input"),
  };
}

export async function importProductCosts(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: { rows?: ProductCostImportRow[]; dryRun?: boolean },
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const rows = input.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false as const, statusCode: 400, error: "missing_rows" };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "too_many_rows",
      message: `Máximo ${MAX_IMPORT_ROWS} líneas por importación.`,
    };
  }

  const results = classifyImportRows(rows);
  const supabase = createServiceClient(env);

  // Resolver los SKU contra el inventario de la organizacion, por lotes.
  const pendingSkus = [
    ...new Set(
      results.filter((row) => row.outcome === "ok").map((row) => row.sku),
    ),
  ];
  const itemIdsBySku = new Map<string, string[]>();

  for (const group of chunk(pendingSkus, IMPORT_LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from("shopify_inventory_items")
      .select("id, sku")
      .eq("organization_id", organizationId)
      .in("sku", group);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "inventory_lookup_failed",
        detail: error.message,
      };
    }

    for (const item of (data ?? []) as Array<{
      id: string;
      sku: string | null;
    }>) {
      if (!item.sku) continue;
      itemIdsBySku.set(item.sku, [
        ...(itemIdsBySku.get(item.sku) ?? []),
        item.id,
      ]);
    }
  }

  for (const row of results) {
    if (row.outcome !== "ok") continue;
    const matches = itemIdsBySku.get(row.sku) ?? [];
    if (matches.length === 0) row.outcome = "sku_not_found";
    else if (matches.length > 1) row.outcome = "sku_ambiguous";
  }

  const applicable = results.filter((row) => row.outcome === "ok");
  const summary = summarizeImport(results);

  if (input.dryRun) {
    return {
      ok: true as const,
      data: { dry_run: true, applied: 0, summary, results },
    };
  }

  if (applicable.length === 0) {
    return {
      ok: true as const,
      data: { dry_run: false, applied: 0, summary, results },
    };
  }

  // Escribir. Para cada articulo: si ya hay coste con fecha de hoy se
  // actualiza, si no se inserta. Nunca dos filas del mismo dia.
  const today = new Date().toISOString().slice(0, 10);
  const targetItemIds = applicable.map((row) => itemIdsBySku.get(row.sku)![0]!);
  const existingToday = new Map<string, string>();

  for (const group of chunk(targetItemIds, IMPORT_LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from("product_costs")
      .select("id, inventory_item_id")
      .eq("organization_id", organizationId)
      .eq("valid_from", today)
      .in("inventory_item_id", group);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "product_cost_lookup_failed",
        detail: error.message,
      };
    }

    for (const cost of (data ?? []) as Array<{
      id: string;
      inventory_item_id: string;
    }>) {
      existingToday.set(cost.inventory_item_id, cost.id);
    }
  }

  const toInsert: Array<Record<string, unknown>> = [];
  let applied = 0;

  for (const row of applicable) {
    const inventoryItemId = itemIdsBySku.get(row.sku)![0]!;
    const existingId = existingToday.get(inventoryItemId);
    const currencyCode = rows[row.line - 1]?.currencyCode ?? "EUR";

    if (existingId) {
      const { error } = await supabase
        .from("product_costs")
        .update({
          unit_cost: row.unit_cost,
          currency_code: currencyCode,
          source: "import",
          is_override: true,
          valid_until: null,
        })
        .eq("id", existingId)
        .eq("organization_id", organizationId);

      if (error) {
        return {
          ok: false as const,
          statusCode: 500,
          error: "product_cost_update_failed",
          detail: error.message,
        };
      }

      applied += 1;
      continue;
    }

    toInsert.push({
      organization_id: organizationId,
      inventory_item_id: inventoryItemId,
      unit_cost: row.unit_cost,
      currency_code: currencyCode,
      source: "import",
      is_override: true,
      valid_from: today,
      created_by: context.user.id,
    });
  }

  for (const group of chunk(toInsert, IMPORT_LOOKUP_CHUNK)) {
    const { error } = await supabase.from("product_costs").insert(group);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "product_cost_insert_failed",
        detail: error.message,
        // Lo ya escrito se queda: no hay transaccion entre llamadas HTTP. Es
        // seguro porque reimportar el mismo listado actualiza en vez de
        // duplicar, asi que volver a lanzarlo termina el trabajo.
        message: `Se escribieron ${applied} costes antes del fallo. Reimporta el mismo listado para terminar: no se duplicará.`,
      };
    }

    applied += group.length;
  }

  // Un apunte por importacion, no uno por linea: 2000 filas de auditoria por un
  // pegado enterrarian el resto del historial.
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "shopify_product_costs.import",
    entityType: "product_cost",
    newData: { applied, summary },
  });

  return { ok: true as const, data: { dry_run: false, applied, summary, results } };
}
