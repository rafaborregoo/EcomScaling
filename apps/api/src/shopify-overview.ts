import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

type DatasetKey =
  | "stores"
  | "locations"
  | "products"
  | "variants"
  | "collections"
  | "inventory_items"
  | "inventory_snapshots"
  | "orders"
  | "order_items"
  | "order_transactions"
  | "order_discount_applications"
  | "fulfillments"
  | "refunds"
  | "refund_items"
  | "customers"
  | "abandoned_checkouts"
  | "discounts"
  | "marketing_events"
  | "sessions"
  | "returns";

// Espejo de `BlockKey` en apps/api/src/shopify-sync.ts. Si divergen, la
// cobertura atribuye una tabla a un bloque que no la escribe.
type SyncBlockKey =
  | "catalog"
  | "inventory"
  | "orders"
  | "refunds"
  | "customers"
  | "sessions"
  | "abandoned_checkouts"
  | "discounts"
  | "marketing_events"
  | "collections";

type DatasetDefinition = {
  key: DatasetKey;
  label: string;
  table: string | null;
  description: string;
  status: "active" | "planned";
  scopes: string[];
  syncScope: SyncBlockKey | null;
};

type ShopifyScopeCatalogItem = {
  scope: string;
  area: string;
  status: "active_ingestion" | "authorized_pending_ingestion" | "metric_source" | "special_access";
  fields: string[];
  enables: string[];
};

const shopifyScopeCatalog: ShopifyScopeCatalogItem[] = [
  {
    scope: "read_products",
    area: "Catalogo",
    status: "active_ingestion",
    fields: ["product.id", "title", "handle", "vendor", "productType", "status", "variants", "selectedOptions", "price", "compareAtPrice", "barcode", "media", "productVariantComponents"],
    enables: ["Catalogo visual e imagenes", "opciones de variante", "packs nativos", "Productos mas vendidos", "ventas por producto", "ventas por variante"],
  },
  {
    scope: "read_inventory",
    area: "Inventario",
    status: "active_ingestion",
    fields: ["inventoryItem.id", "sku", "tracked", "requiresShipping", "measurement", "inventoryLevels.quantities"],
    enables: ["Stock por ubicacion", "rotacion", "dias de cobertura", "alertas de reposicion"],
  },
  {
    scope: "read_locations",
    area: "Inventario",
    status: "active_ingestion",
    fields: ["location.id", "name", "isActive", "fulfillsOnlineOrders", "address"],
    enables: ["Inventario por almacen", "fulfillment por ubicacion", "cobertura por location"],
  },
  {
    scope: "read_orders",
    area: "Ventas",
    status: "active_ingestion",
    fields: ["order.id", "name", "processedAt", "displayFinancialStatus", "displayFulfillmentStatus", "lineItems", "lineItems.lineItemGroup", "refunds", "totals"],
    enables: ["Ventas brutas/netas", "pedidos", "packs observados en pedidos", "ticket medio", "unidades vendidas", "descuentos", "impuestos", "envio cobrado"],
  },
  {
    scope: "read_returns",
    area: "Postventa",
    status: "authorized_pending_ingestion",
    fields: ["return.id", "status", "returnLineItems", "reverseFulfillmentOrders", "exchangeLineItems"],
    enables: ["Devoluciones operativas", "motivos de retorno", "unidades devueltas"],
  },
  {
    scope: "read_customers",
    area: "Clientes",
    status: "active_ingestion",
    fields: ["customer.id", "numberOfOrders", "amountSpent", "createdAt", "updatedAt", "state", "tags"],
    enables: ["Clientes nuevos/recurrentes", "frecuencia de compra", "LTV", "cohortes"],
  },
  {
    scope: "read_reports",
    area: "Analytics",
    status: "special_access",
    fields: ["shopifyqlQuery.columns", "shopifyqlQuery.rows", "report metadata"],
    enables: ["ShopifyQL", "reporting agregado", "comparativas por periodo"],
  },
  {
    scope: "write_pixels",
    area: "Embudo",
    status: "active_ingestion",
    fields: ["webPixel.settings", "product_viewed"],
    enables: ["Vistas de producto", "paso producto → carrito del embudo"],
  },
  {
    scope: "read_discounts",
    area: "Descuentos",
    status: "active_ingestion",
    fields: ["discountNode.id", "discount", "status", "usageCount"],
    enables: ["Uso de codigos", "descuento por campana", "rentabilidad promocional"],
  },
  {
    scope: "read_marketing_events",
    area: "Marketing",
    status: "active_ingestion",
    fields: ["marketingEvent.id", "eventType", "channel", "startedAt", "endedAt"],
    enables: ["Eventos de marketing", "atribucion basica", "calendario de campanas"],
  },
];

