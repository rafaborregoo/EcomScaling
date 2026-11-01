"use client";

import { buttonVariants } from "@/components/ui/button";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { A26EmailAudit } from "@/components/a26-email-audit";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useCachedQuery, useKeepPrevious } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, ErrorBlock, ToggleGroup, ToggleGroupItem, Card, CardContent, CardDescription, CardHeader, CardTitle, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import { cx, Empty, SectionHead } from "../../../dashboard/client-pulse";
import { fmtNum } from "../../../dashboard/client-pulse-model";
import pulse from "../../../dashboard/client-pulse.module.css";
import s from "../../../shopify/productos/catalogo.module.css";
import k from "../../emails.module.css";
import type { KlaviyoEmailDetailResponse } from "../../email-types";
import { alertTone, linkLabel, money, PERIODS, type Period, periodLabel, pct, sentLabel } from "../../email-model";

function CompareRow({ label, value, account, formatValue }: { label: string; value: number | null; account: number | null; formatValue: (value: number | null) => string }) {
  const max = Math.max(value ?? 0, account ?? 0, 0.0001) * 1.1;
  const above = account != null && value != null && value >= account;
  return (
    <div className={k.cmpR}>
      <span>{label}</span>
      <span style={{ display: "grid", gap: 3 }}>
        <span className={k.meter}><b style={{ width: `${((value ?? 0) / max) * 100}%`, background: account == null ? "var(--ink)" : above ? "var(--good)" : "var(--bad)" }} /></span>
        <span className={k.meter}><b style={{ width: `${((account ?? 0) / max) * 100}%`, background: "var(--ink-3)" }} /></span>
      </span>
      <span>{formatValue(value)}</span>
    </div>
  );
}

