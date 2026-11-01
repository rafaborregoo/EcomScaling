import assert from "node:assert/strict";
import test from "node:test";
import { assessMetric, METRIC_SPECS, suggestConversionTarget } from "./metric-analyst.js";

const mer = METRIC_SPECS.mer;
const cac = METRIC_SPECS.cac_new;

test("muestra pequeña: no juzga", () => {
  const a = assessMetric(mer, { value: 1.2, previous: 3, sample: 5, threshold: { value: 2, label: "el MER de equilibrio" } });
  assert.equal(a.verdict, "insufficient");
  assert.equal(a.reasons[0]?.source, "sample");
});

test("plataforma sin conectar manda sobre todo", () => {
  assert.equal(assessMetric(mer, { value: null, sample: 0, unavailable: "Meta no está conectado." }).verdict, "insufficient");
});

test("por debajo del equilibrio = mal y confianza alta", () => {
  const a = assessMetric(mer, { value: 1.8, previous: 1.9, sample: 100, threshold: { value: 2, label: "el MER de equilibrio" } });
  assert.equal(a.verdict, "bad");
  assert.equal(a.confidence, "high");
});

test("cerca del equilibrio = vigilar", () => {
  assert.equal(assessMetric(mer, { value: 2.1, sample: 100, threshold: { value: 2, label: "x" } }).verdict, "watch");
});

test("CAC por encima del techo solo avisa: la recompra puede pagarlo", () => {
  assert.equal(assessMetric(cac, { value: 40, previous: 39, sample: 50, threshold: { value: 30, label: "x" } }).verdict, "watch");
});

test("caída fuerte frente al periodo anterior = mal aunque no haya umbral", () => {
  const a = assessMetric(mer, { value: 2, previous: 4, sample: 100 });
  assert.equal(a.verdict, "bad");
  assert.equal(a.confidence, "low");
});

test("en las métricas donde bajar es bueno, bajar no penaliza", () => {
  assert.equal(assessMetric(cac, { value: 20, previous: 30, sample: 50 }).verdict, "good");
});

test("sin nada con que comparar no se inventa un veredicto", () => {
  assert.equal(assessMetric(mer, { value: 3, sample: 100 }).verdict, "insufficient");
});

test("el driver que más empuja en contra es el principal", () => {
  const a = assessMetric(METRIC_SPECS.meta_roas, {
    value: 2,
    previous: 3,
    sample: 40,
    drivers: [
      { id: "cpm", value: 12, previous: 8, currency_code: "USD" },
      { id: "ctr", value: 0.011, previous: 0.012 },
      { id: "click_to_purchase", value: 0.02, previous: 0.02 },
      { id: "aov", value: 50, previous: 50 },
    ],
  });
  assert.equal(a.main_driver, "cpm");
  assert.equal(a.drivers.find((d) => d.id === "aov")?.effect, "flat");
  assert.equal(a.drivers.find((d) => d.id === "cpm")?.currency_code, "USD");
});

test("historial: entre los peores meses = vigilar", () => {
  const a = assessMetric(mer, { value: 2.5, previous: 2.6, sample: 100, history: [3, 3.2, 3.4, 3.1, 2.9, 3.3] });
  assert.equal(a.verdict, "watch");
  assert.ok(a.reasons.some((r) => r.source === "history"));
});

test("historial: un nuevo minimo sigue siendo una señal de vigilancia", () => {
  const a = assessMetric(mer, { value: 2.5, previous: 3, sample: 100, history: [2.9, 3, 3.1, 3.2, 3.3, 3.4] });
  assert.equal(a.verdict, "watch");
  assert.ok(a.reasons.some((reason) => reason.source === "history"));
});

test("rechaza tasas fuera de rango y observaciones previas no finitas", () => {
  const conversion = METRIC_SPECS.conversion;
  const outOfRange = assessMetric(conversion, { value: 1.4, previous: 0.9, sample: 2000 });
  assert.equal(outOfRange.verdict, "insufficient");
  assert.equal(outOfRange.value, null);
  const nonFinitePrevious = assessMetric(mer, { value: 3, previous: Number.POSITIVE_INFINITY, sample: 100 });
  assert.equal(nonFinitePrevious.verdict, "insufficient");
  assert.equal(nonFinitePrevious.change_pct, null);
});

test("un driver con una tasa inválida invalida la comparación compuesta", () => {
  const a = assessMetric(METRIC_SPECS.meta_roas, {
    value: 2, previous: 2, sample: 100,
    drivers: [{ id: "ctr", value: 1.2, previous: 0.1 }],
  });
  assert.equal(a.verdict, "insufficient");
  assert.equal(a.main_driver, null);
});

test("un objetivo sugerido solo avisa: no lo ha fijado nadie", () => {
  const a = assessMetric(mer, { value: 3, previous: 3, sample: 100, target: 10, targetLabel: "objetivo sugerido" });
  assert.equal(a.verdict, "watch");
});

test("benchmark sectorial: solo sin referencias propias y nunca condena", () => {
  const benchmark = { p25: 0.01, p50: 0.02, p75: 0.03, label: "moda (ES, 2025)" };
  const conv = METRIC_SPECS.conversion;
  assert.equal(assessMetric(conv, { value: 0.005, previous: 0.005, sample: 5000, benchmark }).verdict, "watch");
  const withTarget = assessMetric(conv, { value: 0.005, previous: 0.005, sample: 5000, target: 0.004, benchmark });
  assert.ok(!withTarget.reasons.some((r) => r.source === "benchmark"));
});

test("conversión sugerida: el nivel de las mejores semanas de la propia tienda", () => {
  // 8 semanas de 1.000 sesiones; pedidos 20..34 → conversión 2 %..3,4 %.
  const daily = Array.from({ length: 56 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
    sessions: 1000 / 7,
    orders_count: (20 + Math.floor(i / 7) * 2) / 7,
  }));
  const s = suggestConversionTarget(daily);
  assert.equal(s?.value, 3); // 6.ª de 8 semanas ordenadas (p75): 30 pedidos / 1.000
  assert.match(s!.text, /no es una media del sector/);

  // Hoy ya por encima de sus mejores semanas: mantenerlo.
  const flat = daily.map((day) => ({ ...day, orders_count: 30 / 7 }));
  assert.equal(suggestConversionTarget(flat)?.value, 3);
  assert.match(suggestConversionTarget(flat)!.text, /Mantenerlo/);

  // Poco tráfico o pocas semanas: no se sugiere nada.
  assert.equal(suggestConversionTarget(daily.slice(-21)), null);
  assert.equal(suggestConversionTarget(daily.map((day) => ({ ...day, sessions: 10 }))), null);
});