// Esta lista tiene que decir la verdad sobre lo que el sync escribe hoy, no lo
// que algun dia nos gustaria volcar: es la pantalla que consulta alguien para
// saber si un numero se puede calcular. Cada entrada `active` tiene tabla y un
// bloque de `BlockKey` (apps/api/src/shopify-sync.ts) que la rellena; si
// anades un bloque alli, anade su fila aqui o la cobertura vuelve a mentir.
// Lo que no tiene motor no se lista: una fila permanente en gris no es un
// roadmap, es ruido.
const datasets: DatasetDefinition[] = [
  {
    key: "stores",
    label: "Tienda",
    table: "shopify_stores",
    description: "Identidad de la tienda, dominio, moneda, zona horaria, plan y ajustes base.",
    status: "active",
    scopes: ["read_products"],
    syncScope: null,
  },
  {
    key: "locations",
    label: "Ubicaciones",
    table: "shopify_locations",
    description: "Almacenes, tiendas fisicas y ubicaciones usadas para fulfillment e inventario.",
    status: "active",
    scopes: ["read_locations"],
    syncScope: "inventory",
  },
  {
    key: "products",
    label: "Productos",
    table: "shopify_products",
    description: "Catalogo base: titulo, handle, vendor, tipo, estado y fechas externas.",
    status: "active",
    scopes: ["read_products"],
    syncScope: "catalog",
  },
  {
    key: "variants",
    label: "Variantes",
    table: "shopify_variants",
    description: "SKU vendibles con precio, barcode, taxable, policy y estado.",
    status: "active",
    scopes: ["read_products"],
    syncScope: "catalog",
  },
  {
    key: "collections",
    label: "Colecciones",
    table: "shopify_collections",
    description: "Colecciones del catalogo y su composicion, para agrupar ventas por familia.",
    status: "active",
    scopes: ["read_products"],
    syncScope: "collections",
  },
  {
    key: "inventory_items",
    label: "Inventory items",
    table: "shopify_inventory_items",
    description: "Item logistico asociado a variante: SKU, tracking, shipping, origen y medicion.",
    status: "active",
    scopes: ["read_inventory"],
    syncScope: "inventory",
  },
  {
    key: "inventory_snapshots",
    label: "Stock por ubicacion",
    table: "shopify_inventory_current_state",
    description: "Estado actual (no historico) de cantidades available, on_hand, committed e incoming por location.",
    status: "active",
    scopes: ["read_inventory", "read_locations"],
    syncScope: "inventory",
  },
  {
    key: "orders",
    label: "Pedidos",
    table: "shopify_order_facts",
    description: "Cabecera economica sin PII: estados, importes, descuentos, taxes y refunds.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "orders",
  },
  {
    key: "order_items",
    label: "Lineas de pedido",
    table: "shopify_order_items",
    description: "Detalle de articulos vendidos, cantidades, precios, descuentos y refunds.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "orders",
  },
  {
    key: "order_transactions",
    label: "Cobros por pedido",
    table: "shopify_order_transactions",
    description: "Movimientos de cobro y devolucion de cada pedido: pasarela, tipo, estado e importe.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "orders",
  },
  {
    key: "order_discount_applications",
    label: "Descuentos aplicados",
    table: "shopify_order_discount_applications",
    description: "Que codigo o promocion entro en cada pedido y cuanto se descontó.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "orders",
  },
  {
    key: "fulfillments",
    label: "Fulfillment",
    table: "shopify_fulfillments",
    description: "Envios por pedido: estado logistico, transportista, tracking y fechas de entrega.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "orders",
  },
  {
    key: "refunds",
    label: "Reembolsos",
    table: "shopify_refunds",
    description: "Cabecera de reembolsos sincronizados contra pedidos.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "refunds",
  },
  {
    key: "refund_items",
    label: "Lineas de reembolso",
    table: "shopify_refund_items",
    description: "Detalle de cantidades e importes reembolsados por linea.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "refunds",
  },
  {
    key: "customers",
    label: "Clientes",
    table: "shopify_customers",
    description: "Pedidos, gasto, estado y tags por cliente (sin PII: solo hash de referencia).",
    status: "active",
    scopes: ["read_customers"],
    syncScope: "customers",
  },
  {
    key: "abandoned_checkouts",
    label: "Carritos abandonados",
    table: "shopify_abandoned_checkouts",
    description: "Checkouts sin completar y su contenido, para medir recuperacion y fuga en el embudo.",
    status: "active",
    scopes: ["read_orders"],
    syncScope: "abandoned_checkouts",
  },
  {
    key: "discounts",
    label: "Promociones",
    table: "shopify_discounts",
    description: "Descuentos y price rules del catalogo promocional, con su ventana y su tipo.",
    status: "active",
    scopes: ["read_discounts"],
    syncScope: "discounts",
  },
  {
    key: "marketing_events",
    label: "Marketing Shopify",
    table: "shopify_marketing_events",
    description: "Marketing events y campanas integradas declaradas en Shopify, con sus UTMs.",
    status: "active",
    scopes: ["read_marketing_events"],
    syncScope: "marketing_events",
  },
  {
    key: "sessions",
    label: "Sesiones y conversion",
    table: "shopify_sessions_daily",
    description: "Sesiones diarias via ShopifyQL: la unica fuente de tasa de conversion de la tienda.",
    status: "active",
    scopes: ["read_reports"],
    syncScope: "sessions",
  },
  {
    // La tabla existe desde la migracion del motor de operaciones, que ya la
    // lee, pero ningun bloque del sync la escribe todavia: falta el scope
    // `read_returns` (no esta en SHOPIFY_SCOPES). Se queda listada porque es el
    // unico hueco decidido -- sin ella sabemos cuanto se devolvio
    // (shopify_refunds) pero no por que.
    key: "returns",
    label: "Devoluciones",
    table: "shopify_returns",
    description: "Motivo de cada devolucion, lineas devueltas y cambios. Requiere el permiso read_returns.",
    status: "planned",
    scopes: ["read_returns"],
    syncScope: null,
  },
];

