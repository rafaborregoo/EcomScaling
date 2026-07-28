# AI-12 - Ingenieria de agentes (10 disciplinas)

## Estado

- **Estado real:** `verification_pending` (**mejorado 2026-07-28**: las 10 disciplinas tienen ahora
  implementacion o mitigacion real -- ninguna sigue en cero. No es `done` porque varias mejoras finas
  siguen pendientes, ver "Siguiente accion", y porque el criterio de cierre de cada disciplina no esta
  formalizado como checklist verificable de forma independiente.)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-28
- **Dependencias:** AI-00, AI-03, AI-04, AI-06, AI-07, AI-09, AI-10, SQO-02
- **Bloqueador:** ninguno
- **Evidencia:** ver tabla de mapeo abajo, cada fila cita el archivo/fase/test real que cubre cada
  disciplina.
- **Siguiente accion (2026-07-28: las 10 disciplinas ya tienen trabajo real, ninguna en cero)**: mejoras
  finas que quedan, ninguna bloqueante -- (1) presupuesto/limite de tool calls por agente/organizacion en
  vez de plano para todos (AI-09), (2) metricas agregadas/error tracking tipo APM (Q-014, infraestructura
  de pago, sin decidir proveedor).

## Objetivo

Pedido explicito de Rafa (2026-07-27): estas 10 disciplinas son la forma estandar de la industria de
describir "como se construye un sistema de agentes de produccion", no features del roadmap de negocio
(DB/BE/FE/INT). Este documento las mapea contra lo que EcomScaling ya tiene (a menudo bajo otro nombre en
DB-08/AI-00/AI-06/AI-07/AI-10/SQO-02) para que "implementarlas al 100%" sea auditar y cerrar gaps
concretos, no reinventar desde cero. No reemplaza ninguna fase existente — es una lente transversal sobre
ellas.

## Mapeo: disciplina -> estado real en EcomScaling

