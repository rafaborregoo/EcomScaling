# AI-27 — Runner offline de evaluaciones

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Permitir ejecutar y persistir la matriz determinista de agentes sin claves de
modelo, conectores ni empresa real, dejando el mismo camino preparado para
modos `shadow` y `live`.

## Implementación

`apps/api/src/agent-eval-runner.ts`:

- carga las versiones de agente activas;
- ejecuta `runOfflineAgentEvalSuite()` para los diez agentes;
- selecciona el resultado del agente correspondiente a cada versión;
- crea payloads con dataset `2026-08-26.v1` y modo `offline`;
- persiste mediante la RPC AI-26, idempotente y atómica;
- no crea organizaciones, no llama a proveedores y no toca conectores.

## Verificación

- Tests de runner y persistencia: 4/4.
- Typecheck de `apps/api`: pasa.

La ejecución programada desde worker/cron y los modos `shadow`/`live` quedan
como siguientes extensiones, condicionadas a sus respectivos secretos y
datasets reales.

El entrypoint `apps/worker/src/agent-evals-once.ts`, sus comandos de worker y
`.github/workflows/agent-evals.yml` ya están preparados. El workflow solo tiene
`workflow_dispatch`; el schedule automático permanece comentado hasta autorizar
esa operación en el entorno remoto.
