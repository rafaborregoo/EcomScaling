"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  cn,
  CollapsibleSection,
  Dropdown,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  ArchiveIcon,
  IconChevronDown,
  IconChevronUp,
  Input,
  Label,
  Link,
  List,
  LoadingBlock,
  Modal,
  MoreIcon,
  PencilIcon,
  RetryIcon,
  Select,
  SettingsIcon,
  toast,
} from "@/components/ui";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";
import {
  ClientDesk,
  DailyActionInbox,
  DegradedSources,
  NextCallWidget,
  PortfolioHealthBoard,
  PortfolioPulse,
  UpcomingWork,
  WINDOW_OPTIONS,
  type DailyWorkbench,
  type InboxFilter,
} from "./workbench";

// Toda la fila del cliente es un objetivo de clic para plegar/desplegar sus
// tiendas; los controles de dentro (links, menu) paran la propagacion para no
// disparar tambien el toggle. Mismo patron que camino/page.tsx.
function cardToggle(handler: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler();
      }
    },
  };
}

const stopToggle = {
  onClick: (event: ReactMouseEvent) => event.stopPropagation(),
  onKeyDown: (event: ReactKeyboardEvent) => event.stopPropagation(),
};

const ORGANIZATION_STATUSES = [
  "onboarding",
  "active",
  "suspended",
  "cancelled",
] as const;

const ORGANIZATION_STATUS_LABELS: Record<string, string> = {
  onboarding: "Incorporación",
  active: "Activa",
  suspended: "Suspendida",
  cancelled: "Cancelada",
  pending_deletion: "Borrado pendiente",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trialing: "Prueba",
  paused: "Pausada",
  cancelled: "Cancelada",
  expired: "Expirada",
  pending: "Pendiente",
};

