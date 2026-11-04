"use client";


import { StoreIcon, Trash2Icon, UserMinusIcon } from "lucide-react";
import { scheduledDeletionLabel } from "@/lib/scheduled-deletion";
import {
  type FormEvent,
  useCallback,
  useState,
} from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  avatarInitials,
  AvatarFallback,
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  ArchiveIcon,
  Input,
  Link,
  List,
  LoadingBlock,
  MoreIcon,
  PencilIcon,
  RetryIcon,
  SearchableSelect,
  Select,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui";
import { ObjectiveTypesCard } from "./objective-types";
import { planName } from "@/lib/plan-labels";
import { ClientOnboardingSteps, STATUS_BADGE, type DailyWorkbench } from "./workbench";
import { withPortalRouteContext } from "@/lib/portal-route-context";

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

export type ConsultantOrganization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  scheduled_purge_at?: string | null;
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
  scheduled_purge_at?: string | null;
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

export function AccessPanel({ organizationId }: { organizationId: string }) {
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
            <EmptyState size="sm" title="Sin miembros asignados" />
          ) : (
            <List as="ul" bordered className="mt-2">
              {access.members.map((member) => (
                <Item key={member.id} size="sm" render={<li />}>
                  <ItemContent>
                    <ItemTitle>{member.profile?.full_name ?? member.user_id}</ItemTitle>
                    <ItemDescription>
                      {displayValue(member.role)} ·{" "}
                      {member.is_active ? "activo" : "inactivo"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
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
                  </ItemActions>
                </Item>
              ))}
            </List>
          )}
          <form
            onSubmit={saveMember}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end"
          >
            <Field label="Perfil existente">
              <SearchableSelect
                aria-label="Perfil existente"
                placeholder="Busca a una persona"
                emptyText="No hay nadie con ese nombre."
                value={memberUserId}
                onChange={setMemberUserId}
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
            <EmptyState size="sm" title="Sin consultores asignados" />
          ) : (
            <List as="ul" bordered className="mt-2">
              {access.assignments.map((assignment) => (
                <Item key={assignment.id} size="sm" render={<li />}>
                  <ItemContent>
                    <ItemTitle>
                      {assignment.profile?.full_name ??
                        assignment.consultant_user_id}
                    </ItemTitle>
                    <ItemDescription>
                      {assignment.is_primary ? "principal · " : ""}
                      {assignment.is_active ? "activo" : "inactivo"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
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
                  </ItemActions>
                </Item>
              ))}
            </List>
          )}
          <form
            onSubmit={saveAssignment}
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <Field label="Consultor existente">
              <SearchableSelect
                aria-label="Consultor existente"
                placeholder="Busca un consultor"
                emptyText="No hay ningún consultor con ese nombre."
                value={consultantUserId}
                onChange={setConsultantUserId}
                options={consultantProfiles.map((profile) => ({
                  value: profile.id,
                  label: profile.full_name ?? profile.id,
                }))}
              />
            </Field>
            <div className="pb-2">
              <Checkbox checked={isPrimary} onCheckedChange={setIsPrimary}>
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
      <div role="group" aria-label="Acciones del formulario" className="flex flex-wrap items-center gap-2 md:col-span-4">
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

