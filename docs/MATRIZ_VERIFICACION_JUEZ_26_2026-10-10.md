# Matriz de verificación del juez: 26 entradas de catálogo

**Fecha de corte original:** 10 de octubre de 2026; **última actualización:** 12 de octubre de 2026
**Fuentes primarias:** `packages/ai/src/agent-eval-catalog.ts`, `packages/ai/src/agent-evals.ts`, `packages/ai/src/agent-judge.ts`, `packages/ai/src/live-eval-contract.ts`, `apps/api/src/agent-judge-runtime.ts`, `apps/api/src/agent-release-candidate-eval.ts`, `apps/api/src/agent-release-eval-fixture.ts` y `apps/api/src/ai-runtime.ts`.

> **Actualización de vigencia (12-oct-2026):** para el plan y el estado actual prevalece [`PLAN_FINAL_JUEZ_26.md`](./PLAN_FINAL_JUEZ_26.md). Las secciones históricas siguientes registran hallazgos y cambios sucesivos; no leer las cifras previas como estado vigente. La matriz agente por agente continúa siendo referencia de los IDs de rúbrica y necesidades específicas.

## Cómo leer el estado

- **Rúbrica estática:** el código tiene criterios comunes (evidencia, alcance/privacidad, incertidumbre y seguridad/control humano) más los criterios de dominio indicados. Esto solo prueba cobertura declarada, no calidad del juez.
- **Juez de producción en código:** el runtime común o específico invoca `judgePersistedAgentOutput`; el modo por defecto es `off`. La presencia del call site no demuestra que esa ruta concreta se haya ejecutado ni que esté desplegada.
- **Runner candidate-pinned:** se carga una versión exacta y se ejecuta el candidato con un fixture validado y herramientas replay sin efectos laterales. A19 usa sus contratos Camino especializados; A15/A16/A23/A26 pueden ejecutarse con evidencia visual incluida y verificada. `no_evaluable` nunca cuenta como aprobación.
- **Calibración / certificación:** exige datos humanos gold/holdout y ejecución real del juez. La evidencia de estado consultada en `ESTADO_IMPLEMENTACION_JUEZ.md` registra 0 casos holdout y 0/26 agentes con la muestra requerida; por tanto, ninguna entrada está certificada.

## Cobertura agente por agente

Los códigos son las 26 entradas activas del catálogo (A19 tiene dos perfiles distintos). Los nombres de criterio son IDs exactos de `AGENT_JUDGE_RUBRICS`; el prefijo común se aplica a todos.

| Entrada | Criterios de dominio (`agent-judge.ts`) | Runner candidate-pinned actual | Cobertura que falta para certificar |
|---|---|---|---|
| A01 `a01_analista_llamadas` | `transcript_fidelity` (crítico), `speaker_owner`, `actionability` | Texto v1 disponible; requiere transcripción y procedencia de segmentos en fixture | Casos gold/holdout anonimizados, juicio real y prueba de vínculo salida-transcripción |
| A02 `a02_monitor_negocio` | `metric_integrity` (crítico), `prioritization`, `finding_traceability` | Texto v1 disponible; receipts/snapshot del fixture | Casos adjudicados y cobertura de métricas/errores del conector |
| A04 `a04_generador_tareas` | `today_fit`, `task_evidence` (crítico), `duplicate_control` | Texto v1 disponible; backlog/hitos deben estar congelados en fixture | Casos adjudicados y escenarios de backlog truncado/duplicado |
| A05 `a05_estrategia_campanas` | `campaign_strategy`, `seasonality`, `channel_economics` (crítico), `calendar_readiness` | Texto v1 disponible; necesita ventana, zona horaria y contexto histórico | Casos adjudicados que cubran estacionalidad, rendimiento por canal y límites de atribución |
| A06 `a06_planificador_stock` | `inventory_math` (crítico), `seasonal_forecast`, `replenishment` | Texto v1 disponible; necesita stock/ventas por SKU y periodo | Casos adjudicados con stock incompleto, variantes y lead time desconocido |
| A08 `a08_gestor_conocimiento` | `source_authority` (crítico), `retrieval_coverage`, `dedup_quality` | Texto v1 disponible; corpus/sources deben fijarse en fixture | Casos adjudicados de autoridad, top-k truncado y duplicidad real |
| A09 `a09_copiloto_consultor` | `question_fit`, `claim_traceability` (crítico), `safe_advice` (crítico) | Texto v1 disponible por fixture; el stream de usuario no espera el dictamen | Prueba E2E de stream/eventos y casos adjudicados con receipts y límites de tienda |
| A11 `a11_generador_marketing` | `brief_fidelity`, `claims_and_rights` (crítico), `draft_integrity` (crítico) | Texto v1 disponible; fixture solo puede comprobar draft y replay | Casos adjudicados de claims/consentimiento/guardado pendiente; confirmar llamada en cada ruta de generación |
| A12 `a12_analista_email` | `email_metrics` (crítico), `attribution_limits`, `recommendation_fit` | Texto v1 disponible | Casos adjudicados con denominadores, zonas horarias y diferencia campaign/flow |
| A13 `a13_operativa_shopify` | `store_isolation` (crítico), `shopify_evidence` (crítico), `operational_action` | Texto v1 disponible; replay aislado | Casos adjudicados multi-tienda y null/error vs cero |
| A14 `a14_operativa_meta` | `paid_metrics` (crítico), `causal_limits`, `decision_proportionality` | Texto v1 disponible; replay aislado | Casos adjudicados con inversión material, atribución parcial y break-even |
| A15 `a15_analista_imagenes` | `visual_accuracy` (crítico), `visual_inference`, `asset_lineage` (crítico) | Multimodal disponible si fixture aporta imagen Instagram con bytes, MIME y SHA-256 válidos; proveedor sin visión o evidencia ausente queda `no_evaluable` | Gold/holdout de imágenes adjudicadas y verificación E2E de linaje en dataset real |
| A16 `a16_texto_sobre_imagen` | `copy_brief`, `render_readability` (crítico), `carousel_consistency` | Multimodal disponible si fixture incluye input, render y slide vecino con bytes y hashes | Gold/holdout experto sobre legibilidad y coherencia; demostrar correspondencia del render con salida/version del candidato |
| A17 `a17_plan_semanal` | `weekly_priority`, `task_measurability`, `backlog_coverage` (crítico) | Texto v1 disponible. Docs anteriores reportan un juicio real de prueba A17; eso no es calibración ni certificación | Reproducir juicio bajo manifest actual y reunir gold/holdout adjudicados |
| A18 `a18_plan_mensual` | `monthly_direction`, `monthly_measurement`, `capacity_and_handoff` | Texto v1 disponible | Casos adjudicados de capacidad, baseline y solape A17/A04 |
| A19 `a19_arquitecto_camino` | `goal_economics` (crítico), `roadmap_logic`, `cross_app_context`, `feasibility` | **Ejecutable con contrato Camino especializado**: `caminoPlanJsonSchema` + `caminoPlanSchemaForHorizon`; el fixture fija `horizon_months` y `reference_date`. | La prueba actual confirma la selección del contrato y fail-closed si faltan horizonte/fecha; falta ejecución candidata E2E y gold/holdout adjudicados. |
| A19 `a19_revision_camino` | `progress_measurement` (crítico), `goal_drift`, `revision_safety` (crítico) | **Contrato especializado conectado**: `caminoWeeklyReviewJsonSchema` + `caminoWeeklyReviewSchema`; fixture fija Camino aprobado/versionado, ventana, progreso, snapshot, fuentes métricas y revisión anterior. | Pruebas de contrato pasan; falta ejecución real con proveedor candidato, casos humanos gold/holdout y certificación. |
| A20 `a20_retencion_clientes` | `cohort_integrity` (crítico), `retention_interpretation`, `intervention_fit` | Texto v1 disponible | Casos adjudicados con cobertura CRM, cohortes pequeñas y consentimiento |
| A21 `a21_adquisicion_shopify` | `acquisition_attribution` (crítico), `unit_economics` (crítico), `channel_comparison` | Texto v1 disponible | Casos adjudicados con cobertura de fuente, CAC/CPA y ventanas incompatibles |
| A22 `a22_postventa_shopify` | `delivery_scope` (crítico), `delivery_evidence`, `customer_action` | Texto v1 disponible | Casos adjudicados con eventos ausentes, devoluciones y datos personales |
| A23 `a23_creatividad_meta` | `creative_decision`, `visual_evidence` (crítico), `performance_separation` | Multimodal disponible si fixture liga imagen al activo Meta, anuncio y periodo con hashes válidos | Gold/holdout de anuncios con rendimiento atribuido; verificar binding real de cuenta/anuncio/periodo |
| A24 `a24_medicion_meta` | `measurement_status` (crítico), `signal_diagnosis`, `downstream_guard` (crítico) | Texto v1 disponible | Casos adjudicados de `unknown`, sin actividad, RPC fallido y bloqueo de claims downstream |
| A25 `a25_cambios_meta` | `change_history` (crítico), `before_after`, `action_approval` (crítico) | Texto v1 disponible | Casos adjudicados con RPC no disponible, ventanas inmaduras y aprobaciones |
| A26 `a26_contenido_email` | `email_content`, `render_evidence` (crítico), `delivery_performance` | Multimodal disponible con dos capturas hash-verified del fixture, viewport desktop/mobile y HTML como source block | Gold/holdout y vínculo E2E del HTML/capturas al email enviado; el fixture no prueba inbox ni todos los clientes |
| A27 `a27_planificador_mailing` | `calendar_strategy`, `rag_method`, `performance_learning` (crítico), `planning_boundary` (crítico) | Texto v1 disponible | Casos adjudicados de fechas/zonas horarias, RAG privado, fatiga y frontera de “planificar solamente” |
| A28 `a28_arquitecto_flujos` | `flow_evidence` (crítico), `flow_eligibility` (crítico), `flow_design` | Texto v1 disponible | Casos adjudicados con consentimiento, elegibilidad, trigger y medición holdout |

