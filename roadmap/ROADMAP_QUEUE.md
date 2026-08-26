# Cola canónica de ejecución de roadmaps

## Corrección vigente 2026-08-26 - Estado real de la cola

Los bloques AI-16 a AI-31 ya tienen implementación local, contratos, UI,
FE-01/BE-07 2026-08-26: El panel de Consultor endurece carga y mutaciones de acceso multi-tenant,
edicion de clientes, tiendas y restauraciones. Miembros, asignaciones, eliminaciones y
restauraciones capturan errores de red y liberan siempre sus bloqueos; los cambios locales solo se
aplican tras confirmacion HTTP y los formularios/confirmaciones permanecen recuperables ante fallo.
Typecheck web y los tres gates UI/accesibilidad pasan.

FE-02/FE-06/AI-12 2026-08-26: Shopify, copiloto, agentes y notificaciones capturan
excepciones de transporte en cargas y mutaciones. Los estados de loading/sending/deciding
siempre se liberan, las consultas IA no dejan el mensaje de usuario en un falso Ã©xito y las
acciones de notificaciÃ³n sÃ³lo actualizan el estado local tras confirmaciÃ³n HTTP.

FE-02/OPS-16 2026-08-26: el resumen multi-tienda del Dashboard protege tambien el orquestador
de concurrencia y limpia summaries/loading cuando no quedan tiendas. Un fallo inesperado del
coordinador no deja el panel bloqueado ni conserva datos de una lista anterior.

FE-01/AUTH 2026-08-26: el flujo de login libera tambien `isSubmitting` despues del bootstrap y
la redireccion, incluidos fallos de bootstrap con fallback al Dashboard. El acceso no queda
visualmente bloqueado si la sesion ya se autenticÃ³ pero falla la carga de contexto.

persistencia preparada y verificaciones directas: anti-injection RAG/Playbook,
tools futuras, prompts canónicos, evals de los diez agentes, evidence grounding,
release gate, evidencia durable, runner offline/shadow/live y readiness API/UI.
La cola no debe volver a tratarlos como pendientes de diseño; sólo queda la
aplicación remota de migraciones/tipado y la validación con proveedores reales.
El siguiente trabajo local se mantiene en UI/UX, QA/observabilidad y runbooks,
sin esperar credenciales externas.

> Documento operativo para avanzar por bloques completos, con una única cola de trabajo. Evita abrir fases al azar y mantiene una separación explícita entre lo implementable localmente y lo que depende de sistemas externos.

## Objetivo de la cola

Dejar EcomScaling preparado para piloto: Shopify operativo, Meta/Klaviyo/Instagram preparados mediante contratos, adaptadores, UI, permisos y estados honestos; agentes de IA con evidencia, abstención, presupuesto y aprobación humana; y una base de datos multi-tenant segura.

## Reglas de ejecución

1. Trabajar un bloque a la vez, en el orden de esta cola.
2. Antes de editar, leer solo el README del roadmap y las fases que estén en el bloque activo.
3. Cada bloque debe producir código, migración, prueba o evidencia documental. Si no produce ninguno, no se marca como cerrado.
4. Ejecutar verificaciones directas y económicas (`npx tsx`, `npx tsc`, `npx prettier --check` o scripts específicos). No usar `npm run` ni comandos Git salvo que sean imprescindibles.
5. No declarar conectado ningún proveedor sin credenciales, scopes y respuesta real del proveedor.
6. Las tareas externas se mantienen como `blocked_external`; no bloquean el desarrollo local, pero sí el cierre de producción.
7. Actualizar este archivo y `roadmap/roadmaps/99-decisiones-y-seguimiento/ESTADO_GLOBAL.md` al finalizar cada bloque.

## Estados

| Estado                 | Significado                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `queued`               | Preparado para entrar en ejecución.                                             |
| `in_progress`          | Bloque activo; admite cambios de código/documentación.                          |
| `implemented_partial`  | Contratos, UI o infraestructura local listos, con validación externa pendiente. |
| `verification_pending` | Implementado, pero requiere una prueba operativa/manual concreta.               |
| `blocked_external`     | Solo falta autoridad o sistema externo fuera del repositorio.                   |
| `done`                 | Criterios locales y verificaciones del bloque cumplidos.                        |

## Cola ordenada

| Orden | Bloque                         | Roadmaps fuente                                                     | Criterio de salida                                                                                    |
| ----: | ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
|    01 | Base de datos y tenancy        | `01-base-de-datos`                                                  | Migraciones alineadas, tipos generados, RLS/grants revisados y gates DB verdes.                       |
|    02 | Núcleo de integraciones        | `04-integraciones/INT-00`, `INT-01`                                 | Contrato común, Shopify operativo y conectores futuros con estados honestos.                          |
|    03 | API, workers y operaciones     | `02-backend-api`, `07-operacion-despliegue`                         | Rutas, jobs, idempotencia, errores, health y runbooks verificables.                                   |
|    04 | Agentes y contratos de tools   | `05-agentes-ia/AI-00`, `AI-00A`, `AI-03`, `AI-04`, `AI-10`, `AI-12` | Salidas estructuradas, evidencia, abstención, permisos, límites y tests directos.                     |
|    05 | Calidad de agentes y memoria   | `05-agentes-ia/AI-01` a `AI-09`, `AI-13`                            | Evals reproducibles, prompts canónicos, shadow mode, routing, memoria y aprobación humana.            |
|    06 | UI/UX y design system          | `03-frontend-ux`                                                    | Componentes reutilizables, loading/error/empty, accesibilidad y rutas del portal.                     |
|    07 | Seguridad, QA y observabilidad | `06-seguridad-qa-observabilidad`                                    | Gates, threat model, logs correlacionados, métricas y runbooks.                                       |
|    08 | Conectores futuros             | `04-integraciones/INT-02` a `INT-05`, `DB-06`, `DB-09`, `DB-10`     | Meta/Klaviyo/Instagram/Fathom listos para conectar; validación real pendiente cuando existan cuentas. |
|    09 | Cierre de piloto               | `99-decisiones-y-seguimiento`                                       | Evidencia canónica actualizada y lista externa de bloqueos sin afirmaciones inventadas.               |

