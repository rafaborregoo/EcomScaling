"use client";

import { Fragment, type FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dropdown,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  Input,
  Label,
  Link,
  LoadingBlock,
  Select,
} from "@/components/ui";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";

const ORGANIZATION_STATUSES = ["onboarding", "active", "suspended", "cancelled"] as const;

type ConsultantOrganization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  consultant_count: number;
  store_count: number;
  subscription: {
    organization_id: string;
    plan_code: string;
    status: string;
  } | null;
  attention: {
    open_alerts: number;
    critical_alerts: number;
    high_alerts: number;
    oldest_alert_days: number;
    overdue_tasks: number;
    open_tasks: number;
    score: number;
  };
};

type OrganizationStore = {
  id: string;
  provider_account_name: string | null;
  provider_account_id: string | null;
  status: string;
  connected_at: string | null;
  last_sync_at: string | null;
};

type AccessProfile = {
  id: string;
  full_name: string | null;
  platform_role: string;
  is_active: boolean;
};

type OrganizationAccess = {
  members: Array<{
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    profile: AccessProfile | null;
  }>;
  assignments: Array<{
    id: string;
    consultant_user_id: string;
    is_primary: boolean;
    is_active: boolean;
    profile: AccessProfile | null;
  }>;
  available_profiles: AccessProfile[];
};

function attentionBadge(score: number) {
  if (score >= 15) {
    return { label: "Urgente", tone: "danger" as const };
  }
  if (score >= 5) {
    return { label: "Revisar", tone: "warn" as const };
  }
  if (score > 0) {
    return { label: "Vigilar", tone: "neutral" as const };
  }
  return { label: "Al día", tone: "success" as const };
}

