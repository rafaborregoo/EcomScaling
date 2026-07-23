# Estado global

> Matriz operativa. Formato de estado y evidencia definido en
> [`ESTADOS_Y_EVIDENCIA.md`](ESTADOS_Y_EVIDENCIA.md) — no se acepta "completado" sin la evidencia
> correspondiente. Actualizar esta tabla y el bloque de detalle al cerrar o reabrir una fase.
> **Ultima auditoria completa de estados: 2026-07-20.** Actualizaciones parciales posteriores (filas y
> secciones individuales, no una relectura completa del documento): 2026-07-21, 2026-07-22 — ver la fecha
> dentro de cada fila/nota para lo que realmente se revalido y cuando.

## Release activo

**Pre-piloto: consolidacion Shopify + IA en shadow mode (equivalente a F7-F10 del roadmap maestro).**
Corregido 2026-07-20: llamarlo "post-MVP" era prematuro — no hay piloto formal todavia (OPS-01 sigue
`planned`) y no existe staging ni runbooks. Los gaps de webhooks de privacidad de Shopify y `audit_logs`
sin conectar (senalados el 2026-07-20) ya tienen codigo (mismo dia, ver R-010/R-013/SQO-02/SQO-03); sigue
faltando observabilidad con correlacion por organizacion. Shopify end-to-end + motor financiero +
alertas/tareas + agentes A02/A04/A06/A08/A09 funcionan sobre datos reales en shadow mode (aprobacion
humana antes de escribir); el foco actual es cerrar deuda de verificacion y
gobernanza (ver P0 abajo) antes de considerar siquiera abrir el piloto formal.

**Nota de gobernanza (2026-07-20)**: los estados usados en la tabla de abajo (`blocked_external_validation`,
`shadow_pilot`, `pilot_ready`, etc.) no son parte de la taxonomia canonica de
[`ESTADOS_Y_EVIDENCIA.md`](ESTADOS_Y_EVIDENCIA.md) — son deuda documental reconocida y con ruta de
correccion definida ahi (separar `Estado real` canonico de un campo `Matiz`/`Tipo de bloqueador`). Migrar
esta tabla al formato correcto es tarea P1 pendiente, no completada en esta revision.

Ver [`RIESGOS.md`](RIESGOS.md) para riesgos abiertos y [`PREGUNTAS_ABIERTAS.md`](PREGUNTAS_ABIERTAS.md) /
[`ADR_LOG.md`](ADR_LOG.md) para decisiones pendientes y tomadas.

## Vista rapida

