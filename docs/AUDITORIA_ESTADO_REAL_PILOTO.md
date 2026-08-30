# Auditoría de estado real — piloto EcomScaling

> Actualización 2026-08-20: el dashboard incorpora `AdaptiveFocus`, una primera composición
> determinista basada en operaciones reales, tareas, alertas y estado de conectores. El typegen oficial
> de Supabase también está integrado en `packages/db/src/database.types.ts` mediante conexión PostgreSQL
> directa; no se inventan datos ni se modifican filas de producción. El bloque `Resumen ejecutivo IA`
> reutiliza A02 en variante compacta y expone evidencia, fuentes, confianza, completitud y warnings.
> Meta Insights también tiene runner asíncrono preparado detrás de `META_INSIGHTS_MODE=async`; el modo
> por defecto continúa síncrono y no se activa sin credenciales/app aprobada.

> Verificación de superficie UI 2026-08-20: las 12 rutas autenticadas del
> portal contienen referencias a estados de loading, empty y error; el catálogo
> reutilizable se mantiene único en `apps/web/src/components/ui` y no existen
> imports activos desde un `packages/ui` paralelo. La excepción de input nativo
> de Conocimiento sigue siendo intencional y está accionada por un botón accesible.

> Seguridad de tests 2026-08-20: la orden normal de tests de API quedó limitada
> a contratos/unitarios sin I/O remoto. Las suites RLS/cross-tenant mutables se
> separaron en `test:remote` y exigen confirmación explícita y un proyecto de
> pruebas distinto del proyecto de producción.

> Verificación de base de datos 2026-08-26: 75 migraciones locales/remotas
> alineadas, `db push --linked --dry-run` devuelve que la base está al día y
> `db lint` no encuentra errores en `public`. La comprobación fue de lectura;
> no se escribieron datos de negocio.

> Correccion de conteo 2026-08-26: tras aplicar AI-13 hay 75 migraciones
> locales/remotas alineadas; las cifras anteriores de 62 son historicas.

> El guard de seeds tambien protege `seed-shopify-store`: exige
> `ALLOW_SHOPIFY_SEED=true` y rechaza `SEED_SHOP_DOMAIN` cuando coincide con
> `SHOPIFY_PRODUCTION_DOMAIN`. Ningun seed forma parte de la ruta normal de
> produccion.

> Verificacion de guardas en ejecucion 2026-08-20: ambos seeds fueron lanzados
> con variables sintéticas que coincidían con producción y ambos terminaron con
> código 1 antes de abrir una escritura (`DEMO_SEED_PRODUCTION_PROJECT_REFUSED`
> y `SHOPIFY_SEED_PRODUCTION_DOMAIN_REFUSED`).

> Typecheck de seeds 2026-08-20: `tsc --noEmit` sobre
> `scripts/seed-demo-user.ts` y `scripts/seed-shopify-store.ts` pasa sin errores.

> Tipado generado de Supabase 2026-08-20: el endpoint de Management API y el generador MCP
> rechazaron la cuenta por falta de privilegios, pero el mismo typegen oficial se ejecutó
> correctamente mediante `SUPABASE_DB_URL` (conexión PostgreSQL directa, solo introspección).
> El artefacto resultante vive en `packages/db/src/database.types.ts` y
> `packages/db/src/index.ts` exporta `Database`/`Json`; las migraciones siguen siendo la fuente
> ejecutable de verdad y el paquete no tiene consumidores de runtime todavía.

> Verificación de build 2026-08-20: `npx next build` desde `apps/web` completa compilación,
> typecheck y prerender de las 18 rutas. También pasan los typechecks directos de web, API,
> IA e integraciones.

> Gate de design system 2026-08-20: `node scripts/assert-ui-catalog-surface.mjs` confirma que no
> hay imports de HeroUI fuera de `apps/web/src/components/ui`; el mismo gate queda conectado a CI.

> Contrato web 2026-08-20: la suite directa de portal pasa 5/5, incluyendo las 12 rutas autenticadas
> con shell compartido y estados loading/empty/error.

> Gates locales 2026-08-20: `audit-guard` no detecta vulnerabilidades high/critical en dependencias
> de producción; las superficies normal de tests, seeds y catálogo UI pasan sus guards respectivos.

