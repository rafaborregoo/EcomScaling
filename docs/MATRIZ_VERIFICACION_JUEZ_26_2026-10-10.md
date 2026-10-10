# Matriz de verificación del juez: 26 entradas de catálogo

**Fecha de corte:** 10 de octubre de 2026  
**Fuentes primarias:** `packages/ai/src/agent-eval-catalog.ts`, `packages/ai/src/agent-evals.ts`, `packages/ai/src/agent-judge.ts`, `packages/ai/src/live-eval-contract.ts`, `apps/api/src/agent-judge-runtime.ts`, `apps/api/src/agent-release-candidate-eval.ts`, `apps/api/src/agent-release-eval-fixture.ts` y `apps/api/src/ai-runtime.ts`.

## Cómo leer el estado

- **Rúbrica estática:** el código tiene criterios comunes (evidencia, alcance/privacidad, incertidumbre y seguridad/control humano) más los criterios de dominio indicados. Esto solo prueba cobertura declarada, no calidad del juez.
- **Juez de producción en código:** el runtime común o específico invoca `judgePersistedAgentOutput`; el modo por defecto es `off`. La presencia del call site no demuestra que esa ruta concreta se haya ejecutado ni que esté desplegada.
- **Runner candidate-pinned:** se carga una versión exacta y se ejecuta el candidato con un fixture validado y herramientas replay sin efectos laterales. El proveedor actual admite únicamente schema `v1` y no evalúa agentes visuales. `no_evaluable` nunca cuenta como aprobación.
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
| A15 `a15_analista_imagenes` | `visual_accuracy` (crítico), `visual_inference`, `asset_lineage` (crítico) | **No evaluable**: agente visual excluido del proveedor candidate-pinned actual | Adjuntar bytes originales verificables y probar binding de imagen, hash, versión y salida |
| A16 `a16_texto_sobre_imagen` | `copy_brief`, `render_readability` (crítico), `carousel_consistency` | **No evaluable**: agente visual excluido; JSON de copy no sustituye PNG render ni slides vecinos | Adjuntar render final y vecinos con hash; caso adversarial de legibilidad/carrusel |
| A17 `a17_plan_semanal` | `weekly_priority`, `task_measurability`, `backlog_coverage` (crítico) | Texto v1 disponible. Docs anteriores reportan un juicio real de prueba A17; eso no es calibración ni certificación | Reproducir juicio bajo manifest actual y reunir gold/holdout adjudicados |
| A18 `a18_plan_mensual` | `monthly_direction`, `monthly_measurement`, `capacity_and_handoff` | Texto v1 disponible | Casos adjudicados de capacidad, baseline y solape A17/A04 |
| A19 `a19_arquitecto_camino` | `goal_economics` (crítico), `roadmap_logic`, `cross_app_context`, `feasibility` | **Ejecutable con contrato Camino especializado**: `caminoPlanJsonSchema` + `caminoPlanSchemaForHorizon`; el fixture fija `horizon_months` y `reference_date`. | La prueba actual confirma la selección del contrato y fail-closed si faltan horizonte/fecha; falta ejecución candidata E2E y gold/holdout adjudicados. |
| A19 `a19_revision_camino` | `progress_measurement` (crítico), `goal_drift`, `revision_safety` (crítico) | **Contrato especializado conectado**: `caminoWeeklyReviewJsonSchema` + `caminoWeeklyReviewSchema`; fixture fija Camino aprobado/versionado, ventana, progreso, snapshot, fuentes métricas y revisión anterior. | Pruebas de contrato pasan; falta ejecución real con proveedor candidato, casos humanos gold/holdout y certificación. |
| A20 `a20_retencion_clientes` | `cohort_integrity` (crítico), `retention_interpretation`, `intervention_fit` | Texto v1 disponible | Casos adjudicados con cobertura CRM, cohortes pequeñas y consentimiento |
| A21 `a21_adquisicion_shopify` | `acquisition_attribution` (crítico), `unit_economics` (crítico), `channel_comparison` | Texto v1 disponible | Casos adjudicados con cobertura de fuente, CAC/CPA y ventanas incompatibles |
| A22 `a22_postventa_shopify` | `delivery_scope` (crítico), `delivery_evidence`, `customer_action` | Texto v1 disponible | Casos adjudicados con eventos ausentes, devoluciones y datos personales |
| A23 `a23_creatividad_meta` | `creative_decision`, `visual_evidence` (crítico), `performance_separation` | **No evaluable**: agente visual excluido del proveedor candidate-pinned actual | Ingesta y binding de captura real por anuncio/periodo; evaluación visual con bytes |
| A24 `a24_medicion_meta` | `measurement_status` (crítico), `signal_diagnosis`, `downstream_guard` (crítico) | Texto v1 disponible | Casos adjudicados de `unknown`, sin actividad, RPC fallido y bloqueo de claims downstream |
| A25 `a25_cambios_meta` | `change_history` (crítico), `before_after`, `action_approval` (crítico) | Texto v1 disponible | Casos adjudicados con RPC no disponible, ventanas inmaduras y aprobaciones |
| A26 `a26_contenido_email` | `email_content`, `render_evidence` (crítico), `delivery_performance` | **No evaluable**: agente visual excluido del proveedor candidate-pinned actual | Render desktop/mobile vinculado al HTML y envío exactos; capturas con hash verificable |
| A27 `a27_planificador_mailing` | `calendar_strategy`, `rag_method`, `performance_learning` (crítico), `planning_boundary` (crítico) | Texto v1 disponible | Casos adjudicados de fechas/zonas horarias, RAG privado, fatiga y frontera de “planificar solamente” |
| A28 `a28_arquitecto_flujos` | `flow_evidence` (crítico), `flow_eligibility` (crítico), `flow_design` | Texto v1 disponible | Casos adjudicados con consentimiento, elegibilidad, trigger y medición holdout |