| Fase | Estado real | Responsable | Bloqueador | Siguiente accion |
| --- | --- | --- | --- | --- |
| DB-00 infraestructura | `verification_pending` | sin asignar | ninguno | Test de permisos de `private` anadido 2026-07-21. **Cerrado 2026-07-23**: verificadas y documentadas las 10 funciones `SECURITY DEFINER` reales (todas con `search_path = ''`) y el schema de ambas extensiones. |
| DB-01 enums core | `verification_pending` | sin asignar | ninguno | Test de drift anadido 2026-07-21. **Cerrado 2026-07-23**: semantica y transiciones de los 5 enums documentadas contra codigo real; hallazgo notable: `subscription_status` no tiene ningun endpoint de escritura hoy (pensado para facturacion futura), `notification_status` nunca se marca `read`/`archived` (accion de UI sin implementar). |
| DB-02 auth/multitenant/RLS | `verification_pending` | sin asignar | ninguno | Escritura cross-tenant, enlaces cross-org y suspension en caliente ya probados 2026-07-21 (17/17). **Cerrado 2026-07-23**: Storage confirmado sin uso (nada que probar); RPC si esta en uso (7 funciones de metricas) -- las 7 (`shopify_sales_summary`, `shopify_financial_summary`, `shopify_top_products`, `shopify_stock_summary`, `shopify_margin_summary`, `shopify_stock_risk_products`, `meta_spend_summary`) tienen ahora test real de aislamiento cross-tenant (8/8), confirmando que `security invoker` + RLS protege incluso pidiendo el `target_organization_id` de otra org a mano con datos reales sembrados (producto, stock, margen, gasto de Meta). |
| DB-03 configuracion financiera | `verification_pending` | sin asignar | ninguno | Invariante de escala 0-100 documentado 2026-07-21; `calculation_version`/golden tests siguen pendientes (cambio de diseño, no verificacion). |
| DB-04 integraciones comunes | `verification_pending` | sin asignar | ninguno | Idempotencia de webhooks bajo concurrencia probada 2026-07-21. **Cerrado 2026-07-23**: cifrado documentado (AES-256-GCM, IV unico por fila, sin envelope encryption/rotacion real pese al campo `encryption_key_version`); locking de refresh de tokens ya estaba implementado (claim optimista con CAS) y ahora tiene test real de concurrencia (`db-04-token-refresh-claim.test.ts`, exactamente un claim gana). |
| DB-05 Shopify vertical slice | `verification_pending` | sin asignar | ninguno | Reconciliacion real ejecutada 2026-07-22 (productos exacto, pedidos con diferencia explicada). **Cerrado 2026-07-23**: tolerancia formalizada -- products/customers deben dar diff 0, orders puede dar local > shopify solo si se explica por la restriccion de 60 dias de `read_orders` sin `read_all_orders`; `local < shopify` en cualquier dataset es alarma real. |
| DB-06 Meta Ads | `blocked` | sin asignar | credenciales/App Review de Meta | Sin accion posible hasta aprobacion de Meta. |
| DB-07 alertas/tareas/plan | `verification_pending` | sin asignar | ninguno | Trigger anti-enlace-cruzado ya probado 2026-07-21. **Cerrado 2026-07-23**: SLA de overdue formalizado (badge "Vencida" en `/tareas`, verificado en navegador real). **Tambien cerrado el mismo dia**: cooldown/suppression window documentado -- no hay debounce explicito en codigo, pero el cron `alert-rules.yml` (cada 6h) actua como cooldown de facto; dedup por `fingerprint` evita duplicados dentro de una misma evaluacion. |
| DB-08 llamadas + runtime agentes | `in_progress` | sin asignar | ninguno | Tests de alucinacion (A01) y de publicacion de resumenes ya existian/anadidos 2026-07-21; falta politica de retencion de PII de transcripciones. |
| DB-09 Klaviyo | `planned` | sin asignar | ninguno (no iniciado) | Definir contrato (API revision, metrica de conversion primaria) antes de migrar. |
| DB-10 Instagram | `planned` | sin asignar | credenciales Meta/Instagram | Igual que DB-06: sin accion hasta credenciales. |
| DB-11 RAG / conocimiento IA | `verification_pending` | sin asignar | ninguno | Test de aislamiento cross-tenant anadido y confirmado 2026-07-21. **Cerrado 2026-07-23**: dataset de recall@k anadido y corrido real contra Voyage -- recall@8 y recall@3 ambos 6/6 (100%) sobre 6 documentos y consultas parafraseadas, ver AI-04. |
| BE-00 fundaciones API/worker | `in_progress` | sin asignar | ninguno | Dockerfiles anadidos 2026-07-22 (sin build-test real, no hay Docker en este entorno). **Cerrado 2026-07-23**: `/health/live` y `/health/ready` anadidos (readiness pinga GoTrue de Supabase + Redis si esta configurado, 503 si degrada), verificado en vivo contra el dev server real incluyendo el escenario de fallo forzado. Corregido tambien un bug real de shutdown encontrado escribiendo un test de BE-01: el Redis de rate-limit no se desconectaba y `app.close()` colgaba indefinidamente. Falta escaneo de dependencias en CI y auditoria completa de `SIGTERM` (drenado de requests en vuelo). |
| BE-01 identidad/tenancy | `verification_pending` | sin asignar | ninguno | Test de suspension de consultor en caliente anadido 2026-07-22. **Cerrado 2026-07-23**: test de organizacion manipulada anadido (`be-01-cross-tenant-route-manipulation.test.ts`, servidor Fastify real via `buildApp()`+`app.inject`, 5 endpoints de negocio, 10/10 pasan). De paso corregido un bug real de shutdown (Redis de rate-limit no se desconectaba, `app.close()` colgaba). Falta revisar diseno de "memberships virtuales" (decision de arquitectura, no bloqueante). **Correccion 2026-07-22**: si existe API para gestionar memberships/consultant_assignments (`upsertOrganizationMember`/`upsertConsultantAssignment` en `consultant.ts`, ya auditadas) -- una nota anterior lo negaba por error de grep sobre el nombre de tabla equivocado, corregido de paso un bug real de tipos encontrado en el camino (`invited_at`/`joined_at` no se preservaban en ediciones). |
| BE-02 integrations core | `planned` | sin asignar | ninguno | Redactar contratos concretos (maquina de estados OAuth, retry, circuit breaker) antes de tratarlo como implementable. |
| BE-03 Shopify metricas | `in_progress` | sin asignar | ninguno | Dividir en connector/worker/motor financiero/API y documentar formula exacta por KPI. |
| BE-04 Meta adquisicion | `blocked_external_validation` | sin asignar | App Review/business verification de Meta | Completar matriz de flujo y documentar action_type/atribucion mientras se espera. |
| BE-05 operaciones | `functionally_complete_verification_pending` | sin asignar | ninguno | Documentar que pasa si llega transcripcion nueva sobre un resumen ya aprobado (decision de producto, no de codigo). |
| BE-06 Klaviyo/stock/campanas | `planned_after_mvp` | sin asignar | DB-09 | Sin iniciar. |
| BE-07 AI runtime/RAG | `partial_security_and_quality_pending` | sin asignar | ninguno | `lock_timeout` y eval de cross-tenant anadidos 2026-07-22. **Cerrado 2026-07-23**: eval real de prompt injection documental (`eval-be07-prompt-injection.ts`) -- documento real con instruccion embebida, pregunta real al copiloto A09, llamada real al LLM: el modelo ignora el marcador inyectado, responde la pregunta real y advierte al usuario de la inyeccion. Falta el resto de evals de calidad (cita inexistente, contradiccion RAG vs DB, etc.). |
| FE-00 shell/design system | `current` | sin asignar | ninguno | **Ampliado 2026-07-23 (ADR-0013, peticion de Rafa)**: `packages/ui` dividido en un archivo por componente; sombra de `Combobox` y `rounded-sm` de `Pagination` eliminados; `usePaginatedUrl` migrado en `tareas`/`shopify/diagnostico`. Skip link y `<h2>` grandes de seccion eliminados por peticion explicita de Rafa. **Auditoria formal de accesibilidad con axe-core cerrada el mismo dia**: 3 hallazgos reales (heading-order en 6 paginas, listbox sin nombre + contraste 1.04:1 en el `Combobox` abierto, `document.title` duplicado) corregidos y verificados 2 veces en navegador real. Falta definir tokens canonicos mas alla de color y prueba manual con lector de pantalla. |
| FE-01 auth/onboarding | `functionally_minimal_gaps_confirmed` | sin asignar | ninguno | **Auditado 2026-07-22**: login email/password + redirect por rol funcionan; corregido gap real (cliente sin organizacion asignada veia dashboard en blanco sin explicacion, ya tiene `EmptyState`). Sin signup/recuperacion de contrasena propios (posible decision de producto, no declarada); sin maquina de estados de onboarding Shopify->financiero. |
| FE-02 dashboard | `functionally_complete_e2e_pending` | sin asignar | ninguno | `IntegrationAction`/`AccountAction` tipado (`@ecomscaling/contracts`) y responsive 375px auditado 2026-07-22; falta comparacion contra periodo anterior. |
| FE-03 tareas/alertas | `functionally_complete_verification_pending` | sin asignar | ninguno | **Cerrado 2026-07-22** (ver FE-03-tareas-alertas.md): corrigio 2 gaps reales de RLS -- `task_status_history` no respetaba `is_visible_to_client`, y `strategic_plans`/`_phases`/`_milestones`/`milestone_task_links` no distinguian `draft` de activo (tests en `rls-tenant-isolation.test.ts`). Paginacion de tareas anadida (`usePaginated`/`Pagination`) y **verificada en navegador real con Playwright** (25 tareas sembradas, login real, 2 paginas confirmadas visualmente, sin errores de consola). |
| FE-04 llamadas/Mi Camino | `functionally_complete_ux_validation_pending` | sin asignar | ninguno | Corregir descripcion de "deteccion Fathom" (no es integracion real); dividir documento. |
| FE-05 planificacion/retencion | `planned` | sin asignar | BE-06, DB-09 | Sin iniciar. |
| FE-06 consultor IA/contenido | `planned_contract_incomplete` | sin asignar | DB-10 (Instagram) | Corregido 2026-07-22: la diferenciacion visual de tipos de respuesta no aplicaba al copiloto (chat sin ese contrato), ya reforzada en `AiDiagnosticSection` que es donde si aplica. Sigue pendiente actualizar el documento y describir estados de error especificos. |
| FE-07 panel consultor | `in_progress_core_product` | sin asignar | ninguno | UI de restauracion de organizaciones/tiendas conectada 2026-07-22. **Matriz de acciones admin vs consultant documentada 2026-07-22**: dentro del panel el consultor solo tiene lectura, toda mutacion es `platform_admin`. **Correccion 2026-07-23**: la asimetria entre `decideAgentOutput`/`decideSummary` que esta fila dejaba como "revisar si es intencional" ya estaba cerrada el mismo 2026-07-22 (confirmado en codigo real: ambas exigen ahora `["platform_admin","consultant"]`, ver FE-07-panel-consultor.md) -- la nota de esta tabla habia quedado desactualizada, no el codigo. |
| FE-08 UI/UX | `in_progress` | sin asignar | ninguno | Responsive y accesibilidad de teclado del `Combobox` avanzaron 2026-07-22; `PortalShell` ya está protegido con `Suspense` y el build web local de producción pasa. **Auditoría formal con axe-core cerrada 2026-07-23** (ver FE-00) -- falta solo la prueba manual con lector de pantalla real. |
| INT-00 nucleo comun integraciones | `in_progress` | sin asignar | ninguno | Contrato TypeScript, catálogo de capacidades/flags y errores creado en `packages/integrations`; API/UI ya lo usan para Shopify/Meta/Klaviyo/Instagram y representan los conectores futuros sin datos ficticios. `IntegrationSyncAdapter` ya enruta los runners reales de Shopify y Meta. Suite aislada: 3 tests pasan. Falta completar OAuth/health/webhooks en `IntegrationAdapter` y tests contractuales. **Validado 2026-07-22** con typecheck, lint, build y 73 tests API + 3 de integraciones. |
| INT-01 integraciones (Shopify) | `pilot_ready` | sin asignar | ninguno (bloqueador externo: aprobacion de distribucion publica de Shopify) | **Cerrado 2026-07-22**: webhooks de privacidad deployados a Shopify, `app/uninstalled` reenviado a la tienda piloto, reconciliacion de conteos ejecutada (productos exacto, pedidos con diferencia explicada por ventana de 60 dias de la API, no un bug). |
| INT-02 integraciones (Meta Ads) | `blocked` | sin asignar | Meta App Review | Backoff verificado y hueco de paginacion cerrado 2026-07-22; falta documentar `canonical_purchase_action_type`. |
| INT-03 integraciones (Klaviyo) | `planned` | sin asignar | DB-09, BE-06 | Sin codigo todavia; reauditar `api_revision` de la guia de referencia antes de programar. |
| INT-04 integraciones (Loom/Fathom) | `in_progress` (Loom manual `done`, Fathom `planned`) | sin asignar | ninguno | Decidir modo de auth de Fathom (API key vs OAuth) antes de escribir codigo. |
| INT-05 integraciones (Instagram) | `planned` | sin asignar | INT-02 | Bloqueado por scopes de Meta: `META_SCOPES` hoy no pide `instagram_basic`/`instagram_manage_insights`. |