type ConsultantOrganization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  consultant_count: number;
  is_own_store: boolean;
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
  const accessQuery = useCachedQuery<OrganizationAccess>(
    `/v1/consultant/organizations/${organizationId}/access`,
  );
  const access = accessQuery.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (accessQuery.error
    ? "No se pudo cargar el acceso del cliente. Revisa la conexión e inténtalo de nuevo."
    : null);
  const setError = setActionError;
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [consultantUserId, setConsultantUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadAccess = useCallback(() => {
    setActionError(null);
    accessQuery.reload();
  }, [accessQuery.reload]);

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
      setError(
        "No se pudo guardar el miembro. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeMember(memberUserId: string) {
    setRemovingId(memberUserId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/members`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: memberUserId, is_active: false }),
        },
      );
      if (!response.ok) setError(await readApiError(response));
      else await loadAccess();
    } catch {
      setError(
        "No se pudo quitar el miembro. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  async function removeAssignment(assignmentConsultantUserId: string) {
    setRemovingId(assignmentConsultantUserId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/assignments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultant_user_id: assignmentConsultantUserId,
            is_active: false,
          }),
        },
      );
      if (!response.ok) setError(await readApiError(response));
      else await loadAccess();
    } catch {
      setError(
        "No se pudo quitar el consultor. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setRemovingId(null);
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
      setError(
        "No se pudo guardar la asignación. Revisa la conexión e inténtalo de nuevo.",
      );
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
      className="mt-6 border-t border-separator pt-4"
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
        <span className="text-xs font-medium text-muted">
          {access.members.filter((member) => member.is_active).length} miembros
          ·{" "}
          {
            access.assignments.filter((assignment) => assignment.is_active)
              .length
          }{" "}
          consultores
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Miembros</h4>
          {access.members.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin miembros asignados.</p>
          ) : (
            <List as="ul" bordered className="mt-2">
              {access.members.map((member) => (
                <List.Item
                  as="li"
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>{member.profile?.full_name ?? member.user_id}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {displayValue(member.role)} ·{" "}
                      {member.is_active ? "activo" : "inactivo"}
                    </span>
                    {member.is_active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removingId === member.user_id}
                        onClick={() => void removeMember(member.user_id)}
                      >
                        {removingId === member.user_id
                          ? "Quitando..."
                          : "Quitar"}
                      </Button>
                    ) : null}
                  </span>
                </List.Item>
              ))}
            </List>
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
          <h4 className="text-sm font-semibold text-foreground">
            Consultores asignados
          </h4>
          {access.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Sin consultores asignados.
            </p>
          ) : (
            <List as="ul" bordered className="mt-2">
              {access.assignments.map((assignment) => (
                <List.Item
                  as="li"
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {assignment.profile?.full_name ??
                      assignment.consultant_user_id}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {assignment.is_primary ? "principal · " : ""}
                      {assignment.is_active ? "activo" : "inactivo"}
                    </span>
                    {assignment.is_active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removingId === assignment.consultant_user_id}
                        onClick={() =>
                          void removeAssignment(assignment.consultant_user_id)
                        }
                      >
                        {removingId === assignment.consultant_user_id
                          ? "Quitando..."
                          : "Quitar"}
                      </Button>
                    ) : null}
                  </span>
                </List.Item>
              ))}
            </List>
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
      setError(
        "No se pudo actualizar el cliente. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="grid gap-3 border-b border-separator pb-4 md:grid-cols-4 md:items-end"
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
            label: ORGANIZATION_STATUS_LABELS[value] ?? value,
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
  canManageStores,
  isEditing,
  onEditingChange,
  onOrganizationUpdated,
}: {
  organization: ConsultantOrganization;
  isPlatformAdmin: boolean;
  canManageStores: boolean;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onOrganizationUpdated: () => void;
}) {
  const storesQuery = useCachedQuery<{
    stores?: OrganizationStore[];
  }>(`/v1/consultant/organizations/${organization.id}/stores`);
  const stores = storesQuery.data?.stores ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (storesQuery.error
    ? "No se pudieron cargar las tiendas. Revisa la conexión e inténtalo de nuevo."
    : null);
  const setError = setActionError;
  const reloadStores = useCallback(() => {
    setActionError(null);
    storesQuery.reload();
  }, [storesQuery.reload]);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [restoringStoreId, setRestoringStoreId] = useState<string | null>(null);
  const [confirmDeleteStore, setConfirmDeleteStore] =
    useState<OrganizationStore | null>(null);

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
        reloadStores();
        setConfirmDeleteStore(null);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        "No se pudo eliminar la tienda. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setDeletingStoreId(null);
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
        reloadStores();
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        "No se pudo restaurar la tienda. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setRestoringStoreId(null);
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
          onCancel={() => onEditingChange(false)}
          onSaved={() => {
            onEditingChange(false);
            onOrganizationUpdated();
          }}
        />
      ) : null}

      {stores === null ? (
        <LoadingBlock label="Cargando tiendas..." />
      ) : stores.length === 0 ? (
        <p className="text-sm text-muted">Sin tiendas conectadas.</p>
      ) : (
        <List>
          {stores.map((store) => (
            <List.Item
              key={store.id}
              className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_120px_140px_auto] md:items-center"
            >
              <span className="font-medium">
                {store.provider_account_id ??
                  store.provider_account_name ??
                  store.id}
              </span>
              <span>
                <Badge
                  tone={
                    store.status === "pending_deletion" ? "warn" : "neutral"
                  }
                >
                  {store.status === "pending_deletion"
                    ? "Borrado en 30 días"
                    : displayValue(store.status)}
                </Badge>
              </span>
              <span className="text-xs text-muted">
                {store.last_sync_at
                  ? new Date(store.last_sync_at).toLocaleDateString("es-ES")
                  : "sin sync"}
              </span>
              {canManageStores ? (
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
            </List.Item>
          ))}
        </List>
      )}

      {isPlatformAdmin ? (
        <AccessPanel organizationId={organization.id} />
      ) : null}

      <div className="mt-4 border-t border-separator pt-3">
        <Link href={`/integraciones?organizationId=${organization.id}`}>
          Añadir tienda
        </Link>
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
    </div>
  );
}

// Menu de acciones del cliente (kebab de la fila). Autonomo: hace sus propias
// llamadas y avisa al padre para recargar (`onChanged`) o quitar la fila
// (`onRemoved`). "Editar" delega en el padre, que muestra el form dentro del
// panel desplegado. "Borrar" = desvincular: sale de la cartera pero el cliente
// conserva su servicio; nunca purga la organizacion.
function ClientActionsMenu({
  organization,
  isPlatformAdmin,
  onEdit,
  onChanged,
  onRemoved,
}: {
  organization: ConsultantOrganization;
  isPlatformAdmin: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"unlink" | "delete" | null>(null);

  const pendingDeletion = organization.status === "pending_deletion";
  const suspended = organization.status === "suspended";

  async function post(suffix: string, onOk: () => void, failMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/${suffix}`,
        { method: "POST" },
      );
      if (response.ok) {
        onOk();
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(failMsg);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  function onAction(key: string) {
    if (key === "edit") onEdit();
    else if (key === "pause")
      void post("pause", onChanged, "No se pudo pausar el cliente.");
    else if (key === "resume")
      void post("resume", onChanged, "No se pudo reanudar el cliente.");
    else if (key === "unlink") setConfirm("unlink");
    else if (key === "delete") setConfirm("delete");
  }

  return (
    <>
      <Dropdown>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Acciones de ${organization.display_name}`}
          disabled={busy}
          className="min-h-8 min-w-8 shrink-0 px-2"
        >
          <MoreIcon aria-hidden />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu onAction={(key) => onAction(String(key))}>
            <Dropdown.Item id="edit" textValue="Editar">
              <PencilIcon aria-hidden />
              <Label>Editar</Label>
            </Dropdown.Item>
            {!pendingDeletion ? (
              suspended ? (
                <Dropdown.Item id="resume" textValue="Reanudar">
                  <RetryIcon aria-hidden />
                  <Label>Reanudar</Label>
                </Dropdown.Item>
              ) : (
                <Dropdown.Item id="pause" textValue="Pausar">
                  <RetryIcon aria-hidden />
                  <Label>Pausar</Label>
                </Dropdown.Item>
              )
            ) : null}
            <Dropdown.Item
              id="unlink"
              textValue="Quitar de mi cartera"
              variant="danger"
            >
              <ArchiveIcon aria-hidden />
              <Label>Quitar de mi cartera</Label>
            </Dropdown.Item>
            {isPlatformAdmin ? (
              <Dropdown.Item
                id="delete"
                textValue="Eliminar definitivamente"
                variant="danger"
              >
                <ArchiveIcon aria-hidden />
                <Label>Eliminar definitivamente</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {confirm === "unlink" ? (
        <ConfirmDangerDialog
          title={`Quitar a "${organization.display_name}" de tu cartera`}
          note="Sale de tu cartera y dejamos de traer sus datos. Conserva su acceso, integraciones y suscripción. Para recuperarlo hay que reasignarlo desde el panel admin."
          confirmPhrase={organization.display_name}
          actionLabel="Quitar de mi cartera"
          isBusy={busy}
          onConfirm={() =>
            void post("unlink", onRemoved, "No se pudo quitar el cliente.")
          }
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {confirm === "delete" ? (
        <ConfirmDangerDialog
          title={`Eliminar "${organization.display_name}" para siempre`}
          note="Elimina de forma permanente los datos de Shopify, Meta y Klaviyo, además de tareas, planes, agentes, miembros y suscripción. No hay periodo de gracia ni vuelta atrás."
          confirmPhrase={organization.display_name}
          actionLabel="Eliminar definitivamente"
          isBusy={busy}
          onConfirm={() =>
            void post(
              "hard-delete",
              onRemoved,
              "No se pudo eliminar el cliente.",
            )
          }
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

type CreatedInvite = {
  invite: { code: string; access_url: string; expires_at: string };
};

function OwnStoreShortcut() {
  return (
    <Card
      title="Añadir mi tienda"
      description="Crea una organización propia y conecta tus canales sin mezclarla con las organizaciones de tus clientes."
    >
      <ButtonLink href="/tiendas">Añadir mi tienda</ButtonLink>
    </Card>
  );
}

// Alta de cliente por el consultor (§16): genera un código suelto, sin
// organización todavía. El cliente crea la suya por su cuenta en /registro →
// /planes, y el código es lo que la vincula a esta cartera en ese momento.
function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/consultant/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email.trim() ? { email: email.trim() } : {}),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setCreated((await response.json()) as CreatedInvite);
      setEmail("");
      onCreated();
    } catch {
      setError(
        "No se pudo generar el código. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Card
        title={created.invite.code}
        description="Compártelo con tu cliente. Lo introduce en /acceso, crea su cuenta y su organización queda en tu cartera."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(created.invite.access_url)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
              }}
            >
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </Button>
            <span className="text-xs text-muted">
              Caduca el{" "}
              {new Date(created.invite.expires_at).toLocaleDateString("es-ES")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreated(null);
              setOpen(false);
            }}
          >
            Generar otro
          </Button>
        </div>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card
        title="Invitar cliente"
        description="Genera un código para que tu cliente cree su cuenta y quede en tu cartera."
      >
        <Button size="sm" onClick={() => setOpen(true)}>
          Invitar cliente
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="Invitar cliente"
      description="El código no caduca hasta que se use o pasen 7 días. Tu cliente crea su cuenta y su organización queda vinculada a tu cartera."
    >
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <Field label="Email del cliente (opcional, para enviárselo por correo)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@acme.com"
          />
        </Field>
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Generando..." : "Generar código"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Gestion de cartera: alta de cliente, tienda propia, catalogo de objetivos y
 * el mantenimiento de cada organizacion (editar, pausar, desvincular, borrar,
 * tiendas y accesos). Sigue estando, pero debajo del trabajo del dia: era lo
 * primero que se veia al abrir `/consultor` y no es lo primero que se hace.
 */
function PortfolioManagement({
  organizations,
  isPlatformAdmin,
  canManageStores,
  onChanged,
}: {
  organizations: ConsultantOrganization[];
  isPlatformAdmin: boolean;
  canManageStores: boolean;
  onChanged: () => void;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // FE-07: sin buscador, encontrar un cliente concreto entre muchos exigia
  // escanear la tabla entera a ojo -- filtro por nombre o slug, en el propio
  // navegador sobre la lista ya cargada (no una request nueva).
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOrganizations = normalizedQuery
    ? organizations.filter(
        (organization) =>
          organization.display_name.toLowerCase().includes(normalizedQuery) ||
          organization.slug.toLowerCase().includes(normalizedQuery),
      )
    : organizations;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <NewClientForm onCreated={onChanged} />
        <OwnStoreShortcut />
      </div>

      <ObjectiveTypesCard organizations={organizations} />

      <Card
        title="Clientes asignados"
        description="Mantenimiento de la cartera: datos de la organización, tiendas y accesos."
      >
        <Field label="Buscar cliente">
          <Input
            type="search"
            placeholder="Nombre o slug..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full max-w-sm"
          />
        </Field>
        {filteredOrganizations.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Sin resultados para &quot;{searchQuery}&quot;.
          </p>
        ) : (
          <List as="ul">
            {filteredOrganizations.map((row) => {
              const badge = attentionBadge(row.attention.score);
              const open = expandedId === row.id;
              return (
                <List.Item
                  as="li"
                  key={row.id}
                  className="py-3 first:pt-1 last:pb-1"
                >
                  <div
                    {...cardToggle(() => setExpandedId(open ? null : row.id))}
                    aria-expanded={open}
                    className="-mx-2 flex cursor-pointer flex-wrap items-start gap-3 rounded-md px-2 py-1 hover:bg-surface"
                  >
                    <Avatar name={row.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span {...stopToggle}>
                          <Link
                            href={`/consultor?organizationId=${row.id}`}
                            onClick={() => setOrganizationId(row.id)}
                            className="font-medium no-underline hover:text-accent hover:no-underline"
                          >
                            {row.display_name}
                          </Link>
                        </span>
                        <Badge
                          tone={badge.tone}
                          title={`Puntuación: ${row.attention.score}`}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {row.slug} ·{" "}
                        {row.status === "pending_deletion"
                          ? "Borrado en 30 días"
                          : (ORGANIZATION_STATUS_LABELS[row.status] ??
                            row.status)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {row.attention.open_alerts} alertas
                        {row.attention.critical_alerts > 0 ? (
                          <span className="text-danger">
                            {" "}
                            · {row.attention.critical_alerts} críticas
                          </span>
                        ) : null}
                        {" · "}
                        {row.attention.open_tasks} tareas
                        {row.attention.overdue_tasks > 0 ? (
                          <span className="text-danger">
                            {" "}
                            · {row.attention.overdue_tasks} vencidas
                          </span>
                        ) : null}
                        {" · "}
                        {row.subscription
                          ? `${row.subscription.plan_code} · ${SUBSCRIPTION_STATUS_LABELS[row.subscription.status] ?? row.subscription.status}`
                          : "Sin plan"}
                      </p>
                    </div>
                    <div className="mt-2 flex shrink-0 basis-full items-center justify-end gap-2 sm:mt-0 sm:basis-auto">
                      <span {...stopToggle}>
                        <Link
                          href="/tareas"
                          onClick={() => setOrganizationId(row.id)}
                          className="px-2 py-1 text-xs text-muted no-underline hover:text-accent hover:no-underline"
                        >
                          Tareas
                        </Link>
                      </span>
                      <span className="text-xs text-muted">
                        {row.store_count}{" "}
                        {row.store_count === 1 ? "tienda" : "tiendas"}
                      </span>
                      {canManageStores ? (
                        <span {...stopToggle}>
                          <ClientActionsMenu
                            organization={row}
                            isPlatformAdmin={isPlatformAdmin}
                            onEdit={() => {
                              setExpandedId(row.id);
                              setEditingId((current) =>
                                current === row.id ? null : row.id,
                              );
                            }}
                            onChanged={onChanged}
                            onRemoved={() => {
                              setExpandedId((id) =>
                                id === row.id ? null : id,
                              );
                              setEditingId((id) => (id === row.id ? null : id));
                              onChanged();
                            }}
                          />
                        </span>
                      ) : null}
                      {open ? (
                        <IconChevronUp aria-hidden />
                      ) : (
                        <IconChevronDown aria-hidden />
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div className="mt-3 rounded-md border border-separator bg-surface p-4 sm:ml-11">
                      <StoresPanel
                        organization={row}
                        isPlatformAdmin={isPlatformAdmin}
                        canManageStores={canManageStores}
                        isEditing={editingId === row.id}
                        onEditingChange={(editing) =>
                          setEditingId(editing ? row.id : null)
                        }
                        onOrganizationUpdated={onChanged}
                      />
                    </div>
                  ) : null}
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}

/**
 * Cabecera de la jornada: fecha, periodo y el recuento de lo que hay en cola.
 * Los contadores que tienen un filtro equivalente en "Para resolver hoy" son
 * clicables y lo activan -- son la misma cifra, no dos fuentes distintas.
 */
function WorkbenchHeader({
  workbench,
  windowDays,
  onWindowChange,
  onStatClick,
}: {
  workbench: DailyWorkbench | undefined;
  windowDays: number;
  onWindowChange: (days: number) => void;
  onStatClick: (filter: InboxFilter) => void;
}) {
  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const summary = workbench?.summary;
  // Chips en vez de una frase de seis clausulas: se lee en un vistazo, y solo
  // lo que pide algo (>0) se pinta en color -- un 0 es informacion buena, no
  // tiene que competir visualmente con lo que si hay que mirar.
  const stats: Array<{
    label: string;
    value: number;
    needsAttention: boolean;
    filter: InboxFilter | null;
  }> = summary
    ? [
        {
          label: "clientes",
          value: summary.clients,
          needsAttention: false,
          filter: null,
        },
        {
          label: "con algo urgente",
          value: summary.urgent_clients,
          needsAttention: summary.urgent_clients > 0,
          filter: "urgente",
        },
        {
          label: "tareas vencidas",
          value: summary.overdue_tasks,
          needsAttention: summary.overdue_tasks > 0,
          filter: "vencidas",
        },
        {
          label: "resúmenes por aprobar",
          value: summary.pending_call_summaries,
          needsAttention: summary.pending_call_summaries > 0,
          filter: "decision",
        },
        {
          label: "propuestas de IA",
          value: summary.pending_ai_proposals,
          needsAttention: summary.pending_ai_proposals > 0,
          filter: "decision",
        },
        {
          label: "hilos sin leer",
          value: summary.unread_threads,
          needsAttention: summary.unread_threads > 0,
          filter: "decision",
        },
      ]
    : [];

  return (
    <Card
      kicker={today}
      title="Tu mesa de hoy"
      actions={
        <Field label="Periodo de las cifras">
          <Select
            value={String(windowDays)}
            onChange={(value) => onWindowChange(Number(value))}
            options={WINDOW_OPTIONS.map((days) => ({
              value: String(days),
              label: `Últimos ${days} días`,
            }))}
          />
        </Field>
      }
    >
      {stats.length > 0 ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {stats.map((stat) => {
            const valueClass = cn(
              "text-lg font-semibold tabular-nums",
              stat.needsAttention ? "text-warning" : "text-foreground",
            );
            return (
              <div key={stat.label} className="flex items-baseline gap-1.5">
                {stat.filter ? (
                  <button
                    type="button"
                    onClick={() => onStatClick(stat.filter!)}
                    className="flex items-baseline gap-1.5 hover:opacity-75"
                  >
                    <dt className={valueClass}>{stat.value}</dt>
                    <dd className="text-xs text-muted underline decoration-dotted">
                      {stat.label}
                    </dd>
                  </button>
                ) : (
                  <>
                    <dt className={valueClass}>{stat.value}</dt>
                    <dd className="text-xs text-muted">{stat.label}</dd>
                  </>
                )}
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-[13px] text-muted">
          Reuniendo alertas, tareas, llamadas, mensajes e integraciones de tu
          cartera…
        </p>
      )}
    </Card>
  );
}

function ConsultantPanel({
  isPlatformAdmin,
  canManageStores,
}: {
  isPlatformAdmin: boolean;
  canManageStores: boolean;
}) {
  const { setOrganizationId } = useActiveOrganization();
  // El nivel lo decide la URL, no la organizacion activa guardada: entrar por
  // el nav a /consultor tiene que dar la cartera aunque la ultima vez se
  // estuviera dentro de un cliente (R-009, la URL es la fuente primaria).
  const focusId = useSearchParams().get("organizationId") ?? "";
  const [windowDays, setWindowDays] = useState(30);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("todo");

  const organizationsQuery = useCachedQuery<{
    organizations?: ConsultantOrganization[];
  }>("/v1/consultant/organizations");
  const organizations = (organizationsQuery.data?.organizations ?? []).filter(
    (organization) => !organization.is_own_store,
  );

  // Un solo contrato para las dos vistas: sin `organizationId` es la cartera,
  // con el es la mesa de ese cliente (y el servidor responde 403 si no es
  // suyo -- aqui no se filtra nada a mano).
  const workbenchQuery = useCachedQuery<DailyWorkbench>(
    `/v1/consultant/daily-workbench?days=${windowDays}${
      focusId ? `&organizationId=${focusId}` : ""
    }`,
  );
  const workbench = workbenchQuery.data;

  // El pulso de cartera se apoya en el resumen que ya existe; solo se pide en
  // la vista de cartera, no dentro de la ficha de un cliente.
  const overviewQuery = useCachedQuery<{
    business?: {
      net_sales: number | null;
      shopify_currency_code: string | null;
      meta_currency_code: string | null;
      orders: number;
      meta_spend: number | null;
      roas: number | null;
      prev_net_sales: number | null;
      prev_orders: number;
      prev_meta_spend: number | null;
    };
  }>(focusId ? null : `/v1/consultant/overview?days=${windowDays}`);

  const reload = useCallback(() => {
    organizationsQuery.reload();
    workbenchQuery.reload();
    overviewQuery.reload();
  }, [organizationsQuery.reload, workbenchQuery.reload, overviewQuery.reload]);

  const backToPortfolio = useCallback(() => {
    setOrganizationId("");
  }, [setOrganizationId]);

  // "Sin permiso para un cliente": el endpoint decide, la UI vuelve a cartera.
  useEffect(() => {
    if (workbenchQuery.error === "organization_access_denied") {
      setOrganizationId("");
    }
  }, [workbenchQuery.error, setOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando tu mesa..." />;
  }

  if (organizationsQuery.error) {
    return (
      <AsyncState
        status="error"
        error="No se pudieron cargar los clientes. Revisa la conexión e inténtalo de nuevo."
      />
    );
  }

  // Cartera vacia: el alta tiene que seguir en pantalla. Devolver solo el
  // EmptyState dejaba al consultor recien creado sin forma de crear su primer
  // cliente: para tener clientes hacia falta ya tener clientes.
  if (organizations.length === 0) {
    return (
      <div className="portal-page space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <NewClientForm onCreated={reload} />
          <OwnStoreShortcut />
        </div>
        <EmptyState
          title="Aún no tienes clientes"
          hint="Da de alta el primero aquí arriba, o espera a que te asignen una organización como consultor."
        />
      </div>
    );
  }

  const client = workbench?.client ?? null;
  const focusedOrganization =
    organizations.find((organization) => organization.id === focusId) ??
    null;

  // --- Mesa de un cliente --------------------------------------------------
  if (focusId && client && workbench) {
    return (
      <div className="portal-page space-y-6">
        <DegradedSources sources={workbench.sources} onRetry={reload} />
        <ClientDesk
          client={client}
          actions={workbench.actions}
          upcoming={workbench.upcoming}
          onBack={backToPortfolio}
          onReviewed={reload}
          administration={
            focusedOrganization ? (
              <div className="space-y-6">
                <StoresPanel
                  organization={focusedOrganization}
                  isPlatformAdmin={isPlatformAdmin}
                  canManageStores={canManageStores}
                  isEditing={false}
                  onEditingChange={() => {}}
                  onOrganizationUpdated={reload}
                />
                {canManageStores ? (
                  <AccessPanel organizationId={focusedOrganization.id} />
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                Esta organización es una tienda propia; se administra desde
                Integraciones.
              </p>
            )
          }
        />
      </div>
    );
  }

  if (focusId && workbenchQuery.isLoading) {
    return <AsyncState status="loading" loadingLabel="Abriendo el cliente..." />;
  }

  // --- Cartera -------------------------------------------------------------
  return (
    <div className="portal-page space-y-6">
      <WorkbenchHeader
        workbench={workbench}
        windowDays={windowDays}
        onWindowChange={setWindowDays}
        onStatClick={setInboxFilter}
      />

      {workbenchQuery.error ? (
        <ErrorBlock>
          No se pudo cargar la cola de trabajo. Revisa la conexión e inténtalo
          de nuevo.
        </ErrorBlock>
      ) : null}

      {workbench ? (
        <>
          <DegradedSources sources={workbench.sources} onRetry={reload} />
          {/* Cola a 2/3 y agenda a 1/3: son las dos cosas que se miran a la
              vez al planificar el dia, no una debajo de la otra. */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DailyActionInbox
                actions={workbench.actions}
                emptyHint="Ninguna alerta, tarea, llamada, integración ni hito pide decisión. Buen momento para avanzar el plan estratégico de un cliente."
                filter={inboxFilter}
                onFilterChange={setInboxFilter}
              />
            </div>
            <div className="space-y-6 lg:col-span-1">
              <NextCallWidget
                items={workbench.upcoming}
                onOpen={setOrganizationId}
              />
              <UpcomingWork
                items={workbench.upcoming.filter((item) => item.kind === "call")}
                title="Agenda"
                description="Llamadas de los próximos siete días."
                emptyLabel="Sin llamadas agendadas esta semana."
              />
            </div>
          </div>
          <PortfolioHealthBoard
            rows={workbench.portfolio}
            onOpen={setOrganizationId}
          />
          <UpcomingWork
            items={workbench.upcoming.filter((item) => item.kind !== "call")}
            title="Esta semana"
            description="Hitos del plan, campañas y tareas con fecha en los próximos siete días."
            emptyLabel="Nada más fechado esta semana."
          />
        </>
      ) : workbenchQuery.isLoading ? (
        <LoadingBlock label="Reuniendo el trabajo del día..." />
      ) : null}

      <PortfolioPulse
        business={overviewQuery.data?.business ?? null}
        windowDays={windowDays}
        isLoading={overviewQuery.isLoading}
      />

      <CollapsibleSection title="Gestión de cartera">
        <PortfolioManagement
          organizations={organizations}
          isPlatformAdmin={isPlatformAdmin}
          canManageStores={canManageStores}
          onChanged={reload}
        />
      </CollapsibleSection>
    </div>
  );
}

// --- Tipos de objetivo (catalogo editable del consultor) -------------------
// El consultor define aqui "tipos" de objetivo; el valor objetivo por cliente
// se sigue poniendo 1 a 1 desde Mi Camino. Un tipo puede medirse con una
// metrica de plataforma (Shopify/Meta, la app calcula el actual) o ser de
// valor manual (el consultor teclea el actual en la card del objetivo).

type ObjectiveDefinition = {
  id: string;
  organization_id: string | null;
  slug: string;
  label: string;
  unit: "money" | "pct" | "count" | "ratio" | "number";
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
  metric_key: string | null;
  created_at: string;
};

type ObjectiveBuiltin = {
  key: string;
  label: string;
  unit: string;
  direction: string;
  source: string;
  metric_key: string | null;
};

const OBJECTIVE_UNIT_LABELS: Record<string, string> = {
  money: "Moneda (€)",
  pct: "Porcentaje (%)",
  count: "Recuento",
  ratio: "Ratio (x)",
  number: "Número",
};

function ObjectiveTypesCard({
  organizations,
}: {
  organizations: ConsultantOrganization[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const definitionsQuery = useCachedQuery<{
    definitions?: ObjectiveDefinition[];
    builtins?: ObjectiveBuiltin[];
  }>(isOpen ? "/v1/consultant/objective-definitions" : null);
  const definitions = definitionsQuery.data?.definitions ?? null;
  const builtins = definitionsQuery.data?.builtins ?? [];
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? definitionsQuery.error;
  const setError = setActionError;
  const [busyId, setBusyId] = useState<string | null>(null);

  // Alta
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<"platform" | "manual">("platform");
  const [metricKey, setMetricKey] = useState("");
  const [unit, setUnit] = useState("number");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [scope, setScope] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    setActionError(null);
    definitionsQuery.reload();
  }, [definitionsQuery.reload]);

  useEffect(() => {
    if (isOpen && !metricKey && builtins[0]) {
      setMetricKey(builtins[0].key);
    }
  }, [builtins, isOpen, metricKey]);

  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) return;
    setIsSaving(true);
    try {
      const body =
        source === "platform"
          ? {
              label: label.trim(),
              source: builtins.find((b) => b.key === metricKey)?.source,
              metricKey,
              organizationId: scope === "all" ? null : scope,
            }
          : {
              label: label.trim(),
              source: "manual",
              unit,
              direction,
              organizationId: scope === "all" ? null : scope,
            };
      const response = await apiFetch("/v1/consultant/objective-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Tipo de objetivo creado.");
      setLabel("");
      load();
    } catch {
      setError("No se pudo crear el tipo de objetivo. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  async function renameDefinition(id: string, nextLabel: string) {
    setBusyId(id);
    try {
      const response = await apiFetch(
        `/v1/consultant/objective-definitions/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nextLabel }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      load();
    } catch {
      setError("No se pudo actualizar el tipo de objetivo. Reintenta.");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveDefinition(id: string) {
    setBusyId(id);
    try {
      const response = await apiFetch(
        `/v1/consultant/objective-definitions/${id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      load();
    } catch {
      setError("No se pudo borrar el tipo de objetivo. Reintenta.");
    } finally {
      setBusyId(null);
    }
  }

  const orgName = (id: string | null) =>
    id === null
      ? "Toda mi cartera"
      : (organizations.find((o) => o.id === id)?.display_name ?? "Un cliente");

  return (
    <Card
      title="Tipos de objetivo"
      description="Catálogo de objetivos que puedes imponer a tus clientes desde Mi Camino. El valor objetivo se fija cliente por cliente; aquí solo defines los tipos."
      actions={
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-label="Configurar tipos de objetivo"
          onClick={() => setIsOpen(true)}
        >
          <SettingsIcon aria-hidden /> Configurar
        </Button>
      }
    >
      <p className="text-sm text-muted">
        {definitions === null
          ? "Abre «Configurar» para gestionar tus tipos de objetivo."
          : definitions.length === 0
            ? "Solo los 8 objetivos estándar de plataforma. Añade tipos propios desde «Configurar»."
            : `${definitions.length} tipo(s) propio(s) además de los 8 estándar de plataforma.`}
      </p>

      <Modal isOpen={isOpen} onOpenChange={(open) => setIsOpen(open)}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog aria-label="Configurar tipos de objetivo">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Tipos de objetivo</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {error ? (
                  <div className="mb-3">
                    <ErrorBlock>{error}</ErrorBlock>
                  </div>
                ) : null}

                <p className="text-sm font-semibold text-foreground">
                  Estándar de plataforma (siempre activos)
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {builtins.map((b) => (
                    <li key={b.key}>
                      <Badge tone="neutral">{b.label}</Badge>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm font-semibold text-foreground">
                  Tus tipos propios
                </p>
                {definitions === null ? (
                  <p className="mt-1 text-sm text-muted">Cargando...</p>
                ) : definitions.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">
                    Todavía no has creado ninguno.
                  </p>
                ) : (
                  <List as="ul" bordered className="mt-1">
                    {definitions.map((def) => (
                      <List.Item
                        as="li"
                        key={def.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{def.label}</span>
                          <span className="ml-2 text-xs text-muted">
                            {def.source === "manual"
                              ? "Manual"
                              : "Métrica de plataforma"}{" "}
                            · {orgName(def.organization_id)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Renombrar ${def.label}`}
                            disabled={busyId === def.id}
                            onClick={() => {
                              const next = window.prompt(
                                "Nuevo nombre del objetivo",
                                def.label,
                              );
                              if (
                                next &&
                                next.trim() &&
                                next.trim() !== def.label
                              ) {
                                void renameDefinition(def.id, next.trim());
                              }
                            }}
                          >
                            <PencilIcon aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === def.id}
                            onClick={() => void archiveDefinition(def.id)}
                          >
                            {busyId === def.id ? "..." : "Borrar"}
                          </Button>
                        </span>
                      </List.Item>
                    ))}
                  </List>
                )}

                <form
                  onSubmit={createDefinition}
                  className="mt-4 space-y-3 border-t border-separator pt-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Nuevo tipo de objetivo
                  </p>
                  <Field label="Nombre">
                    <Input
                      className="mt-1"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="p. ej. Suscriptores de newsletter"
                      required
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Field label="Cómo se mide">
                      <Select
                        className="mt-1"
                        value={source}
                        onChange={(value) =>
                          setSource(value as "platform" | "manual")
                        }
                        options={[
                          {
                            value: "platform",
                            label: "Métrica de plataforma",
                          },
                          { value: "manual", label: "Valor manual" },
                        ]}
                      />
                    </Field>
                    {source === "platform" ? (
                      <Field label="Métrica">
                        <Select
                          className="mt-1"
                          value={metricKey}
                          onChange={setMetricKey}
                          options={builtins.map((b) => ({
                            value: b.key,
                            label: b.label,
                          }))}
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="Unidad">
                          <Select
                            className="mt-1"
                            value={unit}
                            onChange={setUnit}
                            options={Object.entries(OBJECTIVE_UNIT_LABELS).map(
                              ([value, label2]) => ({ value, label: label2 }),
                            )}
                          />
                        </Field>
                        <Field label="Dirección">
                          <Select
                            className="mt-1"
                            value={direction}
                            onChange={(value) =>
                              setDirection(value as "up" | "down")
                            }
                            options={[
                              { value: "up", label: "Más es mejor" },
                              { value: "down", label: "Menos es mejor" },
                            ]}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                  <Field label="Para quién">
                    <Select
                      className="mt-1"
                      value={scope}
                      onChange={setScope}
                      options={[
                        { value: "all", label: "Toda mi cartera" },
                        ...organizations.map((o) => ({
                          value: o.id,
                          label: o.display_name,
                        })),
                      ]}
                    />
                  </Field>
                  {source === "manual" ? (
                    <p className="text-xs text-muted">
                      Los objetivos manuales no tienen dato automático: tú
                      introduces el valor actual en la card del objetivo, dentro
                      de Mi Camino de cada cliente.
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving || !label.trim()}
                  >
                    {isSaving ? "Creando..." : "Crear tipo de objetivo"}
                  </Button>
                </form>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                >
                  Cerrar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Card>
  );
}

export default function ConsultantPage() {
  return (
    <PortalShell title="Clientes">
      {(bootstrap) => (
        <ConsultantPanel
          isPlatformAdmin={bootstrap.profile.platform_role === "platform_admin"}
          canManageStores={["consultant", "platform_admin"].includes(
            bootstrap.profile.platform_role,
          )}
        />
      )}
    </PortalShell>
  );
}
