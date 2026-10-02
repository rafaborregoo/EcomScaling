export type ShopifySyncStore = {
  id: string;
  shop_name: string | null;
  connection_id: string | null;
};

export type ShopifySyncConnection = {
  id: string;
  status: string | null;
  last_sync_at: string | null;
  last_error_at: string | null;
};

/** Summarize connector sync health without implying metric-window completeness. */
export function summarizeShopifySyncCoverage(
  stores: readonly ShopifySyncStore[],
  connections: readonly ShopifySyncConnection[],
  selectedStoreId: string | null,
  now = Date.now(),
) {
  const byId = new Map(connections.map((connection) => [connection.id, connection]));
  const scopedStores = stores.filter((store) => !selectedStoreId || store.id === selectedStoreId);
  const rows = scopedStores.map((store) => {
    const connection = store.connection_id ? byId.get(store.connection_id) : null;
    const syncMs = connection?.last_sync_at ? Date.parse(connection.last_sync_at) : NaN;
    const errorMs = connection?.last_error_at ? Date.parse(connection.last_error_at) : NaN;
    const hasSyncTime = Number.isFinite(syncMs) && syncMs <= now;
    const freshnessSeconds = hasSyncTime ? Math.floor((now - syncMs) / 1000) : null;
    const healthy = (connection?.status === "connected" || connection?.status === "syncing")
      && hasSyncTime
      && (!Number.isFinite(errorMs) || errorMs <= syncMs);
    const fresh = healthy && freshnessSeconds !== null && freshnessSeconds <= 48 * 60 * 60;
    return {
      store: store.shop_name ?? "Tienda sin nombre",
      connection_status: store.connection_id ? connection?.status ?? "unknown" : "not_connected",
      last_sync_at: connection?.last_sync_at ?? null,
      freshness_seconds: freshnessSeconds,
      has_error_after_sync: Number.isFinite(errorMs) && (!hasSyncTime || errorMs > syncMs),
      availability: fresh ? "fresh" as const : healthy ? "stale" as const : "unknown_or_unavailable" as const,
    };
  });
  const status = rows.length === 0
    ? "no_active_stores"
    : rows.every((row) => row.availability === "fresh")
      ? "fresh"
      : "partial_or_unavailable";
  return {
    provider: "shopify" as const,
    scope: selectedStoreId ? "selected_store" as const : "active_organization_stores" as const,
    status,
    stores: rows,
    note: "La frescura de la conexión no prueba que cada métrica cubra toda la ventana solicitada; usa por separado la cobertura explícita de cada fuente.",
  };
}
