# AI-00A — Fundación del Tool Layer

**Estado:** implemented_partial  
**Tipo:** transversal / plataforma  
**Prioridad:** crítica  
**Dependencias:** contratos de conectores Meta, Klaviyo, Instagram y Shopify; AI-00; DB-09; DB-10

**Correccion 2026-08-02:** además de SQL Gateway, knowledge, data coverage,
budget y schema, el runtime ya expone seis tools de lectura de contexto de
dominio: perfil de organización, plan estratégico, tareas abiertas, alertas
abiertas, historial de llamadas y configuración financiera. Todas fijan el
tenant en el executor, limitan resultados y devuelven provenance; no habilitan
escrituras.

## Objetivo

Definir la capa de herramientas que utilizarán los agentes de EcomScaling antes de activar la infraestructura de IA. Esta capa debe hacer que el producto sea premium por diseño: segura, tipada, auditable, medible, recuperable y preparada para funcionar con datos reales cuando se conecten Meta Ads, Klaviyo e Instagram.

El LLM no debe conocer ni decidir estas garantías. Las aplica el runtime.

## Orden de implementación

```text
Contratos de conectores y estados honestos
        ↓
Tool layer tipado, autorizado, presupuestado y auditable
        ↓
Agentes especialistas y generador de email Klaviyo
        ↓
Acciones de escritura con dry-run, aprobación y rollback
```

## Contrato obligatorio de cada tool

Cada tool registrada debe declarar, como mínimo:

```ts
type ToolPermission = "read" | "propose" | "write" | "admin";

type ToolDefinition = {
  name: string;
  version: string;
  permission: ToolPermission;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  estimatedCost: {
    tokens: number;
    latencyMs: number;
    euros: number;
  };
  requiresApproval: boolean;
  requiresIdempotencyKey: boolean;
  execute: (input: unknown, context: ToolContext) => Promise<unknown>;
};
```

Reglas no negociables:

- Input y output validados con Zod, versionados y sin `any` visible para el modelo.
- El permiso se comprueba en runtime, junto con organización, usuario, rol, conexión y scope.
- Las tools de escritura requieren `idempotency_key`, `dry_run` y registro de auditoría.
- Las propuestas no ejecutan cambios: generan diff, evidencia, coste estimado y solicitud de aprobación.
- Toda respuesta paginable usa `{ rows, truncated, next_cursor, total_count }`.
- Cada fila de datos incluye `{ source, as_of, freshness_seconds }` cuando aplique.
- Los errores tienen `{ error, why, how_to_fix, retry_after }`; nunca se expone un 500 opaco al agente.
- El runtime impone timeout, límites de filas, límites de coste y degradación controlada.

## Estados de ejecución

Una tool puede devolver `success`, `partial`, `needs_approval`, `not_connected`, `stale`, `degraded` o `failed`. `not_connected` no significa cero datos: significa que el conector no está disponible para esa organización.

Las acciones reales siguen siempre este flujo:

```text
validar permisos → comprobar conexión y freshness → dry-run → diff visual/auditable
→ aprobación humana si corresponde → ejecutar con idempotency_key → guardar rollback token
→ registrar outcome
```

## Catálogo inicial de tools

### Lectura de datos

| Tool | Permiso | Estado inicial |
|---|---|---|
| `sql_query` | `read` | `implemented_partial` vía SQL Gateway |
| `get_metric` | `read` | `planned` |
| `compare_periods` | `read` | `planned` |
| `get_timeseries` | `read` | `planned` |
| `detect_anomaly` | `read` | `planned` |
| `get_cohort` | `read` | `planned` |
| `describe_schema` | `read` | `implemented_partial` |
| `sample_rows` | `read` | `planned` |
| `data_coverage` | `read` | `implemented_partial` |

Todas deben respetar aislamiento por organización, límites de consulta, redacción de PII y provenance por fuente. `data_coverage` será el semáforo para evitar que un agente invente conclusiones cuando falten Meta Ads o Klaviyo.

### Contexto del cliente

