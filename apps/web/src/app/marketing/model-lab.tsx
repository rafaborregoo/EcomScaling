"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Heading, Input, Select } from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { MARKETING_COMPARISON_BATCH, MARKETING_SPECIALISTS_BATCH, comparisonCaseRows, comparisonPrice, type LabManifestRow } from "./model-comparison";
import styles from "./model-lab.module.css";

export function MarketingModelLab({ organizationId, connectionId, onOpen }: { organizationId: string; connectionId: string | null; onOpen: (draft: MarketingDraft) => void }) {
  const params = new URLSearchParams({ labBatch: MARKETING_COMPARISON_BATCH });
  if (connectionId) params.set("connectionId", connectionId);
  const query = useCachedQuery<{ drafts?: MarketingDraft[] }>(organizationId ? `/v1/organizations/${organizationId}/marketing/drafts?${params}` : null);
  const specialistParams = new URLSearchParams(params);
  specialistParams.set("labBatch", MARKETING_SPECIALISTS_BATCH);
  const specialistQuery = useCachedQuery<{ drafts?: MarketingDraft[] }>(organizationId ? `/v1/organizations/${organizationId}/marketing/drafts?${specialistParams}` : null);
  const [channel, setChannel] = useState("email_klaviyo");
  const [mode, setMode] = useState("original");
  const [left, setLeft] = useState("gpt-6.1-sol");
  const [right, setRight] = useState("claude-opus-5-5");
  const [mobile, setMobile] = useState(false);
  const [monthlyPieces, setMonthlyPieces] = useState(4);
  const drafts = [...(query.data?.drafts ?? []), ...(specialistQuery.data?.drafts ?? [])];
  const metadata = drafts.find((draft) => draft.request?.ai_lab?.batch === MARKETING_COMPARISON_BATCH)?.request?.ai_lab;
  const specialist = specialistQuery.data?.drafts?.[0]?.request?.ai_lab;
  const manifest = [...(metadata?.manifest ?? []), ...(specialist?.manifest ?? [])];
  const rows = comparisonCaseRows(manifest, channel, mode);
  const completed = manifest.filter((row) => row.status === "completed").length;
  const measured = manifest.filter((row) => row.price);
  const total = measured.reduce((sum, row) => ({ low: sum.low + row.price!.low, high: sum.high + row.price!.high }), { low: 0, high: 0 });
  const models = rows.map((row) => ({ value: row.model_id, label: row.model_label }));
  const draftFor = (model: string) => drafts.find((draft) => draft.request?.ai_lab?.case_id === `${channel}-${mode}` && draft.request.ai_lab.model === model);
  const verdict = metadata?.verdict;
  return <section className={styles.root} aria-label="Comparación de modelos de marketing">
    <div className={styles.header}>
      <div><Heading level={1}>Laboratorio de marketing</Heading><p>Compara A11 con los productos y fotos de esta tienda. Misma entrada para seis modelos, sin Astra.</p></div>
      <Button variant="secondary" onClick={() => { query.reload(); specialistQuery.reload(); }} disabled={query.isLoading || specialistQuery.isLoading}>Actualizar resultados</Button>
    </div>
    {query.error ? <p role="alert">No se pudo cargar la comparación. {query.error}</p> : null}
    {specialistQuery.error ? <p role="alert">No se pudo cargar el piloto de subagentes. {specialistQuery.error}</p> : null}
    {query.isLoading && !metadata ? <p role="status">Cargando las piezas de esta tienda…</p> : null}
    {!query.isLoading && !metadata && !query.error ? <div className={styles.empty}><Heading level={2} size="md">Esta tienda todavía no tiene esta comparación</Heading><p>Selecciona Prueba Borrego / E-NORA Demo para ver las pruebas solicitadas. Los resultados se guardan como borradores en esa cuenta.</p></div> : null}
    {metadata ? <>
      {metadata.audit_history ? <details className={styles.details}><summary>Auditoría: qué hemos corregido y resultados anteriores</summary><ul>{metadata.audit_history.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul><p>Pasadas anteriores: {comparisonPrice(metadata.audit_history.previous_known_cost)} de API equivalente conocida. {metadata.audit_history.unmeasured_interrupted > 0 ? `${metadata.audit_history.unmeasured_interrupted} intentos interrumpidos sin uso final completo.` : ""} Este importe no está incluido en el coste de la tanda final.</p>{metadata.audit_history.baseline_failures.map((failure) => <details key={`${failure.model_id}:${failure.case_id}`}><summary>{failure.model_id} · {failure.case_id} · fallo anterior</summary><p className={styles.brief}>{failure.error}</p><pre className={styles.brief}>{failure.raw_response}</pre></details>)}</details> : null}
      <div className={styles.summary}>
        <p><strong>{completed} / {manifest.length}</strong> ejecuciones completadas · {drafts.length} borradores guardados</p>
        <p><strong>{comparisonPrice(total)}</strong> API estimada de la tanda final y el piloto</p>
        <p className={styles.muted}>Precios en USD sobre consumo CLI; no son una factura. Los intentos excluidos y la frecuencia mensual se explican en la auditoría.</p>
      </div>
      {specialist ? <div className={styles.verdict}><Heading level={2} size="md">Piloto de subagentes · un email</Heading><p>Sol redacta, Opus compone y Sonnet revisa código y contenido. Compara «Equipo» con un modelo individual en Email → Crear desde cero. El coste del equipo suma sus tres llamadas.</p><p className={styles.muted}>Mismo encargo y catálogo del ensayo individual. Es otra arquitectura: aún no demuestra mejor diseño. Modelos candidatos y revisión visual pendiente; no cambia la configuración productiva de A11.</p><Button variant="secondary" onClick={() => { setChannel("email_klaviyo"); setMode("original"); setLeft("gpt-6.1-sol"); setRight("a11-specialists-pilot"); }}>Comparar Sol con el equipo</Button></div> : null}
      {verdict ? <div className={styles.verdict}><Heading level={2} size="md">{verdict.title}</Heading><p>{verdict.recommendation}</p><ul>{verdict.channel_notes.map((note) => <li key={note}>{note}</li>)}</ul><p className={styles.muted}>{verdict.limitations.join(" ")}</p></div> : <p className={styles.muted}>Conclusión editorial pendiente. Pasar el contrato o costar menos no demuestra mejor diseño.</p>}
      <div className={styles.controls}>
        <label>Canal<Select value={channel} onChange={setChannel} options={[{ value: "email_klaviyo", label: "Email" }, { value: "meta_ads", label: "Anuncio de Meta" }, { value: "instagram_organic", label: "Instagram" }]} /></label>
        <label>Método<Select value={mode} onChange={setMode} options={[{ value: "original", label: "Crear desde cero" }, { value: "guided", label: "Guiado por principios internos" }]} /></label>
        <Button variant="secondary" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? "Vista móvil · 360 px" : "Vista adaptable"}</Button>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}><caption>Modelos y pilotos disponibles · {channel === "email_klaviyo" ? "email" : channel === "meta_ads" ? "Meta" : "Instagram"} · {mode === "original" ? "desde cero" : "guiado"}</caption><thead><tr><th>Modelo</th><th>Estado y observaciones</th><th>API estimada</th><th>Tiempo CLI</th><th>Comparar</th></tr></thead><tbody>{rows.map((row) => {
        const draft = draftFor(row.model_id), lab = draft?.request?.ai_lab;
        return <tr key={row.model_id}><th scope="row">{row.model_label}<small>{row.model_verified ? "ID confirmado por CLI" : "ID solicitado; no confirmado"}</small></th><td>{row.status === "completed" ? "Completado" : row.status === "failed" ? "Falló la ejecución" : "Pendiente"}{row.error ? <p>{row.error}</p> : null}{lab?.editorial_review ? <p>{lab.editorial_review.summary}</p> : <p>{lab?.issues?.length ? `${lab.issues.length} puntos a revisar` : "Revisión editorial pendiente"}</p>}</td><td>{comparisonPrice(row.price)}</td><td>{row.duration_ms === null ? "—" : `${(row.duration_ms / 1000).toFixed(1)} s`}</td><td><div className={styles.actions}><Button size="sm" variant="secondary" aria-pressed={left === row.model_id} onClick={() => setLeft(row.model_id)}>Ver A</Button><Button size="sm" variant="secondary" aria-pressed={right === row.model_id} onClick={() => setRight(row.model_id)}>Ver B</Button></div></td></tr>;
      })}</tbody></table></div>
      <div className={styles.comparison}>
        <details className={styles.details}><summary>Simular el coste mensual de este canal</summary><label>Piezas al mes<Input type="number" min={0} max={10000} value={monthlyPieces} onChange={(event) => setMonthlyPieces(Math.max(0, Math.min(10000, Number(event.target.value) || 0)))} /></label><p className={styles.muted}>A11 genera al pedir una pieza. Verla desde cliente y consultor no duplica la ejecución. Cuatro piezas es solo el ejemplo inicial, no una frecuencia automática.</p><ul>{rows.map((row) => <li key={row.model_id}>{row.model_label}: {comparisonPrice(row.price ? { low: row.price.low * monthlyPieces, high: row.price.high * monthlyPieces } : null)} / mes</li>)}</ul></details>
        <Preview label="Pieza A" row={rows.find((row) => row.model_id === left)} draft={draftFor(left)} models={models} model={left} onModel={setLeft} mobile={mobile} onOpen={onOpen} />
        <Preview label="Pieza B" row={rows.find((row) => row.model_id === right)} draft={draftFor(right)} models={models} model={right} onModel={setRight} mobile={mobile} onOpen={onOpen} />
      </div>
      <details className={styles.details}><summary>Ver encargo, productos y límites de la prueba</summary><p className={styles.brief}>{drafts.find((draft) => draft.request?.ai_lab?.case_id === `${channel}-${mode}`)?.request?.brief}</p><ul>{metadata.products?.map((product) => <li key={product.id}>{product.title} · {product.price === null ? "Precio no disponible" : `${product.price} ${product.currency ?? ""}`} · {product.product_url ? <a href={product.product_url} target="_blank" rel="noreferrer">Ver producto</a> : "Sin enlace"}</li>)}</ul><ul>{metadata.limitations?.map((limit) => <li key={limit}>{limit}</li>)}</ul><p className={styles.muted}>Las comprobaciones automáticas detectan fallos concretos; la valoración editorial y visual se muestra por separado. No se mide conversión comercial con estas pruebas.</p></details>
    </> : null}
  </section>;
}

