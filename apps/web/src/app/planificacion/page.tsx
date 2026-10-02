"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { ModuleSummary } from "@/components/module-summary";
import { channelStyle } from "@/components/marketing-channel";
import { agendaSignal, sortAgenda } from "./agenda-signal";
import { PlanningPortfolio } from "./portfolio-view";
import { HeroBlock, heroPrimary } from "@/components/trabajo-ui";
import {
  Badge,
  Banner,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  List,
  LoadingBlock,
  Metric,
} from "@/components/ui";

type Metrics = {
  sales?: { net_sales?: number; orders_count?: number };
  financial?: { net_profit?: number };
  acquisition?: { roas?: number | null; cac?: number | null };
};
type Item = {
  id: string;
  title: string;
  channel: string;
  starts_at: string;
  status: string;
  blocked_reason?: string | null;
  marketing_draft_id?: string | null;
};
type Planning = {
  calendars?: Array<{ id: string; name: string; year: number }>;
  items?: Item[];
};
type Attention = { overdue?: Item[]; blocked?: Item[]; total?: number };
type Snapshot = {
  id: string;
  period_start: string;
  period_end: string;
  net_sales: number | null;
  roas: number | null;
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));

function PlanningContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const [metrics, setMetrics] = useState<Metrics>({});
  const [planning, setPlanning] = useState<Planning>({
    calendars: [],
    items: [],
  });
  const [attention, setAttention] = useState<Attention>({});
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // El Resumen es del consultor; el cliente tiene su agenda en Trabajo.
  useEffect(() => {
    if (!isConsultant) router.replace("/planificacion/calendario");
  }, [isConsultant, router]);

  useEffect(() => {
    if (!organizationId || !isConsultant) {
      setLoading(false);
      return;
    }
    const scope = connectionId
      ? `?storeId=${encodeURIComponent(connectionId)}`
      : "";
    const metricsQuery = connectionId
      ? `?days=30&connectionId=${encodeURIComponent(connectionId)}`
      : "?days=30";
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch(
        `/v1/organizations/${organizationId}/shopify/metrics${metricsQuery}`,
      ).then((r) => (r.ok ? r.json() : {})),
      apiFetch(
        `/v1/organizations/${organizationId}/meta/metrics${metricsQuery}`,
      ).then((r) => (r.ok ? r.json() : {})) as Promise<{
        acquisition?: Metrics["acquisition"];
      }>,
      apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning${scope}`,
      ).then((r) => (r.ok ? r.json() : {})),
      apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/attention${scope}`,
      ).then((r) => (r.ok ? r.json() : {})),
      apiFetch(
        `/v1/organizations/${organizationId}/kpi-snapshots${scope}`,
      ).then((r) => (r.ok ? r.json() : {})) as Promise<{
        snapshots?: Snapshot[];
      }>,
    ])
      .then(([shopify, meta, calendar, attentionPayload, snapshotPayload]) => {
        if (cancelled) return;
        setMetrics({ ...shopify, acquisition: meta.acquisition });
        setPlanning(calendar);
        setAttention(attentionPayload);
        setSnapshots(snapshotPayload.snapshots ?? []);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudo cargar el resumen de planificación.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId, isConsultant, organizationId]);

  // Antes esto ordenaba solo por fecha, asi que lo vencido y lo de mañana se
  // veian igual. `sortAgenda` pone delante lo que arde (ver agenda-signal.ts).
  const agenda = useMemo(
    () => sortAgenda(planning.items ?? []),
    [planning.items],
  );
  const upcoming = useMemo(() => agenda.slice(0, 8), [agenda]);
  // "Siguiente accion" tiene que mirar hacia delante: con lo vencido primero,
  // `agenda[0]` es lo mas atrasado, que es justo lo contrario.
  const nextUp = useMemo(
    () =>
      agenda.find(
        (item) => !["blocked", "overdue"].includes(agendaSignal(item).state),
      ) ?? null,
    [agenda],
  );
  const attentionCount =
    attention.total ??
    (attention.overdue?.length ?? 0) + (attention.blocked?.length ?? 0);
  // Acciones de un canal que produce pieza y todavía sin borrador enlazado:
  // el hueco entre planificar y tener con qué salir.
  const withoutPiece = agenda.filter(
    (item) =>
      ["Email", "Meta", "Instagram"].includes(item.channel) &&
      !item.marketing_draft_id,
  ).length;
  const money = (value?: number | null) =>
    value == null ? "—" : formatMoney(value);
  // Una sola cosa que decidir, en este orden: lo atascado, lo que no tiene con
  // qué salir, el tracking sin capturar y, si todo está al día, lo siguiente.
  const decision =
    attentionCount > 0
      ? {
          title: `${attentionCount} ${attentionCount === 1 ? "acción vencida o parada" : "acciones vencidas o paradas"}`,
          body: "Reprográmalas o desbloquéalas antes de planificar más.",
          cta: "Abrir agenda",
          href: "/planificacion/calendario",
        }
      : withoutPiece > 0
        ? {
            title: `${withoutPiece} ${withoutPiece === 1 ? "acción sin pieza escrita" : "acciones sin pieza escrita"}`,
            body: "Email, Meta o Instagram planificados sin borrador en Marketing.",
            cta: "Ir a Marketing",
            href: "/marketing?section=crear",
          }
        : !snapshots[0]
          ? {
              title: "Falta capturar el tracking",
              body: "Sin un periodo cerrado no hay con qué comparar.",
              cta: "Capturar tracking",
              href: "/planificacion/tracking",
            }
          : {
              title: nextUp ? nextUp.title : "La agenda no tiene nada por delante",
              body: nextUp ? dateLabel(nextUp.starts_at) : "Planifica la siguiente acción.",
              cta: "Abrir agenda",
              href: "/planificacion/calendario",
            };

  if (!isConsultant) return null;
  // Sin cliente activo la respuesta ya no es "elige uno": es DECIR cuál elegir.
  if (!organizationId) return <PlanningPortfolio />;
  if (loading) return <LoadingBlock label="Cargando resumen…" />;

  return (
    <div className="space-y-6">
      <Heading>Resumen</Heading>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <HeroBlock
        label="Siguiente decisión"
        title={decision.title}
        actions={
          <>
            <Link className={heroPrimary} href={decision.href}>
              {decision.cta}
            </Link>
            <Link href="/planificacion/recomendaciones">Recomendaciones IA</Link>
          </>
        }
      >
        {decision.body}
      </HeroBlock>
      {/* Lo que hay que saber antes de decidir qué planificar: cómo va el
          negocio, qué rinde la inversión y cuánto trabajo hay atascado. Las
          mismas cifras viajan al Consultor IA como vista actual. */}
      <ModuleSummary
        period="Últimos 30 días"
        metrics={[
          { label: "Ventas netas", value: money(metrics.sales?.net_sales) },
          {
            label: "Pedidos",
            value: metrics.sales?.orders_count?.toLocaleString("es-ES") ?? "—",
          },
          {
            label: "ROAS",
            value:
              metrics.acquisition?.roas == null
                ? "—"
                : `${metrics.acquisition.roas.toFixed(2)}x`,
          },
          {
            label: "Beneficio neto",
            value: money(metrics.financial?.net_profit),
            tone:
              metrics.financial?.net_profit != null &&
              metrics.financial.net_profit < 0
                ? "danger"
                : "default",
          },
          {
            label: "Acciones a revisar",
            value: attentionCount.toLocaleString("es-ES"),
            tone: attentionCount > 0 ? "warn" : "success",
            hint:
              attentionCount > 0 ? "Vencidas o bloqueadas" : "Agenda al día",
          },
          {
            label: "Siguiente acción",
            value: nextUp ? dateLabel(nextUp.starts_at) : "Sin planificar",
            hint: nextUp?.title ?? "La agenda no tiene nada por delante",
            tone: nextUp ? "default" : "warn",
          },
        ]}
        notes={
          snapshots[0]
            ? `Último tracking: ${snapshots[0].period_start} → ${snapshots[0].period_end}.`
            : "Todavía no hay snapshots de tracking registrados."
        }
      />
      {/* Una sola agenda, ordenada por lo que arde. La tarjeta "Estado de la
          agenda" que habia al lado repetia el KPI de arriba con un numero
          grande y un banner: el mismo dato tres veces y ninguna acción. */}
      <Card
        title="Agenda"
        actions={
          <ButtonLink href="/planificacion/calendario" variant="secondary">
            Abrir agenda
          </ButtonLink>
        }
      >
        {upcoming.length ? (
          <List as="ul">
            {upcoming.map((item) => {
              const signal = agendaSignal(item);
              const style = channelStyle(item.channel);
              const needsPiece =
                ["Email", "Meta", "Instagram"].includes(item.channel) &&
                !item.marketing_draft_id;
              return (
                <List.Item
                  as="li"
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span
                    aria-hidden
                    className={`h-8 w-1 shrink-0 ${style.fill}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {dateLabel(item.starts_at)} · {style.label}
                      {item.blocked_reason ? ` · ${item.blocked_reason}` : ""}
                    </span>
                  </span>
                  {needsPiece ? (
                    <Badge
                      tone="warn"
                      title="Sin borrador de Marketing enlazado"
                    >
                      Sin pieza
                    </Badge>
                  ) : null}
                  <Badge tone={signal.tone}>{signal.label}</Badge>
                </List.Item>
              );
            })}
          </List>
        ) : (
          <EmptyState
            title="La agenda está vacía"
            hint="Abre el calendario para planificar la primera acción, o pide un plan de campañas en Marketing."
          />
        )}
        {agenda.length > upcoming.length ? (
          <p className="mt-3 text-xs text-muted">
            {agenda.length - upcoming.length} acciones más en el calendario.
          </p>
        ) : null}
      </Card>
        <Card
          title="Último tracking"
          actions={
            <ButtonLink href="/planificacion/tracking" variant="secondary">
              Ver tracking
            </ButtonLink>
          }
        >
          {snapshots[0] ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Periodo"
                value={`${snapshots[0].period_start} → ${snapshots[0].period_end}`}
              />
              <Metric label="Ventas" value={money(snapshots[0].net_sales)} />
              <Metric
                label="ROAS"
                value={
                  snapshots[0].roas == null ? "—" : `${snapshots[0].roas}x`
                }
              />
            </div>
          ) : (
            <Banner tone="warn">Todavía no hay snapshots registrados.</Banner>
          )}
        </Card>
    </div>
  );
}

export default function PlanningPage() {
  return (
    <PortalShell title="Resumen">
      {(bootstrap) => <PlanningContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