## Dictamen cuantificado de cobertura

| Medida | Resultado comprobable | Interpretación |
|---|---:|---|
| Entradas del catálogo y rúbricas | 26/26 | La prueba `packages/ai/src/agent-judge.test.ts` compara las claves con el catálogo y valida criterios; no demuestra calibración. |
| Rúbricas con criterios de dominio | 26/26 | Hay 4 criterios comunes más 3–4 criterios específicos por perfil. A19 cuenta como dos perfiles independientes. |
| Contratos soportados por el candidate-runner | 26/26 | Incluye A19 especializado y evidencia visual A15/A16/A23/A26 en fixtures tipados. Suite de contrato no equivale a ejecución productiva ni certificación. |
| Perfiles con contrato multimodal disponible | 4/4 | A15/A16/A23/A26 reciben bytes verificados en candidato y juez cuando el fixture aporta la evidencia requerida. |
| Agentes con gold/holdout suficiente y calibración certificada | 0/26 | El estado documentado del dataset es 0 holdout y 0/26 sobre el mínimo estadístico. |
| Integraciones de juez desplegadas y modo visible | 0 verificadas en este corte | El modo por defecto es `off`; la matriz anterior dice que el código no está desplegado. Se necesita prueba de entorno/runtime para cambiar este estado. |

## Qué pruebas existen y qué no prueban

- `packages/ai/src/agent-judge.test.ts`: estructura/cobertura de rúbricas y casos unitarios de A05/A16; no evalúa modelos sobre casos humanos.
- `packages/ai/src/live-eval-contract.test.ts`: validación del contrato live, pinning de candidato, salida exacta, juez y evidencia; no garantiza que cada ruta funcional del producto invoque correctamente la evaluación.
- `apps/api/src/agent-release-candidate-eval.test.ts` y `agent-release-eval-fixture.test.ts`: candidato con hash/manifest, aislamiento de contexto, contratos especializados y bytes multimodales; no acreditan proveedor desplegado ni juicio semántico gold.
- `apps/api/src/agent-judge-runtime.test.ts`: runtime persistido y modos del juez; las pruebas mockeadas no acreditan llamadas de proveedor de cada agente en TEST/prod.
- `docs/ESTADO_IMPLEMENTACION_JUEZ.md`: recoge los gates de DB, ejecución y conteos de gold/holdout. Las entradas históricas allí deben leerse por fecha; prevalece la sección con la fecha de corte más reciente.

## Pendientes para certificación y despliegue

1. Añadir pruebas E2E por ruta de producto que demuestren la invocación del juez y la relación exacta entre artefacto, recibos, run y tenant; cubrir streaming A09, reintentos y perfiles especiales.
2. Completar el asistente de carga de casos visuales tipados; revisar privacidad, doble revisión independiente y adjudicación.
3. Recoger datos humanos anonimizados hasta el suelo estadístico definido para cada perfil y congelar el holdout single-use.
4. Ejecutar calibración real, analizar desacuerdos por criterio/segmento y obtener el gate cuantitativo; el estado actual es 0 casos adjudicados.
5. Ejecutar candidate-pinned con manifiestos actuales contra proveedor en TEST; medir coste/latencia/persistencia y rechazo de casos incompletos.
6. Añadir límites agregados de gasto/sampling para shadow, desplegar en entorno de prueba y obtener evidencia antes de activar visible.

**Conclusión actualizada:** hay 26/26 rúbricas y 26/26 contratos candidate-pinned disponibles en código. No hay certificación humana ni despliegue verificado; “26/26 contratos” no significa “juez validado en 26 agentes”.

## Actualización de cobertura candidate-pinned

> **Nota de vigencia (12-oct-2026):** los dos párrafos siguientes describen un corte anterior y quedaron superados por la sección «Implementación posterior del runner multimodal». El estado vigente es **26/26 contratos de código**; A15/A16/A23/A26 ya no deben contarse como no evaluables por falta de transporte de imágenes en el candidate-runner. Esto no certifica el linaje de capturas frente a renders de producto ni la calidad semántica del juez.

