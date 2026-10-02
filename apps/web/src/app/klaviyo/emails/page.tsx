"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { PortalShell } from "@/components/portal-shell";
import { AsyncState, EmptyState, ErrorBlock } from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { cx } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import s from "../../shopify/productos/catalogo.module.css";
import k from "../emails.module.css";
import type { KlaviyoEmailListRow, KlaviyoEmailsResponse } from "../email-types";
import { alertTone, emailHref, kindLabel, money, PERIODS, type Period, pct, sentLabel } from "../email-model";

type View = "grid" | "table";
type Kind = "" | "campaign" | "flow";
type Sort = "revenue" | "open_rate" | "revenue_per_recipient";

const KINDS: Array<{ value: Kind; label: string; count: (summary: NonNullable<KlaviyoEmailsResponse["summary"]>) => number }> = [
  { value: "campaign", label: "Campañas", count: (summary) => summary.campaigns },
  { value: "flow", label: "Flujos", count: (summary) => summary.flows },
  { value: "", label: "Todos", count: (summary) => summary.total },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "revenue", label: "Más importe atribuido" },
  { value: "open_rate", label: "Más apertura" },
  { value: "revenue_per_recipient", label: "Más importe por destinatario" },
];

function EmailCard({ row, href, currency }: { row: KlaviyoEmailListRow; href: string; currency: string | null }) {
  const off = row.kind === "campaign" && row.recipients === 0;
  return (
    <a className={s.card} href={href} aria-label={`Abrir ficha de ${row.name}`}>
      <div className={cx(k.cover, off && k.off)}>
        <span className={cx(pulse.chip, row.kind === "flow" ? pulse.chipGood : undefined, k.st)}>{row.kind === "flow" ? "Flujo activo" : off ? "Programada" : "Campaña enviada"}</span>
        {row.alert ? <span className={cx(pulse.chip, alertTone(row.alert) === "bad" ? pulse.chipBad : pulse.chipWarn, k.warn)}>{row.alert.text}</span> : null}
        <div className={k.inbox}>
          <b>{row.subject || "Sin asunto"}</b>
          <span>{row.trigger_type && row.kind === "flow" ? row.trigger_type : "Sin texto de vista previa"}</span>
        </div>
      </div>
      <div className={s.body}>
        <div>
          <p className={s.name}>{row.name}</p>
          <p className={s.meta}>{sentLabel(row)} · {fmtNum(row.recipients)} envíos</p>
        </div>
        <div className={s.price}>
          <b>{row.revenue ? money(row.revenue, currency) : "—"}</b>
          <span className={pulse.chip}>{currency ?? "Importe"} atribuidos · ventana 5 d</span>
        </div>
        <div className={s.stats}>
          <div><span>Apertura</span><span>{pct(row.open_rate)}</span></div>
          <div><span>Clic</span><span>{pct(row.click_rate)}</span></div>
          <div><span>Por dest.</span><span>{row.revenue_per_recipient != null ? money(row.revenue_per_recipient, currency) : "—"}</span></div>
        </div>
      </div>
    </a>
  );
}

function EmailsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const requestedSearch = searchParams.get("q") ?? "";

  const [draftSearch, setDraftSearch] = useState(requestedSearch);
  const [search, setSearch] = useState(requestedSearch);
  const [kind, setKind] = useState<Kind>("");
  const [sort, setSort] = useState<Sort>("revenue");
  const [view, setView] = useState<View>("grid");
  const [periodDays, setPeriodDays] = useState<Period>(90);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId]);
  useEffect(() => { setDraftSearch(requestedSearch); setSearch(requestedSearch); }, [requestedSearch, organizationId, connectionId]);

  const params = new URLSearchParams({ page: String(page), sort, days: String(periodDays) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (kind) params.set("kind", kind);
  const key = organizationId ? `/v1/organizations/${organizationId}/klaviyo/emails?${params.toString()}` : null;
  const query = useCachedQuery<KlaviyoEmailsResponse>(key);
  const data = query.data;
  const summary = data?.summary ?? null;
  const currency = data?.currency ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const rows = data?.emails ?? [];
  const from = data && data.total ? (page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(page * data.page_size, data.total) : 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  const tiles = summary
    ? [
        { label: `${currency ?? "Importe"} atribuidos`, value: money(summary.revenue, currency), hint: summary.flow_share_pct != null ? `${fmtNum(summary.flow_share_pct * 100)} % de flujos` : "" },
        { label: "Apertura media", value: pct(summary.account_open_rate), hint: "ponderada de la cuenta" },
        { label: "Clic medio", value: pct(summary.account_click_rate), hint: "sobre entregados" },
        { label: "Por destinatario", value: summary.account_revenue_per_recipient != null ? money(summary.account_revenue_per_recipient, currency) : "—", hint: "media de la cuenta" },
        { label: "Con aviso", value: fmtNum(summary.alerts), hint: "apertura baja, bajas o spam altos", tone: summary.alerts ? "var(--warn)" : undefined },
      ]
    : [];

  return (
    <div className={pulse.root}>
      <header className={s.top}>
        <div>
          <nav className={s.crumb} aria-label="Ruta" style={{ padding: 0 }}>
            <a href="/shopify">Analítica</a>
            <span aria-hidden="true">/</span>
            <a href="/klaviyo">Klaviyo</a>
            <span aria-hidden="true">/</span>
            <span>Emails</span>
          </nav>
          <h1>Emails</h1>
          <div className={s.topMeta}>
            <span className={pulse.chip}>{connectionId ? "Tienda seleccionada" : "Todas las tiendas"}</span>
            {data ? <span className={pulse.chip}>{fmtNum(data.total)} emails</span> : null}
          </div>
        </div>
        <a className={cx(pulse.btn, pulse.ghost)} href="/klaviyo">Volver a Klaviyo</a>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar su email marketing." />
      ) : data && !data.connected ? (
        <EmptyState title="Klaviyo no está conectado" hint="Conecta Klaviyo desde Integraciones para ver campañas y flujos." />
      ) : (
        <>
          {tiles.length ? (
            <div className={s.sum} role="group" aria-label="Resumen de emails">
              {tiles.map((tile) => (
                <div key={tile.label} className={s.sumC}>
                  <span className={pulse.lbl}>{tile.label}</span>
                  <strong style={{ color: tile.tone }}>{tile.value}</strong>
                  <small>{tile.hint}</small>
                </div>
              ))}
            </div>
          ) : null}

          <div className={s.bar}>
            <form className={s.search} role="search" onSubmit={submitSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por nombre o asunto" aria-label="Buscar emails" />
            </form>
            <div className={s.barR}>
              <div className={pulse.seg} role="group" aria-label="Tipo">
                {KINDS.map((item) => (
                  <button key={item.value || "all"} type="button" aria-pressed={kind === item.value} onClick={() => { setKind(item.value); setPage(1); }}>
                    {item.label}
                    {summary ? <b>{fmtNum(item.count(summary))}</b> : null}
                  </button>
                ))}
              </div>
              <label className={s.selectL}>
                Ordenar
                <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} aria-label="Ordenar por">
                  {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <div className={pulse.seg} role="group" aria-label="Periodo">
                {PERIODS.map((value) => (
                  <button key={value} type="button" aria-pressed={periodDays === value} onClick={() => { setPeriodDays(value); setPage(1); }}>
                    {value === 365 ? "1 año" : value === 180 ? "6 meses" : `${value} d`}
                  </button>
                ))}
              </div>
              <div className={pulse.seg} role="group" aria-label="Vista">
                <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Tarjetas</button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Tabla</button>
              </div>
            </div>
          </div>

          {query.error && !data ? <ErrorBlock>{query.error}</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando emails…" /> : null}

          {data && rows.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>No hay emails con estos filtros.</p>
            </div>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <div className={s.grid}>
              {rows.map((row) => <EmailCard key={row.id} row={row} currency={currency} href={emailHref(row.id, organizationId, connectionId)} />)}
            </div>
          ) : null}

          {data && rows.length && view === "table" ? (
            <div className={pulse.panel}>
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Tipo</th>
                      <th>Asunto</th>
                      <th style={{ textAlign: "right" }}>Envíos</th>
                      <th style={{ textAlign: "right" }}>Apertura</th>
                      <th style={{ textAlign: "right" }}>Clic</th>
                      <th style={{ textAlign: "right" }}>EUR atribuidos</th>
                      <th>Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <a className={s.prod} href={emailHref(row.id, organizationId, connectionId)} aria-label={`Abrir ficha de ${row.name}`}>
                            <span>
                              <b style={{ fontWeight: 600 }}>{row.name}</b>
                              <br />
                              <span className={pulse.muted} style={{ fontSize: 12 }}>{sentLabel(row)}</span>
                            </span>
                          </a>
                        </td>
                        <td><span className={cx(pulse.chip, row.kind === "flow" ? pulse.chipGood : undefined)}>{kindLabel(row.kind)}</span></td>
                        <td style={{ maxWidth: 260 }}>{row.subject || "—"}</td>
                        <td className={pulse.tdN}>{fmtNum(row.recipients)}</td>
                        <td className={pulse.tdN}>{pct(row.open_rate)}</td>
                        <td className={pulse.tdN}>{pct(row.click_rate)}</td>
                        <td className={pulse.tdN}>{money(row.revenue, currency)}</td>
                        <td>{row.alert ? <span className={cx(pulse.chip, alertTone(row.alert) === "bad" ? pulse.chipBad : pulse.chipWarn)}>{row.alert.text}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {data ? (
            <div className={s.pager}>
              <span className={pulse.muted} style={{ fontSize: 12.5 }}>
                {data.total ? `Mostrando ${fmtNum(from)}–${fmtNum(to)} de ${fmtNum(data.total)}` : "Sin resultados"} · página {page} de {totalPages}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
              </div>
            </div>
          ) : null}

          <footer className={s.foot}>
            <span>EUR atribuidos por Klaviyo con su ventana de 5 días tras abrir o hacer clic. No se suman a lo que atribuye Meta.</span>
          </footer>
        </>
      )}
    </div>
  );
}

export default function KlaviyoEmailsPage() {
  return (
    <PortalShell title="Emails Klaviyo">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando emails…" />}>
          <EmailsContent bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