Nota de validacion INT-00 (2026-07-22): `deriveIntegrationHealth` ya alimenta API y UI con estados derivados
truthful (`healthy`, `syncing`, `degraded`, `stale`, `unknown`) sin datos simulados. Queda pendiente cablear
OAuth, health operativo y webhooks sobre el adaptador completo.

Correccion posterior INT-00 (2026-07-22): `apps/api/src/integration-adapters.ts` implementa ya el
`IntegrationAdapter` completo para Shopify y Meta, y las rutas OAuth/sync lo utilizan. Shopify incluye
verificacion y procesamiento de webhooks; Meta mantiene discovery real sin fabricar assets. Queda pendiente
solo la seleccion de activos como funcionalidad de producto y ampliar la migracion de errores locales.
| AI-00 contratos/runtime | `verification_pending` | sin asignar | ninguno | Presupuesto real aplicado 2026-07-20 (R-011). Falta maquina de estados formal documentada y model routing. |
| AI-01 A01 llamadas | `pilot_ready` | sin asignar | ninguno | **Cerrado 2026-07-23**: reaprobacion ya distingue 409 `summary_already_decided` de 404 real (antes ambos daban 404), 3 tests nuevos. Sigue pendiente: fingerprint de dedup de tareas (hoy es titulo exacto normalizado, no detecta duplicados semanticos -- requiere decision de diseno, no solo codigo). |
| AI-02 A02 monitor | `shadow_pilot` | sin asignar | ninguno | Ya corre en evidence-pack puro desde v2 (correccion 2026-07-20, ver AI-02); validar con run real el contexto enriquecido. |
| AI-03 SQL Gateway | `verification_pending` | sin asignar | ninguno | **Cerrado 2026-07-23**: `WITH RECURSIVE` acotado y test de aislamiento tenant extremo a extremo anadido (ambos verificados). Queda `pg_sleep`/`generate_series` sin bloqueo explicito, no bloqueante. |
| AI-04 RAG | `live_validated_design_gaps_open` | sin asignar | ninguno (`VOYAGE_API_KEY` ya configurada en este entorno; falta solo en el secret de produccion, ver AI-07) | **Cerrado 2026-07-23**: retrieval real corrido por primera vez -- recall@8/recall@3 100% (6/6) con consultas parafraseadas sobre 6 documentos. Sigue sin probar en corpus grande/estructurado (chunking) ni con terminologia exacta (busqueda hibrida). |
| AI-05 especialistas | `in_progress` (por agente, ver detalle) | sin asignar | A03/A05/A07 bloqueados por Meta | Ver detalle abajo. |
| AI-06 evaluaciones | `foundational_work_in_progress` | sin asignar | ninguno | **Ampliado 2026-07-22**: dataset de A02 con 5 escenarios reales, `npm run eval:a02 -w @ecomscaling/api`, quality gates de coste/latencia. **Ampliado 2026-07-23**: dataset de A01, A06 y A08 anadidos (los 4 agentes de diagnostico ya tienen dataset propio). La eval de A08 encontro un hallazgo real: en 2/3 corridas el `answer` llego con un fragmento inicial corrupto que `checkOutputSanity` no bloqueaba -- **cerrado el mismo dia** (`hasIncoherentOpening`, 30/30 tests de `packages/ai`). **Dataset de A01 completado el mismo dia** con los 2 escenarios que faltaban (audio deficiente, varios interlocutores): 0 fallos hard, 15% soft (bajo umbral), coste $0.15. |
| AI-07 memoria acumulativa | `implemented_prod_secret_pending` | sin asignar | falta `VOYAGE_API_KEY` en el secret de produccion | **Implementado y validado end-to-end 2026-07-22**: migracion (`store_id`/`audience`/`origin`/`authority`/ciclo de vida en `knowledge_documents`, tablas `memory_ingestion_queue`/`client_constraints`, `knowledge_search` con `audience_allowed` obligatorio + `target_store_id`), outbox asincrono (`apps/api/src/memory-ingestion.ts`) cableado en `decideSummary`/`addTaskComment`/`decideAgentOutput`, cron `memory-ingestion.yml` cada 15 min, `client_constraints` inyectadas en A02/A04/A06/A09, prompt anti-injection en `search_knowledge`. `npm run validate:ai07 -w @ecomscaling/api` corrio el pipeline completo contra Supabase real: 9/9 checks pasan (encolar -> pending_indexing -> active con chunks -> filtrado de audiencia correcto -> idempotencia confirmada). Falta: `VOYAGE_API_KEY` en el secret de GitHub Actions/Vercel de produccion, y las "dos superficies" de `/conocimiento` (sigue siendo una tabla plana). |
| SQO-00 seguridad base | `verification_pending` | sin asignar | ninguno | Ampliada 2026-07-22: 71 tests reales en `apps/api` (60 base + 7 config. financiera/conexiones + 3 de RLS en `task_status_history` + 1 de un bug real de purga corregido, ver R-008/RB-008). Auditada integridad FK cross-tenant (ya protegida en Node). Rate limiting anadido en los 6 endpoints de IA + limite global (`@fastify/rate-limit`, Redis-backed). Falta: `REDIS_URL` en produccion para que el rate limit sea centralizado. |
| SQO-01 testing | `in_progress` | sin asignar | ninguno | **`npm run lint` anadido a CI 2026-07-22**: los 12 errores `react-hooks/set-state-in-effect` eran una sola causa raiz (patron estandar fetch-on-mount sin alternativa estable hoy), regla bajada a warning en `apps/web/eslint.config.mjs` con justificacion documentada; CI ahora bloquea typecheck+lint+tests+build. |
| SQO-02 observabilidad | `in_progress` | sin asignar | ninguno | Correccion 2026-07-20: Fastify/pino + `createLogger` ya existian. **2026-07-22**: alertas operativas anadidas (`ops-health-check.yml`, cron cada 2h -> issue de GitHub); ya encontro un hallazgo real (token Shopify offline con `expires_at` pasado). `organization_id` en logs de Fastify cerrado el mismo dia. **`user_id` cerrado 2026-07-23**: mismo hook, extrae `sub` del JWT sin verificar (solo para logs, no autorizacion), verificado en vivo. **`organization_id` en `createLogger` (worker/cron) cerrado el mismo dia**: auditados 46 usos reales en 13 archivos, solo 7 lo llevaban; 21 mas corregidos en shopify-sync/webhooks/meta-sync/meta/memory-ingestion/audit-log/consultant/ai-runtime, 105/105 tests pasan. Falta metricas agregadas, error tracking/APM (herramienta de pago). |
| SQO-03 privacidad/auditoria | `in_progress` | sin asignar | ninguno | `audit_logs` conectado 2026-07-20 a las escrituras mas sensibles. **2026-07-22**: configuracion financiera cubierta (`financial-config.ts`, 5 escrituras). Membresias/asignaciones de consultor SI estaban ya cubiertas (`upsertOrganizationMember`/`upsertConsultantAssignment`, `consultant.ts`) -- una nota anterior de esta misma tabla lo negaba por error de grep, corregido. Falta politica de retencion. |
| OPS-00 entornos/CI-CD | `in_progress` | sin asignar | ninguno | **Corregido 2026-07-22**: `apps/api`/`apps/web` ya estan en produccion en Vercel (verificado); Q-001 (VPS/contenedor dedicado) pausada, no bloqueante -- `apps/worker` no tiene uso real, su unica cola la cubren los cron de GitHub Actions. Sigue sin staging separado (R-015 cerrado, no activo: aceptado que Vercel preview + cron cubren la necesidad real hoy). **Politica de migraciones escrita 2026-07-23** (`ADR-0014-migration-policy.md`). Sin matriz de secrets por entorno. |
| OPS-01 piloto MVP | `planned` | Rafa (soporte) | ninguno tecnico | 9 de 10 criterios de entrada al Piloto 1 ya cumplidos (soft-delete, reconciliacion Shopify con desviacion explicada, webhooks de privacidad deployados a Shopify, `app/uninstalled` reenviado a la tienda piloto, runbook de sync fallido, RLS ampliado a config. financiera y conexiones, alertas operativas via GitHub Issues, responsable de soporte (Rafa), staging reevaluado -- Vercel prod + GitHub Actions cron ya cubren la carga real -- todos cerrados 2026-07-22). Falta 1: backup restaurado al menos una vez (mecanismo ya implementado, drill pospuesto a proposito hasta que haya datos de produccion reales, ver R-016). |
| OPS-02 runbooks/soporte | `in_progress` | sin asignar | ninguno | 5 runbooks reales (RB-001/002/006 de 2026-07-20 + RB-007 backup/restore + RB-008 purga fallida, ambos 2026-07-22). **Ampliado 2026-07-23**: RB-003 fuga cross-tenant, RB-004 webhook duplicado/backlog y RB-005 migracion fallida anadidos (8 en total, ya no falta ninguno de los runbooks planeados). RB-005 encontro un hallazgo real (no hipotetico): 10 migraciones locales tienen drift de version contra `list_migrations` del proyecto real -- correccion en si bloqueada por el clasificador de auto-mode, pendiente de autorizacion de Rafa. **Checklist semanal de salud por cliente anadido** (`CHECKLIST-SALUD-CLIENTE.md`, sobre las senales ya existentes del score de FE-07). Falta solo el drill de restauracion real de RB-007, pospuesto a proposito al final del programa (decision de Rafa). |