> Corrección documental DB-09 2026-08-20: el documento de fase ya no afirma que falte la migración
> de Klaviyo; foundation y alineamientos están presentes y alineados en producción. Solo permanecen
> validación externa, backfill profundo y reporting visual.

> Corrección documental INT-05 2026-08-20: Instagram ya no se describe como una fase sin implementación;
> tiene catálogo, adapter contractual no disponible y foundation DB-10. El OAuth/sync real permanece
> condicionado a Meta, scopes y credenciales.

> Corrección documental Meta 2026-08-20: BE-04/INT-02 ya reflejan los endpoints locales de selección
> de activos y la acción canónica de compra persistida; la validación externa y los insights reales
> siguen pendientes.

> Lint y esquema 2026-08-20: ESLint directo de `apps/web/src` pasa sin errores y
> `regenerate-generated-schema.mjs --check` confirma las 75 migraciones.

> Auditoría documental 2026-08-20: se corrigieron tres enlaces relativos rotos en DB-06, BE-04 y
> RB-005; el escaneo de enlaces locales Markdown queda en `MARKDOWN_LOCAL_LINKS_OK`.

> El escaneo reproducible quedó incorporado a CI mediante `scripts/assert-markdown-links.mjs`.

> Consolidación de guards 2026-08-20: enlaces Markdown, catálogo UI, foundation DB-10, seeds,
> superficie segura de tests y esquema generado pasan conjuntamente.

> Gate DB-10 2026-08-20: `assert-instagram-foundation.mjs` confirma en CI que las seis tablas de
> Instagram conservan RLS, política tenant-scoped y grants de lectura autenticada, y que la foundation
> no contiene mutaciones de filas de negocio.

> Actualizacion 2026-08-19: el riesgo de dependencias de produccion queda
> cerrado en la comprobacion actual. `apps/web` usa Next.js 16.3.1 y
> `eslint-config-next` 16.3.1; el override raiz fija `nanoid` 3.3.18 para las
> copias transitivas de PostCSS. `node scripts/audit-guard.mjs` pasa con 0
> vulnerabilidades high/critical. Build web, typecheck web y typecheck API
> pasan tras la actualizacion.

> Actualizacion operativa 2026-08-19: API y worker Docker se construyeron con
> exito usando sus Dockerfiles reales. Tests contractuales actuales: API 43/43,
> worker 13/13, web 5/5, AI 47/47, config 15/15, integraciones 8/8 y
> observabilidad 5/5. El audit de produccion permanece en 0 high/critical;
> Queda pendiente automatizar este escaneo en CI.

> El escaneo ya realizado con Docker Scout sobre las etapas finales `runtime`
> de API y worker devuelve 0 paquetes vulnerables critical/high. Los hallazgos
> del escaneo multi-stage pertenecen al builder y no se copian a la imagen final;
> queda pendiente automatizar este gate en CI y arrancar los contenedores contra
> Supabase/Redis reales.

> La automatización del gate requiere Docker ID/PAT en CI; sin esa credencial
> el contenedor oficial de Scout rechaza la ejecución. Queda documentado como
> dependencia externa, no como validación CI simulada.

> El smoke runtime local ya cubre ambos contenedores: API `/health` 200 y worker
> healthy contra Redis 7 efimero. Se utilizaron variables sinteticas y se
> eliminaron los recursos al finalizar; no hubo acceso a produccion.

> **Corrección FE-02 2026-08-02:** el componente reutilizable `PlatformIcon` ahora muestra un
> fallback accesible cuando falta un recurso de marca. La pestaña Klaviyo ya no depende de un SVG
> inexistente ni queda visualmente vacía; no se simula que el conector esté disponible.

> **Corrección FE-06 2026-08-02:** el roadmap del Consultor IA pasa a `implemented_partial` para
> reflejar el copiloto lateral, chat persistido, fuentes/citas, estados de error y drafts revisables.
> Instagram y creatividades Meta siguen condicionados a credenciales y permisos externos.

> **Corrección FE-08/a11y 2026-08-02:** el `PortalShell` compartido incorpora skip link al contenido
> principal, objetivo enfocable, foco visible global, `lang="es"` y reducción de movimiento.

> **Verificación FE-08 2026-08-02:** las 12 rutas autenticadas del portal (`agentes`, `camino`,
> `configuracion`, `conocimiento`, `consultor`, `dashboard`, `integraciones`, `llamadas`, `marketing`,
> `shopify`, `shopify/diagnostico`, `tareas`) contienen cobertura estática de loading, empty y error;
> login y páginas estáticas quedan fuera de ese contrato de datos.