| Tool | Permiso | Estado inicial |
|---|---|---|
| `get_organization_profile` | `read` | `implemented_partial` |
| `get_strategic_plan` | `read` | `implemented_partial` |
| `get_current_milestone` | `read` | `implemented_partial` |
| `list_open_tasks` | `read` | `implemented_partial` |
| `list_open_alerts` | `read` | `implemented_partial` |
| `get_task_history` | `read` | `implemented_partial` |
| `get_call_history` | `read` | `implemented_partial` |
| `get_financial_settings` | `read` | `implemented_partial` |

### Knowledge y memoria

| Tool | Permiso | Estado inicial |
|---|---|---|
| `knowledge_search` | `read` | `implemented_partial` vía búsqueda existente |
| `memory_recall` | `read` | `planned` |
| `memory_write` | `write` | `planned`, aprobación según tipo de memoria |
| `get_playbook` | `read` | `planned` |
| `cite_source` | `read` | `planned` |

La memoria debe separar hechos, hipótesis, decisiones y preferencias. `cite_source` será obligatorio para propuestas basadas en datos o documentación.

### Escrituras propuestas y controladas

| Tool | Permiso | Estado inicial |
|---|---|---|
| `propose_task` | `propose` | `planned` |
| `propose_milestone` | `propose` | `planned` |
| `propose_phase` | `propose` | `planned` |
| `propose_alert_rule` | `propose` | `planned` |
| `propose_budget_change` | `propose` | `planned` |
| `propose_content` | `propose` | `planned` |
| `propose_experiment` | `propose` | `planned` |
| `dry_run_write` | `propose` | `implemented_partial` |

`propose_content` es el límite entre generación y publicación: puede crear un borrador de email Klaviyo, asunto, preheader, bloques, variantes, tokens de personalización y compliance notes, pero no lo envía ni publica sin aprobación.

### Acciones de conectores

| Tool | Permiso | Requisitos |
|---|---|---|
| `shopify_update_product` | `write` | conexión, dry-run, idempotencia, rollback, auditoría |
| `shopify_update_inventory` | `write` | conexión, dry-run, idempotencia, rollback, auditoría |
| `meta_pause_ad` | `write` | conexión Meta, scope válido, aprobación y rollback |
| `meta_adjust_budget` | `write` | límites financieros, aprobación y rollback |
| `meta_duplicate_adset` | `write` | dry-run completo y aprobación |
| `klaviyo_create_flow` | `write` | conexión Klaviyo, preview, aprobación y rollback |
| `klaviyo_send_campaign` | `write` | nunca automático por defecto; aprobación explícita |
| `instagram_schedule_post` | `write` | cuenta conectada, preview, aprobación y rollback |

Estas tools permanecen deshabilitadas o en `not_connected` hasta que el conector, permisos, freshness y scopes estén verificados. No se simula éxito con credenciales ausentes.

### Control del agente

| Tool | Permiso | Propósito |
|---|---|---|
| `get_budget_status` | `read` | implementación parcial: presupuesto diario de la organización |
| `escalate_to_human` | `propose` | escalar incertidumbre, riesgo o bloqueo |
| `request_missing_data` | `propose` | pedir un conector, permiso o dato faltante |
| `handoff_to_agent` | `propose` | transferir contexto entre agentes |
| `report_confidence` | `read` | confianza calibrada y razones |
| `flag_data_quality_issue` | `propose` | registrar cobertura, freshness o inconsistencia |

### Observabilidad y aprendizaje

| Tool | Permiso | Propósito |
|---|---|---|
| `log_reasoning_step` | `write` | guardar resumen operativo, no cadena de pensamiento privada |
| `get_similar_past_decisions` | `read` | recuperar decisiones comparables y sus outcomes |
| `record_outcome` | `write` | guardar resultado, métricas y feedback |

## Infraestructura IA prevista

La infraestructura de IA se construirá sobre el runtime existente y sus contratos de output. El ToolRegistry será la única fuente de verdad para descubrimiento dinámico, schemas, permisos, presupuestos y capability flags. No se creará un segundo runtime paralelo.

Debe incluir:

- presupuestos por organización, agente, turno y tool;
- read-only por defecto y escalado explícito a `propose`/`write`;
- guardas contra prompt injection en datos externos, documentos y contenido de email;
- fixtures dorados y replay determinista de tool calls;
- timeout, retry seguro, circuit breaker y degradación por conector;
- evidence bundle obligatorio para propuestas;
- freshness semaphores y data coverage antes de generar conclusiones;
- visual diff y preview antes de aprobar contenido o cambios remotos;
- auditoría con actor, organización, herramienta, versión, input redactado, output, coste, decisión y outcome;
- persistencia de generaciones Klaviyo: prompt/version, modelo, draft, HTML sanitizado, bloques, variantes, fuentes, aprobación y publicación.

