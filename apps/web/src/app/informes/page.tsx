"use client";

import { useState } from "react";
import s from "./informes.module.css";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  Select,
  SettingRow,
  Sheet,
  Table,
  toast,
  type Tone,
} from "@/components/ui";

/**
 * Informes: dónde quedan los PDF que se generan (copiloto, botón «Nuevo
 * informe», envío mensual) y el informe de cartera del consultor. Antes un
 * informe solo vivía en el mensaje del chat que lo pidió.
 */

type KeyMetric = { section: string; label: string; value: string; previous: string | null; change_pct: number | null };
type ReportRow = {
  id: string;
  template_id: string;
  title: string;
  period_start: string;
  period_end: string;
  file_name: string;
  source: "copilot" | "scheduled" | "portfolio";
  prepared_by: string | null;
  highlights: string[];
  recommendations: string[];
  key_metrics?: KeyMetric[];
  emailed_to: string[];
  created_at: string;
};
type Schedule = { id: string; template_id: string; recipients: string[]; is_active: boolean; last_period_end: string | null };
type Template = { id: string; name: string; description: string };
type ReportsResponse = {
  reports: ReportRow[];
  schedules: Schedule[];
  can_manage: boolean;
  templates: Template[];
  stores: Array<{ id: string; name: string }>;
};

const SOURCE: Record<ReportRow["source"], { label: string; tone: Tone }> = {
  copilot: { label: "Bajo demanda", tone: "neutral" },
  scheduled: { label: "Envío mensual", tone: "brand" },
  portfolio: { label: "Cartera", tone: "brand" },
};

const dateLabel = (value: string, withYear = true) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
const periodLabel = (report: Pick<ReportRow, "period_start" | "period_end">) =>
  `${dateLabel(report.period_start, false)} – ${dateLabel(report.period_end)}`;