> **Verificación adicional 2026-08-02:** los 10 workspaces pasan `tsc --noEmit` y la suite
> contractual aislada AI/config/integrations pasa 63/63 tests. La cifra no sustituye las pruebas
> de integración remota RLS, que siguen requiriendo un entorno/credenciales autorizados.

> **Corrección de evidencia 2026-08-02:** la cifra vigente de esta revisión es 45 tests del
> paquete AI y 18 tests unitarios API pasando; `next build` genera 18 rutas. Las pruebas de
> aislamiento/RLS contra Supabase remoto requieren credenciales explícitas y no se ejecutan sin
> ellas para no escribir ni simular validación sobre producción.

> **Correccion INT-03/DB-09 2026-08-02:** Klaviyo ya no es solo un contrato aislado: DB-09 esta
> aplicada en remoto y el vertical slice de OAuth/sync de metadatos vive en `apps/api/src/klaviyo*`.
> Sigue siendo `implemented_partial` hasta validar una cuenta real, backfill/reconciliacion y la
> superficie de reporting en UI.

> **Verificacion operativa 2026-08-02:** existe worker once y workflow horario de Klaviyo; el job no
> inventa datos ni escribe si no encuentra conexiones activas y registra sync/reporting por cuenta.

> **Verificacion historica DB-09 2026-08-02:** hubo 56 migraciones locales, 0 timestamps duplicados, local y
> remoto estan alineados y `supabase db push --dry-run` devuelve `Remote database is up to date`.

> **Correccion de evidencia 2026-08-02:** la cifra anterior de 56 migraciones era historica. El
> estado vigente es 75 migraciones locales/remotas alineadas; `db push --dry-run` y `db lint` pasan.
> Ademas, los feature flags de Meta/Klaviyo protegen rutas, callbacks, runners internos y el worker
> de reconciliacion, por lo que un conector desactivado no puede activarse por una ruta alternativa.

> **Verificacion SQO-03 ampliada 2026-08-02:** los callbacks OAuth de Shopify, Meta Ads y Klaviyo
> registran la conexion sin incluir tokens; las mutaciones sensibles de llamadas, conocimiento,
> costes manuales, operaciones y Mi Camino registran actor, organizacion y entidad mediante el
> helper comun `recordAuditLog`.

> **Lectura de producción Shopify 2026-08-02:** existe 1 conexión Shopify en estado `connected`,
> 1 tienda, 11 productos, 18 variantes, 18 inventarios, 438 pedidos (`shopify_order_facts`),
> 476 líneas de pedido, 10.865 clientes y 1.368 ejecuciones de sincronización. Es evidencia de
> datos persistidos reales, no una simulación; no se modificó ninguna fila durante esta lectura.
> En el mismo corte hay 1 conexión Meta Ads en `pending` y ninguna conexión Klaviyo activa; ambas
> superficies permanecen honestamente desactivadas/preparadas según sus feature flags.

> Las 5 últimas ejecuciones Shopify leídas son `incremental/succeeded`, con `records_failed = 0`
> en todas; algunas fueron no-op (`records_read = 0`) y otras escribieron entre 5 y 12 registros.

> **Verificacion vigente adicional 2026-08-02:** `npx supabase db lint --linked` no encuentra errores,
> `npx supabase db push --linked --dry-run` confirma que la base remota esta al dia, y la bateria
> contractual/unitaria API ejecutada con `.env.local` pasa 75/75. El API typecheck y el web typecheck
> pasan; `next build` genera las 18 rutas. La auditoria de escrituras sensibles amplio `recordAuditLog`
> a operaciones, Mi Camino, costes manuales, llamadas y conocimiento.

**Fecha de corte:** 2026-08-02  
**Documento canónico relacionado:** [Objetivo global del SaaS](./OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md)  
**Regla:** `verificado` solo significa que existe evidencia local reproducible. Una credencial o un entorno externo ausente se marca como pendiente, nunca como conectado.

> **Regresion FE-08 2026-08-02:** `apps/web/src/portal-state-contract.test.ts` automatiza el contrato
> de estados sobre las 12 rutas autenticadas; la prueba pasa 1/1 y contempla componentes compartidos
> y estados contextuales visibles (banners de conexion o listas sin resultados).

