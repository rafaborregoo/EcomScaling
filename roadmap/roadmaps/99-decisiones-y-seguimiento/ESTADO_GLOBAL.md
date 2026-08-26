# Estado global

Correccion de evidencia 2026-08-26: `npx tsx --test packages/ai/src/index.test.ts` termina en
57/57. Las cifras inferiores que aparecen en notas historicas quedan superseded por esta ejecucion.

Shopify, el copiloto, el panel de agentes y las notificaciones completan ahora el contrato
transversal de resiliencia de UI: los errores de transporte son visibles, los estados ocupados
se liberan siempre y la interfaz no refleja mutaciones no confirmadas por el backend.

El panel de Consultor aplica ahora el mismo contrato de estados a la administracion
multi-tenant: carga de acceso y tiendas, altas de miembros/asignaciones, edicion de clientes,
eliminacion y restauracion. Las excepciones de red son visibles, los botones se liberan siempre
y ningun cambio local se presenta como aplicado sin confirmacion remota.

## Corrección vigente 2026-08-26 - Robustez de UI, conectores y RAG

El Dashboard ya limpia en `finally` las cargas de Shopify, métricas Meta/Shopify,
configuración financiera y operaciones cuando `apiFetch` falla por red; las 12 rutas
del portal mantienen loading/error/empty y los gates de UI/accesibilidad pasan.
Las métricas de Shopify y Meta se solicitan además en paralelo con aislamiento por
proveedor, evitando que un timeout de Meta retrase o elimine un resultado válido de
Shopify.
La pantalla de Integraciones aplica la misma garantía a sus cargas de estado,
métricas e informes Klaviyo y activos Meta: captura errores de red, elimina datos
obsoletos y libera siempre los estados de carga, incluidos los cambios de conexión.
Las acciones de OAuth, reintento de sincronización y guardado de selecciones usan
la misma disciplina: los botones se desbloquean en `finally` y sólo se refleja
`syncing` después de una respuesta remota exitosa.
Conocimiento/RAG aplica el mismo contrato a carga de documentos, ingestión y
búsqueda semántica; una organización ausente deja la vista en estado vacío y un
fallo de red no borra resultados/documentos válidos de otra operación.
El componente reutilizable `AiDiagnosticSection` extiende esa garantía a todos
los diagnósticos IA: carga, regeneración y aprobación para crear tareas liberan
siempre sus estados y sólo mutan el output tras confirmación remota.
Operaciones/Tareas aplica el mismo criterio a carga, evaluación de reglas,
estados de tareas/alertas y comentarios: los errores de transporte son visibles,
no generan éxitos falsos y conservan el payload operativo disponible.
Mi Camino centraliza las mutaciones de planes estratégicos en un helper común;
activar, editar y añadir fases/hitos/tareas sólo recargan tras éxito confirmado y
mantienen abiertos los formularios cuando falla la red.
Marketing/Contenido aplica el mismo contrato a generación, aprobación humana,
edición e historial de borradores; nunca cierra una edición ni presenta una
decisión como aplicada sin respuesta remota confirmada.
Llamadas/Consultor aplica la misma disciplina a registro, análisis, resúmenes,
aprobaciones, notas y tareas; el helper común libera siempre el busy state y no
presenta una acción IA como exitosa si falla el transporte.
Configuración financiera y cobertura Shopify también quedan protegidas: los
formularios conservan sus valores ante fallos, los gastos bloquean duplicados
durante la operación y sólo se recarga la configuración después de éxito remoto.
Los triggers y reconciliadores de Shopify, Meta y Klaviyo usan claims condicionales
para evitar sincronizaciones duplicadas. El RAG centraliza su perfil versionado de
modelo, dimensiones y chunking. Estos avances no alteran los bloqueadores externos
de credenciales, App Review ni el restore aislado de Supabase.

## Corrección vigente 2026-08-26 - Readiness real de Supabase

La API y la web alcanzan correctamente Supabase: Auth health y una consulta
real del Data API público devuelven 200, el service role devuelve 200 y el host
PostgreSQL responde por TCP. El 401 del índice raíz de PostgREST era un falso
positivo del chequeo. El CLI y `psql` no están instalados, y el MCP de Supabase
devuelve falta de permisos. La URL oficial del MCP ya está añadida en
`.mcp.json`, pendiente sólo de su autorización OAuth. `SUPABASE_MIGRATION_READINESS.md` deja documentada la secuencia segura
para autorizar gestión, corregir la clave pública, comparar migraciones,
ejecutar advisors, aplicar DDL y regenerar tipos. No se declara la base remota
alineada hasta completar esas comprobaciones.

La CLI `2.109.1` vía `npx` sí pudo listar el historial remoto usando la URL de
PostgreSQL: el proyecto está aplicado hasta `20260824120000` y hay siete
migraciones posteriores locales pendientes. La conexión de gestión existe;
queda revisar advisors y autorizar explícitamente su aplicación, sin asumir
que producción ya las tiene.

`db push --dry-run` se probó sin modificar la base y falla antes de ejecutar por
`EUNKNOWN: uv_spawn` en Windows. Se conserva como bloqueo de tooling operativo;
la conectividad y el historial remoto sí están verificados.

La generación remota de tipos por CLI tampoco completó porque el daemon Docker
Linux no está activo; los tipos locales existentes se mantienen y no se declara
regeneración remota verificada.

## Corrección vigente 2026-08-26 - Validación navegable y fallback AI-26

La validación local con Supabase/API activos confirmó que Dashboard, Integraciones,
Conocimiento y Agentes cargan sin errores de consola. Se corrigieron breadcrumbs que
renderizaban `href=""` y la lectura de `agent_outputs` ausente en la tabla de agentes.

El endpoint de readiness de evaluaciones reconoce `PGRST205`, la respuesta de PostgREST
cuando AI-26 aún no está en el schema cache, y devuelve `local_prepared` sin simular
evidencia remota. Los errores de permisos continúan elevándose como error real.

La carga concurrente de las tres tarjetas de diagnóstico del dashboard ya está protegida
con single-flight por organización, agente, tienda y período. Así, una apertura simultánea
no duplica llamadas LLM antes de escribir el cache de 24 horas. La prueba directa pasa 3/3.

La observabilidad local incorpora `evaluateHttpSlo` y el endpoint interno protegido
`/health/slo`: calcula error rate y p95 a partir de las métricas del proceso y
devuelve estados `ok`, `degraded`, `critical` o `no_traffic`. Evidencia: observabilidad
9/9 y endpoint API 3/3. La agregación multiinstancia sigue siendo responsabilidad de
Redis/APM cuando se habilite infraestructura compartida.

El resumen multi-tienda del dashboard limita las peticiones Shopify a cuatro concurrentes,
conserva el orden de las tiendas y convierte errores individuales en estado vacío sin dejar
el loading bloqueado. Evidencia: test directo 2/2 y typecheck web correcto.

## Corrección vigente 2026-08-26 - Documentación histórica de IA y threat model

La auditoría de la cola detectó referencias antiguas que describían evals sólo
para A01/A02/A06/A08 y filas de SQO-04 sin controles. AI-06/AI-12 ahora dejan
como vigente la matriz offline de los diez agentes, el catálogo de tools y el
release gate; SQO-04 aclara que anti-injection, SBOM y Trivy ya tienen controles
locales. Las ejecuciones live y la validación operativa siguen separadas.

## Corrección vigente 2026-08-26 - RAG y memoria contra indirect prompt injection

AI-04 y AI-07 ya reflejan que documentos, Playbook, notas, conectores y
resultados de tools se tratan como contexto no confiable y se delimitan para
evitar instrucciones indirectas. La matriz de evals de los diez agentes y el
release gate cubren la propiedad; los gaps restantes son de estructura de
corpus/chunking/autoridad y de validación live de embeddings.

## Corrección vigente 2026-08-26 - Chunking estructural y autoridad RAG

El RAG ahora conserva encabezados, listas y tablas durante el chunking y
repite el contexto de sección al cortar bloques largos. El retrieval híbrido
aplica un boost pequeño y explícito por autoridad documental, manteniendo los
filtros de tenant, tienda y audiencia. La suite de `packages/ai` pasa 56/56 y
su typecheck pasa; la migración queda lista para aplicarse cuando se ejecute el
despliegue de Supabase.

La revisión de tipos confirma que `packages/db/src/database.types.ts` ya incluye
las columnas `authority`/`audience` y las firmas de `knowledge_search` y
`knowledge_search_hybrid`; no hay desalineación local. Las pruebas RAG/API
dirigidas pasan 5/5.

## Corrección vigente 2026-08-26 - Runbook de evals y degradación IA

Se añadió `RB-010-ai-eval-failed-or-degraded.md` y se incorporó al catálogo de
`SQO-06`. Define la contención cuando falla cualquier eval de los diez agentes,
el rollback a una versión aprobada, el tratamiento de prompt injection y datos
ausentes, la interacción con circuit breaker/timeouts y la validación offline,
shadow y live. También obliga a conservar evidencia y `traceId` redactados sin
activar versiones que no superen el release gate.

## Corrección vigente 2026-08-26 - Contratos de conectores verificados

Las pruebas contractuales directas de Meta, Klaviyo y Shopify pasan 15/15:
batch/deduplicación/idempotencia y modos de Insights de Meta; paginación segura,
Reporting API, `Retry-After` y permisos de Klaviyo; y validación de payloads de
webhook Shopify. La cobertura sigue siendo contractual/offline: no se presenta
como validación de cuentas reales ni sustituye App Review, scopes o credenciales.

## Corrección vigente 2026-08-26 - Matriz ejecutable de validación externa

`INT-08-EXTERNAL-CONNECTOR-VALIDATION-MATRIX.md` convierte los bloqueadores
externos en un checklist ejecutable: OAuth y scopes efectivos, identidad,
sync inicial/incremental, idempotencia, errores transitorios, recuperación,
freshness, tenant, UI, agentes y observabilidad. Define evidencia y criterios
de promoción separados para Shopify, Meta Ads, Klaviyo e Instagram, sin
simular ninguna respuesta de proveedor.

## Corrección vigente 2026-08-26 - Estados de producto completos

El verificador `assert-product-state-surface.mjs` encontró y se corrigió el
último gap: `apps/web/src/app/camino/page.tsx` y
`apps/web/src/app/integraciones/page.tsx` usan ahora `ErrorBlock` explícito.
La superficie completa confirma 12 rutas con loading, error y empty states;
el typecheck directo de la web también pasa.

## Corrección vigente 2026-08-26 - Threat model y testing de agentes sincronizados

`SQO-04` y `SQO-01` ya reflejan la situación actual: prompt injection directa e
indirecta tiene controles en el contexto no confiable, dataset versionado y
evals offline para los diez agentes, con release gate y evidencia preparados.
Sólo quedan pendientes las ejecuciones `shadow/live` con proveedores y datos
reales, además de fixtures contractuales externos.

## Corrección vigente 2026-08-26 - Cola de roadmaps sincronizada

`roadmap/ROADMAP_QUEUE.md` refleja ahora AI-16 a AI-31 como implementación local
parcial preparada, con sus bloqueos remotos separados. El siguiente bloque local
es UI/UX y accesibilidad; la cola ya no trata los evals, prompts, RAG, tools o
readiness de agentes como trabajo de diseño pendiente.

## Corrección vigente 2026-08-26 - Stack de orquestación IA verificado

LangGraph está integrado detrás de `AI_ORCHESTRATION_MODE=langgraph` como opt-in
para shadow/piloto; LangSmith se activa sólo con `LANGSMITH_TRACING=true` y
`LANGSMITH_API_KEY`, con redacción y sin payloads por defecto. El modo directo
sigue siendo el fallback seguro. Evidencia: LangGraph 2/2, LangSmith 2/2 y
configuración 20/20.

## Corrección vigente 2026-08-26 - Routing y presupuesto IA verificados

El runtime mantiene routing opcional por `agent_code`, fallback Anthropic →
OpenAI, presupuesto por turno, presupuesto por plan con multiplicador de
complejidad y circuit breaker fail-closed por organización. Evidencia local:
routing 2/2 y AI-09 5/5. No requiere claves para validar sus reglas.

## Corrección vigente 2026-08-26 - Shopify custom app habilitada correctamente

La readiness de Shopify considera configurada la app personalizada cuando
existen `SHOPIFY_CUSTOM_*`, aunque la app pública siga pendiente de revisión.
Así la UI no deshabilita OAuth para la vía custom que el backend ya soporta.
La app pública mantiene su configuración independiente para el cambio futuro.
Evidencia local: `integrations-configuration.test.ts` 3/3 y typecheck de API.

## Corrección vigente 2026-08-26 - Readiness de recuperación operacional

`recoverableErrorVerified` se deriva ahora de los sync runs reales: un fallo o
partial seguido por un éxito en la misma conexión. La readiness puede cerrarse
cuando el conector se recupera de verdad, pero no se simula antes de tener ese
historial. Evidencia local: `integrations-configuration.test.ts` 5/5 y typecheck
de API.

## Corrección vigente 2026-08-26 - Resiliencia RAG y OAuth

`VoyageEmbeddingProvider` y los intercambios OAuth de Klaviyo/Shopify usan la
política común de proveedores: `AbortSignal`, timeout, retries sólo para fallos
transitorios, backoff exponencial y status HTTP conservado para no reintentar
credenciales inválidas. Evidencia local: AI index 55/55, Klaviyo OAuth 4/4 y
typecheck de API correcto. `apps/api/src/embedding-batching.ts` es reutilizado
por la ingesta y el alta manual, limita a dos embeddings simultáneos y conserva
el orden de chunks; `memory-ingestion.test.ts` pasa 2/2. No requiere
credenciales reales para dejar el flujo preparado.

## Corrección vigente 2026-08-26 - Agentes preparados con prompts persistidos

A03, A05 y A07 ya tienen definición, prompt canónico de nueve secciones y versión
declarativa de futuras tools. Permanecen inactivos hasta conectar y validar
Meta/Instagram, evitando activar agentes cuyo runtime aún no tiene esas
herramientas. Evidencia: migración AI-22 y `agent-prepared-prompts.test.ts`.

## Corrección vigente 2026-08-26 - Contratos de tools futuras

La capa AI ya registra los contratos de lectura que necesitarán A03/A05/A07 para
Meta Ads e Instagram, con paginación, fechas, provenance y clasificación de
connector. El estado `planned` mantiene la autorización cerrada hasta que exista
executor, conexión y scopes aprobados. Evidencia: AI-23 y 6/6 tests de AI.

## Corrección vigente 2026-08-26 - Fathom publica frescura real

El consumidor de eventos Fathom actualiza `last_sync_at` únicamente después de
procesar el evento y materializar la llamada; también limpia los errores previos.
Los fallos registran `last_error_at` y un mensaje truncado, manteniendo la conexión
conectada para permitir reintentos y evitando presentar una reautorización falsa.
La readiness webhook-only y la salud de Integraciones ya consumen estas señales.
Evidencia local: `fathom-webhook-handler.test.ts` 4/4 y typecheck de API.

## Corrección vigente 2026-08-26 - Fan-out de I/O acotado

La reconciliación periódica de Meta ya no espera secuencialmente todas las cuentas
ni crea una tarea por cuenta: utiliza `mapWithConcurrency` con límite 3, devuelve
los resultados en el orden original y conserva el aislamiento de errores por
conexión. Evidencia local: `meta-sync-concurrency.test.ts` 2/2 y typecheck de API.

## Corrección vigente 2026-08-26 - Insights Meta en batch

La sincronización de insights de Meta construye payloads tenant-bound, descarta
registros sin `ad_id` o fecha, deduplica por `ad_id:metric_date` y realiza batch
upsert de filas y acciones. Esto elimina el patrón de una escritura de red por
fila sin cambiar las claves de idempotencia. Evidencia local:
`meta-sync-batch.test.ts` 3/3 y typecheck de API.