## Estado actual de la cola

> Incremento FE-01 2026-08-24: el dashboard incorpora `OnboardingChecklist`, que guía la secuencia
> Shopify conectado → primera sincronización validada → canales futuros preparados. No muestra datos
> simulados y reutiliza los estados reales ya cargados por el dashboard.

> Incremento adicional FE-01: el checklist consulta también `/financial-config` y conduce a
> Configuración cuando faltan costes, envío, impuestos o modelo de margen.

> Incremento FE-01/FE-08 2026-08-24: `onboarding-checklist-state.ts` separa los estados de carga
> de métricas y configuración financiera, añade `aria-current="step"` al paso activo y conserva
> Meta/Klaviyo como `Preparado`. El contrato de estados del portal vuelve a pasar en las 12 rutas.

> Incremento FE-01 de estados: `PortalShell` ahora comunica suspensión de organización, suscripción
> no activa y reautorización pendiente de Shopify con CTA contextual.

> Incremento backend: `requireOperationalOrganization` protege escrituras y operaciones sensibles
> con el estado real del tenant y la suscripción; test directo 4/4 y typecheck API pasan.

> Auditoría ampliada: el mismo guard se aplica también al runtime de agentes IA y a los planes
> estratégicos, evitando generar propuestas, modificar drafts o cambiar hitos en tenants no operativos.

> Auditoría de conectores: OAuth/sync/selección de activos Meta, OAuth/selección de métrica Klaviyo
> y creación de conocimiento por organización reutilizan el mismo guard operativo.

> Shopify también valida el guard antes de iniciar OAuth o lanzar una sincronización; el callback
> conserva su validación independiente de state/HMAC porque no recibe el contexto de sesión.

> Los callbacks OAuth deben cerrar el `pending` cuando el proveedor deniega permisos o falla el
> intercambio de token. La UI de Integraciones interpreta `connected`, `denied` y errores sin
> presentar una conexión fallida como saludable.

> Decisión de agentes vigente: el runtime directo Anthropic/OpenAI sigue siendo la autoridad y
> LangChain/LangGraph/LangSmith están integrados de forma opt-in detrás del adapter, con RAG propio
> sobre Supabase. Ver `docs/decisions/ADR-0019-resiliencia-runtime-ia.md` y la documentación de IA.

> `data_coverage` selecciona la conexión más reciente por proveedor. Una reautorización `pending`
> o una sincronización inicial sin `last_sync_at` no se presenta como datos disponibles para los
> agentes.

> Guard de workers añadido: los syncs de Shopify, Meta y Klaviyo vuelven a consultar organización y
> suscripción justo antes de escribir; esto cubre jobs encolados antes de una suspensión. Test de
> clasificación ampliado a 5/5.

- `01` a `04`: `done` a nivel de implementación local.
- `05`: `implemented_partial`; AI-16 a AI-31 ya están implementados localmente, con evals de los diez agentes y runner offline/shadow/live; las migraciones AI-26 y sus tipos oficiales requieren el acceso remoto correspondiente.
- `06`: `in_progress`; `AsyncState` reusable aplicado a Integraciones, PortalShell, Configuración, Shopify, Diagnóstico Shopify, Conocimiento, Tareas, Llamadas, Marketing, Consultor, Agentes y Mi Camino; accesibilidad y lint verdes. En la revisión 2026-08-26, `IntegrationActivationChecklist` y `AiEvidence` pasan a regiones ARIA reutilizables con títulos únicos mediante `useId`; typecheck web verde. La validación navegable local de Dashboard, Integraciones, Conocimiento y Agentes también está verificada; queda la revisión visual/manual completa con lector de pantalla real.
- SQO-04/SQO-01: el threat model y testing ya reflejan que prompt injection tiene controles y dataset offline para los diez agentes; la ejecución live/shadow y los fixtures de proveedores continúan como validación externa.
- OPS/SQO: añadido `RB-010-ai-eval-failed-or-degraded.md`, con contención, rollback, validación offline/shadow/live, circuit breaker, trazas redactadas y criterios de escalado para cualquier agente.
- INT-01/02/03: contratos offline de Meta, Klaviyo y Shopify verificados 15/15; la validación de proveedor real sigue separada y no se simula.
- INT-08: creada `04-integraciones/INT-08-EXTERNAL-CONNECTOR-VALIDATION-MATRIX.md` con precondiciones, pruebas, evidencias y criterios de promoción para Shopify, Meta Ads, Klaviyo e Instagram.
- FE/SQO: corregido el último hallazgo del verificador de estados de producto; `camino` e `integraciones` exponen `ErrorBlock` explícito. `PRODUCT_STATE_SURFACE_OK` confirma 12 rutas con loading/error/empty y typecheck web verde.
- AI-06/AI-12/SQO-04: corregidas referencias históricas que aún limitaban las evals a cuatro agentes o declaraban prompt injection/supply-chain sin controles; la documentación vigente reconoce los diez agentes, release gate, anti-injection, SBOM y Trivy.
- AI-04/AI-07: actualizada la documentación RAG/memoria para reflejar anti-injection directa e indirecta en contexto no confiable, manteniendo como pendientes reales sólo corpus/chunking/autoridad y validación live de embeddings.
- AI-04: implementado chunking estructural compatible y ranking híbrido con autoridad documental; suite IA 56/56 y typecheck de `packages/ai` verdes.
- DB/AI-04: revisión de tipos confirma `knowledge_documents.authority/audience` y los RPC híbrido/semántico ya están representados en `packages/db/src/database.types.ts`; RAG/API pasa 5/5.
- Supabase: `SUPABASE_MIGRATION_READINESS.md` documenta el estado real: Auth/Data API públicos 200, service-role REST 200 y TCP accesible; sólo gestión de migraciones (CLI/psql/MCP OAuth) sigue pendiente.
- Supabase: añadido `scripts/check-supabase-readiness.mjs`, verificador reproducible sin exposición de secretos para repetir esta comprobación cuando se corrija el entorno.
- Supabase: las 7 migraciones posteriores a `20260824120000` fueron revisadas, probadas con rollback y aplicadas en orden al proyecto remoto; `localCount=71`, `remoteCount=71`, sin drift.
- Supabase advisors remotos: warnings existentes de políticas RLS duplicadas, índice Klaviyo duplicado y `search_path` mutable; las migraciones nuevas fijan `search_path` explícito en los RPC RAG y AI-26 usa `pg_catalog, public, private` en su función `SECURITY DEFINER`.
- Supabase: `db push` continúa fallando con `EUNKNOWN: uv_spawn` en Windows, pero Docker con red host permite usar `psql` contra el mismo PostgreSQL remoto. La aplicación quedó registrada y verificada; MCP sigue pendiente solo para advisors/types.
- Supabase types 2026-08-26: el typegen oficial se regeneró desde el remoto alineado con esquemas
  `public,private` y actualizó `packages/db/src/database.types.ts`; incluye AI-26, cola de memoria,
  Fathom y los RPC nuevos. Typecheck de db/API/web pasa.