El provider selecciona para A19 Arquitecto `caminoPlanJsonSchema` y el schema Zod de Camino por horizonte, a partir de `horizon_months` y `reference_date` del fixture. Para A19 Revisión selecciona `caminoWeeklyReviewJsonSchema` y `caminoWeeklyReviewSchema`, con contexto congelado de Camino aprobado/versionado, progreso y evidencia métrica. Las pruebas focalizadas validan ambos contratos y condiciones fail-closed. La cobertura candidate-runner pasa a **22/26 contratos**; esto no equivale a ejecución real con proveedor ni a certificación.

A19 Revisión valida el fixture especializado y selecciona el contrato de salida real; quedan **4/26 no evaluables**: los cuatro agentes visuales. El estado `AI_JUDGE_MODE`, el despliegue y los datos gold/holdout no cambian con este avance.

## Estado del historial de migraciones del holdout de fixtures

La migración `20261218090001_agent_release_eval_holdout_claims.sql` fue aplicada por MCP en TEST y producción. La verificación reportada confirma tabla/ledger, RLS y trigger append-only; la RPC de claim queda expuesta solo a `service_role`, y el ledger se encontraba vacío al comprobarlo. El mecanismo consume cada fixture `release` en el primer intento, también cuando falla la ejecución, y evita reutilizar el holdout para iterar versiones.

Existe un drift del historial de migraciones: MCP registra versiones remotas sin fichero local correspondiente (**24 versiones**), y la migración recién aplicada aparece con identificadores remotos `20261010105024` en TEST y `20261010105122` en producción frente al fichero local `20261218090001`. Ese drift bloquea `db push --dry-run`. No se debe tratar el `dry-run` como limpio hasta reconciliar el historial con el estado real de ambas bases y volver a verificar; esta actualización documental no modifica ni vuelve a aplicar migraciones.

## Brecha multimodal de A15/A16/A23/A26: evidencia comprobada

El límite no está en la capacidad del juez para recibir imágenes. `judgePersistedAgentOutputNow` pasa `visualEvidence.images` a `runAgentTurnOpenAI`; `loadPersistedJudgeVisualEvidence` acepta bytes base64 o una URL limitada al origen de Supabase y a rutas de buckets E-NORA, corta la descarga por tamaño, valida MIME contra la firma de los bytes y calcula SHA-256 antes del juicio. Por otro lado, `runAgentTurnOpenAI` ya convierte `images` a partes de imagen del proveedor y valida el tamaño del payload. El candidate runner, sin embargo, no proporciona imágenes a la llamada del candidato ni al juez: antes de ejecutar devuelve `no_evaluable` para los cuatro agentes visuales (`agent-release-candidate-eval.ts`).

El fixture no basta para resolverlo de forma segura: `visual_artifacts` solo contiene `artifact_id`, `media_type`, `sha256` y `role`. No declara un tipo de entidad que identifique una fila de origen verificable, ni un `store_ref`/cuenta/periodo por artefacto, ni un binding privado que resuelva `organization_ref` anonimizado a un scope de almacenamiento. No contiene bytes. Por eso `artifact_id` no se puede usar como ruta Storage, y usar una URL libre o confiar en el MIME/hash declarado por el fixture no acredita el activo.

| Agente | Evidencia real disponible en runtime | Brecha para el candidate runner | Contrato que debe añadirse antes de implementarlo |
|---|---|---|---|
| A15 `a15_analista_imagenes` | La ruta de generación descarga una imagen desde `instagram_image_bank` bajo `organization_id`, valida tamaño/firma MIME y adjunta sus bytes al análisis. | No hay resolución candidate-pinned de `artifact_id` a la fila imagen ni entrega de los mismos bytes al candidato y al juez. | Binding privado de `artifact_id` a `instagram_image_bank.id`, organización y tienda; permitir solo bucket privado, `storage_path` bajo prefijo de organización, MIME/size/hash cotejados con fila y bytes; congelar la identidad/version del activo en el snapshot. |
| A16 `a16_texto_sobre_imagen` | La ruta produce un borrador de overlay y conoce el activo original; la rúbrica necesita render exportado y vecinos del carrusel para puntuar legibilidad/coherencia. | No existe PNG final ni colección de slides vecinos en el fixture. El JSON/preview DOM no demuestra cómo se ve el export. | Persistir un artefacto render inmutable por `run_id`/slide, hash, MIME, dimensiones, versión de renderer y binding al asset/overlay; incluir vecinos ordenados con el mismo scope. Sin esto, solo puede juzgarse `copy_brief`; los criterios visuales siguen `no_evaluable`. |
| A23 `a23_creatividad_meta` | `loadA23VisualEvidence` lee activos Meta relacionados desde el banco privado, limita bytes y comprueba MIME real; anota anuncio/estado de atribución y distingue miniatura fija de vídeo. | El fixture no liga el activo a `ad_id`, cuenta/tienda y periodo; una imagen suelta no prueba que corresponde al anuncio ni a la ventana de métricas. | Binding privado a activo + `ad_id` + cuenta/tienda + ventana y estado de atribución; congelar métricas/snapshot y los bytes de la captura del mismo anuncio. Identificar miniaturas como fotograma estático, no como vídeo completo. |
| A26 `a26_contenido_email` | La captura se obtiene del spool local del renderer mediante `render_id` y nombre permitido; solo devuelve PNG de captura completada. No es un objeto del bucket de Storage. | El fixture no incluye `render_id`, la asociación al email/HTML exacto ni bytes desktop/mobile. El adaptador de Storage propuesto no puede acceder a este spool local. | Binding interno del render al `organization_id`, run/email y hash del HTML, viewport (`desktop`/`mobile`), estado completado, nombre permitido y hash de captura; exponerlo al runner mediante una interfaz interna autenticada de captura, con límite, firma PNG y conservación de bytes. |

**Decisión:** no añadir ahora un fetcher genérico de Storage. No resuelve A16/A26 y, sin binding de entidad y scope para A15/A23, podría asociar bytes válidos al caso equivocado. El requerimiento transversal es que una capa confiable del servidor resuelva cada artefacto mediante identificador tipado y scope real (organización/tienda/cuenta/periodo), recupere bytes sin URL externa, imponga límites durante la lectura, compruebe MIME por firma y hash esperado, y entregue exactamente los mismos bytes inmutables al candidato y al juez. Para A26 la fuente será el renderer interno, no Storage. Tests de aceptación pendientes: tenant mismatch, artifact-kind/role mismatch, path fuera del prefijo, bytes mayores al límite, hash/MIME falsos, render incompleto, captura de otro email o viewport, y comprobación de igualdad de hash para candidato y juez. Hasta que exista ese contrato, A15/A16/A23/A26 siguen **4/26 no evaluables** y no se certifica su calidad visual.