export function StoresPanel({
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
  const [confirmEraseStore, setConfirmEraseStore] =
    useState<OrganizationStore | null>(null);

  async function eraseStore() {
    if (!confirmEraseStore) return;
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/stores/${confirmEraseStore.id}/hard-delete`,
        { method: "POST" },
      );
      if (response.ok) {
        reloadStores();
        setConfirmEraseStore(null);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo eliminar la tienda. Revisa la conexión e inténtalo de nuevo.");
    }
  }

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
        <EmptyState size="sm" title="Sin tiendas conectadas" />
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
                    ? scheduledDeletionLabel(store.scheduled_purge_at)
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
                  <span className="flex flex-wrap gap-1">
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
                    {isPlatformAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmEraseStore(store)}
                      >
                        Eliminar ya
                      </Button>
                    ) : null}
                  </span>
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

      {/* confirmStoreDeletion lo cierra al acabar bien; si falla, sigue abierto. */}
      {confirmDeleteStore ? (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmDeleteStore(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-danger/10 text-danger">
                <StoreIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>
                ¿Borrar la tienda «{confirmDeleteStore.provider_account_id ?? confirmDeleteStore.provider_account_name}»?
              </AlertDialogTitle>
              <AlertDialogDescription>Tienes 30 días para restaurarla antes del borrado definitivo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogConfirmPhrase
              phrase={
                confirmDeleteStore.provider_account_id ??
                confirmDeleteStore.provider_account_name ??
                confirmDeleteStore.id
              }
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={async () => {
                  await confirmStoreDeletion();
                  return false;
                }}
              >
                Borrar tienda
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {confirmEraseStore ? (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmEraseStore(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-danger/10 text-danger">
                <StoreIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Eliminar la tienda definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>Borra al momento la tienda y sus datos, sin esperar a la fecha programada. No hay vuelta atrás.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogConfirmPhrase
              phrase={
                confirmEraseStore.provider_account_id ??
                confirmEraseStore.provider_account_name ??
                confirmEraseStore.id
              }
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={async () => {
                  await eraseStore();
                  return false;
                }}
              >
                Eliminar definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Acciones de ${organization.display_name}`}
              disabled={busy}
              className="min-h-8 min-w-8 shrink-0 px-2"
            />
          }
        >
          <MoreIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => onAction("edit")}>
            <PencilIcon aria-hidden />
            Editar
          </DropdownMenuItem>
          {!pendingDeletion ? (
            suspended ? (
              <DropdownMenuItem onSelect={() => onAction("resume")}>
                <RetryIcon aria-hidden />
                Reanudar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAction("pause")}>
                <RetryIcon aria-hidden />
                Pausar
              </DropdownMenuItem>
            )
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onAction("unlink")}>
            <ArchiveIcon aria-hidden />
            Quitar de mi cartera
          </DropdownMenuItem>
          {isPlatformAdmin ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete")}>
              <ArchiveIcon aria-hidden />
              Eliminar definitivamente
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* `post` cierra el diálogo al acabar (bien o mal: el error va bajo el menú). */}
      <AlertDialog open={confirm === "unlink"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UserMinusIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Quitar a «{organization.display_name}» de tu cartera?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale de tu cartera y dejamos de traer sus datos. Conserva su acceso, integraciones y suscripción. Para recuperarlo hay que reasignarlo desde el panel admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogConfirmPhrase phrase={organization.display_name} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => post("unlink", onRemoved, "No se pudo quitar el cliente.")}
            >
              Quitar de mi cartera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger/10 text-danger">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar «{organization.display_name}» para siempre?</AlertDialogTitle>
            <AlertDialogDescription>
              Elimina de forma permanente los datos de Shopify, Meta y Klaviyo, además de tareas, planes, agentes, miembros y suscripción, y los usuarios que no tengan otra tienda. No hay periodo de gracia ni vuelta atrás.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogConfirmPhrase phrase={organization.display_name} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => post("hard-delete", onRemoved, "No se pudo eliminar el cliente.")}
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type CreatedInvite = {
  invite: { code: string; access_url: string; expires_at: string };
};

export function OwnStoreShortcut() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadir mi tienda</CardTitle>
        <CardDescription>Crea una organización propia y conecta tus canales sin mezclarla con las organizaciones de tus clientes.</CardDescription>
      </CardHeader>
      <CardContent>
        <ButtonLink href="/tiendas">Añadir mi tienda</ButtonLink>
      </CardContent>
    </Card>
  );
}