async function openReport(organizationId: string, report: ReportRow) {
  // Se abre la pestaña antes del await: si no, el navegador la bloquea como popup.
  const tab = window.open("", "_blank");
  try {
    const response = await apiFetch(`/v1/organizations/${organizationId}/copilot-reports/${report.id}/link?file_name=${encodeURIComponent(report.file_name)}`);
    if (!response.ok) throw new Error(await readApiError(response));
    const { download_url: url } = (await response.json()) as { download_url?: string };
    if (!url) throw new Error("El informe ya no está disponible.");
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (cause) {
    tab?.close();
    toast.danger(cause instanceof Error ? cause.message : "No se pudo abrir el PDF.");
  }
}

function ReportSheet({ organizationId, report, onClose }: { organizationId: string; report: ReportRow | null; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  if (!report) return null;

  const send = async () => {
    setSending(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/copilot-reports/${report.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, file_name: report.file_name }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success(`Informe enviado a ${email.trim()}`);
      setEmail("");
      invalidateCachedQueries(`/v1/organizations/${organizationId}/reports`);
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo enviar el informe.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={report.title}
      meta={<span className="text-sm text-muted">{periodLabel(report)} · <Badge tone={SOURCE[report.source].tone}>{SOURCE[report.source].label}</Badge></span>}
      headerActions={<Button size="sm" onClick={() => void openReport(organizationId, report)}>Abrir PDF</Button>}
    >
      <div className="space-y-6">
        {report.highlights.length ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Lectura del periodo</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{report.highlights.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>
        ) : null}
        {report.recommendations.length ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Recomendaciones</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{report.recommendations.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>
        ) : null}
        {report.key_metrics?.length ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Cifras clave</h3>
            <Table
              ariaLabel="Cifras clave del informe"
              mobileLayout="list"
              rows={report.key_metrics.map((metric, index) => ({ ...metric, id: `${index}` }))}
              columns={[
                { key: "label", label: "Indicador" },
                { key: "value", label: "Valor" },
                {
                  key: "change_pct",
                  label: "vs. anterior",
                  render: (metric) => metric.change_pct === null ? "—" : `${metric.change_pct > 0 ? "+" : ""}${metric.change_pct.toLocaleString("es-ES")} %`,
                },
              ]}
            />
          </section>
        ) : null}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Enviar por correo</h3>
          <div className="flex gap-2">
            <Input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Correo del destinatario" />
            <Button disabled={sending || !email.trim()} onClick={() => void send()}>{sending ? "Enviando…" : "Enviar"}</Button>
          </div>
          {report.emailed_to.length ? <p className="mt-2 text-xs text-muted">Ya enviado a {report.emailed_to.join(", ")}</p> : null}
        </section>
      </div>
    </Sheet>
  );
}

function ReportsTable({ organizationId, reports }: { organizationId: string; reports: ReportRow[] }) {
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [search, setSearch] = useState("");
  const matching = reports.filter((report) => `${report.title} ${SOURCE[report.source].label} ${periodLabel(report)}`.toLocaleLowerCase("es-ES").includes(search.trim().toLocaleLowerCase("es-ES")));
  return (
    <>
      <div className={s.toolbar}>
        <div className={s.search}><Input type="search" aria-label="Buscar informes por título, periodo u origen" placeholder="Buscar por título, periodo u origen" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <span className={s.count} role="status">{matching.length} de {reports.length} informes</span>
      </div>
      <Table
        ariaLabel="Informes generados"
        rows={matching}
        emptyLabel="No hay informes que coincidan. Prueba otra búsqueda."
        columns={[
          {
            key: "title",
            label: "Informe",
            render: (report) => (
              <button type="button" className="text-left" onClick={() => setSelected(report)}>
                <span className="font-medium">{report.title}</span>
                {report.highlights[0] ? <span className="mt-0.5 block max-w-xl truncate text-xs text-muted">{report.highlights[0]}</span> : null}
              </button>
            ),
          },
          { key: "period", label: "Periodo", render: periodLabel },
          { key: "source", label: "Origen", render: (report) => <Badge tone={SOURCE[report.source].tone}>{SOURCE[report.source].label}</Badge> },
          { key: "created_at", label: "Creado", render: (report) => dateLabel(report.created_at) },
          {
            key: "actions",
            label: "Acciones",
            render: (report) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(report)}>Ver</Button>
                <Button size="sm" variant="secondary" onClick={() => void openReport(organizationId, report)}>PDF</Button>
              </div>
            ),
          },
        ]}
      />
      <ReportSheet organizationId={organizationId} report={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function NewReportDialog({ organizationId, data, isOpen, onOpenChange }: { organizationId: string; data: ReportsResponse; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [templateId, setTemplateId] = useState("resumen_multicanal");
  const [period, setPeriod] = useState("last_month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [storeId, setStoreId] = useState(data.stores[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          ...(data.stores.length > 1 && storeId ? { store_id: storeId } : {}),
          ...(period === "custom" ? { period_start: start, period_end: end } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success("Informe generado", { description: "Ya está en la lista. Para que incluya la lectura del copiloto, pídeselo en el chat." });
      invalidateCachedQueries(`/v1/organizations/${organizationId}/reports`);
      onOpenChange(false);
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo generar el informe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isBusy={busy}
      title="Nuevo informe"
      primary={{ label: "Generar PDF", busyLabel: "Generando…", onClick: () => void generate(), disabled: period === "custom" && (!start || !end) }}
    >
      <SettingRow label="Plantilla" hint={data.templates.find((template) => template.id === templateId)?.description}>
        <Select aria-label="Plantilla" value={templateId} onChange={setTemplateId} options={data.templates.map((template) => ({ value: template.id, label: template.name }))} />
      </SettingRow>
      {data.stores.length > 1 ? (
        <SettingRow label="Tienda" hint="Un informe es de una tienda: no se mezclan monedas.">
          <Select aria-label="Tienda" value={storeId} onChange={setStoreId} options={data.stores.map((store) => ({ value: store.id, label: store.name }))} />
        </SettingRow>
      ) : null}
      <SettingRow label="Periodo">
        <Select aria-label="Periodo" value={period} onChange={setPeriod} options={[{ value: "last_month", label: "Último mes completo" }, { value: "custom", label: "Fechas concretas (máx. 92 días)" }]} />
      </SettingRow>
      {period === "custom" ? (
        <SettingRow label="Fechas">
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Desde" value={start} onChange={(event) => setStart(event.target.value)} />
            <span className="text-muted">–</span>
            <Input type="date" aria-label="Hasta" value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
        </SettingRow>
      ) : null}
    </Dialog>
  );
}

function SchedulesCard({ organizationId, data }: { organizationId: string; data: ReportsResponse }) {
  const [templateId, setTemplateId] = useState("resumen_multicanal");
  const [recipients, setRecipients] = useState("");
  const [busy, setBusy] = useState(false);
  const templateName = (id: string) => data.templates.find((template) => template.id === id)?.name ?? id;
  const reload = () => invalidateCachedQueries(`/v1/organizations/${organizationId}/reports`);

  const save = async (body: { template_id: string; recipients: string[]; is_active?: boolean }) => {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/report-schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      reload();
      return true;
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo guardar el envío.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (schedule: Schedule) => {
    const response = await apiFetch(`/v1/organizations/${organizationId}/report-schedules/${schedule.id}`, { method: "DELETE" });
    if (!response.ok) toast.danger(await readApiError(response));
    reload();
  };

  return (
    <Card headingLevel={2} title="Envío mensual" description="El día 1 de cada mes se genera el informe del mes anterior y se envía por correo.">
      {data.schedules.length ? (
        <ul className="mb-4 divide-y divide-separator">
          {data.schedules.map((schedule) => (
            <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{templateName(schedule.template_id)} {schedule.is_active ? null : <Badge>Pausado</Badge>}</p>
                <p className="text-muted">{schedule.recipients.join(", ")}{schedule.last_period_end ? ` · último: ${dateLabel(schedule.last_period_end)}` : ""}</p>
              </div>
              {data.can_manage ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save({ template_id: schedule.template_id, recipients: schedule.recipients, is_active: !schedule.is_active })}>
                    {schedule.is_active ? "Pausar" : "Reanudar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(schedule)}>Quitar</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {data.can_manage ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const list = recipients.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
            void save({ template_id: templateId, recipients: list }).then((ok) => ok && setRecipients(""));
          }}
        >
          <div className="w-56"><p className="mb-2 text-sm font-medium">Plantilla del envío</p><Select aria-label="Plantilla del envío" value={templateId} onChange={setTemplateId} options={data.templates.map((template) => ({ value: template.id, label: template.name }))} /></div>
          <div className="min-w-0 flex-1 basis-64"><label className="mb-2 block text-sm font-medium" htmlFor="report-recipients">Destinatarios</label><Input id="report-recipients" aria-label="Destinatarios" placeholder="correos separados por comas" value={recipients} onChange={(event) => setRecipients(event.target.value)} /></div>
          <Button type="submit" disabled={busy || !recipients.trim()}>Programar</Button>
        </form>
      ) : data.schedules.length ? null : (
        <p className="text-sm text-muted">No hay envíos programados. Los configura tu consultor o el propietario de la cuenta.</p>
      )}
    </Card>
  );
}

function OrganizationReports({ organizationId }: { organizationId: string }) {
  const query = useCachedQuery<ReportsResponse>(`/v1/organizations/${organizationId}/reports`);
  const [creating, setCreating] = useState(false);
  if (query.isLoading) return <LoadingBlock label="Cargando informes..." />;
  if (query.error || !query.data) return <div className="space-y-4"><ErrorBlock>No se pudieron cargar los informes. Revisa la conexión e inténtalo de nuevo.</ErrorBlock><Button variant="secondary" onClick={query.reload}>Reintentar la carga</Button></div>;
  const data = query.data;
  return (
    <div className="space-y-4">
      <header className={s.header}>
        <div><h1>Informes de tu tienda</h1><p>Revisa las conclusiones del periodo, consulta el PDF y gestiona tus envíos mensuales.</p></div>
        <dl className={s.stats}>
          <div><dt>Informes disponibles</dt><dd>{data.reports.length}</dd></div>
          <div><dt>Envíos mensuales activos</dt><dd>{data.schedules.filter((schedule) => schedule.is_active).length}</dd></div>
        </dl>
      </header>
      <Card
        headingLevel={2}
        title="Biblioteca de informes"
        description="Los PDF generados desde el copiloto, desde aquí o en el envío mensual."
        actions={<Button onClick={() => setCreating(true)}>Nuevo informe</Button>}
      >
        {data.reports.length ? (
          <ReportsTable organizationId={organizationId} reports={data.reports} />
        ) : (
          <EmptyState title="Aún no hay informes" hint="Genera uno aquí o pídeselo al copiloto («hazme el resumen ejecutivo del mes pasado»)." />
        )}
      </Card>
      <SchedulesCard organizationId={organizationId} data={data} />
      {creating ? <NewReportDialog organizationId={organizationId} data={data} isOpen={creating} onOpenChange={setCreating} /> : null}
    </div>
  );
}

/** Sin cliente activo, el consultor ve los informes de cartera de su consultora. */
function PortfolioReports() {
  const consultora = useCachedQuery<{ consultora: { organization_id: string } | null }>("/v1/consultant/consultora");
  const organizationId = consultora.data?.consultora?.organization_id ?? null;
  const query = useCachedQuery<ReportsResponse>(organizationId ? `/v1/organizations/${organizationId}/reports` : null);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await apiFetch("/v1/consultant/portfolio-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days) }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success("Informe de cartera generado");
      if (organizationId) invalidateCachedQueries(`/v1/organizations/${organizationId}/reports`);
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo generar el informe de cartera.");
    } finally {
      setBusy(false);
    }
  };

  if (consultora.isLoading || (organizationId && query.isLoading)) return <LoadingBlock label="Cargando informes..." />;
  if (consultora.error) return <div className="space-y-4"><ErrorBlock>No se pudo cargar tu consultoría.</ErrorBlock><Button variant="secondary" onClick={consultora.reload}>Reintentar la carga</Button></div>;
  if (!organizationId) {
    return <EmptyState title="Elige un cliente" hint="Los informes son de cada cliente. Selecciónalo en la cabecera para ver los suyos." />;
  }
  const reports = (query.data?.reports ?? []).filter((report) => report.source === "portfolio");
  return (
    <div className="space-y-4">
      <header className={s.header}><div><h1>Informes de cartera</h1><p>Una lectura conjunta de tus clientes para preparar la revisión y compartir conclusiones con el equipo.</p></div></header>
      <Card
        headingLevel={2}
        title="Biblioteca de la cartera"
        description="Facturación, beneficio y estado de cada cliente, con las cifras del Panel de rentabilidad. Para los informes de un cliente, elígelo en la cabecera."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40"><Select aria-label="Periodo" value={days} onChange={setDays} options={[{ value: "30", label: "Últimos 30 días" }, { value: "90", label: "Últimos 90 días" }]} /></div>
            <Button disabled={busy} onClick={() => void generate()}>{busy ? "Generando…" : "Generar"}</Button>
          </div>
        }
      >
        {query.error ? (
          <div className="space-y-4"><ErrorBlock>No se pudieron cargar los informes de cartera.</ErrorBlock><Button variant="secondary" onClick={query.reload}>Reintentar la carga</Button></div>
        ) : reports.length ? (
          <ReportsTable organizationId={organizationId} reports={reports} />
        ) : (
          <EmptyState title="Aún no hay informes de cartera" hint="Genera el primero: una página con toda tu cartera para revisar o compartir con tu equipo." />
        )}
      </Card>
    </div>
  );
}

function ReportsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const consultant = ["consultant", "platform_admin"].includes(bootstrap.profile.platform_role);
  if (organizationId) return <OrganizationReports organizationId={organizationId} />;
  return consultant ? <PortfolioReports /> : <EmptyState title="Sin tienda activa" hint="Cuando tengas una tienda conectada, sus informes aparecerán aquí." />;
}

export default function ReportsPage() {
  return (
    <PortalShell title="Informes">
      {(bootstrap: BootstrapResponse) => <div className={s.page}><ReportsContent bootstrap={bootstrap} /></div>}
    </PortalShell>
  );
}
