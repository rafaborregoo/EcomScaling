"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { EmailCampaignDossier } from "@e-nora/contracts";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorBlock, Heading, LoadingBlock, Select } from "@/components/ui";
import { money, pct } from "../../email-model";
import styles from "./page.module.css";

const LABELS = { reuse: "Reutilizable como base", improve_and_test: "Mejorar y probar", fix_before_reuse: "Corregir antes de reutilizar", insufficient_evidence: "Evidencia insuficiente" };
const DIMENSIONS: Record<string, string> = { subject: "Asunto", preheader: "Preheader", body: "Texto", link: "Enlace", structure: "Estructura", visual: "Diseño" };
const EDITORIAL = { current_review: "Revisión vigente", not_reviewed: "Sin revisión de esta versión", stale: "Revisión anterior al contenido actual", unavailable: "No se pudo consultar la revisión" };
function CampaignDossier({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const search = useSearchParams(); const activeOrg = useActiveOrganization(); const activeConnection = useActiveConnection();
  const requestedOrg = search.get("organizationId");
  const org = requestedOrg && bootstrap.memberships.some((row) => row.organization_id === requestedOrg) ? requestedOrg : activeOrg.organizationId;
  const connection = requestedOrg ? search.get("connectionId") ?? "" : activeConnection.connectionId;
  const [days, setDays] = useState("90");
  const params = new URLSearchParams({ days }); if (connection) params.set("connectionId", connection);
  const query = useCachedQuery<EmailCampaignDossier>(org ? `/v1/organizations/${org}/klaviyo/campaigns/${encodeURIComponent(campaignId)}/dossier?${params}` : null);
  const data = query.data;
  const href = (path: string) => withPortalRouteContext(path, org, connection);
  if (!org) return <EmptyState title="Selecciona un cliente y su tienda." />;
  if (query.error) return <ErrorBlock>{query.error}<Button variant="secondary" onClick={() => query.reload()}>Reintentar</Button></ErrorBlock>;
  if (!data) return <LoadingBlock label="Reuniendo email, resultados y revisión…" />;
  const m = data.metrics;
  return <div className={styles.root}>
    <nav aria-label="Ruta" className={styles.breadcrumb}><Link href={href("/klaviyo")}>Klaviyo</Link><span aria-hidden>/</span><Link href={href("/klaviyo/campanas")}>Campañas</Link></nav>
    <header className={styles.header}><div><Heading level={1}>{data.campaign.name}</Heading><p>{data.campaign.subject || "Sin asunto sincronizado"}</p></div><Button variant="secondary" onClick={() => query.reload()} disabled={query.isLoading}>Actualizar datos</Button></header>
    {data.campaign.synthetic ? <p className={styles.note}>Ejemplo de la cuenta TEST: histórico sintético de demostración.</p> : null}
    <section className={styles.conclusion} aria-labelledby="campaign-conclusion"><Badge tone={data.conclusion.status === "reuse" ? "success" : data.conclusion.status === "fix_before_reuse" ? "danger" : "neutral"}>{LABELS[data.conclusion.status]}</Badge><Heading level={2} id="campaign-conclusion" size="md">{data.conclusion.summary}</Heading><ul>{data.conclusion.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className={styles.note}>Conclusión provisional de reutilización. No cancela campañas ni acredita que el diseño haya causado las ventas.</p></section>
    <section aria-labelledby="campaign-results" className={styles.section}><div className={styles.header}><div><Heading level={2} id="campaign-results" size="md">Resultados atribuidos por Klaviyo</Heading><p>Agregados mensuales incluidos en la ventana, base de lectura de A12.</p></div><label>Periodo<Select value={days} onChange={setDays} options={[30,90,180,365].map((value) => ({ value: String(value), label: `${value} días` }))} /></label></div>
      <p className={styles.note}>{new Date(data.period.start).toLocaleDateString("es-ES")} – {new Date(data.period.end).toLocaleDateString("es-ES")} · {data.metric_status === "available" ? "Datos disponibles" : data.metric_status === "missing" ? "Sin informes en este intervalo" : "Consulta de resultados no disponible"}</p>
      <dl className={styles.metrics}>{[["Ingresos atribuidos", money(m.revenue, data.currency)], ["Conversiones", m.conversions?.toLocaleString("es-ES") ?? "—"], ["Destinatarios", m.recipients?.toLocaleString("es-ES") ?? "—"], ["Entregados", m.delivered?.toLocaleString("es-ES") ?? "—"], ["Apertura", pct(m.open_rate)], ["Clic", pct(m.click_rate)], ["Bajas", pct(m.unsub_rate,2)], ["Rebotes", pct(m.bounce_rate,2)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className={styles.note}>No hay una ventana de atribución madura verificada. Los datos ausentes se muestran con «—», no como cero.</p>
    </section>
    <div className={styles.columns}>
      <section className={styles.section} aria-labelledby="campaign-content"><Heading level={2} id="campaign-content" size="md">El email observado</Heading><p className={styles.note}>Simulación del HTML importado, sin scripts ni navegación. Imágenes externas bloqueadas salvo fotos alojadas en Shopify; no es una captura de la bandeja del destinatario.</p>
        {!data.messages.length ? <EmptyState title="El cuerpo de este email todavía no está disponible." hint="La importación de métricas no garantiza que Klaviyo haya entregado su contenido." /> : data.messages.map((message) => <article key={message.id} className={styles.message}><Heading level={3} size="md">{message.subject || "Mensaje sin asunto"}</Heading><p>{message.preheader}</p><p className={styles.note}>{message.historical_observation ? "Versión histórica observada" : "Plantilla actual; no verificada como enviada"}</p>{message.html ? <iframe title={`Contenido de ${message.subject || "email"}`} sandbox="" referrerPolicy="no-referrer" srcDoc={`<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://cdn.shopify.com data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${message.html}`} /> : <p className={styles.plain}>{message.text || "No se ha podido recuperar el cuerpo del mensaje."}</p>}<details><summary>Procedencia y versión del contenido</summary><p className={styles.plain}>{message.provenance}</p><p>Versión: {message.source_revision ?? "No disponible"} · Huella: {message.content_hash?.slice(0,12) ?? "No disponible"}</p></details></article>)}
      </section>
      <section className={styles.section} aria-labelledby="campaign-review"><Heading level={2} id="campaign-review" size="md">Qué conservar y qué mejorar</Heading><Badge tone="neutral">{EDITORIAL[data.editorial_status]}</Badge>
        {data.strengths.length ? <div><Heading level={3} size="md">Evidencia favorable</Heading><ul>{data.strengths.map((text) => <li key={text}>{text}</li>)}</ul></div> : <p>No hay evidencia suficiente para destacar un acierto de rendimiento.</p>}
        {!data.reviews.length ? <p>A26 aún no tiene una observación guardada para estos mensajes. No se inventa una valoración del contenido.</p> : data.reviews.map((review) => <article key={review.id} className={styles.review}><Heading level={3} size="md">{DIMENSIONS[review.dimension] ?? "Revisión editorial"}</Heading><p className={styles.note}>{review.current_version ? "Coincide con la versión observada" : "Versión anterior: no determina la conclusión actual"} · {review.claim_type === "editorial_hypothesis" ? "Hipótesis para probar" : "Observación de A26"} · {review.status === "approved" ? "Aprobada" : review.status === "rejected" ? "Descartada" : "Pendiente o histórica"}</p>{review.quote ? <blockquote>{review.quote}</blockquote> : null}<p>{review.observation}</p><p><strong>Cambio propuesto:</strong> {review.change}</p><p><strong>Cómo comprobarlo:</strong> {review.criterion}</p><p className={styles.note}>{review.limitation}</p>{review.draft_id ? <Link href={href(`/marketing?section=crear&draft=${review.draft_id}`)}>Abrir versión preparada en el Estudio</Link> : null}</article>)}
        <div><Heading level={3} size="md">Siguientes pasos</Heading><ul>{data.next_steps.map((text) => <li key={text}>{text}</li>)}</ul><Link href={href("/klaviyo#revision-contenido-email")}>Abrir revisión A26 y sus propuestas</Link></div>
      </section>
    </div>
    <Card><CardHeader><CardTitle>Alcance y límites de la ficha</CardTitle></CardHeader><CardContent><ul>{data.limitations.map((text) => <li key={text}>{text}</li>)}</ul><p className={styles.note}>Consultado el {new Date(data.captured_at).toLocaleString("es-ES")}. Cliente y consultor consultan las mismas fuentes de la tienda.</p></CardContent></Card>
  </div>;
}
export default function CampaignDossierPage() {
  return <PortalShell title="Ficha de campaña de email">{(bootstrap) => <Suspense fallback={<LoadingBlock label="Cargando ficha de campaña…" />}><CampaignDossier bootstrap={bootstrap} /></Suspense>}</PortalShell>;
}