function AccessPanel({ organizationId }: { organizationId: string }) {
  const [access, setAccess] = useState<OrganizationAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [consultantUserId, setConsultantUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function loadAccess() {
    const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/access`);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setAccess((await response.json()) as OrganizationAccess);
    setError(null);
  }

  useEffect(() => {
    void loadAccess();
  }, [organizationId]);

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberUserId) return;
    setIsSaving(true);
    const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: memberUserId, role: memberRole }),
    });
    if (!response.ok) setError(await readApiError(response));
    else await loadAccess();
    setIsSaving(false);
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consultantUserId) return;
    setIsSaving(true);
    const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultant_user_id: consultantUserId, is_primary: isPrimary }),
    });
    if (!response.ok) setError(await readApiError(response));
    else await loadAccess();
    setIsSaving(false);
  }

  if (error) {
    return (
      <div className="mt-4">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!access) {
    return <p className="mt-4 text-sm text-muted">Cargando acceso...</p>;
  }

  const consultantProfiles = access.available_profiles.filter(
    (profile) => profile.platform_role === "consultant" || profile.platform_role === "platform_admin",
  );

  return (
    <section className="mt-5 border-t border-line pt-4" aria-labelledby={`access-title-${organizationId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Heading level={3} size="md" id={`access-title-${organizationId}`}>Acceso al cliente</Heading>
          <p className="mt-1 text-xs text-muted">Solo perfiles existentes. Las invitaciones de autenticacion se gestionan fuera de este flujo.</p>
        </div>
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          {access.members.filter((member) => member.is_active).length} miembros · {access.assignments.filter((assignment) => assignment.is_active).length} consultores
        </span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h5 className="text-sm font-medium">Miembros</h5>
          {access.members.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin miembros asignados.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {access.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{member.profile?.full_name ?? member.user_id}</span>
                  <span className="font-mono text-xs uppercase text-muted">{member.role} · {member.is_active ? "activo" : "inactivo"}</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={saveMember} className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end">
            <Field label="Perfil existente">
              <Select
                aria-label="Perfil existente"
                value={memberUserId}
                onChange={setMemberUserId}
                required
                options={access.available_profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.full_name ?? profile.id,
                }))}
              />
            </Field>
            <Field label="Rol">
              <Select
                aria-label="Rol"
                value={memberRole}
                onChange={setMemberRole}
                options={["owner", "manager", "member", "readonly"].map((role) => ({ value: role, label: role }))}
              />
            </Field>
            <Button type="submit" disabled={isSaving || !memberUserId}>Guardar</Button>
          </form>
        </div>

        <div>
          <h5 className="text-sm font-medium">Consultores asignados</h5>
          {access.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin consultores asignados.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {access.assignments.map((assignment) => (
                <li key={assignment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{assignment.profile?.full_name ?? assignment.consultant_user_id}</span>
                  <span className="font-mono text-xs uppercase text-muted">{assignment.is_primary ? "principal · " : ""}{assignment.is_active ? "activo" : "inactivo"}</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={saveAssignment} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Consultor existente">
              <Select
                aria-label="Consultor existente"
                value={consultantUserId}
                onChange={setConsultantUserId}
                required
                options={consultantProfiles.map((profile) => ({
                  value: profile.id,
                  label: profile.full_name ?? profile.id,
                }))}
              />
            </Field>
            <div className="pb-2">
              <Checkbox checked={isPrimary} onChange={setIsPrimary}>
                Principal
              </Checkbox>
            </div>
            <Button type="submit" disabled={isSaving || !consultantUserId}>Guardar</Button>
          </form>
          {consultantProfiles.length === 0 ? <p className="mt-2 text-xs text-muted">No hay perfiles activos con rol de consultor.</p> : null}
        </div>
      </div>
    </section>
  );
}

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

function EditOrganizationForm({
  organization,
  onCancel,
  onSaved,
}: {
  organization: ConsultantOrganization;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(organization.display_name);
  const [status, setStatus] = useState(organization.status);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [currencyCode, setCurrencyCode] = useState(organization.currency_code);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const response = await apiFetch(`/v1/consultant/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        status,
        timezone,
        currency_code: currencyCode,
      }),
    });

    if (response.ok) {
      onSaved();
    } else {
      setError(await readApiError(response));
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 border-b border-line pb-4 md:grid-cols-4 md:items-end">
      <Field label="Nombre">
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
      </Field>
      <Field label="Estado">
        <Select
          aria-label="Estado"
          value={status}
          onChange={setStatus}
          options={ORGANIZATION_STATUSES.map((value) => ({ value, label: value }))}
        />
      </Field>
      <Field label="Zona horaria">
        <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
      </Field>
      <Field label="Moneda">
        <Input
          value={currencyCode}
          maxLength={3}
          onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
          required
        />
      </Field>
      {error ? (
        <div className="md:col-span-4">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}
      <div className="flex gap-4 md:col-span-4">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function StoresPanel({
  organization,
  isPlatformAdmin,
  onOrganizationDeleted,
  onOrganizationUpdated,
}: {
  organization: ConsultantOrganization;
  isPlatformAdmin: boolean;
  onOrganizationDeleted: () => void;
  onOrganizationUpdated: () => void;
}) {
  const [stores, setStores] = useState<OrganizationStore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [restoringStoreId, setRestoringStoreId] = useState<string | null>(null);
  const [confirmDeleteStore, setConfirmDeleteStore] = useState<OrganizationStore | null>(null);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [isRestoringOrg, setIsRestoringOrg] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await apiFetch(`/v1/consultant/organizations/${organization.id}/stores`);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { stores: OrganizationStore[] };
      setStores(payload.stores);
    }
    void load();
  }, [organization.id]);

  async function confirmStoreDeletion() {
    if (!confirmDeleteStore) {
      return;
    }
    setDeletingStoreId(confirmDeleteStore.id);
    const response = await apiFetch(
      `/v1/consultant/organizations/${organization.id}/stores/${confirmDeleteStore.id}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      setStores((current) => (current ?? []).filter((store) => store.id !== confirmDeleteStore.id));
      setConfirmDeleteStore(null);
    } else {
      setError(await readApiError(response));
    }
    setDeletingStoreId(null);
  }

  async function confirmOrgDeletion() {
    setIsDeletingOrg(true);
    const response = await apiFetch(`/v1/consultant/organizations/${organization.id}`, { method: "DELETE" });
    if (response.ok) {
      onOrganizationDeleted();
    } else {
      setError(await readApiError(response));
      setIsDeletingOrg(false);
      setConfirmDeleteOrg(false);
    }
  }

  async function restoreStore(storeId: string) {
    setRestoringStoreId(storeId);
    const response = await apiFetch(
      `/v1/consultant/organizations/${organization.id}/stores/${storeId}/restore`,
      { method: "POST" },
    );
    if (response.ok) {
      setStores((current) =>
        (current ?? []).map((store) => (store.id === storeId ? { ...store, status: "connected" } : store)),
      );
    } else {
      setError(await readApiError(response));
    }
    setRestoringStoreId(null);
  }

  async function restoreOrganization() {
    setIsRestoringOrg(true);
    const response = await apiFetch(`/v1/consultant/organizations/${organization.id}/restore`, {
      method: "POST",
    });
    if (response.ok) {
      onOrganizationUpdated();
    } else {
      setError(await readApiError(response));
    }
    setIsRestoringOrg(false);
  }

  return (
    <div className="border-t border-line bg-surface px-4 py-4">
      {error ? (
        <div className="mb-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      {isEditing ? (
        <EditOrganizationForm
          organization={organization}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onOrganizationUpdated();
          }}
        />
      ) : null}

      {stores === null ? (
        <p className="text-sm text-muted">Cargando tiendas...</p>
      ) : stores.length === 0 ? (
        <p className="text-sm text-muted">Sin tiendas conectadas.</p>
      ) : (
        <div className="divide-y divide-line">
          {stores.map((store) => (
            <div key={store.id} className="grid gap-2 py-2.5 text-sm md:grid-cols-[1fr_120px_140px_auto] md:items-center">
              <span className="font-medium">{store.provider_account_id ?? store.provider_account_name ?? store.id}</span>
              <span
                className={[
                  "font-mono text-xs uppercase",
                  store.status === "pending_deletion" ? "text-brand" : "text-muted",
                ].join(" ")}
              >
                {store.status === "pending_deletion" ? "borrado en 30 dias" : store.status}
              </span>
              <span className="text-xs text-muted">
                {store.last_sync_at ? new Date(store.last_sync_at).toLocaleDateString("es-ES") : "sin sync"}
              </span>
              {isPlatformAdmin ? (
                store.status === "pending_deletion" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={restoringStoreId === store.id}
                    onClick={() => void restoreStore(store.id)}
                  >
                    {restoringStoreId === store.id ? "Restaurando..." : "Restaurar tienda"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deletingStoreId === store.id}
                    onClick={() => setConfirmDeleteStore(store)}
                  >
                    Borrar tienda
                  </Button>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}

      {isPlatformAdmin ? <AccessPanel organizationId={organization.id} /> : null}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3">
        <Link href={`/integraciones?organizationId=${organization.id}`}>Añadir tienda</Link>
        {isPlatformAdmin ? (
          organization.status === "pending_deletion" ? (
            <Button size="sm" variant="ghost" disabled={isRestoringOrg} onClick={() => void restoreOrganization()}>
              {isRestoringOrg ? "Restaurando..." : "Restaurar cliente"}
            </Button>
          ) : (
            <Dropdown>
              <Button variant="secondary" size="sm">
                Acciones rápidas
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === "edit") {
                      setIsEditing((current) => !current);
                    } else if (key === "delete") {
                      setConfirmDeleteOrg(true);
                    }
                  }}
                >
                  <Dropdown.Item id="edit" textValue={isEditing ? "Cerrar edición" : "Editar cliente"}>
                    <Label>{isEditing ? "Cerrar edición" : "Editar cliente"}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="delete" textValue="Borrar cliente entero" variant="danger">
                    <Label>Borrar cliente entero</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )
        ) : null}
      </div>

      {confirmDeleteStore ? (
        <ConfirmDangerDialog
          title={`Borrar tienda "${confirmDeleteStore.provider_account_id ?? confirmDeleteStore.provider_account_name}"`}
          note="30 dias para restaurarla antes del borrado definitivo"
          confirmPhrase={confirmDeleteStore.provider_account_id ?? confirmDeleteStore.provider_account_name ?? confirmDeleteStore.id}
          actionLabel="Borrar tienda"
          isBusy={deletingStoreId === confirmDeleteStore.id}
          onConfirm={confirmStoreDeletion}
          onCancel={() => setConfirmDeleteStore(null)}
        />
      ) : null}

      {confirmDeleteOrg ? (
        <ConfirmDangerDialog
          title={`Borrar cliente "${organization.display_name}"`}
          note="30 dias para restaurarlo antes del borrado definitivo"
          confirmPhrase={organization.display_name}
          actionLabel="Borrar cliente"
          isBusy={isDeletingOrg}
          onConfirm={confirmOrgDeletion}
          onCancel={() => setConfirmDeleteOrg(false)}
        />
      ) : null}
    </div>
  );
}

function ConsultantPanel({ token, isPlatformAdmin }: { token: string; isPlatformAdmin: boolean }) {
  const { setOrganizationId } = useActiveOrganization();
  const [organizations, setOrganizations] = useState<ConsultantOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const response = await apiFetch("/v1/consultant/organizations");

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { organizations: ConsultantOrganization[] };
    setOrganizations(payload.organizations);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (isLoading) {
    return <LoadingBlock label="Cargando clientes..." />;
  }

  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (organizations.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes clientes asignados"
        hint="Cuando se te asigne una organización como consultor, aparecerán aquí ordenadas por la que más atención necesita."
      />
    );
  }

  const needsAttention = organizations.filter((organization) => organization.attention.score > 0);

  return (
    <div className="space-y-4">
      <section className="border-t border-ink/20 pt-5">
        <Heading size="lg">Qué cliente necesita atención hoy</Heading>
        {needsAttention.length === 0 ? (
          <p className="mt-1 font-mono text-xs uppercase tracking-wide text-success">Todos al día</p>
        ) : null}
      </section>

      <section className="border-t border-ink/20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium uppercase text-muted">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Tiendas</th>
                <th className="px-4 py-3 font-medium">Atención</th>
                <th className="px-4 py-3 font-medium">Alertas vivas</th>
                <th className="px-4 py-3 font-medium">Tareas</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Ir a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {organizations.map((organization) => {
                const badge = attentionBadge(organization.attention.score);
                const isExpanded = expandedId === organization.id;

                return (
                  <Fragment key={organization.id}>
                    <tr className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={organization.display_name} size="sm" />
                          <div>
                            <Link href="/dashboard" onClick={() => setOrganizationId(organization.id)}>
                              {organization.display_name}
                            </Link>
                            <p className={organization.status === "pending_deletion" ? "text-sm text-brand" : "text-sm text-muted"}>
                              {organization.slug} -{" "}
                              {organization.status === "pending_deletion" ? "borrado en 30 dias" : organization.status}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : organization.id)}
                        >
                          {organization.store_count} {isExpanded ? "▲" : "▼"}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={badge.tone} title={`Puntuacion: ${organization.attention.score}`}>
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {organization.attention.open_alerts === 0 ? (
                          <span className="text-muted">Sin alertas</span>
                        ) : (
                          <>
                            <span className="font-mono">{organization.attention.open_alerts}</span>
                            {organization.attention.critical_alerts > 0 ? (
                              <span className="ml-2 font-mono text-xs text-brand">
                                {organization.attention.critical_alerts} criticas
                              </span>
                            ) : null}
                            {organization.attention.oldest_alert_days > 0 ? (
                              <p className="mt-1 text-xs text-muted">
                                la más antigua lleva {organization.attention.oldest_alert_days} días
                              </p>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono">{organization.attention.open_tasks}</span> abiertas
                        {organization.attention.overdue_tasks > 0 ? (
                          <p className="mt-1 text-xs text-brand">{organization.attention.overdue_tasks} vencidas</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {organization.subscription
                          ? `${organization.subscription.plan_code}/${organization.subscription.status}`
                          : "sin_plan"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href="/dashboard" onClick={() => setOrganizationId(organization.id)}>
                            Dashboard
                          </Link>
                          <Link href="/tareas" onClick={() => setOrganizationId(organization.id)}>
                            Tareas
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <StoresPanel
                            organization={organization}
                            isPlatformAdmin={isPlatformAdmin}
                            onOrganizationDeleted={() => {
                              setExpandedId(null);
                              void load();
                            }}
                            onOrganizationUpdated={() => void load()}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function ConsultantPage() {
  return (
    <PortalShell title="Clientes">
      {(bootstrap, token) => (
        <ConsultantPanel token={token} isPlatformAdmin={bootstrap.profile.platform_role === "platform_admin"} />
      )}
    </PortalShell>
  );
}