## Detalle por dominio

### Base de datos (DB-00 a DB-11)

Ver estado detallado (evidencia, gaps, siguiente accion) en la cabecera de cada
`roadmap/roadmaps/01-base-de-datos/fases/DB-XX-*.md` — todas siguen ahora el formato de
`ESTADOS_Y_EVIDENCIA.md`. Resumen de lo mas relevante:

- **DB-02 (auth/multitenant/RLS)**: 11/11 tests de aislamiento pasan (`node --test
  apps/api/src/rls-tenant-isolation.test.ts`, verificado 2026-07-20) cubriendo lectura cross-tenant,
  consultor asignado/no asignado, platform_admin, y visibilidad de salidas IA. **No** cubren: intentos de
  insert/update cross-tenant, acceso directo via REST/RPC fuera de la API Node, ni Storage. Por eso el
  estado real es `verification_pending`, no `done`.
- **DB-03 (financiero)**: la migracion real (`20260717160000_db_03_configuracion_financiera.sql`) ya
  tiene CHECK de rango en porcentajes (escala 0-100, no 0-1), formato de moneda ISO, importes no
  negativos y `valid_until > valid_from` — mejor de lo que sugeria el snapshot conceptual. Falta
  versionado (`calculation_version`) y golden tests numericos documentados.
- **DB-04 (integraciones comunes)**: `verification_pending`, no `blocked` — texto corregido 2026-07-22
  (esta seccion seguia describiendo un estado de 2026-07-20 que la propia tabla rapida de arriba ya habia
  actualizado). El test real de concurrencia (`db-04-webhook-idempotency.test.ts`, dos peticiones
  identicas en paralelo, confirmado 2026-07-21) ya demuestra idempotencia del efecto de negocio para
  webhooks. Sigue faltando: maquina de estados de webhook explicita mas alla de
  `received/processed/failed`, y el diseño de cifrado de `integration_credentials`.
- **DB-05 (Shopify)**: `shopify_customers` si existe en las migraciones reales
  (`20260715200000_db_06_shopify_customers.sql`) aunque el snapshot conceptual no la reflejaba — la
  incoherencia estaba en el documento/snapshot, no en el esquema real. **Reconciliacion ya ejecutada
  2026-07-22** (texto corregido; esta seccion seguia sin reflejarlo aunque la fila de INT-01 mas abajo en
  este mismo documento ya lo documentaba): productos 11/11 exacto, pedidos 363 local vs 341 en Shopify con
  la diferencia de 22 explicada por la ventana de 60 dias de la API sin `read_all_orders` (`shopify-count-reconcile.ts`).
  **Tolerancia formalizada 2026-07-23** en DB-05: `products`/`customers` deben reconciliar exacto,
  `orders` puede dar `local > shopify` solo si se explica por antiguedad >60 dias (confirmado que
  `SHOPIFY_SCOPES` no incluye `read_all_orders`); `local < shopify` en cualquier dataset es alarma real.
