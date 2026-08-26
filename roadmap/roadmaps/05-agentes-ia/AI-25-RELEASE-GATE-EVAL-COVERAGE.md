# AI-25 — Release gate con cobertura de evals por agente

Estado: `done_local` · 2026-08-26

## Objetivo

Evitar activar una versión de agentes solo porque sus métricas agregadas pasan:
la activación debe demostrar que todos los agentes requeridos fueron evaluados
y que ninguno tiene fallos deterministas de seguridad, tenant, abstención o
calidad.

## Implementación

`packages/ai/src/release-gate.ts` acepta ahora:

- `requiredAgentCodes`: agentes que deben estar representados.
- `evaluatedAgentCodes`: agentes realmente incluidos en la evidencia.
- `agentEvalFailures`: fallos producidos por el runner.

La ausencia de cobertura genera `agentEvalCoverage:missing:<agent>` y cualquier
fallo genera `agent_eval_failure:<failure>`. Ambos bloquean la activación.
Los gates existentes sin estos campos mantienen su comportamiento compatible.

## Verificación

- Matriz y dataset: 10/10 agentes cubiertos.
- Suite focalizada release/evals/dataset: 9/9.
- `npx tsc -p packages/ai/tsconfig.json --noEmit`: pasa.

La evaluación semántica con modelo real sigue siendo un gate posterior que
requiere proveedor, dataset versionado y observabilidad; no se simula como si
estuviera validada.
