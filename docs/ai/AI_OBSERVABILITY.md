# AI Observability — E-NORA / NORA

**Estado:** modelo de datos, captura y panel implementados. Ver
[AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) para el plan de fases.

---

## 1. Los cinco niveles, y dónde vive cada uno

El encargo pedía distinguirlos de verdad, no meterlo todo en logs JSON y llamarlo
observabilidad. Aquí está el mapeo real:

| Nivel      | Qué es                     | Dónde vive                                                               |
| ---------- | -------------------------- | ------------------------------------------------------------------------ |
| **TRACE**  | Una operación completa     | `agent_runs` (una fila = una ejecución), correlacionadas por `trace_id`  |
| **SPAN**   | Una parte de esa operación | `agent_run_steps` (`position`, `step_type`, `duration_ms`)               |
| **EVENT**  | Algo que ocurrió           | `ai_security_events`, `ai_diagnostic_gate_log`, `agent_approvals`        |
| **METRIC** | Medida agregable           | `MetricsRegistry` en proceso + funciones SQL `stable` para los agregados |
| **LOG**    | Detalle operacional        | `createLogger` → JSON a stdout, con `x-request-id`                       |

No se creó una tabla `ai_traces` separada: `agent_runs` **ya es** la tabla de trazas, con
tenant, objetivo, tokens, coste, latencia, estado y RLS. Duplicarla habría sido peor.

## 2. Qué se sabe de cada ejecución

Después de AI-30, una fila de `agent_runs` responde a todas estas preguntas:

| Pregunta                              | Campo                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- |
| ¿Qué pidió el usuario?                | `objective`, `time_range`, `lookback_days`, `store_id`                |
| ¿Quién lo pidió?                      | `actor_user_id`, `organization_id`                                    |
| ¿Cómo se disparó?                     | `trigger_type`, `parallel_group_id`                                   |
| ¿Qué agente actuó?                    | `agent_version_id` → código, versión, prompt, tools                   |
| ¿Qué proveedor y modelo?              | `provider`, `model` — **los reales, no los configurados**             |
| ¿Qué prompt?                          | vía `agent_versions` → `prompt_versions` (con checksum)               |
| ¿Cuánto tardó?                        | `latency_ms`, más `duration_ms` por span                              |
| ¿Cuántos tokens?                      | `input_tokens`, `output_tokens`                                       |
| ¿Qué reportó la caché?                | `cache_read_tokens`, `cache_creation_tokens` (`null` = no lo reportó) |
| ¿Cuánto costó?                        | `estimated_cost_usd`, `cost_basis`, `pricing_version`                 |
| ¿Contra qué límite corrió?            | `budget_max_cost_usd`, `budget_max_tool_calls`                        |
| ¿Cuánto trabajo hizo?                 | `model_calls`, `tool_call_count`                                      |
| ¿Qué herramientas ejecutó?            | `agent_tool_calls` (con entrada/salida sanitizadas)                   |
| ¿Qué consultas SQL?                   | `agent_query_runs`                                                    |
| ¿Qué contexto usó?                    | `agent_context_snapshots`                                             |
| ¿Qué controles de seguridad saltaron? | `ai_security_events`                                                  |
| ¿Por qué terminó?                     | `status` + `stop_reason` + `error_message`                            |
| ¿Qué versión estaba desplegada?       | `deployment_version`                                                  |
| ¿Qué evaluación obtuvo?               | `agent_version_evaluations`                                           |

**Pendiente honesto:** subagentes (`parent_run_id` / `root_run_id` existen pero están vacíos
porque no hay subagentes) y memoria consultada (auditable vía `agent_tool_calls` de
`search_knowledge`, pero sin vista propia).

## 3. La regla `null` ≠ `0`

Es la regla que hace que la trazabilidad represente la realidad técnica en vez de aparentarlo:

- `estimated_cost_usd = null` + `cost_basis = 'unknown_model'` → **no sabemos** lo que costó.
  No es gratis. Debe aparecer como incidente en el panel, con su propio contador
  (`ai_runs_cost_unknown_total`), y **no** sumarse como 0 al total de coste.
- `cache_read_tokens = null` → el proveedor no informó. `= 0` → informó, y fueron cero hits.
- `contextWindowMax = null` → nadie lo ha verificado contra la documentación del proveedor,
  así que no hay porcentaje de utilización que mostrar.
- Capacidades: `unknown` es una respuesta legítima; `false` inventado no lo es.

## 4. Correlación

`trace_id` = `x-request-id` de la petición, o el `tick_id` de la pasada del orquestador, o el
propio `run_id` cuando no hay origen HTTP (worker, cron, script). Una ejecución sin origen
HTTP es su propia traza: eso es la verdad, y es mejor que dejar el campo vacío.

