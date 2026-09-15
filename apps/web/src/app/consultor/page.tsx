"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useAdminViewMode } from "@/components/admin-view-mode";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import {
  AsyncState,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  ErrorBlock,
  EYEBROW,
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
  type Tone,
} from "@/components/ui";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";

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

// Traduce attention.score (severidad + antiguedad + tareas vencidas, ver
// consultant.ts) al mismo orden de revision que ya documenta
// CHECKLIST-SALUD-CLIENTE.md: score, luego alertas criticas siempre, luego
// antiguedad, luego tareas vencidas. Aqui solo se explica en una linea por
// que un cliente esta donde esta, sin repetir el checklist a mano cada lunes.
function attentionReasons(
  attention: ConsultantOrganization["attention"],
): string {
  const parts: string[] = [];
  if (attention.critical_alerts > 0) {
    parts.push(`${attention.critical_alerts} alerta(s) critica(s)`);
  }
  if (attention.high_alerts > 0) {
    parts.push(`${attention.high_alerts} alerta(s) alta(s)`);
  }
  if (attention.oldest_alert_days >= 7) {
    parts.push(
      `la mas antigua lleva ${attention.oldest_alert_days} dias abierta`,
    );
  }
  if (attention.overdue_tasks > 0) {
    parts.push(`${attention.overdue_tasks} tarea(s) vencida(s)`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Revision pendiente";
}

/**
 * Convierte la lista ya ordenada por `attention.score` en la vista que pide
 * el checklist semanal: en cuanto se abre `/consultor` un lunes, por donde
 * empezar y por que, sin escanear la tabla entera fila a fila. Los mismos
 * tres tramos que ya usa `attentionBadge` (Urgente/Revisar/Vigilar) se usan
 * aqui para agrupar, no se inventa una escala nueva.
 */
function PriorityQueue({
  organizations,
  onSelect,
}: {
  organizations: ConsultantOrganization[];
  onSelect: (organizationId: string) => void;
}) {
  const urgent = organizations.filter((org) => org.attention.score >= 15);
  const review = organizations.filter(
    (org) => org.attention.score >= 5 && org.attention.score < 15,
  );
  const watch = organizations.filter(
    (org) => org.attention.score > 0 && org.attention.score < 5,
  );
  const needsAttentionCount = urgent.length + review.length + watch.length;
  const totalCriticalAlerts = organizations.reduce(
    (sum, org) => sum + org.attention.critical_alerts,
    0,
  );
  const totalOverdueTasks = organizations.reduce(
    (sum, org) => sum + org.attention.overdue_tasks,
    0,
  );

  const tiers: Array<{
    key: string;
    label: string;
    tone: Tone;
    items: ConsultantOrganization[];
  }> = [
    { key: "urgent", label: "Urgente hoy", tone: "danger", items: urgent },
    {
      key: "review",
      label: "Revisar esta semana",
      tone: "warn",
      items: review,
    },
    { key: "watch", label: "Vigilar", tone: "neutral", items: watch },
  ];

  return (
    <Card
      title="Por dónde empezar esta semana"
      description={`${organizations.length} cliente(s) · ${needsAttentionCount} necesitan atención · ${totalCriticalAlerts} alerta(s) crítica(s) · ${totalOverdueTasks} tarea(s) vencida(s)`}
    >
      {needsAttentionCount === 0 ? (
        <p className="mt-4 text-[13px] text-success">
          Todos al día. Buen momento para avanzar el plan estratégico de cada
          cliente.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {tiers
            .filter((tier) => tier.items.length > 0)
            .map((tier) => (
              <div key={tier.key}>
                <p className={EYEBROW}>
                  {tier.label} ({tier.items.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {tier.items.map((organization) => (
                    <li
                      key={organization.id}
                      className="flex items-start justify-between gap-3 border-b border-separator pb-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href="/dashboard"
                          onClick={() => onSelect(organization.id)}
                        >
                          {organization.display_name}
                        </Link>
                        <p className="mt-1 text-[13px] text-muted">
                          {attentionReasons(organization.attention)}
                        </p>
                      </div>
                      <Badge tone={tier.tone}>
                        {organization.attention.score}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

function AccessPanel({ organizationId }: { organizationId: string }) {
  const [access, setAccess] = useState<OrganizationAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [consultantUserId, setConsultantUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
      setError(
        "No se pudo cargar el acceso del cliente. Revisa la conexión e inténtalo de nuevo.",
      );
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
        <span className={EYEBROW}>
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
  const [stores, setStores] = useState<OrganizationStore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [restoringStoreId, setRestoringStoreId] = useState<string | null>(null);
  const [confirmDeleteStore, setConfirmDeleteStore] =
    useState<OrganizationStore | null>(null);

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
        setError(
          "No se pudieron cargar las tiendas. Revisa la conexión e inténtalo de nuevo.",
        );
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
        setStores((current) =>
          (current ?? []).map((store) =>
            store.id === storeId ? { ...store, status: "connected" } : store,
          ),
        );
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

  async function regenerateCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/invite/regenerate`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const data = (await response.json()) as {
        code: string;
        access_url: string;
      };
      await navigator.clipboard.writeText(data.access_url).catch(() => {});
      toast.success(`Código ${data.code} · enlace copiado`);
    } catch {
      setError("No se pudo generar el código.");
    } finally {
      setBusy(false);
    }
  }

  function onAction(key: string) {
    if (key === "edit") onEdit();
    else if (key === "pause")
      void post("pause", onChanged, "No se pudo pausar el cliente.");
    else if (key === "resume")
      void post("resume", onChanged, "No se pudo reanudar el cliente.");
    else if (key === "invite-code") void regenerateCode();
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
            {organization.status === "onboarding" ? (
              <Dropdown.Item id="invite-code" textValue="Código de acceso">
                <RetryIcon aria-hidden />
                <Label>Nuevo código de acceso</Label>
              </Dropdown.Item>
            ) : null}
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
          note="Borra TODO al instante: datos de Shopify/Meta/Klaviyo, tareas, planes, agentes, miembros y suscripción. No hay periodo de gracia ni vuelta atrás."
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
  organization: { display_name: string };
  invite: { code: string; access_url: string; expires_at: string };
};

function OwnStoreShortcut() {
  return (
    <Card
      kicker="Tu negocio"
      title="Añadir mi tienda"
      description="Crea una organización propia y conecta tus canales sin mezclarla con las organizaciones de tus clientes."
    >
      <ButtonLink href="/tiendas">Añadir mi tienda</ButtonLink>
    </Card>
  );
}

// Alta de cliente por el consultor: crea la organización (queda en su cartera)
// y genera un código único y temporal. El consultor comparte el código o el
// enlace; el cliente lo canjea en /acceso y hace su onboarding.
function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit =
    displayName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/consultant/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          owner_email: ownerEmail.trim(),
          owner_full_name: ownerFullName.trim() || undefined,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setCreated((await response.json()) as CreatedInvite);
      setDisplayName("");
      setOwnerEmail("");
      setOwnerFullName("");
      onCreated();
    } catch {
      setError(
        "No se pudo crear el cliente. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Card
        kicker="Cliente creado"
        title={created.organization.display_name}
        description="Comparte este código o enlace con tu cliente. Lo introduce en la página de acceso y hace su onboarding."
      >
        <div className="grid gap-4">
          <div>
            <p className={EYEBROW}>Código</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em]">
              {created.invite.code}
            </p>
          </div>
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
            Crear otro
          </Button>
        </div>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card
        kicker="Alta"
        title="Invitar cliente"
        description="Crea una organización separada para el cliente y genera su código de acceso."
      >
        <Button size="sm" onClick={() => setOpen(true)}>
          Invitar cliente
        </Button>
      </Card>
    );
  }

  return (
    <Card
      kicker="Alta"
      title="Invitar cliente"
      description="Se crea su organización en tu cartera y el cliente decide si quiere unirse antes de obtener acceso."
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
          <Field label="Email del cliente">
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@acme.com"
            />
          </Field>
          <Field label="Nombre de contacto (opcional)">
            <Input
              value={ownerFullName}
              onChange={(e) => setOwnerFullName(e.target.value)}
              placeholder="Nombre Apellido"
            />
          </Field>
        </div>
        <div className="flex gap-3">
          <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "Creando..." : "Crear invitación"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ConsultantPanel({
  token,
  isPlatformAdmin,
  canManageStores,
}: {
  token: string;
  isPlatformAdmin: boolean;
  canManageStores: boolean;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const [organizations, setOrganizations] = useState<ConsultantOrganization[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      // Las tiendas propias del consultor vienen en la misma lista (las
      // necesitan integraciones, agenda y planificacion), pero esta pantalla
      // es la cartera: aqui "Clientes" son clientes.
      setOrganizations(payload.organizations.filter((o) => !o.is_own_store));
      setError(null);
    } catch {
      setError(
        "No se pudieron cargar los clientes. Revisa la conexión e inténtalo de nuevo.",
      );
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

  // Cartera vacia: el alta tiene que seguir en pantalla. Devolver solo el
  // EmptyState dejaba al consultor recien creado sin forma de crear su primer
  // cliente: para tener clientes hacia falta ya tener clientes.
  if (organizations.length === 0) {
    return (
      <div className="portal-page space-y-5 sm:space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <NewClientForm onCreated={() => void load()} />
          <OwnStoreShortcut />
        </div>
        <EmptyState
          title="Aún no tienes clientes"
          hint="Da de alta el primero aquí arriba, o espera a que te asignen una organización como consultor."
        />
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOrganizations = normalizedQuery
    ? organizations.filter(
        (organization) =>
          organization.display_name.toLowerCase().includes(normalizedQuery) ||
          organization.slug.toLowerCase().includes(normalizedQuery),
      )
    : organizations;

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <NewClientForm onCreated={() => void load()} />
        <OwnStoreShortcut />
      </div>

      <PriorityQueue
        organizations={organizations}
        onSelect={setOrganizationId}
      />

      <Card
        title="Buscar cliente"
        description="Filtra tu cartera por nombre o slug para abrir su panel operativo."
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
      </Card>

      <ObjectiveTypesCard organizations={organizations} />

      <Card
        title="Clientes asignados"
        description="Organizaciones disponibles para seguimiento y soporte."
      >
        {filteredOrganizations.length === 0 ? (
          <p className="text-sm text-muted">
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
                            href="/dashboard"
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
                            onChanged={() => void load()}
                            onRemoved={() => {
                              setExpandedId((id) =>
                                id === row.id ? null : id,
                              );
                              setEditingId((id) => (id === row.id ? null : id));
                              setOrganizations((prev) =>
                                prev.filter((org) => org.id !== row.id),
                              );
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
                        onOrganizationUpdated={() => void load()}
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
  const [definitions, setDefinitions] = useState<ObjectiveDefinition[] | null>(
    null,
  );
  const [builtins, setBuiltins] = useState<ObjectiveBuiltin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Alta
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<"platform" | "manual">("platform");
  const [metricKey, setMetricKey] = useState("");
  const [unit, setUnit] = useState("number");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [scope, setScope] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/v1/consultant/objective-definitions");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        definitions: ObjectiveDefinition[];
        builtins: ObjectiveBuiltin[];
      };
      setDefinitions(payload.definitions);
      setBuiltins(payload.builtins);
      setError(null);
      if (!metricKey && payload.builtins[0]) {
        setMetricKey(payload.builtins[0].key);
      }
    } catch {
      setError("No se pudieron cargar los tipos de objetivo. Reintenta.");
    }
  }, [metricKey]);

  useEffect(() => {
    if (isOpen && definitions === null) void load();
  }, [isOpen, definitions, load]);

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
      setDefinitions(null);
      await load();
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
      setDefinitions(null);
      await load();
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
      setDefinitions(null);
      await load();
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

                <p className={EYEBROW}>
                  Estándar de plataforma (siempre activos)
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {builtins.map((b) => (
                    <li key={b.key}>
                      <Badge tone="neutral">{b.label}</Badge>
                    </li>
                  ))}
                </ul>

                <p className={`${EYEBROW} mt-4`}>Tus tipos propios</p>
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
                  <p className={EYEBROW}>Nuevo tipo de objetivo</p>
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
      {(bootstrap, token) => (
        <ConsultantPanelWithViewMode
          token={token}
          platformRole={bootstrap.profile.platform_role}
        />
      )}
    </PortalShell>
  );
}

// Separacion de capacidades:
//  - canManageStores: borrar/restaurar una tienda del cliente. Es del rol
//    consultor -> tambien en la vista "consultor" de un platform_admin.
//  - isPlatformAdmin (vista admin): editar/borrar el cliente entero y el panel
//    de accesos. Se apaga cuando un platform_admin cambia a la vista consultor.
function ConsultantPanelWithViewMode({
  token,
  platformRole,
}: {
  token: string;
  platformRole: string;
}) {
  const { viewMode } = useAdminViewMode();
  return (
    <ConsultantPanel
      token={token}
      isPlatformAdmin={
        platformRole === "platform_admin" && viewMode === "admin"
      }
      canManageStores={["consultant", "platform_admin"].includes(platformRole)}
    />
  );
}