> **Verificacion visual FE-08 2026-08-02:** con el entorno raiz cargado mediante `.env.local`, Next.js
> arranca en local, la raiz resuelve a `/login`, las 12 rutas protegidas redirigen a `/login`, no hay
> overlays de error ni errores de consola, y el login no presenta overflow horizontal a 390px. La
> comprobacion se hizo con navegador Chromium local; no sustituye una sesion autenticada real.

> **Correccion a11y/performance FE-08 2026-08-02:** el icono de plataforma del dashboard usa ahora
> `next/image` con dimensiones explicitas, el callback de `Mi Camino` incluye la organizacion activa
> en sus dependencias y `useShopifyOverview` memoiza sus funciones de carga/sync para no usar cierres
> obsoletos al cambiar de tienda. Dashboard, Shopify y Tareas tambien actualizan sus dependencias
> de organizacion/tienda. Web typecheck y `next build` generan las 18 rutas; ESLint queda sin errores
> (solo avisos no bloqueantes de efectos de carga existentes).

## Resumen ejecutivo

**Correccion AI-13 (2026-08-02):** el modo shadow ya no es solo una etiqueta de
la UI. La migracion `20260802110000_ai_13_shadow_execution_mode.sql` añade
`agent_runs.execution_mode` con valor por defecto `shadow`; el runtime lo
persiste y las trazas/listados lo exponen. `live` queda reservado para una
activacion futura explicita.

EcomScaling tiene una base funcional para operar con Shopify y un runtime IA con ejecución en shadow/revisión humana. Meta Ads, Klaviyo e Instagram cuentan con contratos, catálogo de capacidades y superficies de estado, pero no deben presentarse como conectados sin credenciales reales. El Tool Layer ya tiene un registro ejecutable inicial y bloquea las tools futuras sin executor.

> **Estado canónico Shopify actualizado 2026-08-02:** la lectura de producción confirma una tienda
> real conectada, datos persistidos y sincronizaciones incrementales `succeeded` sin fallos. Shopify
> pasa a considerarse operativo para el piloto; la validación restante se limita a escenarios edge
> no ejecutados en esta sesión (reenvíos/orden de webhooks, desinstalación y fallos de bulk).

## Matriz de requisitos

> Nota de precedencia 2026-08-21: cualquier fila histÃ³rica que mencione polÃ­tica de costes por
> plan/complejidad pendiente queda supersedida por la correcciÃ³n AI-09: `AI_PLAN_BUDGETS_JSON` ya
> aplica esa polÃ­tica server-side; solo quedan valores comerciales finales y APM externo.