// Alta de cliente por el consultor (§16): genera un código suelto, sin
// organización todavía. El cliente crea la suya por su cuenta en /registro →
// /planes, y el código es lo que la vincula a esta cartera en ese momento.
export function NewClientForm({ onCreated }: { onCreated: () => void }) {
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
      <Card>
        <CardHeader>
          <CardTitle>{created.invite.code}</CardTitle>
          <CardDescription>Compártelo con tu cliente. Lo introduce en /acceso, crea su cuenta y su organización queda en tu cartera.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitar cliente</CardTitle>
          <CardDescription>Genera un código para que tu cliente cree su cuenta y quede en tu cartera.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" onClick={() => setOpen(true)}>
            Invitar cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar cliente</CardTitle>
        <CardDescription>El código no caduca hasta que se use o pasen 7 días. Tu cliente crea su cuenta y su organización queda vinculada a tu cartera.</CardDescription>
      </CardHeader>
      <CardContent>
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
          <div role="group" aria-label="Acciones de generacion de codigo" className="flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Generando..." : "Generar código"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Gestion de cartera: alta de cliente, tienda propia, catalogo de objetivos y
 * el mantenimiento de cada organizacion (editar, pausar, desvincular, borrar,
 * tiendas y accesos). Sigue estando, pero debajo del trabajo del dia: era lo
 * primero que se veia al abrir `/consultor` y no es lo primero que se hace.
 */
export function PortfolioManagement({
  organizations,
  workbench,
  initialOrganizationId,
  isPlatformAdmin,
  canManageStores,
  onChanged,
}: {
  organizations: ConsultantOrganization[];
  workbench?: DailyWorkbench;
  initialOrganizationId?: string;
  isPlatformAdmin: boolean;
  canManageStores: boolean;
  onChanged: () => void;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const [expandedId, setExpandedId] = useState<string | null>(initialOrganizationId || null);
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

      <Card>
        <CardHeader>
          <CardTitle>Clientes asignados</CardTitle>
          <CardDescription>Datos del cliente, tiendas y accesos. La prioridad utiliza las mismas señales que la mesa diaria.</CardDescription>
        </CardHeader>
        <CardContent>
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
              {searchQuery ? <>Sin resultados para &quot;{searchQuery}&quot;.</> : "Invita a tu primer cliente para empezar. También puedes gestionar tus tiendas propias desde Tiendas."}
            </p>
          ) : (
            // Una fila de acordeón por cliente: el disparador lleva solo el
            // nombre y sus datos; los enlaces y el menú van al lado, no dentro
            // (no se anidan controles en un botón, WCAG 4.1.2). Las tiendas se
            // montan solo al abrir: cada panel pide las suyas.
            <Accordion
              value={expandedId ? [expandedId] : []}
              onValueChange={(value) => setExpandedId(value[0] ?? null)}
            >
              {filteredOrganizations.map((row) => {
                const health = workbench?.portfolio.find((item) => item.organization_id === row.id);
                const badge = health ? STATUS_BADGE[health.status] : { label: "Sin comprobar", tone: "neutral" as const };
                const onboarding = workbench?.onboarding?.find((item) => item.organization_id === row.id);
                const open = expandedId === row.id;
                return (
                  <AccordionItem key={row.id} value={row.id}>
                    <div className="flex flex-wrap items-start gap-x-3 py-2">
                      <Avatar className="mt-3">
                        <AvatarFallback>{avatarInitials(row.display_name)}</AvatarFallback>
                      </Avatar>
                      <AccordionTrigger className="min-w-[12rem] py-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium">{row.display_name}</span>
                            <Badge
                              tone={badge.tone}
                              title={health?.next_action?.title ?? (health ? "Prioridad de la mesa diaria" : "No se pudo comprobar la prioridad")}
                            >
                              {badge.label}
                            </Badge>
                          </span>
                          <span className="mt-1 block text-xs font-normal text-muted">
                            {row.slug} ·{" "}
                            {row.status === "pending_deletion"
                              ? scheduledDeletionLabel(row.scheduled_purge_at)
                              : (ORGANIZATION_STATUS_LABELS[row.status] ??
                                row.status)}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-muted">
                            {row.attention.open_alerts} alertas
                            {row.attention.critical_alerts > 0 ? (
                              <span className="text-danger">
                                {" "}
                                · {row.attention.critical_alerts} críticas
                              </span>
                            ) : null}
                            {" · "}
                            {row.attention.open_tasks} tareas
                            {" · "}
                            {row.subscription
                              ? `${planName(row.subscription.plan_code)} · ${SUBSCRIPTION_STATUS_LABELS[row.subscription.status] ?? row.subscription.status}`
                              : "Sin plan"}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <div className="flex shrink-0 basis-full items-center justify-end gap-2 sm:basis-auto sm:pt-2">
                        <Link
                          href={`/consultor?organizationId=${row.id}`}
                          onClick={() => setOrganizationId(row.id)}
                          className="px-2 py-1 text-xs text-muted no-underline hover:text-accent hover:no-underline"
                        >
                          Abrir
                        </Link>
                        <Link
                          href={withPortalRouteContext("/tareas", row.id)}
                          onClick={() => setOrganizationId(row.id)}
                          className="px-2 py-1 text-xs text-muted no-underline hover:text-accent hover:no-underline"
                        >
                          Tareas
                        </Link>
                        <span className="text-xs text-muted">
                          {row.store_count}{" "}
                          {row.store_count === 1 ? "tienda" : "tiendas"}
                        </span>
                        {canManageStores ? (
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
                        ) : null}
                      </div>
                    </div>
                    <AccordionContent>
                      {open && onboarding ? <ClientOnboardingSteps onboarding={onboarding} /> : null}
                      {open ? (
                        <Card className="sm:ml-11"><CardContent>
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
                        </CardContent></Card>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Cabecera de la jornada: fecha, periodo y el recuento de lo que hay en cola.
 * Los contadores que tienen un filtro equivalente en "Para resolver hoy" son
 * clicables y lo activan -- son la misma cifra, no dos fuentes distintas.
 */
