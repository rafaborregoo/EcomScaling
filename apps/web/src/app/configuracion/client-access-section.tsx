"use client";

import { KeyRoundIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { planLabel } from "@/lib/plan-labels";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Banner,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  SearchableSelect,
  Select,
  DataTable,
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui";
import { ROLE_LABEL, ROLE_OPTIONS, type MemberRole } from "./role-permissions";

/**
 * Quién entra en este cliente, con qué rol y en qué tiendas.
 *
 * Desde 20261219100000 una persona limitada a tiendas puede tener varias
 * (`store_ids`), y solo el propietario da o quita la propiedad.
 */

type Member = {
  id: string;
  user_id: string;
  role: MemberRole;
  access_scope: "organization" | "store";
  store_ids: string[] | null;
  is_active: boolean;
  joined_at: string | null;
  profile: { full_name: string | null; platform_role: string } | null;
};

type ConsultantRow = {
  id: string;
  consultant_user_id: string;
  is_primary: boolean;
  profile: { full_name: string | null } | null;
};

type PendingInvite = {
  id: string;
  email: string;
  expires_at: string;
  access_scope: "organization" | "store";
  store_ids: string[] | null;
};

type ClientStore = { id: string; shop_name: string | null; myshopify_domain: string | null };

type ClientAccess = {
  plan: {
    plan_code: string;
    status: string;
    store_limit: number | null;
    member_limit: number | null;
  } | null;
  usage: {
    store_count: number;
    member_count: number;
    active_member_count: number;
    pending_invite_count: number;
  };
  members: Member[];
  consultants: ConsultantRow[];
  pending_invites: PendingInvite[];
  stores: ClientStore[];
};

type Security = { members: Array<{ user_id: string; has_mfa: boolean }> };

/** Elegir tiendas: todas, o una lista. Sin tiendas no hay elección posible. */
function StorePicker({
  stores,
  value,
  onChange,
  disabled,
  label,
}: {
  stores: ClientStore[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const limited = value !== null;
  const name = (store: ClientStore) => store.shop_name || store.myshopify_domain || "Tienda";
  return (
    <div className="grid gap-2" aria-label={label} role="group">
      <Select
        className="w-48"
        aria-label={`${label}: alcance`}
        value={limited ? "store" : "organization"}
        onChange={(next) => onChange(next === "store" ? stores.slice(0, 1).map((store) => store.id) : null)}
        options={[
          { value: "organization", label: "Todas las tiendas" },
          { value: "store", label: "Solo algunas tiendas" },
        ]}
        disabled={disabled || stores.length === 0}
      />
      {limited ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {stores.map((store) => {
            const checked = value.includes(store.id);
            return (
              <Checkbox
                key={store.id}
                checked={checked}
                disabled={disabled || (checked && value.length === 1)}
                onCheckedChange={(next) =>
                  onChange(next ? [...value, store.id] : value.filter((id) => id !== store.id))
                }
              >
                <span className="text-sm">{name(store)}</span>
              </Checkbox>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ClientAccessSection({
  organizationId,
  canManage,
  isOwner,
  currentUserId,
}: {
  organizationId: string;
  canManage: boolean;
  /** Solo el propietario da o quita la propiedad (la API lo comprueba igual). */
  isOwner: boolean;
  currentUserId: string;
}) {
  const [access, setAccess] = useState<ClientAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("member");
  const [inviteStores, setInviteStores] = useState<string[] | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [newOwner, setNewOwner] = useState("");
  const security = useCachedQuery<Security>(`/v1/organizations/${organizationId}/security`);
  const mfaByUser = new Map((security.data?.members ?? []).map((row) => [row.user_id, row.has_mfa]));

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/client-access`);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setAccess((await response.json()) as ClientAccess);
      setError(null);
    } catch {
      setError("No se pudo cargar el acceso del cliente por un error de red.");
    }
  }, [organizationId]);

  useEffect(() => {
    // Carga inicial desde el endpoint; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/client-access/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          role,
          access_scope: inviteStores ? "store" : "organization",
          store_ids: inviteStores ?? undefined,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        invite: { access_url: string; delivery: "email" | "manual_link" };
      };
      setLastInviteUrl(payload.invite.delivery === "email" ? null : payload.invite.access_url);
      setEmail("");
      setFullName("");
      setInviteStores(null);
      toast.success("Invitación enviada", {
        description:
          payload.invite.delivery === "email"
            ? "Le llega por correo."
            : "No se pudo enviar el correo: copia el enlace y compártelo.",
      });
      await load();
    } catch {
      toast.danger("No se pudo invitar por un error de red.");
    } finally {
      setInviting(false);
    }
  }

  async function patchMember(
    userId: string,
    body: { role?: string; isActive?: boolean; access_scope?: "organization" | "store"; store_ids?: string[] },
  ) {
    setBusyUserId(userId);
    try {
      const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/client-access/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      await load();
    } catch {
      toast.danger("No se pudo actualizar el acceso por un error de red.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/client-access/invites/${inviteId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Invitación anulada");
      await load();
    } catch {
      toast.danger("No se pudo anular la invitación por un error de red.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function transfer() {
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: newOwner }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Propiedad traspasada. Ahora eres gestor.");
      // El rol cambia en el bootstrap: recargar es lo más fiable.
      window.location.reload();
    } catch {
      toast.danger("No se pudo traspasar por un error de red.");
    }
  }

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!access) return <LoadingBlock label="Cargando personas…" />;

  const activeMembers = access.members.filter((member) => member.is_active);
  const activeOwners = activeMembers.filter((member) => member.role === "owner").length;
  const isLastOwner = (member: Member) => member.is_active && member.role === "owner" && activeOwners <= 1;
  const memberLimit = access.plan?.member_limit ?? null;
  const atMemberLimit = !access.plan || (memberLimit !== null && access.usage.member_count >= memberLimit);
  const storeName = (id: string) => {
    const store = access.stores.find((item) => item.id === id);
    return store?.shop_name || store?.myshopify_domain || "Tienda";
  };
  const storesLabel = (ids: string[] | null) => (ids && ids.length ? ids.map(storeName).join(", ") : "Todas");
  // Un gestor no ofrece «Propietario» ni toca a un propietario.
  const roleOptions = isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((option) => option.value !== "owner");
  const transferCandidates = activeMembers.filter(
    (member) => member.user_id !== currentUserId && member.role !== "owner",
  );

  type Row = Member & { id: string };
  const rows: Row[] = access.members;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personas</CardTitle>
          <CardDescription>{`${access.usage.member_count} de ${memberLimit ?? "∞"} usuarios del plan ${
          access.plan ? planLabel(access.plan.plan_code, access.plan.status) : ""
        }. Las invitaciones pendientes también ocupan plaza.`}</CardDescription>
          <CardAction><Badge tone="success">{activeMembers.length} con acceso</Badge></CardAction>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="Sin personas todavía" hint="Invita abajo a quien tenga que entrar." />
          ) : (
            <DataTable<Row>
              ariaLabel="Personas con acceso"
              rows={rows}
              columns={[
                {
                  key: "person",
                  label: "Persona",
                  render: (member) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.profile?.full_name ?? "Sin nombre"}
                        {member.user_id === currentUserId ? <span className="text-muted"> (tú)</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {!member.is_active
                          ? "sin acceso"
                          : member.joined_at
                            ? `entró el ${new Date(member.joined_at).toLocaleDateString("es-ES")}`
                            : "todavía no ha entrado"}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "role",
                  label: "Rol",
                  render: (member) =>
                    canManage && (isOwner || member.role !== "owner") && member.user_id !== currentUserId ? (
                      <Select
                        className="w-40"
                        aria-label={`Rol de ${member.profile?.full_name ?? "la persona"}`}
                        value={member.role}
                        onChange={(next) => void patchMember(member.user_id, { role: next })}
                        options={roleOptions}
                        disabled={busyUserId === member.user_id || isLastOwner(member)}
                      />
                    ) : (
                      <Badge tone={member.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[member.role] ?? member.role}</Badge>
                    ),
                },
                {
                  key: "stores",
                  label: "Tiendas",
                  render: (member) =>
                    canManage && member.role !== "owner" && access.stores.length > 1 ? (
                      <StorePicker
                        label={`Tiendas de ${member.profile?.full_name ?? "la persona"}`}
                        stores={access.stores}
                        value={member.access_scope === "store" ? (member.store_ids ?? []) : null}
                        disabled={busyUserId === member.user_id}
                        onChange={(next) =>
                          void patchMember(
                            member.user_id,
                            next ? { access_scope: "store", store_ids: next } : { access_scope: "organization" },
                          )
                        }
                      />
                    ) : (
                      <span className="text-sm">{member.access_scope === "store" ? storesLabel(member.store_ids) : "Todas"}</span>
                    ),
                },
                {
                  key: "mfa",
                  label: "2FA",
                  render: (member) => {
                    const hasMfa = mfaByUser.get(member.user_id);
                    return hasMfa === undefined ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Badge tone={hasMfa ? "success" : "warn"}>{hasMfa ? "Activa" : "Sin activar"}</Badge>
                    );
                  },
                },
                {
                  key: "actions",
                  label: "",
                  render: (member) =>
                    !canManage || member.user_id === currentUserId ? null : isLastOwner(member) ? (
                      <span className="text-xs text-muted">Único propietario</span>
                    ) : member.role === "owner" && !isOwner ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyUserId === member.user_id}
                        onClick={() => void patchMember(member.user_id, { isActive: !member.is_active })}
                      >
                        {member.is_active ? "Quitar acceso" : "Devolver acceso"}
                      </Button>
                    ),
                },
              ]}
            />
          )}

          {access.pending_invites.length > 0 ? (
            <div className="mt-6 grid gap-3 border-t border-separator pt-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Invitaciones pendientes</p>
              {access.pending_invites.map((pending) => (
                <Item key={pending.id} size="xs" className="px-0">
                  <ItemContent>
                    <ItemTitle>{pending.email}</ItemTitle>
                    <ItemDescription>
                      {pending.access_scope === "store" ? storesLabel(pending.store_ids) : "Todas las tiendas"} · caduca el{" "}
                      {new Date(pending.expires_at).toLocaleDateString("es-ES")}
                    </ItemDescription>
                  </ItemContent>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyInviteId === pending.id}
                      onClick={() => void revokeInvite(pending.id)}
                    >
                      Anular
                    </Button>
                  ) : null}
                </Item>
              ))}
            </div>
          ) : null}

          {access.consultants.length > 0 ? (
            <p className="mt-6 border-t border-separator pt-4 text-xs text-muted">
              Consultores (no ocupan usuario):{" "}
              {access.consultants
                .map((consultant) => `${consultant.profile?.full_name ?? "sin nombre"}${consultant.is_primary ? " (principal)" : ""}`)
                .join(" · ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitar a una persona</CardTitle>
            <CardDescription>La invitación reserva una plaza hasta que se acepte o caduque.</CardDescription>
          </CardHeader>
          <CardContent>
            {atMemberLimit ? (
              <Banner className="mb-4" tone="warn">
                {!access.plan
                  ? "No puedes invitar hasta que la cuenta tenga un plan activo."
                  : `Las ${memberLimit} plazas del plan están ocupadas. Amplía el plan o libera una para invitar a otra persona.`}
              </Banner>
            ) : null}
            <form className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)]" onSubmit={invite}>
              <Field label="Correo">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" />
              </Field>
              <Field label="Nombre (opcional)">
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nombre Apellido" />
              </Field>
              <Field label="Rol">
                <Select aria-label="Rol de la persona invitada" value={role} onChange={setRole} options={roleOptions} />
              </Field>
              {access.stores.length > 1 ? (
                <div className="md:col-span-3">
                  <StorePicker label="Tiendas de la invitación" stores={access.stores} value={inviteStores} onChange={setInviteStores} />
                </div>
              ) : null}
              <div className="md:col-span-3">
                <Button type="submit" disabled={inviting || !email.trim() || atMemberLimit}>
                  {inviting ? "Invitando…" : "Invitar"}
                </Button>
              </div>
            </form>
            {lastInviteUrl ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-separator pt-4">
                <p className="min-w-0 flex-1 break-all text-sm">{lastInviteUrl}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(lastInviteUrl)
                      .then(() => toast.success("Enlace copiado"))
                      .catch(() => toast.danger("No se pudo copiar."))
                  }
                >
                  Copiar enlace
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Traspasar la propiedad</CardTitle>
            <CardDescription>La cuenta siempre tiene un propietario. Al traspasarla pasas a ser gestor.</CardDescription>
          </CardHeader>
          <CardContent>
            {transferCandidates.length === 0 ? (
              <p className="text-sm text-muted">Invita antes a la persona que vaya a ser propietaria.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <SearchableSelect
                  className="w-64"
                  aria-label="Nuevo propietario"
                  placeholder="Busca a quién"
                  emptyText="No hay nadie con ese nombre."
                  value={newOwner}
                  onChange={setNewOwner}
                  options={transferCandidates.map((member) => ({
                    value: member.user_id,
                    label: member.profile?.full_name ?? "Sin nombre",
                  }))}
                />
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="destructive" disabled={!newOwner}>
                        Traspasar
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-danger/10 text-danger">
                        <KeyRoundIcon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>¿Traspasar la propiedad?</AlertDialogTitle>
                      <AlertDialogDescription>Solo el nuevo propietario podrá devolvértela.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <ul className="ui-alert-dialog__list">
                      <li>Dejas de gestionar el plan y la facturación.</li>
                      <li>Dejas de decidir qué puede hacer tu consultor.</li>
                      <li>Pasas a ser gestor de la cuenta.</li>
                    </ul>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={transfer}>
                        Traspasar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