// Tablas con columna `store_id` propia, comprobado contra las migraciones. Las
// que no estan aqui cuelgan de la tienda por una FK intermedia
// (shopify_order_items -> order_id -> shopify_order_facts.store_id).
const storeScopedTables = new Set([
  "shopify_stores",
  "shopify_locations",
  "shopify_products",
  "shopify_variants",
  "shopify_inventory_items",
  "shopify_collections",
  "shopify_order_facts",
  "shopify_order_transactions",
  "shopify_fulfillments",
  "shopify_customers",
  "shopify_abandoned_checkouts",
  "shopify_discounts",
  "shopify_order_discount_applications",
  "shopify_marketing_events",
  "shopify_sessions_daily",
  "shopify_returns",
]);

async function countRows(
  supabase: SupabaseClient,
  table: string | null,
  organizationId: string,
  storeId?: string | null,
) {
  if (!table) {
    return 0;
  }

  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (storeId && storeScopedTables.has(table)) {
    query = query.eq(table === "shopify_stores" ? "id" : "store_id", storeId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`${table}_count_failed: ${error.message}`);
  }

  return count ?? 0;
}

async function loadLatestSync(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .select("id, sync_type, status, records_read, records_written, records_failed, error_message, started_at, finished_at, created_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`shopify_sync_runs_load_failed: ${error.message}`);
  }

  return data ?? [];
}

const syncBlockKeys: SyncBlockKey[] = ["catalog", "inventory", "orders", "refunds", "customers"];

function emptySyncBlocks() {
  return Object.fromEntries(syncBlockKeys.map((scope) => [scope, null])) as Record<
    SyncBlockKey,
    null
  >;
}

function isMissingSyncScopeColumn(message: string) {
  return (
    message.includes("integration_sync_runs.sync_scope") ||
    (message.includes("sync_scope") && message.includes("does not exist"))
  );
}

async function loadSyncBlocks(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .select("sync_scope, status, records_read, records_written, records_failed, error_message, started_at, finished_at, created_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .not("sync_scope", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingSyncScopeColumn(error.message)) {
      return emptySyncBlocks();
    }

    throw new Error(`shopify_sync_blocks_load_failed: ${error.message}`);
  }

  const rows = data ?? [];

  return Object.fromEntries(
    syncBlockKeys.map((scope) => [scope, rows.find((row) => row.sync_scope === scope) ?? null]),
  ) as Record<SyncBlockKey, (typeof rows)[number] | null>;
}

async function loadConnections(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, provider_account_name, provider_account_id, status, scopes, api_version, connected_at, last_sync_at, last_error_message")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    // El borrado conserva los datos durante 30 días para poder restaurarlos,
    // pero la tienda ya no debe salir en el selector ni admitir acciones.
    .neq("status", "pending_deletion")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`shopify_connections_load_failed: ${error.message}`);
  }

  return data ?? [];
}

async function loadStore(supabase: SupabaseClient, organizationId: string, connectionId?: string | null) {
  let query = supabase
    .from("shopify_stores")
    .select("id, connection_id, shop_name, myshopify_domain, primary_domain, currency_code, timezone, plan_display_name, taxes_included, updated_at")
    .eq("organization_id", organizationId);

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`shopify_store_load_failed: ${error.message}`);
  }

  return data;
}

