import { z } from "zod";
import type { SeriesPoint } from "./signals.js";

/**
 * F8: efecto de negocio de una intervencion.
 *
 * Hasta ahora F8 cerraba intervenciones sabiendo si se ejecutaron, no si
 * movieron el negocio, y F9 no tenia nada de lo que aprender. Esto mide la
 * metrica objetivo que declara el consultor antes y despues del arranque:
 * las 4 semanas previas contra las (hasta) 4 siguientes, con la misma serie
 * diaria que usa D05.
 *
 * Es una comparacion antes/despues, no un experimento: sin grupo de control no
 * separa la intervencion de la estacionalidad o de otra cosa que cambiara a la
 * vez. Por eso F9 no pasa nunca de `causal_plausible` con esto.
 */

/** Las metricas con serie diaria (las mismas que emite D05). */
export const INTERVENTION_EFFECT_METRICS = [
  "net_sales",
  "orders_count",
  "average_order_value",
  "sessions",
  "conversion_rate",
] as const;

export type InterventionEffectMetric = (typeof INTERVENTION_EFFECT_METRICS)[number];

export const interventionEffectTargetSchema = z.object({
  metric: z.enum(INTERVENTION_EFFECT_METRICS),
  expected_direction: z.enum(["up", "down"]),
});

/** Ventana a cada lado del arranque. Coincide con OUTCOME_HORIZON_DAYS de F9. */
export const EFFECT_WINDOW_DAYS = 28;
/** Dias con dato por lado para dar la muestra por suficiente. */
export const EFFECT_MIN_DAYS = 14;
/** Por debajo de este cambio relativo, la direccion es `flat`. */
export const EFFECT_FLAT_TOLERANCE = 0.02;
/** Un cambio menor que esto no es material aunque sea distinguible del ruido. */
export const EFFECT_MIN_MATERIAL_CHANGE = 0.05;

export type InterventionEffectMeasurement = {
  baseline_value: number | null;
  observed_value: number | null;
  change_relative: number | null;
  observed_direction: "up" | "down" | "flat" | null;
  material: boolean;
  sample_sufficient: boolean;
  pre_days: number;
  post_days: number;
  /** EARLY < 14 dias despues, INTERIM hasta 28, MATURE con la ventana completa. */
  maturity: "EARLY" | "INTERIM" | "MATURE";
};

const DAY_MS = 86_400_000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[], m: number) =>
  xs.length > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) : 0;

/**
 * `startedAt` es el dia en que la intervencion empezo a aplicarse; ese dia ya
 * cuenta como "despues". `asOf` corta la ventana posterior: una intervencion de
 * hace 10 dias se mide con 10 dias y se marca EARLY.
 *
 * Material = el cambio supera el 5 % Y dos errores estandar de la diferencia de
 * medias. Lo primero evita llamar efecto a un cambio que no importa; lo segundo,
 * a uno que el ruido diario ya explica.
 */
export function measureInterventionEffect(
  series: SeriesPoint[],
  startedAt: string,
  asOf: string,
): InterventionEffectMeasurement {
  const start = Date.parse(startedAt.slice(0, 10));
  const end = Math.min(start + EFFECT_WINDOW_DAYS * DAY_MS, Date.parse(asOf.slice(0, 10)) + DAY_MS);
  const pre: number[] = [];
  const post: number[] = [];
  for (const p of series) {
    const t = Date.parse(p.date);
    if (t >= start - EFFECT_WINDOW_DAYS * DAY_MS && t < start) pre.push(p.value);
    else if (t >= start && t < end) post.push(p.value);
  }

  const postSpan = Math.max(0, Math.round((end - start) / DAY_MS));
  const maturity =
    postSpan >= EFFECT_WINDOW_DAYS ? "MATURE" : postSpan >= EFFECT_MIN_DAYS ? "INTERIM" : "EARLY";
  const sample_sufficient = pre.length >= EFFECT_MIN_DAYS && post.length >= EFFECT_MIN_DAYS;

  if (pre.length === 0 || post.length === 0) {
    return {
      baseline_value: pre.length ? mean(pre) : null,
      observed_value: post.length ? mean(post) : null,
      change_relative: null,
      observed_direction: null,
      material: false,
      sample_sufficient,
      pre_days: pre.length,
      post_days: post.length,
      maturity,
    };
  }

  const baseline = mean(pre);
  const observed = mean(post);
  const change = baseline !== 0 ? (observed - baseline) / Math.abs(baseline) : null;
  const direction =
    change == null
      ? observed > 0 ? "up" : observed < 0 ? "down" : "flat"
      : Math.abs(change) < EFFECT_FLAT_TOLERANCE ? "flat" : change > 0 ? "up" : "down";
  const standardError = Math.sqrt(
    variance(pre, baseline) / pre.length + variance(post, observed) / post.length,
  );
  const material =
    sample_sufficient &&
    change != null &&
    Math.abs(change) >= EFFECT_MIN_MATERIAL_CHANGE &&
    Math.abs(observed - baseline) > 2 * standardError;

  return {
    baseline_value: baseline,
    observed_value: observed,
    change_relative: change,
    observed_direction: direction,
    material,
    sample_sufficient,
    pre_days: pre.length,
    post_days: post.length,
    maturity,
  };
}
