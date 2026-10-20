"use client";

import { notificationTypesIn, type NotificationCategory } from "@e-nora/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorBlock,
  LoadingBlock,
  Select,
  SettingRow,
  Switch,
  toast,
} from "@/components/ui";

/**
 * Qué avisos llegan, por dónde (campana y email) y cuándo. La campana la filtra
 * un trigger de BD; el email, el tick del worker (notification-email.ts). Las
 * preferencias se guardan por la API desde 20261219110000.
 */

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

type EmailMode = "instant" | "digest" | "off";
type Preference = { category: string; in_app: boolean; email: EmailMode };
type DigestSettings = {
  digest_frequency: "daily" | "weekly" | "never";
  digest_weekday: number;
  digest_hour: number;
  timezone: string;
  quiet_enabled: boolean;
  quiet_from: number;
  quiet_to: number;
};
type NotificationSettingsResponse = {
  preferences: Preference[];
  settings: DigestSettings;
  email: string | null;
};

const CLIENT_LABELS: Record<string, { label: string; hint: string }> = {
  alert_critical: { label: "Alertas críticas de tu tienda", hint: "Ventas que se hunden, stock agotado de lo que más vendes." },
  alert: { label: "Otras alertas", hint: "Cambios de tendencia y avisos de menor importancia." },
  task_assigned: { label: "Tareas y Mi Camino", hint: "Tareas nuevas, comentarios, el «Para hoy» y cambios de objetivos." },
  message: { label: "Mensajes de tu consultor", hint: "Uno por conversación hasta que lo leas." },
  campaign_review: { label: "Campañas para revisar", hint: "Borradores que esperan tu visto bueno." },
  integration: { label: "Integraciones que dejan de sincronizar", hint: "Shopify, Meta Ads, Klaviyo o Instagram." },
  other: { label: "Otros avisos", hint: "Todo lo que no entra arriba." },
};

const CONSULTANT_LABELS: Record<string, { label: string; hint: string }> = {
  alert_critical: { label: "Alertas críticas de tus clientes", hint: "Ventas que se hunden, stock agotado de lo que más venden." },
  alert: { label: "Otras alertas de tus clientes", hint: "Cambios de tendencia y avisos de menor importancia." },
  task_assigned: { label: "Tareas, IA y Mi Camino", hint: "Tareas que tus clientes cierran o comentan, el «Para hoy» y propuestas de la IA pendientes." },
  message: { label: "Mensajes de tus clientes", hint: "Uno por cliente hasta que lo leas." },
  campaign_review: { label: "Campañas y piezas para revisar", hint: "Lo que tus clientes o la IA te piden revisar." },
  integration: { label: "Integraciones caídas en tu cartera", hint: "Incluye tus tiendas propias." },
  client: { label: "Altas y decisiones de tus clientes", hint: "Altas con tu código, cambios de tus permisos y lo que deciden sobre la IA." },
  other: { label: "Otros avisos", hint: "Todo lo que no entra arriba." },
};

