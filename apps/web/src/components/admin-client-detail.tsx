"use client";

import { UserMinusIcon } from "lucide-react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  Select,
  DataTable,
  type DataTableColumn,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  avatarInitials,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
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
  consultants: Array<{ user_id: string; full_name: string | null; avatar_url?: string | null; is_primary: boolean }>;
  plan: { plan_code: string; store_limit: number | null; member_limit: number | null; status: string; ends_at: string | null } | null;
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
    avatar_url?: string | null;
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
    <Card>
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <CardDescription>Lo que se ha hecho sobre este cliente.</CardDescription>
        <CardAction><Link href={`/admin/logs/auditoria?organizationId=${organizationId}`}>
          Ver todo
        </Link></CardAction>
      </CardHeader>
      <CardContent>
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
                <Item key={entry.id} size="sm" render={<li />}>
                  <ItemMedia>
                    <Badge>{summary.area}</Badge>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="font-normal">
                      <span><strong>{entry.actor_name ?? "Alguien"}</strong> {summary.verb}</span>
                    </ItemTitle>
                  </ItemContent>
                  <ItemDescription>{when(entry.created_at)}</ItemDescription>
                </Item>
              );
            })}
          </List>
        )}
      </CardContent>
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

  const integrationColumns: DataTableColumn<Overview["integrations"][number]>[] = [
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

  const memberColumns: DataTableColumn<Overview["members"][number]>[] = [
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
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button size="sm" variant="ghost" disabled={busyUserId === row.user_id}>
                    Quitar acceso
                  </Button>
                }
              />
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-danger/10 text-danger">
                    <UserMinusIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>¿Quitar el acceso a {row.full_name ?? row.user_id}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deja de poder entrar en la organización. Se le puede devolver el acceso desde aquí mismo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => saveMember(row.user_id, { is_active: false })}
                  >
                    Quitar acceso
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
      <Card>
        <CardHeader>
          <CardKicker>Ficha 360</CardKicker>
          <CardTitle>Integraciones</CardTitle>
          <CardDescription>Shopify, Meta Ads y Klaviyo conectados por este cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Integraciones del cliente"
            columns={integrationColumns}
            rows={data.integrations}
            emptyLabel="Sin integraciones conectadas."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos syncs</CardTitle>
          <CardDescription>Las 15 sincronizaciones más recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent_syncs.length === 0 ? (
            <EmptyState title="Sin syncs todavía" hint="Este cliente no tiene sincronizaciones registradas." />
          ) : (
            <List as="ul">
              {data.recent_syncs.map((run) => (
                <Item key={run.id} size="sm" render={<li />}>
                  <ItemMedia>
                    <Badge tone={syncStatusTone(run.status)}>
                      {displayValue(run.status)}
                    </Badge>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {displayValue(run.provider)} · {run.sync_type}
                    </ItemTitle>
                    {run.error_message ? (
                      <ItemDescription className="break-words">
                        {run.error_message.slice(0, 300)}
                      </ItemDescription>
                    ) : null}
                  </ItemContent>
                  <ItemActions>
                  <span className="text-sm text-muted">
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
                  </ItemActions>
                </Item>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <ClientAuditCard organizationId={organizationId} />

      <Card>
        <CardHeader>
          <CardTitle>Acceso</CardTitle>
          <CardDescription>Miembros del cliente y consultores asignados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {pendingInvite ? (
              <Card><CardContent className="grid gap-2">
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
              </CardContent></Card>
            ) : null}
            {data.consultants.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {data.consultants.map((c) => (
                  <li key={c.user_id} className="flex items-center gap-2 text-sm">
                    <Avatar>
                      <AvatarImage src={c.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>{avatarInitials(c.full_name)}</AvatarFallback>
                      {c.is_primary ? <AvatarBadge aria-hidden /> : null}
                    </Avatar>
                    {c.full_name ?? c.user_id}
                    {c.is_primary ? <span className="text-xs text-muted">principal</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Badge tone="warn">sin consultor</Badge>
            )}
            <DataTable
              ariaLabel="Miembros del cliente"
              columns={memberColumns}
              rows={data.members}
              emptyLabel="Sin miembros."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Alta de cliente en una hoja lateral: formulario a la izquierda del pie fijo. */
export function CreateClientSheet({
  isOpen,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [wasOpen, setWasOpen] = useState(isOpen);
  // Cada apertura arranca limpia.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDisplayName("");
      setOwnerEmail("");
      setOwnerFullName("");
      setCurrencyCode("EUR");
      setTimezone("Europe/Madrid");
      setPlan(concesionInicial("starter", false));
      setError(null);
    }
  }

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
    <Dialog open={isOpen} onOpenChange={onOpenChange} busy={busy} dirty={Boolean(displayName.trim() || ownerEmail.trim())}>
      <DialogContent className="sm:max-w-[44rem]">
      <DialogHeader>
        <DialogTitle>Nuevo cliente</DialogTitle>
        <DialogDescription>
          Crea la organización e invita a su owner por email, y decide si le concedes el plan o lo paga él.
        </DialogDescription>
      </DialogHeader>
      <form
        id="create-client-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Acme Store" />
          </Field>
          <Field label="Email del owner">
            <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@acme.com" />
          </Field>
          <Field label="Nombre del owner (opcional)">
            <Input value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} placeholder="Nombre Apellido" />
          </Field>
          <Field label="Moneda">
            <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} placeholder="EUR" />
          </Field>
          <Field label="Zona horaria">
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Madrid" />
          </Field>
        </div>
        <ConcesionDePlan
          value={plan}
          onChange={setPlan}
          etiquetaSinPlan="Empieza en trial y lo paga él"
          avisoSinPlan="Entra en trial abierto y elige plan en /planes. Un cliente sin ninguna suscripción no podría ni acceder a su organización."
        />
      </form>
      <DialogFooter>
        <DialogClose>Cancelar</DialogClose>
        <Button type="submit" form="create-client-form" disabled={!canSubmit || busy}>
          {busy ? "Creando…" : "Crear cliente"}
        </Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Card>
      <CardHeader>
        <CardKicker>Editar</CardKicker>
        <CardTitle>{client.display_name}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
