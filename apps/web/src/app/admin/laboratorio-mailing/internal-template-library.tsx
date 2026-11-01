"use client";

import { useState } from "react";
import Image from "next/image";
import { internalEmailTemplateSchema, renderInternalEmailTemplate, type InternalEmailTemplate } from "@e-nora/contracts";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, ErrorBlock, Field, IconChevronDown, ScrollArea, Textarea, toast, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui";

export type InternalTemplateSummary = { id: string; entry_key: string; title: string; version: number; status: string; template_key?: string | null; template_description?: string | null };
type Entry = { id: string; entry_key: string; title: string; version: number; kind: string; objective: string; audience_tags: string[]; lifecycle_tags: string[]; content: Record<string, unknown> & { raw_html?: string }; evidence: Record<string, unknown>; source: Record<string, unknown> };

export function InternalTemplateLibrary({ entries, onChanged }: { entries: InternalTemplateSummary[]; onChanged: () => void }) {
  const [selected, setSelected] = useState<{ entry: Entry; template: InternalEmailTemplate } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(600);
  const [dirty, setDirty] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<InternalTemplateSummary | null>(null);
  const unique = new Map<string, InternalTemplateSummary>();
  for (const entry of entries) if (entry.template_key && entry.status !== "retired" && (!unique.has(entry.entry_key) || unique.get(entry.entry_key)!.version < entry.version)) unique.set(entry.entry_key, entry);
  const templates = [...unique.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
  if (!templates.length) return null;

  let html = "", validationError: string | null = null;
  if (selected) {
    try { html = renderInternalEmailTemplate(selected.entry.content.raw_html ?? "", selected.template, values); }
    catch (cause) { validationError = cause instanceof Error ? `Revisa el campo: ${cause.message.split(":").at(-1)}` : "Revisa los campos de la plantilla."; }
  }
  async function open(entry: InternalTemplateSummary, discard = false) {
    if (dirty && !discard) { setPendingOpen(entry); return; }
    setBusy(true); setError(null);
    try {
      const response = await apiFetch(`/v1/admin/marketing-playbook/${entry.id}`);
      if (!response.ok) throw new Error(await readApiError(response));
      const detail = await response.json() as Entry;
      const template = internalEmailTemplateSchema.parse(detail.content.template);
      if (!detail.content.raw_html) throw new Error("La plantilla no tiene HTML guardado.");
      setSelected({ entry: detail, template }); setValues(Object.fromEntries(template.variables.map((item) => [item.key, item.example]))); setDirty(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir la plantilla."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!selected || validationError) return;
    setBusy(true); setError(null);
    try {
      const template = { ...selected.template, variables: selected.template.variables.map((field) => ({ ...field, example: values[field.key] ?? field.example })) };
      const { kind, title, objective, audience_tags, lifecycle_tags, content, evidence, source } = selected.entry;
      const response = await apiFetch(`/v1/admin/marketing-playbook/${selected.entry.id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, title, objective, audience_tags, lifecycle_tags, content: { ...content, template }, evidence, source }) });
      if (!response.ok) throw new Error(await readApiError(response));
      const saved = await response.json() as Entry;
      setSelected({ entry: saved, template }); setDirty(false); onChanged(); toast.success("Nueva versión interna guardada.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la versión."); }
    finally { setBusy(false); }
  }
  function download(replaceable: boolean) {
    if (!selected || validationError) return;
    const contents = replaceable ? JSON.stringify({ title: selected.entry.title, objective: selected.entry.objective, template: selected.template, raw_html: selected.entry.content.raw_html, example_values: values,
      editorial_context: Object.fromEntries(Object.entries(selected.entry.content).filter(([key]) => !["template", "raw_html", "reference_profile"].includes(key))), evidence: selected.entry.evidence, source: selected.entry.source, origin: "manually_curated_reference_not_model_benchmark_output" }, null, 2) : html.replaceAll('src="/marketing-demo/', `src="${window.location.origin}/marketing-demo/`);
    const url = URL.createObjectURL(new Blob([contents], { type: replaceable ? "application/json" : "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selected.template.key}.${replaceable ? "json" : "html"}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="space-y-5" aria-labelledby="internal-templates-title">
    <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Biblioteca interna · E-NORA</p><h2 id="internal-templates-title" className="mt-2 text-2xl font-semibold">{templates.length} estructuras, un lienzo reemplazable</h2><p className="mt-2 max-w-3xl text-sm text-muted">Composiciones propias a partir de tus referencias. Marca, producto, imagen, textos, colores y enlaces se sustituyen por campos. Cada plantilla conserva su contexto editorial para comparar modelos con el mismo encargo. Permanecen en plataforma.</p></div>
    {error && <ErrorBlock>{error}</ErrorBlock>}
    <div className="grid gap-4 md:grid-cols-3">{templates.map((entry) => <Card key={entry.entry_key}><CardContent className="space-y-3">
      <div className="relative h-72 overflow-hidden rounded-md bg-surface-secondary"><Image src={`/marketing-demo/${entry.template_key}.png`} alt={`Vista de ejemplo: ${entry.title}`} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover object-top" /></div>
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{entry.title}</h3><Badge>v{entry.version}</Badge></div><p className="text-sm text-muted">{entry.template_description}</p><Button variant="secondary" disabled={busy} onClick={() => void open(entry)}>Ver y personalizar</Button>
    </CardContent></Card>)}</div>
    {selected && <div className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{selected.entry.title}</h3><p className="mt-1 text-sm text-muted">v{selected.entry.version} · Ejemplo ficticio · {selected.template.variables.length} campos reemplazables</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setWidth(width === 600 ? 360 : 600)}>{width === 600 ? "Ver móvil" : "Ver escritorio"}</Button><Button size="sm" variant="secondary" disabled={busy || !!validationError} onClick={() => download(false)}>Descargar HTML</Button><Button size="sm" variant="secondary" disabled={busy || !!validationError} onClick={() => download(true)}>Descargar plantilla</Button><Button size="sm" disabled={busy || !!validationError || !dirty} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar versión"}</Button></div></div>
      <Collapsible key={selected.entry.entry_key} className="rounded-lg border border-line p-4" defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left font-medium">Contexto editorial de esta plantilla<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
        <CollapsibleContent><div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          {[{ label: "Objetivo", value: selected.entry.objective }, ...[["when_to_use", "Cuándo usarla"], ["when_not_to_use", "Cuándo evitarla"], ["sequence_arc", "Estructura"], ["visual_direction", "Dirección visual"], ["cta_guidance", "Acción principal"], ["lesson", "Qué evaluar"]].map(([key, label]) => ({ label, value: selected.entry.content[key!] }))].map((item) => typeof item.value === "string" && item.value ? <div key={item.label}><p className="font-medium">{item.label}</p><p className="mt-1 whitespace-pre-wrap leading-6 text-muted">{item.value}</p></div> : null)}
          {Array.isArray(selected.entry.content.risks) && <div><p className="font-medium">Riesgos y evidencia necesaria</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{selected.entry.content.risks.filter((item): item is string => typeof item === "string").map((item) => <li key={item}>{item}</li>)}</ul></div>}
          <p className="text-xs text-muted md:col-span-2">Referencia de diseño curada manualmente. Las salidas de cada modelo se conservarán y evaluarán por separado; estas plantillas no son resultados de Opus ni prueban rendimiento comercial.</p>
        </div></CollapsibleContent>
      </Collapsible>
      <p className="text-xs text-muted">Los cambios actualizan la vista previa. Guardar crea una versión, sin publicar ni enviar. Los enlaces example.com y la imagen ficticia son de demostración: sustitúyelos antes de usar la pieza.</p>
      {validationError && <ErrorBlock>{validationError}</ErrorBlock>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.35fr)]"><ScrollArea className="grid max-h-[900px] gap-3 pr-2">{selected.template.variables.map((field) => <Field key={field.key} label={field.label}><Textarea rows={field.kind === "text" && (values[field.key]?.length ?? 0) > 80 ? 3 : 1} value={values[field.key] ?? ""} disabled={busy} spellCheck={field.kind === "text"} onChange={(event) => { setValues((current) => ({ ...current, [field.key]: event.target.value })); setDirty(true); }} /><span className="text-xs text-muted">{`{{${field.key}}}`} · {field.kind === "color" ? "Color hexadecimal" : field.kind === "url" || field.kind === "image" ? "URL HTTPS" : "Texto"}</span></Field>)}</ScrollArea>
        <ScrollArea className="min-w-0 rounded-lg bg-surface-secondary p-2"><iframe title={`Vista previa ${selected.entry.title}`} sandbox="" referrerPolicy="no-referrer" srcDoc={html} style={{ width, maxWidth: "100%", height: 1000, border: 0, display: "block", margin: "0 auto", background: "white" }} /></ScrollArea>
      </div>
    </div>}
    <AlertDialog open={pendingOpen !== null} onOpenChange={(next) => !next && setPendingOpen(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar los cambios sin guardar?</AlertDialogTitle>
          <AlertDialogDescription>Si abres otra plantilla, se pierden los cambios de esta.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir editando</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { const entry = pendingOpen; setPendingOpen(null); if (entry) void open(entry, true); }}>Descartar y abrir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
