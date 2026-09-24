/**
 * F8: supervision por bloques.
 *
 * Antes este fichero era un unico evaluador compartido por doce bloques, con
 * los checks escritos a mano por etapa y varios en `UNKNOWN` fijo (la
 * correccion del 2026-09-22 los devolvio a `esqueleto` por eso). Ahora cada
 * bloque tiene su evaluador en su fichero; aqui solo quedan las etapas que
 * admite `execution_supervision_runs` y el runner que los evalua en orden.
 *
 * LIFECYCLE no se evalua aqui: 8.10 tiene su propio motor y su propia tabla.
 */

import { evaluateExecutabilityAuthorization } from "./executability-authorization.js";
import { evaluateExecutionCapabilities } from "./execution-capabilities.js";
import { evaluateExecutionConcurrency } from "./execution-concurrency.js";
import { evaluateExecutionFramework } from "./execution-framework.js";
import { evaluateExecutionGuardrails } from "./execution-guardrails.js";
import { evaluateExecutionIncidents } from "./execution-incidents.js";
import { evaluateExecutionMonitoring } from "./execution-monitoring.js";
import { evaluateExecutionReporting } from "./execution-reporting.js";
import { evaluateExecutionVerification } from "./execution-verification.js";
import { evaluateOverrideEscalation } from "./override-escalation.js";
import { evaluateRollbackRecovery } from "./rollback-recovery.js";
import { evaluateSafeExecution } from "./safe-execution.js";
import type { ExecutionSnapshot, SupervisionBlockResult } from "./execution-snapshot.js";

export const supervisionStages = [
  "UNIVERSAL",
  "EXECUTABILITY_AUTHORIZATION",
  "CAPABILITIES",
  "SAFE_EXECUTION",
  "MONITORING",
  "GUARDRAILS",
  "LIFECYCLE",
  "INCIDENTS",
  "ROLLBACK_RECOVERY",
  "OVERRIDE_ESCALATION",
  "CONCURRENCY",
  "VERIFICATION",
  "REPORTING",
] as const;

export type SupervisionStage = (typeof supervisionStages)[number];

/**
 * Los doce bloques en el orden del flujo universal (8.00 §1). 8.17 va el
 * ultimo porque compone el informe con lo que dijeron los demas.
 */
export function evaluateSupervisionBlocks(snapshot: ExecutionSnapshot): SupervisionBlockResult[] {
  const results: SupervisionBlockResult[] = [
    evaluateExecutionFramework(snapshot),
    evaluateExecutabilityAuthorization(snapshot),
    evaluateExecutionCapabilities(snapshot),
    evaluateSafeExecution(snapshot),
    evaluateExecutionMonitoring(snapshot),
    evaluateExecutionGuardrails(snapshot),
    evaluateExecutionIncidents(snapshot),
    evaluateRollbackRecovery(snapshot),
    evaluateOverrideEscalation(snapshot),
    evaluateExecutionConcurrency(snapshot),
    evaluateExecutionVerification(snapshot),
  ];
  return [...results, evaluateExecutionReporting(snapshot, results)];
}