const EMAIL_OPTIONS = [
  { value: "instant", label: "Al momento" },
  { value: "digest", label: "En el resumen" },
  { value: "off", label: "No" },
];
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${hour}:00` }));
const TIMEZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Lisbon",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
];

export function NotificationsSection({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const isConsultant = ["consultant", "platform_admin"].includes(bootstrap.profile.platform_role);
  const labels = isConsultant ? CONSULTANT_LABELS : CLIENT_LABELS;
  const path = "/v1/me/notification-settings";
  const query = useCachedQuery<NotificationSettingsResponse>(path);
  const [local, setLocal] = useState<NotificationSettingsResponse | null>(null);
  const data = local ?? query.data ?? null;
  const [saving, setSaving] = useState(false);

  async function save(body: { preferences?: Array<Partial<Preference> & { category: string }>; settings?: Partial<DigestSettings> }) {
    if (!data) return;
    // Optimista: se ve el cambio al momento y se deshace si la API lo rechaza.
    setLocal({
      ...data,
      preferences: data.preferences.map((pref) => ({
        ...pref,
        ...(body.preferences?.find((change) => change.category === pref.category) ?? {}),
      })),
      settings: { ...data.settings, ...(body.settings ?? {}) },
    });
    setSaving(true);
    try {
      const response = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setLocal(null);
        toast.danger(await readApiError(response));
        return;
      }
      setLocal((await response.json()) as NotificationSettingsResponse);
      invalidateCachedQueries(path);
    } catch {
      setLocal(null);
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setSaving(false);
    }
  }

  if (query.error && !data) return <ErrorBlock>No se pudieron cargar tus preferencias.</ErrorBlock>;
  if (!data) return <LoadingBlock label="Cargando preferencias..." />;

  const settings = data.settings;
  return (
    <div className="space-y-6">
      <Card
        title="Qué te avisamos"
        description="En la app es la campana. Por email, al momento o junto en el resumen. Son tuyas: no cambian las de tu equipo."
      >
        <div className="grid gap-0">
          {data.preferences.map((pref) => {
            const label = labels[pref.category] ?? { label: pref.category, hint: "" };
            // Qué avisos concretos entran en este interruptor (catálogo único).
            const audience = labels === CONSULTANT_LABELS ? "consultor" : "cliente";
            const included = notificationTypesIn(pref.category as NotificationCategory)
              .filter((type) => type.audience === "ambos" || type.audience === audience)
              .map((type) => type.label);
            const hint = included.length > 1 ? `${label.hint} Incluye: ${included.join(", ")}.` : label.hint;
            return (
              <SettingRow key={pref.category} label={label.label} hint={hint}>
                <Switch
                  aria-label={`${label.label} en la app`}
                  isSelected={pref.in_app}
                  isDisabled={saving}
                  onChange={(value: boolean) => void save({ preferences: [{ category: pref.category, in_app: value }] })}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <span className="text-xs text-muted">App</span>
                <Select
                  className="w-40"
                  aria-label={`${label.label} por email`}
                  value={pref.email}
                  onChange={(value) => void save({ preferences: [{ category: pref.category, email: value as EmailMode }] })}
                  options={EMAIL_OPTIONS}
                  disabled={saving}
                />
              </SettingRow>
            );
          })}
        </div>
      </Card>

      <Card title="Resumen por email" description={data.email ? `A ${data.email}.` : undefined}>
        <SettingRow label="Frecuencia">
          <Select
            className="w-40"
            aria-label="Frecuencia del resumen"
            value={settings.digest_frequency}
            onChange={(value) => void save({ settings: { digest_frequency: value as DigestSettings["digest_frequency"] } })}
            options={[
              { value: "daily", label: "Diario" },
              { value: "weekly", label: "Semanal" },
              { value: "never", label: "Nunca" },
            ]}
          />
        </SettingRow>
        {settings.digest_frequency !== "never" ? (
          <SettingRow label="Cuándo llega">
            {settings.digest_frequency === "weekly" ? (
              <Select
                className="w-36"
                aria-label="Día del resumen"
                value={String(settings.digest_weekday)}
                onChange={(value) => void save({ settings: { digest_weekday: Number(value) } })}
                options={WEEKDAYS.map((day, index) => ({ value: String(index + 1), label: day }))}
              />
            ) : null}
            <Select
              className="w-28"
              aria-label="Hora del resumen"
              value={String(settings.digest_hour)}
              onChange={(value) => void save({ settings: { digest_hour: Number(value) } })}
              options={HOURS}
            />
          </SettingRow>
        ) : null}
        <SettingRow label="Tu zona horaria">
          <Select
            className="w-64"
            aria-label="Zona horaria de los avisos"
            value={settings.timezone}
            onChange={(value) => void save({ settings: { timezone: value } })}
            options={[...new Set([settings.timezone, ...TIMEZONES])].map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
          />
        </SettingRow>
      </Card>

      <Card title="Horario sin emails" description="Fuera de este horario solo llegan las alertas críticas; el resto espera a que acabe.">
        <SettingRow label="Activar">
          <Switch
            aria-label="Activar horario sin emails"
            isSelected={settings.quiet_enabled}
            onChange={(value: boolean) => void save({ settings: { quiet_enabled: value } })}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </SettingRow>
        {settings.quiet_enabled ? (
          <SettingRow label="Silencio">
            <span className="text-sm text-muted">de</span>
            <Select
              className="w-28"
              aria-label="Desde"
              value={String(settings.quiet_from)}
              onChange={(value) => void save({ settings: { quiet_from: Number(value) } })}
              options={HOURS}
            />
            <span className="text-sm text-muted">a</span>
            <Select
              className="w-28"
              aria-label="Hasta"
              value={String(settings.quiet_to)}
              onChange={(value) => void save({ settings: { quiet_to: Number(value) } })}
              options={HOURS}
            />
          </SettingRow>
        ) : null}
      </Card>

      {isConsultant ? <MutedClientsCard userId={bootstrap.user.id} /> : null}

      <Card title="Informe mensual en PDF" actions={<ButtonLink href="/informes" size="sm" variant="ghost">Abrir Informes</ButtonLink>}>
        <p className="text-sm text-muted">El envío mensual y sus destinatarios se gestionan en Informes.</p>
      </Card>
    </div>
  );
}
