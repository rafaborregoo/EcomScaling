"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  IconChevronDown,
  IconChevronUp,
  Input,
  Label,
  Link,
  LoadingBlock,
  Select,
  Table,
  toast,
  type TableColumnDef,
} from "@/components/ui";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";

const ORGANIZATION_STATUSES = [
  "onboarding",
  "active",
  "suspended",
  "cancelled",
] as const;

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

  const loadAccess = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/access`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setAccess((await response.json()) as OrganizationAccess);
      setError(null);
    } catch {
      setError("No se pudo cargar el acceso del cliente. Revisa la conexión e inténtalo de nuevo.");
    }
  }, [organizationId]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberUserId) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/members`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: memberUserId, role: memberRole }),
        },
      );
      if (!response.ok) setError(await readApiError(response));
      else await loadAccess();
    } catch {
      setError("No se pudo guardar el miembro. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consultantUserId) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/assignments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultant_user_id: consultantUserId,
            is_primary: isPrimary,
          }),
        },
      );
      if (!response.ok) setError(await readApiError(response));
      else await loadAccess();
    } catch {
      setError("No se pudo guardar la asignación. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  if (error) {
    return (
      <div className="mt-4">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!access) {
    return (
      <div className="mt-4">
        <LoadingBlock label="Cargando acceso..." />
      </div>
    );
  }

  const consultantProfiles = access.available_profiles.filter(
    (profile) =>
      profile.platform_role === "consultant" ||
      profile.platform_role === "platform_admin",
  );

  return (
    <section
      className="mt-5 border-t border-line pt-4"
      aria-labelledby={`access-title-${organizationId}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Heading level={3} size="md" id={`access-title-${organizationId}`}>
            Acceso al cliente
          </Heading>
          <p className="mt-1 text-xs text-muted">
            Solo perfiles existentes. Las invitaciones de autenticacion se
            gestionan fuera de este flujo.
          </p>
        </div>
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          {access.members.filter((member) => member.is_active).length} miembros
          ·{" "}
          {
            access.assignments.filter((assignment) => assignment.is_active)
              .length
          }{" "}
          consultores
        </span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium">Miembros</h4>
          {access.members.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin miembros asignados.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {access.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>{member.profile?.full_name ?? member.user_id}</span>
                  <span className="font-mono text-xs uppercase text-muted">
                    {member.role} · {member.is_active ? "activo" : "inactivo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={saveMember}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end"
          >
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
                options={["owner", "manager", "member", "readonly"].map(
                  (role) => ({ value: role, label: role }),
                )}
              />
            </Field>
            <Button type="submit" disabled={isSaving || !memberUserId}>
              Guardar
            </Button>
          </form>
        </div>

        <div>
          <h4 className="text-sm font-medium">Consultores asignados</h4>
          {access.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Sin consultores asignados.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {access.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {assignment.profile?.full_name ??
                      assignment.consultant_user_id}
                  </span>
                  <span className="font-mono text-xs uppercase text-muted">
                    {assignment.is_primary ? "principal · " : ""}
                    {assignment.is_active ? "activo" : "inactivo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={saveAssignment}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
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
            <Button type="submit" disabled={isSaving || !consultantUserId}>
              Guardar
            </Button>
          </form>
          {consultantProfiles.length === 0 ? (
            <EmptyState
              title="No hay consultores disponibles"
              hint="Crea o activa un perfil con rol de consultor para poder asignarlo a esta organización."
            />
          ) : null}
        </div>
      </div>
    </section>
  );
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

    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            status,
            timezone,
            currency_code: currencyCode,
          }),
        },
      );

      if (response.ok) {
        toast.success("Cliente actualizado.");
        onSaved();
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo actualizar el cliente. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="grid gap-3 border-b border-line pb-4 md:grid-cols-4 md:items-end"
    >
      <Field label="Nombre">
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </Field>
      <Field label="Estado">
        <Select
          aria-label="Estado"
          value={status}
          onChange={setStatus}
          options={ORGANIZATION_STATUSES.map((value) => ({
            value,
            label: value,
          }))}
        />
      </Field>
      <Field label="Zona horaria">
        <Input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
      </Field>
      <Field label="Moneda">
        <Input
          value={currencyCode}
          maxLength={3}
          onChange={(event) =>
            setCurrencyCode(event.target.value.toUpperCase())
          }
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
  const [confirmDeleteStore, setConfirmDeleteStore] =
    useState<OrganizationStore | null>(null);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [isRestoringOrg, setIsRestoringOrg] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch(
          `/v1/consultant/organizations/${organization.id}/stores`,
        );
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          stores: OrganizationStore[];
        };
        setStores(payload.stores);
        setError(null);
      } catch {
        setError("No se pudieron cargar las tiendas. Revisa la conexión e inténtalo de nuevo.");
      }
    }
    void load();
  }, [organization.id]);

  async function confirmStoreDeletion() {
    if (!confirmDeleteStore) {
      return;
    }
    setDeletingStoreId(confirmDeleteStore.id);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/stores/${confirmDeleteStore.id}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        setStores((current) =>
          (current ?? []).filter((store) => store.id !== confirmDeleteStore.id),
        );
        setConfirmDeleteStore(null);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo eliminar la tienda. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setDeletingStoreId(null);
    }
  }

  async function confirmOrgDeletion() {
    setIsDeletingOrg(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        onOrganizationDeleted();
      } else {
        setError(await readApiError(response));
        setConfirmDeleteOrg(false);
      }
    } catch {
      setError("No se pudo eliminar el cliente. Revisa la conexión e inténtalo de nuevo.");
      setConfirmDeleteOrg(false);
    } finally {
      setIsDeletingOrg(false);
    }
  }

  async function restoreStore(storeId: string) {
    setRestoringStoreId(storeId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/stores/${storeId}/restore`,
        { method: "POST" },
      );
      if (response.ok) {
        setStores((current) =>
          (current ?? []).map((store) =>
            store.id === storeId ? { ...store, status: "connected" } : store,
          ),
        );
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo restaurar la tienda. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setRestoringStoreId(null);
    }
  }

  async function restoreOrganization() {
    setIsRestoringOrg(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/restore`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        onOrganizationUpdated();
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo restaurar el cliente. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsRestoringOrg(false);
    }
  }

  return (
    <div>
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
        <LoadingBlock label="Cargando tiendas..." />
      ) : stores.length === 0 ? (
        <p className="text-sm text-muted">Sin tiendas conectadas.</p>
      ) : (
        <div className="divide-y divide-line">
          {stores.map((store) => (
            <div
              key={store.id}
              className="grid gap-2 py-2.5 text-sm md:grid-cols-[1fr_120px_140px_auto] md:items-center"
            >
              <span className="font-medium">
                {store.provider_account_id ??
                  store.provider_account_name ??
                  store.id}
              </span>
              <span
                className={[
                  "font-mono text-xs uppercase",
                  store.status === "pending_deletion"
                    ? "text-brand"
                    : "text-muted",
                ].join(" ")}
              >
                {store.status === "pending_deletion"
                  ? "borrado en 30 dias"
                  : store.status}
              </span>
              <span className="text-xs text-muted">
                {store.last_sync_at
                  ? new Date(store.last_sync_at).toLocaleDateString("es-ES")
                  : "sin sync"}
              </span>
              {isPlatformAdmin ? (
                store.status === "pending_deletion" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={restoringStoreId === store.id}
                    onClick={() => void restoreStore(store.id)}
                  >
                    {restoringStoreId === store.id
                      ? "Restaurando..."
                      : "Restaurar tienda"}
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

      {isPlatformAdmin ? (
        <AccessPanel organizationId={organization.id} />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3">
        <Link href={`/integraciones?organizationId=${organization.id}`}>
          Añadir tienda
        </Link>
        {isPlatformAdmin ? (
          organization.status === "pending_deletion" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={isRestoringOrg}
              onClick={() => void restoreOrganization()}
            >
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
                  <Dropdown.Item
                    id="edit"
                    textValue={isEditing ? "Cerrar edición" : "Editar cliente"}
                  >
                    <Label>
                      {isEditing ? "Cerrar edición" : "Editar cliente"}
                    </Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="delete"
                    textValue="Borrar cliente entero"
                    variant="danger"
                  >
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
          confirmPhrase={
            confirmDeleteStore.provider_account_id ??
            confirmDeleteStore.provider_account_name ??
            confirmDeleteStore.id
          }
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

function ConsultantPanel({
  token,
  isPlatformAdmin,
}: {
  token: string;
  isPlatformAdmin: boolean;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const [organizations, setOrganizations] = useState<ConsultantOrganization[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // FE-07: sin buscador, encontrar un cliente concreto entre muchos exigia
  // escanear la tabla entera a ojo -- filtro por nombre o slug, en el propio
  // navegador sobre la lista ya cargada (no una request nueva).
  const [searchQuery, setSearchQuery] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const response = await apiFetch("/v1/consultant/organizations");

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as {
        organizations: ConsultantOrganization[];
      };
      setOrganizations(payload.organizations);
      setError(null);
    } catch {
      setError("No se pudieron cargar los clientes. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando clientes..." />;
  }

  if (error) {
    return <AsyncState status="error" error={error} />;
  }

  if (organizations.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes clientes asignados"
        hint="Cuando se te asigne una organización como consultor, aparecerán aquí ordenadas por la que más atención necesita."
      />
    );
  }

  const needsAttention = organizations.filter(
    (organization) => organization.attention.score > 0,
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOrganizations = normalizedQuery
    ? organizations.filter(
        (organization) =>
          organization.display_name.toLowerCase().includes(normalizedQuery) ||
          organization.slug.toLowerCase().includes(normalizedQuery),
      )
    : organizations;

  const expandedOrganization = expandedId
    ? filteredOrganizations.find(
        (organization) => organization.id === expandedId,
      )
    : null;

  // FE-07 (auditoria estructural 2026-07-29): antes esta lista era una tabla
  // HTML a mano con una fila "detalle" anidada via colSpan -- el componente
  // `Table` compartido (columnas estaticas, sin fila expandible) no admite
  // ese patron. En vez de forzarlo dentro de la tabla, el detalle se muestra
  // como una `Card` debajo, igual que el panel de detalle de Mi Camino
  // (seleccionar un nodo del arbol -> panel debajo), mismo patron en toda la
  // app en vez de dos formas distintas de "expandir" una fila.
  const columns: TableColumnDef<ConsultantOrganization>[] = [
    {
      key: "name",
      label: "Cliente",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.display_name} size="sm" />
          <div>
            <Link href="/dashboard" onClick={() => setOrganizationId(row.id)}>
              {row.display_name}
            </Link>
            <p
              className={
                row.status === "pending_deletion"
                  ? "text-sm text-brand"
                  : "text-sm text-muted"
              }
            >
              {row.slug} -{" "}
              {row.status === "pending_deletion"
                ? "borrado en 30 dias"
                : row.status}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "stores",
      label: "Tiendas",
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
        >
          {row.store_count}{" "}
          {expandedId === row.id ? (
            <IconChevronUp aria-hidden />
          ) : (
            <IconChevronDown aria-hidden />
          )}
        </Button>
      ),
    },
    {
      key: "attention",
      label: "Atención",
      render: (row) => {
        const badge = attentionBadge(row.attention.score);
        return (
          <Badge tone={badge.tone} title={`Puntuacion: ${row.attention.score}`}>
            {badge.label}
          </Badge>
        );
      },
    },
    {
      key: "alerts",
      label: "Alertas vivas",
      render: (row) =>
        row.attention.open_alerts === 0 ? (
          <span className="text-muted">Sin alertas</span>
        ) : (
          <>
            <span className="font-mono">{row.attention.open_alerts}</span>
            {row.attention.critical_alerts > 0 ? (
              <span className="ml-2 font-mono text-xs text-brand">
                {row.attention.critical_alerts} criticas
              </span>
            ) : null}
            {row.attention.oldest_alert_days > 0 ? (
              <p className="mt-1 text-xs text-muted">
                la más antigua lleva {row.attention.oldest_alert_days} días
              </p>
            ) : null}
          </>
        ),
    },
    {
      key: "tasks",
      label: "Tareas",
      render: (row) => (
        <>
          <span className="font-mono">{row.attention.open_tasks}</span> abiertas
          {row.attention.overdue_tasks > 0 ? (
            <p className="mt-1 text-xs text-brand">
              {row.attention.overdue_tasks} vencidas
            </p>
          ) : null}
        </>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      render: (row) => (
        <span className="font-mono">
          {row.subscription
            ? `${row.subscription.plan_code}/${row.subscription.status}`
            : "sin_plan"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Ir a",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" onClick={() => setOrganizationId(row.id)}>
            Dashboard
          </Link>
          <Link href="/tareas" onClick={() => setOrganizationId(row.id)}>
            Tareas
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="border-t border-ink/20 pt-5">
        <Heading size="lg">Qué cliente necesita atención hoy</Heading>
        {needsAttention.length === 0 ? (
          <p className="mt-1 font-mono text-xs uppercase tracking-wide text-success">
            Todos al día
          </p>
        ) : null}
      </section>

      <section className="border-t border-ink/20 pt-4">
        <Field label="Buscar cliente">
          <Input
            type="search"
            placeholder="Nombre o slug..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="max-w-sm"
          />
        </Field>
      </section>

      <section className="border-t border-ink/20 pt-4">
        <Table
          ariaLabel="Clientes asignados"
          columns={columns}
          rows={filteredOrganizations}
          emptyLabel={`Sin resultados para "${searchQuery}".`}
        />
      </section>

      {expandedOrganization ? (
        <Card
          kicker="Detalle del cliente"
          title={expandedOrganization.display_name}
        >
          <StoresPanel
            organization={expandedOrganization}
            isPlatformAdmin={isPlatformAdmin}
            onOrganizationDeleted={() => {
              setExpandedId(null);
              void load();
            }}
            onOrganizationUpdated={() => void load()}
          />
        </Card>
      ) : null}
    </div>
  );
}

export default function ConsultantPage() {
  return (
    <PortalShell title="Clientes">
      {(bootstrap, token) => (
        <ConsultantPanel
          token={token}
          isPlatformAdmin={bootstrap.profile.platform_role === "platform_admin"}
        />
      )}
    </PortalShell>
  );
}