| Área                                   | Estado                        | Evidencia local                                                                                                                                                                                                                                                                                          | Pendiente / condición de cierre                                                                          |
| -------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Objetivo y Definition of Done          | `verificado`                  | `docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md`                                                                                                                                                                                                                                                  | Revalidar cada fase contra esta matriz                                                                   |
| Portal cliente                         | `implemented_partial`         | `apps/web/src/app`, contratos frontend y estados compartidos                                                                                                                                                                                                                                             | Recorrido autenticado completo; estados y redirección verificados, falta sesión manual persistente       |
| Panel consultor                        | `implemented_partial`         | rutas `apps/web/src/app/consultor` y endpoints `apps/api/src/consultant.ts`                                                                                                                                                                                                                              | Validar permisos y flujo completo con fixtures aislados                                                  |
| Design system                          | `implemented_partial`         | `apps/web/src/components/ui`, ADR-0015, componentes reutilizados y `assert-ui-catalog-surface.mjs` en CI                                                                                                                                                                                                 | Mantener un único origen; no crear `packages/ui` paralelo sin migración atómica                          |
| Dashboard/tareas/alertas/llamadas/plan | `implemented_partial`         | dashboard con `AdaptiveFocus` determinista, operaciones reales, páginas y contratos de cada módulo; migraciones de dominio                                                                                                                                                                               | Verificar todos los estados en navegador y completar resumen narrado AI-02                               |
| Integraciones UI                       | `implemented_partial`         | `apps/web/src/app/integraciones/page.tsx`, catálogo y estados                                                                                                                                                                                                                                            | Completar recorrido de conexión real y reautorización                                                    |
| Shopify OAuth                          | `pilot_ready`                 | `apps/api/src/shopify.ts`, conexión real en producción, OAuth y tablas DB-04/DB-05                                                                                                                                                                                                                       | Reautorizar/desinstalar en una sesión manual si se requiere evidencia operativa adicional                |
| Shopify sync/webhooks                  | `pilot_ready`                 | `apps/api/src/shopify-sync.ts`, datos reales, 1.368 sync runs y webhooks/idempotencia/reconciliación                                                                                                                                                                                                     | Ejecutar edge cases de reenvío, orden, desinstalación y bulk                                             |
| Meta Ads                               | `prepared`                    | `apps/api/src/meta.ts`, `DB-06`, `INT-02`, selección de activos validada por organización y feature flag                                                                                                                                                                                                 | App/scopes/credenciales Meta y validación externa                                                        |
| Klaviyo                                | `prepared`                    | `INT-03`, contrato de conector, AI-11 y contrato de email IA                                                                                                                                                                                                                                             | API key/scopes reales; reporting y publicación permanecen desactivados                                   |
| Instagram                              | `prepared`                    | `INT-05`, catálogo y estados UI                                                                                                                                                                                                                                                                          | Credenciales y permisos del proveedor                                                                    |
| Datos demo/shadow                      | `implemented_partial`         | fixtures/evals y estados de conexión                                                                                                                                                                                                                                                                     | Confirmar que ningún seed entra en la ruta normal de producción                                          |
| Aislamiento multi-tenant               | `implemented_partial`         | RLS DB-02, `requireMembership`, clientes scoped y tests                                                                                                                                                                                                                                                  | Ejecutar validación RLS aislada; nunca contra producción                                                 |
| Agentes IA                             | `implemented_partial`         | `apps/api/src/ai-runtime.ts`, `packages/ai/src/index.ts`                                                                                                                                                                                                                                                 | Completar executors del catálogo y evals de producción                                                   |
| Evidencia y citas                      | `implemented_partial`         | `AgentOutputEnvelope`, fuentes y trazas de runs; el resumen ejecutivo muestra groundedness, completitud, confianza y fuentes                                                                                                                                                                             | Aumentar cobertura por agente y verificar UI                                                             |
| Costes y límites                       | `implemented_partial`         | `checkOrganizationDailyBudget`, `checkOrganizationProviderCircuit`, `get_budget_status`, budgets por turno, overrides opcionales por agente/proveedor y circuit breaker por tenant sobre `agent_runs`                                                                                                    | Política automática por plan/complejidad sigue pendiente                                                 |
| Aprobación humana                      | `implemented_partial`         | `decideAgentOutput`, guards runtime y estados de propuestas                                                                                                                                                                                                                                              | Recorrido manual de cada tipo de propuesta                                                               |
| Tool Layer                             | `implemented_partial`         | `packages/ai/src/tool-layer.ts`, `packages/ai/src/index.ts`, `apps/api/src/ai-runtime.ts`, AI-00A; lecturas SQL/conocimiento/cobertura/presupuesto, seis lecturas de dominio, listas paginadas, tools de abstención/calidad, `dry_run_write`, fixture de replay `tool-replay-v1` y contratos Zod activos | Registrar executors restantes, conectar replay al runner completo y normalizar todas las respuestas      |
| `data_coverage`                        | `implemented_partial`         | executor en `apps/api/src/ai-runtime.ts`                                                                                                                                                                                                                                                                 | Añadir freshness específica por dataset cuando existan syncs                                             |
| Generación Klaviyo IA                  | `implemented_partial`         | `packages/ai/src/index.ts`, `apps/api/src/ai-runtime.ts`, migración AI-11 y `apps/web/src/app/marketing/page.tsx`: agente A11, persistencia de drafts, HTML sanitizado, preview aislado y decisión humana con razón auditable                                                                            | Falta validación con credenciales Klaviyo reales y publicación/envío tras scopes, dry-run e idempotencia |
| Observabilidad                         | `implemented_partial`         | audit log, agent runs/tool calls, métricas Prometheus process-local, redacción de secretos, hooks HTTP y jobs del worker correlacionados con `job_name`/`job_id`/`correlation_id`                                                                                                                        | Agregación multi-instancia/APM cuando exista infraestructura externa                                     |
| Tests/typechecks/build/lint            | `verificado` en alcance local | batería contractual/unitaria API 75/75, typechecks directos de todos los workspaces, `next build` con 18 rutas, contrato de estados web 1/1 y gate de catálogo UI                                                                                                                                        | Ejecutar gates completos de CI y reducir warnings restantes de hooks antes del piloto                    |
| Backup/restore y RLS operativo         | `pendiente`                   | runbooks/roadmaps existentes                                                                                                                                                                                                                                                                             | Entorno aislado y procedimiento probado                                                                  |

