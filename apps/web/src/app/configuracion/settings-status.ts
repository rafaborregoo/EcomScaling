"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Qué está completo en Configuración. Una sola fuente para el Resumen y para
 * los puntos del menú: cada valor sale de un dato real, `null` = aún no se sabe.
 */

type Config = {
  settings: unknown;
  fixed_expenses: unknown[];
  metric_targets: unknown[];
};

export type SettingsStatus = {
  shopify: boolean | null;
  costs: boolean | null;
  fixed: boolean | null;
  targets: boolean | null;
  alerts: boolean | null;
  consultant: boolean | null;
  twoFactor: boolean | null;
  counts: {
    fixedExpenses: number | null;
    targets: number | null;
    enabledAlerts: number | null;
    totalAlerts: number | null;
  };
};

/** Activa la verificación en dos pasos (TOTP verificado en Supabase Auth). */
export function useTwoFactorEnabled(): boolean | null {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!cancelled) setEnabled(error ? null : (data?.totp.length ?? 0) > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);
  return enabled;
}

export function useSettingsStatus(
  organizationId: string | null,
  // El menú no necesita saber si hay consultor: se ahorra esa petición.
  { includeConsultant = true }: { includeConsultant?: boolean } = {},
): SettingsStatus {
  const base = organizationId ? `/v1/organizations/${organizationId}` : null;
  const config = useCachedQuery<Config>(base ? `${base}/financial-config` : null);
  const rules = useCachedQuery<{ rules: Array<{ is_enabled: boolean }> }>(
    base ? `${base}/alert-rules` : null,
  );
  const integrations = useCachedQuery<{
    providers: Array<{ id: string; connection: { status: string } | null }>;
  }>(base ? `${base}/integrations` : null);
  const { consultant, resolved } = useAssignedConsultant(
    includeConsultant ? organizationId : null,
  );
  const twoFactor = useTwoFactorEnabled();

  const enabledAlerts = rules.data
    ? rules.data.rules.filter((rule) => rule.is_enabled).length
    : null;
  const fixedExpenses = config.data ? config.data.fixed_expenses.length : null;
  const targets = config.data ? config.data.metric_targets.length : null;

  return {
    shopify: integrations.data
      ? integrations.data.providers.some(
          (provider) =>
            provider.id.toLowerCase().includes("shopify") &&
            provider.connection?.status === "connected",
        )
      : null,
    costs: config.data ? config.data.settings !== null : null,
    fixed: fixedExpenses === null ? null : fixedExpenses > 0,
    targets: targets === null ? null : targets > 0,
    alerts: enabledAlerts === null ? null : enabledAlerts > 0,
    consultant: includeConsultant && organizationId && resolved ? Boolean(consultant) : null,
    twoFactor,
    counts: {
      fixedExpenses,
      targets,
      enabledAlerts,
      totalAlerts: rules.data?.rules.length ?? null,
    },
  };
}

/**
 * Estado por sección del menú (`?section=`): verde si todo lo que depende de
 * ella está hecho, pendiente si algo falta; sin entrada si no aplica.
 */
export function sectionStatus(status: SettingsStatus): Record<string, boolean | null> {
  const all = (...values: Array<boolean | null>) =>
    values.some((value) => value === null) ? null : values.every(Boolean);
  return {
    rentabilidad: all(status.costs, status.fixed),
    objetivos: status.targets,
    alertas: status.alerts,
    seguridad: status.twoFactor,
  };
}

/** Calcula el estado una vez y se lo pasa al menú de Configuración. */
export function SettingsNavStatus({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: (dots: Record<string, boolean | null>) => ReactNode;
}) {
  const status = useSettingsStatus(organizationId, { includeConsultant: false });
  return children(sectionStatus(status));
}
