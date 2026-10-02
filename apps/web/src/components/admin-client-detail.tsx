"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue } from "@/lib/display-labels";
import {
  ConcesionDePlan,
  concesionInicial,
  concesionValida,
  grantPlanBody,
  PlanEditor,
} from "@/components/concesion-de-plan";
import { auditSummary } from "@/app/admin/logs/audit-entry";
import {
  AsyncState,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  Select,
  Table,
  type TableColumnDef,
  toast,
} from "@/components/ui";

export type Client = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  created_at: string;
  member_count: number;
  consultants: Array<{ user_id: string; full_name: string | null; is_primary: boolean }>;
  plan: { plan_code: string; store_limit: number | null; status: string; ends_at: string | null } | null;
};

export const CLIENT_STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Activo" },
  { value: "suspended", label: "Suspendido" },
  { value: "cancelled", label: "Cancelado" },
];
type Overview = {
  integrations: Array<{
    id: string;
    provider: string;
    provider_account_name: string | null;
    status: string;
    connected_at: string;
    last_sync_at: string | null;
  }>;
  recent_syncs: Array<{
    id: string;
    provider: string;
    sync_type: string;
    status: string;
    error_message: string | null;
    started_at: string;
    finished_at: string | null;
  }>;
  members: Array<{
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    full_name: string | null;
  }>;
  consultants: Array<{
    user_id: string;
    full_name: string | null;
    is_primary: boolean;
  }>;
  pending_invite: { id: string; email: string; expires_at: string } | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const syncStatusTone = (status: string) =>
  status === "success"
    ? ("success" as const)
    : status === "failed" || status === "cancelled"
      ? ("danger" as const)
      : ("neutral" as const);

type AuditEntry = {
  id: string;
  action: string;
  created_at: string;
  actor_name: string | null;
};

/**
 * Resumen corto, no una segunda pantalla de auditoría: las últimas acciones
 * sobre este cliente, y un enlace a /admin/logs/auditoria ya filtrado si hay
 * que mirar más atrás.
 */
export function ClientAuditCard({ organizationId }: { organizationId: string }) {
  const { data, error } = useCachedQuery<{ entries: AuditEntry[] }>(
    `/v1/admin/audit-log?organizationId=${organizationId}&limit=8`,
  );

  return (
    <Card
      title="Últimos movimientos"
      description="Lo que se ha hecho sobre este cliente."
      actions={
        <Link href={`/admin/logs/auditoria?organizationId=${organizationId}`}>
          Ver todo
        </Link>
      }
    >
      {error && !data ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !data ? (
        <LoadingBlock label="Cargando movimientos…" />
      ) : data.entries.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          hint="Todavía no hay acciones registradas sobre este cliente."
        />
      ) : (
        <List as="ul">
          {data.entries.map((entry) => {
            const summary = auditSummary(entry.action);
            return (
              <List.Item
                as="li"
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
              >
                <Badge>{summary.area}</Badge>
                <span className="min-w-0 flex-1 text-sm">
                  <strong>{entry.actor_name ?? "Alguien"}</strong> {summary.verb}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {when(entry.created_at)}
                </span>
              </List.Item>
            );
          })}
        </List>
      )}
    </Card>
  );
}

const MEMBER_ROLE_OPTIONS = [
  { value: "owner", label: "Propietario" },
  { value: "manager", label: "Gestor" },
  { value: "member", label: "Miembro" },
  { value: "readonly", label: "Solo lectura" },
];

