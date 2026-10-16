import assert from "node:assert/strict";
import test from "node:test";
import { assessMetric, METRIC_SPECS } from "./metric-analyst.js";

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
      { id: "cpm", value: 12, previous: 8 },
      { id: "ctr", value: 0.011, previous: 0.012 },
      { id: "click_to_purchase", value: 0.02, previous: 0.02 },
      { id: "aov", value: 50, previous: 50 },
    ],
  });
  assert.equal(a.main_driver, "cpm");
  assert.equal(a.drivers.find((d) => d.id === "aov")?.effect, "flat");
});

test("historial: entre los peores meses = vigilar", () => {
  const a = assessMetric(mer, { value: 2.5, previous: 2.6, sample: 100, history: [3, 3.2, 3.4, 3.1, 2.9, 3.3] });
  assert.equal(a.verdict, "watch");
  assert.ok(a.reasons.some((r) => r.source === "history"));
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