- Supabase types: `gen types --db-url` requiere Docker Linux en esta instalación y no pudo consultar el esquema; se conservan los tipos locales verificados sin sobrescribirlos.
- `07`: `in_progress`; API y worker ya exponen contadores y el API también histograma de latencia; falta backend compartido de métricas, alertas basadas en SLO y simulacro real aislado de restore.
- `08`: `implemented_partial` / `blocked_external`; faltan credenciales, scopes y validación real.
- `09`: `in_progress`; es el bloque de consolidación, no un sustituto de las verificaciones externas.

INT-02 2026-08-26: la capa Graph de Meta admite `appsecret_proof` en peticiones autenticadas
server-to-server y lo conserva durante la paginacion opaca de `paging.next`. Sync, descubrimiento
de activos y polling de Insights pasan el secreto de app cuando esta configurado; OAuth de
intercambio mantiene su contrato separado. Test criptografico directo pasa 3/3.
La cobertura vigente incluye tambien `paging.next` y pasa 4/4.

INT-02/config 2026-08-26: `META_GRAPH_VERSION` queda validada por configuraciÃ³n con formato
`vN.N`; el cliente usa el valor configurado y conserva `v23.0` como fallback seguro. La versiÃ³n
no se cambia por una suposiciÃ³n mientras la documentaciÃ³n oficial de Meta devuelve 429.

INT-01/config 2026-08-26: el endpoint Shopify Admin GraphQL usa `SHOPIFY_API_VERSION`, validada
como `YYYY-MM`, con fallback seguro `2026-07`. La configuraciÃ³n y el cliente estÃ¡n cubiertos por
25 tests directos incluyendo endpoint versionado; la actualizaciÃ³n futura no requiere reescribir
OAuth ni los adaptadores de sincronizaciÃ³n.

## Bucle por bloque

```text
leer README + fase activa
  -> localizar contrato/código con codebase-memory
  -> implementar el incremento mínimo reutilizable
  -> añadir o actualizar prueba/gate
  -> ejecutar verificación directa
  -> actualizar fase + ESTADO_GLOBAL + esta cola
  -> pasar al siguiente bloque
```

## Evidencia de verificación 2026-08-26

Los gates directos de accesibilidad, catálogo de componentes y estados de producto pasan (`OK`).
La suite TAP se ejecutó con su runner real: IA 56/56, knowledge RPC 3/3 y batching de embeddings
2/2. Estos archivos usan `node:test`; Vitest no es el runner válido para ellos.
La revisión navegable local validó Dashboard, Integraciones, Conocimiento y Agentes con Supabase/API
activos. Se corrigieron dos fallos reales de datos vacíos: breadcrumbs sin `href` y `agent_outputs=null`.
El endpoint de readiness AI-26 ahora reconoce la respuesta `PGRST205` de PostgREST y degrada a
`local_prepared` sin 500 cuando la migración aún no existe; los errores de permisos siguen fallando.
Los diagnósticos IA del dashboard comparten una ejecución concurrente por organización, agente,
tienda y período mediante `single-flight`; se evita que varias tarjetas abiertas a la vez dupliquen
coste antes de que el cache de 24 horas quede escrito. La prueba directa pasa 3/3.
Observabilidad añade `evaluateHttpSlo` y el endpoint interno protegido `/health/slo`, que calcula
error rate y p95 desde las métricas locales y devuelve `ok`, `degraded`, `critical` o `no_traffic`.
La cobertura de observabilidad/API pasa 9/9 y 3/3 respectivamente.

Correccion de evidencia 2026-08-26: el runner real `npx tsx --test packages/ai/src/index.test.ts`
termina en 57/57. Las referencias 53/53 y 56/56 que aparecen en notas historicas no describen
la suite vigente y no deben usarse como criterio actual.