| # | Disciplina | Que significa | Estado en EcomScaling hoy | Gap principal |
| --- | --- | --- | --- | --- |
| 1 | **Harness Engineering** | El runtime que ejecuta un turno de agente: entrada, herramientas disponibles, salida, versionado. | Existe: `runAgentTurn`/`runAgentTurnWithFallback` (`packages/ai/src/index.ts`), `agent_runs`/`agent_versions`/`prompt_versions` (DB-08), fallback Anthropic->OpenAI (R-020), presupuesto por turno (`evaluateAgentBudget`, AI-00). | Sin maquina de estados formal documentada (`queued`/`cancelled` no existen como valores reales, ver gap de AI-10) ni model routing por agente/organizacion (AI-09, `planned`). |
| 2 | **Loop Engineering** | Como el agente itera: cuantas llamadas a herramientas por turno, cuando para, como reintenta. | **Cerrado 2026-07-28** -- la politica ya existia en codigo, solo faltaba declararla: `DEFAULT_AGENT_BUDGET` (`apps/api/src/ai-runtime.ts:56`, `maxCostUsd: 1, maxToolCalls: 10`) se revisa con `evaluateAgentBudget` (`packages/ai/src/index.ts`) despues de cada llamada a herramienta y corta el turno con `AgentBudgetExceededError` si se supera -- limite duro real, no aspiracional, verificado por tests (`index.test.ts`). El caso de "herramienta no permitida" no necesita manejo de error: `buildAgentTools` solo construye y ofrece al modelo las herramientas listadas en `allowed_tools` (`ai-runtime.ts:170-181`) -- el modelo estructuralmente nunca ve una herramienta fuera de su catalogo permitido, no hay nada que rechazar. Retry a nivel de turno completo solo existe para caida del proveedor (R-020, `runAgentTurnWithFallback`), no para fallos de herramienta individual -- correctamente fuera de alcance (un fallo de tool query se resuelve dentro del mismo turno, el modelo ve el error y decide). | Politica es plana (10 tool calls para todos los agentes) igual que el presupuesto de coste -- afinar por agente/complejidad es AI-09, no bloqueante. |
| 3 | **Context Engineering** | Que evidencia/contexto se le da al modelo antes de razonar, y como se filtra. | El mas maduro de los 10: patron *evidence-pack* (A02/A04/A06/A08/A09, sin `sql_select` libre desde R-005/R-011), `client_constraints` inyectadas siempre (AI-07), `knowledge_search` con `audience_allowed` obligatorio (AI-07), instruccion anti-prompt-injection en cualquier agente con `search_knowledge` (AI-04/AI-07). Eval real de prompt injection documental ya corrida (BE-07). | Sin busqueda hibrida en RAG (solo vectorial, AI-04), sin chunking mas alla de parrafos, sin autoridad de fuentes para resolver contradicciones (AI-04). |
| 4 | **Tool Design** | Contratos de las herramientas que un agente puede invocar: validacion, limites, superficie minima. | SQL Gateway (AI-03) es el ejemplo mejor cerrado: doble validacion (AST en Node + `ai` schema con `statement_timeout=8000ms`, `search_path` fijo, `LIMIT` forzado, `security definer`), `WITH RECURSIVE` rechazado explicitamente (cerrado 2026-07-23), tenant fijado con `set_config` dentro de una unica llamada transaccional. `search_knowledge` (AI-04/AI-07) es el segundo ejemplo. | `pg_sleep`/`generate_series` sin bloqueo explicito en el validador SQL (no bloqueante, señalado en BE-07). Sin catalogo centralizado de "que herramientas existen, que agente las usa, que limites tiene cada una" — la informacion vive repartida en varios archivos. |
| 5 | **Memory Architecture** | Que recuerda el sistema entre ejecuciones/clientes, con que alcance y quien puede leerlo. | Implementado end-to-end (AI-07): jerarquia `global`/`organization`/`store` (`knowledge_documents.store_id`), audiencia `client_visible`/`consultant_only`/`system_only` con enforcement obligatorio, ciclo de vida `pending_indexing`/`active`/`superseded`/`deleted`/`indexing_failed`, ingestion asincrona idempotente (`memory_ingestion_queue`), origen/autoridad separados de "revisado por humano". Retencion de transcripciones/documentos decidida (ADR-0016, 2026-07-27: sin limite de tiempo, sin redaccion, mientras no haya cliente real). | Falta `VOYAGE_API_KEY` en el secret de produccion (sin ella el cron no procesa). `/conocimiento` sigue siendo una tabla plana, no distingue memoria automatica de documentos subidos a mano. |
| 6 | **Orchestration patterns** | Como coordinan varios agentes entre si sin pisarse ni duplicar trabajo. | No existe un orquestador (A00 propuesto, diferido por decision explicita, no por bloqueo). **Cerrado 2026-07-27** (los dos angulos del riesgo A02/A04): (1) `decideAgentOutput` deduplica por titulo exacto normalizado contra el backlog abierto antes de crear una tarea (`ai-orchestration-task-dedup.test.ts`, 1/1 real contra Supabase remoto); (2) prompt A02 v4 (aplicado en produccion) instruye `proposed_writes: []` siempre -- A02 diagnostica, A04 es el unico que crea tareas. | Disciplina cerrada para el riesgo señalado. Si en el futuro se suman mas agentes de diagnostico (A03/A05/A07 tras Meta), revisar si necesitan la misma instruccion. |
| 7 | **Guardrails & permissions** | Limites duros que protegen produccion: quien puede escribir que, bajo que rol, con que limite de coste. | Maduro: RLS multi-tenant con 71+ tests reales (SQO-00), aprobacion humana obligatoria antes de cualquier escritura materializada (R-005), presupuesto de agente aplicado de verdad (`AgentBudgetExceededError`, R-011), rate limiting en los 6 endpoints de IA + limite global (SQO-00), `checkOutputSanity` como guarda estructural (AI-06). | Presupuesto es plano por turno, no por agente/organizacion (AI-09, `planned`). Sin circuit breaker que desactive un agente completo tras N fallos consecutivos. |
| 8 | **Evals for agentes** | Datasets y quality gates que miden si un agente sigue funcionando bien version tras version, no solo si compila. | En progreso real, no solo documentado: datasets propios para A01/A02/A06/A08 (`packages/ai`, `apps/api/src/eval-a02-monitor.ts`), quality gates deterministicos (coste maximo, latencia maxima) que fallan el eval igual que un check hard, eval adversarial de prompt injection (BE-07), eval de retrieval RAG (recall@8/@3, AI-04). | Sin datasets para A04/A09, sin historial de metricas entre corridas para comparar versiones de prompt, sin proceso de regresion formal (dataset -> shadow -> canary) que bloquee activar una `agent_versions` nueva antes de producción. |
| 9 | **Human in the loop design** | Donde y como interviene un humano antes de que algo se materialice. | El patron mas consistente del producto, no un añadido: nada se escribe sin aprobacion (`agent_outputs.status: draft/pending_approval/approved/rejected/published`), shadow mode explicito para A02/A04/A06/A08/A09, reaprobacion distingue 409 de 404 real (AI-01, cerrado 2026-07-23). | No esta documentado como disciplina propia con principios generales (ej. que pasa si llega una transcripcion nueva sobre un resumen ya aprobado — BE-05, pendiente de decision de producto) — cada agente resuelve el mismo problema por separado en vez de seguir una politica comun escrita. |
| 10 | **Observability & tracing** | Poder reconstruir que paso en una ejecucion de agente: que vio, que penso, que costo, que fallo. | **Cerrado 2026-07-28** el gap de reconstruccion: `getAgentRunTrace` (`apps/api/src/ai-runtime.ts`) consolida `agent_runs`+`agent_run_steps`+`agent_tool_calls`+`agent_context_snapshots`+`agent_query_runs` en una sola respuesta, restringida a consultor/platform_admin; ruta `GET /v1/organizations/:organizationId/ai/runs/:runId/trace`; pagina nueva `/agentes` (panel tecnico, Table de HeroUI) lista ejecuciones y muestra la traza completa por ejecucion. 3 tests reales contra Supabase (`ai-observability-trace.test.ts`, servidor Fastify real via `buildApp()`+`app.inject`): acceso denegado a no-consultor, traza completa visible para consultor asignado, 404 real para un run inexistente. `ops-health-check.yml` (SQO-02) ya alerta sobre agentes cortados por presupuesto; logs de Fastify/worker con `organization_id`/`user_id` correlacionados (SQO-02). | Sin metricas agregadas ni error tracking/APM (Q-014, sin decidir: Sentry u otro) -- eso sigue siendo infraestructura de pago, fuera de alcance de esta mitigacion. |

