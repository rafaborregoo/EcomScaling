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
- **Gap real que sigue sin resolverse, confirmado en codigo**: `a02_monitor_negocio` sigue con
  `allowed_tools = ["sql_select", "search_knowledge"]` (migracion `20260718100000_db_08b_ai_sql_gateway`)
  — el modelo sigue explorando el negocio el solo con SQL libre (el run real uso 7 consultas, ~73s, ~0,17
  USD), no recibe un evidence pack precalculado. Esto es exactamente lo que causo el incidente de A06 (se
  colgo en el limite de tool calls con salida vacia) antes de que A06 se rediseñara para recibir el cruce
  ya calculado — A02 todavia no tiene ese rediseño aunque el patron ya existe en el propio codebase para
  copiarlo.
- **"Generar al entrar a la pagina" no es lo mismo que monitor proactivo**: hoy no hay trigger tras sync
  completado, cambio de coste, alerta critica o cron diario — solo cache de 24h + regeneracion al entrar.
  La clave de cache tampoco incluye `data_snapshot_version`/`financial_config_version`, solo tiempo — un
  sync que termina hace 5 minutos no invalida un diagnostico de hace 2 horas.
- **Sin ciclo de vida del hallazgo** (`proposed -> accepted -> dismissed -> converted_to_task ->
  outcome_measured`) ni motivo de descarte — no hay forma de medir si un hallazgo fue util.
- **Severidad decidida por el modelo**, no por una formula determinista (magnitud economica, calidad del
  dato, urgencia) que la IA solo explique.
- **Siguiente accion**: migrar A02 al mismo patron que ya se aplico a A06 (evidence pack precalculado en
  vez de `sql_select` libre) antes de anadir triggers por evento — es el cambio de mayor impacto y ya hay
  precedente de codigo para copiarlo.

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
