"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { MetaInsights } from "./insights-sections";
import pulse from "../dashboard/client-pulse.module.css";
import s from "../shopify/shopify-trust.module.css";

// Un pixel que lleva mas de un dia sin disparar deja a Meta optimizando sobre
// conversiones que no llegan (mismo umbral que insights-sections).
const PIXEL_SILENT_HOURS = 24;

// Fuentes de la primera visita que Shopify registra como trafico de Meta.
const META_SOURCE = /facebook|instagram|\bfb\b|\big\b|\bmeta\b/i;

type ShopifyAttribution = {
  attribution: Array<{ source: string | null; source_type: string | null; revenue: number }>;
};
type ShopifyCurrency = { currency_code: string | null };

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
 * "¿Puedo fiarme de estas cifras?" de /meta: lo que invalida el ROAS y las
 * compras (pixel, dias sin datos, definiciones de compra mezcladas, gasto en
 * aprendizaje) y, al lado, lo que Meta se atribuye frente a lo que Shopify
 * registra como primera visita desde Meta. Las dos cifras miden cosas
 * distintas y se muestran juntas sin sumarse (ADR-0021).
 */
export function MetaTrustStrip({ organizationId, connectionId, days }: { organizationId: string; connectionId: string | null; days: number | "all" }) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  // Mismas claves que ClientMeta: comparten la cache, no son peticiones nuevas.
  const insights = useCachedQuery<MetaInsights>(`${base}/meta/insights?days=${days}${scope}`).data;
  const shop = useCachedQuery<ShopifyCurrency>(`${base}/shopify/metrics?days=${days}${scope}`).data;
  const shopInsights = useCachedQuery<ShopifyAttribution>(`${base}/shopify/insights?days=${days}${scope}`).data;

  const summary = insights?.summary;
  if (!insights || !summary) return null;

  const pixels = [...new Map(insights.pixels.map((row) => [row.pixel_id, row])).values()];
  const silentPixels = pixels.filter((p) => p.is_unavailable || p.hours_since_last_fire == null || p.hours_since_last_fire > PIXEL_SILENT_HOURS);
  const freshest = pixels.reduce<number | null>((min, p) => (p.hours_since_last_fire == null ? min : min == null ? p.hours_since_last_fire : Math.min(min, p.hours_since_last_fire)), null);
  const pixelCoverage = insights.pixels.length
    ? Math.min(...insights.pixels.map((p) => (p.days_in_period ? p.days_with_events / p.days_in_period : 0)))
    : null;
  const pixelOk = pixels.length > 0 && silentPixels.length === 0;

  const expectedDays = days === "all" ? null : days;
  const daysOk = expectedDays == null || summary.days_with_data >= expectedDays;

  const mixedPurchases = summary.purchase_action_types.length > 1;

  const learningSpend = insights.learning
    .filter((l) => l.learning_stage_status === "LEARNING" || l.learning_stage_status === "LEARNING_LIMITED")
    .reduce((sum, l) => sum + (Number(l.spend_in_period) || 0), 0);
  const learningShare = summary.spend > 0 ? learningSpend / summary.spend : 0;

  const sameCurrency = Boolean(insights.currency && shop?.currency_code === insights.currency);
  const shopifyFromMeta = shopInsights
    ? shopInsights.attribution.filter((row) => META_SOURCE.test(row.source ?? "")).reduce((sum, row) => sum + row.revenue, 0)
    : null;
  const compareMax = Math.max(summary.purchase_value, shopifyFromMeta ?? 0, 1);

  return (
    <>
      <section
        className={s.trust}
        // Una columna: al lado de "Dos formas de contarlo" las cuatro comprobaciones no cabían y se cortaban.
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
        aria-labelledby="meta-medicion-h"
      >
        <div id="meta-medicion">
          <h2 id="meta-medicion-h" className={s.title}>
            ¿Puedo fiarme de estas cifras?
          </h2>
          <div className={s.checks}>
            <Check title="Píxel" ok={pixelOk} status={pixels.length === 0 ? "Sin píxel" : pixelOk ? "OK" : "Sin señal"} ratio={pixelCoverage}>
              <p>
                {pixels.length === 0
                  ? "Tu cuenta de Meta no tiene píxel: las compras y el ROAS no tienen de dónde salir. Se conecta en Shopify, desde la app Facebook e Instagram."
                  : pixelOk
                    ? `Último evento hace ${freshest != null ? n(Math.round(freshest)) : "—"} h.`
                    : `${silentPixels.length === 1 ? "Un píxel lleva" : `${silentPixels.length} píxeles llevan`} más de un día sin disparar: el gasto es real, las compras se quedan cortas.`}
              </p>
              {/* Sin píxel no hay enlace: no se conecta desde NORA y llevar a Integraciones dejaba al usuario sin saber qué hacer. */}
              {pixelOk || pixels.length === 0 ? null : <a href="#meta-measure">Ver el píxel</a>}
            </Check>
            <Check
              title="Días con datos"
              ok={daysOk}
              status={expectedDays == null ? `${n(summary.days_with_data)} días` : `${Math.min(summary.days_with_data, expectedDays)}/${expectedDays}`}
              ratio={expectedDays ? summary.days_with_data / expectedDays : null}
            >
              <p>{daysOk ? "Hay datos de todos los días del periodo." : "Faltan días: las cifras del periodo están incompletas."}</p>
            </Check>
            <Check title="Definición de compra" ok={!mixedPurchases} status={mixedPurchases ? "Varias" : "Una"} ratio={null}>
              <p>
                {mixedPurchases
                  ? `Las cuentas cuentan la compra de ${summary.purchase_action_types.length} formas: las compras y el ROAS no son comparables entre sí.`
                  : "Todas las cuentas cuentan la compra igual."}
              </p>
            </Check>
            <Check title="Aprendizaje" ok={learningShare < 0.2} status={learningSpend > 0 ? `${Math.round(learningShare * 100)} % del gasto` : "Nada"} ratio={learningSpend > 0 ? learningShare : null}>
              <p>
                {learningSpend > 0
                  ? "Parte del gasto va a conjuntos que aún aprenden: su CPA todavía no es definitivo."
                  : "Ningún conjunto con gasto está en fase de aprendizaje."}
              </p>
            </Check>
          </div>
        </div>
        {sameCurrency && shopifyFromMeta != null ? (
          <div className={`${pulse.panel} ${s.costs}`}>
            <div>
              <h3>Dos formas de contarlo</h3>
              <p className={s.feedback}>Miden cosas distintas: no se suman ni se restan.</p>
            </div>
            <div>
              <div className={s.checkH}>
                <span>Meta se atribuye</span>
                <span className={pulse.num}>{formatMoney(summary.purchase_value, insights.currency)}</span>
              </div>
              <div className={s.meter} aria-hidden="true">
                <i style={{ width: `${(summary.purchase_value / compareMax) * 100}%`, background: "var(--meta)" }} />
              </div>
            </div>
            <div>
              <div className={s.checkH}>
                <span>Shopify: primera visita desde Facebook o Instagram</span>
                <span className={pulse.num}>{formatMoney(shopifyFromMeta, insights.currency)}</span>
              </div>
              <div className={s.meter} aria-hidden="true">
                <i style={{ width: `${(shopifyFromMeta / compareMax) * 100}%`, background: "var(--store)" }} />
              </div>
            </div>
            <p className={s.feedback}>Meta cuenta clics y vistas dentro de su ventana; Shopify, solo el origen de la primera sesión del comprador.</p>
          </div>
        ) : null}
      </section>
    </>
  );
}
