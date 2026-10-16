"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { Button, Card, ErrorBlock, LoadingBlock, SettingRow, Switch, Tabs, toast } from "@/components/ui";
import { ACTIVITY_FILTERS, activityLabel, type ActivityItem } from "./activity-labels";

/**
 * Seguridad del equipo (exigir 2FA) y actividad de la cuenta: quién cambió
 * qué. La actividad sale de `audit_logs`, que hasta ahora solo veía la
 * plataforma.
 */

type Security = {
  require_mfa: boolean;
  can_edit: boolean;
  members: Array<{ user_id: string; role: string; has_mfa: boolean }>;
};

export function TeamSecurityCard({ organizationId }: { organizationId: string }) {
  const path = `/v1/organizations/${organizationId}/security`;
  const query = useCachedQuery<Security>(path);
  const [busy, setBusy] = useState(false);

  async function toggle(value: boolean) {
    setBusy(true);
    try {
      const response = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ require_mfa: value }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      invalidateCachedQueries(path);
      query.reload();
      toast.success(value ? "El equipo tendrá que usar la verificación en dos pasos" : "Verificación en dos pasos opcional");
    } catch {
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setBusy(false);
    }
  }

  if (query.error) return <ErrorBlock>No se pudo cargar la seguridad del equipo.</ErrorBlock>;
  if (!query.data) return <LoadingBlock label="Cargando la seguridad del equipo…" />;

  const withMfa = query.data.members.filter((member) => member.has_mfa).length;
  return (
    <Card title="Seguridad del equipo" description={query.data.can_edit ? undefined : "La cambia el propietario de la cuenta."}>
      <SettingRow
        label="Exigir verificación en dos pasos a todo el equipo"
        hint={`Quien no la tenga no podrá operar en la cuenta hasta activarla. Hoy: ${withMfa} de ${query.data.members.length} personas. No afecta a tu consultor.`}
      >
        <Switch
          aria-label="Exigir verificación en dos pasos"
          isSelected={query.data.require_mfa}
          isDisabled={!query.data.can_edit || busy}
          onChange={(value: boolean) => void toggle(value)}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </SettingRow>
    </Card>
  );
}

export function ActivityCard({ organizationId }: { organizationId: string }) {
  const [category, setCategory] = useState<string>("todo");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(before: string | null) {
    const params = new URLSearchParams({ limit: "30" });
    if (category !== "todo") params.set("category", category);
    if (before) params.set("before", before);
    const response = await apiFetch(`/v1/organizations/${organizationId}/activity?${params}`);
    if (!response.ok) throw new Error(await readApiError(response));
    return (await response.json()) as { items: ActivityItem[]; next_before: string | null };
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    load(null)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNext(page.next_before);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la actividad.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, category]);

  async function more() {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await load(next);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNext(page.next_before);
    } catch {
      toast.danger("No se pudo cargar más actividad.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card id="actividad" title="Actividad de la cuenta" description="Quién cambió qué, empezando por lo último.">
      <Tabs value={category} onChange={setCategory} items={ACTIVITY_FILTERS.map((filter) => ({ ...filter }))} />
      <div className="mt-4">
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : !items ? (
          <LoadingBlock label="Leyendo la actividad…" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">Sin actividad en este filtro.</p>
        ) : (
          <ul className="divide-y divide-separator">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{activityLabel(item.action)}</p>
                  <p className="text-xs text-muted">
                    {item.actor ? (item.actor.name ?? "Sin nombre") : "Sistema"}
                    {item.actor?.kind === "consultant" ? " · consultor" : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {next ? (
          <Button className="mt-4" size="sm" variant="ghost" disabled={loadingMore} onClick={() => void more()}>
            {loadingMore ? "Cargando…" : "Ver más"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