## Implementación posterior del runner multimodal (10-oct-2026)

El candidate-runner ya incluye soporte de visión para las cuatro entradas. El fixture contiene los bytes exactos y sus metadatos tipados; valida MIME por firma, SHA-256, scope organizativo, periodo y roles. Se limita a cuatro imágenes/5 MiB; A16 exige input/render/neighbor y A26 exige capturas desktop/mobile. Los mismos bytes validados se pasan a candidato y juez, mientras el snapshot textual conserva hashes y metadatos sin repetir base64. La decisión anterior de no depender de Storage libre se mantiene: la evidencia se congela explícitamente en el caso por el administrador de plataforma. Los tests focalizados pasan 14/14 y typecheck API pasa.

Esta implementación hace que **26/26 entradas tengan un contrato ejecutable en código**; no resuelve todavía la creación de casos gold/holdout aprobados ni certifica linaje de A16/A26 contra artefactos de producto en producción. La prueba de calidad real requiere fixtures anonimizados y revisión humana, proveedor multimodal real, y E2E contra las rutas del producto. `AI_JUDGE_MODE` permanece `off` hasta completar el gate de calibración.


## Primera tanda de ejecución HTTP autenticada (12-oct-2026)

La comprobación HTTP autenticada inicial en TEST cubrió siete ejecuciones de producto: A05, A13, A14, A20, A21, A22 y A26; también verificó 23 rechazos `401` sin sesión. Las pruebas posteriores de A15 y A16 elevan a nueve los perfiles con alguna E2E HTTP autenticada, según el mapa vigente de abajo. No es una E2E por cada perfil ni cada call path: faltan rutas especiales, reintentos y streaming. La tabla `agent_release_eval_cases` de TEST se consultó el 12-oct-2026 y estaba vacía (0 casos en cualquier split); no hay base para calibrar/certificar ni para activar visible. Véase el registro HTTP en `ESTADO_IMPLEMENTACION_JUEZ.md`.

## Mapa comprobado de ruta y artefacto del juez (12-oct-2026)

El catálogo activo contiene 26 perfiles. La ruta común `runGenericDiagnosticAgent` persiste `agent_runs` y `agent_outputs`, guarda snapshot/recibos y llama a `judgePersistedAgentOutput` después de persistir la salida. En modo `shadow`, esa llamada encola el juicio; el paso de trazabilidad registra `quality_judgment`. Los 21 perfiles que comparten esta ruta son:

| Código | Perfil | Ruta de ejecución / artefacto que juzga | E2E HTTP con juez observada |
|---|---|---|---|
| A02 `a02_monitor_negocio` | Monitor de negocio | Diagnóstico común / `agent_output` | Pendiente |
| A04 `a04_generador_tareas` | Generador de tareas | Diagnóstico común / `agent_output` | Pendiente |
| A05 `a05_estrategia_campanas` | Estrategia de campañas | Diagnóstico común / `agent_output`; hay un path de planificación y otro de edición con contexto de llamada | Parcial: planificación HTTP en TEST `pending_approval`/`review`; el path de edición no está probado |
| A06 `a06_planificador_stock` | Planificador de stock | Diagnóstico común / `agent_output` | Pendiente |
| A08 `a08_gestor_conocimiento` | Gestor de conocimiento | Diagnóstico común / `agent_output` | Pendiente |
| A12 `a12_analista_email` | Analista de email | Diagnóstico común / `agent_output` | Pendiente |
| A13 `a13_operativa_shopify` | Operativa Shopify | Diagnóstico común / `agent_output` | Sí; TEST, `review` |
| A14 `a14_operativa_meta` | Operativa Meta | Diagnóstico común / `agent_output` | Sí; TEST, `review` |
| A17 `a17_plan_semanal` | Plan semanal | Diagnóstico común / `agent_output` | Pendiente |
| A18 `a18_plan_mensual` | Plan mensual | Diagnóstico común / `agent_output` | Pendiente |
| A19 `a19_arquitecto_camino` | Arquitecto del Camino | Diagnóstico común con contrato Camino / `agent_output` | Pendiente |
| A19 `a19_revision_camino` | Revisión del Camino | Diagnóstico común con contrato de revisión / `agent_output` | Pendiente |
| A20 `a20_retencion_clientes` | Retención de clientes | Diagnóstico común / `agent_output` | Sí; TEST, `review` |
| A21 `a21_adquisicion_shopify` | Adquisición Shopify | Diagnóstico común / `agent_output` | Sí; TEST, `review` |
| A22 `a22_postventa_shopify` | Postventa Shopify | Diagnóstico común / `agent_output` | Sí; TEST, `review` |
| A23 `a23_creatividad_meta` | Creatividad Meta | Diagnóstico común con evidencia visual / `agent_output` | Pendiente; TEST no tiene tienda Meta |
| A24 `a24_medicion_meta` | Medición Meta | Diagnóstico común / `agent_output` | Pendiente; TEST no tiene tienda Meta |
| A25 `a25_cambios_meta` | Cambios Meta | Diagnóstico común / `agent_output` | Pendiente; TEST no tiene tienda Meta |
| A26 `a26_contenido_email` | Contenido email | Diagnóstico común con evidencia visual opcional / `agent_output` | Sí; TEST, `no_evaluable` por falta de capturas |
| A27 `a27_planificador_mailing` | Planificador de mailing | Diagnóstico común / `agent_output` | Pendiente |
| A28 `a28_arquitecto_flujos` | Arquitecto de flujos | Diagnóstico común / `agent_output` | Pendiente |

Cinco perfiles escriben artefactos fuera del `agent_outputs` genérico y llaman al mismo servicio de juicio con un tipo de artefacto explícito:

| Código | Artefacto juzgado | Persistencia / particularidad | E2E HTTP con juez observada |
|---|---|---|---|
| A01 `a01_analista_llamadas` | `call_summary` | Resumen de llamada y run persistidos; `output_id` nulo | Pendiente |
| A09 `a09_copiloto_consultor` | `consultant_chat_turn` | Turno de chat; incluye propuesta y respuesta del copiloto | Pendiente |
| A11 `a11_generador_marketing` | `marketing_content_draft` | Borrador versionado; juzga la salida sanitizada | Pendiente |
| A15 `a15_analista_imagenes` | `instagram_image_analysis` | Análisis ligado a imagen original; bytes visuales se cargan para el juicio | Sí; TEST, `passed` 3,56/4 con recibo de linaje y SHA-256 verificado |
| A16 `a16_texto_sobre_imagen` | `instagram_overlay_copy_proposal` | Propuesta de copy; hoy se adjunta imagen original, no un render final compuesto | Sí; TEST, `review` 3,22/4; render final y slides vecinos `no_evaluable` |

