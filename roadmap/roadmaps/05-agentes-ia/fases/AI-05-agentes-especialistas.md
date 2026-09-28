# AI-05 - Agentes especialistas

## Estado

- **Estado real:** `in_progress` (global; cada agente tiene su propio estado real, ver tabla abajo — un
  solo estado para todo AI-05 oculta que A04/A06/A08/A09 y A03/A05/A07 estan en situaciones muy distintas)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-00, AI-02
- **Evidencia:** `apps/api/src/ai-runtime.ts`, `getCachedDiagnostic`.

| Agente | Estado real | Nota |
| --- | --- | --- |
| A04 (tareas) | `shadow_pilot` | Cruza backlog con alertas/ventas; se solapa conceptualmente con A02 (ver gap abajo). |
| A06 (stock) | `shadow_pilot` | Rediseñado tras incidente real (ver abajo); el cruce critico ya llega precalculado, aunque `sql_select` sigue disponible como complemento (no retirado del `allowed_tools`). |
| A08 (conocimiento) | `shadow_pilot` | Validado en vivo con catalogo vacio; razono sin alucinar. |
| A09 (copiloto) | `in_progress` | Sin cambios en esta revision. |
| A03 (Meta Ads) | `blocked` | Bloqueado por credenciales de Meta (mismo bloqueador que INT-02/BE-04). |
| A05 (estrategia campañas) | `blocked` | Depende de A03. |
| A07 (Instagram) | `blocked` | Depende de INT-05/Meta. |
| A00 (orquestador) | `deferred` | Decision explicita, ver abajo — no es "pendiente", es "decidido no hacerlo todavia". |

Los tres agentes automaticos (A02/A04/A06) respetan la tienda activa del selector del header
(`agent_runs.store_id`) tras detectar que mezclaban todas las tiendas de la organizacion sin avisarlo;
prompts reescritos (A02 v2, A04 v2, A06 v3) para ser concisos y prohibir citar nombres de columna crudos.

**A06 — incidente real documentado**: la v1 dejaba que el modelo cruzara stock/venta el solo via
`sql_select`, y se colgo en el limite de 8 tool calls con una respuesta final vacia (~500s). Fix: el cruce
llega ya calculado en el contexto (evidence pack), no vuelto a calcular por el modelo — este es el patron
que AI-02 todavia no adopto (ver AI-02).

**Riesgo de proliferacion real, no solo teorico**: A02 (detecta hallazgos) y A04 (prioriza/genera tareas)
no tienen una frontera de responsabilidad escrita en ningun documento — ambos pueden terminar proponiendo
tareas similares desde angulos distintos (comparten alertas activas y ventas del periodo como contexto,
`ai-runtime.ts:runMonitorAgent`/`runTaskPlannerAgent`). **Mitigado en la materializacion 2026-07-27**
(`decideAgentOutput`, `apps/api/src/ai-runtime.ts`): antes de insertar una tarea propuesta se comprueba
contra las tareas abiertas (`pending`/`in_progress`) de la organizacion por titulo exacto normalizado
(trim + minusculas) — mismo patron que ya usaba A01 (`calls.ts`) para resumenes de llamada. Si A02 y A04
proponen literalmente el mismo titulo, solo la primera aprobada se materializa. Test real:
`ai-orchestration-task-dedup.test.ts` (Supabase remoto real, 1/1 pasa). **Frontera semantica cerrada 2026-07-27** (`supabase/migrations/20260727100000_ai_12_a02_no_task_writes.sql`,
aplicada y verificada en el proyecto remoto real, `agent_versions` v4 activa): el prompt de A02 ahora
instruye explicitamente `proposed_writes: []` siempre -- diagnostica y explica que se deberia hacer en
`recommendations`, pero ya no crea tareas el mismo. A04 (prompt v3, sin cambios) sigue siendo el unico
agente de diagnostico que convierte hallazgos/backlog en tareas nuevas. Nota operativa: la migracion se
aplico manualmente contra la base antes de que quedara registrada en `supabase_migrations.schema_migrations`
-- reconciliada sin re-ejecutar el DML, mismo patron que RB-005.

