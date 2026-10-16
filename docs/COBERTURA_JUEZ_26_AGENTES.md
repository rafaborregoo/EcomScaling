# Cobertura de implementación del juez por agente

**Actualizado:** 10 de octubre de 2026. Esta matriz separa cuatro cosas: el agente existe en el catálogo; su ruta de generación llama al juez; la evidencia disponible permite evaluar el artefacto; y se ha ejecutado una evaluación real de ese agente. Estar integrado no equivale a estar calibrado ni certificado.

> **Estado vigente:** las tablas de este documento registran una revisión anterior del runner. Para el recuento actual de contratos candidate-pinned (22/26), A19 Arquitecto/Revisión, cuatro casos visuales no evaluables y drift de migraciones, consulta [la matriz de verificación actual](./MATRIZ_VERIFICACION_JUEZ_26_2026-10-10.md) y la última sección de [estado de implementación](./ESTADO_IMPLEMENTACION_JUEZ.md). No uses los conteos históricos de esta página como estado actual.

## Rutas verificadas en código

- **Runner común:** `runGenericDiagnosticAgent` persiste el output, carga el snapshot y los recibos de herramientas y después llama a `judgePersistedAgentOutput`. La búsqueda de callers en el grafo identifica las rutas genéricas indicadas en la tabla.
- **Rutas específicas:** A01 (resumen de llamada), A09 (turno del copiloto), A11 (borrador de marketing), A15 (análisis de imagen) y A16 (borrador de texto sobre imagen) llaman al mismo runtime de juicio desde su función de generación.
- **Horizontes:** una ruta `runPlanAgent` selecciona A04, A17 o A18 según el horizonte diario, semanal o mensual. Cada código conserva su propia rúbrica.
- **Persistencia:** cada dictamen se enlaza con `organization_id` y `agent_run_id`; `agent_output_id` queda nulo en artefactos que no usan `agent_outputs` (A01, A15, A16 y algunos turnos A09). El historial de evaluación sigue disponible por la traza del run.
- **Modo:** `AI_JUDGE_MODE` es `off` si no se configura; TEST mostró una ejecución en `shadow`. El código local no está desplegado con esta entrega.

## Matriz por los 26 códigos activos

| Código | Integración | Evidencia prevista | Estado verificado |
| --- | --- | --- | --- |
| A01 `a01_analista_llamadas` | Ruta específica `runCallAnalyst` | Resumen, hechos, decisiones, transcripción y contexto C1 congelado | Integrado en código; no hay ejecución de juez A01 en TEST todavía |
| A02 `a02_monitor_negocio` | Runner común, `runMonitorAgent` | Snapshot C2 de dashboard y recibos SQL/tools del mismo run | Integrado; pendiente juicio real y calibración |
| A04 `a04_generador_tareas` | Runner común, `runPlanAgent(day)` | Backlog, alertas, ventas, Camino y snapshot acotado a tienda | Integrado; pendiente juicio real y calibración |
| A05 `a05_estrategia_campanas` | Runner común, estrategia/editor | Contexto comercial, estacionalidad, rendimiento y plan de campaña | Integrado; pendiente juicio real y calibración |
| A06 `a06_planificador_stock` | Runner común, `runStockPlannerAgent` | Demanda, cobertura de inventario, historial comparable y snapshot | Integrado; pendiente juicio real y calibración |
| A08 `a08_gestor_conocimiento` | Runner común, `runKnowledgeManagerAgent` | Output y contexto/sources RAG disponibles en snapshot | Integrado; pendiente juicio real y calibración |
| A09 `a09_copiloto_consultor` | Ruta específica `runConsultantChatTurn` | Mensaje actual, historial, alcance de tienda, contexto especialista, playbook y recibos | Integrado; pendiente prueba de chat/stream y calibración |
| A11 `a11_generador_marketing` | Ruta específica `runMarketingContentDraft` | Brief, plantillas/contexto aprobado, imágenes adjuntas y alcance de tienda | Integrado; pendiente juicio real y calibración |
| A12 `a12_analista_email` | Runner común, `runEmailAnalystAgent` | Métricas de email, periodo, cobertura y snapshot | Integrado; pendiente juicio real y calibración |
| A13 `a13_operativa_shopify` | Runner común, `runOperativaShopifyAgent` | Tienda, métricas Shopify, hallazgos y propuestas | Integrado; pendiente juicio real y calibración |
| A14 `a14_operativa_meta` | Runner común, `runOperativaMetaAgent` | Cuenta Meta, gasto, eventos, atribución y periodo | Integrado; pendiente juicio real y calibración |
| A15 `a15_analista_imagenes` | Ruta específica `analyzeInstagramImage` | Output, imagen original descargada de bucket E-NORA, hash de bytes y snapshot | Integrado; evidencia visual segura y pruebas unitarias; pendiente run real |
| A16 `a16_texto_sobre_imagen` | Ruta específica `draftInstagramOverlay` | Copy propuesto e imagen original con hash | Integrado; `render_readability` y `carousel_consistency` se fuerzan a no evaluable al faltar render y slides vecinos; pendiente run real |
| A17 `a17_plan_semanal` | Runner común, `runPlanAgent(week)` | Prioridades semanales, backlog, resultados y Camino | **Run real en TEST:** review, 2,20/4, siete criterios, 8.876 ms; coste corregido a $0,000898 |
| A18 `a18_plan_mensual` | Runner común, `runPlanAgent(month)` | Capacidad, baseline, iniciativas mensuales y Camino | Integrado; pendiente juicio real y calibración |
| A19 `a19_arquitecto_camino` | Runner común, salida de árbol/plan | Métricas económicas, fases, hitos, evidencia y herramientas | Integrado; pendiente juicio real sobre contrato completo |
| A19 `a19_revision_camino` | Runner común, revisión periódica | Progreso, métricas de hitos, cambios y snapshot de Camino | Integrado; pendiente juicio real y calibración |
| A20 `a20_retencion_clientes` | Runner común, `runRetencionClientesAgent` | Retención, cohortes, cobertura CRM y elegibilidad | Integrado; pendiente juicio real y corregir hallazgos de readiness de auditoría |
| A21 `a21_adquisicion_shopify` | Runner común, `runAdquisicionShopifyAgent` | CAC/ventas, fuentes y límites de atribución | Integrado; pendiente juicio real y calibración |
| A22 `a22_postventa_shopify` | Runner común, `runPostventaShopifyAgent` | Pedidos, fulfillment, excepciones y acciones | Integrado; pendiente juicio real y calibración |
| A23 `a23_creatividad_meta` | Runner común, `runCreatividadMetaAgent` | Ads y capturas visuales ligadas al contexto/periodo | Integrado; solo evaluable si imagen propia se adjunta y pasa validación; pendiente run real |
| A24 `a24_medicion_meta` | Runner común, `runMedicionMetaAgent` | Estado de tracking, freshness, cobertura, errores y eventos | Integrado; pendiente juicio real y calibración |
| A25 `a25_cambios_meta` | Runner común, `runCambiosMetaAgent` | Registro de cambios, actor, fecha y ventana comparable | Integrado; pendiente juicio real y calibración |
| A26 `a26_contenido_email` | Runner común, `runContenidoEmailAgent` | HTML/salida más capturas desktop/mobile adjuntas por el runner | Integrado; el render solo se evalúa si hay capturas adjuntas y hash verificable; pendiente run real |
| A27 `a27_planificador_mailing` | Runner común, `runWeeklyMailingPlanner` | Calendario, frecuencia, estacionalidad, RAG metodológico y resultados | Integrado; pendiente juicio real y calibración |
| A28 `a28_arquitecto_flujos` | Runner común, `runKlaviyoFlowArchitectAgent` | Inventario, eventos, consent, elegibilidad y medición del flujo | Integrado; pendiente juicio real y calibración |
| A29 `a29_analista_metrica` | Runner común, explicación de `/metric-analysis` (ADR-0027) | Veredicto calculado por reglas, drivers con cifra y periodo, atribución por plataforma | Rúbrica de dominio definida; pendiente juicio real y calibración |