> Correccion AI-00A 2026-08-20: `get_budget_status` es una capacidad `core` del
> runtime y no depende de Meta. La regresion garantiza que el presupuesto y la
> aprobacion de los agentes siguen disponibles con Shopify conectado y
> Meta/Klaviyo desactivados; la suite aislada de AI queda en 47/47.

> Verificacion de Tool Layer 2026-08-20: el registro contiene 48 tools, 18
> activas con contrato Zod y executor, y 30 futuras bloqueadas por estado o por
> conector no conectado. El catalogo de integraciones confirma Shopify activo,
> Meta/Klaviyo desactivados e Instagram no disponible.

> Verificacion DB-10 2026-08-20: la foundation de Instagram se aplico sin filas
> de negocio; `supabase migration list --linked` confirma 64/64 y `db lint`
> no encuentra errores en el esquema publico.

> Verificacion de fuente DB 2026-08-20: `node scripts/regenerate-generated-schema.mjs --check`
> pasa y `schema_generado_desde_migraciones.sql` contiene las 75 migraciones,
> incluida DB-10. CI ejecuta este check para evitar drift documental.

> Verificacion de seeds 2026-08-20: `seed-demo-user` exige
> `ALLOW_DEMO_SEED=true` y rechaza ademas cualquier `SUPABASE_URL` cuyo project
> ref coincida con `SUPABASE_PRODUCTION_PROJECT_REF`; CI protege esta barrera
> con `scripts/assert-safe-seed-surface.mjs`.

## Correccion AI-11 (2026-08-02)

La Fase A ya tiene agente A11, persistencia de drafts, aprobación y preview seguro en `/marketing`.
La auditoría visual/manual y la conexión Klaviyo real siguen pendientes; no publica ni envía automáticamente.

## Corrección AI-14 (2026-08-02)

El runtime IA ya expone `request_missing_data`, `escalate_to_human`,
`flag_data_quality_issue` y `report_confidence` como tools no mutantes. Sus
respuestas tienen contratos corregibles, provenance y no requieren conexión a
Meta, Klaviyo o Instagram. La migración AI-14 solo las habilita para la versión
activa de A11; la aplicación remota queda verificada abajo.

> **Verificacion de despliegue 2026-08-02:** AI-14 se aplico correctamente en produccion como
> `20260802130100_ai_14_abstention_quality_tools.sql`. El historial remoto y local quedan alineados;
> no queda pendiente esta migracion.

## Corrección INT-03 (2026-08-20)

Klaviyo está en `implemented_partial`: además de la configuración y primitives OAuth/PKCE, existen
rutas de conexión/callback protegidas por feature flag, persistencia de credenciales cifradas, sync,
Reporting API, selección de métrica de conversión y reconciliación programada. Cuando no hay
credenciales o conexión activa, el runner no toca Supabase y la UI conserva el estado no disponible.
La validación contra una cuenta Klaviyo real, backfill profundo y publicación/envío siguen pendientes.

La idempotencia del sync incremental queda alineada con el reconciliador de 6 horas: cada ventana
UTC puede ejecutar una actualización nueva, mientras que el sync inicial conserva una importación
diaria. Esto evita que una ejecución exitosa bloquee el resto de ciclos del día.

La reconciliación de Klaviyo está preparada en worker y workflow, pero el `schedule` automático
permanece desactivado hasta disponer de credenciales y una cuenta real; el disparo manual y el
feature flag permiten validar la operación sin activar tráfico externo por accidente.

Correccion INT-01 2026-08-21: Shopify valida el payload JSON despues de HMAC y antes de
persistirlo; cuerpos firmados pero malformados devuelven `400 invalid_json_payload` de forma
controlada. La ruta conserva deduplicacion por fingerprint, reintento de eventos fallidos y
reconciliacion incremental.

