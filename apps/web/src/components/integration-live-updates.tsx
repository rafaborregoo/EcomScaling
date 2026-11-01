"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { invalidateCachedQueries } from "@/lib/use-cached-query";

/** One connection per portal, authorized by the existing organization RLS policies. */
export function IntegrationLiveUpdates({ organizationId }: { organizationId: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const refresh = () => {
      if (disposed || document.visibilityState === "hidden" || !navigator.onLine || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const base = organizationId ? `/v1/organizations/${organizationId}` : "/v1/consultant";
        invalidateCachedQueries((organizationId
          ? ["/shopify", "/meta", "/klaviyo", "/integrations", "/stores"]
          : [""]).map((resource) => `${base}${resource}`));
        window.dispatchEvent(new Event("integration-status-changed"));
      }, 500);
    };
    const client = getSupabaseClient();
    const changeFilter = {
      schema: "public", table: "integration_changes",
      ...(organizationId ? { filter: `organization_id=eq.${organizationId}` } : {}),
    };
    const channel = client.channel(`integration-updates:${organizationId || "portfolio"}`)
      .on("postgres_changes", { ...changeFilter, event: "INSERT" }, refresh)
      .on("postgres_changes", { ...changeFilter, event: "UPDATE" }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    // Reconnect/focus recovery and a bounded fallback if WebSocket delivery is unavailable.
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void client.removeChannel(channel);
    };
  }, [organizationId]);
  return null;
}