## Límites que siguen abiertos

1. **Evaluaciones reales:** solo A17 tiene un juicio externo real persistido. Los demás resultados de esta matriz son evidencia de conexión de código, no de exactitud.
2. **Latencia y durabilidad:** `shadow` persiste el job y devuelve sin llamar al proveedor en la solicitud; el worker periódico usa lease SQL, recupera leases vencidos y limita reintentos. `visible` mantiene la evaluación en línea para incluir dictamen en la respuesta. Falta timeout operativo y reconciliación explícita con runs huérfanos.
3. **A09 streaming:** el mensaje puede emitirse por streaming antes del juicio y el resultado de juicio no forma parte aún de un evento de actualización del stream.
4. **A16:** la interfaz aún no aporta el PNG renderizado final ni los slides vecinos; sus dos criterios visuales afectados se marcan de forma determinista no evaluable. El juicio parcial no certifica diseño visual.
5. **A23/A26:** que el runner pase imágenes es condición necesaria, pero faltan pruebas de extremo a extremo que demuestren descarga, hash, binding al anuncio/campaña/periodo y presentación de evidencia al juez para cada tipo de activo.
6. **Calibración:** faltan conjuntos gold adjudicados por consultores, holdout por versión y agente, análisis de desacuerdo y umbrales operativos aprobados.
7. **Release gate:** conectado al trigger de `agent_versions` y al RPC `promote_agent_version`; se verificó en TEST y producción y ambos rechazan activar una versión sin evidencia, preservando el estado inactivo. Sigue pendiente el preflight CI contra cambios privilegiados de migración y las pruebas completas por cada agente.
8. **Despliegue:** migraciones de juicios y cola aplicadas en TEST y producción; build API, build de producción web y typechecks correctos. La aplicación todavía no se ha desplegado; falta verificación autenticada de UI en el build servido.

El inventario y la auditoría sustantiva agente a agente siguen en [AUDITORIA_JUEZ_AGENTES.md](./AUDITORIA_JUEZ_AGENTES.md); el diseño global de dataset, controles, coste, release gate y operación se mantiene en [PLAN_JUEZ_AGENTES.md](./PLAN_JUEZ_AGENTES.md). Esta matriz evita contar una función compartida como una auditoría o ejecución real de todos sus agentes.

### Revalidación de gates (10-oct-2026)

Las migraciones del gate candidate-pinned y del gate de calibración están instaladas en ambos proyectos. La promoción de versiones requiere offline/live de esa huella y un holdout aprobado y congelado del juez. El bypass de credenciales privilegiadas vía migraciones sigue pendiente de preflight CI. La evaluación gold por agente no se ha corrido; A17 sigue siendo el único juicio de producción de prueba reportado en esta cobertura. Holdout single-use y permisos quedaron verificados en TEST y producción. El estado exacto y pruebas nuevas se registran en [ESTADO_IMPLEMENTACION_JUEZ.md](./ESTADO_IMPLEMENTACION_JUEZ.md).
