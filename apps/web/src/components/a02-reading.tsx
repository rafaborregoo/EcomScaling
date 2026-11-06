"use client";

import Link from "next/link";
import { A02_SPOTS, a02EvidenceText, a02PlainText, a02SeverityLabel, projectA02Reading, type A02Diagnostic, type A02Spot } from "@e-nora/contracts";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import s from "./a02-reading.module.css";

const destinations: Record<string, { href: string; label: string }> = {
  ventas: { href: "/shopify", label: "Ver ventas" },
  finanzas: { href: "/dashboard", label: "Ver cifras del negocio" },
  stock: { href: "/shopify/inventario", label: "Revisar inventario" },
  meta: { href: "/meta", label: "Revisar Meta Ads" },
  klaviyo: { href: "/klaviyo", label: "Revisar Klaviyo" },
  operativa: { href: "/tareas", label: "Ver tareas" },
  integraciones: { href: "/integraciones", label: "Revisar conexiones" },
};
export function A02Reading({ spot, diagnostic, loading, error, errorCode, days = 30, viewDays, organizationId, connectionId, onRetry }: {
  spot: A02Spot;
  diagnostic?: A02Diagnostic | null;
  loading?: boolean;
  error?: string | null;
  errorCode?: string | null;
  days?: number;
  viewDays?: number | string;
  organizationId?: string;
  connectionId?: string | null;
  onRetry?: () => void;
}) {
  const reading = projectA02Reading({ spot, diagnostic, loading, error, errorCode });
  const hasDetail = reading.findings.length > 0 || reading.recommendations.length > 0;
  const validDate = reading.generatedAt && Number.isFinite(Date.parse(reading.generatedAt)) ? reading.generatedAt : null;
  const date = validDate ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(validDate)) : null;
  return (
    <aside id={`a02-${reading.id}`} className={s.reading} data-a02-spot={reading.id} data-state={reading.state} aria-label={`${reading.label}, A02 ${reading.id}`} aria-busy={reading.state === "loading"}>
      <div className={s.heading}>
        <span className={s.tag} title={`Ubicación ${reading.id} de A02`}>A02 · {reading.id}</span>
        <span className={s.label}>{reading.label}</span>
        {diagnostic?.preview ? <span className={s.status}>Vista previa CLI · TEST</span> : null}
        {reading.state === "stale" ? <span className={s.status}>Lectura anterior</span> : null}
        {reading.state === "ready" && diagnostic?.output.confidence === "low" ? <span className={s.status}>Confianza limitada</span> : null}
      </div>
      <p className={s.summary}>{reading.summary}</p>
      {date ? <p className={s.meta}>Ventana de {days} días{diagnostic?.scope_label ? ` · ${diagnostic.scope_label}` : ""} · <time dateTime={validDate!}>Lectura del {date}</time>{viewDays !== undefined && String(viewDays) !== String(days) ? ` · Tu vista muestra ${viewDays === "all" ? "todo el histórico" : `${viewDays} días`}` : ""}</p> : null}
      {reading.generalFallback ? <p className={s.meta}>Lectura general del negocio; la específica de esta vista todavía no está disponible.</p> : null}
      {diagnostic?.envelope?.freshness?.reason === "no_activity_since" ? <p className={s.meta}>Sin actividad nueva desde esa lectura.</p> : null}
      {hasDetail ? (
        <Collapsible key={`${spot}:${diagnostic?.generated_at}`} className={s.disclosure}>
          <CollapsibleTrigger className={s.trigger}>{reading.state === "stale" ? "Consultar lectura anterior" : "Ver hallazgos y evidencia"}<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
            <ul className={s.findings}>
              {reading.findings.map((finding, index) => {
                const target = finding.section ? destinations[finding.section] : undefined;
                return <li key={`${finding.section}:${finding.title}:${index}`}>
                  <p className={s.meta}>{a02SeverityLabel(finding.severity)}</p>
                  <p className={s.findingTitle}>{a02PlainText(finding.title)}</p>
                  {finding.figures?.length ? <dl className={s.figures}>{finding.figures.map((figure, figureIndex) => <div key={`${figure.label}:${figureIndex}`}><dt>{a02PlainText(figure.label)}</dt><dd>{figure.value}{figure.previous ? <span> · antes {figure.previous}</span> : null}</dd></div>)}</dl> : null}
                  {a02EvidenceText(finding.evidence) ? <p className={s.evidence}>{a02EvidenceText(finding.evidence)}</p> : null}
                  {target ? <Link className={s.link} href={organizationId ? withPortalRouteContext(target.href, organizationId, connectionId) : target.href}>{target.label}</Link> : null}
                </li>;
              })}
            </ul>
            {reading.recommendations.length ? <div className={s.recommendations}><p className={s.findingTitle}>Qué propone revisar</p><ul>{reading.recommendations.map((item, index) => <li key={`${item.action}:${index}`}>{a02PlainText(item.action)}</li>)}</ul><p className={s.meta}>Estas recomendaciones orientan la revisión. Las tareas se gestionan en Trabajo.</p></div> : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {reading.state === "unavailable" && onRetry ? <button type="button" className={s.trigger} onClick={onRetry}>Volver a cargar</button> : null}
    </aside>
  );
}

/** Reads the same stored run as the dashboard; mounting never generates an agent run. */
export function A02Slot({ organizationId, connectionId: selectedConnection, spot, days = 30 }: { organizationId: string; connectionId?: string | null; spot: A02Spot; days?: number }) {
  const { connectionId: activeConnection } = useActiveConnection();
  const connectionId = selectedConnection === undefined ? activeConnection : selectedConnection;
  const query = useCachedQuery<A02Diagnostic>(`/v1/organizations/${organizationId}/ai/monitor?days=${days}&view=${A02_SPOTS[spot].scope}${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`);
  return <A02Reading spot={spot} diagnostic={query.data} loading={query.isLoading} error={query.error} errorCode={query.errorCode} days={days} organizationId={organizationId} connectionId={connectionId} onRetry={query.reload} />;
}
