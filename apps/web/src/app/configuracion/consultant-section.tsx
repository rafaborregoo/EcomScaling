"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import NextLink from "next/link";
import { HeroBlock, heroPrimary, heroSecondary } from "@/components/trabajo-ui";
import { ButtonLink, EmptyState, LoadingBlock, Switch, toast, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { activityLabel, type ActivityItem } from "./activity-labels";

/**
 * Tu consultor: quién es, qué puede tocar en tu cuenta (lo decide el
 * propietario) y lo último que ha cambiado. La API aplica los permisos en la
 * guarda de escritura (org-access-guard.ts), no solo esta pantalla.
 */

type PermissionKey = "edit_config" | "manage_tasks" | "marketing_drafts" | "marketing_publish" | "invite_members";

const PERMISSIONS: Array<{ key: PermissionKey; label: string; hint: string }> = [
  { key: "edit_config", label: "Editar costes, objetivos y alertas", hint: "Para que el margen y los avisos reflejen tu negocio real." },
  { key: "manage_tasks", label: "Crear, asignar y cerrar tareas", hint: "También el plan de trabajo y sus hitos." },
  { key: "marketing_drafts", label: "Preparar campañas y piezas en borrador", hint: "Nada sale hacia tus clientes: el borrador espera." },
  { key: "marketing_publish", label: "Programar y enviar campañas en Klaviyo", hint: "Sin esto, el envío lo hace alguien de tu equipo." },
  { key: "invite_members", label: "Invitar personas a tu cuenta", hint: "Por ejemplo a un diseñador o a tu gestoría." },
];

type PermissionsResponse = { permissions: Record<PermissionKey, boolean>; can_edit: boolean };

function PermissionRow({
  label,
  hint,
  on,
  locked = false,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  locked?: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`w-16 text-right text-xs ${on ? "font-medium text-success" : "text-muted"}`}>
          {locked ? "Siempre" : on ? "Puede" : "No puede"}
        </span>
        <Switch aria-label={label} isSelected={on} isDisabled={locked || disabled} onChange={onChange}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
    </li>
  );
}

export function ConsultantSection({ organizationId, canSeeActivity }: { organizationId: string; canSeeActivity: boolean }) {
  const { consultant, resolved } = useAssignedConsultant(organizationId);
  const path = `/v1/organizations/${organizationId}/consultant-permissions`;
  const permissionsQuery = useCachedQuery<PermissionsResponse>(path);
  const activity = useCachedQuery<{ items: ActivityItem[] }>(
    canSeeActivity ? `/v1/organizations/${organizationId}/activity?limit=50` : null,
  );
  const [saving, setSaving] = useState<PermissionKey | null>(null);
  const [local, setLocal] = useState<Record<PermissionKey, boolean> | null>(null);
  const permissions = local ?? permissionsQuery.data?.permissions ?? null;

  async function toggle(key: PermissionKey, value: boolean) {
    if (!permissions) return;
    setSaving(key);
    setLocal({ ...permissions, [key]: value });
    try {
      const response = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        setLocal(null);
        toast.danger(await readApiError(response));
        return;
      }
      permissionsQuery.reload();
      toast.success(value ? "Permiso dado" : "Permiso quitado");
    } catch {
      setLocal(null);
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setSaving(null);
    }
  }

  if (!resolved) return <LoadingBlock label="Cargando tu consultor…" />;

  if (!consultant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tu consultor</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Todavía no tienes consultor"
            hint="Chats se activa solo cuando te asignen uno. Mientras tanto, el copiloto responde sobre tu tienda."
          />
        </CardContent>
      </Card>
    );
  }

  const changes = (activity.data?.items ?? []).filter((item) => item.actor?.kind === "consultant").slice(0, 5);
  const canEdit = permissionsQuery.data?.can_edit ?? false;

  return (
    <div className="space-y-6">
      <HeroBlock
        label="Tu consultor"
        title={consultant.full_name ?? "Tu consultor"}
        actions={
          <>
            <NextLink href="/mensajes" className={heroPrimary}>
              Escribir
            </NextLink>
            <NextLink href="/llamadas" className={heroSecondary}>Ver llamadas</NextLink>
          </>
        }
      >
        Lleva tu cuenta. Aquí decides qué puede cambiar sin pedirte permiso.
      </HeroBlock>

      <Card>
        <CardHeader>
          <CardTitle>Qué puede hacer tu consultor</CardTitle>
          <CardDescription>{canEdit
            ? "Los cambios se aplican al momento y quedan en la actividad."
            : "Solo el propietario de la cuenta puede cambiarlo. Tú lo ves, pero no lo editas."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!permissions ? (
            <LoadingBlock label="Cargando permisos…" />
          ) : (
            <ul className="divide-y divide-separator">
              <PermissionRow label="Ver cifras, tareas, informes y conversaciones" hint="Sin esto no puede asesorarte: va con la vinculación." on locked />
              {PERMISSIONS.map((permission) => (
                <PermissionRow
                  key={permission.key}
                  label={permission.label}
                  hint={permission.hint}
                  on={permissions[permission.key]}
                  disabled={!canEdit || saving !== null}
                  onChange={(value) => void toggle(permission.key, value)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canSeeActivity ? (
        <Card>
          <CardHeader>
            <CardTitle>Lo último que ha cambiado tu consultor</CardTitle>
            <CardAction><ButtonLink href="/configuracion?section=seguridad#actividad" size="sm" variant="ghost">
              Ver toda la actividad
            </ButtonLink></CardAction>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? (
              <LoadingBlock label="Leyendo la actividad…" />
            ) : changes.length === 0 ? (
              <EmptyState size="sm" title="Sin cambios recientes de tu consultor" />
            ) : (
              <ul className="grid gap-3">
                {changes.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 border-l-2 border-separator pl-3 text-sm">
                    <span>{activityLabel(item.action)}</span>
                    <span className="text-xs text-muted">
                      {new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
