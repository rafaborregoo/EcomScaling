"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  Card,
  ErrorBlock,
  List,
  LoadingBlock,
  Select,
  SettingRow,
  Switch,
  toast,
} from "@/components/ui";

/**
 * Qué avisos llegan a la campana. La regla la aplica un trigger de BD al
 * insertar la notificación (`notification_preferences`), así que vale para
 * cualquier generador. Solo existe el canal de la app: no hay emisor de email
 * para notificaciones.
 */

const CATEGORIES = [
  {
    key: "alert",
    label: "Alertas de tu tienda",
    hint: "Stock bajo, caída de ventas, integración sin sincronizar.",
  },
  {
    key: "task_assigned",
    label: "Tareas nuevas de tu consultor",
    hint: "Cuando te asignan trabajo.",
  },
  {
    key: "other",
    label: "Otros avisos",
    hint: "Todo lo que no entra en las categorías de arriba.",
  },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

// El consultor recibe los mismos tipos, pero de toda su cartera.
const CONSULTANT_LABELS: Record<CategoryKey, { label: string; hint: string }> = {
  alert: { label: "Alertas de tus clientes", hint: "Stock bajo, caída de ventas, integraciones paradas." },
  task_assigned: { label: "Tareas que te asignan", hint: "Las del reparto y las que nacen de alertas o de la IA." },
  other: { label: "Otros avisos", hint: "Mensajes, resúmenes y todo lo demás." },
};

/**
 * Silenciar un cliente: no llega nada suyo a la campana (lo aplica el mismo
 * trigger que las categorías). Su trabajo sigue en la Mesa de hoy.
 */
function MutedClientsCard({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const organizationsQuery = useCachedQuery<{
    organizations?: Array<{ id: string; display_name: string; is_own_store?: boolean }>;
  }>("/v1/consultant/organizations");
  const clients = (organizationsQuery.data?.organizations ?? []).filter((item) => !item.is_own_store);
  const [muted, setMuted] = useState<string[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notification_muted_organizations")
      .select("organization_id");
    setMuted(error ? [] : (data ?? []).map((row) => row.organization_id as string));
  }, [supabase]);

  useEffect(() => {
    // Carga inicial desde BD; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function mute() {
    if (!choice) return;
    setBusy(true);
    const { error } = await supabase
      .from("notification_muted_organizations")
      .insert({ user_id: userId, organization_id: choice });
    setBusy(false);
    if (error) {
      toast.danger("No se pudo silenciar el cliente.");
      return;
    }
    setChoice("");
    void load();
  }

  async function unmute(organizationId: string) {
    const { error } = await supabase
      .from("notification_muted_organizations")
      .delete()
      .eq("organization_id", organizationId);
    if (error) {
      toast.danger("No se pudo quitar el silencio.");
      return;
    }
    void load();
  }

  const nameOf = (id: string) => clients.find((client) => client.id === id)?.display_name ?? "Cliente";
  const available = clients.filter((client) => !(muted ?? []).includes(client.id));

  return (
    <Card title="Clientes silenciados" description="No te llega nada de ellos a la campana. Su trabajo sigue en la Mesa de hoy.">
      {muted === null ? (
        <LoadingBlock label="Cargando..." />
      ) : (
        <>
          <SettingRow label="Silenciados ahora">
            {muted.length === 0 ? (
              <span className="text-sm text-muted">Ninguno</span>
            ) : (
              muted.map((id) => (
                <Badge key={id} tone="neutral">
                  {nameOf(id)}{" "}
                  <button
                    type="button"
                    className="ml-1 text-muted hover:text-foreground"
                    aria-label={`Quitar el silencio a ${nameOf(id)}`}
                    onClick={() => void unmute(id)}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </SettingRow>
          {available.length > 0 ? (
            <SettingRow label="Silenciar otro cliente">
              <Select
                aria-label="Cliente a silenciar"
                className="w-56"
                value={choice}
                onChange={setChoice}
                options={[
                  { value: "", label: "Elige un cliente" },
                  ...available.map((client) => ({ value: client.id, label: client.display_name })),
                ]}
              />
              <Button size="sm" variant="secondary" disabled={!choice || busy} onClick={() => void mute()}>
                {busy ? "Guardando…" : "Silenciar"}
              </Button>
            </SettingRow>
          ) : null}
        </>
      )}
    </Card>
  );
}

export function NotificationsSection({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const userId = bootstrap.user.id;
  const isConsultant = ["consultant", "platform_admin"].includes(bootstrap.profile.platform_role);
  const [enabled, setEnabled] = useState<Record<CategoryKey, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("notification_preferences")
      .select("category, in_app");
    if (loadError) {
      setError("No se pudieron cargar tus preferencias. Revisa la conexión.");
      return;
    }
    // Sin fila = encendido: es lo que hace el trigger.
    const next: Record<CategoryKey, boolean> = {
      alert: true,
      task_assigned: true,
      other: true,
    };
    for (const row of data ?? []) {
      if (row.category in next) next[row.category as CategoryKey] = row.in_app;
    }
    setEnabled(next);
    setError(null);
  }, [supabase]);

  useEffect(() => {
    // Carga inicial desde BD; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggle(category: CategoryKey, value: boolean) {
    setEnabled((current) => (current ? { ...current, [category]: value } : current));
    const { error: saveError } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: userId,
        category,
        in_app: value,
        updated_at: new Date().toISOString(),
      });
    if (saveError) {
      toast.danger("No se pudo guardar el cambio.");
      void load();
    }
  }

  return (
    <div className="space-y-4">
    <Card
      title="Qué te avisamos en la app"
      description="Lo que apagues deja de llegar a la campana. Las alertas siguen visibles en tu panel."
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!enabled && !error ? <LoadingBlock label="Cargando preferencias..." /> : null}
      {enabled ? (
        <List>
          {CATEGORIES.map((category) => (
            <List.Item
              key={category.key}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {isConsultant ? CONSULTANT_LABELS[category.key].label : category.label}
                </p>
                <p className="text-xs text-muted">
                  {isConsultant ? CONSULTANT_LABELS[category.key].hint : category.hint}
                </p>
              </div>
              <Switch
                aria-label={category.label}
                isSelected={enabled[category.key]}
                onChange={(value: boolean) => void toggle(category.key, value)}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </List.Item>
          ))}
        </List>
      ) : null}
    </Card>
    {isConsultant ? <MutedClientsCard userId={userId} /> : null}
    </div>
  );
}