## Criterios de aceptación

### Evidencia actual (2026-08-02)

- `packages/ai/src/tool-layer.ts` contiene el registro, schemas, permisos, estados y guardas runtime iniciales.
- Las tools activas tienen contratos Zod de input/output asociados en `TOOL_CONTRACTS`; el API valida input antes de ejecutar `sql_select` y `search_knowledge`.
- `sql_select` valida también su output antes de entregarlo al modelo; una respuesta incompatible se transforma en error corregible.
- Las lecturas de SQL y knowledge search incluyen provenance (`source`, `as_of`, `freshness_seconds`); freshness `0` solo representa lectura directa en ese instante, no frescura histórica del dataset.
- `packages/ai/src/index.test.ts` cubre bloqueo de tools futuras, `allowed_tools`, aprobación y contrato Klaviyo.
- `apps/api/src/ai-runtime.ts` consulta el registro antes de exponer `sql_select` y `search_knowledge` al modelo.
- `data_coverage` ya devuelve cobertura por proveedor, estado de conexión, última sincronización y provenance; si falla el esquema, devuelve degradación explícita.
- `get_budget_status` reutiliza la misma consulta de presupuesto diario que bloquea el runtime y devuelve coste acumulado, límite, saldo y provenance.
- `describe_schema` reutiliza `SQL_GATEWAY_SCHEMA_DOC`, valida sus filtros y evita que el agente adivine tablas o columnas.
- `data_coverage`, `get_budget_status` y `describe_schema` validan también sus outputs antes de devolverse al modelo.
- `get_current_milestone` reutiliza `findCurrentMilestoneId` y solo devuelve el hito pendiente del plan activo de la organización.
- `get_task_history` limita la lectura a 100 tareas recientes de la organización activa y no incluye secretos ni transcripciones.
- Las lecturas de listas `list_open_tasks`, `list_open_alerts`, `get_task_history` y `get_call_history` aceptan `limit`/`cursor` y devuelven `rows`, `truncated`, `next_cursor`, `total_count` y `provenance`; el cursor actual usa offsets explícitos para evitar cortes silenciosos mientras se completa la paginación por dataset.
- `dry_run_write` construye un diff auditable sin escribir, devuelve `changed=false`, `approval_required=true` y no genera rollback token hasta que exista una acción real aprobada.
- `createToolReplayFixture` y `createReplayToolExecutor` implementan `tool-replay-v1`: ordenan respuestas auditadas, comparan inputs canónicamente y fallan ante secuencias incompletas o divergentes; `getAgentRunTrace` expone el fixture para depuración sin llamar al proveedor.
- `request_missing_data`, `escalate_to_human`, `flag_data_quality_issue` y `report_confidence` ya tienen contratos Zod, provenance y executors no mutantes; AI-14 los añade al `allowed_tools` de la versión activa de A11 sin activar ningún conector.
- El typecheck de `packages/ai` y `apps/api` pasa; la activación de conectores y los executors de escritura siguen pendientes.

- [x] Existe un registro central de tools versionadas con schemas Zod y permisos runtime para el catálogo inicial.
- [x] El registro bloquea tools planificadas sin executor operativo y respeta `allowed_tools`/`approval_mode`.
- [x] Las tools de lectura iniciales y `dry_run_write` tienen executor parcial y validación de input/output.
- [ ] Las respuestas paginables, provenance y errores corregibles están normalizados.
- [ ] Ninguna escritura puede ejecutarse sin idempotencia, auditoría y dry-run.
- [ ] Una ausencia de Meta/Klaviyo produce estado honesto, cobertura visible y una acción `request_missing_data`.
- [ ] Klaviyo puede generar borradores de emails y plantillas con IA, pero publicar/enviar requiere aprobación.
- [ ] Hay replay determinista, fixtures dorados, límites de coste y degradación por timeout.
- [ ] El catálogo queda conectado con AI-00, AI-11 y AI-12 antes de activar acciones de producción.
