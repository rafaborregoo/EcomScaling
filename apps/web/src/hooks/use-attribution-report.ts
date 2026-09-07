"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";

/**
 * Las tres fuentes de "que ha rendido esto", cargadas juntas y guardadas
 * SEPARADAS a proposito (ADR-0021).
 *
 * Klaviyo y Meta no miden lo mismo ni en la misma ventana: cada uno atribuye
 * una compra a su propio contacto, y la misma venta puede aparecer en los dos.
 * Sumarlas produce una cifra que no existe en ninguna parte y que ademas
 * supera a la venta real. Shopify es el unico dato first-party -- lo que la
 * tienda facturo de verdad -- y va al lado como referencia, nunca como la
 * suma de los otros dos.
 *
 * Por eso este hook no expone un total: expone tres bloques.
 */
export type KlaviyoAttribution = {
  connected: boolean;
  period: { days: number | string; start: string | null; end: string };
  totals: {
    revenue: number;
    conversions: number;
    recipients: number;
    delivered: number;
    open_rate: number | null;
    click_rate: number | null;
  };
  previous: { revenue: number; conversions: number } | null;
  campaigns: Array<{
    id: string;
    name: string;
    subject: string | null;
    send_time: string | null;
    revenue: number;
    conversions: number;
    open_rate: number | null;
    click_rate: number | null;
  }>;
};

export type MetaAttribution = {
  period: { days: number | string; start: string | null; end: string };
  acquisition: {
    spend: number | string;
    purchases: number | string;
    purchase_value: number | string;
    roas: number | string | null;
    purchase_action_types: string[] | null;
  };
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string | null;
    spend: number | string | null;
    purchases: number | string | null;
    purchase_value: number | string | null;
    roas: number | string | null;
    purchase_action_type: string | null;
  }>;
};

export type ShopifyFirstParty = {
  sales: { net_sales: number; orders_count: number };
} | null;

export function useAttributionReport(organizationId: string, days: number) {
  const [klaviyo, setKlaviyo] = useState<KlaviyoAttribution | null>(null);
  const [meta, setMeta] = useState<MetaAttribution | null>(null);
  const [shopify, setShopify] = useState<ShopifyFirstParty>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Cada fuente puede faltar por su cuenta (integracion sin conectar,
    // feature flag apagado). Una ausencia no puede vaciar a las otras dos, y
    // sobre todo no puede confundirse con un cero.
    const read = async <T,>(path: string): Promise<T | null> => {
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/${path}`,
        );
        return response.ok ? ((await response.json()) as T) : null;
      } catch {
        return null;
      }
    };
    const [klaviyoData, metaData, shopifyData] = await Promise.all([
      read<KlaviyoAttribution>(`klaviyo/email-report?days=${days}`),
      read<MetaAttribution>(`meta/metrics?days=${days}`),
      read<ShopifyFirstParty>(`shopify/metrics?days=${days}`),
    ]);
    setKlaviyo(klaviyoData);
    setMeta(metaData);
    setShopify(shopifyData);
    setIsLoading(false);
  }, [organizationId, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { klaviyo, meta, shopify, isLoading, reload };
}

export const num = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed) : 0;
};
