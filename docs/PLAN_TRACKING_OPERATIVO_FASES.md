# Tracking operativo de la guía CSV

## Principio

Cada fase debe responder a cinco preguntas: qué dato necesitamos, de dónde sale, qué decisión permite tomar, qué acción se ejecuta y qué evidencia confirma que se ejecutó. Un dato vacío significa “no disponible”, nunca cero.

## Dónde vive el tracking

El tracking vive dentro de **Planificación** como la capa de ejecución y evaluación. No se crea un módulo separado: Dashboard explica la situación, Planificación define y sigue las acciones, Tareas/Mi Camino ejecutan el trabajo y los snapshots registran la realidad. Todo se filtra por el mismo cliente, tienda y periodo.

## Flujo completo

| Fase | Objetivo | Datos de entrada | Acción | Evidencia de salida |
|---|---|---|---|---|
| 1. Medición | Saber cómo está la tienda | Ventas, pedidos, AOV, costes, margen, stock | Revisar calidad y periodo | Snapshot KPI con fuente y fecha |
| 2. Decisión económica | Saber cuánto se puede invertir | AOV sin IVA, COGS, gastos, beneficio objetivo, gasto Meta | Fijar CAC máximo, ROAS mínimo y presupuesto | Objetivo aprobado y nota del consultor |
| 3. Planificación | Convertir objetivos en acciones | Calendario CSV, temporadas, canal, audiencia, recursos Marketing | Crear acción con fecha, canal, responsable y enlaces | Ítem de calendario persistido |
| 4. Ejecución | Confirmar que la acción se hizo | Ítem planificado, draft, campaña, tarea, milestone | Marcar estado y registrar incidencia | Estado `completed`/`skipped` + nota |
| 5. Evaluación | Comparar plan contra realidad | Ventas, gasto, ROAS, CAC, conversiones, stock | Mantener, corregir o detener | Snapshot posterior + decisión |

## Reparto de los CSV

| CSV | Fase | Qué se debe guardar |
|---|---|---|
| `instrucciones.csv` | 1–2 | Definiciones, fórmulas, objetivos y reglas de decisión |
| `kpi-mensual.csv` | 1 y 5 | Snapshot mensual: ventas, pedidos, AOV, costes, margen, funnel y beneficio |
| `ingeniería-inversa.csv` | 1–2 | Modelo económico de facturación, recurrencia, canal, CAC y ads |
| `roas-cac.csv` | 2 | Inputs económicos, umbrales y presupuesto sostenible |
| `calendario.csv` | 3 | Eventos anuales, preparación, lanzamiento y fechas críticas |
| `cal-rebajas.csv` | 3–4 | Acciones diarias por email, stories, post, carrusel y reel/TikTok |
| `tracking-sheet.csv` | 4–5 | Objetivo, realidad, frecuencia, ejecución y resultado por mes |

## Contrato mínimo de una acción

Una acción de calendario no está completa hasta tener:

- organización y, cuando corresponda, tienda;
- fecha de inicio y fin;
- canal y tipo de acción;
- responsable o tarea asociada;
- estado: `planned`, `in_progress`, `completed`, `skipped` o `blocked`;
- vínculo opcional con Marketing, Meta, Klaviyo y Mi Camino;
- resultado o incidencia;
- KPI objetivo y KPI real cuando se evalúe.

## Contrato mínimo de un snapshot

Cada snapshot debe conservar periodo, organización, tienda opcional, fecha de captura, fuente, ventas, pedidos, AOV, gasto ads, ROAS, CAC, beneficio, notas y usuario que lo capturó. Los valores calculados solo se guardan si sus denominadores son válidos.

## Alcance y visibilidad

- El consultor ve primero la cartera y después el detalle de un cliente.
- El detalle nunca mezcla organizaciones sin etiqueta.
- Una tienda concreta filtra todas las métricas, acciones y snapshots.
- Sin tienda seleccionada se usa el agregado de todas las tiendas autorizadas de esa organización.
- El cliente no ve el módulo de Planificación del consultor; sus resultados operativos viven en Dashboard, Tareas y Mi Camino.

## Estado actual

### Fase 5 iniciada

La primera capa de evaluaciÃ³n ya estÃ¡ operativa: PlanificaciÃ³n consulta acciones vencidas y bloqueadas, las muestra agrupadas por el alcance seleccionado y permite resolverlas desde el modal de ejecuciÃ³n. Sin tienda seleccionada, la bandeja agrega todas las tiendas autorizadas de la organizaciÃ³n.

Pendiente para cerrar esta fase: umbrales configurables de ROAS/CAC/margen/stock, comparaciÃ³n objetivo-versus-real, decisiones de mantener/corregir/detener y exportaciÃ³n completa del tracking-sheet.

Fases 1–3 tienen base implementada: métricas conectadas, calendarios persistidos, snapshots, enlaces con Marketing/Meta/Klaviyo/Mi Camino, archivado lógico y auditoría. La siguiente implementación debe completar la fase 4: estados de ejecución, responsable, incidencias y resultado de cada acción. Después se añadirán alertas y comparación automática de la fase 5.
### Cierre tecnico de la fase 5

- Los objetivos admiten ahora `store_id`; `NULL` representa el agregado de la organizacion.
- La API de objetivos acepta `storeId` y mantiene la separacion por cliente y tienda.
- El CSV del historico incluye ventas, pedidos, AOV, gasto ads, ROAS, CAC, beneficio y notas.
- La migracion `20260901190000_phase5_objective_store_scope.sql` esta aplicada en remoto.