- **DB-11 (RAG)**: la migracion real y la documentacion de fase coinciden en `vector(1024)` (Voyage
  `voyage-3.5`). Era el `schema_conceptual_snapshot.sql` retirado el que declaraba `vector(1536)`
  incorrectamente — la incoherencia estaba en el snapshot, no en el esquema real ni en la doc.

### Backend/API (BE-00 a BE-07)

- **BE-01**: el diseno de "memberships virtuales" (materializar `consultant_assignment` como si fuera un
  membership) funciona pero mezcla dos fuentes de acceso distintas bajo una misma forma. Se recomienda
  migrar el contrato de `AuthContext` a un tipo `OrganizationAccess` con `accessSource: "membership" |
  "consultant_assignment" | "platform_admin"` explicito en vez de perpetuar la membership sintetica —
  pendiente de decision (ver `PREGUNTAS_ABIERTAS.md`).
- **BE-02**: documento de intenciones, no de contrato. No se declara `done` hasta que tenga maquina de
  estados OAuth, almacenamiento/rotacion de credenciales, retry/circuit breaker y evidencia de tests.
- **BE-03**: mezcla el conector Shopify y el motor financiero en un solo documento. Recomendado dividir
  en BE-03A (conector), BE-03B (worker de sync), BE-03C (motor financiero), BE-03D (API de dashboard).
- **BE-04/05**: implementados y con endpoints reales; BE-04 no puede validarse end-to-end hasta que Meta
  apruebe la app (bloqueador externo, no de codigo) — reclasificado `blocked_external_validation` en vez
  de "parcial" para dejar claro que el nucleo local puede estar hecho pero el vertical slice no.
- **BE-06**: agrupa 5 sistemas sin relacion tecnica directa (Klaviyo conector, Klaviyo reporting, forecast
  de stock, planificacion de campañas, webhooks Fathom); recomendado dividir antes de especificar.
- **BE-07 (SQL Gateway)**: verificado en codigo real — doble capa (validacion AST en Node + `ai` schema
  con `statement_timeout=8000ms`, `search_path` fijo, `LIMIT` forzado, `security definer`). Gap real
  encontrado: `"with recursive"` esta explicitamente permitido en el validador, un CTE recursivo mal
  formado podria agotar el timeout en vez de fallar rapido de inmediato. Sin evals adversariales
  (cross-tenant, prompt injection, SQL invalido) todavia.

### Frontend/UX (FE-00 a FE-08)

Ver estado detallado por fase en cada `roadmap/roadmaps/03-frontend-ux/fases/FE-XX-*.md`. Historial
cronologico completo (antes disperso dentro de FE-08) movido a
[`../03-frontend-ux/CHANGELOG-UX.md`](../03-frontend-ux/CHANGELOG-UX.md); decisiones estructurales
extraidas a ADRs (`docs/decisions/ADR-0009-role-based-navigation.md`,
`docs/decisions/ADR-0010-global-client-store-context.md`).

- **FE-00**: **reescrito 2026-07-22** — ya no describe el design system "v1" original (reemplazado por el
  rediseno "Libro Mayor" v2); ahora documenta directamente el sistema v2 real (filosofia, shell, catalogo
  de componentes), reclasificado `current`.