SQO-02/OPS 2026-08-26: `runOpsHealthCheck` ejecuta en paralelo el lote independiente de
conexiones en error, conexiones `syncing` y sync runs fallidos. Se conserva la validacion de cada
error y la misma salida de findings, reduciendo espera I/O sin cambiar el contrato operativo.
Typecheck API y observabilidad 9/9 pasan.

SQO-02/OPS 2026-08-26: el segundo lote de `runOpsHealthCheck` tambien se ejecuta en paralelo:
credenciales por expirar, presupuesto IA, organizaciones/conexiones pendientes de purga y backlog
de webhooks. Cada resultado mantiene su validacion y runbook; no se ocultan errores parciales.

SQO-02/OPS 2026-08-26: los findings de salud limitan summaries y strings de detalle antes de
generar artifacts o incidencias GitHub. El redactor común ya impone 2.000 caracteres; el contrato
de `finding` añade el límite de resumen para evitar payloads operativos descontrolados.
El resumen multi-tienda del dashboard limita las peticiones Shopify a 4 concurrentes, conserva el
orden y convierte errores individuales en estado vacío sin dejar el loading bloqueado. Test directo 2/2.

## Bloque activo

**06 — UI/UX y design system.** El runtime IA, conectores y readiness ya tienen contratos reutilizables; el siguiente recorrido local es cerrar las superficies visuales y de accesibilidad pendientes sin confundir preparación con conexión real. La estrategia RAG + fine-tuning está registrada y fine-tuning queda como experimento posterior, no como dependencia del piloto.

> FE-01/integraciones 2026-08-26: `IntegrationStatusBadge` da prioridad a la configuración
> (`Credenciales pendientes` / `Desactivado`) incluso si una respuesta inconsistente incluye una
> conexión. `Preparado` ya no puede ocultar una configuración incompleta; 7 tests de estados cubren
> credenciales, feature flag, conexión, salud y reautorización.

> FE-08/a11y 2026-08-26: `IntegrationActivationChecklist` anuncia cambios de preparación con una
> región viva y muestra un requisito explícito si el backend devuelve `ready=false` sin lista de
> motivos. Así el estado no depende solo de color ni deja una sección vacía.

> FE-08/copiloto 2026-08-26: el historial del copiloto usa semántica `role=log` y anuncia solo
> adiciones relevantes; el scroll respeta `prefers-reduced-motion`. Las respuestas siguen pasando
> por `AiEvidence`, sin presentar texto sin fuentes como dato verificado.

> OPS-00/env 2026-08-26: añadido `.env.example` versionable con placeholders seguros, formatos de
> versión Meta/Shopify y grupos OAuth todo-o-nada. La plantilla no activa conectores ni contiene secretos;
> la matriz de secretos queda enlazada con ella.

Referencia de autoría: `docs/ai/PROMPT_TEMPLATE_CANONICO.md`. Las prompts históricas no se reescriben; cada conversión crea una nueva versión con checksum.

> Shopify sync endurecido: el `initial_import` reutiliza una clave idempotente estable por bloque;
> los reintentos incrementales se agrupan por hora UTC y no crean una corrida nueva por cada retry.
> Test directo de idempotencia 2/2.

> Meta sync alineado: una corrida ya `succeeded` no se vuelve a ejecutar dentro del mismo día y
> bloque/cuenta. La clave diaria está cubierta por 2 tests directos adicionales.

> Retry operativo añadido: Integraciones permite relanzar el sync fallido de Shopify y Klaviyo sin
> repetir OAuth; las nuevas rutas validan organización, suscripción y rol antes de encolar el job.

> Los tres triggers de sync (Shopify, Meta Ads y Klaviyo) seleccionan la conexión más reciente,
> rechazan ejecuciones concurrentes y no permiten sincronizar una conexión aún no lista.

> AI-07 memoria endurecida: `memory_ingestion_queue` tiene claim `processing` compare-and-swap,
> recuperación de claims obsoletos y reconstrucción segura de chunks tras un fallo parcial. La migración local es
> `20260824130000_ai_07_memory_queue_claims.sql`; falta únicamente ejecutar el gate remoto cuando
> se autorice la aplicación de migraciones sobre producción.

> AI-06 release gate ejecutable: `packages/ai/src/release-gate.ts` bloquea la activación de una versión
> si falta evidencia, se incumple un umbral de calidad/seguridad/coste/latencia o existe un fallo crítico;
> sus 3 tests son puros y no dependen de conectores.

> FE-01 estados de conectores: `IntegrationStatusBadge` centraliza la semántica visual de
> `Preparado`, `No conectado`, `Conectado`, `Sincronizando`, `Reautorizar` y estados degradados;
> su lógica pura vive en `integration-status.ts` y tiene 4 tests directos. La UI no confunde
> configuración de infraestructura con una cuenta real autorizada.

> SQO-03 privacidad: la retención de `audit_logs` queda decidida explícitamente en
> `docs/decisions/ADR-0018-retencion-audit-logs.md`: sin purga temporal durante el pre-piloto y
> revisión obligatoria antes del primer cliente real. No se ejecuta ninguna eliminación ahora.

> AI-09 routing: `AI_MODEL_ROUTING_JSON` ya permite seleccionar modelo por agente y proveedor,
> con fallback seguro al modelo de la versión activa; 2 tests directos cubren override y fallback.
> `AI_PLAN_BUDGETS_JSON` ya vincula límites diarios/por turno al `plan_code` de la suscripción activa;
> quedan pendientes únicamente los valores comerciales finales y la agregación APM multi-instancia.

> INT activation gate: `evaluateIntegrationActivation` centraliza los nueve requisitos de cierre
> externo (credenciales, callback, scopes, respuesta, activo, sync, freshness, reautorización y
> error recuperable). 3 tests de contrato garantizan que la evidencia ausente nunca da `ready=true`.

