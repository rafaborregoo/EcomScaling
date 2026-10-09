"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { Card, ErrorBlock, List, LoadingBlock, Switch, toast } from "@/components/ui";

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

export function NotificationsSection({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const userId = bootstrap.user.id;
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
                <p className="text-sm font-medium">{category.label}</p>
                <p className="text-xs text-muted">{category.hint}</p>
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
  );
}
