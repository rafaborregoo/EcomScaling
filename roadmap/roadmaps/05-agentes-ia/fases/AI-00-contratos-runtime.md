# AI-00 - Contratos y runtime base

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-08a
- **Bloqueador:** ninguno
- **Evidencia:** `apps/api/src/ai-runtime.ts`, `packages/ai/src/index.ts`,
  `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql`.
- **Que esta bien y verificado:** `requireMembership` fija la organizacion en el backend antes de invocar
  el modelo (el modelo nunca la elige ni puede ampliarla); AI-03 (SQL Gateway) es la unica via de SQL y es
  de solo lectura, validada por AST; toda salida se valida contra un contrato Zod
  (`agentOutputSchema`/`callSummaryOutputSchema`/`chatOutputSchema`) y ademas contra `checkOutputSanity`
  (guarda de calidad estructural: answer vacio, texto corrupto, titulos vacios); versionado de prompts y
  agentes en uso real (`agent_definitions`/`agent_versions`/`prompt_versions`, `is_active` para rollback);
  `agent_runs.store_id` ya existe y A02/A04/A06 lo usan para no mezclar tiendas de una organizacion
  (AI-05).
- **Por que no es `done` todavia (los 3 criterios de cierre actuales son necesarios pero no suficientes):**
  - **No hay presupuesto aplicado, solo registrado.** `estimateCostUsd` existe y se guarda en
    `agent_runs`, pero no hay ningun punto en `ai-runtime.ts` que compare contra un `maxCostUsd`/
    `maxTokens`/`maxToolCalls` y corte la ejecucion — un run puede costar lo que sea sin bloquearse.
  - **No hay maquina de estados formal documentada.** `agent_runs.status` existe en la migracion pero este
    documento no declara los estados/transiciones validas (`queued -> running -> ... -> completed |
    rejected_output | failed_provider | budget_exceeded | timed_out`), lo que dificulta razonar sobre
    fallos parciales.
  - **No hay model routing.** El modelo viene fijado por `agent_versions.model` (hoy `claude-opus-4-8`
    para todos los agentes vistos) — no hay modelo economico/fallback ni criterio de escalado si el
    proveedor falla.
  - **Sin politica de privacidad/retencion documentada**: que contexto se envia al proveedor, cuanto se
    conservan prompts/outputs, borrado por organizacion.
  - El contrato de entrada (`AgentRunInput`) no esta documentado explicitamente en este archivo aunque
    existe implicito en el codigo — vale la pena escribirlo una vez para que cualquier agente nuevo lo seas.

## Objetivo

Cerrar entrada, salida, herramientas, permisos y trazabilidad antes del primer agente.

## Entregables

- Contrato comun de entrada.
- Contrato comun de salida.
- Catalogo de tools permitidas.
- Versionado de prompts.
- Politica de aprobacion.
- Modelo de costes, latencia y logs.

## Criterios de cierre

- Ningun agente puede ampliar organizaciones autorizadas.
- No hay escritura SQL libre.
- Toda salida puede validarse contra schema.
