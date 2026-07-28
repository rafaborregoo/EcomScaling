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
  - **Cerrado 2026-07-27 -- maquina de estados formal.** Ver seccion propia mas abajo: `agent_runs.status`
    no necesita `queued`/`cancelled` hoy porque cada turno corre de forma sincrona dentro de una unica
    request/job (no hay cola de turnos pendientes que ejecutar despues) -- decision tecnica de bajo riesgo,
    documentada, no requiere validacion de producto.
  - **Cerrado 2026-07-27 -- contrato de entrada (`AgentInput`).** Ver seccion propia mas abajo, extraido
    literal de `agentInputSchema` (`packages/ai/src/index.ts:15-30`).
  - **No hay model routing por politica de coste** -- correctamente fuera de alcance de AI-00, es AI-09
    (`planned`). El modelo viene fijado por `agent_versions.model` (**migrado 2026-07-28** de
    `claude-opus-4-8` a `claude-sonnet-5` para los 6 agentes activos -- peticion explicita de Rafa, mas
    barato, `MODEL_PRICING` en `packages/ai/src/index.ts` ya lo tenia tarifado) -- sigue siendo el mismo
    modelo plano para todos los agentes, no hay criterio de escalado ni modelo distinto por complejidad.
    **Si existe fallback de proveedor desde 2026-07-20** (R-020):
    `runAgentTurnWithFallback` (`apps/api/src/ai-runtime.ts`) reintenta con OpenAI
    (`runAgentTurnOpenAI`, `packages/ai/src/index.ts`) si Anthropic falla por disponibilidad y hay
    `OPENAI_API_KEY` configurada — pendiente de que Rafa ponga la clave real.
  - **Cerrado 2026-07-27 -- politica de privacidad/retencion con el proveedor LLM.** Mismo criterio que
    Rafa ya aplico en ADR-0016 (transcripciones) y en diferir `REDIS_URL` (SQO-00): en fase de desarrollo,
    sin clientes reales todavia, no hay contrato ni obligacion legal que imponga limites -- se documenta el
    estado actual como decision explicita en vez de dejarlo como olvido. Anthropic/OpenAI reciben el
    contexto que arma `contextBlocks` (evidence-pack: metricas, hallazgos, RAG, `client_constraints`) mas el
    `objective`/`time_range` de `AgentInput` -- nunca credenciales ni PII de pago (no hay campos de tarjeta
    en el evidence-pack). `agent_runs`/`agent_run_steps`/`agent_context_snapshots` guardan ese mismo
    contexto sin limite de tiempo (mismo patron que `call_transcripts`, ver ADR-0016) y se purgan junto con
    el resto de datos de la organizacion via `purgeExpiredDeletions` (cascade por `organization_id`).
    Reevaluar en los mismos disparadores que ADR-0016: entrada de cliente real (OPS-01), exigencia
    contractual, o requisito legal.

### Maquina de estados de `agent_runs.status` (cerrado 2026-07-27)

```text
running -> succeeded
running -> failed
running -> rejected_output   (checkOutputSanity/Zod rechaza la salida del modelo)
running -> budget_exceeded   (AgentBudgetExceededError, R-011)
```

No existe `queued` ni `cancelled` como valores del constraint real
(`supabase/migrations/20260717200000_db_08a_runtime_agentes.sql` +
`20260722190000_ai_09_budget_status.sql`), y **no hace falta anadirlos hoy**: cada turno se ejecuta de
forma sincrona dentro de la misma request HTTP (chat/diagnostico bajo demanda) o del mismo job de cron
(diagnosticos automaticos) -- no existe una cola de turnos pendientes de ejecutar ni una accion de usuario
para cancelar un turno en curso. Si en el futuro se introduce ejecucion asincrona real de turnos (fuera de
alcance hoy), esto se reabre como una migracion de DB-08a, no solo un cambio de este documento.

### Contrato de entrada (`AgentInput`, cerrado 2026-07-27)

Extraido literal de `agentInputSchema` (`packages/ai/src/index.ts:15-30`) -- ya era el contrato real en
codigo, este documento simplemente lo declara explicitamente:

```ts
type AgentInput = {
  run_id: string; // uuid, agent_runs.id
  agent_code: string;
  agent_version: string;
  organization_id: string; // uuid, fijado por el backend (requireMembership), nunca elegido por el modelo
  actor_user_id: string; // uuid, quien dispara la ejecucion
  trigger_type: "chat" | "call" | "cron" | "alert" | "webhook" | "manual";
  objective: string;
  time_range?: { start: string; end: string } | null;
  entity_ids?: string[] | null;
  allowed_tools: string[]; // catalogo de Tool Design (AI-12), [] en evidence-pack puro (A02/A06)
  approval_mode: "none" | "required_before_write" | "required_before_publish";
};
```

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
