"use client";

import { Select } from "@/components/ui";
import { Banner } from "@/components/ui/banner";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleMore } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import Link from "next/link";
import type { PortfolioHealthRow } from "../consultor/workbench";
import { fmtCurrency, fmtNum } from "./client-pulse-model";
import { roasPosition } from "./consultant-portfolio-model";
import type {
  MatrixKey,
  MatrixRow,
  PortfolioStore,
} from "./consultant-portfolio-model";
import s from "./consultant-portfolio.module.css";

const STATUS = {
  urgente: { label: "Urgente", description: "Requiere intervención" },
  revisar: { label: "Revisar", description: "Pendiente de tu revisión" },
  vigilar: { label: "Vigilar", description: "Mantener en seguimiento" },
  al_dia: {
    label: "Al día",
    description: "Sin asuntos prioritarios detectados",
  },
};

export function PortfolioClients({
  rows,
  storesBy,
  unreadBy,
  onSelect,
}: {
  rows: PortfolioHealthRow[];
  storesBy: Map<string, number>;
  unreadBy: Map<string, number>;
  onSelect: (id: string) => void;
}) {
  const [status, setStatus] = useState<keyof typeof STATUS | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [highlightedClient, setHighlightedClient] = useState<string | null>(null);
  const query = search.trim().toLocaleLowerCase("es");
  const matched = rows.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      row.organization_name.toLocaleLowerCase("es").includes(query),
  );
  const shown = expanded ? matched : matched.slice(0, 6);
  const renderClient = (row: (typeof matched)[number]) => (
            <li
              key={row.organization_id}
              className="task-lift"
              data-status={row.status}
              data-lift-selected={highlightedClient === row.organization_id || undefined}
              onPointerDown={() => setHighlightedClient(row.organization_id)}
              onFocusCapture={() => setHighlightedClient(row.organization_id)}
            >
              <div className={s.clientIdentity}>
                <span className={s.statusDot} aria-hidden="true" />
                <div>
                  <button
                    type="button"
                    onClick={() => onSelect(row.organization_id)}
                  >
                    {row.organization_name}
                  </button>
                  <p>
                    {storesBy.has(row.organization_id)
                      ? `${fmtNum(storesBy.get(row.organization_id) ?? 0)} ${storesBy.get(row.organization_id) === 1 ? "tienda" : "tiendas"}`
                      : "Tiendas pendientes de cargar"}
                    {unreadBy.get(row.organization_id)
                      ? ` · ${unreadBy.get(row.organization_id)} mensajes sin leer`
                      : ""}
                  </p>
                </div>
                <span className={s.statusBadge}>
                  {STATUS[row.status].label}
                </span>
              </div>
              <div className={s.clientNext}>
                <p>
                  {row.next_action?.title ??
                    row.data_issues[0] ??
                    row.next_event?.label ??
                    STATUS[row.status].description}
                </p>
                <span>
                  {fmtNum(row.open_tasks)}{" "}
                  {row.open_tasks === 1 ? "tarea abierta" : "tareas abiertas"} ·{" "}
                  {fmtNum(row.open_alerts)}{" "}
                  {row.open_alerts === 1 ? "alerta" : "alertas"}
                  {row.data_issues.length
                    ? ` · ${row.data_issues.length} ${row.data_issues.length === 1 ? "incidencia" : "incidencias"} de datos`
                    : ""}
                </span>
              </div>
              <div className={s.clientActions}>
                {row.next_action ? (
                  <Link className={buttonVariants()} href={row.next_action.href}>
                    {row.next_action.action_label}
                  </Link>
                ) : null}
                <button
                  type="button"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  onClick={() => onSelect(row.organization_id)}
                >
                  Abrir cliente
                </button>
              </div>
            </li>
          );

  return (
    <section className={s.clients} aria-labelledby="mesa-clientes">
      <div className={s.sectionHead}>
        <div>
          <h2 id="mesa-clientes">Clientes, por prioridad</h2>
          <p>La siguiente acción y el contexto de cada cuenta.</p>
        </div>
        <label className={s.search}>
          <span>Buscar cliente</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setExpanded(false);
            }}
            placeholder="Nombre del cliente"
          />
        </label>
      </div>
      <ToggleGroup
        aria-label="Filtrar clientes por estado"
        className={s.clientFilters}
        spacing={1.5}
        value={status}
        onValueChange={(key) => {
          setStatus(key);
          setExpanded(false);
        }}
      >
        <ToggleGroupItem value="all">
          Todos <span className="text-xs text-muted tabular-nums">{rows.length}</span>
        </ToggleGroupItem>
        {Object.entries(STATUS).map(([key, item]) => (
          <ToggleGroupItem key={key} value={key}>
            {item.label} <span className="text-xs text-muted tabular-nums">{rows.filter((row) => row.status === key).length}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className={s.resultCount} role="status">
        {shown.length} de {rows.length}{" "}
        {rows.length === 1 ? "cliente" : "clientes"}
      </p>
      {matched.length ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          {matched.length > 6 ? (
            <CollapsibleMore count={matched.length - 6} more={`Ver los ${matched.length} clientes`} less="Ver menos clientes" />
          ) : null}
          <ul className={s.clientList}>
            {matched.slice(0, 6).map(renderClient)}
          </ul>
          {matched.length > 6 ? (
            <CollapsibleContent>
              <ul className={`${s.clientList} ${s.clientListMore}`}>{matched.slice(6).map(renderClient)}</ul>
            </CollapsibleContent>
          ) : null}
        </Collapsible>
      ) : (
        <div className={s.empty}>
          <strong>
            {rows.length
              ? "No hay clientes con este filtro"
              : "Todavía no tienes clientes asignados"}
          </strong>
          <p>
            {rows.length
              ? "Prueba otro estado o busca por nombre."
              : "Los clientes aparecerán aquí cuando se asignen a tu cartera."}
          </p>
          {rows.length ? (
            <button
              type="button"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Ver todos los clientes
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

const SORT_LABELS: Record<MatrixKey, string> = {
  name: "Nombre",
  sales: "Ventas por moneda",
  orders: "Pedidos",
  roas: "ROAS Meta",
  cac: "CPA Meta por moneda",
  dep: "Dependencia Meta",
  email: "Campañas de email",
  emailRev: "Klaviyo por moneda",
  alerts: "Alertas",
};

function Metric({
  label,
  value,
  bad = false,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className={s.metric}>
      <dt>{label}</dt>
      <dd data-negative={bad || undefined}>
        {value === "—" ? "No disponible" : value}
      </dd>
    </div>
  );
}

export function PortfolioChannels({
  rows,
  sort,
  onSort,
  onSelect,
  unavailable,
}: {
  rows: MatrixRow[];
  sort: { key: MatrixKey; dir: 1 | -1 } | null;
  onSort: (sort: { key: MatrixKey; dir: 1 | -1 } | null) => void;
  onSelect: (id: string) => void;
  unavailable: Array<{ label: string; retry: () => void }>;
}) {
  return (
    <>
      <div className={s.channelToolbar}>
        <p>Ventas de la tienda y atribución de cada canal, por separado.</p>
        <label>
          Ordenar por
          <Select
            className="sm:max-w-[260px]"
            value={sort?.key ?? "priority"}
            onChange={(value) => onSort(value === "priority" ? null : { key: value as MatrixKey, dir: value === "name" ? 1 : -1 })}
            options={[{ value: "priority", label: "Prioridad del cliente" }, ...Object.entries(SORT_LABELS).map(([key, label]) => ({ value: key, label }))]}
          />
        </label>
        {sort ? (
          <button
            type="button"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            onClick={() => onSort({ ...sort, dir: sort.dir === 1 ? -1 : 1 })}
          >
            {sort.dir === 1 ? "Ascendente" : "Descendente"}
          </button>
        ) : null}
      </div>
      {unavailable.length ? (
        <Banner
          tone="warn"
          title="Algunas fuentes no se han podido cargar"
          action={unavailable.map((item) => (
            <button
              type="button"
              key={item.label}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              onClick={item.retry}
            >
              Reintentar {item.label}
            </button>
          ))}
        >
          Las cifras de esos canales pueden faltar hasta que vuelvan.
        </Banner>
      ) : null}
      {rows.length ? (
        <div className={s.channelList}>
          {rows.map((row) => {
            const position = roasPosition(row.roas, row.breakEven);
            const below = position === "below";
            return (
              <article
                key={row.id}
                className={s.channelClient}
                data-status={row.tier}
              >
                <header>
                  <h3>
                    <button type="button" onClick={() => onSelect(row.id)}>
                      {row.name}
                    </button>
                  </h3>
                  <span className={s.statusBadge}>
                    {STATUS[row.tier].label}
                  </span>
                  <span className={s.channelAlerts}>
                    {fmtNum(row.alerts)} alertas abiertas
                  </span>
                  <button
                    type="button"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    onClick={() => onSelect(row.id)}
                  >
                    Revisar cliente
                  </button>
                </header>
                <div className={s.channelGroups}>
                  <section
                    data-provider="shopify"
                    aria-label={`Tienda online de ${row.name}`}
                  >
                    <h4>
                      Tienda online <small>Shopify · 30 días</small>
                    </h4>
                    <dl>
                      <Metric
                        label="Ventas netas"
                        value={fmtCurrency(row.sales, row.salesCurrencyCode, 2)}
                        bad={row.sales != null && row.sales < 0}
                      />
                      <Metric
                        label="Pedidos"
                        value={
                          row.orders == null
                            ? "No disponible"
                            : fmtNum(row.orders)
                        }
                      />
                    </dl>
                    {row.sales == null ? (
                      <p className={s.channelNote}>
                        Sin total comparable de ventas. Consulta el desglose por
                        tienda.
                      </p>
                    ) : null}
                  </section>
                  <section
                    data-provider="meta"
                    aria-label={`Meta Ads de ${row.name}`}
                  >
                    <h4>
                      Meta Ads <small>Atribuido por Meta</small>
                    </h4>
                    <dl>
                      <Metric
                        label="ROAS"
                        value={
                          row.roas == null
                            ? "No disponible"
                            : `${fmtNum(row.roas, 2)}×`
                        }
                        bad={below || (row.roas != null && row.roas < 0)}
                      />
                      <Metric
                        label="CPA"
                        value={fmtCurrency(row.cac, row.cacCurrencyCode, 2)}
                        bad={row.cac != null && row.cac < 0}
                      />
                    </dl>
                    <p
                      className={s.channelNote}
                      data-negative={below || undefined}
                    >
                      {row.breakEven != null && row.breakEven > 0
                        ? `Equilibrio ${fmtNum(row.breakEven, 2)}×${row.roas != null ? (position === "at" ? " · En equilibrio" : below ? " · Por debajo" : " · Por encima") : ""}`
                        : "Equilibrio no disponible"}
                    </p>
                    <p className={s.channelNote}>
                      {row.cacDelta != null && Math.abs(row.cacDelta) >= 0.5 ? (
                        <span data-negative={row.cacDelta > 0 || undefined}>
                          CPA {row.cacDelta > 0 ? "sube" : "baja"}{" "}
                          {fmtNum(Math.abs(row.cacDelta), 1)} % ·{" "}
                        </span>
                      ) : null}
                      Dependencia Meta:{" "}
                      {row.dep == null
                        ? "no disponible"
                        : `${fmtNum(row.dep)} %`}
                    </p>
                  </section>
                  <section
                    data-provider="klaviyo"
                    aria-label={`Klaviyo de ${row.name}`}
                  >
                    <h4>
                      Klaviyo <small>Atribuido por Klaviyo</small>
                    </h4>
                    <dl>
                      <Metric
                        label="Ingresos atribuidos"
                        value={fmtCurrency(
                          row.emailRev,
                          row.emailRevCurrencyCode,
                          2,
                        )}
                        bad={row.emailRev != null && row.emailRev < 0}
                      />
                      <Metric
                        label="Campañas enviadas"
                        value={
                          row.sent == null ? "No disponible" : fmtNum(row.sent)
                        }
                      />
                    </dl>
                    <p className={s.channelNote}>
                      {row.lastSend
                        ? `Último envío ${new Date(row.lastSend).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                        : "Sin fecha de último envío disponible"}
                    </p>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={s.empty}>
          Los resultados de tus clientes aparecerán aquí cuando haya datos
          disponibles.
        </div>
      )}
    </>
  );
}

export function PortfolioStores({
  stores,
  totalStores,
  onSelect,
  loading,
  error,
  onRetry,
}: {
  stores: PortfolioStore[];
  totalStores: number | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const max = Math.max(1, ...stores.map((store) => store.orders_count));
  return (
    <div className={s.storePanel}>
      <header className={s.sectionHead}>
        <div>
          <h3>Actividad por tienda</h3>
          <p>
            {loading && !stores.length ? (
              "Cargando datos de pedidos"
            ) : (
              <>
                {stores.length}{" "}
                {stores.length === 1 ? "tienda con datos" : "tiendas con datos"}{" "}
                de pedidos
                {totalStores != null ? ` · ${totalStores} conectadas` : ""} ·
                últimos 30 días
              </>
            )}
          </p>
        </div>
      </header>
      {error ? (
        <Banner
          tone="warn"
          action={
            <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onRetry}>
              Reintentar
            </button>
          }
        >
          No se han podido cargar los pedidos.
        </Banner>
      ) : stores.length ? (
        <ul className={s.storeList}>
          {stores.slice(0, 12).map((store) => (
            <li key={store.store_id}>
              <header>
                <div>
                  <h4>{store.shop_name}</h4>
                  <p>{store.organization_name}</p>
                </div>
                <button
                  type="button"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  onClick={() => onSelect(store.organization_id)}
                >
                  Abrir cliente
                </button>
              </header>
              <dl>
                <Metric label="Pedidos" value={fmtNum(store.orders_count)} />
                <Metric
                  label="Ventas netas"
                  value={fmtCurrency(store.net_sales, store.currency_code, 2)}
                  bad={store.net_sales != null && store.net_sales < 0}
                />
                <Metric
                  label="Ticket medio"
                  value={fmtCurrency(store.aov, store.currency_code, 2)}
                  bad={store.aov != null && store.aov < 0}
                />
              </dl>
              <span className={s.storeTrack} aria-hidden="true">
                <i style={{ width: `${(store.orders_count / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.empty}>
          {loading
            ? "Cargando la actividad de las tiendas…"
            : "Sin datos de pedidos para este periodo."}
        </div>
      )}
      {stores.length > 12 ? (
        <p className={s.channelNote}>
          Se muestran las 12 tiendas con más pedidos.
        </p>
      ) : null}
    </div>
  );
}