**A00 (orquestador) — decision: diferir.** Con 5 agentes automaticos (A02/A04/A06/A08/A09) el valor de un
orquestador que decida cual ejecutar es marginal: cada uno ya se autoactiva por pagina (dashboard/
conocimiento) con su propia cache de 24h, sin solaparse ni competir por prioridad. Un A00 real (que decida
que agente correr, en que orden, o consolide sus salidas) aporta valor cuando exista (a) disparo por
cron/webhook para varios agentes a la vez sin que un humano abra cada pagina, o (b) suficientes agentes
como para que leer 4-5 tarjetas por separado sea mas lento que un resumen consolidado. Ninguno de los dos
se cumple hoy (todo trigger es manual via pagina visitada). Revisar cuando se desbloqueen A03/A05/A07
(Meta) o se introduzca un cron real en `apps/worker` para agentes IA.

## Orquestacion global por estado compartido (2026-09-26)

Pedido de Rafa: que los agentes funcionen en armonia aunque cada uno se active desde su pagina (A04
no debe proponer una tarea ya completada; el de mailing debe saber que ayer se envio una campana).

Diagnostico: la orquestacion global **ya existe** — `runDiagnosticOrchestratorTick` corre por cron
todos los `ORCHESTRATED_DIAGNOSTIC_AGENT_CODES` (A02/A04/A06, A12-A14, A17/A18, A20-A25...) para todas
las orgs, filtrado por `organization_activity_digest` y presupuestos. Lo que faltaba era **estado
compartido**: cada agente solo veia su propio historial (`loadPriorProposalHistory`). Decision: no un
A00 que reparta trabajo, sino un feed que todos leen.

Hecho (`20261113100000_ai_feed_actividad_compartida.sql`):

- `activity_events`: una tabla para todos los modulos (`module` cerrado + `event_type` `modulo.verbo`),
  escrita solo por triggers, idempotente por `(source_table, source_id, event_type)`.
  Emisores: tareas completadas/descartadas/canceladas, campanas Klaviyo enviadas/programadas/canceladas,
  borradores A11 aprobados/rechazados, propuestas de agentes aprobadas/rechazadas, `context_change_events`.
- `recent_activity_feed()`: 30 dias, tope por modulo, tienda activa + eventos de toda la org.
  Inyectado a todos los agentes de `runGenericDiagnosticAgent` (`loadSharedActivityBlocks`).
- `organization_activity_digest` incluye el feed: cualquier evento invalida la cache de todos los agentes.

Mapa pendiente, en orden:

1. [ ] Aplicar con `npm run db:push` y correr `npm run test:remote -w @e-nora/api`
       (`ai-activity-feed.test.ts`). Validado en Postgres local (PGlite), no en Supabase.
2. [ ] Llevar el feed a A09 (chat) y A11 (generador de borradores): no pasan por
       `runGenericDiagnosticAgent`.
3. [ ] Orden del tick: hoy los candidatos se ordenan por prioridad de org y, dentro, por el orden de la
       lista — A04 corre antes que A12/A20+. Ejecutar primero analistas (A02, A12, A13, A20-A25) y despues
       planificadores (A04, A17, A18, A27) para que planifiquen sobre diagnosticos frescos.
4. [ ] Nuevos emisores cuando existan los datos: Meta (cambios de campana/presupuesto), stock
       (reposiciones), llamadas (resumen aprobado). Cada uno = un valor en el check de `module` + un trigger.
5. [ ] Si `activity_events` pasa de decenas de millones de filas: particionar por mes y purgar > 180 dias.

Gaps de AI-12 relacionados:

- Presupuesto de tool calls por agente: **ya existe** via `AI_MODEL_ROUTING_JSON` (AI-09); falta solo
  configurarlo por agente en produccion, no codigo.
- Shadow/live con proveedores reales: bloqueado por claves Anthropic/OpenAI en produccion.
- APM / metricas agregadas: decision de proveedor (Q-014).
- `ai-runtime.ts` (~11.5k lineas): partir por dominio (runner comun / diagnostico / marketing / chat)
  cuando se toque el siguiente bloque grande; refactor sin dependencias externas.

## Objetivo

Activar agentes por dominio cuando existan datos fiables.

## Agentes

- A03 Analista de Meta Ads y creatividades.
- A04 Generador y priorizador de tareas.
- A05 Estratega de campanas.
- A06 Planificador inteligente de stock.
- A07 Analista de Instagram.
- A08 Gestor de conocimiento.
- A09 Copiloto del consultor.
- A00 Orquestador / Consultor EcomScaling IA.

## Criterios de cierre

- Cada agente tiene ficha, prompt, tools, output schema, evals y limites.
- Acciones externas permanecen como propuesta hasta nueva aprobacion ejecutiva.