Este mapa acredita **conexión estructural de 26/26 perfiles** entre el catálogo y uno de los dos puntos de llamada al juez. No acredita ejecución de cada endpoint, callbacks de streaming/reintento, corrección de los snapshots recibidos ni calidad de los dictámenes. La evidencia E2E HTTP autenticada cubre actualmente 11/26 perfiles con al menos una ruta: A05 (planificación), A12, A13, A14, A15, A16, A20, A21, A22, A26 y A28. A05 aún tiene un path de edición pendiente; faltan 15 perfiles y rutas alternativas. Para A16, el dictamen de copy no debe interpretarse como validación de legibilidad del render final mientras el artefacto compuesto no quede ligado y adjunto. TEST registra 15/26 perfiles con dictamen live y todavía 0 casos adjudicados para calibración/holdout.

La prueba de invariantes añadida a `apps/api/src/agent-release-candidate-eval.test.ts` itera los 26 códigos del catálogo y exige fixture válido, contrato de salida y contexto construible. Al activarla se detectó que el helper generaba IDs duplicados para input/render/neighbor de A16; se corrigieron los IDs y la suite focalizada pasa 7/7. Es cobertura estructural sintética, no ejecución real de 26 modelos ni evidencia gold. Las suites AI (254/254) y API unitarias (1.101/1.101) también pasan en el estado actual.

### Ejecuciones directas de A17/A18 en TEST (12-oct-2026)

El runtime ejecutó `week` y `month`, persistió outputs pendientes de aprobación y dictámenes reales `review`: A17 3,04/4 (run `fcbb777f-34c7-467f-a7b1-c16fb4e363f6`, coste estimado 0,002584 USD) y A18 3,05/4 (run `7846556b-f9e9-4f3c-840b-8b2f61e4d851`, 0,002659 USD). A17 ya estaba en la cobertura live anterior; A18 eleva el total a 13/26 perfiles con dictamen. Se invocó directamente el runner, por lo que no se contabiliza como E2E HTTP; el mapa HTTP autenticado permanece en 9/26.

## Linaje de contexto observado por perfil

Fuentes obtenidas mediante recorrido AST de las llamadas `runGenericDiagnosticAgent` y contraste con los context builders de `apps/api/src/ai-runtime.ts`. Los nombres son RPCs/tablas que el código consulta; la disponibilidad de conexión, calidad del sync y frescura se deben validar por ejecución. Los snapshots persisten el contexto construido, y los recibos documentan herramientas usadas; el juicio no reconsulta datos de tienda.

| Código | Perfil | Fuentes que alimentan el run y el juicio | Límite crítico que la rúbrica debe respetar |
|---|---|---|
| A01 `a01_analista_llamadas` | Llamadas | `consulting_calls` plus current versioned `call_transcripts`, then business/history context | No convertir inferencias en compromisos o responsables; exigir segmento fuente y confianza de transcripcion |
| A02 `a02_monitor_negocio` | Monitor | RPCs Shopify de ventas/finanzas/stock/riesgos, gasto Meta, reporte Klaviyo; alertas y objetivos métricos | Ventanas/moneda/sync; error o ausencia de datos no equivalen a cero ni a causalidad |
| A04 `a04_generador_tareas` | Tareas | Ventas resumen, runs hermanos, planes estratégicos, tareas y alertas; código elegido a través del spec del planificador | Deduplicar y vincular a hito/tarea; no elevar backlog truncado a “todo completado” |
| A05 `a05_estrategia_campanas` | Campañas | Ruta de planificación: ventas y finanzas Shopify, stock/riesgos, email Klaviyo, gasto Meta, plan/calendar y entidades de cuentas/campañas/ads, conocimiento recuperado. Ruta de edición: bloques de contexto suministrados por caller, sin RPC de dominio dentro del runner | Dos call paths bajo el mismo code necesitan fixtures separados; la propuesta no demuestra campaña creada, oferta confirmada ni envío; tiempo local e ingresos atribuidos requieren evidencia |
| A06 `a06_planificador_stock` | Stock | Resumen/riesgo Shopify, ventas semanales por producto; calendario de campañas y tiendas | No comprar por demanda promocional especulativa; stock/lead time ausente debe quedar desconocido |
| A08 `a08_gestor_conocimiento` | Conocimiento | RPCs de cobertura de catálogo y candidatos semánticos; knowledge documents, recibos y approvals | Similitud no prueba duplicado; distinguir scope global/organización, audience y versión de fuente |
| A09 `a09_copiloto_consultor` | Copiloto | `ai_conversations`, `ai_messages`, selected Shopify store and tool receipts; artifact is `consultant_chat_turn` | Aislar turno/conversacion/scope; propuestas con efecto requieren aprobacion, no equivalen a ejecucion |
| A11 `a11_generador_marketing` | Marketing | Brief, `tasks`, `strategic_plan_milestones`, Shopify store, attached reference/content images from tenant marketing assets; sanitized `marketing_content_draft` | Verificar claims/oferta/derechos; guardar borrador no publica contenido |
| A12 `a12_analista_email` | Email | Reporte de rendimiento y tracking Klaviyo | Campaña vs flow, denominadores, ventana y atribución; tracking roto no debe parecer bajo rendimiento |
| A13 `a13_operativa_shopify` | Shopify | Resumen Shopify de ventas/finanzas/stock/riesgos y alertas | Scope de tienda, moneda, freshness y null/error vs cero |
| A14 `a14_operativa_meta` | Meta | Gasto Meta actual/anterior, resumen financiero, alertas y cobertura de cuentas sin tienda | ROAS atribuido no equivale a incrementalidad; gastos no asignados impiden declarar gasto tienda cero |
| A15 `a15_analista_imagenes` | Imagenes | En modo juez activo, runtime congela bytes verificados y comparte la misma imagen entre candidato/juez; SHA-256 queda en snapshot; artefacto `instagram_image_analysis` | E2E TEST `passed` 3,56/4; recibo confirma modelo/proveedor, run, activo y SHA-256. Nunca inferir rendimiento desde píxeles |
| A16 `a16_texto_sobre_imagen` | Texto sobre imagen | En modo juez activo, comparte bytes congelados del original y guarda SHA-256; artefacto `instagram_overlay_copy_proposal` | E2E TEST `review` 3,22/4 confirma copy y linaje del original; no existe render final, así que legibilidad/clipping/carrusel siguen `no_evaluable` |
| A17 `a17_plan_semanal` | Semanal | Métricas de ventas, runs hermanos, plan, tareas y alertas; variante del spec del planificador | Prioridad semanal conectada a iniciativa vigente, capacidad y tarea accionable |
| A18 `a18_plan_mensual` | Mensual | Métricas de ventas, planes, tareas, runs y alertas; variante del spec del planificador | Baseline comparable, objetivo medible, owner/capacidad; no duplicar A04/A17 |
| A19 `a19_arquitecto_camino` | Arquitecto Camino | Ventas/resumen mensual, finanzas, margen, stock, gasto Meta, Klaviyo, top productos/devoluciones; plan/tareas/alertas/runs y conocimiento | Meta debe reconciliarse con baseline, moneda y horizonte; fuentes ausentes o estacionales no se inventan |
| A19 `a19_revision_camino` | Revisión Camino | Camino aprobado/versionado, progreso de tareas, ventas/finanzas/stock/Meta/Klaviyo y calendario; output con contrato de revisión | No reemplazar el plan aprobado; comparar ventanas maduras y diferenciar dato stale de retroceso real |
| A20 `a20_retencion_clientes` | Retención | Herramienta read-only `shopify_customer_health` exigida por prompt, recibos y contexto de tareas abiertas | Cohortes inmaduras/no clasificadas, consentimiento y cobertura CRM obligan abstención o incertidumbre |
| A21 `a21_adquisicion_shopify` | Adquisición | RPCs Shopify de atribución por canal, recuperación de checkout, coste de descuentos y cobertura de sync | CAC/CPA no comparable entre ventanas; cupón/ingreso atribuido no demuestra incremento |
| A22 `a22_postventa_shopify` | Postventa | RPC de devoluciones, contexto del Camino limitado a tienda y tareas | Tracking/evento ausente no equivale a entrega tardía; minimización de datos personales |
| A23 `a23_creatividad_meta` | Creatividad Meta | Rendimiento y ranking de creativos; contexto de medición/backfill y evidencia visual disponible | Creativo debe estar ligado a ad/cuenta/ventana; diferencia visual o correlación no prueba causa |
| A24 `a24_medicion_meta` | Medición Meta | Salud del pixel, fase de aprendizaje, issues de revisión y salud del evento de optimización | Distinguir cero actividad, sync parcial, tracking roto y `unknown`; frenar claims downstream si falla coverage |
| A25 `a25_cambios_meta` | Cambios Meta | Historial de impacto de cambios, overview de audiencias y veredicto de medición | Actor/fecha/change ID y ventanas comparables; la secuencia temporal no prueba causalidad ni aprobación |
| A26 `a26_contenido_email` | Email | Inventario Klaviyo, variación entre emails, cuerpo/template en el momento de envío y account/templates; capturas solo si el run las conserva | HTML hash/email/version exacta; texto no prueba render, inbox ni entrega; sin desktop/mobile no juzgar legibilidad |
| A27 `a27_planificador_mailing` | Mailing | Reporte Klaviyo, calendario existente, historial de aprendizaje y entradas internas del playbook de mailing | Separar conocimiento metodológico de hechos de tienda; fechas/cadencia en zona local; planificar sin redactar ni enviar |
| A28 `a28_arquitecto_flujos` | Flujos | Reporte Klaviyo, cuentas, flows, acciones y mensajes; cobertura de trigger/eventos | Trigger y volumen observados, consentimiento/exclusiones; ausencia de evento y sync fallida son estados distintos |