function EmailDetail({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ emailId: string }>();
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const ask = useCopilotAsk();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const [periodDays, setPeriodDays] = useState<Period>(90);
  useEffect(() => setPeriodDays(90), [organizationId, connectionId, params.emailId]);

  const queryParams = new URLSearchParams({ days: String(periodDays) });
  if (connectionId) queryParams.set("connectionId", connectionId);
  const key = organizationId ? `/v1/organizations/${organizationId}/klaviyo/emails/${encodeURIComponent(params.emailId)}?${queryParams.toString()}` : null;
  const query = useCachedQuery<KlaviyoEmailDetailResponse>(key);
  const data = useKeepPrevious(query.data, `${organizationId}|${connectionId}|${params.emailId}`);

  const backParams = new URLSearchParams();
  if (organizationId) backParams.set("organizationId", organizationId);
  if (connectionId) backParams.set("connectionId", connectionId);
  const backHref = `/klaviyo/emails${backParams.size ? `?${backParams.toString()}` : ""}`;

  function returnToEmails() {
    if (organizationId) activeOrganization.setOrganizationId(organizationId);
    activeConnection.setConnectionId(connectionId);
  }

  if (!organizationId) return <div className={pulse.root}><Card>
    <CardHeader>
      <CardTitle>Selecciona un cliente</CardTitle>
      <CardDescription>Elige una organización en la barra superior.</CardDescription>
    </CardHeader>
  </Card></div>;
  if (query.error && !data) return <div className={pulse.root}><Card>
    <CardHeader>
      <CardTitle>No se pudo abrir el email</CardTitle>
    </CardHeader>
    <CardContent><ErrorBlock>{query.error}</ErrorBlock></CardContent>
  </Card></div>;
  if (!data) return <div className={pulse.root}><AsyncState status="loading" loadingLabel="Cargando ficha de email…" /></div>;

  const { entity } = data;
  const cur = data.currency;
  const flow = entity.type === "flow";
  const sortedSteps = data.steps.slice().sort((a, b) => a.position - b.position);
  const linksMax = Math.max(...data.links.map((link) => link.clicks), 1);

  const askCopilot = (question: string, focusLabel: string) =>
    ask({ question: `${question} («${entity.name}», últimos ${periodDays} días)`, focusLabel, reference: { filters: { periodDays: String(periodDays) } } });

  return (
    <div className={pulse.root} aria-busy={query.data === undefined} style={query.data === undefined ? { opacity: 0.55, transition: "opacity 0.2s" } : undefined}>
      <nav className={s.crumb} aria-label="Ruta">
        <Link href="/klaviyo">Klaviyo</Link>
        <span aria-hidden="true">/</span>
        <Link href={backHref} onClick={returnToEmails}>Emails</Link>
        <span aria-hidden="true">/</span>
        <span>{entity.name}</span>
      </nav>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.fHero} aria-labelledby="email-titulo">
        <div className={k.fLeft}>
          <p className={k.fKind}>{flow ? `Flujo · ${entity.trigger_type ?? "sin disparador"}` : `Campaña · ${sentLabel({ kind: "campaign", send_time: entity.send_time, trigger_type: null, recipients: entity.recipients })}`}</p>
          <div className={k.mail}>
            <span className={k.from}>De: {bootstrap.memberships.find((item) => item.organization_id === organizationId)?.organization?.display_name ?? "tu tienda"}</span>
            <span className={k.subj}>{entity.subject || "Sin asunto"}</span>
            <span className={k.pre}>{data.steps[0]?.preview_text || "Sin texto de vista previa"}</span>
          </div>
          {flow && sortedSteps.length ? (
            <div className={k.steps}>
              {sortedSteps.map((step, index) => (
                <div key={step.message_id} className={k.step}>
                  <b>{index + 1}</b>
                  <span><strong>{step.subject || "Sin asunto"}</strong>Apertura {pct(step.open_rate)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className={s.info}>
          <div>
            {entity.alert ? (
              <div className={s.chips}>
                <span className={cx(pulse.chip, alertTone(entity.alert) === "bad" ? pulse.chipBad : pulse.chipWarn)}>{entity.alert.text}</span>
              </div>
            ) : null}
            <h1 id="email-titulo">{entity.name}</h1>
          </div>
          <p className={s.desc} style={{ maxWidth: "62ch" }}>
            {data.stats_coverage === "lifetime" ? "No salió en este periodo: son las cifras de todo su histórico. " : ""}
            {entity.revenue_per_recipient == null
              ? "Todavía no se ha enviado."
              : !data.account.revenue_per_recipient
                ? `Cada email enviado vendió ${money(entity.revenue_per_recipient, cur)}.`
                : entity.revenue_per_recipient >= data.account.revenue_per_recipient
                ? `Cada email enviado vendió ${money(entity.revenue_per_recipient, cur)}: por encima de tu media (${money(data.account.revenue_per_recipient, cur)}).`
                : `Cada email enviado vendió ${money(entity.revenue_per_recipient, cur)}: por debajo de tu media (${money(data.account.revenue_per_recipient ?? 0, cur)}).`}
          </p>
          <dl className={s.dl}>
            <div><dt>Envíos</dt><dd>{fmtNum(entity.recipients)}</dd><small>{flow ? "en el periodo" : "destinatarios"}</small></div>
            <div><dt>Apertura</dt><dd>{pct(entity.open_rate)}</dd><small>{data.account.open_rate != null ? `tu media ${pct(data.account.open_rate)}` : null}</small></div>
            <div><dt>Clic</dt><dd>{pct(entity.click_rate)}</dd><small>{data.account.click_rate != null ? `tu media ${pct(data.account.click_rate)}` : null}</small></div>
            <div><dt>Ventas</dt><dd>{money(entity.revenue, cur)}</dd><small>según Klaviyo</small></div>
            <div><dt>Bajas</dt><dd>{pct(entity.unsub_rate, 2)}</dd><small>lo normal: menos de 0,5 %</small></div>
          </dl>
          <div className={s.actions}>
            <button type="button" className={buttonVariants()} onClick={() => askCopilot("Explícame cómo funciona este email y qué cambiarías", "Ficha de email")}>
              <span className={pulse.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>IA</span>
              Preguntar qué haría
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------ Fiabilidad ------------------------------ */}
      <Collapsible>
      <CollapsibleTrigger className={pulse.sub}>Sobre estos datos<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
      <CollapsibleContent>
      <div className={s.checks} role="group" aria-label="Fiabilidad de los datos">
        <div className={s.check}>
          <div className={s.checkH}><span>Atribución</span><span className={cx(pulse.chip, pulse.chipWarn)}>de Klaviyo</span></div>
          <p>Ventas de los 5 días después de abrir o pulsar el email. No se suman a las de Meta.</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>UTM</span><span className={cx(pulse.chip, entity.has_utm ? pulse.chipGood : pulse.chipWarn)}>{entity.has_utm ? "OK" : "faltan"}</span></div>
          <p>{entity.has_utm ? "Los enlaces van marcados: tu tienda sabe que la visita viene del email." : "Los enlaces no van marcados: tu tienda no sabe que la visita viene del email."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Entregabilidad</span><span className={cx(pulse.chip, alertTone(entity.alert) === "bad" ? pulse.chipBad : (entity.unsub_rate ?? 0) >= 0.005 ? pulse.chipWarn : pulse.chipGood)}>{(entity.spam_rate ?? 0) >= 0.001 ? "spam alto" : (entity.unsub_rate ?? 0) >= 0.005 ? "bajas altas" : "OK"}</span></div>
          <p>Spam {pct(entity.spam_rate, 2)} · rebotes {pct(entity.bounce_rate, 2)}.</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Datos</span><span className={cx(pulse.chip, data.stats_coverage === "lifetime" ? pulse.chipWarn : pulse.chipGood)}>{data.stats_coverage === "lifetime" ? "histórico" : "del periodo"}</span></div>
          <p>{data.stats_coverage === "lifetime" ? "Sin envíos en el periodo elegido: se muestra su histórico completo." : "Cifras del periodo seleccionado."}</p>
        </div>
      </div>
      </CollapsibleContent>
      </Collapsible>

      {/* ------------------------------ Rendimiento ------------------------------ */}
      <section id="rendimiento" className={pulse.sec}>
        <div className={pulse.secHead} style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
          <h2>Rendimiento</h2>
          <p className={pulse.aiLine}>Frente a la media de la cuenta en el mismo periodo.</p>
          <ToggleGroup aria-label="Periodo" value={periodDays} onValueChange={setPeriodDays}>
            {PERIODS.map((value) => <ToggleGroupItem key={value} value={value}>{periodLabel(value)}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className={pulse.panel}>
          <div className={pulse.panelH}>
            <div>
              <h3>Este email frente a la media</h3>
              <p className={pulse.sub}>Arriba este email; debajo, en gris, tu media</p>
            </div>
          </div>
          <CompareRow label="Apertura" value={entity.open_rate} account={data.account.open_rate} formatValue={(value) => pct(value)} />
          <CompareRow label="Clic" value={entity.click_rate} account={data.account.click_rate} formatValue={(value) => pct(value)} />
          <CompareRow label="Ventas por email" value={entity.revenue_per_recipient} account={data.account.revenue_per_recipient} formatValue={(value) => (value == null ? "—" : money(value, cur))} />
        </div>
      </section>

      {/* ------------------------------ Pasos ------------------------------ */}
      {flow && sortedSteps.length ? (
        <section id="pasos" className={pulse.sec}>
          <SectionHead id="pasos-titulo" title="Pasos del flujo" ai={null} fallback="Qué email del flujo hace el trabajo." />
          <div className={pulse.panel}>
            <div className={pulse.tblWrap}>
              <table className={pulse.tbl}>
                <thead><tr><th>Paso</th><th>Asunto</th><th style={{ textAlign: "right" }}>Apertura</th><th style={{ textAlign: "right" }}>Ventas</th><th>Peso</th></tr></thead>
                <tbody>
                  {sortedSteps.map((step, index) => (
                    <tr key={step.message_id}>
                      <td className={pulse.muted}>{index + 1}</td>
                      <td><b style={{ fontWeight: 600 }}>{step.subject || "Sin asunto"}</b>{!step.adds_utm ? <span className={cx(pulse.chip, pulse.chipWarn)} style={{ marginLeft: 8 }}>sin UTM</span> : null}</td>
                      <td className={pulse.tdN}>{pct(step.open_rate)}</td>
                      <td className={pulse.tdN}>{money(step.revenue, cur)}</td>
                      <td style={{ minWidth: 120 }}><span className={k.meter}><b style={{ width: `${entity.revenue ? (step.revenue / entity.revenue) * 100 : 0}%`, background: "var(--klaviyo)" }} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ Enlaces ------------------------------ */}
      <section id="enlaces" className={pulse.sec}>
        <SectionHead id="enlaces-titulo" title="Enlaces" ai={null} fallback="Dónde pulsa la gente, por número de clics." />
        <div className={pulse.panel}>
          {data.links_coverage === "unavailable" ? <p className={s.note}>No se pudo consultar los clics de este email.</p> : null}
          {data.links.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {data.links.map((link) => (
                <div key={link.url} className={k.linkRow}>
                  <span title={link.url}>{linkLabel(link.url)}</span>
                  <span className={k.meter}><b style={{ width: `${(link.clicks / linksMax) * 100}%`, background: "var(--klaviyo)" }} /></span>
                  <span>{fmtNum(link.clicks)}</span>
                </div>
              ))}
            </div>
          ) : <Empty>Sin clics registrados en el periodo.</Empty>}
        </div>
      </section>

      {/* ------------------------------ Audiencia ------------------------------ */}
      {flow || data.audience.length ? (
      <section id="audiencia" className={pulse.sec}>
        <SectionHead id="audiencia-titulo" title="Audiencia" ai={null} fallback={flow ? "Quién puede entrar en este flujo." : "A quién se mandó esta campaña."} />
        <div className={pulse.panel}>
          {flow ? (
            <p className={pulse.sub}>{entity.trigger_type ? `Entra quien cumple: ${entity.trigger_type}.` : "Sin disparador informado."}</p>
          ) : data.audience.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.audience.map((item, index) => (
                <span key={`${item.name}-${index}`} className={cx(pulse.chip, item.role?.startsWith("excluded") ? pulse.chipWarn : undefined)}>{item.role?.startsWith("excluded") ? "Excluye: " : ""}{item.name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ? <A26EmailAudit organizationId={organizationId} connectionId={connectionId} /> : null}
      <footer className={s.foot}>
        <span>Ventas según Klaviyo: no son las ventas de tu tienda.</span>
      </footer>
    </div>
  );
}

export default function KlaviyoEmailDetailPage() {
  return (
    <PortalShell title="Ficha de email Klaviyo">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando email…" />}>
          <EmailDetail bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
