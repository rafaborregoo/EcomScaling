# AI Infrastructure Audit — EcomScaling / NORA

**Fecha:** 2026-09-09 · **Commit base:** `3f5f32d` · **Fase:** 0 (inspección, sin cambios de código)

Este documento es el resultado de inspeccionar el repositorio completo antes de tocar nada.
Cada afirmación va con ruta y, cuando aporta, número de línea. No hay ninguna fila basada en
suposición: lo que no se ha podido demostrar leyendo el código se marca como tal.

> **Los números de línea son del commit base `3f5f32d`**, el estado *anterior* a las fases de
> implementación. Es a propósito: este documento es el diagnóstico de partida y tiene que
> seguir siendo verificable contra el código que diagnosticó. Para el estado actual, ver
> [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

## Cómo leer este documento

El encargo pedía "una matriz" con 8 columnas. Una tabla Markdown de 30 filas × 8 columnas
es ilegible, así que se divide en dos:

1. **Índice de estado** (tabla corta: TERM / STATUS / PRIORITY) — para barrer de un vistazo.
2. **Una ficha por concepto** con los 8 campos etiquetados
   (`STATUS`, `CURRENT_IMPLEMENTATION`, `EVIDENCE`, `GAPS`, `TARGET_IMPLEMENTATION`,
   `OBSERVABILITY`, `PRIORITY`) — el contenido completo que pedía la matriz.

---

## Resumen ejecutivo

La premisa del encargo ("convertir la infraestructura de IA existente en una plataforma
auditable") merece un matiz importante y medible: **buena parte ya existe y está bien hecha**.
El repositorio tiene, hoy, en producción:

- Un runtime de agentes con contrato de salida validado contra JSON Schema + Zod
  (`packages/ai/src/index.ts`).
- Un modelo de datos de ejecuciones normalizado y con RLS por tenant: `agent_runs`,
  `agent_run_steps`, `agent_tool_calls`, `agent_context_snapshots`, `agent_query_runs`,
  `agent_outputs`, `agent_approvals`
  (`supabase/migrations/20260717200000_db_08a_runtime_agentes.sql`).
- Registro de prompts inmutable y versionado con checksum (`public.prompt_versions`).
- Presupuestos reales que **cortan** la ejecución (por run, por organización/día, por
  plataforma/día) y un circuit breaker por organización
  (`apps/api/src/ai-runtime.ts:414-660`, `1654-1736` de `packages/ai/src/index.ts`).
- Frontera de contenido no confiable con neutralización de inyecciones
  (`packages/ai/src/untrusted-context.ts`).
- SQL Gateway con validación de AST, allowlist de tablas, timeout y tope de filas
  (`apps/api/src/sql-gateway.ts`).
- Evaluaciones deterministas con release gate sin LLM-como-juez
  (`packages/ai/src/release-gate.ts`, `agent-evals.ts`, `.github/workflows/agent-evals.yml`).
- Un panel `/admin/observabilidad` con coste, latencia p95 y runs por agente/cliente/consultor.

Lo que **falta** no es la infraestructura: es la **correlación y la fidelidad del registro**.

### Los cinco huecos que impiden cumplir el objetivo final

Son concretos, y los cinco se pueden demostrar:

1. **El proveedor y el modelo realmente usados no se guardan.**
   `runAgentTurnWithFallbackCore` (`apps/api/src/ai-runtime.ts:695`) puede caer de Anthropic
   a OpenAI en silencio. El turno devuelve `turn.model` con el modelo real, pero
   `runGenericDiagnosticAgent` sólo lo escribe como **prosa dentro del payload de un paso**
   (`ai-runtime.ts:2846-2861`, literal `Llamada al modelo ${turn.model}`); el `UPDATE` de
   `agent_runs` (`ai-runtime.ts:2886-2897`) no incluye ni `provider` ni `model`.
   El trace (`getAgentRunTrace`, `ai-runtime.ts:9794`) muestra `agent_versions(model)`,
   que es el modelo **configurado**, no el ejecutado.
   → _Hoy, ante un incidente, el panel puede mentir sobre qué modelo respondió._

2. **No hay `trace_id`.** La API ya genera y devuelve `x-request-id`
   (`apps/api/src/server.ts:470`, `594`) y el orquestador ya genera un `tick_id`
   (`ai-runtime.ts:5892`), pero ninguno de los dos llega a `agent_runs`. No se puede unir
   una petición del navegador con la ejecución que provocó, ni agrupar las N ejecuciones
   de una misma pasada de cron.

3. **Las detecciones de inyección se cuentan y se tiran.**
   `serializeUntrustedContextBlocks` devuelve `blockedPatterns`
   (`packages/ai/src/untrusted-context.ts:29-50`), y `runAgentTurn` descarta el campo:
   `serializeUntrustedContextBlocks(params.contextBlocks).text`
   (`packages/ai/src/index.ts:2015`). No existe ninguna tabla ni evento de seguridad en
   todo el esquema (comprobado: `grep -riE "security_event|prompt_injection"` sobre
   `apps/`, `packages/` y `supabase/` no devuelve nada).

4. **`estimateCostUsd` devuelve `0` cuando no conoce el modelo**
   (`packages/ai/src/index.ts:1492-1511`). Un modelo nuevo, o el fallback a OpenAI con un
   id no listado en `MODEL_PRICING`, produce coste cero silencioso: los topes de presupuesto
   dejan de morder y la factura del panel es falsa. Viola directamente la regla de "no falsear
   capacidades": `0` no es lo mismo que `desconocido`.

5. **Sin jerarquía ni agrupación de ejecuciones.** No hay `parent_run_id`, `root_run_id`
   ni `parallel_group_id`. El orquestador (`runDiagnosticOrchestratorTick`,
   `ai-runtime.ts:5882`) lanza hasta N agentes por pasada y no queda registro de que
   pertenecen a la misma pasada, salvo en `ai_diagnostic_gate_log.tick_id`, que es una tabla
   distinta y sin FK a `agent_runs`.

### Deuda técnica encontrada (no pedida, pero relevante)

- **`apps/api/src/ai-runtime.ts` tiene 9.855 líneas.** Contiene el runtime, 20+ agentes,
  el orquestador, el chat, el workspace de marketing y las consultas del panel. Es el
  cuello de botella de cualquier cambio transversal.
- **Dos implementaciones paralelas del mismo turno.** `runAgentTurn` (líneas 1990-2275) y
  `runAgentTurnOpenAI` (2282-2549) comparten contrato pero duplican el bucle de tools, el
  conteo de tokens y la validación. Cualquier mejora hay que hacerla dos veces — y ya
  divergen: sólo la de Anthropic envía `cache_control`.
- **La orquestación LangGraph es un envoltorio vacío.** `runOperationThroughLangGraph`
  (`packages/ai/src/agent-orchestration.ts:70-92`) construye un grafo de **un solo nodo**
  que llama a la operación. No aporta estado, ni reanudación, ni ramas: es dependencia y
  latencia sin contrapartida.
- **LangSmith nunca captura payloads.** `capturePayloads` está fijado a `false`
  (`langsmith-observability.ts:24`) y `processInputs` devuelve `{ captured: false }`.
  La decisión de privacidad es correcta; el efecto es que LangSmith sólo ve nombres y
  duraciones — información que ya está en `agent_run_steps` sin salir de nuestra base.

---

## Índice de estado

| #   | TERM                        | STATUS                                    | PRIORITY |
| --- | --------------------------- | ----------------------------------------- | -------- |
| 01  | Prompts / Prompt Registry   | IMPLEMENTED                               | P2       |
| 02  | Ventana de contexto         | PARTIAL                                   | P1       |
| 03  | Tokens                      | PARTIAL                                   | P0       |
| 04  | Proyectos / ámbito          | IMPLEMENTED                               | P3       |
| 05  | Skills                      | PARTIAL                                   | P2       |
| 06  | MCP                         | MISSING (decisión: no introducir todavía) | P3       |
| 07  | CLI                         | DEV_TOOLING                               | P2       |
| 08  | API Keys                    | IMPLEMENTED                               | P3       |
| 09  | Goal / objetivo persistente | PARTIAL                                   | P1       |
| 10  | Compactación de contexto    | PARTIAL                                   | P2       |
| 11  | Subagentes                  | MISSING                                   | P1       |
| 12  | Prompt caching              | PARTIAL                                   | P1       |
| 13  | Git Worktrees               | DEV_TOOLING                               | P3       |
| 14  | Cronjobs                    | PARTIAL                                   | P1       |
| 15  | Hooks / lifecycle           | MISSING                                   | P2       |
| 16  | Agent Harness               | PARTIAL                                   | P0       |
| 17  | Agentes en segundo plano    | PARTIAL                                   | P2       |
| 18  | Headless execution          | IMPLEMENTED                               | P3       |
| 19  | Agentes paralelos           | PARTIAL                                   | P1       |
| 20  | Progressive disclosure      | PARTIAL                                   | P2       |
| 21  | Test-guided loops           | IMPLEMENTED                               | P2       |
| 22  | Cuantización                | PROVIDER_MANAGED                          | P3       |
| 23  | RLHF                        | NOT_APPLICABLE_WITH_CURRENT_ARCHITECTURE  | P2       |
| 24  | Consolidación de memoria    | PARTIAL                                   | P2       |
| 25  | Self-improvement loops      | PARTIAL                                   | P2       |
| 26  | Tool poisoning              | PARTIAL                                   | P0       |
| 27  | Self-healing tests          | NOT_APPLICABLE_WITH_CURRENT_ARCHITECTURE  | P3       |
| 28  | Agent CI/CD                 | PARTIAL                                   | P1       |
| 29  | Test-time compute           | PARTIAL                                   | P2       |
| 30  | KV Cache                    | PROVIDER_MANAGED                          | P3       |

**P0** = bloquea el objetivo final (trazabilidad fiel). **P1** = necesario para investigar un
incidente. **P2** = necesario para crecer. **P3** = decidido y documentado, sin trabajo
pendiente relevante.

---

# Fichas por concepto

## 01 — Prompts / Prompt Registry

- **STATUS:** IMPLEMENTED
- **CURRENT_IMPLEMENTATION:** Existe un registry real e inmutable. `public.prompt_versions`
  (`code`, `version`, `content`, `checksum` SHA-256, `created_at`, único por `(code, version)`).
  `public.agent_versions` referencia `prompt_code` + `prompt_version` y marca cuál está activa
  (`is_active`). Cada run apunta a `agent_version_id`, así que la versión de prompt usada es
  derivable por join sin duplicar el dato. Las nuevas versiones se dan de alta por migración
  idempotente (`insert ... on conflict do nothing` + `update agent_versions set is_active`).
  Hay además una plantilla canónica documentada y un test que la exige.
- **EVIDENCE:**
  - `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql:18-44`
  - Ejemplo de alta de versión: `supabase/migrations/20260722180000_ai_08_periodo_configurable.sql:16-40`
  - Carga en runtime: `apps/api/src/ai-runtime.ts:2724-2748`
  - `docs/ai/PROMPT_TEMPLATE_CANONICO.md`, `packages/ai/src/agent-canonical-prompts.test.ts`
  - Composición final: `buildAgentSystemPrompt` (`packages/ai/src/index.ts:1854`)
- **GAPS:** (a) `agent_runs` no guarda `prompt_code`/`prompt_version`/`checksum` desnormalizados;
  si alguna vez se editara una fila de `agent_versions`, los runs históricos apuntarían a otra
  cosa. (b) No hay `environment` ni `activated_at` en `prompt_versions`.
  (c) El prompt de sistema efectivo se compone en runtime (`buildAgentSystemPrompt` +
  `SQL_GATEWAY_SCHEMA_DOC` inyectado en `buildAgentTools`), así que el texto exacto enviado
  al modelo no es exactamente `prompt_versions.content` y no queda registrado su hash.
- **TARGET_IMPLEMENTATION:** Añadir a `agent_runs` el par `prompt_code`/`prompt_version` y un
  `system_prompt_hash` (SHA-256 del prompt de sistema **efectivo**, ya compuesto). Cuesta una
  columna y una línea; convierte "qué prompt produjo esta ejecución" en una respuesta exacta
  en vez de una reconstrucción. No se crea tabla nueva: el registry ya existe y funciona.
- **OBSERVABILITY:** El detalle de run debe mostrar `prompt_code@version` + los 12 primeros
  caracteres del hash efectivo, con botón de copia.
- **PRIORITY:** P2

## 02 — Ventana de contexto

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** El contexto se construye en bloques etiquetados y se persiste
  íntegro en `agent_context_snapshots` (nivel `C0..C4`, hoy siempre `C2`). Hay límites duros de
  tamaño: 12.000 caracteres por bloque y 48.000 en total, con recorte y flag `truncated`
  (`untrusted-context.ts:2-3`, `29-50`). `max_tokens` de salida está fijado a 16.000
  (`index.ts:2058`). Los `input_tokens` reales del proveedor sí se registran en `agent_runs`.
- **EVIDENCE:**
  - `packages/ai/src/untrusted-context.ts:1-50`
  - `apps/api/src/ai-runtime.ts:2795-2824` (snapshot + `recordStep("context_build")`)
  - `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql:96-104`
- **GAPS:** No se registra `context_window_max` (ni se conoce por modelo), ni
  `context_utilization_percent`, ni `messages_count` / `documents_count` / `memory_items_count`.
  El flag `truncated` que devuelve `serializeUntrustedContextBlocks` **se descarta** igual que
  `blockedPatterns` (`index.ts:2015` sólo lee `.text`). No hay eventos `context.*`.
- **TARGET_IMPLEMENTATION:** (a) Dejar de tirar el resultado completo de
  `serializeUntrustedContextBlocks` y registrar `truncated` + recuentos en el paso
  `context_build`. (b) Añadir `context_window_max` a un catálogo de capacidades por modelo,
  con valor `null` (= desconocido) cuando no tengamos fuente fiable — **nunca un número
  inventado**. (c) `context_utilization_percent` se calcula sólo si (b) es conocido.
- **OBSERVABILITY:** Sección "Context" del panel: tamaño, utilización (o `desconocido`),
  fuentes, truncamientos. Alerta cuando la utilización supere el 80 % en modelos con ventana
  conocida.
- **PRIORITY:** P1

## 03 — Tokens

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** `agent_runs` guarda `input_tokens`, `output_tokens`,
  `cache_read_tokens` y `estimated_cost_usd` (`numeric(12,6)`). El coste se calcula con una
  tabla de precios centralizada (`MODEL_PRICING`, `packages/ai/src/index.ts:1478-1490`) — no hay
  precios dispersos por el código. El agregado por día/agente/cliente/consultor ya existe y se
  pinta en `/admin/observabilidad`.
- **EVIDENCE:**
  - `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql:56-60`
  - `packages/ai/src/index.ts:1478-1511` (`MODEL_PRICING`, `estimateCostUsd`)
  - `apps/api/src/ai-runtime.ts:2886-2897` (persistencia)
  - `supabase/migrations/20260827120000_admin_consultor_ai_stats.sql`
- **GAPS (el más grave del audit):**
  1. **`estimateCostUsd` devuelve `0` para un modelo desconocido** (`index.ts:1500-1502`).
     Coste cero silencioso ⇒ presupuestos que no muerden y facturación falsa.
  2. **No se guarda ni `provider` ni el `model` efectivo** (ver Resumen ejecutivo, hueco 1).
     Sin modelo no se puede ni recalcular el coste a posteriori.
  3. `reasoning_tokens` y `cache_creation_tokens` no se leen de la respuesta del proveedor
     (verificado: `grep "reasoning\|cache_creation" packages/ai/src/index.ts` → sin resultados).
  4. La tabla de precios es una constante compilada: cambiar un precio exige desplegar, y los
     runs históricos no conservan qué precio se les aplicó.
- **TARGET_IMPLEMENTATION:**
  - `estimateCostUsd` devuelve `number | null`; `null` = precio desconocido. `agent_runs
.estimated_cost_usd` pasa a ser `nullable` y se añade `cost_basis` (`'priced'` |
    `'unknown_model'`). Un run con coste desconocido **cuenta como incidente visible**, no
    como gratis. El evaluador de presupuesto trata `null` como "no verificable" y lo registra.
  - Columnas nuevas nullable en `agent_runs`: `provider`, `model`, `reasoning_tokens`,
    `cache_creation_tokens`. `null` = el proveedor no lo expuso; nunca `0`.
  - `pricing_version` en el run (hash o fecha de la tabla de precios aplicada).
- **OBSERVABILITY:** Dashboard de costes por tenant / usuario / agente / modelo / proveedor /
  día, más un contador explícito de "runs con coste no calculable".
- **PRIORITY:** P0

## 04 — Proyectos / ámbito de ejecución

- **STATUS:** IMPLEMENTED
- **CURRENT_IMPLEMENTATION:** El concepto ya existe y **no hace falta inventar otro**. La
  jerarquía real es `organization` (tenant) → `shopify_store` (tienda) → ejecución. Toda fila
  de IA lleva `organization_id` con FK y RLS; `agent_runs` lleva además `store_id`. El tenant
  lo resuelve siempre el backend a partir de la sesión (`requireMembership`), nunca el modelo
  — es un principio declarado en la cabecera de `packages/ai/src/index.ts:1-6` y aplicado.
- **EVIDENCE:**
  - `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql` (todas las tablas con
    `organization_id ... references public.organizations`)
  - `supabase/migrations/20260722140000_ai_05_agent_runs_store_scope.sql` (`store_id`)
  - `apps/api/src/ai-runtime.ts:811` (`requireMembership`), `apps/api/src/store-scope.ts`
  - Tests de aislamiento: `apps/api/src/rls-tenant-isolation.test.ts` (1.086 líneas),
    `apps/api/src/db-02-metrics-rpc-tenant-isolation.test.ts`
- **GAPS:** Ninguno relevante. `ai_conversations` / `ai_messages` cubren el eje conversación.
- **TARGET_IMPLEMENTATION:** No crear abstracción nueva. Sólo asegurar que las tablas que se
  añadan en fases posteriores (eventos de seguridad, feedback) lleven `organization_id` + RLS
  con la misma política.
- **OBSERVABILITY:** Filtro por tenant y por tienda en todas las vistas del panel.
- **PRIORITY:** P3

## 05 — Skills

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** No existe un "Skill Registry" con ese nombre, pero sí existe el
  concepto con otra forma: `agent_definitions` (código + nombre + activo) × `agent_versions`
  (versión, modelo, prompt, `allowed_tools`, `approval_mode`, `output_schema_version`,
  `config`). Es decir: **instrucciones reutilizables, versionadas, con hash indirecto
  (`prompt_versions.checksum`) y flag de activación**. Los campos que pedía el encargo
  (`skill_id`, `name`, `version`, `description`, `instructions_ref`, `hash`, `enabled`,
  `created_at`) tienen todos correspondencia.
- **EVIDENCE:** `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql:8-44`;
  `apps/api/src/ai-runtime.ts:2705-2748` (resolución de versión activa + prompt).
- **GAPS:** No hay composición: un agente = un prompt. No se pueden cargar N "skills" en un
  run ni registrar cuáles se cargaron. No hay progressive disclosure de instrucciones
  (ver ficha 20).
- **TARGET_IMPLEMENTATION:** **No crear tablas nuevas todavía.** Con 20+ agentes y un prompt
  por agente, un registry de skills separado sería una abstracción sin segundo consumidor.
  La preparación barata: registrar en el run un array `loaded_skills` (hoy siempre de un
  elemento: el prompt activo). Cuando exista el primer agente que componga dos conjuntos de
  instrucciones, promoverlo a tabla.
- **OBSERVABILITY:** Campo "skills cargadas" en el detalle de run (hoy: una entrada).
- **PRIORITY:** P2

## 06 — MCP (Model Context Protocol)

- **STATUS:** MISSING — con decisión arquitectónica explícita de **no introducirlo ahora**.
- **CURRENT_IMPLEMENTATION:** No hay MCP en el runtime. Comprobado:
  `grep -rn "modelcontextprotocol\|MCP" apps packages` (excluyendo `node_modules`) no devuelve
  nada. Lo que sí existe es la pieza que MCP resolvería: un **registro de herramientas cerrado**
  con permisos, contratos de entrada/salida en Zod, conector asociado y autorización explícita.
- **EVIDENCE:** `packages/ai/src/tool-layer.ts` — `TOOL_REGISTRY` (línea 224),
  `TOOL_CONTRACTS` (418), `authorizeTool` (658), `toolPermissionSchema` (12).
  Nota: `.mcp.json` en la raíz configura servidores MCP **del entorno de desarrollo**
  (Supabase, Canva, Vercel para el asistente de código), no del producto.
- **GAPS:** Si algún día hace falta consumir herramientas de terceros, hoy habría que
  cablearlas a mano.
- **TARGET_IMPLEMENTATION:** **Decisión: no introducir MCP.** Todas las herramientas actuales
  son internas (SQL Gateway sobre nuestra propia base, RAG sobre nuestro propio índice). MCP
  aporta valor cuando hay servidores de terceros que descubrir; aquí sólo añadiría una capa de
  transporte y una superficie de ataque nueva. Lo que **sí** se hace es dejar `tool-layer.ts`
  preparado: `ToolDefinition` ya tiene `connector`, `permission` y contrato, que es
  exactamente la forma que necesitaría un adaptador MCP el día que exista un servidor externo.
  Cuando llegue ese día, las herramientas MCP entran por `TOOL_REGISTRY` como cualquier otra y
  heredan el tratamiento de entrada no confiable de la ficha 26.
- **OBSERVABILITY:** N/A hoy. La sección "Tools" del panel ya sirve para lo que hay.
- **PRIORITY:** P3

## 07 — CLI

- **STATUS:** DEV_TOOLING
- **CURRENT_IMPLEMENTATION:** Hay 26 scripts en `scripts/` y comandos npm, pero ninguno
  ejecuta agentes. Lo que sí existe como entrada headless son los `*-once.ts` del worker,
  que llaman **exactamente al mismo código de producción** (`apps/worker/src/agent-evals-once.ts`
  → `@ecomscaling/api`). Hay además un `createReplayToolExecutor` para reejecutar un turno con
  las tool calls congeladas de un run real (`packages/ai/src/index.ts:109`).
- **EVIDENCE:** `scripts/`, `apps/worker/src/agent-evals-once.ts`,
  `packages/ai/src/index.ts:78-146` (`createToolReplayFixture`, `createReplayToolExecutor`),
  `apps/api/src/ai-runtime.ts:9838` (el trace ya devuelve `replay_fixture`).
- **GAPS:** No hay un único punto de entrada `ai:*`. Investigar un run desde la terminal exige
  saber qué script llamar.
- **TARGET_IMPLEMENTATION:** Un solo script `scripts/ai.mjs` con subcomandos
  (`trace`, `replay`, `providers`, `health`, `eval`) que **importe** las funciones existentes.
  Cero lógica de IA propia: si el CLI necesitara una segunda implementación, sería un error.
  Justificación de que aporta valor: `replay` ya tiene el fixture construido y hoy no hay forma
  de consumirlo.
- **OBSERVABILITY:** El CLI lee de las mismas tablas que el panel; no genera telemetría propia.
- **PRIORITY:** P2

## 08 — API Keys y secretos

- **STATUS:** IMPLEMENTED
- **CURRENT_IMPLEMENTATION:** Las claves de proveedor viven sólo en variables de entorno
  validadas por Zod y marcadas opcionales (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `VOYAGE_API_KEY`, `LANGSMITH_API_KEY`). Las credenciales de integraciones de cliente
  (Shopify/Meta/Klaviyo) están en el esquema `private`, fuera del alcance de RLS de
  `authenticated`. La redacción antes de log es central: `redactSensitive` +
  `redactSensitiveText` en `@ecomscaling/observability`, con regex de claves sensibles. CI
  ejecuta Gitleaks y un audit de dependencias.
- **EVIDENCE:**
  - `packages/config/src/index.ts:56-83`
  - `private.integration_credentials`, `private.meta_asset_tokens`
  - `packages/observability/src/index.ts:29-62`
  - `.github/workflows/ci.yml` (jobs `secret-scan`, `Dependency audit`), `.gitleaksignore`
  - `SECURITY_AUDIT.md`, `SECURITY_AUDIT_EVIDENCE.md`
- **GAPS:** No hay una tabla de "configuración de proveedor" con
  `provider` / `credential_reference` / `status` / `last_verified_at`; el estado de los
  proveedores se infiere de si la env var existe (`hasConfiguredAiProvider`,
  `ai-runtime.ts:124`). La redacción central existe pero **no cubre la telemetría de IA**:
  `agent_tool_calls.input` / `.output` se guardan como `jsonb` sin pasar por
  `redactSensitive` (ver ficha 26 y sección de privacidad).
- **TARGET_IMPLEMENTATION:** Reutilizar `redactSensitive` como `sanitizeForTelemetry()` único
  antes de cualquier escritura en `agent_tool_calls` / `agent_context_snapshots`. Añadir un
  catálogo de proveedores (ficha 22/30) que registre `status` y `last_verified_at` **sin** el
  secreto.
- **OBSERVABILITY:** Sección "Providers" del panel: proveedor, si hay credencial configurada
  (booleano), última verificación. Nunca el valor.
- **PRIORITY:** P3

## 09 — Goal / objetivo persistente

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Cada run tiene `objective` (texto obligatorio), `time_range`,
  `entity_ids`, `lookback_days` y `store_id`. El presupuesto existe y corta de verdad:
  `AgentBudget { maxCostUsd, maxToolCalls }`, evaluado en `evaluateAgentBudget` y aplicado en
  cada ronda (`enforceBudget`). Hay tope de pasos (`MAX_MODEL_CALLS_PER_TURN = 16`) y timeout
  por llamada (45 s, `DEFAULT_AGENT_RESILIENCE_POLICY`). Los estados finales ya distinguen el
  motivo: `succeeded` | `failed` | `rejected_output` | `budget_exceeded`.
- **EVIDENCE:**
  - `packages/ai/src/index.ts:1654-1736` (budget), `1615` (max calls), `2086-2096` (`enforceBudget`)
  - `packages/ai/src/resilience.ts:14-20`
  - `supabase/migrations/20260722190000_ai_09_budget_status.sql` (estado `budget_exceeded`)
  - `apps/api/src/ai-runtime.ts:660-683` (`describeAgentTurnFailure`), `321` (`resolveAgentBudget`)
- **GAPS:** No hay `success_criteria` ni `stop_conditions` declarativos. Falta el estado
  `cancelled` (no hay cancelación) y `timeout` no se distingue de `failed` — el
  `AgentRequestTimeoutError` acaba en la rama genérica de `describeAgentTurnFailure`. El
  presupuesto **efectivo** aplicado a cada run no se guarda: `resolveAgentBudget` lo calcula
  en memoria a partir de env vars, así que un run que murió por presupuesto no dice contra
  qué límite murió. `stop_reason` del proveedor sólo vive en el payload de un paso.
- **TARGET_IMPLEMENTATION:** Añadir a `agent_runs`: `stop_reason` (del proveedor),
  `budget_max_cost_usd` + `budget_max_tool_calls` (el límite realmente aplicado) y ampliar el
  check de `status` con `timeout` y `cancelled`. `describeAgentTurnFailure` gana una rama para
  `AgentRequestTimeoutError`.
- **OBSERVABILITY:** El detalle de run muestra objetivo, límite aplicado, consumo y el motivo
  exacto de terminación, diferenciando visualmente ERROR / SECURITY BLOCK / TIMEOUT / BUDGET.
- **PRIORITY:** P1

## 10 — Compactación de contexto

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Hay recorte determinista, no compactación por LLM: tope de
  12.000 caracteres por bloque y 48.000 por contexto, con `truncated: true`. Existe además un
  contrato de salida "lean" (`buildLeanOutputContract`, `index.ts:1568`) que reduce el gasto
  quitando campos que la UI no pinta, rellenándolos con valores derivados y documentando el
  porqué. El contexto completo enviado queda persistido en `agent_context_snapshots`.
- **EVIDENCE:** `packages/ai/src/untrusted-context.ts:2-3, 29-50`;
  `packages/ai/src/index.ts:1550-1601`; `apps/api/src/ai-runtime.ts:2795-2812`.
- **GAPS:** El recorte es **silencioso**: `truncated` se descarta (`index.ts:2015`). No hay
  `compaction_id`, `before_tokens`/`after_tokens`, `strategy`, `summary_hash` ni
  `preserved_decisions`. No hay ninguna garantía explícita de que IDs y decisiones críticas
  sobrevivan al recorte — hoy sobreviven por orden de los bloques, no por diseño.
- **TARGET_IMPLEMENTATION:** Primero lo barato y honesto: **dejar de tirar `truncated`** y
  registrar en el paso `context_build` qué bloques se recortaron y cuántos caracteres se
  perdieron. Un run con contexto recortado debe ser visible en el panel. La compactación por
  resumen (con `summary_hash` y `preserved_decisions`) sólo se implementa cuando exista un
  agente conversacional de larga duración que la necesite; hoy los turnos son de una vuelta
  y no hay historial que compactar.
- **OBSERVABILITY:** Contador de runs con contexto truncado, por agente. Es una señal de
  calidad: si sube, el agente está recibiendo menos evidencia de la que cree.
- **PRIORITY:** P2

## 11 — Subagentes

- **STATUS:** MISSING
- **CURRENT_IMPLEMENTATION:** No existen. Ningún agente lanza a otro. El "orquestador"
  (`runDiagnosticOrchestratorTick`) es un planificador que decide **qué runs independientes
  ejecutar**, no un agente padre: no consume sus salidas ni las compone.
- **EVIDENCE:** `apps/api/src/ai-runtime.ts:5882-6250`; `agent_runs` no tiene
  `parent_run_id` ni `root_run_id` (esquema completo verificado en `db_08a` + los 5 `alter
table` posteriores).
- **GAPS:** Sin columnas de jerarquía, el día que exista el primer subagente no habrá dónde
  colgarlo, y el panel no podrá dibujar el árbol que pide el encargo.
- **TARGET_IMPLEMENTATION:** Añadir `parent_run_id` (FK auto-referencial) y `root_run_id`
  a `agent_runs` **ahora**, aunque hoy sean `null` en el 100 % de las filas. Justificación:
  es una columna nullable y un índice, cuesta prácticamente nada, y evita una migración
  con backfill sobre una tabla ya grande más adelante. El árbol del panel se construye con
  una CTE recursiva sobre `root_run_id`.
- **OBSERVABILITY:** Vista de árbol en el detalle de trace. Con jerarquía vacía, se degrada
  a la vista plana actual sin código condicional feo.
- **PRIORITY:** P1

## 12 — Prompt caching

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** **Los dos proveedores están cubiertos y ambos miden de verdad.**
  Anthropic: el prompt de sistema se envía con `cache_control: { type: "ephemeral" }` y se lee
  `usage.cache_read_input_tokens`. OpenAI: el caching es automático (no hay nada que declarar)
  y se lee `usage.prompt_tokens_details.cached_tokens`. Ambos caminos acumulan en la misma
  variable `cacheReadTokens`, que se persiste en `agent_runs.cache_read_tokens`. Es medido,
  no inferido.
- **EVIDENCE:** `packages/ai/src/index.ts:2058-2065` (declaración del cache en Anthropic),
  `2128` y `2200` (lectura Anthropic), `2395` y `2468` (lectura OpenAI),
  `apps/api/src/ai-runtime.ts:2891` (persistencia).
- **GAPS:** (a) `cache_creation_input_tokens` no se lee en Anthropic: sin él sólo conocemos el
  consumo cacheado, no el ahorro. (b) **Los dos caminos usan `?? 0`**
  (`index.ts:2128`, `2200`, `2395`, `2468`), así que "el proveedor no informó" y "no hubo
  ningún hit" quedan registrados con el mismo valor `0` — exactamente el falseo que el encargo
  prohíbe. (c) El ahorro no se calcula en ninguna parte.
- **TARGET_IMPLEMENTATION:** `cache_read_tokens` y `cache_creation_tokens` pasan a
  **nullable** y el acumulador arranca en `null`: sólo se convierte en número cuando el
  proveedor reporta el campo al menos una vez en el turno. Leer además
  `cache_creation_input_tokens` en Anthropic. El ahorro se calcula sólo cuando ambos valores
  son conocidos y el precio del modelo también.
- **OBSERVABILITY:** Columna "cache" en costes con tres estados visuales: hit medido, sin hit
  medido, **desconocido**. Los tres son distintos.
- **PRIORITY:** P1

## 13 — Git Worktrees

- **STATUS:** DEV_TOOLING — fuera del runtime, por decisión.
- **CURRENT_IMPLEMENTATION:** Nada en el producto, correctamente. El repo tiene `.agents/`,
  `.claude/` y `.codex-runtime/` (configuración de agentes de codificación del equipo).
- **EVIDENCE:** `.agents/`, `.claude/`, `.codex-runtime/`, `apps/skills-lock.json`.
- **GAPS:** No documentado como estrategia.
- **TARGET_IMPLEMENTATION:** Se documenta en `docs/ai/AI_ARCHITECTURE.md` como práctica de
  desarrollo: cuando dos agentes de codificación trabajen a la vez sobre este monorepo, cada
  uno en su worktree, para no pelearse por `node_modules`, `.next` y el estado de
  `supabase/migrations`. **No se convierte en dependencia del runtime** — el producto no
  ejecuta git.
- **OBSERVABILITY:** N/A.
- **PRIORITY:** P3

## 14 — Cronjobs

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Infraestructura de scheduling sólida y doble: BullMQ con jobs
  repetibles en `apps/worker` (incluida limpieza de repetibles huérfanos, con test de
  regresión) y 7 GitHub Actions programadas. Los runs disparados por cron ya se marcan:
  `trigger_type = 'cron'`. El orquestador respeta topes de plataforma, de organización/día y
  por pasada, y registra cada decisión en `ai_diagnostic_gate_log` con su `tick_id` y su
  motivo.
- **EVIDENCE:**
  - `apps/worker/src/worker.ts`, `apps/worker/src/repeatable-jobs.ts` (+ su test)
  - `.github/workflows/{agent-evals,alert-rules,memory-ingestion,ops-health-check,shopify-reconcile,meta-reconcile,klaviyo-reconcile}.yml`
  - `apps/api/src/ai-runtime.ts:5882-6250`
  - `supabase/migrations/20260831082802_ai_diagnostic_orchestrator.sql`
- **GAPS:** `schedule_id` y `scheduled_at` no se guardan en `agent_runs` (sólo `trigger_type`).
  El `tick_id` vive en otra tabla sin FK. No hay protección de solapamiento a nivel de
  ejecución de agente: el `concurrency` de GitHub Actions y el de BullMQ protegen el job, no
  el run. `agent-evals.yml` tiene el `schedule` **comentado** — las evals nocturnas no corren.
- **TARGET_IMPLEMENTATION:** `agent_runs.parallel_group_id` recibe el `tick_id` (une las dos
  cosas con una columna en vez de una tabla nueva) y `agent_runs.trigger_ref` guarda el
  identificador del schedule. Decidir explícitamente si se reactiva el cron de evals.
- **OBSERVABILITY:** Sección "Background jobs": jobs, última pasada, runs generados por pasada
  con enlace al trace.
- **PRIORITY:** P1

## 15 — Hooks / lifecycle events

- **STATUS:** MISSING
- **CURRENT_IMPLEMENTATION:** No hay sistema de hooks. Lo que sí hay son los puntos de control
  deterministas que un sistema de hooks serviría, **hoy cableados directamente en el flujo**:
  presupuesto antes y después de cada llamada (`enforceBudget`), neutralización antes de
  serializar contexto y resultados de tool, `checkOutputSanity` después de validar el schema
  y antes de persistir, y `shouldRequireHumanApproval` antes de publicar. Todos corren en el
  backend, **fuera del LLM** — que es la exigencia importante del encargo, y se cumple.
- **EVIDENCE:** `packages/ai/src/index.ts:2089-2099`, `2015`, `2170`, `1888` (sanity),
  `apps/api/src/ai-runtime.ts:371` (`shouldRequireHumanApproval`), `658` de `tool-layer.ts`
  (`authorizeTool`).
- **GAPS:** No son extensibles ni enumerables: para saber qué controles corrieron en un run
  hay que leer el código, no la traza.
- **TARGET_IMPLEMENTATION:** **No construir un bus de hooks genérico** (sería una abstracción
  con un solo consumidor). En su lugar, hacer _observables_ los controles que ya existen:
  cada uno emite un evento con nombre estable (`security.context_neutralized`,
  `output.sanity_failed`, `budget.warning`...) en la misma tabla de eventos de la fase 1. El
  día que haya un segundo consumidor de un punto del ciclo de vida, se extrae la interfaz.
- **OBSERVABILITY:** El detalle de run lista los controles ejecutados y su veredicto.
- **PRIORITY:** P2

## 16 — Agent Harness / capa común de ejecución

- **STATUS:** PARTIAL — **es la pieza central del trabajo pendiente.**
- **CURRENT_IMPLEMENTATION:** El harness existe y ya cubre casi todas las cajas del diagrama
  del encargo, pero repartido en dos ficheros y con una duplicación importante:
  | Componente del encargo                                                                   | Dónde vive hoy                                                                         |
  | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
  | Provider Router                                                                          | `runAgentTurnWithFallbackCore` (`ai-runtime.ts:695`) + `resolveProviderModel` (`:354`) |
  | Prompt Registry                                                                          | `prompt_versions` + `agent_versions`                                                   |
  | Skill Registry                                                                           | `agent_definitions`/`agent_versions` (ficha 05)                                        |
  | Context Manager                                                                          | `buildContextBlocks` por agente + `serializeUntrustedContextBlocks`                    |
  | Memory Manager                                                                           | `apps/api/src/memory-ingestion.ts` + `knowledge_*`                                     |
  | Tool Registry                                                                            | `TOOL_REGISTRY` / `TOOL_CONTRACTS` (`tool-layer.ts`)                                   |
  | Permission Engine                                                                        | `requireMembership` + filtrado ad-hoc en `buildAgentTools`. **`authorizeTool` existe pero NO se llama en produccion** (ver ficha 26) |
  | Agent Orchestrator                                                                       | `runDiagnosticOrchestratorTick` (`ai-runtime.ts:5882`)                                 |
  | Trace Engine                                                                             | `agent_runs`/`agent_run_steps`/`agent_tool_calls` + `recordStep` (`:2445`)             |
  | Usage Meter                                                                              | `estimateCostUsd` + persistencia en `agent_runs`                                       |
  | Evaluation Engine                                                                        | `agent-evals.ts`, `release-gate.ts`, `agent_version_evaluations`                       |
  | Security Layer                                                                           | `untrusted-context.ts` + `sql-gateway.ts` + `checkOutputSanity`                        |

  **Ningún componente arbitrario llama a OpenAI/Anthropic por su cuenta**: verificado con un
  `grep -rn` de los `import ... from` de `openai` y `@anthropic-ai` sobre `apps/`,
  `packages/` y `scripts/` — los únicos aciertos están en `packages/ai/src/index.ts:7-8` y
  en un test. Esta exigencia del encargo **ya se cumple**.
- **EVIDENCE:** la tabla anterior; `apps/api/src/ai-runtime.ts:695-777`;
  `packages/ai/src/index.ts:1990` y `:2282`.
- **GAPS:**
  1. **`runAgentTurn` y `runAgentTurnOpenAI` son dos implementaciones del mismo bucle** (285
     y 267 líneas). Divergen ya en caching, y divergirán más. No hay una interfaz `AIProvider`.
  2. El router elige proveedor pero **no informa a nadie de cuál eligió** (hueco 1 del resumen).
  3. `ai-runtime.ts` mezcla el harness con 20+ agentes concretos y con las consultas del panel.
  4. LangGraph envuelve el turno sin aportar nada (deuda a retirar).
- **TARGET_IMPLEMENTATION:** Extraer una interfaz `AIProvider` con `generate()`,
  `getCapabilities()` y `getUsage()` normalizado, y **un solo bucle de agente** que la use;
  `AnthropicProvider` y `OpenAIProvider` se quedan sólo con lo que de verdad difiere (armado
  de la request, mapeo de `usage`, forma del tool call). El bucle devuelve `provider`, `model`,
  uso normalizado con `null` donde el proveedor no informa, y `stop_reason`. Ver
  `docs/ai/AI_ARCHITECTURE.md`.
- **OBSERVABILITY:** Tras la extracción, todo run tiene proveedor y modelo reales sin
  esfuerzo adicional en cada agente.
- **PRIORITY:** P0

## 17 — Agentes en segundo plano / ejecución durable

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Las ejecuciones son server-side y persistentes por diseño: el
  `agent_runs` se inserta antes de llamar al modelo y se actualiza al terminar, así que un
  refresco del navegador **no destruye nada** — el requisito del encargo se cumple. Hay una
  cola durable e idempotente para la ingestión de memoria
  (`memory_ingestion_queue`, con `claim`, `attempts`, `MAX_ATTEMPTS = 5` y reclamación de
  claims caducados a los 10 min) y BullMQ para el resto de trabajos.
- **EVIDENCE:** `apps/api/src/ai-runtime.ts:2771-2792` (insert antes de ejecutar);
  `apps/api/src/memory-ingestion.ts:22-25, 175+`;
  `supabase/migrations/20260824130000_ai_07_memory_queue_claims.sql`;
  `apps/worker/src/worker.ts`.
- **GAPS:** Los runs de agente **no pasan por una cola**: se ejecutan en el request de la API.
  No hay estados `queued` / `waiting` / `cancelled`, ni cancelación, ni progreso parcial, ni
  contador de reintentos a nivel de run (los reintentos de `withAgentResilience` son internos
  al turno y no se registran).
- **TARGET_IMPLEMENTATION:** No convertir todos los runs en jobs — la mayoría duran segundos
  y la latencia síncrona es una feature para el consultor. Lo que sí procede: ampliar el check
  de `status` con `cancelled` y `timeout`, y registrar `retry_count` del turno. Encolar sólo
  se justifica cuando exista un agente que tarde minutos.
- **OBSERVABILITY:** Sección "Background jobs" del panel, unificando la cola de memoria, los
  repetibles de BullMQ y los runs con `trigger_type='cron'`.
- **PRIORITY:** P2

## 18 — Headless execution

- **STATUS:** IMPLEMENTED
- **CURRENT_IMPLEMENTATION:** Los agentes ya corren sin UI por tres vías, y **las tres usan el
  mismo código de producción**: (1) endpoints HTTP `/v1/organizations/:id/ai/*`,
  (2) el worker (`apps/worker/src/*-once.ts`, que importan de `@ecomscaling/api`),
  (3) el endpoint interno `/v1/internal/ai/diagnostics/tick` que dispara el orquestador.
  Entrada y salida están estructuradas y validadas (`AgentInput` Zod → `AgentOutput` Zod).
  La semántica de error es un discriminated union `{ ok: true, data } | { ok: false,
statusCode, error, detail }` consistente en todo el runtime.
- **EVIDENCE:** `apps/api/src/server.ts:4336-5054`, `:6209`;
  `apps/worker/src/agent-evals-once.ts`; `packages/ai/src/index.ts:147-237`.
- **GAPS:** Ninguno de fondo. El CLI de la ficha 07 sería una cuarta vía por comodidad.
- **TARGET_IMPLEMENTATION:** Mantener la regla: cualquier entrada nueva importa el runtime,
  nunca lo reimplementa.
- **OBSERVABILITY:** El mismo tracing para las tres vías; se distinguen por `trigger_type`.
- **PRIORITY:** P3

## 19 — Agentes paralelos

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Hay concurrencia controlada y bien pensada, aunque no se llame
  así: `queuePerOrg` serializa los runs de una misma organización (`ai-runtime.ts:2568`),
  `single-flight.ts` deduplica trabajo idéntico en vuelo, `async-concurrency.ts` acota el
  paralelismo, y el orquestador limita runs por pasada
  (`AI_DIAGNOSTICS_MAX_RUNS_PER_TICK`) y por organización/día (`AI_ORG_DAILY_RUN_CAP`).
  El coste está acotado por tres presupuestos encadenados.
- **EVIDENCE:** `apps/api/src/ai-runtime.ts:2568-2620`, `5915-5920`;
  `apps/api/src/single-flight.ts`; `apps/api/src/async-concurrency.ts`;
  `apps/api/src/ai-runtime.ts:2494-2566` (cap de refresco manual).
- **GAPS:** No hay `parallel_group_id`: las ejecuciones de una misma pasada no se pueden
  agrupar en el panel. Tampoco `started_at`/`completed_at` a nivel de grupo.
- **TARGET_IMPLEMENTATION:** `agent_runs.parallel_group_id` (el `tick_id` del orquestador, o
  un uuid por lote). Un índice `(parallel_group_id, started_at)` basta para la vista.
- **OBSERVABILITY:** Vista de pasada: N runs, cuántos corrieron y cuántos se saltaron, con el
  motivo (ya está en `ai_diagnostic_gate_log`, sólo falta unirlo).
- **PRIORITY:** P1

## 20 — Progressive disclosure

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Existe en dos formas reales. (a) **Herramientas por agente**: a
  cada run sólo se le declaran las de `agent_versions.allowed_tools`, filtradas además por los
  conectores realmente conectados (`loadConnectedConnectorIds`) — un agente de una organización
  sin Meta no ve las herramientas de Meta. (b) **Contrato de salida recortado**
  (`buildLeanOutputContract`) para no pedir campos que la UI no pinta, con una justificación
  medida en el propio código. El esquema del SQL Gateway se inyecta en el prompt sólo si la
  herramienta está permitida.
- **EVIDENCE:** `apps/api/src/ai-runtime.ts:899-2315` (`buildAgentTools`), `:830`
  (`loadConnectedConnectorIds`), `:2621` (`leanOutputContractFor`);
  `packages/ai/src/index.ts:1568-1601`; `apps/api/src/sql-gateway.ts:398`
  (`SQL_GATEWAY_SCHEMA_DOC`).
- **GAPS:** El descubrimiento es estático (se decide antes del turno), no por niveles durante
  la ejecución. No se registra qué capacidades se descubrieron y cargaron: `allowed_tools`
  está en `agent_versions`, pero las herramientas **efectivamente declaradas** tras el filtrado
  por conector no quedan en `agent_runs`.
- **TARGET_IMPLEMENTATION:** Registrar en el paso `model_call` la lista efectiva de
  herramientas (ya se pasa como `tools_enabled` al payload del paso — sólo hay que subirla al
  run o consultarla desde el panel). No introducir descubrimiento en varios niveles: con
  2 herramientas en el catálogo (`TOOL_CATALOG`) no hay problema de tamaño que resolver.
- **OBSERVABILITY:** Detalle de run: herramientas declaradas vs. usadas.
- **PRIORITY:** P2

## 21 — Test-guided loops

- **STATUS:** IMPLEMENTED
- **CURRENT_IMPLEMENTATION:** La separación que pedía el encargo ya existe y está bien
  trazada: **implementación** (`packages/ai/src`, `apps/api/src`), **especificación de test**
  (`*.test.ts`, 14 en `packages/ai` solo) y **evaluación** (`agent-eval-dataset.ts`,
  `agent-evals.ts`, `evidence-evals.ts`, `release-gate.ts`). El gate es **determinista y sin
  LLM como juez** — está escrito explícitamente en la cabecera de `release-gate.ts`. CI corre
  18 verificaciones antes de los tests, incluidas varias que son guardas de arquitectura
  (`assert-sql-gateway-hardening`, `assert-rls-coverage`, `assert-migrations-idempotent`,
  `assert-safe-test-surface`).
- **EVIDENCE:** `.github/workflows/ci.yml`; `packages/ai/src/release-gate.ts:1-5`;
  `packages/ai/src/agent-eval-dataset.ts`; `apps/api/src/eval-*.ts` (6 evals con proveedor real).
- **GAPS:** La evidencia de test no se enlaza con el run que la generó
  (`agent_version_evaluations` referencia `agent_version_id`, no runs). No hay guarda que
  impida a un agente de codificación relajar un test — hoy depende de la revisión humana.
- **TARGET_IMPLEMENTATION:** Mantener. Añadir en fase 8 una guarda de CI que falle si un PR
  reduce el número de asserts en `packages/ai/src/*.test.ts` sin una etiqueta explícita.
- **OBSERVABILITY:** Sección "Evals": suite, dataset, versión, score, regresiones.
- **PRIORITY:** P2

## 22 — Cuantización

- **STATUS:** PROVIDER_MANAGED
- **CURRENT_IMPLEMENTATION:** Toda la inferencia es contra APIs gestionadas: Anthropic
  (`@anthropic-ai/sdk`), OpenAI (`openai`) y Voyage vía HTTP para embeddings. No hay ningún
  modelo self-hosted, ni dependencia de GPU, ni runtime de inferencia local en el repositorio.
- **EVIDENCE:** `packages/ai/package.json:18-23`; `packages/ai/src/index.ts:2556`
  (`VoyageEmbeddingProvider`, cliente HTTP); ausencia total de `transformers`, `llama.cpp`,
  `vllm`, `onnx` o similares en los `package.json` del monorepo.
- **GAPS:** No hay metadatos de capacidades que dejen constancia de esto. Sin ellos, alguien
  podría pintar un campo "cuantización" vacío y no saber si es "no aplica" o "no medido".
- **TARGET_IMPLEMENTATION:** Un catálogo de capacidades por proveedor/modelo (constante
  versionada, no tabla) que declare explícitamente
  `supports_quantization_control: false` y `quantization: "provider_managed"`. **No se simula
  nada y no se introduce infraestructura de GPU.** Si algún día hubiera un modelo propio, el
  catálogo se extiende con `precision` / `hardware` / `runtime`.
- **OBSERVABILITY:** Sección "Providers / Models" con los cuatro estados que pedía el encargo:
  SUPPORTED / UNSUPPORTED / UNKNOWN / PROVIDER_MANAGED. Este campo es PROVIDER_MANAGED.
- **PRIORITY:** P3

## 23 — RLHF

- **STATUS:** NOT_APPLICABLE_WITH_CURRENT_ARCHITECTURE — y **no se va a llamar RLHF a lo que
  no lo es**.
- **CURRENT_IMPLEMENTATION:** No hay RLHF, ni fine-tuning, ni optimización de preferencias.
  Está decidido y documentado en `docs/decisions/ADR-0017-rag-y-fine-tuning.md`. Lo que **sí**
  existe es el primer eslabón de una infraestructura de feedback humano, con otro nombre:
  `agent_approvals` (`decision` ∈ {approved, rejected}, `decided_by`, `reason`, `decided_at`,
  ligado a `agent_outputs` → `agent_runs`). Es decir: ya se recoge juicio humano estructurado,
  con autor, motivo y trazabilidad hasta la ejecución.
- **EVIDENCE:** `supabase/migrations/20260717200000_db_08a_runtime_agentes.sql:121-133`;
  `apps/api/src/ai-runtime.ts:9349` (`decideAgentOutput`);
  `docs/decisions/ADR-0017-rag-y-fine-tuning.md`.
- **GAPS:** El feedback es binario y sólo a nivel de salida completa: no hay `rating` graduado,
  ni preferencia entre dos salidas, ni feedback a nivel de hallazgo individual. Las decisiones
  de aprobación **no alimentan ningún dataset de evaluación** (van a memoria vía
  `enqueueMemoryIngestion` con `origin: 'human_decision'`, que es otra cosa).
- **TARGET_IMPLEMENTATION:** Nombrar las cosas por lo que son y separarlas, como pedía el
  encargo: **human feedback collection** (existe: `agent_approvals`; se amplía con `rating` y
  `reason_category`) → **evaluation dataset** (existe: `agent-eval-dataset.ts`; se conecta
  para que un rechazo humano pueda promoverse a caso de evaluación) → _fine tuning_ /
  _preference optimization_ / _RLHF_ (**no existen y no se planifican**). En ningún punto del
  panel ni de la documentación aparecerá la palabra RLHF.
- **OBSERVABILITY:** Tasa de aprobación/rechazo por agente y por versión; los rechazos son la
  señal de calidad más honesta que tenemos.
- **PRIORITY:** P2

## 24 — Consolidación de memoria

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** La memoria **ya tiene procedencia**, y bastante rica. Cada
  entrada de `memory_ingestion_queue` lleva `source_type` (`call_summary` | `internal_note` |
  `ai_output_decision`), `source_entity_type`, `source_entity_id`, `source_version`,
  `source_actor_id`, `audience` (`client_visible` | `consultant_only` | `system_only`),
  `origin` (`human_authored` | `human_approved_ai` | `human_decision`) y `authority`
  (`canonical` | `operational` | `contextual`). El pipeline es un outbox asíncrono e
  idempotente por `(organization_id, source_type, source_entity_id, source_version)`: la
  acción humana nunca falla porque Voyage esté caído. `knowledge_documents` tiene `version`,
  `checksum`, `status` (`active`/`archived`), `embedding_model` y `created_by`. El ranking de
  recuperación pondera la autoridad.
- **EVIDENCE:** `apps/api/src/memory-ingestion.ts:1-175`;
  `supabase/migrations/20260722240000_ai_07_memoria_acumulativa.sql`;
  `supabase/migrations/20260718110000_db_11_rag_conocimiento.sql:15-39`;
  `supabase/migrations/20260826153000_ai_04_knowledge_authority_ranking.sql`;
  `supabase/migrations/20260801100000_ai_04_knowledge_hybrid_search.sql`.
- **GAPS:** Faltan `confidence`, `expires_at` y `supersedes` (hay `version` y `archived`, que
  cubren la sustitución a medias pero no dejan rastro de qué sustituyó a qué). La distinción
  `facts` / `preferences` / `decisions` / `inferences` **no existe como tal**; `origin` la
  aproxima (`human_authored` ≈ hecho, `human_approved_ai` ≈ inferencia validada) pero no es lo
  mismo, y una inferencia del modelo aprobada por un humano entra hoy con el mismo peso que un
  hecho declarado. Los accesos no se registran: no hay `memory.read` / `memory.write`.
- **TARGET_IMPLEMENTATION:** Añadir `supersedes` (auto-FK) y `expires_at` a
  `knowledge_documents`, y registrar las lecturas de memoria como paso del run (hoy la
  herramienta `search_knowledge` ya deja una fila en `agent_tool_calls`, así que la lectura
  **es** auditable — falta exponerla como tal en el panel). `confidence` sólo si aparece un
  productor real que sepa calcularla; un campo de confianza inventado es peor que su ausencia.
- **OBSERVABILITY:** Sección "Memory": escrituras, lecturas, sustituciones, caducidades, con
  inspección de procedencia limitada por rol.
- **PRIORITY:** P2

## 25 — Self-improvement loops

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Existe el tramo final del pipeline que pedía el encargo, y es el
  tramo que importa: **versionado + evaluación + gate + activación + rollback**. Los prompts
  son inmutables y versionados; activar una versión es un `update agent_versions set
is_active` en una migración, así que **el rollback es otra migración de una línea**. El gate
  (`evaluateReleaseGate`) es determinista y comprueba score mínimo, tasas máximas de acción no
  autorizada, fuga entre tenants, bypass de aprobación y regresión, más incrementos máximos de
  coste y latencia. El sistema **no puede modificarse a sí mismo**: no hay ninguna ruta por la
  que un agente escriba en `prompt_versions` o `agent_versions`.
- **EVIDENCE:** `packages/ai/src/release-gate.ts:7-37`;
  `supabase/migrations/20260722180000_ai_08_periodo_configurable.sql:34-40` (patrón de
  activación); `packages/ai/src/agent-eval-dataset.ts`; `apps/api/src/agent-eval-runner.ts`.
- **GAPS:** Falta el tramo inicial: no hay agrupación de fallos (`failure cluster`) ni
  generación de propuestas de mejora a partir de la observación de producción. Hoy el bucle lo
  cierra una persona leyendo el panel.
- **TARGET_IMPLEMENTATION:** Una vista SQL que agrupe runs fallidos y salidas rechazadas por
  `(agent_code, agent_version, error_class)` — eso es el "failure cluster", y con los datos
  que ya tenemos sale de una consulta, no de infraestructura nueva. La propuesta de cambio
  sigue siendo humana. **Regla explícita a documentar y a hacer cumplir en CI: ningún proceso
  automático puede modificar el dataset de evaluación reservado.**
- **OBSERVABILITY:** Comparativa entre versiones de agente en la sección "Evals".
- **PRIORITY:** P2

## 26 — Tool poisoning / entrada no confiable

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** La defensa es real y en profundidad, y es de lo mejor del
  repositorio:
  - **Separación instrucción/dato**: todo contexto se envuelve en
    `FUENTE_NO_CONFIABLE:` + `<datos_recuperados>`, y todo resultado de herramienta en
    `<tool_result_no_confiable>`.
  - **Neutralización**: 7 patrones de inyección (ES/EN) sustituidos por
    `[CONTENIDO_INSTRUCCIONAL_BLOQUEADO]`, más eliminación de caracteres de control.
  - **Límites de contenido**: 12 k por bloque, 48 k por contexto.
  - **Allowlist y permisos**: catálogo de herramientas cerrado (`TOOL_CATALOG`, 2 entradas),
    contratos Zod de entrada y salida por herramienta. **`authorizeTool` es codigo muerto en
    produccion: solo lo llaman los tests** (ver GAPS).
  - **SQL Gateway**: validación por **AST** (no regex), allowlist de tablas
    (`GATEWAY_ALLOWED_TABLES`), lista negra de tipos de nodo y de funciones, tenant forzado por
    el backend, timeout de 12 s y tope de 200 filas. Con guarda de CI propia
    (`scripts/assert-sql-gateway-hardening.mjs`).
  - **La seguridad no se delega a otro LLM** en ningún punto.
  - Hay un eval específico de inyección: `apps/api/src/eval-be07-prompt-injection.ts`.
- **EVIDENCE:** `packages/ai/src/untrusted-context.ts`; `packages/ai/src/tool-layer.ts:224,
418, 647-680`; `apps/api/src/sql-gateway.ts:10-95, 147-397`;
  `scripts/assert-sql-gateway-hardening.mjs`; `packages/ai/src/index.ts:1459-1476`.
- **GAPS (P0):**
  1. **Las detecciones no se registran.** `blockedPatterns` se descarta en `index.ts:2015`.
     Un intento de inyección se neutraliza y desaparece sin dejar rastro: no hay tabla de
     eventos de seguridad en todo el esquema, ni evento `prompt_injection_detected`,
     `unauthorized_tool_attempt` ni `permission_denied`.
  2. **`agent_tool_calls.input` / `.output` se persisten en crudo**, sin pasar por
     `redactSensitive`. Es la vía más probable de que un dato personal de un cliente acabe en
     telemetría.
  3. **El Permission Engine es código muerto en producción.** `authorizeTool`
     (`tool-layer.ts:658-735`) implementa seis comprobaciones y está bien probado, pero
     `grep -rn "authorizeTool" apps packages` sólo devuelve tests: **ninguna ruta de
     producción lo llama.** `buildAgentTools` (`apps/api/src/ai-runtime.ts:1019-1041`)
     reimplementa dos de esas comprobaciones a mano (estado `planned`/`disabled` y conector
     conectado) y **omite las otras dos que importan**:
     `permission_escalation_denied` (una tool no puede conceder más permiso del que declara)
     y `approval_required` (una tool que exige revisión humana no puede correr con
     `approval_mode = 'none'`).
     Es decir: la lógica de permisos que se prueba **no es la que corre**, y la que corre es
     más laxa. Hoy no explota porque el catálogo activo son dos tools de solo lectura, pero
     es una trampa armada para la primera tool de escritura.
- **TARGET_IMPLEMENTATION:** (1) Tabla `ai_security_events` (organización, run, tipo,
  severidad info/low/medium/high/critical, detalle **ya redactado**), alimentada por los
  controles que ya existen — no hay que detectar nada nuevo, sólo dejar de tirar lo detectado.
  (2) `sanitizeForTelemetry()` (= `redactSensitive` reutilizado, no una segunda
  implementación) obligatorio antes de escribir en `agent_tool_calls` y
  `agent_context_snapshots`.
- **OBSERVABILITY:** Sección "Security" con severidades y enlace al trace.
- **PRIORITY:** P0

## 27 — Self-healing tests

- **STATUS:** NOT_APPLICABLE_WITH_CURRENT_ARCHITECTURE
- **CURRENT_IMPLEMENTATION:** No hay tests E2E ni de UI con navegador. La suite es de
  contratos y unidades puras (`node --test` / `tsx --test`), determinista y sin
  navegador — precisamente el tipo de test que **no** necesita auto-reparación, porque cuando
  falla es porque algo se rompió de verdad.
- **EVIDENCE:** `.github/workflows/ci.yml` (no hay Playwright/Cypress/Puppeteer);
  `apps/web/package.json` (`test` = tests de contrato de estado del portal).
- **GAPS:** Ninguno que la auto-reparación resuelva.
- **TARGET_IMPLEMENTATION:** **No se implementa auto-reparación de tests.** Cubierto
  conceptualmente por la regla que sí aplica y que se documenta en `AI_SECURITY.md`: ningún
  agente puede eliminar asserts, marcar tests como `skip` ni cambiar valores esperados; todo
  cambio en un test va en un diff revisado por una persona. Si algún día se añaden E2E, se
  reevalúa.
- **OBSERVABILITY:** N/A.
- **PRIORITY:** P3

## 28 — Agent CI/CD

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** Los cambios de prompt, skill (= versión de agente), herramientas
  y políticas **ya pasan por CI**, porque todos viven en el repositorio: los prompts en
  migraciones SQL, las herramientas en `tool-layer.ts`, las políticas en `release-gate.ts`. CI
  ejecuta typecheck, lint, build de las 3 apps, 8 suites de tests, 10 guardas de arquitectura,
  Gitleaks, audit de dependencias, SBOM y Trivy sobre las imágenes. Hay un workflow separado de
  evals que persiste evidencia en `agent_version_evaluations`.
- **EVIDENCE:** `.github/workflows/ci.yml` (líneas 33-72: las guardas; 118-190: los tests);
  `.github/workflows/agent-evals.yml`; `supabase/migrations/20260826140000_ai_26_agent_eval_evidence.sql`.
- **GAPS:** No hay `deployment_version` en ninguna parte: `packages/config` no expone
  `GIT_SHA` ni `APP_VERSION` (sólo `APP_ENV`), así que **un comportamiento de producción no se
  puede atar al commit exacto que lo produjo** — el requisito 19 del objetivo final no se
  cumple hoy. Las evals no son gate de merge (workflow manual, `schedule` comentado). No hay
  relación explícita entre un despliegue y las versiones de agente activas en ese momento.
- **TARGET_IMPLEMENTATION:** (a) `GIT_SHA` como variable de entorno inyectada en el build de
  las imágenes y expuesta por `packages/config`; (b) `agent_runs.deployment_version` con ese
  valor. Dos líneas de Dockerfile y una columna. (c) Decidir si las evals se convierten en
  gate de merge o siguen siendo manuales — hoy es ambiguo y conviene que no lo sea.
- **OBSERVABILITY:** Filtro por `deployment_version` en la tabla de traces. Es lo que permite
  responder "¿esto empezó con el despliegue del martes?".
- **PRIORITY:** P1

## 29 — Test-time compute / inference budget

- **STATUS:** PARTIAL
- **CURRENT_IMPLEMENTATION:** La abstracción de presupuesto de inferencia existe y es la que
  el encargo describe, sin el nombre: `max_tokens` (16.000), `MAX_MODEL_CALLS_PER_TURN` (16),
  `AgentBudget { maxCostUsd, maxToolCalls }` resuelto por agente y por plan
  (`resolveAgentBudget`, `resolvePlanBudget`), timeout de 45 s y política de reintentos
  (`DEFAULT_AGENT_RESILIENCE_POLICY`). Hay enrutado por agente a modelo/proveedor
  (`AI_MODEL_ROUTING_JSON` → `resolveProviderModel`), que es exactamente el mecanismo para
  comparar estrategias. El aviso de presupuesto agotado se le comunica al modelo en la última
  ronda en vez de cortar la ejecución en seco (`TOOL_BUDGET_NOTICE`) — una decisión de diseño
  bien razonada en el propio código.
- **EVIDENCE:** `packages/ai/src/index.ts:1615-1736`, `:2058`, `:1623`;
  `apps/api/src/ai-runtime.ts:269-370`; `packages/ai/src/resilience.ts:14-20`.
- **GAPS:** `reasoning_effort` no se usa (ningún modelo configurado hoy lo soporta — no se
  debe inventar el parámetro). La configuración **efectivamente aplicada** no se guarda en el
  run: `resolveAgentBudget` la calcula en memoria desde env vars, así que no se puede comparar
  calidad/coste/latencia por estrategia a posteriori, sólo por agente.
- **TARGET_IMPLEMENTATION:** Persistir en `agent_runs` la configuración real usada
  (`max_tokens`, `budget_max_cost_usd`, `budget_max_tool_calls`, `model_calls`,
  `tool_call_count`). Con eso, la comparación calidad/coste/latencia por estrategia sale de
  una consulta. **No añadir parámetros que el proveedor no soporte**; el catálogo de
  capacidades (ficha 22) dirá cuáles existen por modelo.
- **OBSERVABILITY:** Comparativa por estrategia en la sección "Agents".
- **PRIORITY:** P2

## 30 — KV Cache

- **STATUS:** PROVIDER_MANAGED
- **CURRENT_IMPLEMENTATION:** Ninguna, y es lo correcto: la inferencia corre en la
  infraestructura de Anthropic y OpenAI. **No controlamos su KV cache y no vamos a afirmar lo
  contrario.**
- **EVIDENCE:** las mismas que la ficha 22 (todo es API gestionada, no hay runtime local).
- **GAPS:** Riesgo de confusión con el prompt caching (ficha 12), que sí medimos parcialmente.
- **TARGET_IMPLEMENTATION:** En el catálogo de capacidades: `kv_cache_control: false`,
  `kv_cache: "provider_managed"`. En el panel y en la documentación, **KV cache y prompt
  caching son dos filas distintas** y así se etiquetan: del prompt caching reportamos lo que
  el proveedor nos dice; del KV cache reportamos que no es nuestro.
- **OBSERVABILITY:** Fila explícita PROVIDER_MANAGED en "Providers / Models". No aparece en
  ninguna métrica de coste ni de ahorro.
- **PRIORITY:** P3

---

## Anexo A — Inventario de tablas relacionadas con IA (existentes)

Antes de proponer una sola tabla nueva, esto es lo que ya hay:

| Tabla                                                      | Rol en el modelo objetivo                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `agent_definitions`                                        | catálogo de agentes                                               |
| `agent_versions`                                           | versión desplegable: modelo + prompt + tools + modo de aprobación |
| `prompt_versions`                                          | prompt registry inmutable (checksum SHA-256)                      |
| `agent_runs`                                               | **trace + run** (una ejecución = una traza, hoy)                  |
| `agent_run_steps`                                          | **spans** (`position`, `step_type`, `duration_ms`, `payload`)     |
| `agent_tool_calls`                                         | llamadas a herramientas con entrada/salida/error/duración         |
| `agent_context_snapshots`                                  | contexto enviado, por nivel `C0..C4`                              |
| `agent_query_runs`                                         | auditoría del SQL Gateway (SQL, tablas, filas, rechazo)           |
| `agent_outputs`                                            | salida validada + estado de aprobación                            |
| `agent_approvals`                                          | decisión humana (semilla de feedback humano)                      |
| `agent_version_evaluations` / `agent_version_eval_results` | evidencia de evals                                                |
| `ai_diagnostic_gate_log`                                   | decisiones del orquestador por pasada (`tick_id`)                 |
| `ai_conversations` / `ai_messages`                         | eje conversación                                                  |
| `knowledge_documents` / `knowledge_chunks`                 | RAG con procedencia y autoridad                                   |
| `memory_ingestion_queue`                                   | outbox idempotente de memoria                                     |
| `audit_logs`                                               | auditoría general (con `request_id`)                              |

**Conclusión del inventario:** el modelo TRACE / SPAN / EVENT ya está cubierto en sus dos
primeros niveles por `agent_runs` y `agent_run_steps`. **Lo único que falta de verdad es la
capa EVENT** (append-only, con nombre estable) y las columnas de correlación. No hacen falta
las 15 tablas que enumeraba el encargo; hacen falta **una tabla y unas cuantas columnas**.

## Anexo B — Verificaciones ejecutadas para este audit

| Comprobación                          | Comando                                                                                                 | Resultado                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Llamadas directas a SDKs de IA        | `grep -rn` de los `import ... from` de `openai`, `@anthropic-ai` y `@ai-sdk` en `apps packages scripts` | 2 aciertos, ambos en `packages/ai/src/index.ts:7-8` (+1 en un test) |
| MCP en el producto                    | `grep -rn "modelcontextprotocol\|MCP" apps packages`                                                    | 0 aciertos                                                          |
| Eventos de seguridad                  | `grep -rniE "security_event\|prompt_injection\|injection_detected" apps packages supabase`              | 0 aciertos                                                          |
| Feedback humano graduado              | `grep -rniE "thumbs\|rating" supabase/migrations`                                                       | 0 aciertos relevantes                                               |
| `reasoning` / `cache_creation` tokens | `grep -n "reasoning\|cache_creation" packages/ai/src/index.ts`                                          | 0 aciertos                                                          |
| Versión de despliegue                 | `grep -rn "GIT_SHA\|COMMIT_SHA\|APP_VERSION" packages/config deploy .github`                            | 0 aciertos                                                          |
| Tablas creadas por migración          | `grep -rhoiE "create table (if not exists )?[a-z_]+\.[a-z_]+" supabase/migrations`                      | 137 tablas, 3 esquemas                                              |
| Tamaño del runtime                    | `wc -l apps/api/src/ai-runtime.ts`                                                                      | 9.855 líneas                                                        |