**Hallazgo transversal de evidencia:** el snapshot registra lo que el context builder entrega, no acredita por sí solo que cada fuente esté completa o reciente. El juez debe ver status, periodo, unidad/moneda, scope, freshness, error de consulta y referencia exacta junto al dato; para agentes con tool calls, revisar también recibos completos y fallidos. La cobertura sintética de contratos no reemplaza fixtures adversariales de null/error, fuente parcial, periodo incompatible, tenant mismatch, conocimiento inyectado y output contradicho por evidencia.

## Cobertura HTTP añadida: A15

A15 ya no está pendiente de E2E: la cola de análisis respondió HTTP 200 y procesó un activo de TEST; candidato `succeeded`, job del juez `completed`, dictamen `review`. El snapshot contiene ambos SHA-256 visuales. La evaluación reveló que el juez no interpreta el snapshot como prueba del enlace entre bytes adjuntos y hashes: `asset_lineage=1/4`. Registrar como ajuste necesario del contrato de evidencia confiable y de la rúbrica; la prueba acredita transporte/persistencia de hashes, no identidad durable ni evaluación visual certificada.

### Resultado final de E2E visual A15 (12-oct-2026)

La ruta HTTP en TEST volvió a ejecutarse tras añadir al recibo de servidor el run, modelo/proveedor, ID de activo y versión de contenido basada en SHA-256. Con una sola instancia actualizada (`localhost:4406`), el análisis terminó `succeeded`, el job `completed`, el juez `passed` con 3.56/4 y `asset_lineage=4/4` (coste estimado 0.000951 USD). Se citan los paths de evidencia de cada metadato. Sigue sin implicar certificación: falta el dataset adjudicado y quedan 18 perfiles sin E2E HTTP, además de rutas alternativas aún no cubiertas.

## Actualizacion de ejecucion A16 (12-oct-2026)

El editor de imágenes A16 ya se ejecutó de extremo a extremo por UI/HTTP contra TEST: borrador guardado, nunca publicado. Se corrigió la URL del cliente y el schema permite abstención sin bloques. Run `72f761b2-1c67-4e75-a5f9-633ffff4ebc6`; juez `review`, 3.22/4, modelo candidato registrado, y criterios de render/carrusel correctamente `no_evaluable` por falta del artefacto final. Cobertura live distinta: 10/26; certificación gold/holdout: 0.

## E2E real A19 Arquitecto con paquete de evidencia completo (12-oct-2026)

La E2E de A19 se repitió directamente desde el runtime TEST con el output, snapshot y recibos persistidos. El primer límite por llamada de 300.000 caracteres seguía recortando el JSON serializado de 321.621 caracteres; se elevó a 600.000 por bloque / 620.000 total y el preflight confirma `truncated=false`. La llamada real a `gpt-6-luna` consumió 75.151 tokens de entrada y 1.913 de salida, tardó 26,026 ms y costó aproximadamente 0,008472 USD. Dictamen `review`, 2,37/4. El juez detectó inconsistencias internas en meta y fechas, y capacidad no confirmada; el output permanece `pending_approval`.

Cobertura live ahora: 11/26 códigos distintos con al menos un dictamen. Esta ejecución demuestra la ruta real A19 Arquitecto y transmisión de evidencia completa para ese caso; no certifica el perfil A19 Revisión ni generaliza a otras rutas. No hay todavía gold/holdout adjudicado suficiente.

## Guard de cobertura del call graph de generación (12-oct-2026)

`apps/api/src/agent-judge-route-coverage.test.ts` analiza el AST de `ai-runtime.ts`: confirma que cada código de `AGENT_EVAL_AGENT_CODES` llega a `runGenericDiagnosticAgent` o a un call site especializado de `judgePersistedAgentOutput`. Para A04/A17/A18 también comprueba el enlace dinámico `PLAN_HORIZONS[horizon].agentCode → runGenericDiagnosticAgent`. Al añadir este guard se detectó y documentó la rama de planificación que no encontraba un escaneo de literales. La suite API pasa 1.104/1.104 y typecheck correcto. Es una verificación estructural del call graph, no 26 ejecuciones HTTP; siguen pendientes las E2E por perfil y las rutas de retry/stream/response envelope.

## Verificación adicional HTTP de A05 en el portal (12-oct-2026)

