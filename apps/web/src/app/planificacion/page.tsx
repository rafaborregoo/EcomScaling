"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { Badge, Banner, Button, ButtonLink, Card, ErrorBlock, EYEBROW, Heading, LoadingBlock, Metric, Modal, Select } from "@/components/ui";

type Metrics = { sales?: { net_sales?: number; orders_count?: number }; financial?: { net_profit?: number }; acquisition?: { spend?: number; roas?: number | null; cac?: number | null } };
type Item = { id: string; title: string; channel: string; starts_at: string; status: string };
type Planning = { calendars?: Array<{ id: string; name: string; year: number }>; items?: Item[] };
type Resources = { drafts: Array<{ id: string; subject: string }>; metaCampaigns: Array<{ id: string; name: string }>; klaviyoCampaigns: Array<{ id: string; name: string }>; milestones: Array<{ id: string; name: string }> };
type Snapshot = { id: string; period_start: string; period_end: string; net_sales: number | null };

function PlanningContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const isConsultant = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [planning, setPlanning] = useState<Planning>({ calendars: [], items: [] });
  const [resources, setResources] = useState<Resources>({ drafts: [], metaCampaigns: [], klaviyoCampaigns: [], milestones: [] });
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"action" | "tracking" | "history" | null>(null);
  const [action, setAction] = useState({ title: "", date: new Date().toISOString().slice(0, 10), channel: "Email", draftId: "", metaId: "", klaviyoId: "", milestoneId: "", createTask: false });
  const [tracking, setTracking] = useState({ revenue: "", orders: "", adSpend: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const money = (value: number | null | undefined) => value == null ? "—" : formatMoney(value);

  useEffect(() => {
    if (!organizationId || !isConsultant) { setLoading(false); return; }
    let cancelled = false;
    const query = new URLSearchParams({ days: "30" });
    if (connectionId) query.set("connectionId", connectionId);
    setLoading(true);
    Promise.all([
      apiFetch(`/v1/organizations/${organizationId}/shopify/metrics?${query}`).then((r) => r.ok ? r.json() : {}) as Promise<Metrics>,
      apiFetch(`/v1/organizations/${organizationId}/meta/metrics?${query}`).then((r) => r.ok ? r.json() : {}) as Promise<Pick<Metrics, "acquisition">>,
      apiFetch(`/v1/organizations/${organizationId}/campaign-planning${connectionId ? `?storeId=${encodeURIComponent(connectionId)}` : ""}`).then((r) => r.ok ? r.json() : {}) as Promise<Planning>,
      apiFetch(`/v1/organizations/${organizationId}/campaign-planning/resources`).then((r) => r.ok ? r.json() : {}) as Promise<Resources>,
      apiFetch(`/v1/organizations/${organizationId}/kpi-snapshots${connectionId ? `?storeId=${encodeURIComponent(connectionId)}` : ""}`).then((r) => r.ok ? r.json() : {}) as Promise<{ snapshots?: Snapshot[] }>,
    ]).then(([shopify, meta, calendar, resourcePayload, snapshotPayload]) => {
      if (cancelled) return;
      setMetrics({ ...shopify, acquisition: meta.acquisition });
      setPlanning(calendar);
      setResources({ drafts: resourcePayload.drafts ?? [], metaCampaigns: resourcePayload.metaCampaigns ?? [], klaviyoCampaigns: resourcePayload.klaviyoCampaigns ?? [], milestones: resourcePayload.milestones ?? [] });
      setSnapshots(snapshotPayload.snapshots ?? []);
    }).catch(() => { if (!cancelled) setError("No se pudo cargar la planificación."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connectionId, isConsultant, organizationId]);

  async function refreshPlanning() {
    if (!organizationId) return;
    const response = await apiFetch(`/v1/organizations/${organizationId}/campaign-planning${connectionId ? `?storeId=${encodeURIComponent(connectionId)}` : ""}`);
    if (response.ok) setPlanning(await response.json() as Planning);
  }
  async function markCompleted(itemId: string) {
    if (!organizationId) return;
    const response = await apiFetch(`/v1/organizations/${organizationId}/campaign-planning/items/${itemId}/execution`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    if (!response.ok) { setError("No se pudo registrar la ejecución."); return; }
    await refreshPlanning();
  }
  async function createAction() {
    const calendarId = planning.calendars?.[0]?.id;
    if (!organizationId || !calendarId || !action.title.trim()) { setError("Carga una guía o crea un calendario antes de añadir una acción."); return; }
    setBusy(true);
    const response = await apiFetch(`/v1/organizations/${organizationId}/campaign-planning/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendarId, title: action.title, channel: action.channel, startsAt: `${action.date}T09:00:00.000Z`, storeId: connectionId || null, createTask: action.createTask, milestoneId: action.milestoneId || null, marketingDraftId: action.draftId || null, metaCampaignId: action.metaId || null, klaviyoCampaignId: action.klaviyoId || null }) });
    setBusy(false);
    if (!response.ok) { setError("No se pudo crear la acción."); return; }
    setModal(null); setAction({ title: "", date: new Date().toISOString().slice(0, 10), channel: "Email", draftId: "", metaId: "", klaviyoId: "", milestoneId: "", createTask: false }); await refreshPlanning();
  }
  async function saveTracking() {
    if (!organizationId) return;
    setBusy(true);
    const revenue = tracking.revenue ? Number(tracking.revenue.replace(",", ".")) : null;
    const orders = tracking.orders ? Number(tracking.orders) : null;
    const adSpend = tracking.adSpend ? Number(tracking.adSpend.replace(",", ".")) : null;
    const response = await apiFetch(`/v1/organizations/${organizationId}/kpi-snapshots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: connectionId || null, period: "weekly", periodStart: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10), netSales: Number.isFinite(revenue) ? revenue : null, ordersCount: Number.isFinite(orders) ? orders : null, aov: revenue != null && orders ? revenue / orders : null, adSpend: Number.isFinite(adSpend) ? adSpend : null, notes: tracking.notes }) });
    setBusy(false);
    if (!response.ok) { setError("No se pudo guardar el seguimiento."); return; }
    setTracking({ revenue: "", orders: "", adSpend: "", notes: "" }); setModal(null);
  }
  function exportSnapshots() {
    const csv = [["inicio", "fin", "ventas"], ...snapshots.map((row) => [row.period_start, row.period_end, row.net_sales])].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); link.download = `kpi-${organizationId}-${connectionId || "todas"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  if (!isConsultant) return <div className="space-y-6"><Card title="Planificación del consultor" description="Esta vista coordina decisiones de crecimiento para varias tiendas y está reservada al consultor."><p className="text-sm text-muted">Gestiona tu operativa desde Dashboard, Tareas y Mi Camino.</p><div className="mt-4 flex flex-wrap gap-2"><ButtonLink href="/dashboard">Dashboard</ButtonLink><ButtonLink href="/tareas">Tareas</ButtonLink><ButtonLink href="/camino">Mi Camino</ButtonLink></div></Card></div>;
  if (loading) return <LoadingBlock label="Cargando planificación..." />;

  const items = planning.items ?? [];
  return <div className="space-y-6"><div><p className={EYEBROW}>Panel del consultor</p><Heading>Planificación</Heading><p className="mt-1 max-w-2xl text-sm text-muted">Revisa resultados y activa el siguiente paso de cada cliente o tienda.</p></div>{error ? <ErrorBlock>{error}</ErrorBlock> : null}<Card title="Acciones rápidas" description="Abre solo la herramienta que necesites."><div className="flex flex-wrap gap-2"><Button onClick={() => setModal("action")} disabled={!organizationId}>Nueva acción</Button><Button variant="secondary" onClick={() => setModal("tracking")} disabled={!organizationId}>Tracking semanal</Button><Button variant="secondary" onClick={() => setModal("history")} disabled={!organizationId}>Histórico y CSV</Button><ButtonLink href="/tareas" variant="secondary">Tareas</ButtonLink></div></Card>{organizationId ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric card label="Ingresos netos" value={money(metrics.sales?.net_sales)} /><Metric card label="Pedidos" value={metrics.sales?.orders_count?.toLocaleString("es-ES") ?? "—"} /><Metric card label="ROAS" value={metrics.acquisition?.roas == null ? "—" : `${metrics.acquisition.roas.toFixed(2)}x`} /><Metric card label="Beneficio neto" value={money(metrics.financial?.net_profit)} /></div> : <Banner tone="warn">Selecciona un cliente para ver sus resultados.</Banner>}{organizationId ? <Card title="Calendario activo" description={`${items.length} acciones para el alcance seleccionado.`} actions={<Button size="sm" variant="secondary" onClick={() => setModal("action")}>Añadir</Button>}>{items.length ? <div className="space-y-2">{items.slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-separator px-3 py-2"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted">{new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(item.starts_at))} · {item.channel}</p></div><Badge tone="brand">{item.status}</Badge></div>)}</div> : <Banner tone="warn">Todavía no hay acciones. Usa “Nueva acción” para empezar.</Banner>}</Card> : null}<Modal isOpen={modal !== null} onOpenChange={(open) => !open && setModal(null)}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog aria-label="Planificación"><Modal.CloseTrigger /><Modal.Header><Modal.Heading>{modal === "action" ? "Nueva acción" : modal === "tracking" ? "Tracking semanal" : "Histórico KPI"}</Modal.Heading></Modal.Header><Modal.Body>{modal === "action" ? <div className="space-y-4"><p className="text-sm text-muted">Conecta la acción con Marketing o Mi Camino si ya existe.</p><label className="block text-sm">Título<input className="mt-1 block w-full rounded-md border border-separator px-3 py-2" value={action.title} onChange={(e) => setAction({ ...action, title: e.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Fecha<input className="mt-1 block w-full rounded-md border border-separator px-3 py-2" type="date" value={action.date} onChange={(e) => setAction({ ...action, date: e.target.value })} /></label><label className="text-sm">Canal<Select value={action.channel} onChange={(channel) => setAction({ ...action, channel })} options={[{ value: "Email", label: "Email / Klaviyo" }, { value: "Meta", label: "Meta Ads" }, { value: "Social", label: "Social" }]} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Marketing<Select value={action.draftId} onChange={(draftId) => setAction({ ...action, draftId })} options={[{ value: "", label: "Sin enlace" }, ...resources.drafts.map((row) => ({ value: row.id, label: row.subject }))]} /></label><label className="text-sm">Mi Camino<Select value={action.milestoneId} onChange={(milestoneId) => setAction({ ...action, milestoneId })} options={[{ value: "", label: "Sin milestone" }, ...resources.milestones.map((row) => ({ value: row.id, label: row.name }))]} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={action.createTask} onChange={(e) => setAction({ ...action, createTask: e.target.checked })} /> Crear tarea relacionada</label></div> : null}{modal === "tracking" ? <div className="space-y-4"><p className="text-sm text-muted">Los campos vacíos se conservan como no disponibles.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Ingresos<input className="mt-1 block w-full rounded-md border border-separator px-3 py-2" value={tracking.revenue} onChange={(e) => setTracking({ ...tracking, revenue: e.target.value })} /></label><label className="text-sm">Pedidos<input className="mt-1 block w-full rounded-md border border-separator px-3 py-2" value={tracking.orders} onChange={(e) => setTracking({ ...tracking, orders: e.target.value })} /></label><label className="text-sm">Ads<input className="mt-1 block w-full rounded-md border border-separator px-3 py-2" value={tracking.adSpend} onChange={(e) => setTracking({ ...tracking, adSpend: e.target.value })} /></label></div><label className="block text-sm">Notas<textarea className="mt-1 block w-full rounded-md border border-separator px-3 py-2" value={tracking.notes} onChange={(e) => setTracking({ ...tracking, notes: e.target.value })} /></label></div> : null}{modal === "history" ? <div className="space-y-3"><p className="text-sm text-muted">{snapshots.length ? `${snapshots.length} snapshots disponibles.` : "Todavía no hay snapshots guardados."}</p>{snapshots.slice(0, 8).map((row) => <div key={row.id} className="flex justify-between border-b border-separator py-2 text-sm"><span>{row.period_start} – {row.period_end}</span><span>{money(row.net_sales)}</span></div>)}</div> : null}</Modal.Body><Modal.Footer>{modal === "action" ? <Button onClick={createAction} disabled={busy}>{busy ? "Guardando…" : "Añadir al calendario"}</Button> : modal === "tracking" ? <Button onClick={saveTracking} disabled={busy}>{busy ? "Guardando…" : "Guardar snapshot"}</Button> : <Button variant="secondary" onClick={exportSnapshots} disabled={!snapshots.length}>Exportar CSV</Button>}</Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal></div>;
}

export default function PlanningPage() { return <PortalShell title="Planificación">{(bootstrap) => <PlanningContent bootstrap={bootstrap} />}</PortalShell>; }