async function loadProducts(supabase: SupabaseClient, organizationId: string, storeId?: string | null) {
  let query = supabase
    .from("shopify_products")
    .select("id, title, handle, vendor, product_type, status, external_updated_at")
    .eq("organization_id", organizationId);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data, error } = await query.order("external_updated_at", { ascending: false }).limit(50);

  if (error) {
    throw new Error(`shopify_products_sample_failed: ${error.message}`);
  }

  return data ?? [];
}

async function loadOrders(supabase: SupabaseClient, organizationId: string, storeId?: string | null) {
  let query = supabase
    .from("shopify_order_facts")
    .select("id, order_name, financial_status, fulfillment_status, current_total_price, net_sales, refunds, processed_at")
    .eq("organization_id", organizationId);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data, error } = await query.order("processed_at", { ascending: false, nullsFirst: false }).limit(50);

  if (error) {
    throw new Error(`shopify_orders_sample_failed: ${error.message}`);
  }

  return data ?? [];
}

async function loadInventory(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string | null,
) {
  let query = supabase
    .from("shopify_inventory_items")
    .select("id, sku, tracked, requires_shipping, current_unit_cost, cost_currency_code, external_updated_at")
    .eq("organization_id", organizationId)
    .order("external_updated_at", { ascending: false })
    .limit(50);
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query;

  if (error) {
    throw new Error(`shopify_inventory_sample_failed: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Solo la lista de conexiones Shopify de una organizacion, sin el resto del
 * overview (productos/pedidos/inventario/conteos de datasets). El selector
 * de tienda del header global necesita esto en cada cambio de cliente y
 * pedir el overview completo era el cuello de botella real de "cambiar de
 * cliente va lento" (el overview hace ~20 queries de conteo por dataset).
 */
export async function getShopifyConnections(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const membership = [
    ...context.memberships,
    ...(context.storeMemberships ?? []),
  ].find((item) => item.organization_id === organizationId);
  if (!membership) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "El usuario no pertenece a la organizacion solicitada.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  try {
    let connections = await loadConnections(supabase, organizationId);
    if (
      membership.accessSource === "membership" &&
      membership.access_scope === "store"
    ) {
      const { data: stores, error: storeError } = await supabase
        .from("shopify_stores")
        .select("connection_id")
        .eq("organization_id", organizationId)
        .in("id", membership.store_ids ?? [])
        .eq("is_active", true);
      if (storeError) throw new Error(`shopify_store_scope_load_failed: ${storeError.message}`);
      const allowed = new Set((stores ?? []).map((store) => store.connection_id as string | null));
      connections = connections.filter((connection) => allowed.has(connection.id));
    }
    const selected = connections.find((item) => item.status !== "pending") ?? connections[0] ?? null;

    return {
      ok: true as const,
      data: { organization_id: organizationId, connections, selected_connection_id: selected?.id ?? null },
    };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "shopify_connections_load_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function getShopifyOverview(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  connectionId?: string,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "El usuario no pertenece a la organizacion solicitada.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  try {
    const connections = await loadConnections(supabase, organizationId);
    const connection =
      connections.find((item) => item.id === connectionId) ??
      connections.find((item) => item.status !== "pending") ??
      connections[0] ??
      null;
    const store = await loadStore(supabase, organizationId, connection?.id ?? null);
    const storeId = store?.id ?? null;

    const [syncRuns, syncBlocks, products, orders, inventory, datasetCounts] =
      await Promise.all([
        loadLatestSync(supabase, organizationId),
        loadSyncBlocks(supabase, organizationId),
        loadProducts(supabase, organizationId, storeId),
        loadOrders(supabase, organizationId, storeId),
        loadInventory(supabase, organizationId, storeId),
        Promise.all(
          datasets.map(async (dataset) => {
            let count = 0;
            try {
              count = await countRows(supabase, dataset.table, organizationId, storeId);
            } catch (error) {
              console.error(
                `shopify_overview_dataset_count_failed[${dataset.key}]`,
                error instanceof Error ? error.message : error,
              );
            }

            return {
              key: dataset.key,
              label: dataset.label,
              table: dataset.table,
              description: dataset.description,
              status: dataset.status,
              scopes: dataset.scopes,
              sync_scope: dataset.syncScope,
              count,
            };
          }),
        ),
      ]);

    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        connections,
        selected_connection_id: connection?.id ?? null,
        connection,
        authorized_scopes: Array.isArray(connection?.scopes) ? connection.scopes : [],
        scope_catalog: shopifyScopeCatalog,
        store,
        datasets: datasetCounts,
        samples: {
          products,
          orders,
          inventory,
        },
        sync_runs: syncRuns,
        sync_blocks: syncBlocks,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "shopify_overview_load_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