> AI stack revisado: adopción incremental de LangChain para componentes de agentes, LangGraph para
> orquestación durable con estado/aprobación humana y LangSmith para trazas/evaluaciones opcionales.
> El primer piloto será no mutante y deberá demostrar paridad con el runtime actual antes de activar
> escrituras o automatizaciones.

> AI stack implementado: `@ecomscaling/ai` ya incluye el adaptador LangGraph de diagnóstico de solo
> lectura y el wrapper LangSmith opt-in; `apps/api/src/ai-runtime.ts` lo aplica a los turnos reales.
> 3 tests directos cubren orden del grafo y configuración segura del tracing.

> AI-14 orquestación opt-in: `AI_ORCHESTRATION_MODE=direct` es el default; `langgraph` ejecuta el
> turno ya protegido dentro de LangGraph y conserva presupuesto, fallback, validación y aprobación.
> 2 tests directos cubren selección conservadora y paridad del resultado.

> FE/AI runtime status: los diagnósticos devuelven solo `orchestration_mode` y `langsmith_tracing`;
> `AgentRuntimeStatusBadge` los presenta como estado operativo honesto y reutilizable. 2 tests de
> presentación cubren directo/apagado y LangGraph/tracing activo.

> AI-03 cost guard preparado: la nueva migración `20260824150000_ai_03_sql_gateway_cost_guard.sql`
> planifica con `EXPLAIN` sin ejecutar y rechaza un coste estimado superior a `100000`. La cola
> ya está aplicada y la función existe en Supabase remoto; queda una prueba funcional aislada del
> RPC como verificación posterior, no la aplicación del esquema.

> AI-15 resiliencia runtime preparada: `packages/ai/src/resilience.ts` centraliza timeout abortable,
> retries acotados para errores transitorios, backoff exponencial con jitter y límites I/O/CPU. Las
> llamadas Anthropic/OpenAI la reutilizan por petición de modelo; las tools no se reintentan para no
> duplicar efectos. El circuit breaker durable por organización completa la protección.

> SQO-07 métricas acotadas: `MetricsRegistry` limita a 5.000 series por proceso y expone
> `observability_metric_series_dropped_total` si se alcanza el límite. `/health/metrics` sigue siendo
> diagnóstico de una instancia; la agregación global requiere Redis/APM compartido y no se simula.

> INT-02 Meta endurecido: `meta-client.ts` ya tiene timeout abortable, retries para red/408/425/429/5xx,
> backoff máximo y soporte de `Retry-After`; la jerarquía futura de creación de anuncios sigue en
> modo preparado, `PAUSED` y con aprobación humana, sin fabricar campañas ni tokens.

> INT-03 Klaviyo alineado: el cliente aplica timeout abortable de 15 s y reintenta red, timeout,
> 408/409/425/429 y 5xx, respetando `Retry-After` y sin reintentar 401/403/404 ni validaciones.

> INT-01 Shopify alineado: GraphQL incorpora timeout abortable de 15 s, retries acotados de red,
> timeout, 408/425/429 y 5xx, backoff máximo y conserva la idempotencia de los syncs; los errores
> de autenticación, permisos y payload no se repiten.

> DB-12 gate formalizado: AI-07/AI-03 y sus tipos locales están preparados; aplicar migraciones,
> advisors, typegen oficial y pruebas end-to-end remotas queda pendiente de permisos Supabase MCP.

> OPS-03 worker endurecido: el trigger interno de Shopify usa timeout de 10 s, retries de red/408/425/
> 429/5xx, backoff y `Retry-After`, con correlación estable del job y sin bucles infinitos.

DB-13: `packages/db/src/fathom-webhook.types.ts` mantiene un overlay local para la cola INT-04,
sus estados de claim/retry, payloads JSON y `consulting_calls.external_recording_id`. El handler
API consume el contrato en la frontera del typegen privado. Falta regenerar el typegen oficial y
validar migracion/advisors en Supabase cuando el MCP tenga permisos.

> AI-19/BE-07: la matriz offline `apps/api/src/be-07-sql-gateway-evals.test.ts`
> formaliza cinco categorias de eval: analitica segura, escrituras, cross-schema,
> abuso de recursos y frontera del parser. No toca Supabase y complementa las
> pruebas remotas de RLS y tenant.

> AI-20: `evaluateAgentEvidenceContract` y `evaluateEvidenceConsistency` ya se
> ejecutan en la matriz de los diez agentes. Verifican grounding tenant-bound,
> abstencion por falta de datos y contradicciones entre afirmaciones normalizadas
> y hechos estructurados. La semantica libre LLM queda separada como gate
> posterior con dataset versionado.

> AI-21: `AGENT_EVAL_DATASET_VERSION=2026-08-26.v1` contiene un fixture
> reproducible por cada agente activo y ejecuta grounding, abstencion, consistencia
> y anti-injection sin conectores ni empresas reales.

> FE-08: `AiEvidence` separa la evidencia por mensaje del copiloto y comunica
> estados verificados, parciales o insuficientes. La lógica pura tiene test
> directo y el typecheck web pasa.

> INT-06: el contrato de estados UI da precedencia a salud `stale`, `degraded`
> y `reauthorization_required` sobre una conexión genérica `connected`; 6 tests
> de integración/UI y los typechecks web/integrations pasan.

> INT-07: el activation gate ahora deriva requisitos según capacidades del
> proveedor. Fathom no queda bloqueado por gates OAuth/sync que no soporta;
> Meta mantiene todos sus requisitos de cuenta, permisos, sync y freshness.