## Corrección vigente 2026-08-26 - Concurrencia común de conectores

El helper `apps/api/src/async-concurrency.ts` centraliza el límite de workers de
I/O y conserva el orden. Meta reconcilia hasta 3 conexiones y Klaviyo hasta 2;
Shopify y Klaviyo mantienen sus batch upserts existentes. La configuración evita
fan-out ilimitado y reduce esperas secuenciales sin alterar la idempotencia.
Evidencia local: suites de batch/concurrencia 5/5 y typecheck de API.

## Corrección vigente 2026-08-26 - Notificaciones robustas

`NotificationsBell` incorpora estado de error accesible, reintento, cierre por
Escape y un contador que solo cambia cuando el elemento estaba sin leer. Se evita
el loading permanente ante errores de red y se mantienen los estados loading/empty
reutilizables. Evidencia local: typecheck de web correcto.

> **FE-01 actualizado 2026-08-24:** el dashboard incorpora `OnboardingChecklist`, una ruta visual reutilizable para conectar Shopify, validar la primera sincronizacion y preparar Meta/Klaviyo sin mostrar datos simulados. `IntegrationStatusBadge` centraliza los estados de disponibilidad, configuracion y salud sin presentar “preparado” como “conectado”; su lógica pura tiene 4 tests directos. Typecheck web y formato pasan.
> `PortalShell` tambien comunica suspension de organizacion, suscripcion no activa y reautorizacion pendiente de Shopify.
> Backend tambien aplica `requireOperationalOrganization` a configuracion financiera, costes Shopify, operaciones y llamadas; test directo 4/4.
> El runtime de agentes IA y planes estrategicos tambien reutilizan el guard para bloquear efectos en tenants no operativos.
> Meta, Klaviyo y conocimiento/RAG por organizacion tambien validan el guard antes de persistir o cambiar configuracion.
> Shopify valida el mismo guard en inicio de OAuth y trigger de sync; el callback sigue protegido por state, HMAC y comprobaciones del proveedor.
> Los workers de Shopify, Meta y Klaviyo también revalidan el tenant y la suscripción inmediatamente antes de persistir datos.

> **Meta OAuth actualizado 2026-08-24:** el callback verifica `debug_token`, valida el app id y compara permisos concedidos con `META_SCOPES`; si faltan scopes no persiste el token ni activa la conexión. Los scopes almacenados son los concedidos por Meta.
> **Klaviyo OAuth actualizado 2026-08-24:** autorización con scopes separados por espacios y persistencia del `scope` concedido; respuestas sin permisos verificables no activan la conexión.
> **Instagram actualizado 2026-08-24:** contrato reutilizable de `facebook_login`/`instagram_login` con hosts, scopes, dependencia de Página y limitaciones; test de catálogo 9/9. El adapter real continúa correctamente no disponible.

> **INT-00/INT-02/INT-03/INT-05 actualizado 2026-08-24:** cada proveedor expone `provider.configuration.status` (`configured`, `credentials_missing`, `feature_disabled`, `not_implemented`) y la UI habilita OAuth solo cuando corresponde. Test de contrato de activación 1/1; no requiere credenciales reales.

## Matriz canonica vigente 2026-08-24

Esta matriz prevalece sobre las tablas historicas inferiores del documento:

| Fase                                            | Estado vigente                                            | Evidencia resumida                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| DB-07 alertas/tareas/Mi Camino                  | `done`                                                    | Triggers de historial y aislamiento, tareas idempotentes, enlaces Mi Camino y tests reales documentados.   |
| DB-08 llamadas/runtime IA                       | `done`                                                    | Transcripcion actual unica, RLS published-only, aprobacion y trazabilidad de runs.                         |
| BE-01 identidad/tenancy                         | `done`                                                    | Auditoria de rutas, suspension, consultor asignado y escrituras cross-tenant con tests reales.             |
| BE-05 operaciones                               | `done`                                                    | Alertas/tareas auditables y resumen ligado a la version correcta de transcripcion; 4 tests de visibilidad. |
| AI-00 contratos/runtime                         | `done`                                                    | Suite IA 53/53, prompt estructurado, política común, presupuestos, tools, trazas y aprobación humana.      |
| OPS-01 piloto Shopify                           | `verification_pending`                                    | Shopify operativo; falta backup configurado y restore drill real.                                          |
| INT-02 Meta / INT-03 Klaviyo / INT-05 Instagram | `blocked` / `implemented_partial` / `implemented_partial` | Contratos y UI preparados; faltan credenciales, permisos y validacion externa.                             |

> Correccion vigente 2026-08-24: DB-07 (alertas/tareas/Mi Camino) y DB-08
> (llamadas/runtime IA) cumplen sus criterios funcionales y se reclasifican
> como `done`; la division editorial en subfases queda como deuda no
> bloqueante. La reconciliacion Shopify tambien clasifica `exact`, `warning` y
> `mismatch` con tests directos 4/4. BE-01 tenancy tambien cumple sus
> criterios y se reclasifica como `done`; BE-05 operaciones tambien cierra sus
> criterios tras los 4 tests de visibilidad de resumenes. El typecheck del API
> y web pasa. AI-00 contratos/runtime base tambien cumple sus criterios y se
> reclasifica como `done`; AI-03 y AI-04 conservan gaps de endurecimiento y
> diseño de retrieval, respectivamente.

> **Auditoria vigente 2026-08-24:** las 64 migraciones locales/remotas siguen
> alineadas; el schema generado, los gates de portal/UI/accesibilidad y enlaces
> Markdown pasan. Los tests actuales de contratos de integraciones pasan 14/14
> con `node:test` y la suite de contratos/calidad IA pasa 53/53 con `tsx`.
> Shopify es el unico conector operativo; Meta/Klaviyo/Instagram conservan
> estados preparados o bloqueados por validacion externa, sin datos inventados.

> **Incremento de cola 2026-08-24:** `roadmap/ROADMAP_QUEUE.md` es ahora la cola
> canónica de ejecución por bloques. El bloque AI-05 sigue `in_progress`: la política
> `buildAgentSystemPrompt` se aplica antes del prompt específico en Anthropic y OpenAI,
> exige contexto verificado, separación de hechos/inferencias, abstención ante datos
> insuficientes, evidencia/fuentes y aprobación humana. Verificado con 53/53 tests de
> `packages/ai` y typecheck del paquete.

> **Decisión IA 2026-08-24:** [ADR-0017](../../../docs/decisions/ADR-0017-rag-y-fine-tuning.md)
> fija RAG como fuente de conocimiento vivo y fine-tuning como experimento posterior para
> comportamiento estable. No se entrenará con datos actuales, secretos ni PII de clientes.

> **AI-13 vigente 2026-08-24:** la migración `20260824120000_ai_13_canonical_prompt_sections.sql`
> está aplicada local y remotamente. A01, A02, A04, A06, A09 y A11 tienen nuevas versiones
> activas con las nueve secciones canónicas; las versiones anteriores permanecen auditables.

> **FE-08 vigente 2026-08-24:** `AsyncState` centraliza los estados loading/error/empty y ya se
> usa en Integraciones; `ErrorBlock` expone `role="alert"`. El gate de accesibilidad pasa,
> el typecheck web pasa y ESLint queda en 0 errores y 13 warnings conocidos de hooks.
> La misma abstracción se extendió al estado de carga inicial del `PortalShell`.
> También se aplica a Configuración, Shopify y Diagnóstico Shopify.
> La cobertura se amplió a Conocimiento, Tareas, Llamadas, Marketing, Consultor, Agentes y Mi Camino;
> los estados internos de operaciones específicas siguen siendo explícitos y no se mezclan con la carga de página.

> Evidencia adicional vigente 2026-08-24: el registro process-local del API
> expone `http_requests_total`, `ai_runs_total` y
> `ai_estimated_cost_usd_total`; la cobertura IA incluye diagnosticos, A01,
> A11 y A09/chat. No se presentan estas metricas como agregacion multi-
> instancia: worker, sync y APM compartido siguen pendientes de infraestructura
> **SQO-02 actualizado 2026-08-24:** el mismo registro expone también el histograma
> `http_request_duration_ms` con buckets, `_count` y `_sum` por método/ruta/estado;
> la suite de observabilidad pasa 6/6 y el typecheck del API pasa. La limitación
> multiinstancia permanece explícita.
> El chequeo operativo también sanitiza los detalles antes de publicarlos en el
> artifact/issue de GitHub, incluyendo tokens embebidos en mensajes de error;
> `ops-health-check.test.ts` pasa 1/1.
> Los workflows de salud, alertas y reconciliación Shopify también hacen preflight
> de secretos; salud valida el schema del artifact. Sus cron siguen preparados,
> pero desactivados por decisión operativa hasta autorizar automatización de producción.
> externa.

> Correccion AI-09 2026-08-21: ademas de `AI_MODEL_ROUTING_JSON`, el runtime admite
> `AI_PLAN_BUDGETS_JSON` para aplicar limites diarios, coste por turno, numero de tools y
> multiplicador de complejidad por plan. El `plan_code` se obtiene de la suscripcion activa del
> tenant; la politica permanece server-side y los defaults siguen siendo seguros si falta o es invalida.

## Evidencia vigente 2026-08-24

- El dashboard ya dispone de una composición adaptativa determinista (`AdaptiveFocus`) alimentada por
  `/v1/organizations/:organizationId/operations`: prioriza alertas críticas, tareas vencidas y urgentes,
  después la salud de Shopify/Meta y los KPIs disponibles. Mantiene estados loading/error/empty y no
  permite que el modelo cambie el layout.
- A02 ya se presenta en el dashboard como `Resumen ejecutivo IA` reutilizando `AiDiagnosticSection` en
  variante compacta: responde desde cache cuando existe y comunica fuentes, groundedness, completitud,
  confianza, warnings y propuestas pendientes sin ejecutar escrituras.
- El runtime IA ahora comprueba un circuit breaker fail-closed por organización antes de sus cuatro puntos
  de entrada. Tres runs `failed` en los últimos cinco minutos abren el circuito durante esa ventana;
  los fallos de validación de salida y de presupuesto no lo activan. El estado se lee de `agent_runs`,
  por lo que no depende de memoria local ni de una sola instancia API.
- AI-09 ya admite `AI_MODEL_ROUTING_JSON` como configuración opcional: permite elegir modelo Anthropic/OpenAI
  y budget por agente, con límites saneados y defaults conservadores si falta o es inválido. No requiere
  migración ni claves; la política automática por plan/complejidad queda pendiente.
- El typegen real de Supabase está integrado en `packages/db/src/database.types.ts` y exportado desde
  `packages/db/src/index.ts`. El endpoint de Management API/MCP requiere privilegios que la cuenta no
  tiene, pero el CLI oficial funciona mediante `SUPABASE_DB_URL` y la validación TypeScript pasa.
- Esta nota supersede las cifras históricas de migraciones o typegen de entradas anteriores; la fuente
  ejecutable actual continúa siendo `supabase/migrations/` y la verificación enlazada de producción.

> **Corrección de tabla histórica 2026-08-20:** las filas ejecutivas antiguas que todavía muestran
> DB-09/BE-06/INT-03 como `planned`, INT-02 sin acción canónica o INT-05 sin foundation son
> snapshots históricos del roadmap. La verdad vigente está en las correcciones de esta cabecera:
> DB-09/INT-03 están en `implemented_partial`, Meta está bloqueado solo por validación externa e
> Instagram tiene foundation DB-10 aplicada. No usar esas filas antiguas para decidir el estado actual.

> **Estados canónicos de integraciones 2026-08-20:** DB-09/INT-03 = `implemented_partial`;
> DB-10/INT-05 = `implemented_partial` (foundation/contrato, sin OAuth-sync real); DB-06/INT-02 =
> `blocked_external_validation`. Las filas históricas equivalentes que aparecen más abajo quedan
> expresamente supersedidas por este bloque.

> Gate DB-10 2026-08-20: `scripts/assert-instagram-foundation.mjs` está conectado a CI y verifica
> seis tablas con RLS/políticas/grants, además de rechazar mutaciones de datos de negocio en la
> migration de foundation.

> Correccion de seeds 2026-08-20: ademas del opt-in explicito, los seeds de
> Supabase y Shopify comparan el destino con sus referencias/dominio de
> produccion y abortan antes de cualquier escritura si coinciden. CI verifica
> ambas barreras.

> Correccion AI-00A 2026-08-20: `get_budget_status` pertenece al nucleo del
> runtime, no al conector Meta; asi los limites diarios siguen operativos en el
> piloto Shopify-only. La regresion de Tool Layer deja la suite AI aislada en
> 47/47.

> Correccion DB-10 2026-08-20: `20260820110000_db_10_instagram_foundation.sql`
> esta aplicada en remoto. El estado vigente es 64 migraciones locales/remotas
> alineadas; las seis tablas Instagram estan vacias y protegidas por RLS.

> Correccion SQO-04 2026-08-20: el threat model es `implemented_partial`, no
> `planned`; la matriz de 17 amenazas y sus controles/tests es vigente. Los gaps
> que dependen de infraestructura o conectores futuros siguen explicitamente
> abiertos.

> Correccion SQO-05/06 2026-08-20: se crearon las fases documentales de
> disaster recovery y runbooks operativos. SQO-05 queda `verification_pending`
> por el drill de restore aislado; SQO-06 queda `implemented_partial` con 9
> runbooks y checklist de salud. No se afirma evidencia externa inexistente.

> Corrección de conectores 2026-08-20: Meta Ads queda `blocked_external_validation`,
> no por falta de esquema local: la acción de compra canónica y su selección
> auditable están implementadas en DB-06/BE-04. Klaviyo queda
> `implemented_partial` con OAuth, sync, Reporting API, backfill incremental y
> reconciliación reciente; falta validación externa y profundidad funcional. Cada
> workflow declara un gate fijo por proveedor, y el default sin flags solo permite
> Shopify. No se generan activos, campañas, insights o perfiles ficticios.

> Seguridad de tests 2026-08-20: el `test` normal de API ejecuta únicamente la
> suite unitaria/contractual sin I/O remoto. Las suites RLS y cross-tenant que
> crean fixtures requieren `test:remote` más `RUN_REMOTE_MUTATION_TESTS=1`, un
> `SUPABASE_TEST_PROJECT_REF` que coincida con `SUPABASE_URL` y que sea distinto
> de `SUPABASE_PRODUCTION_PROJECT_REF`; así no pueden apuntar accidentalmente a
> producción.

> El workflow CI también ejecuta `scripts/assert-safe-test-surface.mjs`, que
> impide que la suite mutable vuelva accidentalmente al comando `test` normal.

> Verificacion de base de datos 2026-08-20: `supabase migration list --linked`
> devuelve 64 migraciones con `local == remote`; `supabase db push --linked
--dry-run` confirma que la base remota está al día y `supabase db lint` no
> encuentra errores en `public`. No se escribieron datos durante esta comprobación.

> Seguridad de dependencias 2026-08-19: Next.js y `eslint-config-next` actualizados
> a `16.3.1`, `nanoid` fijado a `3.3.18` mediante override transitivo y
> `node scripts/audit-guard.mjs` pasa con 0 vulnerabilidades high/critical de
> produccion. El build web con Next 16.3.1 genera las 18 rutas estaticas; los
> typechecks de web y API tambien pasan.

> BE-00 operacion 2026-08-19: el daemon Docker se inicio localmente y los
> Dockerfiles de API y worker se construyeron con exito (`ecomscaling-api:verify`
> y `ecomscaling-worker:verify`). Las imagenes compilan, hacen prune de dev
> dependencies, usan usuario no-root y declaran healthcheck. El escaneo manual
> de runtime ya esta limpio; queda automatizarlo en CI y
> arrancar integrado con Supabase/Redis reales.

