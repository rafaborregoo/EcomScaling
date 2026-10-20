"use client";

import { HeroBlock } from "@/components/trabajo-ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import { Badge, ButtonLink, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

/**
 * Los permisos vistos por el consultor: qué le deja hacer cada cliente. Solo
 * lectura (lo decide el propietario de cada cuenta; él lo edita en «Tu
 * consultor»). Es el destino del aviso «X ha cambiado tus permisos», que antes
 * no llevaba a ningún sitio donde verlos.
 */

type PermissionKey = "edit_config" | "manage_tasks" | "marketing_drafts" | "marketing_publish" | "invite_members";

const COPY: Record<PermissionKey, { label: string; detail: string; without: string }> = {
  edit_config: {
    label: "Costes, objetivos y alertas",
    detail: "Cambiar coste de producto, gastos fijos, objetivos de margen y reglas de alerta.",
    without: "Los ves, pero cualquier cambio lo hace su equipo.",
  },
  manage_tasks: {
    label: "Tareas y plan de trabajo",
    detail: "Crear, asignar y cerrar tareas, y editar Mi Camino y sus hitos.",
    without: "Solo puedes proponer tareas; el cliente las acepta o las rechaza.",
  },
  marketing_drafts: {
    label: "Borradores de marketing",
    detail: "Preparar campañas, emails y piezas en borrador. Nada sale hacia sus clientes.",
    without: "No puedes crear ni editar borradores en su cuenta.",
  },
  marketing_publish: {
    label: "Programar y enviar campañas",
    detail: "Programar y enviar campañas desde su Klaviyo.",
    without: "Preparas la campaña y el envío lo hace alguien de su equipo.",
  },
  invite_members: {
    label: "Invitar personas",
    detail: "Invitar a alguien a su cuenta, por ejemplo un diseñador o su gestoría.",
    without: "Las invitaciones las hace el propietario.",
  },
};
const KEYS = Object.keys(COPY) as PermissionKey[];

function changedLabel(updatedAt: string | null, by: string | null) {
  if (!updatedAt) return "Por defecto: nadie los ha cambiado";
  const date = new Date(updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return `Cambiado${by ? ` por ${by.split(" ")[0]}` : ""} el ${date}`;
}

/** Un cliente: qué puedes hacer, qué significa y qué pasa si no puedes. */
export function ConsultantOwnPermissions({ organizationId, storeName }: { organizationId: string; storeName: string }) {
  const query = useCachedQuery<{ permissions: Record<PermissionKey, boolean>; updated_at: string | null }>(
    `/v1/organizations/${organizationId}/consultant-permissions`,
  );
  const permissions = query.data?.permissions ?? null;
  return (
    <div className="space-y-4">
      <HeroBlock label="Tus permisos" title={`Lo que puedes hacer en ${storeName}`}>
        Lo decide el propietario de la cuenta y te avisamos cada vez que lo cambia. Si necesitas algo más, pídeselo por Mensajes.
      </HeroBlock>
      <Card
        title="Permisos"
        description={changedLabel(query.data?.updated_at ?? null, null)}
        actions={
          <ButtonLink href="/configuracion?section=permisos" size="sm" variant="ghost">
            Ver toda la cartera
          </ButtonLink>
        }
      >
        {query.error && !query.data ? (
          <ErrorBlock>No se pudieron cargar tus permisos.</ErrorBlock>
        ) : !permissions ? (
          <LoadingBlock label="Cargando permisos…" />
        ) : (
          <ul className="divide-y divide-separator">
            <li className="flex items-start justify-between gap-6 py-4 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Ver cifras, tareas, informes y conversaciones</p>
                <p className="mt-1 text-xs text-muted">Va con la vinculación: sin esto no podrías asesorar.</p>
              </div>
              <Badge tone="success">Siempre</Badge>
            </li>
            {KEYS.map((key) => (
              <li key={key} data-focus-id={`perm-${key}`} className="flex items-start justify-between gap-6 rounded-lg py-4 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{COPY[key].label}</p>
                  <p className="mt-1 text-xs text-muted">{permissions[key] ? COPY[key].detail : COPY[key].without}</p>
                </div>
                <Badge tone={permissions[key] ? "success" : "neutral"}>{permissions[key] ? "Puedes" : "No puedes"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type PortfolioPermissions = {
  clients: Array<{
    organization_id: string;
    name: string;
    permissions: Record<PermissionKey, boolean>;
    is_default: boolean;
    updated_at: string | null;
    updated_by_name: string | null;
  }>;
};

/** Toda la cartera: qué puedes hacer en cada cliente, en una tabla. */
export function ConsultantPortfolioPermissions() {
  const query = useCachedQuery<PortfolioPermissions>("/v1/consultant/permissions");
  const clients = query.data?.clients ?? [];
  const limited = clients.filter((client) => KEYS.some((key) => !client.permissions[key]));
  return (
    <div className="space-y-4">
      <HeroBlock
        label="Tus permisos"
        title={
          query.isLoading
            ? "Leyendo tus permisos…"
            : clients.length === 0
              ? "Aún no tienes clientes asignados"
              : limited.length === 0
                ? "Puedes hacerlo todo en todos tus clientes"
                : `En ${limited.length} de ${clients.length} clientes tienes algo restringido`
        }
      >
        Cada propietario decide qué puedes tocar en su cuenta y te avisamos cuando lo cambia. Ver sus cifras, tareas e informes va
        siempre con la vinculación.
      </HeroBlock>
      <Card title="Qué puedes hacer en cada cliente">
        {query.error && !query.data ? (
          <ErrorBlock>No se pudieron cargar tus permisos.</ErrorBlock>
        ) : query.isLoading ? (
          <LoadingBlock label="Cargando permisos…" />
        ) : clients.length === 0 ? (
          <EmptyState title="Sin clientes" hint="Cuando un cliente se vincule contigo, verás aquí lo que te deja hacer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Cliente</th>
                  {KEYS.map((key) => (
                    <th key={key} className="pb-2 text-center font-medium">
                      {COPY[key].label}
                    </th>
                  ))}
                  <th className="pb-2 text-right font-medium">Último cambio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {clients.map((client) => (
                  <tr key={client.organization_id} data-focus-id={client.organization_id}>
                    <td className="py-3 pr-4 font-medium">{client.name}</td>
                    {KEYS.map((key) => (
                      <td key={key} className="py-3 text-center">
                        <Badge tone={client.permissions[key] ? "success" : "neutral"}>
                          {client.permissions[key] ? "Puedes" : "No"}
                        </Badge>
                      </td>
                    ))}
                    <td className="py-3 text-right text-xs text-muted">
                      {client.is_default ? "Por defecto" : changedLabel(client.updated_at, client.updated_by_name)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Qué significa cada permiso">
        <dl className="grid gap-4 sm:grid-cols-2">
          {KEYS.map((key) => (
            <div key={key}>
              <dt className="text-sm font-medium text-foreground">{COPY[key].label}</dt>
              <dd className="mt-1 text-xs text-muted">
                {COPY[key].detail} Si no lo tienes: {COPY[key].without.charAt(0).toLowerCase() + COPY[key].without.slice(1)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
