"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";

export type ShopifyOverview = {
  organization_id: string;
  connection: {
    id: string;
    provider_account_name: string | null;
    provider_account_id: string | null;
    status: string;
    scopes?: string[];
    api_version: string | null;
    connected_at: string | null;
    last_sync_at: string | null;
    last_error_message: string | null;
  } | null;
  connections: Array<{
    id: string;
    provider_account_name: string | null;
    provider_account_id: string | null;
    status: string;
  }>;
  selected_connection_id: string | null;
  authorized_scopes: string[];
  scope_catalog: Array<{
    scope: string;
    area: string;
    status:
      | "active_ingestion"
      | "authorized_pending_ingestion"
      | "metric_source"
      | "special_access";
    fields: string[];
    enables: string[];
  }>;
  store: {
    shop_name: string;
    myshopify_domain: string;
    primary_domain: string | null;
    currency_code: string | null;
    timezone: string | null;
    plan_display_name: string | null;
    taxes_included: boolean | null;
    updated_at: string;
  } | null;
  datasets: Array<{
    key: string;
    label: string;
    table: string | null;
    description: string;
    status: "active" | "planned";
    scopes: string[];
    sync_scope:
      "catalog" | "inventory" | "orders" | "refunds" | "customers" | null;
    count: number;
  }>;
  samples: {
    products: Array<{
      id: string;
      title: string;
      handle: string | null;
      vendor: string | null;
      product_type: string | null;
      status: string | null;
      external_updated_at: string | null;
    }>;
    orders: Array<{
      id: string;
      order_name: string | null;
      financial_status: string | null;
      fulfillment_status: string | null;
      current_total_price: number;
      net_sales: number;
      refunds: number;
      processed_at: string | null;
    }>;
    inventory: Array<{
      id: string;
      sku: string | null;
      tracked: boolean;
      requires_shipping: boolean;
      current_unit_cost: number | null;
      cost_currency_code: string | null;
      external_updated_at: string | null;
    }>;
  };
  sync_runs: Array<{
    id: string;
    sync_type: string;
    status: string;
    records_read: number;
    records_written: number;
    records_failed: number;
    error_message: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
  }>;
  sync_blocks: Record<
    "catalog" | "inventory" | "orders" | "refunds" | "customers",
    {
      status: string;
      records_read: number;
      records_written: number;
      records_failed: number;
      error_message: string | null;
      started_at: string | null;
      finished_at: string | null;
      created_at: string;
    } | null
  >;
};

/**
 * Carga y mantiene fresco el overview de Shopify de una organizacion/tienda:
 * compartido entre /shopify (negocio) y /shopify/diagnostico (tecnico) para
 * no duplicar el fetch, el polling durante sync y el disparo manual de sync.
 */
export function useShopifyOverview(
  organizationId: string | undefined,
  connectionId: string,
) {
  const [overview, setOverview] = useState<ShopifyOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(
    async (options: { initial?: boolean } = {}) => {
      if (!organizationId) {
        setError("No hay organización activa.");
        setIsLoading(false);
        return;
      }

      if (options.initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const connectionParam = connectionId
        ? `?connectionId=${encodeURIComponent(connectionId)}`
        : "";
      let response: Response;
      try {
        response = await apiFetch(
          `/v1/organizations/${organizationId}/shopify/overview${connectionParam}`,
          options.initial ? undefined : { cache: "no-store" },
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el diagnóstico de Shopify.",
        );
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [
            body?.error ?? `HTTP ${response.status}`,
            body?.message,
            body?.detail,
          ]
            .filter(Boolean)
            .join(" - "),
        );
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setOverview((await response.json()) as ShopifyOverview);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [organizationId, connectionId],
  );

  const triggerSync = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    const connectionParam = connectionId
      ? `?connectionId=${encodeURIComponent(connectionId)}`
      : "";
    let response: Response;
    try {
      response = await apiFetch(
        `/v1/organizations/${organizationId}/shopify/sync${connectionParam}`,
        { method: "POST" },
      );
    } catch (syncRequestError) {
      setSyncError(
        syncRequestError instanceof Error
          ? syncRequestError.message
          : "No se pudo iniciar la sincronización de Shopify.",
      );
      setIsSyncing(false);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        detail?: string;
      } | null;
      setSyncError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      setIsSyncing(false);
      return;
    }

    setIsSyncing(false);
    void load();
  }, [connectionId, load, organizationId]);

  useEffect(() => {
    void load({ initial: true });
  }, [load]);

  useEffect(() => {
    if (
      overview?.connection?.status !== "syncing" &&
      overview?.sync_runs[0]?.status !== "running"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [load, overview?.connection?.status, overview?.sync_runs]);

  return {
    overview,
    isLoading,
    isRefreshing,
    error,
    reload: load,
    isSyncing,
    syncError,
    triggerSync,
  };
}