> INT-07 cableado: el endpoint de Integraciones devuelve `activation.ready` y
> `activation.missing`, y `IntegrationActivationChecklist` los muestra sin
> secretos. API/web typechecks y los tests de configuración pasan.

> INT-04 health loop cerrado 2026-08-26: el procesador de webhooks Fathom actualiza
> `integration_connections.last_sync_at` solo después de materializar correctamente
> el evento y limpia el error anterior. Los fallos dejan `last_error_at/message`
> acotados para que la salud pase a degradada sin revocar la conexión. 4/4 pruebas
> del handler y el typecheck de API pasan.

> OPS/INT performance 2026-08-26: `reconcileAllMetaConnections` usa
> `mapWithConcurrency` con límite 3 para evitar fan-out ilimitado de I/O entre
> cuentas. El helper conserva el orden, mantiene el aislamiento de errores y tiene
> pruebas de concurrencia y colección vacía; typecheck de API pasa.

> INT-02 performance 2026-08-26: `syncAdAccountInsights` construye y deduplica
> payloads por clave natural, hace batch upsert de filas diarias y batch upsert de
> acciones. Mantiene conversiones numéricas, tenant y on-conflict idempotente.
> `meta-sync-batch.test.ts` y el typecheck de API pasan.

> OPS/INT performance 2026-08-26: Klaviyo y Shopify ya disponían de batch upsert
> (Klaviyo por reporte y Shopify por bloques). El fan-out de reconciliación Klaviyo
> ahora reutiliza `apps/api/src/async-concurrency.ts` con límite 2; Meta lo usa con
> límite 3. Se preservan orden y aislamiento de errores.

> FE-08 notifications 2026-08-26: `NotificationsBell` ya no deja loading infinito
> cuando falla `/v1/notifications`; anuncia el error, ofrece reintento, cierra con
> Escape y solo decrementa el contador al archivar una notificación realmente no
> leída. Typecheck web pasa.

> AI-22 2026-08-26: A03, A05 y A07 ya tienen definiciones, versiones y prompts
> canónicos de nueve secciones en `20260826120000_ai_22_prepared_agent_prompts.sql`.
> Sus futuras tools están declaradas, pero definición y versión permanecen
> `is_active=false` hasta que conectores, scopes y pruebas reales existan.

> AI-23 2026-08-26: `TOOL_REGISTRY` y `TOOL_CONTRACTS` ya declaran
> `meta_read_ad_accounts`, `meta_read_campaign_insights`, `instagram_read_media`
> e `instagram_read_insights` con paginación, fechas y provenance. Permanecen
> `planned`, por lo que `authorizeTool` no permite usarlas sin executor real.

> AI-24 2026-08-26: el runtime identifica las tools preparadas sin executor,
> no las expone al proveedor y añade una instrucción explícita de abstención al
> prompt. El guard es puro y queda cubierto junto al Tool Layer; así se puede
> activar una versión futura sin convertir una capacidad declarativa en una
> llamada opaca o no autorizada.

> AI-25 2026-08-26: `evaluateReleaseGate` puede exigir cobertura explícita por
> agente y bloquear cualquier `agentEvalFailure`. Así las métricas agregadas no
> permiten activar una versión si falta uno de los diez agentes o si uno falla
> una eval crítica.

> AI-26 2026-08-26: la evidencia de evals queda preparada para persistirse por
> versión, dataset, modo y agente en `agent_version_evaluations` y
> `agent_version_eval_results`. La migración local incluye unicidad, RLS y
> overlay de tipos; `agent-eval-evidence.ts` serializa los resultados sin I/O y
> rechaza duplicados o evaluaciones vacías. La RPC privada y el wrapper API
> persisten el resumen y los resultados de forma atómica e idempotente. El
> typegen y la aplicación remota siguen siendo externos.

> AI-27 2026-08-26: `agent-eval-runner.ts` ejecuta la matriz offline para las
> versiones activas y persiste la evidencia por versión con dataset versionado.
> No crea empresas ni usa proveedores; queda preparado para conectarse a un
> worker/cron. El entrypoint y workflow manual `agent-evals.yml` ya existen; el
> schedule automático permanece comentado. `shadow`/`live` quedan para cuando
> existan claves y datasets.

> AI-28 2026-08-26: la página de agentes incorpora `AgentEvalReadinessPanel`,
> reutilizable y accesible, que diferencia matriz offline preparada, evidencia
> registrada y evals live pendientes. La UI no presenta validación de proveedor
> sin evidencia real.

> AI-29 2026-08-26: `/v1/agents/eval-readiness` conecta el panel con AI-26,
> filtra el catálogo de diez agentes y devuelve `local_prepared` si la tabla
> remota aún no existe. El panel ya no depende de un estado estático cuando la
> evidencia esté disponible.
> El fallback solo cubre la ausencia esperada de la tabla; errores de permisos o
> infraestructura ya no se silencian como estado preparado.
> Además, solo se cuentan evaluaciones relacionadas con versiones activas.

> AI-30 2026-08-26: `live-eval-contract.ts` prepara los modos `shadow` y `live`
> con provider inyectable, criterios de evidencia/abstención, coste, latencia y
> trazabilidad. Sin provider configurado falla explícitamente y no realiza
> llamadas ficticias. También genera automáticamente un caso base para los diez
> agentes, evitando omisiones al activar claves.
> Las invocaciones reutilizan timeout, retries y backoff exponencial de la
> política común; el circuit breaker permanece en el runtime de proveedor.
> La suite también abre un circuito local tras fallos repetidos y marca los
> casos restantes como `circuit_open` sin realizar llamadas adicionales.