Transporte: `AsyncLocalStorage`
([`request-context.ts`](../../apps/api/src/request-context.ts)), abierto por un hook
`onRequest` de Fastify y por el wrapper del orquestador. El navegador ya recibe el mismo
`x-request-id` en la cabecera de respuesta, así que el usuario que reporta un problema puede
darte la cuerda entera.

## 5. Rendimiento

La observabilidad no puede ralentizar de forma relevante una petición. Decisiones tomadas:

- **Eventos de seguridad**: se acumulan en memoria durante el turno (`emit` es síncrono) y se
  escriben en **una sola inserción** al terminar. Nunca un round-trip por evento.
- **Pasos**: se escriben en los límites naturales del turno (construcción de contexto,
  llamada al modelo), no por operación.
- **Payloads recortados**: `sanitizeForTelemetry` acota cadenas y arrays antes de escribir,
  así que una tool que devuelve 400 filas no escribe 400 filas.
- **Índices**: los que calzan con las consultas reales del panel —
  `trace_id`, `(parallel_group_id, started_at)`, `(provider, model, started_at)`, y un índice
  parcial sobre `cost_basis = 'unknown_model'` para poder listar los incidentes de coste.
- **No se introdujo tracing distribuido.** Con un API, un worker y una base de datos, no hay
  problema que resuelva y sí complejidad que añade. `createOptionalLangSmithTraceable` deja el
  punto de enganche si algún día hace falta.

## 6. Retención

| Dato                                       | Política actual                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Contexto de IA (`agent_context_snapshots`) | 180 días, `purge_expired_ai_context` vía cron                            |
| Transcripciones de llamadas                | ADR-0016                                                                 |
| Logs de auditoría                          | ADR-0018                                                                 |
| Trazas y pasos de IA                       | **Sin política explícita** — pendiente                                   |
| Eventos de seguridad                       | 400 días, `purge_expired_ai_security_events` en la misma pasada del cron |
| Métricas de uso/facturación                | **Sin política explícita** — pendiente                                   |

## 7. Errores

`agent_runs.status` distingue: `succeeded`, `rejected_output`, `budget_exceeded`, `timeout`,
`failed`, `cancelled` (reservado). El `stop_reason` del proveedor se guarda **crudo**, sin
normalizar: el valor tal cual es lo que sirve para depurar contra su documentación.

**Pendiente:** la taxonomía completa que pedía el encargo (`PROVIDER_ERROR`, `RATE_LIMIT`,
`INVALID_REQUEST`, `CONTEXT_LIMIT`, `TOOL_ERROR`, `PERMISSION_DENIED`, `SECURITY_BLOCK`,
`INTERNAL_ERROR`) no está como campo separado; hoy va dentro de `error_message`.
`isTransientAgentError` ([`resilience.ts`](../../packages/ai/src/resilience.ts)) ya clasifica
lo transitorio, que es la parte que cambia el comportamiento.

## 8. Panel de administración

[`/admin/observabilidad`](../../apps/web/src/app/admin/observabilidad/page.tsx) tiene coste,
latencia p95 y runs por agente / cliente / consultor, con filtros por cliente, consultor,
tienda, agente y estado.

Al abrir una ejecución, [`run-trace.tsx`](../../apps/web/src/app/admin/observabilidad/run-trace.tsx)
pide `GET /v1/organizations/:id/ai/runs/:runId/trace` y reconstruye la ejecución. El orden de
la pantalla lo manda el objetivo declarado — localizar un incidente en menos de 60 segundos:

1. **Qué pasó y por qué terminó así**: proveedor y modelo **reales**, marcando en ámbar
   cuándo el modelo ejecutado difiere del configurado (esa diferencia _es_ la señal de que
   actuó el fallback), motivo de terminación, coste con su base, presupuesto aplicado y uso
   reportado por el proveedor.
2. **Correlación copiable**: `run_id`, `trace_id`, grupo de la pasada y run padre.
3. **Controles de seguridad**, antes que la cronología: es lo que se mira cuando algo huele
   raro, y esconderlo al final lo haría inútil.
4. **Cascada de fases**, con barras proporcionales a la duración.
5. **Herramientas y consultas SQL**.

Dos decisiones de la pantalla:

- **La traza se pide solo al abrir el detalle.** Son cuatro consultas más por ejecución y no
  tiene sentido pagarlas por las 120 filas de la tabla.
- **`null` no se pinta como cero.** Un coste no calculable se lee "No calculable" y lleva su
  distintivo; un token que el proveedor no reportó se lee "No reportado". La regla que la
  fase 1 impuso en la base de datos tiene su propio test en la capa de presentación
  ([`run-trace-format.test.ts`](../../apps/web/src/app/admin/observabilidad/run-trace-format.test.ts)),
  porque volver a romperla ahí es tan fácil como escribir `usd ?? 0`.

**Pendiente:** el árbol de subagentes. Las columnas existen y el detalle sabría pintarlo,
pero no hay subagentes que mostrar todavía.