Con la sesión normal del portal se ejecutó A05 por la ruta HTTP real tres veces: dos ventanas de planificación (mes y trimestre) y una prueba dirigida en TEST con solicitud de 2 mailings y 2 creativos Meta. Las tres ejecuciones terminaron `succeeded` y guardaron el output como `pending_approval`; ninguna campaña se envió ni publicó. Las tres devolvieron `initiatives=[]`, por lo que el calendario quedó vacío. La prueba dirigida recibió dictamen `review`, 2,18/4 (`gpt-6-luna`, coste estimado 0,001032 USD). El juez puntuó `calendar_readiness=1`, `campaign_strategy=1` y `safety=4`: detectó que la abstención era prudente, pero no entregaba la planificación interna pedida. Run `8e1afd09-95fb-4dce-a7a9-a3888f056b3e`; juicio persistido en TEST.

La evaluación también llamó contradictoria a la combinación de mercado España y zona `America/New_York`. La tienda de prueba tiene `America/New_York` como zona horaria configurada; España era el mercado para calcular fechas comerciales. Esa crítica no queda validada: separar zona operativa de mercado es correcto y debe convertirse en control anti-falsa-alarma de la rúbrica A05. El motivo de abstención sí requiere revisión: el inventario de la demo estaba desactualizado más de 77 horas y había referencias agotadas/bajas. La planificación debería poder proponer preparación o acciones condicionales verificables sin inventar productos ni ofertas. Esta ejecución cuenta como ruta HTTP A05, pero no incrementa la cobertura de perfiles porque A05 ya estaba incluido en 9/26; tampoco aporta un caso gold adjudicado.

## Actualización de cobertura A12 y timeout A02 (13-oct-2026)

E2E autenticada A12 desde Klaviyo: run `ad6dd7c5-d068-4159-8bb5-6d678172ef69`, output `376d50f8-d9dc-4047-a4bd-0d2836b241a9`, estado `succeeded`; modelo `gpt-6-luna`, 3 llamadas de modelo y 3 herramientas. Dictamen `ef88ceae-7bbe-420d-879f-fdc9194f326c`, `judge-rubrics-v2`, estado `review`, 2,50/4, 13.545 ms, coste estimado del juez 0,002941 USD. La UI mostró cuatro riesgos y una propuesta pendiente; no se aprobó ni aplicó. El registro persistido confirma que A12 ya está entre los 14 perfiles distintos con dictamen y añade la décima E2E HTTP autenticada. Esta ejecución no es una etiqueta gold ni una certificación del juez.

A02 se repitió sin reiniciar el servidor: `f06d26eb-3d21-40be-8d7c-958d29a56329` terminó `timeout` (`agent_provider_timeout_45000ms`), con `claude-sonnet-5`, un model call, cero herramientas y coste registrado 0,015528 USD; no generó output ni dictamen. El intento anterior `84db253a-4879-41f9-8422-37e3bd59a9b9` quedó huérfano tras reiniciarse el watcher local por una edición en `apps/api/src`, así que no se usa como evidencia de timeout del proveedor. TEST sigue con 0 casos adjudicados/holdout certificados; la promoción permanece cerrada.

E2E autenticada A28 desde Klaviyo: run `e54d9d38-e218-4cae-b684-6c9ceba4f3a4`, output `af709953-ac71-4d14-9e0d-bf6fec86b932` en `pending_approval`; `gpt-6-luna`, 2 llamadas de modelo y 1 herramienta. Dictamen `6ec57319-8730-4f94-a96f-2769158a08dd`, `judge-rubrics-v2`, `review` 2,83/4, 11.787 ms y coste de juez de 0,002902 USD. El resultado no recomienda diseñar flujos porque el inventario, los volúmenes elegibles y la audiencia no están disponibles; propone verificar conexión/cobertura y no afirma que la ausencia del inventario demuestre ausencia de flows. No se realizó ningún cambio en Klaviyo. La cobertura live alcanza 15/26 perfiles y las E2E HTTP autenticadas 11/26; sin gold/holdout adjudicado.

## Rúbrica A05 v2 y promoción bloqueada hasta nueva certificación (12-oct-2026)

El caso HTTP real de A05 produjo `review` 2,18/4 con iniciativas vacías; el juez identificó falta de calendario, pero interpretó erróneamente que España y `America/New_York` se contradicen. La tienda conserva la zona IANA `America/New_York`; el mercado indicado solo determina las fechas comerciales. La rúbrica v2 ahora separa estos conceptos, juzga la hora contra la zona configurada y evalúa si una restricción de inventario permite proponer preparaciones/acciones condicionales sin forzar campañas inseguras. Se versionaron `judge-rubrics-v2` y el dataset `judge-gold-v2`; etiquetas v1 quedan aisladas.

`20261220100000_agent_judge_rubric_v2_release_gate.sql` está aplicado y registrado en TEST y producción. El gate SQL acepta únicamente certificación holdout v2 y dictamen candidato v2 ligado al SHA-256 exacto. Ambos entornos verifican la definición remota; hoy tienen 0 certificados holdout v2 y las promociones siguen cerradas. No cambia el recuento de ejecuciones: 13/26 perfiles con dictamen live, 9/26 con una ruta E2E HTTP autenticada, 0 gold/holdout adjudicados.

## E2E real A04 Generador de tareas con dictamen en TEST (12-oct-2026)

Se invocó el runner de producción del agente A04 con la membresía, organización y tienda existentes en TEST. Run aae67b0d-18b9-4a36-914a-c73dcedf3ac5: succeeded. Output 4eb57055-3555-458d-9715-6ff3a9bf1a59: pending_approval, approval_required=true. El juez real persistió aa11e1a0-0bf4-49ee-a320-66ee3c5000e5 con estado review y 2,59/4 usando gpt-6-luna; 18.785 tokens de entrada, 1.468 de salida, 11.565 ms, coste estimado 0,002613 USD. La propuesta no se aprobó y no se materializaron tareas. AI_JUDGE_MODE=visible se usó solo en memoria para esta llamada de prueba; no se activó el modo global.

La solicitud HTTP sin token contra la ruta A04 devolvió 401 missing_bearer_token. Por ello, esta prueba verifica generación, juicio y persistencia con el runtime real, pero no autentica el handler HTTP. La ejecución autenticada sigue pendiente. TEST registra 12/26 perfiles con dictamen: A04, A05, A13, A14, A15, A16, A17, A19 Arquitecto, A20, A21, A22 y A26. Gold/holdout adjudicado sigue en 0.

## Estado acumulado tras A06, A19 Revisión y A27 (13-oct-2026)

Conteo vigente de TEST: **16/26** perfiles distintos con dictamen, **12/26** rutas E2E autenticadas y **0** casos gold/holdout adjudicados. Los registros de ejecución no equivalen a aprobación de salida. A06 ejecutó la previsión desde Shopify y obtuvo dictamen `review` (2,95/4); detectó omisiones de productos con stock potencialmente bajo y una discrepancia entre ventana de 30 días y días con ventas. A19 Revisión sigue sin E2E porque no hay plan activo con el mismo store disponible en el selector ni una revisión semanal reintentable. A27 sigue sin E2E: su acceso visual no es estable y no hay brief visible verificable para invocar la ruta. Ver detalles en `docs/ESTADO_IMPLEMENTACION_JUEZ.md`.