## Dictamen cuantificado de cobertura

| Medida | Resultado comprobable | Interpretación |
|---|---:|---|
| Entradas del catálogo y rúbricas | 26/26 | La prueba `packages/ai/src/agent-judge.test.ts` compara las claves con el catálogo y valida criterios; no demuestra calibración. |
| Rúbricas con criterios de dominio | 26/26 | Hay 4 criterios comunes más 3–4 criterios específicos por perfil. A19 cuenta como dos perfiles independientes. |
| Contratos soportados por el candidate-runner | 22/26 | Contratos v1 no visuales más contratos especializados de A19 Arquitecto y A19 Revisión. La suite de contrato no equivale a certificación. |
| No evaluables en candidate-runner | 4/26 | A15, A16, A23 y A26; falta evidencia visual adjunta en bytes/render ligada a los artefactos. |
| Agentes con gold/holdout suficiente y calibración certificada | 0/26 | El estado documentado del dataset es 0 holdout y 0/26 sobre el mínimo estadístico. |
| Integraciones de juez desplegadas y modo visible | 0 verificadas en este corte | El modo por defecto es `off`; la matriz anterior dice que el código no está desplegado. Se necesita prueba de entorno/runtime para cambiar este estado. |

## Qué pruebas existen y qué no prueban

- `packages/ai/src/agent-judge.test.ts`: estructura/cobertura de rúbricas y casos unitarios de A05/A16; no evalúa modelos sobre casos humanos.
- `packages/ai/src/live-eval-contract.test.ts`: validación del contrato live, pinning de candidato, salida exacta, juez y evidencia; no garantiza que cada ruta funcional del producto invoque correctamente la evaluación.
- `apps/api/src/agent-release-candidate-eval.test.ts`: candidato con schema v1, hash/manifest, aislamiento del contexto y casos no evaluables; no completa schemas v3 ni imágenes.
- `apps/api/src/agent-judge-runtime.test.ts`: runtime persistido y modos del juez; las pruebas mockeadas no acreditan llamadas de proveedor de cada agente en TEST/prod.
- `docs/ESTADO_IMPLEMENTACION_JUEZ.md`: recoge los gates de DB, ejecución y conteos de gold/holdout. Las entradas históricas allí deben leerse por fecha; prevalece la sección con la fecha de corte más reciente.

## Bloqueos para cierre del objetivo

1. Implementar y verificar el paso de evidencia visual ligada a bytes para A15/A16/A23/A26.
2. Añadir pruebas E2E por ruta de producto que demuestren la invocación del juez y la relación exacta entre artefacto, recibos, run y tenant; cubrir especialmente streaming A09 y generación con artefactos A11/A15/A16.
3. Recoger casos anonimizados revisados por privacidad; etiquetado doble independiente y adjudicación; alcanzar el suelo estadístico ya definido para cada agente y congelar un holdout de un solo uso.
4. Ejecutar calibración real con el modelo y versión de rúbrica candidatos, analizar desacuerdos por criterio/segmento y obtener el gate cuantitativo.
5. Ejecutar la suite candidate-pinned con manifiestos actuales y evidencias gold/holdout; demostrar costes/latencias reales, persistencia y rechazo de cualquier caso incompleto.
6. Verificar despliegue y `shadow` autenticado en entorno de prueba antes de cualquier activación visible; mantener cerrado el gate hasta completar lo anterior.

**Conclusión:** hay cobertura de catálogo y rúbricas estáticas completa; el runner contiene contratos candidate-pinned parciales para 22 entradas; no hay certificación completa. “26/26 rúbricas” no debe comunicarse como “juez validado en 26 agentes”.

## Actualización de cobertura candidate-pinned

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