> AI-31 2026-08-26: los resultados `shadow/live` ya se pueden convertir al
> payload AI-26, conservando score, coste, latencia y `traceId` por caso. La RPC
> existente los puede guardar sin introducir una segunda ruta de evidencias.
> La suite por lotes limita la concurrencia I/O y conserva errores por caso para
> no perder el resto de la evaluación ante un timeout del proveedor.

## No confundirse con el cierre externo

La cola permite seguir implementando campos, contratos, agentes, UI, tests y documentación sin credenciales. El cierre de producción seguirá requiriendo: conexión Meta/Klaviyo/Instagram/Fathom real, scopes aprobados, restore aislado, validación visual/assistiva, decisión legal de retención/subprocesadores y observabilidad compartida.

La checklist ejecutable de requisitos, evidencia y activación está en
[`BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`](roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md).

## AI-16 completado localmente: RAG y Playbook anti-injection

`packages/ai/src/untrusted-context.ts` centraliza la frontera de datos no confiables para conocimiento propio, metodologÃ­a global, Playbook inteligente, conectores y resultados de tools. Los ciclos Anthropic/OpenAI usan delimitadores, lÃ­mites de tamaÃ±o y neutralizaciÃ³n de intentos de prompt injection directa/indirecta. El detalle y los tests adversariales estÃ¡n en `roadmaps/05-agentes-ia/AI-16-RAG-PLAYBOOK-ANTI-INJECTION.md`.

## AI-17/AI-18 incremento de calidad de agentes

La matriz `packages/ai/src/agent-evals.ts` cubre los diez agentes del catÃ¡logo (incluidos A03/A05/A07 preparados) con casos de calidad, abstenciÃ³n, seguridad, tenant y rendimiento. No crea empresas reales: usa fixtures sintÃ©ticas offline. AI-18 aÃ±ade A08 a la activaciÃ³n de prompts canÃ³nicos de nueve secciones mediante `20260824170000_ai_18_a08_canonical_prompt.sql`.

INT-04 incrementado localmente: `fathom-webhook-handler.ts` verifica firma y replay, resuelve
tenant por conexiÃ³n, persiste eventos `queued` y responde duplicados de forma idempotente. El
consumidor que materializa la llamada y ejecuta A01 queda separado y exige aprobaciÃ³n humana.

INT-04/FE-08: Fathom ya estÃ¡ incluido en `INTEGRATION_CATALOG` y en la pantalla de Integraciones
como capacidad preparada con webhook, sin OAuth ni sincronizaciÃ³n ficticia. La tarjeta mantiene
los estados reutilizables y solo se habilita con sus secretos server-side.

INT-02 Meta Ads: `meta-ad-write-contract.ts` prepara el plan dry-run campaign → adset → creative →
ad, con `PAUSED`, aprobación humana, ids externos para reanudación, idempotency key y rechazo de
secretos. No ejecuta POSTs ni fabrica campañas; queda listo para conectar `meta-client.ts` cuando
Meta conceda `ads_management` y exista una cuenta real de validación.

INT-02/FE-09 2026-08-26: la auditoría de payloads parciales encontró que el hook compartido
`useShopifyOverview` no capturaba excepciones de red de `apiFetch`; una caída de red podía dejar
`/shopify` o `/shopify/diagnostico` en loading indefinido. Ahora captura timeout/red/sesión caducada,
libera siempre los estados de carga y muestra el error reutilizando el mismo contrato de UI. El
typecheck web pasa. La revisión viva de Graph API/Meta Devtools MCP queda documentada en INT-02;
la consulta directa de las dos páginas oficiales fue temporalmente limitada por HTTP 429, por lo que
no se introduce ninguna versión o permiso no verificado.

INT-01/BE-10 2026-08-26: `triggerShopifySync` ya recupera correctamente una conexión cuyo sync
quedó atascado. Antes actualizaba la fila a `error` pero continuaba evaluando el estado antiguo
`syncing`, por lo que rechazaba el relanzamiento. Ahora mantiene el estado efectivo, comprueba el
error de la recuperación y solo inicia el sync cuando la transición quedó confirmada. El typecheck
del API pasa.

INT-02/BE-12 2026-08-26: Meta Ads recupera un `syncing` stale de más de diez minutos, comprueba
la transición a `error` antes de relanzar y actualiza la conexión si el trabajo en segundo plano
falla. El log conserva solo el id de conexión, la operación y un mensaje acotado. Typecheck API,
Meta OAuth y contrato de sync pasan.

INT-03/BE-11 2026-08-26: los syncs de Klaviyo lanzados tras OAuth o desde la UI ya no silencian
fallos de segundo plano. `markKlaviyoSyncFailure` persiste `error`, timestamp y mensaje acotado en
la conexión, y registra solo el identificador de conexión, operación y error sanitizado. Si también
falla la persistencia, queda indicado en el log operativo. Typecheck API, OAuth Klaviyo y adapters
pasan.

INT-00/BE-13 2026-08-26: Shopify, Meta y Klaviyo reclaman ahora la transición a `syncing` con un
`UPDATE ... WHERE id = ? AND status = ? RETURNING id`. Una segunda petición concurrente recibe `409`
y no inicia un segundo trabajo. Esto cubre la carrera entre lectura de conexión y lanzamiento del
sync sin locks de aplicación. Typecheck API pasa.

INT-02/OPS-14 2026-08-26: el reconciliador incremental de Meta también reclama cada conexión con
el mismo `UPDATE` condicional antes de ejecutar `runMetaSync`; si el sync manual ya ganó, el job se
marca `skipped` y no duplica trabajo. El resultado del reconciliador expone `succeeded`, `failed` y
`skipped` para observabilidad operativa.

