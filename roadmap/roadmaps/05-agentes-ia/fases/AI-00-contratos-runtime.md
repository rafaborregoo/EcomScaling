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
- **Presupuesto aplicado 2026-07-20 (R-011, corrige un gap real de esta seccion)**: `evaluateAgentBudget`
  (`packages/ai/src/index.ts`, funcion pura con tests) corta el turno con `AgentBudgetExceededError` en
  cuanto el coste estimado o las tool calls superan el presupuesto declarado; `runAgentTurn` lo comprueba
  tras cada llamada al modelo y tras cada tool call. Los 3 puntos de entrada (generico A02/A04/A06/A08,
  A01, A09) pasan `DEFAULT_AGENT_BUDGET` (`maxCostUsd: 1`, `maxToolCalls: 10`) desde `ai-runtime.ts`; un
  corte por presupuesto queda en `agent_runs.status = "budget_exceeded"` (migracion
  `20260722190000_ai_09_budget_status.sql`), distinto de `failed`/`rejected_output`. Es una primera
  version deliberadamente simple: **un limite plano para todos los agentes**, no por agente ni por
  organizacion — afinar eso es AI-09 (model routing/presupuesto), todavia no implementado.
- **Por que sigue sin ser `done` (los 3 criterios de cierre actuales son necesarios pero no suficientes):**
  - **No hay maquina de estados formal documentada mas alla de los valores del constraint.**
    `agent_runs.status` ahora incluye `budget_exceeded`, pero este documento no declara todas las
    transiciones validas (`running -> succeeded | failed | rejected_output | budget_exceeded`), lo que
    dificulta razonar sobre fallos parciales.
  - **No hay model routing por politica de coste.** El modelo viene fijado por `agent_versions.model` (hoy `claude-opus-4-8`
    para todos los agentes vistos) — no hay modelo economico ni criterio de escalado. **Si existe fallback
    de proveedor desde 2026-07-20** (R-020): `runAgentTurnWithFallback` (`apps/api/src/ai-runtime.ts`)
    reintenta con OpenAI (`runAgentTurnOpenAI`, `packages/ai/src/index.ts`) si Anthropic falla por
    disponibilidad y hay `OPENAI_API_KEY` configurada — pendiente de que Rafa ponga la clave real.
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
