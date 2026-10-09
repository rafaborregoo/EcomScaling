"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Banner,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Select,
  toast,
} from "@/components/ui";

/**
 * Quién entra en este cliente, y cómo se le da acceso a alguien más.
 *
 * Hasta ahora el consultor no podía ver ni tocar esto: `getOrganizationAccess`
 * y `upsertOrganizationMember` son platform_admin only, y la única invitación
 * era la que se creaba en el alta del cliente -- `regenerateClientInvite` solo
 * sabe renovar esa. Dar de alta a una segunda persona pasaba por Rafa.
 */

const ROLE_OPTIONS = [
  { value: "owner", label: "Propietario" },
  { value: "manager", label: "Gestor" },
  { value: "member", label: "Miembro" },
  { value: "readonly", label: "Solo lectura" },
];

const ROLE_LABEL = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role.value, role.label]),
);

type Member = {
  id: string;
  user_id: string;
  role: string;
  access_scope: "organization" | "store";
  store_id: string | null;
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
  store_id: string | null;
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

export function ClientAccessSection({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [access, setAccess] = useState<ClientAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("member");
  const [accessScope, setAccessScope] = useState<"organization" | "store">("organization");
  const [storeId, setStoreId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/client-access`,
      );
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
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/client-access/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            full_name: fullName.trim() || undefined,
            role,
            access_scope: accessScope,
            store_id: accessScope === "store" ? storeId : null,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        invite: { code: string; access_url: string; delivery: "email" | "manual_link" };
      };
      setLastInviteCode(payload.invite.code);
      setLastInviteUrl(payload.invite.access_url);
      setEmail("");
      setFullName("");
      setAccessScope("organization");
      setStoreId("");
      toast.success("Invitación creada", {
        description:
          payload.invite.delivery === "email"
            ? "Hemos enviado el enlace de acceso por correo."
            : "No se pudo enviar el correo. Copia el enlace y compártelo.",
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
    body: { role?: string; isActive?: boolean; access_scope?: "organization" | "store"; store_id?: string | null },
  ) {
    setBusyUserId(userId);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/client-access/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
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
      toast.success("Código revocado");
      await load();
    } catch {
      toast.danger("No se pudo revocar el código por un error de red.");
    } finally {
      setBusyInviteId(null);
    }
  }

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!access) return <LoadingBlock label="Cargando accesos…" />;

  const activeMembers = access.members.filter((member) => member.is_active);
  const memberLimit = access.plan?.member_limit ?? null;
  const atMemberLimit =
    !access.plan ||
    (memberLimit !== null && access.usage.member_count >= memberLimit);
  const storeOptions = access.stores.map((store) => ({
    value: store.id,
    label: store.shop_name || store.myshopify_domain || "Tienda",
  }));
  const storeName = (id: string | null) =>
    id ? (storeOptions.find((store) => store.value === id)?.label ?? "Tienda") : "Toda la organización";

  return (
    <div className="space-y-4">
      <Card
        title="Lo que incluye tu plan"
        description="Las invitaciones pendientes también ocupan una plaza hasta que se acepten o caduquen."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Plan activo</dt>
            <dd className="mt-1 font-medium text-foreground">
              {access.plan ? `${access.plan.plan_code} · ${access.plan.status}` : "Sin plan activo"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Tiendas incluidas</dt>
            <dd className="mt-1 font-medium text-foreground">
              {access.plan
                ? `${access.usage.store_count} / ${access.plan.store_limit ?? "sin límite"}`
                : "No disponible"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Usuarios incluidos</dt>
            <dd className="mt-1 font-medium text-foreground">
              {access.plan
                ? `${access.usage.member_count} / ${memberLimit ?? "sin límite"}`
                : "No disponible"}
            </dd>
          </div>
        </dl>
        {access.usage.pending_invite_count > 0 ? (
          <p className="mt-3 text-xs text-muted">
            {access.usage.pending_invite_count} {access.usage.pending_invite_count === 1 ? "invitación pendiente" : "invitaciones pendientes"} reservan plaza.
          </p>
        ) : null}
        {!access.plan ? (
          <Banner className="mt-3" tone="warn">
            No hay una suscripción activa para esta organización. Hace falta un plan activo para invitar usuarios.
          </Banner>
        ) : null}
      </Card>

      <Card
        title="Quién entra en este cliente"
        description="Las personas del cliente y los consultores asignados."
        actions={
          <Badge tone="success">{activeMembers.length} con acceso</Badge>
        }
      >
        {access.members.length === 0 ? (
          <EmptyState
            title="Sin personas todavía"
            hint="Invita abajo a quien tenga que entrar al portal de este cliente."
          />
        ) : (
          <List as="ul">
            {access.members.map((member) => (
              <List.Item
                as="li"
                key={member.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.profile?.full_name ?? "Sin nombre"}
                  </span>
                  <span className="block text-xs text-muted">
                    {member.joined_at
                      ? `entró el ${new Date(member.joined_at).toLocaleDateString("es-ES")}`
                      : "todavía no ha entrado"}
                  </span>
                </span>
                {member.is_active ? null : <Badge>sin acceso</Badge>}
                {canManage ? (
                  <Select
                    className="w-40"
                    aria-label={`Rol de ${member.profile?.full_name ?? "el miembro"}`}
                    value={member.role}
                    onChange={(next) =>
                      void patchMember(member.user_id, { role: next })
                    }
                    options={ROLE_OPTIONS}
                    disabled={busyUserId === member.user_id}
                  />
                ) : (
                  <Badge>{ROLE_LABEL[member.role] ?? member.role}</Badge>
                )}
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      className="w-48"
                      aria-label={`Alcance de ${member.profile?.full_name ?? "el miembro"}`}
                      value={member.access_scope ?? "organization"}
                      onChange={(next) =>
                        void patchMember(member.user_id, {
                          access_scope: next as "organization" | "store",
                          store_id: next === "store" ? (member.store_id ?? storeOptions[0]?.value ?? null) : null,
                        })
                      }
                      options={[
                        { value: "organization", label: "Toda la organización" },
                        { value: "store", label: "Una tienda" },
                      ]}
                      disabled={busyUserId === member.user_id || storeOptions.length === 0}
                    />
                    {member.access_scope === "store" ? (
                      <Select
                        className="w-48"
                        aria-label={`Tienda permitida para ${member.profile?.full_name ?? "el miembro"}`}
                        value={member.store_id ?? ""}
                        onChange={(next) => void patchMember(member.user_id, { access_scope: "store", store_id: next })}
                        options={storeOptions}
                        disabled={busyUserId === member.user_id || storeOptions.length === 0}
                      />
                    ) : null}
                  </div>
                ) : (
                  <Badge>{storeName(member.store_id)}</Badge>
                )}
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyUserId === member.user_id}
                    onClick={() =>
                      void patchMember(member.user_id, {
                        isActive: !member.is_active,
                      })
                    }
                  >
                    {member.is_active ? "Quitar acceso" : "Devolver acceso"}
                  </Button>
                ) : null}
              </List.Item>
            ))}
          </List>
        )}

        {access.consultants.length > 0 ? (
          <div className="mt-4 border-t border-separator pt-3">
            <p className="text-xs text-muted">
              Consultores:{" "}
              {access.consultants
                .map(
                  (consultant) =>
                    `${consultant.profile?.full_name ?? "sin nombre"}${consultant.is_primary ? " (principal)" : ""}`,
                )
                .join(" · ")}
            </p>
          </div>
        ) : null}
      </Card>

      {canManage ? (
        <Card
          title="Invitar a una persona"
          description="Elige si podrá entrar a toda la organización o solo a una tienda. La invitación reserva una plaza; si no recibe el correo, copia el enlace."
        >
          {atMemberLimit ? (
            <Banner className="mb-3" tone="warn">
              {!access.plan
                ? "No puedes invitar hasta que la organización tenga un plan activo."
                : `Se han ocupado las ${memberLimit} plazas incluidas. Amplía el plan o libera una plaza para invitar a otra persona.`}
            </Banner>
          ) : null}
          <form className="flex flex-wrap items-end gap-3" onSubmit={invite}>
            <Field label="Correo">
              <Input
                className="mt-1 w-64"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="persona@sutienda.com"
              />
            </Field>
            <Field label="Nombre (opcional)">
              <Input
                className="mt-1 w-48"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nombre Apellido"
              />
            </Field>
            <Field label="Rol">
              <Select
                className="mt-1 w-40"
                aria-label="Rol de la persona invitada"
                value={role}
                onChange={setRole}
                options={ROLE_OPTIONS}
              />
            </Field>
            <Field label="Alcance del acceso">
              <Select
                className="mt-1 w-52"
                aria-label="Alcance del acceso"
                value={accessScope}
                onChange={(next) => setAccessScope(next as "organization" | "store")}
                options={[
                  { value: "organization", label: "Toda la organización" },
                  { value: "store", label: "Una tienda concreta" },
                ]}
              />
            </Field>
            {accessScope === "store" ? (
              <Field label="Tienda permitida">
                <Select
                  className="mt-1 w-56"
                  aria-label="Tienda permitida"
                  value={storeId}
                  onChange={setStoreId}
                  options={storeOptions}
                  disabled={storeOptions.length === 0}
                />
              </Field>
            ) : null}
            <Button type="submit" disabled={inviting || !email.trim() || atMemberLimit || (accessScope === "store" && !storeId)}>
              {inviting ? "Invitando…" : "Invitar"}
            </Button>
          </form>

          {lastInviteUrl ? (
            <div className="mt-4 border-t border-separator pt-3">
              <p className="text-xs text-muted">Código de un solo uso</p>
              <p className="mt-1 font-mono text-sm">{lastInviteCode}</p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!lastInviteCode) return;
                  void navigator.clipboard
                    .writeText(lastInviteCode)
                    .then(() => toast.success("Código copiado"))
                    .catch(() => toast.danger("No se pudo copiar."));
                }}
              >
                Copiar código
              </Button>
              <p className="mt-3 text-xs text-muted">Enlace de acceso</p>
              <p className="mt-1 break-all font-mono text-sm">
                {lastInviteUrl}
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(lastInviteUrl)
                    .then(() => toast.success("Enlace copiado"))
                    .catch(() => toast.danger("No se pudo copiar."));
                }}
              >
                Copiar enlace
              </Button>
            </div>
          ) : null}

          {access.pending_invites.length > 0 ? (
            <div className="mt-4 border-t border-separator pt-3">
              <p className="text-xs text-muted">
                Códigos pendientes
              </p>
              <List as="ul" className="mt-2">
                {access.pending_invites.map((invite) => (
                  <List.Item key={invite.id} as="li" className="flex flex-wrap items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      {invite.email} · {storeName(invite.store_id)}
                      <span className="block text-xs text-muted">
                        Caduca el {new Date(invite.expires_at).toLocaleDateString("es-ES")}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyInviteId === invite.id}
                      onClick={() => void revokeInvite(invite.id)}
                    >
                      Revocar código
                    </Button>
                  </List.Item>
                ))}
              </List>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