> Escaneo Docker 2026-08-19: Docker Scout sobre la etapa final `runtime` de
> API y worker devuelve 0 paquetes vulnerables critical/high. El escaneo global
> conserva hallazgos de herramientas del builder que no llegan a runtime; queda
> como hardening de CI separado del riesgo de producción.

> Verificacion de suites 2026-08-19: API contractual 43/43, worker 13/13, web
> 5/5, AI 47/47, config 15/15, integraciones 8/8 y observabilidad 5/5.

> La automatizacion del escaneo Docker requiere Docker ID/PAT en CI: el
> contenedor oficial de Scout rechaza la ejecucion sin autenticacion. Se
> mantiene como dependencia externa explicita y no como un falso verde.

> Smoke runtime Docker 2026-08-19: API responde `/health` 200 con variables
> sinteticas; worker pasa su healthcheck contra Redis 7 efimero. Los recursos
> locales fueron eliminados al terminar y no hubo acceso a datos de negocio.

> Las correcciones históricas posteriores a esta cabecera son contexto y no
> sustituyen la matriz canónica vigente. En particular, Klaviyo ya no debe
> describirse como un vertical slice inexistente: OAuth, persistencia, sync,
> reporting e idempotencia están preparados; siguen fuera de verificación la
> cuenta real, el backfill profundo, el reporting visual completo y el envío.
> BE-00 ya tiene builds y smoke runtime locales; queda integración con servicios
> reales y automatización de Scout con credenciales CI.

> **Preparacion de alta de cliente 2026-08-03.** Tres huecos que solo se habrian
> notado con un cliente ya conectado quedan cerrados, sin credenciales externas:
>
> 1. **Meta Ads** tenia solo import inicial. `runMetaSync(env, connectionId, mode)`
>    parametriza import completo (90 dias de insights) e incremental (28 dias, la
>    ventana en la que Meta reatribuye conversiones), `reconcileAllMetaConnections`
>    recorre las conexiones `connected` y `meta-reconcile.yml` lo ejecuta a diario.
>    El adaptador ya propaga el modo en lugar de ignorarlo. INT-02 sigue
>    `blocked_external_validation`: esto no sustituye la validacion con cuenta real.
> 2. **Klaviyo** no tenia backoff HTTP (ADR-0006 punto 5). El cliente respeta ahora
>    `Retry-After` y aplica backoff exponencial con jitter para 429/5xx, sin
>    reintentar 401/403/404. Critico con las cuotas de Reporting API (~2/min).
> 3. **Klaviyo** solo cubria 7 dias: el reconciliador rellena ademas un mes
>    pendiente del historico de 12 por pasada, autoreparable y sin agotar cuota.
>
> 4. **Meta Ads** contaba las compras tres veces. `meta_spend_summary` sumaba
>    `purchase` + `omni_purchase` + `offsite_conversion.fb_pixel_purchase`, que
>    Meta emite en paralelo para la misma conversion: una cuenta con pixel +
>    CAPI habria mostrado ROAS inflado 2-3x sin que nada fallase. La migracion
>    `20260803120000_int_02_canonical_purchase_action_type.sql` (**aplicada
>    2026-08-03**; historial en 64 migraciones locales/remotas alineadas) fija
>    un `action_type` canonico por cuenta con
>    procedencia auditable, y `GET/PUT .../meta/purchase-action-types` permiten
>    revisarlo contra los tipos realmente observados. Cierra el pendiente
>    `canonical_purchase_action_type` que INT-02 arrastraba.
>
> **Correlacion de errores end-to-end 2026-08-03 (SQO-02/BE-00).** El
> `x-request-id` se ponia en cada respuesta desde el 2026-08-02 pero no llegaba
> a nadie: el CORS del API no lo declaraba en `exposedHeaders` — el navegador
> se lo oculta a `apps/web` en respuestas cross-origin — y `readApiError`, por
> donde pasan los errores de las 12 pantallas autenticadas, lo descartaba. Es
> decir, la cabecera solo servia si ya estabas leyendo los logs del servidor,
> justo lo que no tienes cuando un cliente reporta un error. Corregidos los
> dos: el mensaje termina en `(ref: <request id>)` y sin cabecera no se anade
> ruido. De paso, `apps/web` tenia `portal-state-contract.test.ts` sin
> ejecutarse en ningun sitio: ya hay `npm run test -w web` y un paso en CI.
> Evidencia: web 5/5, `api:test:unit` 43/43, typecheck y lint del monorepo.
>
> **Escaneo de dependencias 2026-08-03 (BE-00, nota historica).** `npm audit` no se habia
> corrido nunca: **17 vulnerabilidades, 13 high**. La causa principal era
> `@vercel/node` en `dependencies` de `apps/api` usado solo para dos
> `import type`; sustituidos por los tipos de `node:http` cae toda la cadena de
> build de Vercel (`undici`, `path-to-regexp`, `js-yaml`, `minimatch`...) del
> arbol de produccion: 17 → 6. `npm audit fix` sin `--force` resolvio otras
> tres, incluida `find-my-way`, el router de Fastify en produccion: 6 → 3. Las
> 3 que quedaban eran del arbol de Next. Esta nota queda supersedida por la
> verificacion 2026-08-19: Next 16.3.1, override de `nanoid` 3.3.18 y 0
> vulnerabilidades high/critical; el guard ya no mantiene excepciones.
>
> **Crones rotos por secretos no declarados 2026-08-03 (OPS-00).** `loadApiEnv`
> exige las credenciales de Shopify siempre, aunque el proceso no toque
> Shopify. `klaviyo-reconcile.yml` (desde su creacion) y `meta-reconcile.yml`
> no las declaraban: ambos crones abortaban al arrancar antes de leer una sola
> conexion, apareciendo como jobs rojos faciles de confundir con un fallo del
> proveedor externo. Corregidos y protegidos por
> `apps/worker/src/cron-workflow-env.test.ts` (9/9, ya en CI), que pasa a
> `loadApiEnv` real lo que cada workflow declara en vez de repetir una lista.
> La matriz de secretos por entorno — entregable pendiente de OPS-00 — queda en
> [`MATRIZ_SECRETS.md`](../07-operacion-despliegue/MATRIZ_SECRETS.md).
>
> **Motor financiero: golden test numerico 2026-08-03 (DB-03).** El gap
> "sin ejemplos numericos completos ni golden tests" queda cerrado con
> `apps/api/src/db-03-financial-engine-golden.test.ts` (3/3 contra Supabase
> real): un caso de 31 dias exactos que fija termino a termino COGS, comisiones,
> envio, prorrateo de gastos fijos (dias/30,44), beneficio neto, margen y
> break-even. La formula completa queda escrita en el documento de fase DB-03.
> Dos hallazgos que el test fija a proposito, ambos **sin corregir por ser
> cambios de diseño del motor, no verificaciones**: `shipping_cost_rules` es
> CRUD-able desde `/configuracion` pero ninguna funcion de metricas la lee (el
> envio siempre es `default_shipping_cost × pedidos`, y `shopify_order_facts` ni
> siquiera guarda pais para poder evaluarlas), y `vat_pct` no entra en el
> beneficio neto porque `net_sales` de Shopify ya viene sin impuestos.
>
> Evidencia: `apps/api:test:unit` 42/42 (incluye `klaviyo-client.test.ts`,
> `klaviyo-backfill.test.ts` y `meta-purchase-action-type.test.ts`, nuevos en
> CI), typecheck de API y worker correctos.
> Procedimiento de alta completo en
> [`runbooks/RB-009-alta-cliente-conectores.md`](../07-operacion-despliegue/runbooks/RB-009-alta-cliente-conectores.md).
>
> Verificacion de migraciones 2026-08-02 (lectura remota): `npx supabase
migration list --linked` devuelve 61 entradas con `local == remote`, incluida
> `20260801100000` (RAG). El directorio `supabase/migrations` contiene tambien
> exactamente 61 archivos SQL. No se ejecuto `db push` ni se modifico
> produccion durante esta comprobacion; las notas historicas que marcan RAG
> como pendiente quedan superseded por esta evidencia actual.

> **Design system vigente 2026-08-02.** `packages/ui` no existe por decisiÃ³n
> ADR-0015; no debe recrearse ni usarse como ruta de importaciÃ³n. El catÃ¡logo
> reutilizable activo es `apps/web/src/components/ui` sobre HeroUI v3 y las
> pantallas lo consumen mediante `@/components/ui`. Las menciones histÃ³ricas a
> `packages/ui` quedan documentales, no son un trabajo pendiente.

> Correccion FE-00 2026-08-02: las pantallas de portal, consultor y el bloque
> diagnostico reutilizan ahora `apps/web/src/lib/api-error.ts` para leer el
> contrato publico de errores; se eliminaron ocho implementaciones locales
> divergentes y se alinearon los estados de fallo. Typecheck web y Prettier de
> las superficies afectadas pasan.

## Matriz canonica vigente — 2026-08-19

Esta matriz tiene prioridad sobre las tablas historicas de este documento. Los estados antiguos se
conservan para explicar decisiones, pero no describen el estado actual:

> **Overrides canónicos 2026-08-19.** Las filas históricas inferiores que
> todavía conserven estados anteriores quedan superseded por esta lista:
> `BE-00=implemented_partial` (health/readiness, builds y smoke runtime activos;
> falta integracion con servicios reales y automatizacion de Scout en CI), `BE-01=current` (aislamiento y escritura cross-tenant
> verificados), `BE-02=implemented_partial` (contratos, feature flags y
> adaptadores), `BE-03=pilot_ready` para Shopify, `BE-05=functionally_complete`
> con decisión documental pendiente, `BE-06=implemented_partial` para Klaviyo,
> `INT-01=pilot_ready`, `INT-03=implemented_partial`, `INT-05=prepared_dependency`,
> `FE-00=current`, `FE-06=shadow_pilot`, `AI-00=shadow_pilot`,
> `AI-03=implemented_partial`, `SQO-00=implemented_partial`,
> `OPS-01=verification_pending` y `OPS-02=implemented_partial`. Los únicos
> bloqueos externos siguen siendo credenciales/App Review de Meta/Klaviyo,
> Fathom y el secret + drill real de backup; no son tareas de código que deban
> aparecer como "sin iniciar".

| Area                           | Estado vigente                | Evidencia / limite real                                                                                                      |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| DB-09 / INT-03 / BE-06 Klaviyo | `implemented_partial`         | OAuth PKCE, sync, Reporting API, reconciliacion reciente, UI y contratos preparados; falta cuenta real y validacion externa. |
| DB-04 / INT-01 Shopify         | `pilot_ready`                 | OAuth, sync, webhooks, reintentos, reconciliacion, metricas y diagnostico; 64 migraciones alineadas.                         |
| INT-02 / BE-04 Meta Ads        | `blocked_external_validation` | Adaptadores, OAuth, discovery, metricas y UI preparados; falta App Review/credenciales reales.                               |
| INT-05 Instagram               | `prepared_dependency`         | Contrato y estados honestos preparados sobre Meta; sin sincronizacion real hasta permisos externos.                          |
| AI runtime                     | `shadow_pilot`                | Evidencia, trazas, coste, aislamiento y aprobacion humana; no se activa `live` por inferencia.                               |
| OPS-01 Piloto 1                | `verification_pending`        | Shopify no bloquea; queda backup configurado/ejecutado y drill de restauracion pospuesto explicitamente.                     |