## Criterios de cierre (por disciplina, no todo-o-nada)

- [ ] **Harness/Loop**: politica escrita de limite de herramientas/iteraciones por turno + maquina de
      estados formal de `agent_runs` (incluye `queued`/`cancelled` si se decide anadirlos).
- [x] **Orchestration (dedup literal)**: `decideAgentOutput` no crea una tarea si ya existe una abierta
      con el mismo titulo normalizado -- cerrado 2026-07-27, `ai-orchestration-task-dedup.test.ts`.
- [x] **Orchestration (frontera semantica)**: cerrado 2026-07-27 -- prompt A02 v4 (`agent_versions`, aplicada
      en produccion) instruye `proposed_writes: []` siempre; A04 sigue siendo el unico que crea tareas. No
      cubre el caso de que A04 mismo proponga dos tareas equivalentes con redaccion distinta entre corridas
      (fuera de alcance, no era el riesgo senalado).
- [ ] **Evals**: dataset para A04 y A09; historial de metricas entre versiones de prompt.
- [x] **Observability**: cerrado 2026-07-28 -- `/agentes` (frontend) + `getAgentRunTrace` (backend)
      reconstruyen una ejecucion completa sin consultar SQL a mano. Falta metricas agregadas/APM (fuera de
      alcance, infraestructura de pago).
- [ ] **Tool Design**: catalogo centralizado de herramientas disponibles por agente con sus limites.
- [ ] Las 6 disciplinas restantes (Context, Memory, Guardrails, Human-in-the-loop) ya tienen
      implementacion real -- cierre pendiente es principalmente documentacion explicita de la practica
      como tal, no codigo nuevo urgente.

## Fuera de alcance de este documento

- Reemplazar AI-00/AI-03/AI-04/AI-06/AI-07/AI-10 — este documento referencia esas fases, no las duplica.
- Decidir model routing (AI-09) o generador de contenido (AI-11) — tienen su propio documento.