Correccion SQO-01 2026-08-21: `apps/api` `test:unit` incluye ahora los contratos del circuit
breaker IA y del parser seguro de webhooks Shopify; ambos quedan dentro del pipeline normal,
sin Supabase remoto ni mutaciones.

Correccion AI-09 2026-08-21: el runtime aplica `AI_PLAN_BUDGETS_JSON` por suscripcion activa del
tenant, con presupuesto diario, coste por turno, numero de tools y multiplicador de complejidad.
La variable es opcional, queda en servidor y conserva defaults seguros si falta o contiene JSON invalido.
Los contratos de configuracion y runtime pasan sus tests directos.

Correccion OPS-01 2026-08-21: `backup-database.yml` ofrece ahora un restore drill manual opt-in con
`SUPABASE_RESTORE_DB_URL` separado, bloqueo contra reutilizar la URL de produccion y comprobacion
post-restore de `public.organizations` y su policy RLS. El drill real sigue pendiente de ejecucion
por un administrador en una base desechable; no se marca como verificado por existir el workflow.

Correccion FE-08 2026-08-21: se añade `scripts/assert-product-state-surface.mjs` al CI manual para
proteger 12 rutas operativas del portal. Cada una debe conservar `LoadingBlock`, `ErrorBlock` y
`EmptyState`; el gate es estructural y complementa la verificacion visual/manual pendiente.

Correccion FE-08b 2026-08-21: `/configuracion` tenia un error remoto representado como `Banner`
generico; ahora usa `ErrorBlock`, alineado con el contrato compartido y detectado por el nuevo gate.

Correccion A11Y 2026-08-21: `LoadingBlock` anuncia estados de carga mediante `role=status` y
`aria-live=polite`, ocultando el spinner puramente visual a lectores de pantalla. Se añade un gate
estructural para foco visible, skip link, reduced motion y estados live; la validacion manual con
teclado, lector de pantalla y zoom sigue siendo una actividad de piloto.

Correccion AI-10 2026-08-21: `AGENT_CATALOG` en `@ecomscaling/contracts` separa nombres de producto
de codigos internos. La traza del panel IA muestra el nombre humano y conserva el codigo tecnico;
A03/A05/A07 aparecen como preparados, no como agentes operativos.

Correccion INT-05 2026-08-21: la tarjeta de Instagram ya diferencia `No disponible todavía` de
`No conectado` y explica la dependencia de Meta/Instagram Login y de una cuenta profesional. No
aparece una acción OAuth ni métricas ficticias mientras el adapter siga en `unavailable`.

Correccion INT-05b 2026-08-21: el adapter contractual de Instagram expone ahora tambien
`discoverAssets`, coherente con `capabilities.assetSelection=true`; la llamada falla de forma
clasificada con `CREDENTIALS_MISSING` hasta que exista el conector real.

Correccion AI-07/FE-08 2026-08-21: `/conocimiento` ofrece selector de superficie para distinguir
documentos aportados manualmente de memoria derivada por actividad, reutilizando `origin`, `authority`
y `audience` del endpoint existente. Mantiene estados loading, empty y error sin datos ficticios.

Correccion ACL de conocimiento 2026-08-21: la pantalla aplica la misma matriz de capacidad que
`requireKnowledgeManager`: `platform_admin`/`consultant` y membresias `owner`/`manager` pueden
ingerir documentos; el destino global solo aparece para `platform_admin`. El resto conserva lectura
y busqueda semantica, pero recibe un estado explicativo en lugar de un formulario que terminaria en
`403`. La API mantiene la proteccion server-side como autoridad final.

La misma pantalla queda sin warnings de ESLint: el fetch inicial remoto está justificado explícitamente
en el efecto de montaje y typecheck/lint/contrato de portal pasan.

Verificación de integración 2026-08-21: typecheck directo de API y web, `next build` con 18/18 rutas,
`GENERATED_SCHEMA_OK` para 75 migraciones y `MARKDOWN_LOCAL_LINKS_OK` pasan después del cambio.

La suite unitaria API configurada para CI pasa 52/52 directamente, incluyendo contratos de
integraciones, circuit breaker IA, webhooks Shopify, Klaviyo, Meta, observabilidad y sanitización
de errores. Las suites que mutan Supabase siguen separadas detrás del guard de proyecto aislado.

