"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { Button, Field, Input, Link } from "@/components/ui";
import { ProductCostImport } from "./product-cost-import";
import pulse from "../dashboard/client-pulse.module.css";
import s from "./shopify-trust.module.css";

export type TrustMetrics = {
  margin: {
    items_with_cost: number;
    items_without_cost: number;
    items_with_estimated_cost: number;
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  };
  stock: { tracked_items: number };
  funnel: { has_sessions: boolean; days_with_sessions: number } | null;
};

const n = (value: number) => value.toLocaleString("es-ES");

function Check({ title, ok, status, ratio, children }: { title: string; ok: boolean; status: string; ratio: number | null; children: ReactNode }) {
  return (
    <div className={s.check}>
      <div className={s.checkH}>
        <span>{title}</span>
        <span className={`${pulse.chip} ${ok ? pulse.chipGood : pulse.chipWarn}`}>{status}</span>
      </div>
      {ratio != null ? (
        <div className={s.meter} aria-hidden="true">
          <i className={ok ? s.ok : s.warn} style={{ width: `${Math.max(Math.min(ratio * 100, 100), 2)}%` }} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Qué invalida las cifras de esta pantalla, una comprobación por cifra que
 * estropea. Sustituye a la tarjeta "Medición": lo mismo, pero legible de un
 * vistazo y con la acción al lado.
 */
function TrustChecks({ metrics }: { metrics: TrustMetrics }) {
  const { margin, stock, funnel } = metrics;
  const costLines = margin.items_with_cost + margin.items_without_cost;
  const costOk = margin.items_without_cost === 0;
  const netLines = margin.lines_with_exact_metrics + margin.lines_with_estimated_metrics + margin.lines_without_metrics;
  const netOk = margin.lines_without_metrics === 0;
  const hasSessions = Boolean(funnel?.has_sessions);

  return (
    <div className={s.checks}>
      <Check
        title="Costes de producto"
        ok={costOk}
        status={costOk ? "OK" : "Parcial"}
        ratio={costLines ? margin.items_with_cost / costLines : null}
      >
        <p>
          {costOk
            ? margin.items_with_estimated_cost > 0
              ? `${n(margin.items_with_estimated_cost)} líneas se valoran con el coste de hoy; el margen de los meses viejos puede desviarse.`
              : "Todas las líneas tienen coste. El margen es fiable."
            : `${n(margin.items_without_cost)} líneas sin coste cuentan como gratis e inflan el margen.`}
        </p>
        {costOk ? null : <a href="#shopify-costes">Completar costes</a>}
      </Check>
      <Check title="Sesiones" ok={hasSessions} status={hasSessions ? "OK" : "Sin datos"} ratio={null}>
        <p>
          {hasSessions
            ? `${n(funnel!.days_with_sessions)} días con sesiones del informe de Shopify. La conversión es real.`
            : "Sin sesiones no hay tasa de conversión. Vienen de los informes de Shopify y necesitan ese permiso."}
        </p>
        {hasSessions ? null : <Link href="/integraciones">Revisar la conexión</Link>}
      </Check>
      <Check title="Inventario" ok={stock.tracked_items > 0} status={stock.tracked_items > 0 ? "OK" : "Sin seguimiento"} ratio={null}>
        <p>
          {stock.tracked_items > 0
            ? `${n(stock.tracked_items)} artículos con seguimiento. Un cero significa que no quedan unidades.`
            : "Ningún artículo lleva seguimiento: un cero no significa que no queden unidades."}
        </p>
      </Check>
      <Check
        title="Importes netos"
        ok={netOk}
        status={netOk ? "OK" : "Parcial"}
        ratio={netLines ? (margin.lines_with_exact_metrics + margin.lines_with_estimated_metrics) / netLines : null}
      >
        <p>
          {netOk
            ? "Todas las líneas traen el importe tras descuentos y reembolsos."
            : `${n(margin.lines_without_metrics)} líneas antiguas sin importe neto verificado; el próximo sync las completa y, mientras, los importes por producto son parciales.`}
        </p>
      </Check>
    </div>
  );
}

function CostForm({ organizationId, onSaved }: { organizationId: string; onSaved: () => void }) {
  const [sku, setSku] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!sku.trim() || !unitCost) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/shopify/product-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: sku.trim(), unitCost: Number(unitCost) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; message?: string; detail?: string } | null;
        setFeedback([body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "));
        return;
      }
      setFeedback("Coste guardado.");
      setSku("");
      setUnitCost("");
      onSaved();
    } catch {
      setFeedback("No se pudo guardar el coste. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form id="shopify-costes" className={`${pulse.panel} ${s.costs}`} onSubmit={(event) => void save(event)}>
      <h3>Completar costes</h3>
      <div className={s.costRow}>
        <Field label="SKU">
          <Input type="text" placeholder="CAMISETA-NEGRA-M" value={sku} onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Coste">
          <Input type="number" step="0.01" min="0" placeholder="0,00" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
        </Field>
      </div>
      <div className={s.costActions}>
        <Button type="submit" size="sm" disabled={isSaving || !sku.trim() || !unitCost}>
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
      {feedback ? <p className={s.feedback}>{feedback}</p> : null}
      <ProductCostImport organizationId={organizationId} onImported={onSaved} />
    </form>
  );
}

export function ShopifyTrustStrip({ organizationId, metrics, onCostsChanged }: { organizationId: string; metrics: TrustMetrics | null; onCostsChanged: () => void }) {
  return (
    <>
      {metrics ? (
        <section className={s.trust} aria-labelledby="shopify-medicion-h">
          <div id="shopify-medicion">
            <h2 id="shopify-medicion-h" className={s.title}>
              ¿Puedo fiarme de estas cifras?
            </h2>
            <TrustChecks metrics={metrics} />
          </div>
          <CostForm organizationId={organizationId} onSaved={onCostsChanged} />
        </section>
      ) : null}
      <nav className={s.nav} aria-label="Secciones de Shopify">
        <a href="#shop-pendiente">Pendiente</a>
        <a href="#shop-conv">Conversión</a>
        <a href="#shop-prod">Productos</a>
        <a href="#shop-cli">Clientes</a>
        <a href="#shop-orig">Origen</a>
        <a href="#shop-env">Envíos</a>
        <a href="#shopify-ia">Análisis IA</a>
      </nav>
    </>
  );
}