- **FE-06 vs FE-08**: la contradiccion que señalaba la auditoria ("chat de pagina completa" vs "IA
  integrada, no un chat aparte") **ya esta resuelta en codigo**: existe un panel lateral global
  (`copilot-panel.tsx`), no una pagina `/consultor-ia`. FE-06 necesita actualizarse para reflejarlo.
- **FE-07 (panel consultor)**: el health score que ordena "que cliente necesita atencion" **es
  deterministico**, calculado en Node (`listConsultantOrganizations`, formula por severidad de alertas +
  antiguedad + tareas vencidas) — la IA no decide el orden, exactamente lo que pedia la auditoria.
- **Resuelto 2026-07-21**: el CRUD de Consultoria ya no borra nada de forma inmediata. `deleteOrganization`/
  `deleteOrganizationStore` marcan `status='pending_deletion'` con 30 dias de gracia
  (`RETENTION_PERIOD_DAYS`, `apps/api/src/consultant.ts`), restaurables via `POST .../restore`; el borrado
  fisico real lo hace `purgeExpiredDeletions` en un cron diario (`purge-expired-deletions.yml`). Ver `RIESGOS.md`
  R-008.
- **Resuelto 2026-07-21**: la URL (`?organizationId=&connectionId=`) es ahora la fuente primaria del
  contexto de cliente/tienda activos en `PortalShell`, con `localStorage` como fallback — no al reves. De
  paso se corrigio un bug real: `integraciones/page.tsx` mantenia su propio estado desincronizado del
  selector del header. Ver ADR-0010 y `RIESGOS.md` R-009.

### Integraciones (INT-00 a INT-05)

Ver estado detallado por conector en `roadmap/roadmaps/04-integraciones/fases/INT-0X-*.md`. Resumen:

- **INT-00 (nucleo comun)**: el esquema comun (conexiones, sync runs, webhook events, enum de 6
  proveedores) ya existe en DB-04, pero no hay una interfaz de adaptador de codigo compartida — Shopify y
  Meta implementan el mismo patron en paralelo sin contrato comun. Reclasificado `in_progress` (no
  `Completado` como decia la version anterior).
- **INT-01 (Shopify)**: end-to-end validado con una tienda real (`padelespana.myshopify.com`). Bug real
  corregido 2026-07-20: el handler de webhooks verificaba el HMAC solo contra el secret de la app publica,
  rechazando el 100% de los webhooks reales de la tienda instalada via app custom (dos secrets distintos,
  mismo problema que ya se habia resuelto en el callback OAuth). Ya prueba ambos secrets. **Correccion**:
  una revision anterior decia "solo 4 topics, sin `refunds/create`" — verificado de nuevo, `refunds/create`
  ya estaba registrado. **Cerrado 2026-07-22**: el Partner Dashboard clasico ya no aplica a esta app (creada
  en el Dev Dashboard nuevo) — se vinculo el repo con `shopify app config link`, se anadio el bloque
  `[[webhooks.subscriptions]]` de compliance en `shopify.app.toml` y se deployo (`ecomscaling-custom-4`),
  verificado en vivo con un POST de HMAC invalido devolviendo 401. `app/uninstalled` se reenvio a la tienda
  piloto ya conectada (nueva funcion `resendShopifyWebhookRegistrations`). Reconciliacion de conteos real
  ejecutada (nuevo modulo `shopify-count-reconcile.ts`): productos 11/11 exacto; pedidos 363 local vs 341
  en Shopify, diferencia de 22 explicada (ventana de 60 dias de la API de Shopify sin `read_all_orders`, no
  test orders ni cancelados, no un bug de datos); clientes no comparable de forma fiable (Shopify topa el
  conteo en "AT_LEAST 10.000"). Unico bloqueador restante es externo (aprobacion de distribucion publica de
  Shopify).
- **INT-02 (Meta Ads)**: implementacion real (OAuth, sync, insights) verificada en `meta-sync.ts` — las
  `actions`/`action_values`/`purchase_roas` ya se guardan como filas separadas por `action_type`, sin
  colapsar a una columna de compras (el riesgo que mas se suele senalar en integraciones de Meta esta bien
  resuelto). Gaps reales: Insights solo a nivel `ad` (hardcodeado), sin modo asincrono, sin
  `canonical_purchase_action_type` documentado por cuenta. Bloqueado por Meta App Review, igual que BE-04.
- **INT-03 (Klaviyo)**: sin codigo. La guia de referencia en este repo (`Klaviyo/EcomScaling_IA_Guia_...md`)
  esta escrita sobre `api_revision 2026-04-15`; reauditar contra la revision vigente antes de programar.
- **INT-04 (Loom/Fathom)**: Loom manual esta completo y en uso (link + transcripcion manual -> A01 analista
  de llamadas -> aprobacion humana -> tareas). Fathom automatizado no tiene ni una linea de codigo — el
  valor `fathom` que existe en el enum de `recording_provider` es solo un placeholder de esquema, no una
  integracion funcional. Decidir modo de auth (API key vs OAuth) es el primer paso, sin decidir todavia.
- **INT-05 (Instagram)**: sin codigo, bloqueado por INT-02: `META_SCOPES` no pide
  `instagram_basic`/`instagram_manage_insights` hoy, asi que Instagram no puede empezar a implementarse sin
  ampliar primero los scopes de Meta (lo que exige reautorizacion de conexiones ya existentes).

### Agentes IA (AI-00 a AI-07, mas AI-08/09/10 propuestas)

Actualizacion AI-10 (2026-07-22): `AgentOutputEnvelope<TContent>`, `AgentSourceReference` y
`AgentProposal` ya viven en `packages/contracts`; A02/A04/A06/A08 y A09 los exponen de forma aditiva.
La UI muestra freshness y numero de fuentes, manteniendo compatibilidad con los payloads legacy.
**Correccion 2026-07-23**: la cabecera del propio documento `AI-10-evidencia-comun.md` seguia diciendo
`planned`/"no existe hoy ninguna envolvente comun" pese a que la seccion de evidencia mas abajo ya
documentaba lo contrario desde el dia anterior -- corregido a `implemented_partial`, con los 2 primeros
criterios de cierre marcados como cumplidos. Hallazgo real de paso: `freshness.status` esta cableado de
punta a punta (backend produce, frontend lee) pero el backend solo devuelve `"fresh"` hoy -- ambas ramas del
ternario en `buildAgentOutputEnvelope` devuelven el mismo valor, `"stale"`/`"superseded"` son alcanzables en
el tipo pero no en ningun camino de codigo real. AI-08 (outcomes de recomendaciones) y AI-09 (routing/
presupuesto por organizacion mas alla del plano actual) confirmados como genuinamente sin construir, no como
documentacion desactualizada -- correctos tal como estaban.

Ver estado detallado por fase en `roadmap/roadmaps/05-agentes-ia/fases/AI-0X-*.md`. Ninguna fase de este
dominio se declara `done` en esta revision — los tres criterios de cierre que antes marcaban AI-00 como
completa (organizacion fija, sin SQL de escritura, salida validable) son necesarios pero no suficientes:
un JSON con schema correcto puede seguir siendo un diagnostico incorrecto, caro o desactualizado.

- **AI-00**: runtime solido (organizacion fijada en backend, SQL Gateway como unica via, validacion Zod +
  `checkOutputSanity`, versionado con rollback). **Corregido 2026-07-22** (afirmacion anterior obsoleta):
  el presupuesto ya se aplica, no solo se registra — `evaluateAgentBudget` corta el turno con
  `AgentBudgetExceededError` (R-011, `agent_runs.status = "budget_exceeded"`); sigue siendo un limite plano
  para todos los agentes, no por agente/organizacion (eso es AI-09, no implementado). Sin maquina de
  estados formal ni model routing documentados.
- **AI-01 (A01 llamadas)**: el agente mejor delimitado del proyecto (fuente unica, aprobacion humana,
  trazabilidad). Gap real confirmado en codigo: dedup de tareas por titulo exacto normalizado
  (`calls.ts:474-516`), no por fingerprint semantico — dos tareas equivalentes con redaccion distinta no
  se detectan.
- **AI-02 (A02 monitor)**: es el agente con mas impacto comercial y el que menos control tiene. **Corregido
  2026-07-22** (afirmacion anterior obsoleta): ya no tiene `sql_select` libre — corre en evidence-pack puro
  (`allowed_tools = []`) desde la version de prompt `v2`, el mismo patron que se aplico a A06 tras su
  incidente. Pendiente: validar con un run real que el contexto enriquecido sigue detectando lo que antes
  detectaba via SQL libre (sobre todo el indicio de fallo de tracking).
- **AI-03 (SQL Gateway)**: 30 tests adversariales reales en `sql-gateway.test.ts` + 3 en
  `be-07-sql-gateway-tenant-isolation.test.ts` contra Supabase remoto real. El tenant se fija con
  `set_config` dentro de una unica llamada RPC transaccional (`agent_sql_gateway`), no sobre una conexion
  de pool reutilizada por Node. **Cerrado 2026-07-23**: `WITH RECURSIVE` ahora se rechaza explicitamente
  (antes estaba permitido), y el test que faltaba de aislamiento tenant extremo a extremo ya existe
  (5 llamadas RPC A/B/A/B/A alternadas confirman que el GUC nunca se filtra entre organizaciones).
- **AI-04 (RAG)**: **validado en vivo 2026-07-23** -- recall@8/recall@3 100% (6/6) con embeddings reales de
  Voyage y consultas parafraseadas, ver ficha AI-04. Gaps de diseño que la validacion no cubrio (corpus
  pequeño y sin terminologia exacta): chunking por parrafos (rompe tablas/listas), solo busqueda vectorial
  (sin hibrida), sin autoridad de fuentes ni resolucion de contradicciones.
- **AI-05 (especialistas)**: A04/A06/A08/A09 en `shadow_pilot`/`in_progress`; A03/A05/A07 bloqueados por
  credenciales Meta/Instagram; A00 (orquestador) diferido por decision explicita, no por bloqueo. Riesgo
  real sin resolver: A02 y A04 no tienen frontera de responsabilidad escrita — pueden proponer tareas
  solapadas.
- **AI-06 (evaluaciones)**: `checkOutputSanity` (guarda de sanidad estructural, 15 tests) esta en
  produccion. **Ampliado 2026-07-22**: dataset de A02 con 5 escenarios (sin datos, sin config financiera,
  tienda sana, stock roto, falso positivo deliberado -- los 2 ultimos con arbol Shopify real sembrado:
  productos/variantes/inventario/pedidos, no mocks) ejecutados contra el LLM real
  (`apps/api/src/eval-a02-monitor.ts`). Quality gates deterministicos anadidos al script (no solo
  documentados): coste maximo $0.15/escenario y latencia maxima 45s (ambos fallan el eval igual que un
  check hard si se superan), mas advertencia explicita si >1/3 de los checks soft fallan en una corrida.
  Dos corridas reales seguidas: 15/15 y 17/18 checks (el unico fallo fue un check soft con variabilidad real
  del LLM, confirma por que esos checks no deben bloquear solos). Sigue sin datasets para A01/A06, sin
  historial de metricas entre corridas para comparar versiones de prompt, sin proceso de regresion formal
  (dataset -> shadow -> canary) que bloquee activar una `agent_versions` nueva.
- **AI-07 (memoria acumulativa)**: `implemented_prod_secret_pending` (ver
  AI-07-memoria-acumulativa-consultor-experto.md). Descartado el diseño original (informes de IA
  re-ingeridos como RAG encadenado). Implementado el 2026-07-22 sobre las 3 fuentes (resumenes de llamada
  publicados, notas internas del consultor, decisiones sobre salidas de IA) con el contrato endurecido:
  scope jerarquico `global`/`organization`/`store` (`knowledge_documents.store_id`, `knowledge_search` con
  `target_store_id`); audiencia `client_visible`/`consultant_only`/`system_only` con enforcement obligatorio
  en `knowledge_search` (`audience_allowed` sin default permisivo; `buildAgentTools` lo fija a
  `['client_visible']` para todo agente automatico, cerrando el gap real que tenia A09); origen/autoridad
  (`origin`/`authority`) separados de "revisado por humano"; ingestion asincrona e idempotente via
  `memory_ingestion_queue` (outbox) procesada por un cron nuevo (`memory-ingestion.yml`, cada 15 min, mismo
  patron que `ops-health-check`/`shopify-reconcile`); ciclo de vida `pending_indexing`/`active`/
  `superseded`/`deleted`/`indexing_failed`; procedencia real (`source_actor_id` != `ingested_by`); tabla
  `client_constraints` inyectada siempre en el evidence pack de A02/A04/A06/A09 (no via `search_knowledge`);
  y una instruccion anti-prompt-injection anadida al system prompt de cualquier agente con
  `search_knowledge` (gap que tambien estaba pendiente en AI-04). Tests nuevos en
  `db-11-knowledge-search-isolation.test.ts` confirman 2 criterios de cierre contra el Supabase remoto real:
  una nota `consultant_only` nunca aparece con `audience_allowed=['client_visible']`, y una memoria de
  tienda nunca aparece al consultar otra tienda de la misma organizacion. **Validacion end-to-end real
  anadida el mismo dia** (`apps/api/src/validate-ai07-memory-pipeline.ts`, `npm run validate:ai07`): con
  `VOYAGE_API_KEY` real, el pipeline completo `enqueueMemoryIngestion` -> `processMemoryIngestionQueue` ->
  `knowledge_search` corre contra Supabase real, 9/9 checks pasan (document placeholder -> active con
  chunks, filtrado de audiencia con contenido real no sembrado a mano, idempotencia confirmada de punta a
  punta). Pendiente real: `VOYAGE_API_KEY` en el secret de produccion de GitHub Actions (sin ella el cron
  `memory-ingestion.yml` no procesa filas, quedan en `pending`), y las "dos superficies" de `/conocimiento`
  (sigue siendo una tabla plana sin distinguir memoria de documentos subidos a mano).
- **AI-08/09/10 (propuestas, no creadas)**: outcomes de recomendaciones (aceptada/rechazada -> KPI antes/
  despues), model routing y presupuesto real, y formato universal de evidencia — ver
  `roadmap/roadmaps/05-agentes-ia/README.md`. Son la pieza que mas cambiaria la ventaja competitiva real
  del producto (aprendizaje de resultados), mas que anadir agentes nuevos.

### Seguridad/QA/Observabilidad (SQO-00 a SQO-03, mas SQO-04/05/06 propuestas)

Ver estado detallado por fase en `roadmap/roadmaps/06-seguridad-qa-observabilidad/fases/SQO-0X-*.md`.
Corregidas fechas futuras ("2026-07-21") en SQO-00/SQO-01 que documentaban resultados como si ya hubieran
ocurrido un dia despues de la fecha real del sistema.

- **SQO-00**: CORS restrictivo (con fix real 2026-07-20: el default de `@fastify/cors` es solo
  `GET,HEAD,POST` — no incluye `DELETE/PUT/PATCH`, bloqueaba borrar tienda/cliente en el navegador),
  helmet, secret scanning, CI (`ci.yml`). **Ampliado 2026-07-22**: `rls-tenant-isolation.test.ts` cubre
  ahora tambien configuracion financiera (DB-03: 4 tablas, select cross-tenant e insert directo sin grant)
  y conexiones de integracion (DB-04: select/update cross-tenant en `integration_connections`/
  `integration_sync_runs`, mas confirmacion de que el schema `private` no esta expuesto por PostgREST).
  Gap real restante: llamadas y agent runs como dominios propios (cubiertos indirectamente por otros
  tests, no con casos dedicados); sin tests de integridad FK cross-tenant; sin redaccion de logs
  confirmada; sin rate limiting a nivel de endpoint propio.
  Fix de seguridad puntual: interpolaciones de `organizationId` en filtros `.or()` reforzadas con
  validacion de formato UUID.
- **SQO-01**: 82 tests en CI (60 en `apps/api` — RLS, SQL Gateway, permisos `private`, idempotencia de
  webhooks, aislamiento RAG, aislamiento tenant de RPC — + 22 guarda de calidad IA en `packages/ai`; conteo
  real verificado 2026-07-22 con `npm run test`, no los 54 citados en revisiones anteriores). **Cerrado
  2026-07-22**: `npm run lint` ya esta en `ci.yml` — los 12 errores reales de `react-hooks/set-state-in-effect`
  eran el mismo patron de fetch-on-mount repetido en 9 archivos, sin alternativa estable hoy
  (`useEffectEvent` sigue experimental); se bajo la regla a warning en `apps/web/eslint.config.mjs` con la
  justificacion documentada ahi en vez de forzar un refactor de comportamiento por una regla de estilo. Los
  tests RLS corren contra el Supabase remoto real en cada PR (funciona, pero es una base de CI mas
  lenta/costosa/fragil que un Postgres aislado por run). Pendiente: unit tests de otros motores, contract
  tests, tests de worker, Playwright, resto de evals IA (ver AI-06).
- **SQO-02**: **corregido 2026-07-20** — la clasificacion anterior (`planned_critical`, "no hay logging
  estructurado") era una verificacion incompleta (solo se grep0 `package.json` por `"pino"`/`"winston"`
  literal, sin ver que Fastify ya trae pino internamente). Verificado en vivo: Fastify ya genera logs JSON
  con `reqId` correlacionado por request; existe ademas `createLogger` (`packages/observability`) usado en
  9 archivos. Reclasificado `in_progress`. Anadida redaccion explicita de secretos en el logger (cierra
  gap de SQO-00). **`organization_id` cerrado 2026-07-22**: hook `onRequest` en `server.ts` crea un child
  logger de pino con `organization_id` para las 62 rutas que llevan `:organizationId`; un hook `onResponse`
  complementario cubre el caso confirmado en vivo de que el log automatico "request completed" de Fastify
  no recoge el child logger (limitacion real de Fastify). Sigue faltando: `user_id` en el logger, metricas
  agregadas, error tracking/APM, alertas mas alla de `ops-health-check` — sin eso, diagnosticar "los
  pedidos de ayer no aparecen" para algo que cruce varias requests o corra en el worker sigue requiriendo
  leer codigo y consultar la DB a mano.
- **SQO-03**: **corregido 2026-07-20** — `public.audit_logs` ya no esta vacia. Nuevo helper
  `recordAuditLog` (`apps/api/src/audit-log.ts`) cableado en `updateOrganization`, `deleteOrganization`,
  `deleteOrganizationStore`, `decideSummary`, `decideAgentOutput`. Reclasificado `in_progress`.
  **2026-07-22**: `financial-config.ts` cableado tambien (`upsertFinancialSettings`,
  `createFixedExpense`/`deactivateFixedExpense`, `createShippingRule`/`deactivateShippingRule`).
  **Correccion el mismo dia**: se investigo el supuesto gap de "membresias/asignaciones sin auditar" y se
  concluyo por error (grep sobre el nombre de tabla equivocado, `"memberships"` en vez de
  `organization_members`) que no existia endpoint -- si existe (`upsertOrganizationMember`/
  `upsertConsultantAssignment` en `consultant.ts`) y ya estaba auditado desde antes de esta sesion. Pendiente
  real: politica de retencion con cifras ni prueba de restauracion de backup.
- **SQO-04/05/06 (propuestas, no creadas)**: threat model, disaster recovery y runbooks operativos — ver
  `roadmap/roadmaps/06-seguridad-qa-observabilidad/README.md`.

### Operacion/Despliegue (OPS-00 a OPS-02)

Puerto local API fijado en 4000 (web en 3001), `WEB_ORIGIN` configurado para CORS. Supabase remoto
linkeado. Cron de sincronizacion diaria de Shopify a las 2am (`Europe/Madrid`) reemplazando el job de 6h
anterior (2026-07-20).

- **OPS-00**: **corregido 2026-07-22** (afirmacion anterior obsoleta) — `apps/api` y `apps/web` ya estan
  desplegados en produccion en Vercel (`ecom-scaling-api`/`ecom-scaling-web`, confirmado via API de
  Vercel), no "sin hosting decidido". Q-001 pausada: `apps/worker` (BullMQ+Redis) no esta desplegado en
  ningun sitio y no hace falta -- su unica cola repetible (reconciliacion diaria Shopify) ya la duplican
  los workflows de GitHub Actions, y ningun otro punto del codigo encola trabajos. Sigue sin staging
  separado de produccion, **aceptado 2026-07-22** (R-015 cerrado, no activo): Vercel preview + cron cubren
  la necesidad real hoy; se crea staging real solo ante un cambio de alto riesgo antes de produccion.
  **Politica de migraciones escrita 2026-07-23** (`ADR-0014-migration-policy.md`, ver RB-005 -- el hallazgo
  real de drift que la motivo). Sin matriz de secrets por entorno. `apps/api/Dockerfile`/`apps/worker/Dockerfile` existen pero no se usan hoy (Vercel no los
  necesita); no probados con un `docker build` real (Docker no disponible en este entorno).
- **OPS-01 (piloto)**: reclasificado `planned` — el documento anterior exigia Shopify **y** Meta desde el
  arranque, pero Meta esta bloqueado por App Review; dividido en Piloto 1 (Shopify, sin dependencia de
  Meta), Piloto 2 (Meta) y Piloto 3 (Klaviyo). **Corregido 2026-07-22**: 9 de los 10 criterios de entrada al
  Piloto 1 ya estan cumplidos (soft-delete sin hard-delete inmediato, reconciliacion Shopify con tienda real
  y desviacion explicada -- ver INT-01, webhooks de privacidad, `app/uninstalled`, runbook de sync fallido,
  RLS ampliado a configuracion financiera y conexiones de integracion -- ver SQO-00, alertas operativas via
  GitHub Issues -- ver SQO-02/R-014, responsable de soporte confirmado -- Rafa, ver R-018, staging
  reevaluado -- Vercel prod + GitHub Actions cron ya cubren la carga real, Q-001 pausada sin bloquear nada)
  — falta 1: backup restaurado al menos una vez (mecanismo de `pg_dump` ya implementado, RB-007, drill real
  pospuesto a proposito hasta que haya datos de produccion reales, ver R-016). Ver `OPS-01-piloto-mvp.md`
  para el detalle actualizado.
- **OPS-02**: **corregido 2026-07-22** (afirmacion anterior obsoleta) — ya no es solo un indice de nombres,
  tiene 5 runbooks reales con diagnostico/acciones/rollback (RB-001/002/006 + RB-007 backup/restauracion +
  RB-008 purga fallida, ver fila de tabla arriba, R-016 y R-008). Priorizado por probabilidad x impacto
  segun `RIESGOS.md`: fuga cross-tenant y webhook duplicado siguen sin runbook.

**Correccion de etiqueta del release**: llamarlo "post-MVP" era prematuro dado lo anterior — corregido a
"Pre-piloto" arriba.
- **Correccion de estado 2026-07-22 (runtime IA y conectores)**: INT-00 ya no esta pendiente de completar OAuth/health/webhooks; el `IntegrationAdapter` completo para Shopify y Meta esta implementado y probado en `apps/api/src/integration-adapters.test.ts` (la fila historica conserva el texto anterior y debe leerse junto con esta correccion). El runtime IA acepta ahora Anthropic o OpenAI como proveedor unico y usa OpenAI directamente si Anthropic no esta configurado; no se activa ningun agente sin al menos una clave valida. AI-09 sigue correctamente `planned`: el presupuesto plano por turno existe, pero routing por modelo, presupuesto por organizacion y circuit breakers aun no.
- **Correccion BE-01 2026-07-22**: ya existen endpoints administrativos y UI para listar y mutar miembros/asignaciones de perfiles existentes, con soft-deactivate y `audit_logs`. El flujo de invitación/creación de usuarios de Auth permanece fuera de alcance hasta conectar un proveedor de correo/identidad.