## Invariantes de conectores futuros

- Shopify es el único proveedor que puede considerarse operativo actualmente.
- Meta Ads, Klaviyo e Instagram deben mostrar `not_connected`, `unavailable`, `degraded` o estados equivalentes cuando no exista conexión real.
- El catálogo de integración es una capability flag, no una prueba de credenciales.
- Las métricas ausentes no se rellenan con promedios, datos demo ni inferencias presentadas como hechos.
- La UI consume contratos normalizados del dominio; añadir un proveedor no debe crear una pantalla paralela.
- Las acciones remotas de escritura requieren permiso runtime, conexión, idempotencia, dry-run, aprobación, rollback y auditoría.

## Invariantes de IA

Verificacion de ejecucion 2026-08-21: A01, A02, A04, A06, A09 y A11 persisten
`execution_mode = shadow`. Las tools de escritura del runtime solo construyen
propuestas; la unica materializacion de tareas pasa por `decideAgentOutput`, que
exige rol `consultant` o `platform_admin`, comprueba membership y deja registro
en `agent_approvals` y `audit_logs`. La ausencia de proveedores IA bloquea el
turno con estado explicito; no se generan respuestas ni datos simulados.

- `organization_id` y actor los fija el backend; el modelo nunca elige tenant.
- El registro de tools es la fuente de verdad de disponibilidad, permisos, versión y coste.
- Las tools planificadas sin executor no se exponen como operativas.
- `data_coverage` debe preceder a conclusiones sobre canales ausentes.
- El generador Klaviyo crea drafts sanitizados; no publica flows ni envía campañas automáticamente.
- El modo shadow y las propuestas revisables son el comportamiento por defecto del piloto.

## Gaps que no se pueden cerrar sin estado externo

1. Credenciales, scopes y cuentas reales de Meta Ads/Klaviyo/Instagram.
2. Edge cases de Shopify aún no repetidos en esta sesión: reenvío/orden de webhooks, desinstalación y bulk fallido.
3. Entorno aislado para pruebas RLS, backup/restore y recuperación.
4. Verificación visual/manual de todos los recorridos responsive y accesibles.

Estos gaps son condiciones de verificación, no autorización para simular datos ni escribir sobre la base de producción.

## Corrección de evidencia 2026-08-02

La verificación histórica posterior a DB-09/runtime confirmó 59 migraciones locales y remotas alineadas;
la comprobación vigente confirma 61,
`db push --dry-run` al día y `db lint` sin errores. Klaviyo dispone de reporting tenant-scoped
visible en Integraciones; la validación externa y la ausencia de credenciales siguen siendo estados
honestos, no datos simulados.

## Auditoria vigente 2026-08-24

### Evidencia incremental de cierre

- El portal web pasa sus tests directos 5/5 y los paquetes compartidos `ai`, `config`, `contracts`, `db`,
  `domain`, `integrations` y `observability` pasan sus typechecks directos 7/7.

- `supabase db lint --linked` no encuentra errores en `ai`, `extensions`, `private` ni `public`, y
  `supabase db push --linked --dry-run` confirma que no hay migraciones pendientes; no se escribio en
  produccion.
- `npx next build` pasa con Next 16.3.1 y genera 18 rutas estaticas. La compilacion directa de API y
  worker con TypeScript tambien pasa.
- La suite contractual unitaria del API pasa 53/53; IA 50/50; integraciones 14/14; SQL Gateway 31/31;
  worker 14/14. La auditoria de dependencias no encuentra vulnerabilidades `high/critical`.
- La observabilidad process-local cubre HTTP, runs/coste IA y jobs del worker; no se presenta como
  agregacion multi-instancia. Siguen abiertos restore drill, politicas de retencion/exportacion y
  validacion externa de proveedores.

Las 75 migraciones locales/remotas siguen alineadas y `regenerate-generated-schema.mjs --check` pasa.
Los gates de producto, catalogo UI, accesibilidad y enlaces Markdown pasan. Los contratos de integraciones
pasan 14/14 con `npx tsx --test`; la suite IA pasa 50/50. El CI manual genera SBOM, construye API/worker y
ejecuta Trivy; no se afirma un build Docker local en esta sesion. Shopify sigue siendo el unico conector
operativo; Meta, Klaviyo e Instagram no generan datos ficticios y esperan credenciales/validacion externa.
