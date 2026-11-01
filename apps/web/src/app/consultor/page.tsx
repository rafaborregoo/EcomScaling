"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  cn,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  Select,
  Tabs,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";
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
import { Captacion } from "./captacion";
import {
  AccessPanel,
  NewClientForm,
  OwnStoreShortcut,
  PortfolioManagement,
  StoresPanel,
  type ConsultantOrganization,
} from "./gestion";

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
    <Card>
      <CardHeader>
        <CardKicker>{today}</CardKicker>
        <CardTitle>Tu mesa de hoy</CardTitle>
        <CardAction><Field label="Periodo de las cifras">
          <Select
            value={String(windowDays)}
            onChange={(value) => onWindowChange(Number(value))}
            options={WINDOW_OPTIONS.map((days) => ({
              value: String(days),
              label: `Últimos ${days} días`,
            }))}
          />
        </Field></CardAction>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

// Clientes tiene tres secciones. Captacion absorbe lo que era /consultor/referidos
// ("Mi codigo"): el codigo de referido, los leads y los referidos.
const CARTERA_TABS = [
  { key: "mesa", label: "Mesa de hoy", href: "/consultor" },
  { key: "gestion", label: "Gestión", href: "/consultor?tab=gestion" },
  { key: "captacion", label: "Captación", href: "/consultor?tab=captacion" },
] as const;
type CarteraTab = (typeof CARTERA_TABS)[number]["key"];

function parseCarteraTab(value: string | null): CarteraTab {
  return value === "gestion" || value === "captacion" ? value : "mesa";
}

function CarteraTabs({ active }: { active: CarteraTab }) {
  const router = useRouter();
  return (
    <Tabs
      items={CARTERA_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
      value={active}
      onChange={(key) => {
        const tab = CARTERA_TABS.find((item) => item.key === key);
        if (tab && tab.key !== active) router.push(tab.href);
      }}
    />
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
  const searchParams = useSearchParams();
  const focusId = searchParams.get("organizationId") ?? "";
  const tab = parseCarteraTab(searchParams.get("tab"));
  // El periodo vive en la URL (?dias=), como la pestaña: sobrevive a recargar y
  // a compartir el enlace.
  const router = useRouter();
  const daysParam = Number(searchParams.get("dias"));
  const windowDays = (WINDOW_OPTIONS as readonly number[]).includes(daysParam) ? daysParam : 30;
  const setWindowDays = useCallback(
    (days: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (days === 30) params.delete("dias");
      else params.set("dias", String(days));
      const query = params.toString();
      router.replace(query ? `/consultor?${query}` : "/consultor", { scroll: false });
    },
    [router, searchParams],
  );
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("todo");

  const organizationsQuery = useCachedQuery<{
    organizations?: ConsultantOrganization[];
    attention_degraded?: boolean;
  }>("/v1/consultant/organizations");
  const organizations = (organizationsQuery.data?.organizations ?? []).filter(
    (organization) => !organization.is_own_store,
  );

  // Un solo contrato para las dos vistas: sin `organizationId` es la cartera,
  // con el es la mesa de ese cliente (y el servidor responde 403 si no es
  // suyo -- aqui no se filtra nada a mano).
  const workbenchQuery = useCachedQuery<DailyWorkbench>(
    `/v1/consultant/daily-workbench?days=${windowDays}${
      focusId && tab === "mesa" ? `&organizationId=${encodeURIComponent(focusId)}` : ""
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
    if (workbenchQuery.errorCode === "organization_access_denied") {
      setOrganizationId("");
    }
  }, [workbenchQuery.errorCode, setOrganizationId]);

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
    if (tab === "captacion") {
      return (
        <div className="portal-page space-y-6">
          <CarteraTabs active={tab} />
          <Captacion />
        </div>
      );
    }
    return (
      <div className="portal-page space-y-6">
        <CarteraTabs active="gestion" />
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
  if (tab === "mesa" && focusId && client && workbench) {
    return (
      <div className="portal-page space-y-6">
        <DegradedSources sources={workbench.sources} onRetry={reload} />
        <ClientDesk
          client={client}
          onboarding={workbench.onboarding?.find((item) => item.organization_id === client.organization_id)}
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

  if (tab === "mesa" && focusId && workbenchQuery.isLoading) {
    return <AsyncState status="loading" loadingLabel="Abriendo el cliente..." />;
  }

  if (tab !== "mesa") {
    return (
      <div className="portal-page space-y-6">
        <CarteraTabs active={tab} />
        {tab === "captacion" ? (
          <Captacion />
        ) : (
          <PortfolioManagement
            key={focusId}
            initialOrganizationId={focusId}
            organizations={organizations}
            workbench={workbenchQuery.error ? undefined : workbench}
            isPlatformAdmin={isPlatformAdmin}
            canManageStores={canManageStores}
            onChanged={reload}
          />
        )}
      </div>
    );
  }

  // --- Cartera -------------------------------------------------------------
  return (
    <div className="portal-page space-y-6">
      <CarteraTabs active="mesa" />
      {organizationsQuery.data?.attention_degraded ? (
        <ErrorBlock>
          No se pudo calcular qué clientes piden atención. Las puntuaciones de abajo pueden estar incompletas; recarga en unos segundos.
        </ErrorBlock>
      ) : null}

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
                onDecided={reload}
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

    </div>
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