## Estado acumulado tras A24, A23 y A25 (13-oct-2026)

Recuento vigente recalculado sobre las **26 definiciones activas** de TEST: **19/26** perfiles con dictamen persistido, **15/26** con ejecución HTTP autenticada y **0** casos gold/holdout adjudicados. De esos 19 dictámenes, **3 son `no_evaluable`**, así que no cuentan como evaluaciones de calidad aprobatorias. A24 (`1ec114f1-f5e9-41cf-8d60-0fa061869c41`) tuvo `review` 3,14/4 por atribuir estados stale no presentes en la evidencia; A25 (`519947ca-3dd2-4539-8ce8-0c4de88bae3b`) tuvo `review` 2,39/4 por omitir actividad reciente y no verificar el alcance de una tarea compartida; A23 (`a4b7a632-29a8-4347-8e2b-995d0c8280c9`) fue `no_evaluable` porque no se adjuntaron bytes/render visual. Los outputs permanecen sujetos a revisión humana y no se ejecutaron cambios en Meta. El detalle de criterios y defectos está en `docs/ESTADO_IMPLEMENTACION_JUEZ.md`.

Reejecución A23 HTTP autenticada TEST: run `608718c6-dd1b-4f5e-b7fd-071814c22a6b`, output `dfacab5f-9d00-4a0c-b2f2-fd18ff443aff` en `pending_approval`, juicio `review` 2,62/4 con seis criterios evaluados y evidencia visual no evaluable (0 bytes); coste del juez 0,002587 USD. No cambia el número de perfiles distintos: 19/26 con juicio, 15/26 con E2E autenticadas y 0 holdout gold adjudicados. La salida recibió evaluación útil de métricas; quedó en revisión por una atribución de falta de creatividad a un anuncio que no figura en el muestreo visual y por ausencia de `runtime_scope` en recibos. El contrato correcto impide `passed` mientras no se evalúe la dimensión crítica visual.

## A23 E2E v5 y trazabilidad de tool_use rechazados (13-oct-2026)

Run autenticado `3478e1a6-4167-4370-baf1-ccee52bcad98`: `succeeded`, 6 tool_use y 6 recibos; cuatro argumentos `meta_creative_diagnostics` rechazados por `invalid_tool_input` quedaron persistidos como error sanitizado. Se confirma y corrige el motivo técnico del antiguo 4/2: el parser retornaba antes del insert. El dictamen v5 `review` 2,84/4 acepta el snapshot como evidencia de cifras descriptivas y deja visual no evaluable sin bytes. Hallazgo que sigue abierto en el agente: cubre tres anuncios con una decisión agregada, pero omite decisiones individuales para dos IDs.

La capa de presentación del juez genera ahora `summary` a partir de los criterios adjudicados, porque el texto libre del modelo anterior contradecía su propio criterio factual. Suite AI 15/15, suite API 28/28, typecheck API y build AI pasan. El gate v5 continúa cerrado por 0 casos gold/holdout adjudicados.

## Recuento autoritativo actualizado (13-oct-2026, TEST)

Consulta directa a `agent_run_judgments`: **63 dictámenes persistidos en 20/26 códigos**. Los seis códigos sin ningún dictamen son A01, A02, A08, A11, A19 Revisión y A27. Hay 26/26 rúbricas de dominio y 81 IDs de criterio únicos, pero el conteo de dictámenes incluye estados de error/no evaluable/review y no equivale a cobertura certificada. `agent_judge_eval_cases` tiene 0 filas; gold/holdout adjudicado: **0**. El gate de promoción permanece cerrado.

Este recuento reemplaza los acumulados anteriores 16/26 y 19/26 de esta matriz. La cantidad de rutas E2E HTTP autenticadas no se infiere de dictámenes; debe mantenerse como métrica separada y volver a contarse desde evidencia HTTP por run.

## A27 live y rúbrica v6 (13-oct-2026)

La ruta HTTP autenticada de A27 ya está probada: run `93910949-0f4a-4d40-b530-081181b8f839` succeeded; output pendiente de aprobación, juicio v5 `review` 2,90/4. La propuesta conserva tres fechas, explica el conflicto del 20–21 de octubre y no genera borradores sin aprobación. La ejecución añade A27 a la cobertura observada: **21/26 perfiles y 64 dictámenes**, con **0 casos gold/holdout**.

La revisión de este caso mostró dos falsos positivos de rúbrica: no hay `scheduled_for` por email porque la relación se expresa mediante `sequence_number → scheduled_dates[]`; `copy_brief` es una entrega planificada para A11, no copy final. Se actualizó la rúbrica a v6 y el gate asociado. El CTA de A27 quedó disponible siempre en Marketing → Campañas, incluso con campañas/piezas pendientes. Migración v6 aplicada en TEST y producción; ambos verificadores OK y dry-run de migraciones sin pendientes. AI 260/260, API focalizada 28/28, build AI y typecheck web correctos. Sin código desplegado a producción ni referencias adjudicadas; el gate continúa cerrado.

## A11 TEST y recuento posterior (13-oct-2026)

Ejecución HTTP autenticada: run `a8fdcc0c-8f8c-4e4c-bea4-a8f21a2c6da3` `succeeded`; output `d3db5497-9f52-4481-99ef-feb572a3ebe5` `pending_approval`; juicio v6 `8ebc3f35-aa5a-4881-94cf-c77eb683cb96` `review`, 2,58/4, siete criterios, 0,001199 USD y 12.829 ms. El worker se recuperó tras un error transitorio y el job terminó `completed`. No se aprobó ni envió el borrador.

Hallazgos: placeholders legales/comerciales sin resolver; posible claim de temporada no sustentado; evidencia de catálogo insuficiente en el paquete del juez. TEST demuestra que el ID de tienda del brief es `integration_connections.id` y el recibo usa el `shopify_stores.id` asociado a esa conexión; el juicio no disponía del crosswalk explícito. El código ahora añade esa relación al snapshot y evidencia acotada de catálogo. También corrige el rechazo de salida por tono largo y enlace inválido mediante normalización segura antes de validación estricta; los links inválidos se eliminan de bloques y HTML y se reportan como warning. AI **261/261** y build API correctos.

Recuento autoritativo TEST tras esta prueba: **66 dictámenes / 22 de 26 códigos** (A01, A02, A08 y A19 Revisión siguen sin dictamen). Estados: 6 `passed`, 43 `review`, 8 `no_evaluable`, 9 `error`. El número de `passed` no acredita calidad global: hay **0 casos gold/holdout adjudicados** y el gate continúa cerrado. Código de esta tanda sin desplegar a producción.
