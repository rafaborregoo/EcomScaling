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
  | "inventory_items"
  | "inventory_snapshots"
  | "orders"
  | "order_items"
  | "refunds"
  | "refund_items"
  | "customers"
  | "returns"
  | "discounts"
  | "draft_orders"
  | "fulfillments"
  | "payments"
  | "channels"
  | "markets"
  | "publications"
  | "marketing"
  | "analytics";

type SyncBlockKey = "catalog" | "inventory" | "orders" | "refunds" | "customers";

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
    fields: ["product.id", "title", "handle", "vendor", "productType", "status", "variants", "price", "compareAtPrice", "barcode"],
    enables: ["Productos mas vendidos", "ventas por producto", "ventas por variante", "catalogo operativo"],
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
    fields: ["order.id", "name", "processedAt", "displayFinancialStatus", "displayFulfillmentStatus", "lineItems", "refunds", "totals"],
    enables: ["Ventas brutas/netas", "pedidos", "ticket medio", "unidades vendidas", "descuentos", "impuestos", "envio cobrado"],
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
    scope: "read_analytics",
    area: "Analytics",
    status: "metric_source",
    fields: ["analytics reports", "session/sales aggregates"],
    enables: ["Evolucion diaria/semanal/mensual", "comparativas de rendimiento"],
  },
  {
    scope: "read_channels",
    area: "Canales",
    status: "authorized_pending_ingestion",
    fields: ["channel.id", "name", "handle", "status"],
    enables: ["Ventas por canal", "normalizacion de sourceName"],
  },
  {
    scope: "read_markets",
    area: "Mercados",
    status: "authorized_pending_ingestion",
    fields: ["market.id", "name", "enabled", "regions", "currencySettings"],
    enables: ["Ventas por mercado", "moneda/pais", "segmentacion internacional"],
  },
  {
    scope: "read_price_rules",
    area: "Descuentos",
    status: "authorized_pending_ingestion",
    fields: ["priceRule.id", "title", "value", "target", "startsAt", "endsAt"],
    enables: ["Analisis de promociones", "impacto de descuentos", "calendario comercial"],
  },
  {
    scope: "read_discounts",
    area: "Descuentos",
    status: "authorized_pending_ingestion",
    fields: ["discountNode.id", "discount", "status", "usageCount"],
    enables: ["Uso de codigos", "descuento por campana", "rentabilidad promocional"],
  },
  {
    scope: "read_draft_orders",
    area: "Ventas",
    status: "authorized_pending_ingestion",
    fields: ["draftOrder.id", "status", "totalPriceSet", "lineItems", "completedAt"],
    enables: ["Ventas asistidas", "pedidos manuales", "pipeline B2B/manual"],
  },
  {
    scope: "read_fulfillments",
    area: "Operaciones",
    status: "authorized_pending_ingestion",
    fields: ["fulfillment.id", "status", "trackingInfo", "createdAt", "deliveredAt"],
    enables: ["Estado logistico", "tiempos de envio", "incidencias fulfillment"],
  },
  {
    scope: "read_order_edits",
    area: "Ventas",
    status: "authorized_pending_ingestion",
    fields: ["orderEdit.id", "staffMember", "changes", "createdAt"],
    enables: ["Auditoria de cambios de pedido", "impacto economico de ediciones"],
  },
  {
    scope: "read_payment_terms",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["paymentTerms.id", "paymentSchedules", "dueInDays", "overdue"],
    enables: ["Pagos aplazados", "riesgo de cobro", "B2B terms"],
  },
  {
    scope: "read_shopify_payments_accounts",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["shopifyPaymentsAccount.id", "balance", "payoutSchedule", "country"],
    enables: ["Estado de cuenta Shopify Payments", "cashflow operativo"],
  },
  {
    scope: "read_shopify_payments_payouts",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["payout.id", "amount", "status", "issuedAt", "transactionType"],
    enables: ["Cobros recibidos", "conciliacion bancaria", "cashflow"],
  },
  {
    scope: "read_shopify_payments_disputes",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["dispute.id", "status", "amount", "reason", "evidenceDueBy"],
    enables: ["Chargebacks", "riesgo financiero", "alertas de disputa"],
  },
  {
    scope: "read_gift_card_transactions",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["giftCardTransaction.id", "amount", "processedAt", "transactionType"],
    enables: ["Uso de gift cards", "impacto en revenue", "saldo promocional"],
  },
  {
    scope: "read_store_credit_account_transactions",
    area: "Pagos",
    status: "authorized_pending_ingestion",
    fields: ["storeCreditAccountTransaction.id", "amount", "type", "createdAt"],
    enables: ["Credito de tienda", "compensaciones", "saldo customer credit"],
  },
  {
    scope: "read_product_listings",
    area: "Publicacion",
    status: "authorized_pending_ingestion",
    fields: ["productListing.productId", "channel", "publishedAt"],
    enables: ["Disponibilidad por canal", "catalogo publicado"],
  },
  {
    scope: "read_publications",
    area: "Publicacion",
    status: "authorized_pending_ingestion",
    fields: ["publication.id", "name", "supportsFuturePublishing", "catalog"],
    enables: ["Publicaciones por canal", "estado de visibilidad"],
  },
  {
    scope: "read_marketing_events",
    area: "Marketing",
    status: "authorized_pending_ingestion",
    fields: ["marketingEvent.id", "eventType", "channel", "startedAt", "endedAt"],
    enables: ["Eventos de marketing", "atribucion basica", "calendario de campanas"],
  },
  {
    scope: "read_marketing_integrated_campaigns",
    area: "Marketing",
    status: "authorized_pending_ingestion",
    fields: ["marketingActivity.id", "campaign", "status", "utmParameters"],
    enables: ["Campanas integradas", "atribucion por UTM", "rendimiento por campana"],
  },
];

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
    key: "refunds",
    label: "Reembolsos",
    table: "shopify_refunds",
    description: "Cabecera de reembolsos sincronizados contra pedidos.",
    status: "active",
    scopes: ["read_orders", "read_returns"],
    syncScope: "refunds",
  },
  {
    key: "refund_items",
    label: "Lineas de reembolso",
    table: "shopify_refund_items",
    description: "Detalle de cantidades e importes reembolsados por linea.",
    status: "active",
    scopes: ["read_orders", "read_returns"],
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
    key: "returns",
    label: "Returns",
    table: null,
    description: "Devoluciones operativas, lineas devueltas, motivos, exchanges y reverse fulfillment.",
    status: "planned",
    scopes: ["read_returns"],
    syncScope: null,
  },
  {
    key: "discounts",
    label: "Promociones",
    table: null,
    description: "Price rules, discounts, uso de codigos, calendario promocional e impacto en margen.",
    status: "planned",
    scopes: ["read_price_rules", "read_discounts"],
    syncScope: null,
  },
  {
    key: "draft_orders",
    label: "Draft orders",
    table: null,
    description: "Pedidos manuales/asistidos, pipeline B2B y ventas completadas desde borradores.",
    status: "planned",
    scopes: ["read_draft_orders"],
    syncScope: null,
  },
  {
    key: "fulfillments",
    label: "Fulfillment",
    table: null,
    description: "Estados logisticos, tracking, tiempos de envio, entregas e incidencias.",
    status: "planned",
    scopes: ["read_fulfillments"],
    syncScope: null,
  },
  {
    key: "payments",
    label: "Pagos y cashflow",
    table: null,
    description: "Payment terms, payouts, disputes, gift cards, store credit y conciliacion Shopify Payments.",
    status: "planned",
    scopes: [
      "read_payment_terms",
      "read_shopify_payments_accounts",
      "read_shopify_payments_payouts",
      "read_shopify_payments_disputes",
      "read_gift_card_transactions",
      "read_store_credit_account_transactions",
    ],
    syncScope: null,
  },
  {
    key: "channels",
    label: "Canales",
    table: null,
    description: "Canales de venta, product listings y normalizacion de ventas por canal.",
    status: "planned",
    scopes: ["read_channels", "read_product_listings"],
    syncScope: null,
  },
  {
    key: "markets",
    label: "Markets",
    table: null,
    description: "Mercados, regiones, moneda, pais y segmentacion internacional.",
    status: "planned",
    scopes: ["read_markets"],
    syncScope: null,
  },
  {
    key: "publications",
    label: "Publicaciones",
    table: null,
    description: "Publicaciones, catalogos visibles y disponibilidad por canal.",
    status: "planned",
    scopes: ["read_publications"],
    syncScope: null,
  },
  {
    key: "marketing",
    label: "Marketing Shopify",
    table: null,
    description: "Marketing events, integrated campaigns, UTMs y calendario de campanas.",
    status: "planned",
    scopes: ["read_marketing_events", "read_marketing_integrated_campaigns"],
    syncScope: null,
  },
  {
    key: "analytics",
    label: "Analytics / ShopifyQL",
    table: null,
    description: "Reportes, ShopifyQL, agregados diarios/semanales/mensuales y comparativas.",
    status: "planned",
    scopes: ["read_analytics", "read_reports"],
    syncScope: null,
  },
];

// shopify_order_items, shopify_refunds y shopify_refund_items no tienen columna store_id propia
// (se relacionan a la tienda via order_id -> shopify_order_facts.store_id), asi que no se filtran aqui.
const storeScopedTables = new Set([
  "shopify_stores",
  "shopify_locations",
  "shopify_products",
  "shopify_order_facts",
  "shopify_customers",
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

  const { data, error } = await query.order("external_updated_at", { ascending: false }).limit(10);

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

  const { data, error } = await query.order("processed_at", { ascending: false, nullsFirst: false }).limit(10);

  if (error) {
    throw new Error(`shopify_orders_sample_failed: ${error.message}`);
  }

  return data ?? [];
}

async function loadInventory(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("shopify_inventory_items")
    .select("id, sku, tracked, requires_shipping, current_unit_cost, cost_currency_code, external_updated_at")
    .eq("organization_id", organizationId)
    .order("external_updated_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`shopify_inventory_sample_failed: ${error.message}`);
  }

  return data ?? [];
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
        loadInventory(supabase, organizationId),
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
