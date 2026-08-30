"use client";

import { type ReactNode, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Link,
  List,
  LoadingBlock,
} from "@/components/ui";

// Navegador de tiendas del consultor: sus tiendas propias (membership real) y
// las de su cartera (consultant_assignment), cada una enlazando al dashboard de
// esa tienda. La gestión de cartera (altas, suscripción, borrado) sigue en
// /consultor; aquí solo se pivota entre tiendas.

type ConsultantOrganization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  store_count: number;
  subscription: { plan_code: string; status: string } | null;
  attention: {
    open_alerts: number;
    critical_alerts: number;
    open_tasks: number;
    overdue_tasks: number;
    score: number;
  };
};

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

function statusLabel(status: string) {
  return ORGANIZATION_STATUS_LABELS[status] ?? status;
}

// Mismos tramos que attentionBadge en /consultor y el rollup del backend.
function attentionBadge(score: number) {
  if (score >= 15) return { label: "Urgente", tone: "danger" as const };
  if (score >= 5) return { label: "Revisar", tone: "warn" as const };
  if (score > 0) return { label: "Vigilar", tone: "neutral" as const };
  return { label: "Al día", tone: "success" as const };
}

function OpenStoreLink({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  const { setOrganizationId } = useActiveOrganization();
  return (
    <Link
      href="/dashboard"
      onClick={() => setOrganizationId(organizationId)}
      className="font-medium no-underline hover:text-brand hover:no-underline"
    >
      {children}
    </Link>
  );
}

function OpenStoreButton({ organizationId }: { organizationId: string }) {
  const { setOrganizationId } = useActiveOrganization();
  return (
    <Link href="/dashboard" onClick={() => setOrganizationId(organizationId)}>
      <Button variant="secondary" size="sm">
        Abrir
      </Button>
    </Link>
  );
}

function OwnStoresCard({
  memberships,
}: {
  memberships: BootstrapResponse["memberships"];
}) {
  const ownStores = memberships.filter(
    (membership) => membership.accessSource === "membership",
  );

  if (ownStores.length === 0) {
    return null;
  }

  return (
    <Card
      title="Mis tiendas"
      description="Tiendas de tu propiedad. Ábrelas para ver su dashboard y sus datos."
    >
      <List as="ul">
        {ownStores.map((membership) => {
          const status =
            membership.organization?.status ?? "active";
          return (
            <List.Item
              as="li"
              key={membership.organization_id}
              className="py-3 first:pt-1 last:pb-1"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={
                    membership.organization?.display_name ??
                    membership.organization_id
                  }
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <OpenStoreLink organizationId={membership.organization_id}>
                      {membership.organization?.display_name ??
                        membership.organization_id}
                    </OpenStoreLink>
                    <Badge tone={status === "active" ? "success" : "neutral"}>
                      {statusLabel(status)}
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0">
                  <OpenStoreButton organizationId={membership.organization_id} />
                </div>
              </div>
            </List.Item>
          );
        })}
      </List>
    </Card>
  );
}

function ClientStoresCard({ token }: { token: string }) {
  const [organizations, setOrganizations] = useState<
    ConsultantOrganization[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch("/v1/consultant/organizations");
        if (!response.ok) {
          if (!cancelled) setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          organizations: ConsultantOrganization[];
        };
        if (!cancelled) {
          setOrganizations(payload.organizations);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError(
            "No se pudieron cargar los clientes. Revisa la conexión e inténtalo de nuevo.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Card
      title="Clientes"
      description="Tiendas de tu cartera, ordenadas por la que más atención necesita."
      actions={
        <Link
          href="/consultor"
          className="text-xs text-muted no-underline hover:text-brand hover:no-underline"
        >
          Gestionar cartera
        </Link>
      }
    >
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : organizations === null ? (
        <LoadingBlock label="Cargando clientes..." />
      ) : organizations.length === 0 ? (
        <EmptyState
          title="Aún no tienes clientes asignados"
          hint="Cuando se te asigne una organización como consultor, aparecerá aquí."
        />
      ) : (
        <List as="ul">
          {organizations.map((organization) => {
            const badge = attentionBadge(organization.attention.score);
            return (
              <List.Item
                as="li"
                key={organization.id}
                className="py-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={organization.display_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <OpenStoreLink organizationId={organization.id}>
                        {organization.display_name}
                      </OpenStoreLink>
                      <Badge
                        tone={badge.tone}
                        title={`Puntuación: ${organization.attention.score}`}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {organization.slug} · {statusLabel(organization.status)} ·{" "}
                      {organization.store_count}{" "}
                      {organization.store_count === 1 ? "tienda" : "tiendas"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {organization.attention.open_alerts} alertas
                      {organization.attention.critical_alerts > 0 ? (
                        <span className="text-danger">
                          {" "}
                          · {organization.attention.critical_alerts} críticas
                        </span>
                      ) : null}
                      {" · "}
                      {organization.attention.open_tasks} tareas
                      {organization.attention.overdue_tasks > 0 ? (
                        <span className="text-danger">
                          {" "}
                          · {organization.attention.overdue_tasks} vencidas
                        </span>
                      ) : null}
                      {" · "}
                      {organization.subscription
                        ? `${organization.subscription.plan_code} · ${
                            SUBSCRIPTION_STATUS_LABELS[
                              organization.subscription.status
                            ] ?? organization.subscription.status
                          }`
                        : "Sin plan"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <OpenStoreButton organizationId={organization.id} />
                  </div>
                </div>
              </List.Item>
            );
          })}
        </List>
      )}
    </Card>
  );
}

export default function TiendasPage() {
  return (
    <PortalShell title="Tiendas">
      {(bootstrap, token) => (
        <div className="portal-page space-y-6">
          <OwnStoresCard memberships={bootstrap.memberships} />
          <ClientStoresCard token={token} />
        </div>
      )}
    </PortalShell>
  );
}
