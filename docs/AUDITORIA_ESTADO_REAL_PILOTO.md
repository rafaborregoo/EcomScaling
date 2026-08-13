# Auditoría de estado real — piloto EcomScaling

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
> estado vigente es 61 migraciones locales/remotas alineadas; `db push --dry-run` y `db lint` pasan.
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

| Área                                   | Estado                        | Evidencia local                                                                                                                                                                                                                                                                                          | Pendiente / condición de cierre                                                                          |
| -------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Objetivo y Definition of Done          | `verificado`                  | `docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md`                                                                                                                                                                                                                                                  | Revalidar cada fase contra esta matriz                                                                   |
| Portal cliente                         | `implemented_partial`         | `apps/web/src/app`, contratos frontend y estados compartidos                                                                                                                                                                                                                                             | Recorrido autenticado completo; estados y redirección verificados, falta sesión manual persistente       |
| Panel consultor                        | `implemented_partial`         | rutas `apps/web/src/app/consultor` y endpoints `apps/api/src/consultant.ts`                                                                                                                                                                                                                              | Validar permisos y flujo completo con fixtures aislados                                                  |
| Design system                          | `implemented_partial`         | `apps/web/src/components/ui`, ADR-0015 y componentes reutilizados                                                                                                                                                                                                                                        | Mantener un único origen; no crear `packages/ui` paralelo sin migración atómica                          |
| Dashboard/tareas/alertas/llamadas/plan | `implemented_partial`         | páginas y contratos de cada módulo; migraciones de dominio                                                                                                                                                                                                                                               | Verificar todos los estados en navegador                                                                 |
| Integraciones UI                       | `implemented_partial`         | `apps/web/src/app/integraciones/page.tsx`, catálogo y estados                                                                                                                                                                                                                                            | Completar recorrido de conexión real y reautorización                                                    |
| Shopify OAuth                          | `pilot_ready`                 | `apps/api/src/shopify.ts`, conexión real en producción, OAuth y tablas DB-04/DB-05                                                                                                                                                                                                                       | Reautorizar/desinstalar en una sesión manual si se requiere evidencia operativa adicional                |
| Shopify sync/webhooks                  | `pilot_ready`                 | `apps/api/src/shopify-sync.ts`, datos reales, 1.368 sync runs y webhooks/idempotencia/reconciliación                                                                                                                                                                                                     | Ejecutar edge cases de reenvío, orden, desinstalación y bulk                                             |
| Meta Ads                               | `prepared`                    | `apps/api/src/meta.ts`, `DB-06`, `INT-02`, selección de activos validada por organización y feature flag                                                                                                                                                                                                 | App/scopes/credenciales Meta y validación externa                                                        |
| Klaviyo                                | `prepared`                    | `INT-03`, contrato de conector, AI-11 y contrato de email IA                                                                                                                                                                                                                                             | API key/scopes reales; reporting y publicación permanecen desactivados                                   |
| Instagram                              | `prepared`                    | `INT-05`, catálogo y estados UI                                                                                                                                                                                                                                                                          | Credenciales y permisos del proveedor                                                                    |
| Datos demo/shadow                      | `implemented_partial`         | fixtures/evals y estados de conexión                                                                                                                                                                                                                                                                     | Confirmar que ningún seed entra en la ruta normal de producción                                          |
| Aislamiento multi-tenant               | `implemented_partial`         | RLS DB-02, `requireMembership`, clientes scoped y tests                                                                                                                                                                                                                                                  | Ejecutar validación RLS aislada; nunca contra producción                                                 |
| Agentes IA                             | `implemented_partial`         | `apps/api/src/ai-runtime.ts`, `packages/ai/src/index.ts`                                                                                                                                                                                                                                                 | Completar executors del catálogo y evals de producción                                                   |
| Evidencia y citas                      | `implemented_partial`         | `AgentOutputEnvelope`, fuentes y trazas de runs                                                                                                                                                                                                                                                          | Aumentar cobertura por agente y verificar UI                                                             |
| Costes y límites                       | `implemented_partial`         | `checkOrganizationDailyBudget`, `get_budget_status`, budgets por turno                                                                                                                                                                                                                                   | Configuración por plan/agente sigue pendiente                                                            |
| Aprobación humana                      | `implemented_partial`         | `decideAgentOutput`, guards runtime y estados de propuestas                                                                                                                                                                                                                                              | Recorrido manual de cada tipo de propuesta                                                               |
| Tool Layer                             | `implemented_partial`         | `packages/ai/src/tool-layer.ts`, `packages/ai/src/index.ts`, `apps/api/src/ai-runtime.ts`, AI-00A; lecturas SQL/conocimiento/cobertura/presupuesto, seis lecturas de dominio, listas paginadas, tools de abstención/calidad, `dry_run_write`, fixture de replay `tool-replay-v1` y contratos Zod activos | Registrar executors restantes, conectar replay al runner completo y normalizar todas las respuestas      |
| `data_coverage`                        | `implemented_partial`         | executor en `apps/api/src/ai-runtime.ts`                                                                                                                                                                                                                                                                 | Añadir freshness específica por dataset cuando existan syncs                                             |
| Generación Klaviyo IA                  | `implemented_partial`         | `packages/ai/src/index.ts`, `apps/api/src/ai-runtime.ts`, migración AI-11 y `apps/web/src/app/marketing/page.tsx`: agente A11, persistencia de drafts, HTML sanitizado, preview aislado y decisión humana con razón auditable                                                                            | Falta validación con credenciales Klaviyo reales y publicación/envío tras scopes, dry-run e idempotencia |
| Observabilidad                         | `implemented_partial`         | audit log, agent runs/tool calls, métricas Prometheus process-local, redacción de secretos, hooks HTTP y jobs del worker correlacionados con `job_name`/`job_id`/`correlation_id`                                                                                                                        | Agregación multi-instancia/APM cuando exista infraestructura externa                                     |
| Tests/typechecks/build/lint            | `verificado` en alcance local | batería contractual/unitaria API 75/75, typecheck API/web y `next build` con 18 rutas; contrato de estados web 1/1; ESLint web sin errores (`--quiet`)                                                                                                                                                   | Ejecutar gates completos de CI y reducir warnings restantes de hooks antes del piloto                    |
| Backup/restore y RLS operativo         | `pendiente`                   | runbooks/roadmaps existentes                                                                                                                                                                                                                                                                             | Entorno aislado y procedimiento probado                                                                  |

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

## Corrección INT-03 (2026-08-02)

La preparación de Klaviyo ya incluye configuración opcional validada y primitives OAuth/PKCE aislados
en `packages/config/src/index.ts` y `apps/api/src/klaviyo-oauth.ts`. No hay todavía ruta, persistencia
de credenciales ni runner de sync; por eso el conector continúa mostrándose como no disponible.

La evidencia directa adicional de esta preparación es: 2 tests de OAuth/PKCE de Klaviyo, 15 tests de
configuración de entorno y 4 tests del contrato común de adapters (incluidos estados no disponibles).

## Invariantes de conectores futuros

- Shopify es el único proveedor que puede considerarse operativo actualmente.
- Meta Ads, Klaviyo e Instagram deben mostrar `not_connected`, `unavailable`, `degraded` o estados equivalentes cuando no exista conexión real.
- El catálogo de integración es una capability flag, no una prueba de credenciales.
- Las métricas ausentes no se rellenan con promedios, datos demo ni inferencias presentadas como hechos.
- La UI consume contratos normalizados del dominio; añadir un proveedor no debe crear una pantalla paralela.
- Las acciones remotas de escritura requieren permiso runtime, conexión, idempotencia, dry-run, aprobación, rollback y auditoría.

## Invariantes de IA

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