function Preview({ label, row, draft, models, model, onModel, mobile, onOpen }: { label: string; row: LabManifestRow | undefined; draft: MarketingDraft | undefined; models: Array<{ value: string; label: string }>; model: string; onModel: (model: string) => void; mobile: boolean; onOpen: (draft: MarketingDraft) => void }) {
  const metadata = draft?.request?.ai_lab;
  const output = draft?.request?.lab_original_output;
  const email = draft?.request?.channel === "email_klaviyo";
  const originalHtml = typeof output?.html === "string" ? output.html : draft?.html ?? "";
  const originalText = typeof output?.primary_text === "string" ? output.primary_text : typeof output?.caption === "string" ? output.caption : draft?.plain_text ?? "";
  const originalSubject = [output?.subject, output?.headline, output?.title].find((value): value is string => typeof value === "string") ?? draft?.subject;
  const originalPreheader = typeof output?.preheader === "string" ? output.preheader : draft?.preheader;
  const direction = typeof output?.creative_brief === "string" ? output.creative_brief : Array.isArray(output?.creative_notes) ? output.creative_notes.filter((note): note is string => typeof note === "string").join("\n") : "";
  return <article className={styles.piece}>
    <label className={styles.pieceHeader}>{label}<Select value={model} onChange={onModel} options={models} /></label>
    {!draft ? <><p role="status">{row?.status === "failed" ? "No hay pieza válida para mostrar. Consulta el error de la ejecución." : "Esta pieza aún no está disponible."}</p>{row?.raw_response ? <details className={styles.details}><summary>Ver la respuesta original rechazada</summary><pre className={styles.brief}>{row.raw_response}</pre></details> : null}</> : <>
      <div className={styles.pieceMeta}><strong>{originalSubject}</strong><p>{originalPreheader}</p><p>{comparisonPrice({ low: metadata?.estimated_api_cost_low ?? NaN, high: metadata?.estimated_api_cost_high ?? NaN })} · {metadata?.model_label}</p><Button size="sm" variant="secondary" onClick={() => onOpen(draft)}>Abrir borrador en el Estudio</Button></div>
      {email ? <div className={styles.emailFrame} style={{ maxWidth: mobile ? 360 : undefined }}><iframe title={`Email de ${metadata?.model_label} · ${label}`} sandbox="" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://cdn.shopify.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${originalHtml}`} /></div> : <div className={styles.social}><p className={styles.muted}>Fotos de origen; el modelo aún no ha producido el creativo compuesto.</p><div className={styles.sourcePhotos}>{metadata?.products?.map((product) => product.image_url ? <Image key={product.id} src={product.image_url} alt={product.title} width={1600} height={1600} unoptimized loading="lazy" /> : null)}</div><p className={styles.brief}>{originalText}</p>{Array.isArray(output?.hashtags) ? <p className={styles.muted}>{output.hashtags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.startsWith("#") ? tag : `#${tag}`).filter((tag) => !originalText.includes(tag)).join(" ")}</p> : null}<Heading level={3} size="md">Dirección visual propuesta</Heading><p className={styles.brief}>{direction}</p></div>}
      {metadata?.editorial_review ? <div className={styles.review}><strong>{metadata.editorial_review.recommendation}</strong><p>{metadata.editorial_review.summary}</p><ul>{metadata.editorial_review.strengths.map((text) => <li key={text}>A favor: {text}</li>)}{metadata.editorial_review.weaknesses.map((text) => <li key={text}>A revisar: {text}</li>)}</ul></div> : null}
      {draft.request?.specialist_pipeline ? <details className={styles.details}><summary>Qué hizo cada subagente y cuánto costó</summary><p>Revisión visual del email renderizado: pendiente. La opinión del revisor es una evaluación automática.</p>{draft.request.specialist_pipeline.stages.map((stage) => <details key={stage.stage}><summary>{stage.stage === "narrative" ? "Redacción" : stage.stage === "design" ? "Diseño HTML" : "Revisión de contenido"} · {stage.model} · {comparisonPrice(stage.price)}</summary><p>{(stage.duration_ms / 1000).toFixed(1)} s · {stage.model_verified ? "ID confirmado" : "ID solicitado; no confirmado"}</p><pre className={styles.brief}>{JSON.stringify(stage.output, null, 2)}</pre></details>)}</details> : null}
      <details className={styles.details}><summary>Comprobaciones y advertencias</summary><ul>{metadata?.checks?.map((check) => <li key={check.label}><strong>{check.status === "pass" ? "Correcto" : check.status === "fail" ? "Fallo" : "Revisar"} · {check.label}:</strong> {check.detail}</li>)}</ul><ul>{draft.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul><p className={styles.muted}>Contexto: {metadata?.context_hash?.slice(0,12)} · Prompt: {metadata?.prompt_hash?.slice(0,12)}. Respuesta original conservada en el borrador y los recibos del laboratorio.</p></details>
    </>}
  </article>;
}