/** Ficha 360: todo lo que hay que mirar de un cliente antes de hablar con él. */
export function ClientOverviewPanel({ organizationId }: { organizationId: string }) {
  const { data, error, isLoading, reload } = useCachedQuery<Overview>(
    `/v1/admin/clients/${organizationId}/overview`,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [retryingSyncId, setRetryingSyncId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [freshInvite, setFreshInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // No reenvía ningún correo: caduca el código viejo y devuelve uno nuevo, que
  // hay que hacerle llegar al cliente a mano.
  async function regenerateInvite(inviteId: string) {
    setRegenerating(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/invites/${inviteId}/regenerate`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { access_url: string };
      setFreshInvite(payload.access_url);
      setCopied(false);
      toast.success("Enlace de acceso nuevo. El anterior ya no vale.");
    } catch {
      toast.danger("No se pudo regenerar la invitación por un error de red.");
    } finally {
      setRegenerating(false);
    }
  }

  // Mismo endpoint que el boton de /admin/logs/errores-sync: aqui ahorra ir a
  // buscar el fallo a la pantalla de logs cuando ya lo tienes delante.
  async function retrySync(runId: string) {
    setRetryingSyncId(runId);
    try {
      const response = await apiFetch(`/v1/admin/sync-errors/${runId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Sincronización relanzada.");
      reload();
    } catch {
      toast.danger("No se pudo relanzar el sync por un error de red.");
    } finally {
      setRetryingSyncId(null);
    }
  }

  // El mismo PUT sirve para cambiar el rol y para dar/quitar acceso: solo
  // cambia el campo que se manda.
  async function saveMember(
    userId: string,
    change: { role?: string; is_active?: boolean },
  ) {
    setBusyUserId(userId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/members`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, ...change }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(
        change.role
          ? "Rol actualizado."
          : change.is_active
            ? "Acceso reactivado."
            : "Acceso retirado.",
      );
      reload();
    } catch {
      toast.danger("No se pudo guardar el cambio por un error de red.");
    } finally {
      setBusyUserId(null);
    }
  }

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando ficha..." />;
  }
  if (error && !data) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!data) return null;

  const pendingInvite = data.pending_invite;

  const integrationColumns: TableColumnDef<Overview["integrations"][number]>[] = [
    { key: "provider", label: "Proveedor", render: (row) => displayValue(row.provider) },
    {
      key: "account",
      label: "Cuenta",
      render: (row) => row.provider_account_name ?? "—",
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <Badge tone={row.status === "active" ? "success" : "neutral"}>
          {displayValue(row.status)}
        </Badge>
      ),
    },
    {
      key: "last_sync_at",
      label: "Último sync",
      render: (row) => (row.last_sync_at ? when(row.last_sync_at) : "—"),
    },
  ];

  const memberColumns: TableColumnDef<Overview["members"][number]>[] = [
    { key: "name", label: "Nombre", render: (row) => row.full_name ?? row.user_id },
    {
      key: "role",
      label: "Rol",
      render: (row) => (
        <Select
          className="w-40"
          aria-label={`Rol de ${row.full_name ?? row.user_id}`}
          value={row.role}
          onChange={(role) => void saveMember(row.user_id, { role })}
          options={MEMBER_ROLE_OPTIONS}
        />
      ),
    },
    {
      key: "is_active",
      label: "Estado",
      render: (row) => (
        <Badge tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "activo" : "inactivo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end">
          {row.is_active ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost" disabled={busyUserId === row.user_id}>
                  Quitar acceso
                </Button>
              }
              title={`Quitar acceso a ${row.full_name ?? row.user_id}`}
              description="Deja de poder entrar en la organización. Se le puede devolver el acceso desde aquí mismo."
              confirmLabel="Quitar acceso"
              onConfirm={() => void saveMember(row.user_id, { is_active: false })}
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyUserId === row.user_id}
              onClick={() => void saveMember(row.user_id, { is_active: true })}
            >
              Devolver acceso
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <Card
        kicker="Ficha 360"
        title="Integraciones"
        description="Shopify, Meta Ads y Klaviyo conectados por este cliente."
      >
        <Table
          ariaLabel="Integraciones del cliente"
          columns={integrationColumns}
          rows={data.integrations}
          emptyLabel="Sin integraciones conectadas."
        />
      </Card>

      <Card title="Últimos syncs" description="Las 15 sincronizaciones más recientes.">
        {data.recent_syncs.length === 0 ? (
          <EmptyState title="Sin syncs todavía" hint="Este cliente no tiene sincronizaciones registradas." />
        ) : (
          <List as="ul">
            {data.recent_syncs.map((run) => (
              <List.Item
                as="li"
                key={run.id}
                className="flex flex-wrap items-start gap-3 py-3"
              >
                <Badge tone={syncStatusTone(run.status)}>
                  {displayValue(run.status)}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {displayValue(run.provider)} · {run.sync_type}
                  </span>
                  {run.error_message ? (
                    <span className="mt-0.5 block break-words text-xs text-muted">
                      {run.error_message.slice(0, 300)}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {when(run.started_at)}
                </span>
                {run.status === "failed" || run.status === "cancelled" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={retryingSyncId === run.id}
                    onClick={() => void retrySync(run.id)}
                  >
                    {retryingSyncId === run.id ? "Relanzando…" : "Reintentar"}
                  </Button>
                ) : null}
              </List.Item>
            ))}
          </List>
        )}
      </Card>

      <ClientAuditCard organizationId={organizationId} />

      <Card
        title="Acceso"
        description="Miembros del cliente y consultores asignados."
      >
        <div className="grid gap-4">
          {pendingInvite ? (
            <div className="grid gap-2 rounded-md border border-separator p-4">
              <p className="text-sm">
                Invitación sin usar para <strong>{pendingInvite.email}</strong>,
                caduca el {when(pendingInvite.expires_at)}.
              </p>
              {freshInvite ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={freshInvite}
                    aria-label="Enlace de acceso"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(freshInvite).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                  >
                    {copied ? "Copiado" : "Copiar enlace"}
                  </Button>
                </div>
              ) : (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={regenerating}
                    onClick={() => void regenerateInvite(pendingInvite.id)}
                  >
                    {regenerating ? "Regenerando…" : "Regenerar enlace"}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          {data.consultants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.consultants.map((c) => (
                <Badge key={c.user_id} tone="brand">
                  {c.full_name ?? c.user_id}
                  {c.is_primary ? " · principal" : ""}
                </Badge>
              ))}
            </div>
          ) : (
            <Badge tone="warn">sin consultor</Badge>
          )}
          <Table
            ariaLabel="Miembros del cliente"
            columns={memberColumns}
            rows={data.members}
            emptyLabel="Sin miembros."
          />
        </div>
      </Card>
    </div>
  );
}

export function CreateClientForm({
  onCreated,
}: {
  onCreated: (message: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [plan, setPlan] = useState(() => concesionInicial("starter", false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          owner_email: ownerEmail,
          owner_full_name: ownerFullName || undefined,
          currency_code: currencyCode,
          timezone,
          grant_plan: grantPlanBody(plan),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDisplayName("");
      setOwnerEmail("");
      setOwnerFullName("");
      await onCreated(
        `Cliente creado. Se ha enviado una invitación por email a ${ownerEmail}.`,
      );
    } catch {
      setError("No se pudo crear el cliente. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    displayName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) &&
    concesionValida(plan);

  return (
    <Card
      kicker="Alta"
      title="Nuevo cliente"
      description="Crea la organización e invita a su owner por email, y decide si le concedes el plan o lo paga él."
    >
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Acme Store"
            />
          </Field>
          <Field label="Email del owner">
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@acme.com"
            />
          </Field>
          <Field label="Nombre del owner (opcional)">
            <Input
              value={ownerFullName}
              onChange={(e) => setOwnerFullName(e.target.value)}
              placeholder="Nombre Apellido"
            />
          </Field>
          <Field label="Moneda">
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="EUR"
            />
          </Field>
          <Field label="Zona horaria">
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Madrid"
            />
          </Field>
        </div>

        <ConcesionDePlan
          value={plan}
          onChange={setPlan}
          etiquetaSinPlan="Empieza en trial y lo paga él"
          avisoSinPlan="Entra en trial abierto y elige plan en /planes. Un cliente sin ninguna suscripción no podría ni acceder a su organización."
        />

        <div>
          <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "Creando..." : "Crear cliente"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function EditClientForm({
  client,
  onSaved,
}: {
  client: Client;
  onSaved: (message: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(client.display_name);
  const [status, setStatus] = useState(client.status);
  const [currencyCode, setCurrencyCode] = useState(client.currency_code);
  const [timezone, setTimezone] = useState(client.timezone);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queda registrado como `protected_data.organization_export`: es el rastro
  // que se enseña cuando preguntan quien accedio a datos de cliente.
  async function exportData() {
    setExporting(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${client.id}/export`,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `ecomscaling-${client.slug}-export.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Datos del cliente descargados.");
    } catch {
      toast.danger("No se pudo exportar por un error de red.");
    } finally {
      setExporting(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${client.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            status,
            currency_code: currencyCode,
            timezone,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await onSaved("Cliente actualizado.");
    } catch {
      setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card kicker="Editar" title={client.display_name}>
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <Select
              aria-label="Estado"
              value={status}
              onChange={setStatus}
              options={CLIENT_STATUS_OPTIONS}
            />
          </Field>
          <Field label="Moneda">
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Zona horaria">
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button
            variant="secondary"
            disabled={exporting}
            onClick={() => void exportData()}
          >
            {exporting ? "Exportando..." : "Exportar datos"}
          </Button>
        </div>

        <PlanEditor
          subjectType="organization"
          subjectId={client.id}
          plan={client.plan}
          onSaved={onSaved}
        />
      </div>
    </Card>
  );
}