> **Meta Graph API / Devtools MCP 2026-08-02.** Se han incorporado como referencias oficiales de INT-02
> la documentacion de [Graph API](https://developers.facebook.com/docs/graph-api) y el [Meta Devtools MCP](https://developers.facebook.com/documentation/mcp/devtools-mcp).
> El MCP queda clasificado como herramienta externa de desarrollo/operaciones, no como sustituto del
> conector de datos. Aplican scopes minimos, separacion dev/prod, aprobacion humana para escritura,
> auditoria periodica y defensa contra prompt injection.

> Migracion DB-04 2026-08-02: `20260802153000_db_04_webhook_fingerprint_connection_scope.sql`
> aplicada en produccion. La unicidad de fingerprints queda aislada por `provider + connection_id`;
> dry-run remoto indica al dia y `supabase db lint` no encuentra errores. El historial vigente queda
> en 64 migraciones locales/remotas alineadas, incluida `20260803120000_int_02_canonical_purchase_action_type.sql`.

> **Auditoría de escrituras sensibles 2026-08-02.** Se verificaron y reforzaron las mutaciones
> de operaciones y Mi Camino: mantienen guardas de membresía/capacidad y ahora registran actor,
> organización, acción y entidad mediante `recordAuditLog`. No se ha realizado ninguna escritura
> manual de datos de negocio en producción durante esta revisión.

> Verificacion AI 2026-08-02: la traza de agentes queda tolerante a timestamps historicos sin zona
> horaria, normalizandolos a ISO UTC durante el replay. `ai-observability-trace.test.ts` pasa 3/3 y
> los typechecks de API y `packages/ai` pasan. Los avisos `ECONNREFUSED` observados pertenecen a
> Redis local no iniciado durante los tests y no afectan a esta ruta.

> Correccion SQO-04 2026-08-02: las respuestas 5xx del API ya no exponen el
> campo interno `detail` de Supabase o proveedores. El detalle se conserva en
> logging estructurado para soporte y el navegador recibe solo el codigo de
> error y el mensaje funcional; los logs redactan credenciales comunes en detalles
> de proveedor. Regresion `server-failure-sanitization.test.ts` 4/4, incluyendo
> errores del contexto de autenticacion; typecheck API y Prettier correctos.

> Correccion FE-00/FE-03 2026-08-02: los estados vacios de alertas y tareas,
> gastos fijos, planes sin fases y asignaciones sin consultores disponibles usan ahora el componente comun `EmptyState`
> en vez de parrafos ad-hoc. Typecheck web y Prettier de las tres pantallas
> pasan; se mantiene la misma accion contextual para evaluar alertas o crear
> fases.

> Correccion FE-03/INT-01 2026-08-02: `/shopify` ya muestra un `EmptyState`
> accionable cuando no existe una conexion, con enlace a Integraciones y una
> explicacion explicita de que Meta Ads/Klaviyo no bloquean el inicio del
> piloto Shopify. Typecheck web y Prettier pasan.

> Correccion FE-00 2026-08-02: las ultimas superficies nativas detectadas en
> la auditoria (`MilestoneListItem` y seleccion de cuentas Meta) usan ahora
> `Button`/`Checkbox` del catalogo compartido; se mantiene el input de fichero
> nativo de Conocimiento porque es un control de carga oculto accionado por el
> boton accesible. Typecheck web y Prettier pasan.

> Correccion INT-00 2026-08-02: el parser de `INTEGRATION_FEATURE_FLAGS`
> acepta los nombres cortos (`meta_ads`) y los nombres canonicos del catalogo
> (`integration.meta_ads`). La regresion del paquete de integraciones pasa 6/6.

> Correccion INT-00 2026-08-20: si `INTEGRATION_FEATURE_FLAGS` está vacío,
> solo se habilita Shopify por defecto. Meta Ads y Klaviyo requieren opt-in
> explícito; Instagram continúa bloqueado por el catálogo. Esto evita que un
> entorno sin flags active conectores todavía no validados.

> Verificacion de datos demo 2026-08-02: los fixtures/mock encontrados quedan
> limitados a tests/evals; no hay fallback de metricas simuladas en las rutas de
> producto. El runtime usa marcadores honestos (`sin_datos`, `sin_datos_meta`),
> `source`/freshness y estados vacios cuando falta un conector o una fila.

> Correccion INT-05 2026-08-02: la preparacion de Instagram incorpora las dos
> rutas oficiales de Meta (Instagram Login y Facebook Login), con
> `authStrategy` opcional en el contrato compartido. INT-05 sigue sin ejecutar
> OAuth ni sync hasta validar permisos y credenciales reales. Paquete de
> integraciones: 8/8 tests.

> Correccion SQO-01/INT-00 2026-08-02: `integration-feature-flag-routes.test.ts`
> ya es autocontenido y no depende de `.env.local`; la suite contractual de
> adapters + feature flags pasa 6/6 en un runner limpio y el typecheck del API
> pasa. Se elimina un fallo real de CI sin tocar Supabase.

> Verificacion CI local 2026-08-02: las 11 entradas de `apps/api:test:unit`
> ejecutadas sin `.env.local` pasan 28/28, incluyendo AI, adapters, flags,
> observabilidad, sanitizacion de errores, Meta, Shopify SSRF e aislamiento de
> costes. No se realizaron escrituras remotas.

> Correccion INT-00/INT-03 2026-08-02: el catalogo de capacidades ya refleja
> el lifecycle real: Shopify y Klaviyo soportan refresh OAuth; Meta Ads marca
> reautorizacion al caducar el token. Catalogo + adapters: 10/10 tests.

> Correccion SQO-01 2026-08-02: el workflow de CI incorpora explicitamente las
> suites de `@ecomscaling/integrations` y `@ecomscaling/observability`; ya no
> quedan como una verificacion local separada.

> Correccion SQO-02 2026-08-02: la redaccion de credenciales embebidas se
> centraliza en `packages/observability` (`redactSensitiveText`) y se reutiliza
> desde el API. Suite conjunta de observabilidad/API: 9/9; typecheck API correcto.

> Correccion SQO-02 2026-08-02: cada respuesta del API incluye `x-request-id`
> para correlacionar soporte, logs Fastify y errores sin exponer datos de negocio.
> Verificado en `/health/live` con `observability-metrics-endpoint.test.ts` (1/1).

> Correccion SQO-01/SQO-02 2026-08-02: la regresion `server-failure-sanitization.test.ts`
> queda incorporada en `apps/api:test:unit`; la suite dirigida de observabilidad/API
> pasa 5/5 y CI ya la ejecuta como parte de los tests unitarios del API.

> Verificacion de regresion 2026-08-02: suite API completa ejecutada con `.env.local`: 202 tests,
> 201 pass, 0 fail y 1 skip esperado en Windows.

> Actualizacion de regresion 2026-08-02: tras el fix de reintentos Shopify, la suite API completa
> queda en 204 tests, 203 pass, 0 fail y 1 skip esperado en Windows.

> Actualizacion final de regresion 2026-08-02: con el scope por conexion verificado, la suite API
> completa queda en 207 tests, 206 pass, 0 fail y 1 skip esperado en Windows.

> Correccion ACL de integraciones 2026-08-02: `INTEGRATION_FEATURE_FLAGS` ya protege tambien
> los puntos de entrada internos, no solo las rutas HTTP. Los runners de Meta y Klaviyo rechazan
> invocaciones directas cuando el proveedor no esta en el allowlist; el reconciliador de Klaviyo
> sale sin consultar ni escribir Supabase. Esto evita que un worker o callback active un conector
> futuro por accidente antes de disponer de credenciales y validacion externa.

> Mejora OPS-01/RB-007 2026-08-02: el workflow diario de backup valida el dump con `pg_restore --list`
> y publica tambien su checksum SHA-256 junto al artifact. La restauracion real contra un proyecto
> desechable sigue siendo un gate operativo externo y no se ejecuta sobre produccion.

> Endurecimiento OPS-01/RB-007 2026-08-02: la subida del artifact usa `if-no-files-found: error`,
> por lo que un job sin dump no puede aparecer como backup correcto.

> Verificacion frontend 2026-08-02: `npx next build` en `apps/web` compila con Next 16/Turbopack,
> typecheck incluido y genera las 18 rutas sin errores.

> Verificacion Shopify 2026-08-02: el handler de webhooks puede reclamar de forma atomica un evento
> fallido para reintento, sin romper la deduplicacion concurrente. `db-04-webhook-idempotency.test.ts`
> pasa 3/3 contra Supabase real.

> Correccion vigente de auditoria 2026-08-19: los bloques posteriores que mencionan 59, 60 o 61
> migraciones son historicos y quedan supersedidos. El estado comprobado actualmente es 62
> migraciones locales/remotas alineadas y 134 archivos Markdown fuera de dependencias generadas.

> Nota histórica supersedida: hubo un estado intermedio de 59 migraciones locales y remotas alineadas. DB-09 usa la foundation
> `20260802140000_db_09_klaviyo_foundation.sql` más los alineamientos `20260802150000`, `20260802150100`
> y `20260802151000`; todos están aplicados.

> Actualización de verificación: `20260802152000_db_09_klaviyo_enum_compatibility.sql` también está
> aplicada; ese fue un estado intermedio: el total vigente comprobado es 64 migraciones locales/remotas alineadas.

> Corrección DB-09/runtime 2026-08-02: tras auditar el esquema real de producción se añadieron y
> aplicaron tres migraciones aditivas (estado intermedio de 59 migraciones alineadas). El contrato Klaviyo ahora cubre
> campos de compatibilidad, claves idempotentes, lectura de ejecuciones/valores y estados honestos;
> `GET /v1/organizations/:organizationId/klaviyo/reporting` y la pantalla de Integraciones muestran
> el reporting recibido sin convertir ausencia de filas en ceros. No se modificaron datos existentes.

> Correccion INT-03/DB-09/BE-06 2026-08-02: el vertical slice Klaviyo ya existe y la migracion
> `20260802140000_db_09_klaviyo_reporting.sql` esta aplicada y alineada en remoto. Incluye OAuth
> PKCE, cliente con revision fija, paginacion segura, credenciales cifradas y sync de metadatos
> agregados; los estados historicos `planned` de estas filas quedan supersedidos por
> `implemented_partial`. Reporting API y conversion metric configurable ya estan implementados;
> validacion externa, backfill/reconciliacion y reporting visual siguen pendientes sin fingir datos.

> Correccion operativa INT-03 2026-08-02: `klaviyo-reconcile.yml` y
> `apps/worker/src/klaviyo-reconcile-once.ts` ya ejecutan sync incremental y reporting reciente
> cada 6 horas, solo para conexiones `connected`, con idempotencia y sin-op cuando no hay cuentas.
> Backfill historico, reconciliacion profunda y reporting visual siguen pendientes.

> Verificacion histórica DB-09: 56 migraciones locales, 0 timestamps duplicados, historial local/remoto alineado,
> dry-run al dia y `supabase db lint --schema public` sin errores.

> Regresion FE-08 2026-08-02: `apps/web/src/portal-state-contract.test.ts` protege el contrato de
> loading, empty y error para las 12 rutas autenticadas y pasa 1/1; contempla estados contextuales
> visibles ademas de `EmptyState`/`ErrorBlock`.

> Corrección FE-02 2026-08-02: `PlatformIcon` incorpora fallback accesible para recursos de marca
> ausentes; el dashboard mantiene la señal visual de Klaviyo sin presentar conexión ni métricas ficticias.

> Corrección FE-06 2026-08-02: el Consultor IA y contenido revisable quedan documentados como
> `implemented_partial`; el copiloto lateral, chat persistido, fuentes/citas y errores diferenciados
> existen. Instagram y creatividades Meta siguen bloqueados por credenciales externas.

> Corrección FE-08/a11y 2026-08-02: el `PortalShell` compartido añade skip link, destino principal
> enfocable, foco visible global, `lang="es"` y respeto de `prefers-reduced-motion`.

> Verificación FE-08 2026-08-02: las 12 rutas autenticadas del portal tienen loading, empty y error
> explícitos según auditoría estática; login y páginas estáticas no consumen datos del portal.

> Verificación adicional 2026-08-02: los 10 workspaces pasan `tsc --noEmit` y la suite contractual
> aislada AI/config/integrations pasa 63/63 tests. Esto no sustituye las pruebas remotas de RLS.

> Verificacion de migraciones 2026-08-02: AI-11/versionado ya estaba aplicado en remoto y AI-14 se
> aplico como `20260802130100_ai_14_abstention_quality_tools.sql`; el historial local/remoto queda
> alineado. La agregacion multi-instancia/APM sigue pendiente de infraestructura externa.

> Correccion BE-02 2026-08-02: la fila historica que aun dice `planned` queda supersedida. El contrato
> comun `IntegrationAdapter` ya existe y sus tests cubren Shopify/Meta y estados honestos de Klaviyo e
> Instagram; BE-02 pasa a `implemented_partial`. OAuth/runners futuros, retry/circuit breaker y
> reconciliacion especifica por proveedor siguen pendientes.

> Correccion BE-00 2026-08-02: la fila histórica que decía que faltaban Dockerfiles queda supersedida;
> `apps/api/Dockerfile` y `apps/worker/Dockerfile` existen. BE-00 pasa a `verification_pending` hasta
> ejecutar un build Docker real en un entorno con Docker Desktop/WSL2.

> Correccion INT-03 2026-08-02: se añadieron configuración opcional y primitives OAuth/PKCE de Klaviyo
> (`packages/config` y `apps/api/src/klaviyo-oauth.ts`) con tests. El vertical slice, persistencia de
> credenciales y runner de sincronización siguen pendientes; Klaviyo continúa `not_available` sin secrets.

> Aclaracion DB-09/BE-06 2026-08-02: sus estados `planned`/`planned_after_mvp` se refieren al dominio
> de persistencia, reporting y sync, no contradicen la preparación OAuth aislada ya implementada.

> Corrección de evidencia 2026-08-02: la verificación local actual registra 45 tests del paquete
> AI, 18 tests unitarios API y 18 rutas web generadas por `next build`. Las pruebas remotas de RLS
> requieren credenciales explícitas y siguen pendientes de entorno aislado/ejecución autorizada.

> Corrección AI-11/AI-14 y SQO-02 2026-08-02: los drafts de marketing tienen edición versionada,
> historial consultable y cada edición vuelve a requerir aprobación humana. Las tools de abstención y
> calidad (`request_missing_data`, `escalate_to_human`, `flag_data_quality_issue`, `report_confidence`)
> tienen contratos y executors no mutantes; el worker propaga `job_name`, `job_id` y `correlation_id`.
> Las migraciones de catálogo/versionado quedan alineadas entre local y remoto tras la aplicación
> controlada de AI-14; la agregación multi-instancia/APM sigue pendiente de infraestructura externa.

> Correccion AI-11 2026-08-02: la Fase A del generador Klaviyo ya tiene agente A11,
> contrato JSON, sanitización HTML, persistencia de drafts, aprobación y preview seguro
> en `/marketing`. La salida es local y revisable; no publica ni envía automáticamente.
> La Fase B sigue pendiente de datos reales y Reporting API.

> Correccion AI-00A 2026-08-02: el Tool Layer incorpora seis lecturas de dominio
> (`get_organization_profile`, `get_strategic_plan`, `list_open_tasks`,
> `list_open_alerts`, `get_call_history`, `get_financial_settings`) con tenant
> fijado, limites y provenance. Sus contratos Zod y los estados del catalogo
> quedan verificados por 39 tests unitarios de `packages/ai`.

> Correccion AI-13 2026-08-02: el modo shadow de los agentes queda persistido en
> `agent_runs.execution_mode` mediante `20260802110000_ai_13_shadow_execution_mode.sql`.
> Diagnostico, A01 y A09 guardan `shadow` explicitamente; la API de listado/traza
> y `/agentes` lo muestran. `live` queda reservado para una activacion futura.

> Correccion BE-05/DB-08d 2026-08-02: los resúmenes de llamadas quedan ligados a `transcript_id` tanto
> en el flujo manual como en A01. La migración aditiva `20260802100000_be_05_call_summary_transcript_binding.sql`
> está aplicada; `migration list --linked` coincide local/remoto y `db lint` no encuentra errores. Los
> resúmenes históricos mantienen NULL y no se modifican.

> Correccion AI-10/FE-06 2026-08-02: la revisión humana de `/agentes` muestra el contrato real de
> auditabilidad (`findings`, `evidence`, `sources` y, si existe, `citations`) además de `proposed_writes`.
> No depende de un campo ficticio único para las citas; conserva las fuentes que el runtime normaliza.

> Verificacion SQO-01 2026-08-02: `npx eslint src` en `apps/web` pasa con 0 errores y 29 warnings. Los
> warnings son el patrón fetch-on-mount y dependencias de hooks ya documentados en la configuración del
> repositorio; CI no los trata como errores. No hay un fallo estático que bloquee el piloto.

> Correccion INT-03/FE-01 2026-08-02: la pestaña Klaviyo del dashboard ya no invita a conectar una cuenta
> que el backend todavía no puede autorizar. Muestra el estado preparado/no disponible, no métricas
> simuladas, y enlaza al estado del conector.

> Correccion AI-00/BE-01 2026-08-02: el guard de aprobacion IA tiene regresiones directas para consultor
> autorizado, owner de cliente (403) y ausencia de membership (403), sin I/O de base de datos. El endpoint
> sigue siendo el unico punto de materializacion; la bateria unitaria del API incluye
> `ai-agent-approval-guards.test.ts`.

> Correccion SQO-01 2026-08-02: `apps/api:test:unit` ya no carga `.env.local`; el job de CI puede ejecutar
> los 18 tests unitarios/contractuales en un runner limpio porque no requieren credenciales ni I/O de base
> de datos. El script `test` completo conserva el entorno para las suites remotas.

> Correccion 2026-08-02: `/agentes` incluye revision humana de salidas `pending_approval` con respuesta,
> evidencia, citas, `proposed_writes`, motivo y aprobar/rechazar mediante `/ai/outputs/:outputId/decision`. La aprobacion
> sigue siendo la unica via de materializacion; el backend registra `agent_approvals` y `audit_logs`.
> `RIESGOS.md` tampoco presenta staging como bloqueo del Piloto 1: R-015 permanece aceptado y los fixtures
> RLS de R-021 son manuales, aislados y nunca apuntan a produccion.

> Correccion FE-01 2026-08-02: el dashboard usa `EmptyState` compartido cuando Shopify aun no esta
> conectado, con enlace a Integraciones; los errores de conexiones y metricas conservan `ErrorBlock` y
> las cargas usan `LoadingBlock`. Meta Ads mantiene guiones y CTA de conexion cuando no hay datos reales.

> Matriz operativa. Formato de estado y evidencia definido en
> [`ESTADOS_Y_EVIDENCIA.md`](ESTADOS_Y_EVIDENCIA.md) — no se acepta "completado" sin la evidencia
> correspondiente. Actualizar esta tabla y el bloque de detalle al cerrar o reabrir una fase.
> **Ultima auditoria completa de estados: 2026-07-20.** Actualizaciones parciales posteriores (filas y
> secciones individuales, no una relectura completa del documento): 2026-07-21, 2026-07-22 — ver la fecha
> dentro de cada fila/nota para lo que realmente se revalido y cuando.

## Contrato de objetivo

La matriz de evidencia del piloto está en [`docs/AUDITORIA_ESTADO_REAL_PILOTO.md`](../../../docs/AUDITORIA_ESTADO_REAL_PILOTO.md); los estados `prepared` e `implemented_partial` no equivalen a validación con credenciales o datos externos. La checklist ejecutable de bloqueadores externos y activación está en [`BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`](./BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md).

Este estado global se evalúa contra el [objetivo global del SaaS y Definition of Done](../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md).
La meta no es marcar Meta Ads, Klaviyo o Instagram como conectados sin credenciales: es dejar sus
contratos, adaptadores, feature flags y estados preparados para activarlos sin rediseño cuando existan
credenciales y permisos reales.

## Release activo

La preparación IA queda gobernada por [AI-00A — Fundación del Tool Layer](../05-agentes-ia/fases/AI-00A-tool-layer-foundation.md): el catálogo central debe imponer schemas, permisos, costes, freshness, provenance, idempotencia, dry-run, aprobación, rollback y auditoría antes de habilitar acciones de escritura o publicación de contenido Klaviyo.

**Pre-piloto: consolidacion Shopify + IA en shadow mode (equivalente a F7-F10 del roadmap maestro).**

> Preparación de conectores 2026-08-02: Shopify es la única integración operativa. Meta
> Ads está preparado pero pendiente de validación externa; Klaviyo e Instagram tienen
> contratos, adaptadores no disponibles y estados de UI honestos. La definición de
> “listo para conectar cuando lleguen las credenciales” está en
> [`roadmap/roadmaps/04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).
> Ningún conector futuro puede introducir datos ficticios, secretos en el frontend ni
> una UI paralela.

> Correccion 2026-08-02: el pipeline normal ejecuta tests unitarios/contractuales sin I/O de base de datos.
> Los tests RLS con fixtures quedan como validacion manual hasta disponer de un entorno aislado; nunca se
> ejecutan contra el Supabase productivo desde CI.
> Corregido 2026-07-20: llamarlo "post-MVP" era prematuro — no hay piloto formal todavia (OPS-01 sigue
> `planned`) y no existe staging ni runbooks. Los gaps de webhooks de privacidad de Shopify y `audit_logs`
> sin conectar (senalados el 2026-07-20) ya tienen codigo (mismo dia, ver R-010/R-013/SQO-02/SQO-03); sigue
> faltando observabilidad con correlacion por organizacion. Shopify end-to-end + motor financiero +
> alertas/tareas + agentes A02/A04/A06/A08/A09 funcionan sobre datos reales en shadow mode (aprobacion
> humana antes de escribir); el foco actual es cerrar deuda de verificacion y
> gobernanza (ver P0 abajo) antes de considerar siquiera abrir el piloto formal.

**Nota de gobernanza (2026-07-20)**: los estados usados en la tabla de abajo (`blocked_external_validation`,
`shadow_pilot`, `pilot_ready`, etc.) no son parte de la taxonomia canonica de
[`ESTADOS_Y_EVIDENCIA.md`](ESTADOS_Y_EVIDENCIA.md) — son deuda documental reconocida y con ruta de
correccion definida ahi (separar `Estado real` canonico de un campo `Matiz`/`Tipo de bloqueador`). Migrar
esta tabla al formato correcto es tarea P1 pendiente, no completada en esta revision.

Ver [`RIESGOS.md`](RIESGOS.md) para riesgos abiertos y [`PREGUNTAS_ABIERTAS.md`](PREGUNTAS_ABIERTAS.md) /
[`ADR_LOG.md`](ADR_LOG.md) para decisiones pendientes y tomadas.

## Vista rapida

| Fase                               | Estado real                                          | Responsable | Bloqueador                                                                  | Siguiente accion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------- | ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-00 infraestructura              | `verification_pending`                               | sin asignar | ninguno                                                                     | Test de permisos de `private` anadido 2026-07-21. **Cerrado 2026-07-23**: verificadas y documentadas las 10 funciones `SECURITY DEFINER` reales (todas con `search_path = ''`) y el schema de ambas extensiones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| DB-01 enums core                   | `verification_pending`                               | sin asignar | ninguno                                                                     | Test de drift anadido 2026-07-21. **Cerrado 2026-07-23**: semantica y transiciones de los 5 enums documentadas contra codigo real; hallazgo notable: `subscription_status` no tiene ningun endpoint de escritura hoy (pensado para facturacion futura), `notification_status` nunca se marca `read`/`archived` (accion de UI sin implementar). **`notification_status` cerrado 2026-07-29**: `notifications` ya insertaba filas reales (alertas nuevas a owner/manager) pero ninguna vista las mostraba -- anadidos `GET /v1/notifications`, `PATCH .../status`, `POST .../read-all` (RLS `notifications_select_own`/`_update_own` ya bastaba, sin chequeo extra de organizacion) y una campana en `PortalShell` (cliente, consultor y admin comparten el componente). 5 tests reales verdes, incluyendo que RLS bloquea leer/tocar la notificacion de otro usuario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| DB-02 auth/multitenant/RLS         | `verification_pending`                               | sin asignar | ninguno                                                                     | Escritura cross-tenant, enlaces cross-org y suspension en caliente ya probados 2026-07-21 (17/17). **Cerrado 2026-07-23**: Storage confirmado sin uso (nada que probar); RPC si esta en uso (7 funciones de metricas) -- las 7 (`shopify_sales_summary`, `shopify_financial_summary`, `shopify_top_products`, `shopify_stock_summary`, `shopify_margin_summary`, `shopify_stock_risk_products`, `meta_spend_summary`) tienen ahora test real de aislamiento cross-tenant (8/8), confirmando que `security invoker` + RLS protege incluso pidiendo el `target_organization_id` de otra org a mano con datos reales sembrados (producto, stock, margen, gasto de Meta).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| DB-03 configuracion financiera     | `verification_pending`                               | sin asignar | ninguno                                                                     | Invariante de escala 0-100 documentado 2026-07-21; `calculation_version`/golden tests siguen pendientes (cambio de diseño, no verificacion).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| DB-04 integraciones comunes        | `verification_pending`                               | sin asignar | ninguno                                                                     | Idempotencia de webhooks bajo concurrencia probada 2026-07-21. **Cerrado 2026-07-23**: cifrado documentado (AES-256-GCM, IV unico por fila, sin envelope encryption/rotacion real pese al campo `encryption_key_version`); locking de refresh de tokens ya estaba implementado (claim optimista con CAS) y ahora tiene test real de concurrencia (`db-04-token-refresh-claim.test.ts`, exactamente un claim gana).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| DB-05 Shopify vertical slice       | `verification_pending`                               | sin asignar | ninguno                                                                     | Reconciliacion real ejecutada 2026-07-22 (productos exacto, pedidos con diferencia explicada). **Cerrado 2026-07-23**: tolerancia formalizada -- products/customers deben dar diff 0, orders puede dar local > shopify solo si se explica por la restriccion de 60 dias de `read_orders` sin `read_all_orders`; `local < shopify` en cualquier dataset es alarma real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| DB-06 Meta Ads                     | `blocked`                                            | sin asignar | credenciales/App Review de Meta                                             | Sin accion posible hasta aprobacion de Meta.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| DB-07 alertas/tareas/plan          | `verification_pending`                               | sin asignar | ninguno                                                                     | Trigger anti-enlace-cruzado ya probado 2026-07-21. **Cerrado 2026-07-23**: SLA de overdue formalizado (badge "Vencida" en `/tareas`, verificado en navegador real). **Tambien cerrado el mismo dia**: cooldown/suppression window documentado -- no hay debounce explicito en codigo, pero el cron `alert-rules.yml` (cada 6h) actua como cooldown de facto; dedup por `fingerprint` evita duplicados dentro de una misma evaluacion. **Cerrado 2026-07-29**: fases/hitos editables tras crear el plan, tarea+enlace en un solo paso (`updatePhase`/`updateMilestone`/`createMilestoneTask`, ver FE-04).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| DB-08 llamadas + runtime agentes   | `verification_pending`                               | sin asignar | ninguno                                                                     | Tests de alucinacion (A01) y de publicacion de resumenes ya existian/anadidos 2026-07-21. **Cerrado 2026-07-27**: politica de retencion/redaccion de PII de transcripciones decidida explicitamente (ADR-0016) -- sin retencion por tiempo ni redaccion mientras no haya cliente real en el Piloto 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| DB-09 Klaviyo                      | `planned`                                            | sin asignar | ninguno (no iniciado)                                                       | Definir contrato (API revision, metrica de conversion primaria) antes de migrar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| DB-10 Instagram                    | `planned`                                            | sin asignar | credenciales Meta/Instagram                                                 | Igual que DB-06: sin accion hasta credenciales.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| DB-11 RAG / conocimiento IA        | `verification_pending`                               | sin asignar | ninguno                                                                     | Test de aislamiento cross-tenant anadido y confirmado 2026-07-21. **Cerrado 2026-07-23** (nota del propio documento de fase actualizada 2026-07-27, iba desactualizada): dataset de recall@k anadido y corrido real contra Voyage -- recall@8 y recall@3 ambos 6/6 (100%) sobre 6 documentos y consultas parafraseadas, ver AI-04. **Cerrado 2026-07-27**: retencion de `ai_conversations`/`ai_messages` decidida (mismo criterio que ADR-0016), purga ya cubierta por cascade de `purgeExpiredDeletions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| BE-00 fundaciones API/worker       | `in_progress`                                        | sin asignar | ninguno                                                                     | Dockerfiles anadidos 2026-07-22 (sin build-test real, no hay Docker en este entorno). **Cerrado 2026-07-23**: `/health/live` y `/health/ready` anadidos (readiness pinga GoTrue de Supabase + Redis si esta configurado, 503 si degrada), verificado en vivo contra el dev server real incluyendo el escenario de fallo forzado. Corregido tambien un bug real de shutdown encontrado escribiendo un test de BE-01: el Redis de rate-limit no se desconectaba y `app.close()` colgaba indefinidamente. Falta escaneo de dependencias en CI y auditoria completa de `SIGTERM` (drenado de requests en vuelo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BE-01 identidad/tenancy            | `verification_pending`                               | sin asignar | ninguno                                                                     | Test de suspension de consultor en caliente anadido 2026-07-22. **Cerrado 2026-07-23**: test de organizacion manipulada anadido (`be-01-cross-tenant-route-manipulation.test.ts`, servidor Fastify real via `buildApp()`+`app.inject`, 5 endpoints de negocio, 10/10 pasan). De paso corregido un bug real de shutdown (Redis de rate-limit no se desconectaba, `app.close()` colgaba). **Correccion 2026-07-22**: si existe API para gestionar memberships/consultant_assignments (`upsertOrganizationMember`/`upsertConsultantAssignment` en `consultant.ts`, ya auditadas) -- una nota anterior lo negaba por error de grep sobre el nombre de tabla equivocado, corregido de paso un bug real de tipos encontrado en el camino (`invited_at`/`joined_at` no se preservaban en ediciones). **Cerrado 2026-07-28 (Q-008)**: `accessSource` explicito anadido a `AuthContext.memberships` (membership/consultant_assignment/platform_admin), decision aditiva sin romper consumidores existentes, 3/3 tests reales. **Auditoria completa del mismo dia (pedida por Rafa)**: los ~57 endpoints de negocio revisados uno por uno. **Hallazgo critico real (R-023)**: `calls.ts`/`knowledge.ts`/`strategic-plans.ts` dejaban pasar a cualquier consultor de la plataforma a organizaciones ajenas (bypass de rol sin chequeo de organizacion especifica, combinado con escrituras/lecturas via `service_role` sin RLS) -- corregido, 5 tests de regresion nuevos con un consultor real. `be-01-cross-tenant-route-manipulation.test.ts` ampliado de 5 a 21 endpoints. Resto de archivos de servicio auditados sin gaps. **Cerrado 2026-07-28**: los ~15-20 endpoints de escritura menores (PATCH status tarea/alerta/hito, comentarios) que quedaban solo auditados por lectura ya tienen test dedicado (`be-01-cross-tenant-write-endpoints.test.ts`, 4/4 reales). BE-01 no tiene ninguna accion pendiente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| BE-02 integrations core            | `planned`                                            | sin asignar | ninguno                                                                     | Redactar contratos concretos (maquina de estados OAuth, retry, circuit breaker) antes de tratarlo como implementable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BE-03 Shopify metricas             | `in_progress`                                        | sin asignar | ninguno                                                                     | Dividir en connector/worker/motor financiero/API y documentar formula exacta por KPI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BE-04 Meta adquisicion             | `blocked_external_validation`                        | sin asignar | App Review/business verification de Meta                                    | Completar matriz de flujo y documentar action_type/atribucion mientras se espera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| BE-05 operaciones                  | `functionally_complete_verification_pending`         | sin asignar | ninguno                                                                     | Documentar que pasa si llega transcripcion nueva sobre un resumen ya aprobado (decision de producto, no de codigo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BE-06 Klaviyo/stock/campanas       | `planned_after_mvp`                                  | sin asignar | DB-09                                                                       | Sin iniciar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BE-07 AI runtime/RAG               | `partial_security_and_quality_pending`               | sin asignar | ninguno                                                                     | `lock_timeout` y eval de cross-tenant anadidos 2026-07-22. **Cerrado 2026-07-23**: eval real de prompt injection documental (`eval-be07-prompt-injection.ts`) -- documento real con instruccion embebida, pregunta real al copiloto A09, llamada real al LLM: el modelo ignora el marcador inyectado, responde la pregunta real y advierte al usuario de la inyeccion. Falta el resto de evals de calidad (cita inexistente, contradiccion RAG vs DB, etc.).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FE-00 shell/design system          | `current`                                            | sin asignar | ninguno                                                                     | **Ampliado 2026-07-23 (ADR-0013, peticion de Rafa)**: `packages/ui` dividido en un archivo por componente; sombra de `Combobox` y `rounded-sm` de `Pagination` eliminados; `usePaginatedUrl` migrado en `tareas`/`shopify/diagnostico`. Skip link y `<h2>` grandes de seccion eliminados por peticion explicita de Rafa. **Auditoria formal de accesibilidad con axe-core cerrada el mismo dia**: 3 hallazgos reales (heading-order en 6 paginas, listbox sin nombre + contraste 1.04:1 en el `Combobox` abierto, `document.title` duplicado) corregidos y verificados 2 veces en navegador real. **Ampliado 2026-07-27 (peticion de Rafa)**: `Table` migrado de re-export directo a wrapper propio (ADR-0015) y cableado en `AiDiagnosticSection` (hallazgos/recomendaciones) y `CopilotPanel` (fuentes citadas) reemplazando listas `<ul>` de texto plano -- typecheck/lint verificados, **sin verificar visualmente en navegador** (este entorno no tiene Supabase configurado para levantar el dev server). Falta definir tokens canonicos mas alla de color y prueba manual con lector de pantalla. **Auditoria estructural pagina por pagina 2026-07-29 (peticion de Rafa)**: confirmado que la migracion al componente `Table` (iniciada 2026-07-27) seguia incompleta -- 7 tablas HTML a mano en `shopify/diagnostico` (5), `configuracion` (1) y `dashboard` (1) migradas al mismo `Table` de `AiDiagnosticSection`/`agentes`, misma cabecera/celda/scroll horizontal en toda la app. Investigado y descartado un falso positivo: `className="button button--primary"` en varios CTAs y en `confirm-dialog.tsx` parecia apuntar a clases CSS inexistentes (no aparecen en ningun `.css` del repo) pero **si existen** -- las emite `@heroui/styles/css` (importado en `globals.css`), son el recipe real de `Button` de HeroUI (`buttonVariants` en `@heroui/styles`), no un bug. **Cerrado el mismo dia**: `/consultor` migrado tambien -- en vez de extender `Table` para soportar fila expandible (API actual no lo admite), el detalle se saco de la tabla y se muestra como una `Card` debajo (mismo patron que el panel de detalle de Mi Camino: seleccionar -> panel debajo), una sola forma de "expandir" en toda la app. De paso: `AccessPanel`/`StoresPanel` usaban `<p>Cargando...</p>` a mano en vez de `LoadingBlock`, corregido; y dos `<h5>` saltaban de `h3` a `h5` sin `h4` (mismo tipo de hallazgo que la auditoria axe-core original), corregido a `h4`. Tambien cerrado: `/shopify/diagnostico` ("Diagnóstico técnico") era un panel denso (scopes de API, estado interno de sync, muestras crudas) accesible sin filtro de rol -- ahora exige consultor/platform_admin (mismo patron `canView` que `/agentes`), con `EmptyState` explicito para cliente y el enlace de acceso ocultado en `/shopify`. Verificado con typecheck/lint/build de `web` limpios y typecheck del monorepo completo. |
| FE-01 auth/onboarding              | `functionally_minimal_gaps_confirmed`                | sin asignar | ninguno                                                                     | **Auditado 2026-07-22**: login email/password + redirect por rol funcionan; corregido gap real (cliente sin organizacion asignada veia dashboard en blanco sin explicacion, ya tiene `EmptyState`). **Cerrado 2026-07-29**: sesion expirada ahora muestra mensaje explicito (`?reason=session_expired`) en vez de redirigir a `/login` en silencio, distinguiendo de "nunca hubo sesion". Sin signup/recuperacion de contrasena propios (posible decision de producto, no declarada); sin maquina de estados de onboarding Shopify->financiero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FE-02 dashboard                    | `functionally_complete_e2e_pending`                  | sin asignar | ninguno                                                                     | `IntegrationAction`/`AccountAction` tipado (`@ecomscaling/contracts`) y responsive 375px auditado 2026-07-22. **Cerrado 2026-07-29**: comparacion contra periodo anterior anadida a Facturacion neta/Pedidos/AOV/Beneficio neto (badge verde/rojo), llamando las mismas funciones SQL stable para el rango anterior -- 2 tests reales de extremo a extremo con pedidos sembrados en dos periodos. Build de produccion de `apps/web` limpio; **sin verificar visualmente en navegador real** (sin Playwright/Chromium en este entorno, decision explicita de no montarlo solo para esto).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-03 tareas/alertas               | `functionally_complete_verification_pending`         | sin asignar | ninguno                                                                     | **Cerrado 2026-07-22** (ver FE-03-tareas-alertas.md): corrigio 2 gaps reales de RLS -- `task_status_history` no respetaba `is_visible_to_client`, y `strategic_plans`/`_phases`/`_milestones`/`milestone_task_links` no distinguian `draft` de activo (tests en `rls-tenant-isolation.test.ts`). Paginacion de tareas anadida (`usePaginated`/`Pagination`) y **verificada en navegador real con Playwright** (25 tareas sembradas, login real, 2 paginas confirmadas visualmente, sin errores de consola). **Ampliado 2026-07-29**: buscador de texto por titulo/descripcion anadido, combinable con filtros de estado/modulo. Sin filtros persistidos ni optimistic UI todavia.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| FE-04 llamadas/Mi Camino           | `functionally_complete_ux_validation_pending`        | sin asignar | ninguno                                                                     | Corregir descripcion de "deteccion Fathom" (no es integracion real); dividir documento. **Mi Camino rediseñado 2026-07-29**: arbol vertical fase→hito sobre `@xyflow/react` (lineas/circulos reales, no CSS a mano), edicion inline de fase/hito, creacion de fase/hito/tarea sin paso intermedio (consultor o cliente), color por quien propuso cada nodo (`created_by_origin`, migracion real aplicada). 10+ tests reales verdes, typecheck/lint/build limpios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| FE-05 planificacion/retencion      | `planned`                                            | sin asignar | BE-06, DB-09                                                                | Sin iniciar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FE-06 consultor IA/contenido       | `planned_contract_incomplete`                        | sin asignar | DB-10 (Instagram)                                                           | Corregido 2026-07-22: la diferenciacion visual de tipos de respuesta no aplicaba al copiloto (chat sin ese contrato), ya reforzada en `AiDiagnosticSection` que es donde si aplica. **Cerrado 2026-07-29**: estados de error del copiloto diferenciados (IA no disponible, presupuesto diario agotado, conversacion no encontrada, turno rechazado) en vez de un texto crudo generico, con `Alert` de HeroUI y tono warning/danger segun si es temporal. Sigue pendiente actualizar el documento en si (parte de la razon de ser de esta fila es documental, no solo de codigo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| FE-07 panel consultor              | `in_progress_core_product`                           | sin asignar | ninguno                                                                     | UI de restauracion de organizaciones/tiendas conectada 2026-07-22. **Matriz de acciones admin vs consultant documentada 2026-07-22**: dentro del panel el consultor solo tiene lectura, toda mutacion es `platform_admin`. **Correccion 2026-07-23**: la asimetria entre `decideAgentOutput`/`decideSummary` que esta fila dejaba como "revisar si es intencional" ya estaba cerrada el mismo 2026-07-22 (confirmado en codigo real: ambas exigen ahora `["platform_admin","consultant"]`, ver FE-07-panel-consultor.md) -- la nota de esta tabla habia quedado desactualizada, no el codigo. **Cerrado 2026-07-29**: buscador anadido a la lista de clientes (filtro por nombre/slug). Saved views y acciones masivas siguen sin decision de alcance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FE-08 UI/UX                        | `in_progress`                                        | sin asignar | ninguno                                                                     | Responsive y accesibilidad de teclado del `Combobox` avanzaron 2026-07-22; `PortalShell` ya está protegido con `Suspense` y el build web local de producción pasa. **Auditoría formal con axe-core cerrada 2026-07-23** (ver FE-00) -- falta solo la prueba manual con lector de pantalla real. **Corregido 2026-07-29**: "falta Modal/Toast" era stale -- ambos ya estaban implementados/montados, el gap real era cero llamadas a `toast(...)` en toda la app; anadidas confirmaciones de exito en tareas/alertas, edicion de cliente y aprobacion de resumenes de llamada. **Campana de notificaciones anadida el mismo dia** (`NotificationsBell` en `PortalShell`, ver DB-01): primera superficie del shell que usa `notifications`, compartida por cliente/consultor/admin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| INT-00 nucleo comun integraciones  | `in_progress`                                        | sin asignar | ninguno                                                                     | Contrato TypeScript, catálogo de capacidades/flags y errores creado en `packages/integrations`; API/UI ya lo usan para Shopify/Meta/Klaviyo/Instagram y representan los conectores futuros sin datos ficticios. `IntegrationSyncAdapter` ya enruta los runners reales de Shopify y Meta. Suite aislada: 3 tests pasan. Falta completar OAuth/health/webhooks en `IntegrationAdapter` y tests contractuales. **Validado 2026-07-22** con typecheck, lint, build y 73 tests API + 3 de integraciones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| INT-01 integraciones (Shopify)     | `pilot_ready`                                        | sin asignar | ninguno (bloqueador externo: aprobacion de distribucion publica de Shopify) | **Cerrado 2026-07-22**: webhooks de privacidad deployados a Shopify, `app/uninstalled` reenviado a la tienda piloto, reconciliacion de conteos ejecutada (productos exacto, pedidos con diferencia explicada por ventana de 60 dias de la API, no un bug).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| INT-02 integraciones (Meta Ads)    | `blocked`                                            | sin asignar | Meta App Review                                                             | Backoff verificado y hueco de paginacion cerrado 2026-07-22; falta documentar `canonical_purchase_action_type`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| INT-03 integraciones (Klaviyo)     | `planned`                                            | sin asignar | DB-09, BE-06                                                                | Sin codigo todavia; reauditar `api_revision` de la guia de referencia antes de programar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| INT-04 integraciones (Loom/Fathom) | `in_progress` (Loom manual `done`, Fathom `planned`) | sin asignar | falta API key de una cuenta de prueba real de Fathom (Rafa)                 | **Q-011 resuelta 2026-07-29**: API key interna. Bloqueador ahora es solo conseguir la API key de prueba -- no se puede construir/validar el modulo sin ella (ADR-0006).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| INT-05 integraciones (Instagram)   | `planned`                                            | sin asignar | INT-02                                                                      | Bloqueado por scopes de Meta: `META_SCOPES` hoy no pide `instagram_basic`/`instagram_manage_insights`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Nota de validacion INT-00 (2026-07-22): `deriveIntegrationHealth` ya alimenta API y UI con estados derivados
truthful (`healthy`, `syncing`, `degraded`, `stale`, `unknown`) sin datos simulados. Queda pendiente cablear
OAuth, health operativo y webhooks sobre el adaptador completo.

Correccion posterior INT-00 (2026-07-22): `apps/api/src/integration-adapters.ts` implementa ya el
`IntegrationAdapter` completo para Shopify y Meta, y las rutas OAuth/sync lo utilizan. Shopify incluye
verificacion y procesamiento de webhooks; Meta mantiene discovery real sin fabricar assets. Queda pendiente
solo la seleccion de activos como funcionalidad de producto y ampliar la migracion de errores locales.
| AI-00 contratos/runtime | `verification_pending` | sin asignar | ninguno | Presupuesto real aplicado 2026-07-20 (R-011). **Cerrado 2026-07-27**: maquina de estados formal documentada (no hace falta `queued`/`cancelled`, turnos siempre sincronos), contrato `AgentInput` extraido literal del schema real, y politica de privacidad/retencion de lo enviado al proveedor LLM decidida (mismo criterio que ADR-0016: sin limite mientras no haya cliente real). Model routing sigue correctamente fuera de alcance (AI-09). **Q-012 cerrada 2026-07-29** (Rafa eligio limite por run + limite diario por organizacion): `checkOrganizationDailyBudget` (`apps/api/src/ai-runtime.ts`) suma `estimated_cost_usd` de `agent_runs` desde el inicio del dia UTC por organizacion y bloquea turnos nuevos con 429 si supera $20/dia (plano para todas las organizaciones, igual que el limite por run -- afinar por plan/organizacion sigue siendo AI-09). Cableado en los 3 puntos de entrada reales (diagnostico generico A02/A04/A06/A08, A01, A09). 4 tests nuevos contra Supabase remoto real, incluido el caso borde de que gasto de dias anteriores no cuenta. Sigue `verification_pending` (no `done`) porque documentar la politica no es lo mismo que tener evals que verifiquen que ningun agente se sale de ese contrato. |
| AI-01 A01 llamadas | `pilot_ready` | sin asignar | ninguno | **Cerrado 2026-07-23**: reaprobacion ya distingue 409 `summary_already_decided` de 404 real (antes ambos daban 404), 3 tests nuevos. Sigue pendiente: fingerprint de dedup de tareas (hoy es titulo exacto normalizado, no detecta duplicados semanticos -- requiere decision de diseno, no solo codigo). |
| AI-02 A02 monitor | `shadow_pilot` | sin asignar | ninguno | Ya corre en evidence-pack puro desde v2 (correccion 2026-07-20, ver AI-02); validar con run real el contexto enriquecido. |
| AI-03 SQL Gateway | `verification_pending` | sin asignar | ninguno | **Cerrado 2026-07-23**: `WITH RECURSIVE` acotado y test de aislamiento tenant extremo a extremo anadido (ambos verificados). Queda `pg_sleep`/`generate_series` sin bloqueo explicito, no bloqueante. |
| AI-04 RAG | `live_validated_design_gaps_open` | sin asignar | ninguno (`VOYAGE_API_KEY` ya configurada en este entorno; falta solo en el secret de produccion, ver AI-07) | **Cerrado 2026-07-23**: retrieval real corrido por primera vez -- recall@8/recall@3 100% (6/6) con consultas parafraseadas sobre 6 documentos. Sigue sin probar en corpus grande/estructurado (chunking) ni con terminologia exacta (busqueda hibrida). |
| AI-05 especialistas | `in_progress` (por agente, ver detalle) | sin asignar | A03/A05/A07 bloqueados por Meta | Ver detalle abajo. |
| AI-06 evaluaciones | `foundational_work_in_progress` | sin asignar | ninguno | **Ampliado 2026-07-22**: dataset de A02 con 5 escenarios reales, `npm run eval:a02 -w @ecomscaling/api`, quality gates de coste/latencia. **Ampliado 2026-07-23**: dataset de A01, A06 y A08 anadidos (los 4 agentes de diagnostico ya tienen dataset propio). La eval de A08 encontro un hallazgo real: en 2/3 corridas el `answer` llego con un fragmento inicial corrupto que `checkOutputSanity` no bloqueaba -- **cerrado el mismo dia** (`hasIncoherentOpening`, 30/30 tests de `packages/ai`). **Dataset de A01 completado el mismo dia** con los 2 escenarios que faltaban (audio deficiente, varios interlocutores): 0 fallos hard, 15% soft (bajo umbral), coste $0.15. **Cerrado 2026-07-28**: `hasIncoherentOpening` solo cubria palabra partida por salto de linea cerca del _inicio_ del texto -- anadida `hasBrokenWordMidText` con la misma heuristica para el resto del `answer`/`summary`, 29/29 tests de `packages/ai` pasan (4 nuevos). Unico pendiente real de AI-06: decidir si los quality gates deben bloquear la activacion de `agent_versions` (decision de proceso, no de codigo). |
| AI-12 ingenieria de agentes (transversal) | `verification_pending` | sin asignar | ninguno | **Anadida 2026-07-27** a peticion de Rafa: mapea 10 disciplinas estandar contra el estado real. **Cerradas 2026-07-27/28**: Orchestration (dedup literal + frontera semantica A02/A04, prompt v4 en produccion), Observability & tracing (`/agentes` + `getAgentRunTrace`, 3 tests), Loop Engineering (`DEFAULT_AGENT_BUDGET.maxToolCalls=10` ya era la politica, solo faltaba documentarla -- el modelo estructuralmente nunca ve una herramienta fuera de `allowed_tools`). Las 10 disciplinas tienen ya implementacion o mitigacion real. Ver `AI-12-ingenieria-de-agentes.md`. |
| AI-07 memoria acumulativa | `implemented_prod_secret_pending` | sin asignar | falta `VOYAGE_API_KEY` en el secret de produccion | **Implementado y validado end-to-end 2026-07-22**: migracion (`store_id`/`audience`/`origin`/`authority`/ciclo de vida en `knowledge_documents`, tablas `memory_ingestion_queue`/`client_constraints`, `knowledge_search` con `audience_allowed` obligatorio + `target_store_id`), outbox asincrono (`apps/api/src/memory-ingestion.ts`) cableado en `decideSummary`/`addTaskComment`/`decideAgentOutput`, cron `memory-ingestion.yml` cada 15 min, `client_constraints` inyectadas en A02/A04/A06/A09, prompt anti-injection en `search_knowledge`. `npm run validate:ai07 -w @ecomscaling/api` corrio el pipeline completo contra Supabase real: 9/9 checks pasan (encolar -> pending_indexing -> active con chunks -> filtrado de audiencia correcto -> idempotencia confirmada). Falta: `VOYAGE_API_KEY` en el secret de GitHub Actions/Vercel de produccion, y las "dos superficies" de `/conocimiento` (sigue siendo una tabla plana). |
| SQO-00 seguridad base | `verification_pending` | sin asignar | ninguno | Ampliada 2026-07-22: 108 tests reales en `apps/api` (RLS, SQL Gateway, permisos `private`, idempotencia de webhooks, aislamiento RAG/RPC, config. financiera/conexiones, `task_status_history`, purga). Auditada integridad FK cross-tenant (ya protegida en Node). Rate limiting anadido en los 6 endpoints de IA + limite global (`@fastify/rate-limit`, Redis-backed). **Cerrado 2026-07-27**: llamadas/agent runs ya tienen 3 tests cross-tenant dedicados (antes cubiertos solo indirectamente). **Corregido el mismo dia**: no existe Redis en produccion (nota anterior lo daba por hecho por error); provisionarlo para centralizar el rate limit **se acepta diferir** hasta que haya trafico real de Piloto 1 (mismo patron que R-015), no es un bloqueador. |
| SQO-01 testing | `in_progress` | sin asignar | ninguno | **`npm run lint` anadido a CI 2026-07-22**: los 12 errores `react-hooks/set-state-in-effect` eran una sola causa raiz (patron estandar fetch-on-mount sin alternativa estable hoy), regla bajada a warning en `apps/web/eslint.config.mjs` con justificacion documentada; CI ahora bloquea typecheck+lint+tests+build. **`apps/worker` cerrado 2026-07-29**: tenia 0 tests; unica logica propia real (deteccion de repetibles huerfanos en BullMQ) extraida a funcion pura y testeada, 4 tests nuevos en CI sin necesitar Redis. **`@ecomscaling/config` cerrado el mismo dia**: 12 tests nuevos sobre las reglas reales de validacion de env (requeridos, grupos todo-o-nada, default de scopes). **Playwright pospuesto a proposito 2026-07-29** (decision explicita de Rafa, no falta de tiempo): monta stack completo + usuario sembrado + login real, coste de configuracion/depuracion desproporcionado frente al valor hoy -- nada del roadmap esta bloqueado por su ausencia y los flujos criticos ya se han verificado a mano en navegador real cuando hizo falta (ver FE-03). Revisar solo si aparece una regresion real de UI que unit/integration tests no habrian detectado. Falta: resto de evals IA (ver AI-06). |
| SQO-02 observabilidad | `in_progress` | sin asignar | ninguno | Correccion 2026-07-20: Fastify/pino + `createLogger` ya existian. **2026-07-22**: alertas operativas anadidas (`ops-health-check.yml`, cron cada 2h -> issue de GitHub); ya encontro un hallazgo real (token Shopify offline con `expires_at` pasado). `organization_id` en logs de Fastify cerrado el mismo dia. **`user_id` cerrado 2026-07-23**: mismo hook, extrae `sub` del JWT sin verificar (solo para logs, no autorizacion), verificado en vivo. **`organization_id` en `createLogger` (worker/cron) cerrado el mismo dia**: auditados 46 usos reales en 13 archivos, solo 7 lo llevaban; 21 mas corregidos en shopify-sync/webhooks/meta-sync/meta/memory-ingestion/audit-log/consultant/ai-runtime, 105/105 tests pasan. Falta metricas agregadas, error tracking/APM (herramienta de pago). |
| SQO-03 privacidad/auditoria | `in_progress` | sin asignar | ninguno | `audit_logs` conectado 2026-07-20 a las escrituras mas sensibles. **2026-07-22**: configuracion financiera cubierta (`financial-config.ts`, 5 escrituras). Membresias/asignaciones de consultor SI estaban ya cubiertas (`upsertOrganizationMember`/`upsertConsultantAssignment`, `consultant.ts`) -- una nota anterior de esta misma tabla lo negaba por error de grep, corregido. **Acotado 2026-07-27**: la retencion de transcripciones/documentos de conocimiento ya esta decidida (ADR-0016, ver DB-08 y Q-013); sigue faltando solo la politica de retencion de `audit_logs` en si. |
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
  resuelto). Insights sigue a nivel `ad` (hardcodeado) y `action_report_time` requiere una decisión
  explícita; el modo asíncrono ya está preparado y se activa solo con `META_INSIGHTS_MODE=async`, con
  polling acotado y timeout. Bloqueado por Meta App Review, igual que BE-04.
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
- **Cambio de modelo 2026-07-28**: los 6 agentes activos (A01/A02/A04/A06/A08/A09) migrados de
  `claude-opus-4-8` a `claude-sonnet-5` (peticion de Rafa, mas barato -- $3/$15 vs $5/$25 por MTok
  input/output, `MODEL_PRICING` ya lo tenia tarifado). Aplicado y verificado en produccion real
  (`supabase/migrations/20260728094131_ai_09_agents_sonnet_5.sql`), 109/109 tests siguen pasando.
- **AI-05 (especialistas)**: A04/A06/A08/A09 en `shadow_pilot`/`in_progress`; A03/A05/A07 bloqueados por
  credenciales Meta/Instagram; A00 (orquestador) diferido por decision explicita, no por bloqueo. Riesgo de
  A02/A04 sin frontera de responsabilidad escrita: **cerrado 2026-07-27** — `decideAgentOutput` deduplica
  tareas por titulo exacto normalizado antes de materializarlas, y el prompt A02 v4 (aplicado en produccion,
  `agent_versions`) instruye `proposed_writes: []` siempre, dejando a A04 como unico creador de tareas.
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
  (dataset -> shadow -> canary) que bloquee activar una `agent_versions` nueva. **Cerrado 2026-07-28**:
  `hasIncoherentOpening` solo detectaba una palabra partida por salto de linea dentro de los primeros 60
  caracteres del texto (el patron real que encontro la eval de A08 el 2026-07-23) -- el mismo glitch mas
  adelante en un `answer`/`summary` largo pasaba sin deteccion. Anadida `hasBrokenWordMidText`
  (`packages/ai/src/index.ts`) con la misma heuristica sobre todos los saltos de linea del texto, exigiendo
  minuscula tras el salto para no confundir parrafos/listas legitimos que arrancan con mayuscula. 4 tests
  nuevos, 29/29 pasan en `packages/ai`. **Ampliado 2026-08-24**: la decisión de release ya es
  ejecutable en `packages/ai/src/release-gate.ts`; exige score global y por dimensión, límites de
  tasas de seguridad, coste/latencia opcionales y bloquea cualquier fallo crítico o evidencia ausente.
  3 tests puros cubren activación permitida, bloqueo por regresión/fallo crítico y ausencia de evidencia.
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
- **AI-07 endurecimiento local 2026-08-24**: la cola de memoria ahora reclama filas con estado
  `processing`, recupera claims obsoletos y borra chunks parciales antes de reindexar. La migración
  `20260824130000_ai_07_memory_queue_claims.sql` está preparada localmente; el gate remoto queda
  pendiente de aplicar la migración y repetir la validación end-to-end.
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
  lenta/costosa/fragil que un Postgres aislado por run). **Cerrado 2026-07-29 (tests de worker)**:
  `apps/worker` tenia 0 tests -- auditados los 7 scripts (`worker.ts` + 6 `*-once.ts`), los `*-once.ts` son
  wrappers finos sin logica propia (cargan env, llaman a una funcion ya testeada en `@ecomscaling/api`, y
  loguean/exitcode) asi que no hay nada real que testear ahi. `worker.ts` si tenia logica propia real y no
  cubierta: la regla que decide si un job repetible de BullMQ esta huerfano tras cambiar el cron pattern
  (el bug real que el propio comentario del archivo documentaba -- cambiar de `every` a `pattern` dejaba el
  reconcile duplicado en Redis). Extraida a `apps/worker/src/repeatable-jobs.ts` (funcion pura, sin
  side-effects) para poder testearla sin depender de una conexion real a Redis; 4 tests nuevos en
  `repeatable-jobs.test.ts`, anadidos a `ci.yml` (sin secrets, no necesita Redis). **Cerrado 2026-07-29
  (tests de `@ecomscaling/config`)**: `loadApiEnv`/`loadWorkerEnv` (`packages/config/src/index.ts`) tenian 0
  tests pese a tener reglas de negocio reales -- campos requeridos, string vacio tratado como no-seteado,
  grupos todo-o-nada (Shopify custom, Meta) y el default de `META_SCOPES`. 12 tests nuevos en
  `index.test.ts`, anadidos a `ci.yml` (puro, sin secrets). `packages/contracts` descartado a proposito: son
  solo schemas/tipos sin logica propia (sin `.refine`/`.transform`/funciones), ya cubiertos por typecheck --
  testearlos seria tautologico. Pendiente: Playwright, resto de evals IA (ver AI-06).
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
- **Correccion INT-00 2026-08-01**: `createIntegrationAdapters` ahora expone también contratos de ciclo de vida para Klaviyo e Instagram. Ambos permanecen `not_available` de forma explícita y no generan OAuth, sync, assets ni datos sintéticos; el test contractual protege ese estado hasta que existan credenciales y runners reales.
- **Correccion SQO/BE 2026-08-01**: CI incorpora escaneo de vulnerabilidades de dependencias de producción y revisión de cambios de dependencias. El escaneo de imágenes Docker permanece pendiente hasta poder construirlas en un entorno con Docker.
- **Correccion INT-00/flags 2026-08-01**: `INTEGRATION_FEATURE_FLAGS` dejó de ser solo metadato; ahora es un allowlist aplicado al catálogo, a la UI y a las rutas de conexión/sync/metrics de Shopify/Meta. Los conectores futuros siguen bloqueados aunque alguien los incluya en el allowlist mientras no exista runner real.
- **Correccion AI-00/AI-12 2026-08-01**: el runtime nunca autoaprueba una respuesta que contenga `proposed_writes` o `proposed_tasks`, aunque la versión activa declare `approval_mode = none`. A09 continúa siendo lectura cuando no propone materializaciones.
- **Correccion AI-04/DB-11 2026-08-01**: el retrieval de conocimiento queda preparado para busqueda hibrida semantica + lexica mediante `knowledge_search_hybrid`, con fallback temporal al RPC anterior y filtros de aislamiento conservados. La migracion queda pendiente de aplicacion controlada; no se escribio en produccion durante esta revision.
- **Correccion INT-01/FE-08 2026-08-01**: el formulario de conexion Shopify ya no precarga un dominio de tienda concreto; empieza vacio y usa un placeholder neutro para no presentar datos de demo como una cuenta real.
- **Correccion AI-12/FE-06 2026-08-01**: `/agentes` ahora muestra el estado de la salida (`Pendiente de revisión`, aprobada, publicada, rechazada o fallida) junto al estado técnico del run y explicita que las propuestas no ejecutan cambios sin revisión humana.
- **Verificacion tecnica 2026-08-01**: comprobación directa con `tsc --noEmit` de los 10 workspaces principales (7 packages y `apps/api`, `apps/web`, `apps/worker`) sin errores; suite aislada de AI/config/integrations: 47/47 tests.
- **Correccion SQO/FE-08 2026-08-01**: el build web fallaba al prerenderizar `/agentes` porque `supabase.ts` lanzaba una excepción durante la evaluación del módulo cuando faltaban variables públicas. El cliente Supabase ahora se obtiene mediante `getSupabaseClient()` con guard explícito; sin configuración el build prerenderiza y el uso runtime devuelve un error accionable. La verificación más reciente (`npx next build`, 2026-08-02) genera 18/18 rutas; la cifra histórica de 17 queda supersedida.
- **Verificacion de builds 2026-08-01**: compilación emitida directa con `tsc` correcta en `apps/api` y `apps/worker`; junto al build web, quedan verificadas las tres superficies de compilación sin ejecutar `npm run`.
- **Estado de migración RAG 2026-08-01**: `npx supabase migration list --linked` confirma que `20260801100000` está local pero no aplicada en remoto (`remote: ""`). No se ejecutó `db push`; requiere despliegue controlado y posterior verificación del RPC `knowledge_search_hybrid`.
- **Verificación DB 2026-08-01**: `npx supabase db lint --linked --schema public --level warning --fail-on none` devuelve `No schema errors found`. Security Advisors no pudo ejecutarse porque la cuenta conectada recibe HTTP 403 por permisos de plataforma; queda como validación externa, no como fallo del esquema.
- **Correccion SQO-02 2026-08-01**: `@ecomscaling/observability` incorpora un registro de contadores Prometheus process-local y el API expone `/health/metrics` solo con `x-internal-secret`. Se registra método/ruta/status sin `organization_id` ni `user_id`; 2 tests del registro pasan. Para agregación multi-instancia sigue siendo necesario conectar un backend externo cuando exista tráfico suficiente.
- **Verificación SQO-02 2026-08-01**: prueba de integración `observability-metrics-endpoint.test.ts` confirma 401 sin secreto, respuesta Prometheus autorizada y contadores generados por `/health/live`; 1/1 pasa y el API mantiene typecheck correcto.
- **Correccion FE-00/FE-08 2026-08-01**: la tabla de componentes base del roadmap ya no atribuye el design system a `packages/ui`; la fuente actual es `apps/web/src/components/ui` sobre HeroUI v3, conforme a ADR-0015. Las menciones restantes a `packages/ui` son contexto histórico explícito.
- **Auditoria documental FE-00 2026-08-01**: se añadió una nota de corrección en la fase para que las referencias históricas a `packages/ui` no se interpreten como evidencia actual; la implementación vigente sigue siendo el catálogo local de `apps/web`.
- **Correccion SQO-02/SQO-03 2026-08-01**: el logger común ahora aplica redacción recursiva a claves de autorización, cookies, passwords, secrets, tokens, API keys y service-role keys antes de escribir en stdout/stderr. Se conservan identificadores de organización no sensibles para diagnóstico; 4 tests de observabilidad pasan.
- **Correccion SQO-00/OPS-01 2026-08-01**: los scripts `seed-demo-user` y `seed-shopify-store` ahora exigen `ALLOW_DEMO_SEED=true`/`ALLOW_SHOPIFY_SEED=true` explícitamente. Se evita que datos sintéticos o escrituras de desarrollo lleguen por accidente al proyecto o tienda reales.
- **Verificacion de seeds 2026-08-01**: ambos scripts pasan typecheck directo; se corrigió el tipo del transporte WebSocket de `seed-demo-user` sin ejecutar ninguno ni escribir datos.
- **Correccion FE-01 2026-08-01**: el login captura también errores de configuración/creación del cliente Supabase antes del request de autenticación y devuelve un `ErrorBlock` accionable, liberando el estado de carga.
- **Verificacion FE-01 2026-08-01**: `npx next build` vuelve a pasar tras el cambio; la verificación posterior de 2026-08-02 confirma 18/18 rutas web prerenderizadas.
- **Correccion INT-02 2026-08-02**: el flujo de activos Meta ya existe en `meta.ts` y `server.ts`: catálogo
  real de negocios, páginas y cuentas publicitarias, selección persistida con permiso owner/manager/
  platform_admin, y sincronización posterior. La selección registra `meta_asset_selection_updated` en
  `audit_logs`; no se fabrican activos ni métricas. La validación externa sigue bloqueada por credenciales y
  App Review de Meta.
- **Correccion OPS-00 2026-08-02**: los Dockerfiles de API y worker ya no referencian el paquete eliminado
  `packages/ui`; las fuentes usadas por `COPY` existen y la build reproducible no depende de ese path.
- **Correccion AI-04/DB-11 2026-08-02**: la migración `20260801100000_ai_04_knowledge_hybrid_search.sql`
  ya fue aplicada al proyecto enlazado y `db lint` volvió a pasar; la nota anterior que la marcaba como
  pendiente queda supersedida.

## Correccion canonica de estado 2026-08-21

## Correcciones vigentes 2026-08-24

- **AI-03/AI-04:** el SQL Gateway ya bloquea `WITH RECURSIVE`, `pg_*`, `pg_sleep` y funciones de
  expansion; su suite pasa 31/31. El RPC RAG hibrido esta aplicado y el eval adversarial documental
  de prompt injection esta verificado. Las filas historicas que indiquen lo contrario quedan supersedidas.
- **SQO-01/AI-06:** el CI manual ejecuta lint, typecheck, build, tests, SBOM y Trivy; la suite IA vigente
  pasa 50/50. Las cifras historicas inferiores de tests o de lint ausente no representan el estado actual.
- **Base remota verificada en esta ronda:** `npx supabase migration list --linked` devuelve 63 entradas
  con `local == remote`; no se ejecuto `db push` ni se escribieron datos durante la comprobacion.
- **Integridad remota verificada:** `npx supabase db lint --linked` no encuentra errores en `ai`,
  `extensions`, `private` ni `public`; `npx supabase db push --linked --dry-run` confirma que la base
  remota esta al dia y no se ejecuta ninguna escritura.
- **Gate transversal vigente:** typecheck API/web, 12 rutas con loading/error/empty, accesibilidad,
  catalogo UI, web 5/5, schema generado, API unitario 53/53, IA 50/50, integraciones 14/14,
  SQL Gateway 31/31 y auditoria de dependencias pasan en la verificacion actual.
- **Gates adicionales vigentes:** `assert-instagram-foundation.mjs` confirma seis tablas con RLS,
  politicas tenant y grants de lectura; `assert-safe-seed-surface.mjs` confirma que los seeds demo
  mantienen barreras contra destinos de produccion.
- **Build web vigente:** `npx next build` desde `apps/web` pasa con Next 16.3.1, TypeScript,
  generacion de 18 paginas estaticas y optimizacion final.
- **Build de servicios vigente:** `npx tsc -p apps/api/tsconfig.json` y
  `npx tsc -p apps/worker/tsconfig.json` completan correctamente. Esto verifica artefactos TypeScript;
  no se presenta como despliegue ni como prueba de contenedores en runtime.
- **Paquetes compartidos:** los typechecks directos de `ai`, `config`, `contracts`, `db`, `domain`,
  `integrations` y `observability` pasan 7/7.
- **Lint web vigente:** ejecutado desde `apps/web` con `npx eslint .`; termina sin errores y con 13
  warnings conocidos de hooks React (`set-state-in-effect` y una dependencia de efecto). CI no los
  trata como fallos; quedan como hardening UX/performance pendiente, no como ausencia de lint.
- **Observabilidad worker:** `worker_jobs_total` ya se registra por nombre/estado reutilizando
  `@ecomscaling/observability`; el test de workflows del worker queda reproducible desde cualquier cwd
  y la suite del worker pasa 14/14. Sigue pendiente el backend compartido multi-instancia.
- **Supply-chain vigente:** `node scripts/audit-guard.mjs` pasa en esta ronda con 0 vulnerabilidades
  `high/critical` en dependencias de producción. El CI manual conserva además SBOM CycloneDX y
  escaneo Trivy de las imágenes API/worker; no se interpreta como sustituto de una revisión periódica.
- El escaneo de imagenes Docker ya no queda pendiente: el workflow CI manual genera SBOM CycloneDX, construye API/worker y ejecuta Trivy para HIGH/CRITICAL no corregidas. No publica ni despliega automaticamente.
- AI-09 queda en `implemented_partial`: routing opcional, presupuesto por turno/organizacion y circuit breaker fail-closed por tenant implementados; limites comerciales por plan y APM externa siguen pendientes.
- Las cifras historicas de la suite IA `47/47` quedan supersedidas por la verificacion vigente del 2026-08-24: `packages/ai/src/index.test.ts` pasa 50/50; los contratos de integraciones pasan 14/14 con `npx tsx --test`.
- INT-04/Fathom ya no es "sin una linea de codigo": existe el verificador de firma, parser y dedupe key del webhook. La API key de prueba y la validacion externa siguen pendientes; Loom manual permanece operativo.
- INT-03/Klaviyo ya no es "sin codigo": existe el vertical slice de OAuth PKCE, sync, Reporting API, reconciliacion, backfill, UI y contratos; falta cuenta real para validacion externa.
- INT-05/Instagram ya no es "sin codigo": existe foundation de schema/RLS, adapter explicito `not_available`, catalogo y estados de UI; OAuth y sync reales esperan credenciales/permisos Meta.

Las notas historicas anteriores a este bloque no deben interpretarse como el estado ejecutable actual.
La evidencia vigente es la siguiente:

- **INT-03/DB-09/BE-06 Klaviyo:** existe vertical slice de OAuth PKCE, almacenamiento cifrado,
  sync, Reporting API, seleccion de metrica, reconciliacion y backfill progresivo. La idempotencia
  del sync incremental usa ventanas UTC de 6 horas. El workflow automatico permanece desactivado
  hasta disponer de credenciales y cuenta real; el worker queda disponible para ejecucion manual.
- **INT-05/DB-10 Instagram:** existe foundation de base de datos con seis tablas, RLS, politicas
  tenant-scoped, grants de lectura y adapter explicito `not_available`; no se fabrican cuentas,
  insights ni publicaciones sin credenciales Meta y permisos aprobados.
- **INT-02 Meta Ads:** OAuth, catalogo/seleccion de activos, sync estructural e Insights sync/async
  estan preparados. `META_INSIGHTS_MODE=async` es opt-in y no se activa sin credenciales validas.
- **AI-00/AI-09/AI-12:** los entry points A01, A02, A04, A06, A09 y A11 persisten `execution_mode`
  en `shadow`; presupuesto por turno/organizacion, routing opcional y circuit breaker estan cableados.
  Las propuestas requieren revision humana de consultor o `platform_admin` antes de materializarse.
- **FE-00/FE-08:** el catalogo unico y reutilizable es `apps/web/src/components/ui` sobre HeroUI v3,
  conforme a ADR-0015. `packages/ui` fue eliminado deliberadamente; reintroducirlo crearia una
  segunda fuente y contradiciria la decision arquitectonica vigente.
- **INT-01 Shopify:** el sync incremental, webhooks, deduplicacion/reintentos, reconciliacion de
  conexiones atascadas, conteos y desinstalacion estan implementados. Desde 2026-08-21 los payloads
  JSON malformados se rechazan con `400 invalid_json_payload` despues de validar HMAC.
- **DB/CI:** las 64 migraciones locales y remotas estan alineadas; el esquema generado, enlaces
  Markdown, guard de catalogo UI, foundation Instagram, typecheck web/API/worker y contratos de
  portal pasan en las verificaciones directas actuales. Las validaciones externas que requieren
  cuentas Meta/Klaviyo/Instagram, App Review, backup/restore aislado y auditoria visual completa
  siguen siendo pendientes honestos, no se simulan.
- **AI-08:** la fase tiene contrato preparado en `AI-08-outcomes-recomendaciones.md`, enlazando
  `agent_outputs` → `agent_approvals` → `tasks.metadata.agent_output_id`. No se crea aún una tabla
  de outcomes ni se calculan KPIs porque falta una definición de éxito aprobada; mostrar ausencia
  de medición es más correcto que inventar resultados.

## Corrección vigente 2026-08-24 — SQO-03

La política de retención de `audit_logs` queda decidida en
[`ADR-0018`](../../../docs/decisions/ADR-0018-retencion-audit-logs.md): durante el pre-piloto se
conservan sin purga temporal automática; la política definitiva y su job verificable deben revisarse
antes de activar el primer cliente real. No se ha ejecutado ninguna eliminación.

## Corrección vigente 2026-08-24 — AI-09 routing

`AI_MODEL_ROUTING_JSON` ya permite seleccionar un modelo distinto por agente y proveedor, con fallback
al modelo de la versión activa cuando no existe override. `apps/api/src/ai-model-routing.test.ts` cubre
los dos caminos. El routing por plan/organización sigue pendiente de decisión de producto y no se activa
por inferencia.

## Corrección vigente 2026-08-24 — INT activation gate y stack de agentes

`evaluateIntegrationActivation` centraliza los nueve requisitos de cierre de un conector y evita
que cada integración interprete de forma distinta cuándo está lista. Además, la decisión de IA se
revisó: se preparará una adopción incremental de LangChain para componentes de agentes, LangGraph
para orquestación con estado y aprobación humana, y LangSmith para trazas/evaluaciones opcionales.
El runtime propio, los contratos de seguridad y el RAG en Supabase siguen siendo la autoridad hasta
que un piloto no mutante demuestre paridad.

`AI_ORCHESTRATION_MODE=direct` permanece como default. `langgraph` ya está disponible como opt-in
explícito para shadow/piloto y ejecuta el turno protegido sin alterar su resultado ni sus guardas.
Los diagnósticos exponen ese modo y el estado booleano de LangSmith sin secretos; la UI los muestra
con el componente reutilizable `AgentRuntimeStatusBadge`.

## Correccion vigente 2026-08-26 - INT-07 readiness cableada

El endpoint de Integraciones expone `activation.ready` y `activation.missing`
calculados por capacidades del proveedor; la UI los muestra mediante
`IntegrationActivationChecklist`. La prueba API de configuración, los tests
UI y los typechecks API/web/integrations pasan, sin exponer secretos.

## Correccion vigente 2026-08-26 - INT-07 activation por capacidades

El cierre de conectores ya no aplica requisitos imposibles de forma universal:
Fathom webhook-only omite OAuth, scopes, asset y sync inicial, mientras Meta
mantiene sus gates completos. La suite de integraciones pasa 14/14 y el
typecheck del paquete pasa.

## Correccion vigente 2026-08-26 - INT-06 estados de integracion

La UI ya no presenta como saludable una conexión `connected` cuya salud sea
`stale`, `degraded` o `reauthorization_required`; el componente reutilizable
prioriza esos estados y mantiene acciones honestas para Meta/Klaviyo/Instagram.
La regresion UI pasa 6/6 y los typechecks web e integrations pasan.

## Correccion vigente 2026-08-26 - FE-08 evidencia del copiloto

El copiloto embebido conserva fuentes y warnings por respuesta mediante el
componente reutilizable `AiEvidence`; los estados `Fuentes verificadas`,
`Evidencia parcial` y `Sin evidencia` son deterministas. La logica pura pasa
1/1 test y el typecheck web pasa.

## Correccion vigente 2026-08-26 - AI-21 dataset de evals

`AGENT_EVAL_DATASET_VERSION=2026-08-26.v1` contiene un fixture por cada uno
de los diez agentes activos y ejecuta grounding, abstencion, consistencia y
anti-injection sin conectores, empresas reales ni Supabase. Sus tests pasan 5/5
y el typecheck de `packages/ai` permanece correcto.

## Correccion vigente 2026-08-24 - AI-20 evidence evals

`evaluateAgentEvidenceContract` y `evaluateEvidenceConsistency` se ejecutan en
la matriz offline de los diez agentes. Verifican grounding tenant-bound,
abstencion cuando faltan fuentes, referencias disponibles, ausencia de fugas
cross-tenant y contradicciones con hechos estructurados. La suite de este
bloque pasa 9/9 y el typecheck de `packages/ai` pasa. La evaluacion semantica
de texto libre requiere un dataset versionado y claves, por lo que no se simula.

## Correccion vigente 2026-08-24 - AI-19 SQL Gateway evals

La matriz offline `apps/api/src/be-07-sql-gateway-evals.test.ts` cubre cinco
categorias: analitica segura, escrituras, cross-schema, abuso de recursos y
frontera del parser. Su verificacion pasa 2/2 y no ejecuta SQL ni consulta
Supabase. Complementa los tests remotos de RLS/tenant, que siguen siendo un
gate separado.

## Corrección vigente 2026-08-24 — resiliencia, UI y conectores

El runtime de IA aplica timeout abortable, retries transitorios, backoff con jitter y circuit breaker
por organización. Meta, Klaviyo y Shopify tienen además límites de red propios: 15 s por petición,
reintentos acotados para red/timeout/429/5xx y respeto de `Retry-After`. Fathom sigue siendo webhook
preparado, sin cliente saliente ni validación externa inventada.

La UI mantiene `Meta` y `Klaviyo` como `Preparado` hasta tener credenciales, scopes y respuesta real.
`OnboardingChecklist` separa carga de métricas y configuración financiera, marca el paso activo con
`aria-current` y las 12 rutas autenticadas cumplen loading/error/empty en el contrato directo.

Las métricas locales están limitadas a 5.000 series por proceso; `/health/metrics` no se interpreta como
agregación multiinstancia. La agregación compartida y el drill de restore siguen siendo gates de
infraestructura externa. Las migraciones AI-03/AI-07 y el type overlay de la cola están preparados
localmente; la aplicación remota y el typegen oficial continúan pendientes por permisos MCP.

## AI-24 — Guard de capacidades futuras

Las tools preparadas de Meta e Instagram tienen contratos declarativos, pero
siguen en estado `planned`. El runtime no las expone hasta disponer de executor
operativo y añade una instrucción de abstención cuando una versión las declara.
El Tool Layer cubre esta frontera con `tool_not_implemented` y el test de
identificación de capacidades futuras pasa dentro de la suite local.

## AI-25 — Cobertura de evals en activación

El release gate ahora puede exigir los códigos de todos los agentes requeridos,
comprobar cuáles fueron realmente evaluados y bloquear fallos deterministas de
eval. La matriz y el dataset offline cubren los diez agentes del catálogo; la
evaluación semántica con proveedor real permanece correctamente como gate
posterior y no se presenta como validada.

## AI-26 — Evidencia durable de evaluaciones

La migración local `20260826140000_ai_26_agent_eval_evidence.sql` prepara la
persistencia auditable de evaluaciones por versión, dataset, modo y agente,
separada de cualquier empresa real. Incluye RLS de plataforma, unicidad y
overlay local de tipos. Falta únicamente aplicar la migración y regenerar el
typegen oficial cuando Supabase permita la operación remota.

La funciÃ³n privada `record_agent_version_evaluation` mantiene `SECURITY DEFINER`
con `search_path = pg_catalog, public, private`, evitando resoluciones inseguras
cuando la migraciÃ³n se promueva al proyecto remoto.

El serializador puro `packages/ai/src/agent-eval-evidence.ts` ya convierte la
matriz de resultados en filas de evaluación y resultados por agente, marcando
fallos de forma auditable y sin escribir directamente en la base de datos.
La RPC privada `record_agent_version_evaluation` y su wrapper API realizan la
persistencia atómica e idempotente cuando el worker tenga acceso service role.

El runner `apps/api/src/agent-eval-runner.ts` ya recorre las versiones activas,
ejecuta la matriz offline de los diez agentes y genera la evidencia asociada a
cada versión sin claves ni organizaciones reales. Su ejecución cron y los modos
`shadow`/`live` siguen condicionados a infraestructura y datasets posteriores.
El entrypoint de worker y `agent-evals.yml` permiten lanzarlo manualmente; el
schedule automático sigue desactivado de forma intencionada.

La página `/agentes` muestra ahora el estado de readiness de evaluaciones con un
componente reutilizable: 10/10 agentes cubiertos por la matriz offline,
preparación offline explícita y validación live pendiente. No se presenta ningún
resultado externo sin evidencia.

El endpoint protegido `/v1/agents/eval-readiness` lee AI-26 cuando está
disponible y degrada a `local_prepared` si la migración aún no llegó a Supabase.
La UI consume ese estado y mantiene separadas preparación offline y validación
live.

El contrato `packages/ai/src/live-eval-contract.ts` deja preparada la transición
a `shadow`/`live` con provider inyectable y controles de evidencia, abstención,
coste, latencia y trazabilidad. Sin claves no ejecuta llamadas ni presenta
resultados semánticos como validados.

El contrato genera además un caso base de datos ausentes para cada uno de los
diez agentes, de modo que la futura ejecución `shadow/live` no pueda omitir
silenciosamente un agente.

Los resultados provider-backed también tienen adaptador hacia AI-26: el score,
coste, latencia y `traceId` por caso quedan listos para persistencia atómica,
pero no se consideran válidos hasta ejecutarse con un proveedor real.
## Corrección vigente 2026-08-26 - Regiones accesibles en evidencia y activación

La revisión de accesibilidad de los componentes reutilizables de UI corrigió
`IntegrationActivationChecklist` y `AiEvidence`: ambos exponen ahora una
región etiquetada para tecnologías asistivas, conservan el lenguaje visual
existente y generan títulos ARIA únicos con `useId` cuando se renderizan varias
veces en una pantalla. El typecheck directo de `apps/web` pasa. La validación
visual/manual con navegador y lector de pantalla real sigue pendiente por ser
una comprobación operativa, no un bloqueo para seguir implementando.
