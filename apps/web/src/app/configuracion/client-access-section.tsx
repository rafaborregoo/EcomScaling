"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
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
};

type ClientAccess = {
  members: Member[];
  consultants: ConsultantRow[];
  pending_invites: PendingInvite[];
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
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

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
          }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        invite: { access_url: string };
      };
      // El enlace se enseña y no se manda por correo: el reparto lo hace el
      // consultor, igual que en el alta de un cliente.
      setLastInviteUrl(payload.invite.access_url);
      setEmail("");
      setFullName("");
      toast.success("Invitación creada", {
        description: "Copia el enlace y mándaselo tú.",
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
    body: { role?: string; isActive?: boolean },
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

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!access) return <LoadingBlock label="Cargando accesos…" />;

  const activeMembers = access.members.filter((member) => member.is_active);

  return (
    <div className="space-y-4">
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
          description="Se crea su cuenta y un enlace de acceso. El correo no se envía solo: el enlace lo repartes tú."
        >
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
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting ? "Invitando…" : "Invitar"}
            </Button>
          </form>

          {lastInviteUrl ? (
            <div className="mt-4 border-t border-separator pt-3">
              <p className="text-xs text-muted">Enlace de acceso</p>
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
                Invitaciones sin usar:{" "}
                {access.pending_invites
                  .map(
                    (invite) =>
                      `${invite.email} (caduca el ${new Date(invite.expires_at).toLocaleDateString("es-ES")})`,
                  )
                  .join(" · ")}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
