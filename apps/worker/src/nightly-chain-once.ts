/**
 * Cadena nocturna F3 -> F7: los motores que hasta el 2026-09-24 solo corrian a
 * mano, en orden de fase y uno detras de otro.
 *
 * Por que un solo job y no una linea de cron por motor: el orden es la
 * dependencia (D04 lee lo que escriben D05 y D06, D09 lo de D04 y D08, D11 es el
 * ultimo de F3...) y con minutos fijos un motor lento hace que el siguiente lea
 * el estado de ayer sin que nadie lo note. Aqui el siguiente arranca cuando el
 * anterior termina. Y en serie: el VPS tiene 1.6 GB.
 *
 * Cada paso es su propio `<job>-once.js` en un proceso hijo, asi que un motor que
 * revienta no se lleva la memoria de los demas. Un fallo no corta la cadena --
 * los motores leen lo ultimo que haya, y un dato de ayer es mejor que ninguno--,
 * pero el job sale con codigo 1 y el log dice cuales fallaron.
 *
 * Lo que NO esta aqui porque ya tiene su linea en ops/vps/ecomscaling.crontab:
 * los benchmarks 6.05-6.13, 7.15/7.17/7.18, los diarios de F8 y los horarios.
 * Esos van a partir de las 3:35 UTC, cuando esta cadena ya ha terminado.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const NIGHTLY_CHAIN = [
  // F3 diagnostico
  "data-quality", // D01
  "maturity", // D03, no depende de los demas
  "signal-engine", // D05
  "context", // D02, necesita D01 y D05
  "symptoms", // D06
  "health", // D04, detras de D05 y D06
  "causal", // D07
  "hypothesis", // D08
  "root-cause", // D09, detras de D04 y D08
  "severity", // D10
  "adversarial", // D12, antes que D11: su revision le pone techo
  "confidence", // D11, el ultimo que califica
  "temporal", // D13
  "diagnostic-output", // D14
  // F4 priorizacion y decision
  "prioritization", // 4.00
  "decision-context", // 4.01
  "temporal-urgency", // 4.03
  "decision-impact", // 4.04
  "constraints", // 4.05
  "decision-blocks", // 4.06-4.12, un solo motor (decision-blocks-engine.ts)
  // F5 playbooks
  "playbook", // 5.00
  "acquisition", // 5.01
  "paid-media", // 5.02
  "conversion", // 5.03
  "offer-pricing", // 5.04
  "retention-crm", // 5.05
  "unit-economics", // 5.06
  "product-inventory", // 5.07
  "operations-cx", // 5.08
  "measurement-experimentation", // 5.09
  "scalability-constraints", // 5.10
  "recovery-crisis", // 5.11
  // F6 hasta 6.04 (6.05-6.13 van por cron)
  "benchmark-guardrails", // 6.00
  "cohort-context", // 6.01
  "data-quality-reliability", // 6.02
  "acquisition-demand", // 6.03
  "paid-media-benchmarks", // 6.04
  // F7 hasta 7.14 (7.15, 7.17 y 7.18 van por cron)
  "intervention-eligibility", // 7.01
  "intervention-matching", // 7.02
  "intervention-prioritization", // 7.03
  "intervention-impact", // 7.04
  "intervention-feasibility", // 7.05
  "intervention-risk", // 7.06
  "intervention-sequencing", // 7.07
  "intervention-test-execute", // 7.08
  "intervention-intensity", // 7.09
  "maturity-recommendations", // 7.10
  "constraint-recommendations", // 7.11
  "recommendation-portfolio", // 7.12
  "dynamic-decision", // 7.13
  "restraint-decision", // 7.14
  // F8: efecto de negocio de las intervenciones cerradas con metrica objetivo.
  // Al final: F9 (cada hora) lo lee como observed_effect.
  "intervention-effect",
] as const;

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const failed: string[] = [];
  for (const job of NIGHTLY_CHAIN) {
    const started = Date.now();
    const run = spawnSync(process.execPath, [join(here, `${job}-once.js`)], { stdio: "inherit" });
    const ok = run.status === 0;
    if (!ok) failed.push(job);
    console.log(JSON.stringify({ worker: "nightly-chain", step: job, ok, status: run.status, ms: Date.now() - started }));
  }
  console.log(JSON.stringify({ worker: "nightly-chain", steps: NIGHTLY_CHAIN.length, failed }));
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
