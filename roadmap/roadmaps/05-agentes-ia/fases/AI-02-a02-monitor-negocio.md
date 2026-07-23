# AI-02 - A02 Monitor y diagnostico del negocio

## Estado

- **Estado real:** `shadow_pilot`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-00, AI-03
- **Bloqueador:** ninguno
- **Evidencia:** `runMonitorAgent`/`getMonitorDiagnostic` en `apps/api/src/ai-runtime.ts`, endpoints
  `GET /ai/monitor` + `POST /ai/monitor-run`.
- **Lo que ya funciona**: primer run real detecto problemas genuinos (margen 100% ficticio por falta de
  COGS, descuentos ~88% de pedidos con cupon, 16 productos sin stock sin reposicion, `first_orders=0` como
  posible fallo de tracking). Generacion automatica al entrar al dashboard con cache de 24h
  (`from_cache: true`), sin boton "aprobar" para poder verlo — ver un analisis de solo lectura es
  automatico, la aprobacion humana solo materializa `proposed_writes` como tareas (principio FE-08 "la IA
  compone, el usuario decide"). `agent_runs.store_id` ya evita mezclar tiendas de una organizacion
  (AI-05).
- **Presupuesto real aplicado 2026-07-20 (R-011)**: `runMonitorAgent` ahora corta con `budget_exceeded` si
  el run supera `maxCostUsd: 1`/`maxToolCalls: 10` (ver AI-00) — red de seguridad para cualquier agente,
  aunque como se explica abajo A02 ya no puede hacer tool calls en absoluto.
- **Correccion importante sobre una afirmacion repetida en auditorias anteriores de esta misma sesion**:
  se dijo varias veces que "A02 sigue con `sql_select` libre, ~7 consultas/~73s/~0,17 USD por run". Eso era
  cierto solo para la version `v1` del prompt (la que corrio el "primer run real" del 2026-07-19, antes de
  que `db_08b` le anadiera `sql_select`/`search_knowledge` via un `UPDATE` puntual). **Verificado ahora
  contra las migraciones reales**: `v2`, `v3` y `v4` (las tres posteriores, `v4` es la activa hoy) se
  insertaron con `allowed_tools = '[]'::jsonb` explicito — a diferencia de A04/A06, que sí llevan
  `sql_select`/`search_knowledge` en cada version. `buildAgentTools` (`apps/api/src/ai-runtime.ts`)
  confirma que con `allowed_tools=[]` no se anade ninguna tool ni el esquema SQL al prompt. **A02 ya
  corre en modo evidence-pack puro desde `v2` — sin tool calls posibles, solo el contexto precalculado.**
  No quedo documentado en ningun sitio que esto cambiara (no hay comentario en la migracion `v2` que lo
  explique), asi que probablemente fue un efecto secundario de copiar la plantilla de insert sin llevar el
  array de tools, no una decision consciente — pero el resultado practico es el correcto.
- **Enriquecido el evidence pack 2026-07-20** (dado que ya no hay tool calls, el contexto precalculado es
  la unica fuente): `runMonitorAgent` ahora tambien incluye `discount_pct_sobre_ventas_brutas` (derivado de
  `discounts`/`gross_sales`, ya presentes en `shopify_sales_summary`) y el top 5 de productos con mayor
  riesgo de quiebre via `shopify_stock_risk_products` (la misma funcion SQL que ya usa A06, reutilizada en
  vez de duplicar logica) en lugar de solo el conteo agregado de `shopify_stock_summary`.
- **Lo que probablemente sigue faltando del contexto** (no verificado con un run real todavia): un
  indicador de posible fallo de tracking (el "`first_orders=0`" que el run de v1 detecto via SQL libre no
  tiene hoy un campo determinista equivalente) — no se ha creado una funcion SQL nueva para esto en esta
  ronda; queda pendiente si un run real futuro muestra que hace falta.
- **"Generar al entrar a la pagina" no es lo mismo que monitor proactivo**: hoy no hay trigger tras sync
  completado, cambio de coste, alerta critica o cron diario — solo cache de 24h + regeneracion al entrar.
  La clave de cache tampoco incluye `data_snapshot_version`/`financial_config_version`, solo tiempo — un
  sync que termina hace 5 minutos no invalida un diagnostico de hace 2 horas.
- **Sin ciclo de vida del hallazgo** (`proposed -> accepted -> dismissed -> converted_to_task ->
  outcome_measured`) ni motivo de descarte — no hay forma de medir si un hallazgo fue util.
- **Severidad decidida por el modelo**, no por una formula determinista (magnitud economica, calidad del
  dato, urgencia) que la IA solo explique.
- **Siguiente accion**: ya no es "migrar a evidence pack" (hecho, ver arriba) — ahora es (1) validar con un
  run real que el contexto enriquecido sigue detectando lo que antes detectaba via SQL libre (sobre todo el
  indicio de fallo de tracking), y (2) anadir triggers por evento (tras sync, alerta critica, cron) en vez
  de solo "al entrar a la pagina".

## Objetivo

Detectar riesgos y oportunidades a partir de metricas, alertas y contexto operativo.

## Entregables

- Shadow mode inicial.
- Priorizacion de hallazgos.
- Propuestas de tareas segun politica de severidad.
- Explicacion con fuentes y periodo.

## Criterios de cierre

- No sustituye reglas deterministas.
- No genera spam de tareas.
- Cita datos usados y limitaciones.