INT-01/OPS-15 2026-08-26: el reconciliador de Shopify también reclama la conexión antes de ejecutar
`runShopifyInitialSync`, incluyendo la recuperación condicional de estados `syncing` stale. Las
carreras con sync manual quedan como `skipped`; los errores de recuperación o claim incrementan
`failed` y se registran. El resultado expone `attempted`, `failed` y `skipped`; typecheck API pasa.

DB-11/AI-04 2026-08-26: se actualiza la evidencia del roadmap RAG para reflejar el código actual:
chunking estructural con solape, embeddings por batches/concurrencia acotada, fallback de búsqueda
híbrida y ranking de autoridad preparado. El estado continúa `verification_pending` por corpus real,
precisión de citas y re-embedding; las migraciones locales ya están aplicadas remotamente; no se presenta
como cerrado por una prueba sintética.

AI-04/DB-11 2026-08-26: `RAG_EMBEDDING_PROFILE` centraliza versión de chunking, modelo, dimensiones,
maxChars y overlapChars. `VoyageEmbeddingProvider` y `chunkText` reutilizan el perfil, mientras los
tests siguen permitiendo inyectar modelos alternativos. Esto deja una única fuente de verdad para
planificar re-embedding sin cambiar el contrato swappable.

FE-02/FE-08 2026-08-26: el Dashboard captura ahora excepciones de red en sus cargas de Shopify,
métricas Meta/Shopify, configuración financiera y operaciones. Cada carga limpia su estado en
`finally` y muestra un error recuperable, evitando tarjetas bloqueadas en loading cuando falla
`apiFetch` antes de recibir una respuesta HTTP. Typecheck web y los tres gates UI/accesibilidad pasan.

FE-02/OPS-16 2026-08-26: las métricas Shopify y Meta del Dashboard se solicitan ahora en paralelo
con `Promise.allSettled`; un timeout de Meta ya no retrasa ni borra las métricas Shopify válidas.
Cada proveedor conserva su propio estado vacío/error y el loading común siempre finaliza. Typecheck
web y los gates de estados/accesibilidad pasan.

FE-02/INT-07 2026-08-26: Integraciones endurece las cargas de estado, métricas Klaviyo,
reporting Klaviyo y activos Meta con `try/catch/finally`; los fallos de red dejan un mensaje
recuperable, limpian los datos obsoletos y nunca dejan un spinner bloqueado. Al perder una
conexión, sus estados derivados vuelven explícitamente a vacío/no cargando. Typecheck web y
los gates de UI/accesibilidad pasan.

FE-02/INT-08 2026-08-26: las acciones de OAuth, reintento de sincronización y guardado de
selecciones de Shopify, Meta y Klaviyo usan también `try/catch/finally`. Los botones recuperan
su estado tras timeouts o excepciones de `apiFetch`, y la UI conserva el estado anterior sólo
cuando la operación remota confirmó éxito; no se simula una conexión ni una sincronización.
Typecheck web y los tres gates de UI/accesibilidad pasan.

FE-03/AI-04 2026-08-26: Conocimiento/RAG captura errores de red en carga de documentos,
ingestión y búsqueda semántica; los estados `loading`/`saving`/`searching` siempre terminan
en `finally`, la vista sin organización no queda bloqueada y la lectura de archivos inválidos
produce un error recuperable. Los resultados/documentos existentes no se borran por un fallo
independiente de otra operación. Typecheck web y los gates UI pasan.

FE-06/AI-06 2026-08-26: `AiDiagnosticSection`, componente compartido por Dashboard,
Conocimiento y otras rutas, captura fallos de red en cargar, regenerar y aprobar outputs para
crear tareas. Sus estados `loading`, `regenerating` y `creatingTasks` siempre se liberan y
ninguna excepción de transporte convierte una acción IA en un spinner permanente. El output
local sólo cambia a aprobado tras confirmación HTTP exitosa. Typecheck web y gates UI pasan.

FE-04/BE-08 2026-08-26: Operaciones/Tareas endurece carga, evaluación de reglas, cambios de
estado de tareas y alertas, y envío de comentarios con `try/catch/finally` o recuperación
explícita. Una operación de red fallida no muestra un toast de éxito ni borra el payload actual;
la evaluación sólo recarga después de una respuesta exitosa. Typecheck web y gates UI pasan.

FE-05/BE-09 2026-08-26: Mi Camino centraliza las mutaciones de planes, fases, hitos y tareas
en un helper con manejo de HTTP/red; crear, activar, editar y añadir sólo muestran éxito y
recargan el plan tras confirmación remota. Los formularios permanecen abiertos si la operación
falla, el estado de carga del plan siempre termina y una organización sin plan muestra vacío.
Typecheck web y gates UI pasan.

FE-07/AI-11 2026-08-26: Marketing/Contenido endurece carga, generación de borradores,
decisión humana, edición, historial de versiones y copia de HTML. Los estados de generación y
mutación siempre se liberan, las ediciones no se cierran si falla la red y la aprobación sólo
se refleja tras confirmación HTTP; el portapapeles tiene fallback explícito. Typecheck web y
gates UI pasan.

FE-06/AI-10 2026-08-26: Llamadas/Consultor endurece carga y registro de llamadas, y el helper
compartido de análisis, resumen, aprobación, notas y tareas. Las operaciones sólo notifican
éxito tras HTTP confirmado, el busy state siempre termina y el formulario de registro conserva
los datos si falla la red. Typecheck web y gates UI pasan.

FE-01/DB-03 2026-08-26: Configuración financiera y cobertura Shopify capturan fallos de red,
liberan siempre sus estados de carga/guardado y conservan los valores editados si el servidor
no responde. Añadir/quitar gastos evita duplicados durante la misma operación y sólo refresca
la configuración tras éxito confirmado. Typecheck web y gates UI pasan.
