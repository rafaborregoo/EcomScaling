"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";

// Navegador de tiendas del consultor: sus tiendas propias (membership real) y
// las de su cartera (consultant_assignment), cada una enlazando al dashboard de
// esa tienda. La gestión de cartera (altas, suscripción, borrado) sigue en
// /consultor; aquí solo se pivota entre tiendas.

type OwnStore = {
  organization_id: string;
  display_name: string;
  status: string;
  currency_code: string;
  net_sales: number;
  orders: number;
  meta_spend: number;
  roas: number | null;
};

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

// Alta y edición comparten campos (nombre + moneda); `store` presente = editar.
function OwnStoreForm({
  store,
  onDone,
}: {
  store?: OwnStore;
  onDone: (result: { id: string; name: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(store?.display_name ?? "");
  const [currencyCode, setCurrencyCode] = useState(store?.currency_code ?? "EUR");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(store);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        isEdit
          ? `/v1/consultant/organizations/${store!.organization_id}`
          : "/v1/consultant/own-stores",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            currency_code: currencyCode,
          }),
        },
      );
      if (response.ok) {
        toast.success(isEdit ? "Tienda actualizada." : "Tienda creada.");
        if (isEdit) {
          onDone({ id: store!.organization_id, name: displayName });
        } else {
          const payload = (await response.json()) as {
            organization: { id: string };
          };
          onDone({ id: payload.organization.id, name: displayName });
        }
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        `No se pudo ${isEdit ? "actualizar" : "crear"} la tienda. Revisa la conexión e inténtalo de nuevo.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 border-b border-separator pb-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
    >
      <Field label="Nombre de la tienda">
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Mi tienda"
          required
        />
      </Field>
      <Field label="Moneda">
        <Input
          value={currencyCode}
          onChange={(event) =>
            setCurrencyCode(event.target.value.toUpperCase().slice(0, 3))
          }
          maxLength={3}
        />
      </Field>
      <Button type="submit" size="sm" disabled={isSaving}>
        {isSaving
          ? "Guardando..."
          : isEdit
            ? "Guardar cambios"
            : "Crear tienda"}
      </Button>
      {error ? (
        <div className="sm:col-span-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}
    </form>
  );
}

function OwnStoresCard() {
  const { setOrganizationId } = useActiveOrganization();
  const [stores, setStores] = useState<OwnStore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnStore | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStores = useCallback(async () => {
    try {
      const response = await apiFetch("/v1/consultant/own-stores");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { stores: OwnStore[] };
      setStores(payload.stores);
      setError(null);
    } catch {
      setError(
        "No se pudieron cargar tus tiendas. Revisa la conexión e inténtalo de nuevo.",
      );
    }
  }, []);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  // Tras crear una tienda: la ponemos activa y arrancamos el onboarding de
  // integraciones (conectar Shopify/Meta/Klaviyo) desde /integraciones. Recarga
  // completa para que el shell recoja la membership nueva del bootstrap.
  function startOnboarding(organizationId: string, name: string) {
    setOrganizationId(organizationId);
    window.location.assign(
      `/integraciones?welcome=${encodeURIComponent(name)}`,
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${deleteTarget.organization_id}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        toast.success("Tienda marcada para borrado.");
        setDeleteTarget(null);
        void loadStores();
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError("No se pudo borrar la tienda. Reintenta.");
    } finally {
      setIsDeleting(false);
    }
  }

  const addForm = (
    <OwnStoreForm
      onDone={({ id, name }) => {
        setIsAdding(false);
        startOnboarding(id, name);
      }}
    />
  );

  // Sin tiendas propias: no ocupamos una card entera, solo el disparador.
  if (stores !== null && stores.length === 0 && !error) {
    return isAdding ? (
      <Card title="Añadir mi tienda">
        {addForm}
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAdding(false)}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    ) : (
      <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
        Añadir mi tienda
      </Button>
    );
  }

  return (
    <Card
      title="Mis tiendas"
      description="Tiendas de tu propiedad, con sus totales de los últimos 30 días."
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsAdding((value) => !value)}
        >
          {isAdding ? "Cancelar" : "Añadir mi tienda"}
        </Button>
      }
    >
      {isAdding ? <div className="mb-4">{addForm}</div> : null}
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : stores === null ? (
        <LoadingBlock label="Cargando tus tiendas..." />
      ) : (
        <List as="ul">
          {stores.map((store) => (
            <List.Item
              as="li"
              key={store.organization_id}
              className="py-3 first:pt-1 last:pb-1"
            >
              {editingId === store.organization_id ? (
                <div className="space-y-2">
                  <OwnStoreForm
                    store={store}
                    onDone={() => {
                      setEditingId(null);
                      void loadStores();
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Avatar name={store.display_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <OpenStoreLink organizationId={store.organization_id}>
                        {store.display_name}
                      </OpenStoreLink>
                      <Badge
                        tone={store.status === "active" ? "success" : "neutral"}
                      >
                        {statusLabel(store.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatMoney(store.net_sales, store.currency_code)} ·{" "}
                      {store.orders} {store.orders === 1 ? "pedido" : "pedidos"}
                      {" · "}
                      {store.roas == null
                        ? "ROAS —"
                        : `ROAS ${store.roas.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <OpenStoreButton organizationId={store.organization_id} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(store.organization_id)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(store)}
                    >
                      Borrar
                    </Button>
                  </div>
                </div>
              )}
            </List.Item>
          ))}
        </List>
      )}
      {deleteTarget ? (
        <ConfirmDangerDialog
          title={`Borrar la tienda "${deleteTarget.display_name}"`}
          note="Borrado con 30 días de gracia para restaurarla."
          confirmPhrase={deleteTarget.display_name}
          actionLabel="Borrar tienda"
          isBusy={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </Card>
  );
}

function ClientStoresCard({
  token,
  excludeIds,
}: {
  token: string;
  excludeIds: Set<string>;
}) {
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

  const clients = (organizations ?? []).filter(
    (org) => !excludeIds.has(org.id),
  );

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
      ) : clients.length === 0 ? (
        <EmptyState
          title="Aún no llevas clientes"
          hint="Esto es tu cartera, aparte de tus tiendas propias de arriba. Da de alta un cliente o espera a que te asignen una organización."
          action={<Link href="/consultor">Dar de alta un cliente</Link>}
        />
      ) : (
        <List as="ul">
          {clients.map((organization) => {
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
      {(bootstrap, token) => {
        // Las tiendas propias (membership real) no son cartera: se excluyen de
        // "Clientes" aunque el backend las devuelva (p. ej. platform_admin ve
        // todas las organizaciones).
        const ownStoreIds = new Set(
          bootstrap.memberships
            .filter((membership) => membership.accessSource === "membership")
            .map((membership) => membership.organization_id),
        );
        return (
          <div className="portal-page space-y-6">
            <OwnStoresCard />
            <ClientStoresCard token={token} excludeIds={ownStoreIds} />
          </div>
        );
      }}
    </PortalShell>
  );
}
