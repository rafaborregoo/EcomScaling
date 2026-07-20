# Estado global

> Matriz operativa. Formato de estado y evidencia definido en
> [`ESTADOS_Y_EVIDENCIA.md`](ESTADOS_Y_EVIDENCIA.md) — no se acepta "completado" sin la evidencia
> correspondiente. Actualizar esta tabla y el bloque de detalle al cerrar o reabrir una fase.
> **Ultima auditoria de estados: 2026-07-20.**

## Release activo

**Pre-piloto: consolidacion Shopify + IA en shadow mode (equivalente a F7-F10 del roadmap maestro).**
Corregido 2026-07-20: llamarlo "post-MVP" era prematuro — no hay piloto formal todavia (OPS-01 sigue
`planned`), no existe staging, faltan runbooks, faltan los webhooks de privacidad obligatorios de Shopify,
y no hay observabilidad ni auditoria conectada (`audit_logs` sin escrituras, ver SQO-02/SQO-03). Shopify
end-to-end + motor financiero + alertas/tareas + agentes A02/A04/A06/A08/A09 funcionan sobre datos reales
en shadow mode (aprobacion humana antes de escribir); el foco actual es cerrar deuda de verificacion y
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
| DB-00 infraestructura | `verification_pending` | sin asignar | ninguno | Documentar comando/resultado del test de permisos base. |
| DB-01 enums core | `verification_pending` | sin asignar | ninguno | Documentar transiciones validas y tests de valores. |
| DB-02 auth/multitenant/RLS | `verification_pending` | sin asignar | ninguno | Ampliar matriz de tests (insert/update cross-tenant, RPC, storage). |
| DB-03 configuracion financiera | `verification_pending` | sin asignar | ninguno | Anadir `calculation_version`, golden tests numericos. |
| DB-04 integraciones comunes | `blocked` | sin asignar | falta diseno de maquina de estados de webhook + tests de idempotencia real | Disenar estados de webhook y probar entrega duplicada concurrente. |
| DB-05 Shopify vertical slice | `verification_pending` | sin asignar | ninguno | Reconciliar cifras reales contra Shopify y registrar desviacion tolerada. |
| DB-06 Meta Ads | `blocked` | sin asignar | credenciales/App Review de Meta | Sin accion posible hasta aprobacion de Meta. |
| DB-07 alertas/tareas/plan | `verification_pending` | sin asignar | ninguno | Formalizar maquina de estados de tareas y SLA de overdue. |
| DB-08 llamadas + runtime agentes | `in_progress` | sin asignar | ninguno | Redactar JSON Schema formal de salida A01 y tests de alucinacion. |
| DB-09 Klaviyo | `planned` | sin asignar | ninguno (no iniciado) | Definir contrato (API revision, metrica de conversion primaria) antes de migrar. |
| DB-10 Instagram | `planned` | sin asignar | credenciales Meta/Instagram | Igual que DB-06: sin accion hasta credenciales. |
| DB-11 RAG / conocimiento IA | `verification_pending` | sin asignar | ninguno | Anadir dataset de evals de retrieval (recall@k, contaminacion cross-tenant). |
| BE-00 fundaciones API/worker | `verification_pending` | sin asignar | ninguno | Anadir healthcheck Docker, readiness vs liveness, escaneo de dependencias. |
| BE-01 identidad/tenancy | `verification_pending` | sin asignar | ninguno | Revisar diseno de "memberships virtuales" (ver nota abajo) y anadir tests de organizacion manipulada. |
| BE-02 integrations core | `planned` | sin asignar | ninguno | Redactar contratos concretos (maquina de estados OAuth, retry, circuit breaker) antes de tratarlo como implementable. |
| BE-03 Shopify metricas | `in_progress` | sin asignar | ninguno | Dividir en connector/worker/motor financiero/API y documentar formula exacta por KPI. |
| BE-04 Meta adquisicion | `blocked_external_validation` | sin asignar | App Review/business verification de Meta | Completar matriz de flujo y documentar action_type/atribucion mientras se espera. |
| BE-05 operaciones | `functionally_complete_verification_pending` | sin asignar | ninguno | Documentar que pasa si llega transcripcion nueva sobre un resumen ya aprobado; anadir tests automatizados. |
| BE-06 Klaviyo/stock/campanas | `planned_after_mvp` | sin asignar | DB-09 | Sin iniciar. |
| BE-07 AI runtime/RAG | `partial_security_and_quality_pending` | sin asignar | ninguno | Evals adversariales del SQL Gateway (cross-tenant, prompt injection) antes de darlo por completo. |
| FE-00 shell/design system | `superseded_by_FE-08` | sin asignar | ninguno | Reescribir para describir el sistema v2 vigente o fusionar en FE-08. |
| FE-01 auth/onboarding | `implementation_unknown` | sin asignar | ninguno | Modelar onboarding como maquina de estados explicita. |
| FE-02 dashboard | `functionally_complete_e2e_pending` | sin asignar | ninguno | Tipar catalogo de `IntegrationAction`; auditar responsive 375px. |
| FE-03 tareas/alertas | `implementation_documentation_incomplete` | sin asignar | ninguno | Documentar matriz de visibilidad por rol; evaluar tabla con paginacion. |
| FE-04 llamadas/Mi Camino | `functionally_complete_ux_validation_pending` | sin asignar | ninguno | Corregir descripcion de "deteccion Fathom" (no es integracion real); dividir documento. |
| FE-05 planificacion/retencion | `planned` | sin asignar | BE-06, DB-09 | Sin iniciar. |
| FE-06 consultor IA/contenido | `planned_contract_incomplete` | sin asignar | DB-10 (Instagram) | Actualizar doc: ya se eligio copiloto lateral, no chat de pagina completa. |
| FE-07 panel consultor | `in_progress_core_product` | sin asignar | ninguno | Documentar matriz de acciones admin vs consultant. |
| FE-08 UI/UX | `in_progress` | sin asignar | ninguno | Riesgo de producto abierto: borrado irreversible sin decision de soft-delete (ver `RIESGOS.md`). |
| INT-00 nucleo comun integraciones | `in_progress` | sin asignar | ninguno | Extraer interfaz de adaptador real a partir de Shopify/Meta (hoy no existe, cada uno la reimplementa). |
| INT-01 integraciones (Shopify) | `verification_pending` | sin asignar | ninguno | Anadir 3 webhooks de privacidad obligatorios (`customers/data_request`, `customers/redact`, `shop/redact`) — bloquea aprobacion de distribucion publica. |
| INT-02 integraciones (Meta Ads) | `blocked` | sin asignar | Meta App Review | Documentar `canonical_purchase_action_type`; decidir si Insights async es necesario. |
| INT-03 integraciones (Klaviyo) | `planned` | sin asignar | DB-09, BE-06 | Sin codigo todavia; reauditar `api_revision` de la guia de referencia antes de programar. |
| INT-04 integraciones (Loom/Fathom) | `in_progress` (Loom manual `done`, Fathom `planned`) | sin asignar | ninguno | Decidir modo de auth de Fathom (API key vs OAuth) antes de escribir codigo. |
| INT-05 integraciones (Instagram) | `planned` | sin asignar | INT-02 | Bloqueado por scopes de Meta: `META_SCOPES` hoy no pide `instagram_basic`/`instagram_manage_insights`. |
| AI-00 contratos/runtime | `verification_pending` | sin asignar | ninguno | Aplicar presupuesto real (hoy solo se registra `estimateCostUsd`, no se bloquea). |
| AI-01 A01 llamadas | `pilot_ready` | sin asignar | ninguno | Fingerprint de dedup de tareas (hoy es titulo exacto normalizado). |
| AI-02 A02 monitor | `shadow_pilot` | sin asignar | ninguno | Migrar a evidence pack precalculado (sigue con `sql_select` libre, ~73s/run). |
| AI-03 SQL Gateway | `security_verification_pending` | sin asignar | ninguno | Acotar `WITH RECURSIVE`; test de aislamiento tenant extremo a extremo. |
| AI-04 RAG | `implementation_complete_live_validation_pending` | sin asignar | falta `VOYAGE_API_KEY` | Validar retrieval real antes de invertir en chunking estructural. |
| AI-05 especialistas | `in_progress` (por agente, ver detalle) | sin asignar | A03/A05/A07 bloqueados por Meta | Ver detalle abajo. |
| AI-06 evaluaciones | `foundational_work_in_progress` | sin asignar | ninguno | P0 — dataset de A02 antes de anadir mas agentes. |
| AI-07 memoria acumulativa | `planned_architecture_revision_required` | sin asignar | ninguno | Riesgo de diseño: memoria alimentandose de sus propios resumenes (ver detalle). |
| SQO-00 seguridad base | `verification_pending` | sin asignar | ninguno | Ampliar matriz RLS a config. financiera y conexiones; tests de integridad FK cross-tenant. |
| SQO-01 testing | `in_progress` | sin asignar | ninguno | Anadir `npm run lint` a CI (no corre hoy pese a estar documentado como si bloqueara). |
| SQO-02 observabilidad | `planned_critical` | sin asignar | ninguno | Sin logging estructurado ni error tracking en ningun `package.json` — elegir stack minimo. |
| SQO-03 privacidad/auditoria | `planned_critical` | sin asignar | ninguno | `audit_logs` existe en el esquema (DB-02) pero ningun endpoint escribe en ella — conectar escrituras sensibles ya existentes. |
| OPS-00 entornos/CI-CD | `in_progress` | sin asignar | falta decidir Q-001 (proveedor API/worker) | Sin staging real; sin Dockerfiles de API/worker. |
| OPS-01 piloto MVP | `planned` | sin asignar | OPS-00 (staging), varios criterios de entrada sin cumplir | Ninguno de los criterios de entrada al piloto esta marcado todavia. |
| OPS-02 runbooks/soporte | `planned` | sin asignar | ninguno | Escribir el runbook de sync fallido primero (mayor probabilidad). |

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
- **DB-04 (integraciones comunes)**: es el unico bloque en `blocked` real: falta una maquina de estados
  de webhook explicita y una prueba real de dos webhooks identicos concurrentes. El indice unico actual
  evita el duplicado exacto, pero no demuestra idempotencia del efecto de negocio completo.
- **DB-05 (Shopify)**: `shopify_customers` si existe en las migraciones reales
  (`20260715200000_db_06_shopify_customers.sql`) aunque el snapshot conceptual no la reflejaba — la
  incoherencia estaba en el documento/snapshot, no en el esquema real. Pendiente: reconciliacion
  documentada contra una tienda real con desviacion tolerada explicita.
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

- **FE-00**: el design system "v1" que describe fue reemplazado por el rediseno "Libro Mayor" v2
  (documentado ahora en FE-08/changelog); reclasificado `superseded_by_FE-08`.
- **FE-06 vs FE-08**: la contradiccion que señalaba la auditoria ("chat de pagina completa" vs "IA
  integrada, no un chat aparte") **ya esta resuelta en codigo**: existe un panel lateral global
  (`copilot-panel.tsx`), no una pagina `/consultor-ia`. FE-06 necesita actualizarse para reflejarlo.
- **FE-07 (panel consultor)**: el health score que ordena "que cliente necesita atencion" **es
  deterministico**, calculado en Node (`listConsultantOrganizations`, formula por severidad de alertas +
  antiguedad + tareas vencidas) — la IA no decide el orden, exactamente lo que pedia la auditoria.
- **Riesgo de producto real identificado (no solo documental)**: el CRUD de Consultoria permite borrar
  una organizacion entera de forma irreversible desde una UI normal. La cascada de FK esta verificada
  (integridad referencial), pero eso no es lo mismo que la decision de producto de permitir un hard-delete
  inmediato. Sin mitigar — ver `RIESGOS.md` y la seccion "Riesgo de producto abierto" en FE-08.
- El contexto de cliente/tienda activos depende de `localStorage` como fuente casi unica (riesgo de
  enlaces no reproducibles y de operar sobre el cliente equivocado) — ver ADR-0010 y `RIESGOS.md`.

### Integraciones (INT-00 a INT-05)

Ver estado detallado por conector en `roadmap/roadmaps/04-integraciones/fases/INT-0X-*.md`. Resumen:

- **INT-00 (nucleo comun)**: el esquema comun (conexiones, sync runs, webhook events, enum de 6
  proveedores) ya existe en DB-04, pero no hay una interfaz de adaptador de codigo compartida — Shopify y
  Meta implementan el mismo patron en paralelo sin contrato comun. Reclasificado `in_progress` (no
  `Completado` como decia la version anterior).
- **INT-01 (Shopify)**: end-to-end validado con una tienda real (`padelespana.myshopify.com`). Bug real
  corregido 2026-07-20: el handler de webhooks verificaba el HMAC solo contra el secret de la app publica,
  rechazando el 100% de los webhooks reales de la tienda instalada via app custom (dos secrets distintos,
  mismo problema que ya se habia resuelto en el callback OAuth). Ya prueba ambos secrets. Gap real nuevo
  encontrado en esta auditoria: solo 4 webhook topics registrados y **ninguno de los 3 webhooks de
  privacidad obligatorios** (`customers/data_request`, `customers/redact`, `shop/redact`) que Shopify
  exige para aprobar distribucion publica — bloqueador concreto y accionable, no solo "esperar revision".
  Tampoco hay `app/uninstalled`, por lo que una desinstalacion desde Shopify no se refleja en el estado de
  la conexion.
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

Ver estado detallado por fase en `roadmap/roadmaps/05-agentes-ia/fases/AI-0X-*.md`. Ninguna fase de este
dominio se declara `done` en esta revision — los tres criterios de cierre que antes marcaban AI-00 como
completa (organizacion fija, sin SQL de escritura, salida validable) son necesarios pero no suficientes:
un JSON con schema correcto puede seguir siendo un diagnostico incorrecto, caro o desactualizado.

- **AI-00**: runtime solido (organizacion fijada en backend, SQL Gateway como unica via, validacion Zod +
  `checkOutputSanity`, versionado con rollback), pero **el presupuesto se registra, no se aplica** — un
  run puede costar lo que sea sin bloquearse. Sin maquina de estados formal ni model routing documentados.
- **AI-01 (A01 llamadas)**: el agente mejor delimitado del proyecto (fuente unica, aprobacion humana,
  trazabilidad). Gap real confirmado en codigo: dedup de tareas por titulo exacto normalizado
  (`calls.ts:474-516`), no por fingerprint semantico — dos tareas equivalentes con redaccion distinta no
  se detectan.
- **AI-02 (A02 monitor)**: es el agente con mas impacto comercial y el que menos control tiene. Sigue con
  `allowed_tools = ["sql_select", "search_knowledge"]` (SQL libre, ~7 consultas/~73s/~0,17 USD por run) en
  vez del evidence pack precalculado que **ya se aplico a A06** tras su incidente — el patron para
  arreglarlo ya existe en el propio codebase, solo falta copiarlo a A02.
- **AI-03 (SQL Gateway)**: 28 tests adversariales reales (no 12). El tenant se fija con `set_config`
  dentro de una unica llamada RPC transaccional (`agent_sql_gateway`), no sobre una conexion de pool
  reutilizada por Node — el riesgo de fuga de GUC entre organizaciones que suele señalarse en este patron
  es menor de lo esperado aqui, aunque sigue sin existir un test automatizado que lo confirme extremo a
  extremo. Gap real ya documentado en BE-07: `WITH RECURSIVE` explicitamente permitido.
- **AI-04 (RAG)**: implementacion completa, bloqueada solo por falta de `VOYAGE_API_KEY` para validar en
  vivo. Gaps de diseño mas alla de la key: chunking por parrafos (rompe tablas/listas), solo busqueda
  vectorial (sin hibrida), sin autoridad de fuentes ni resolucion de contradicciones.
- **AI-05 (especialistas)**: A04/A06/A08/A09 en `shadow_pilot`/`in_progress`; A03/A05/A07 bloqueados por
  credenciales Meta/Instagram; A00 (orquestador) diferido por decision explicita, no por bloqueo. Riesgo
  real sin resolver: A02 y A04 no tienen frontera de responsabilidad escrita — pueden proponer tareas
  solapadas.
- **AI-06 (evaluaciones)**: `checkOutputSanity` (guarda de sanidad estructural, 15 tests) esta en
  produccion, pero **no es groundedness** — no verifica que cada afirmacion este respaldada por una
  metrica/cita concreta. Sin datasets por agente, sin quality gates, sin proceso de regresion formal.
  Prioridad P0 explicita: no anadir mas agentes antes de tener una primera version seria de este archivo.
- **AI-07 (memoria acumulativa)**: `planned`, no iniciada. Riesgo de diseño real identificado (no solo
  documental): el plan actual re-ingiere informes generados por IA como RAG encadenado, lo que puede
  degradar precision con el tiempo (un resumen del resumen hereda y amplifica imprecisiones). No
  implementar sin decidir antes: no descartar datos/informes originales, marcar lo generado como
  `derived`/`not_canonical`, y separar memoria de decisiones/restricciones del cliente (que no es RAG) de
  memoria semantica (que si lo es).
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
  helmet, secret scanning, CI (`ci.yml`), 11 tests RLS con sesiones reales. Gap real: solo 3 dominios
  probados (`organizations`/`tasks`/`alerts`) de una lista mucho mas larga (financiero, conexiones,
  llamadas, RAG, agent runs); sin tests de integridad FK cross-tenant; sin redaccion de logs confirmada;
  sin rate limiting a nivel de endpoint propio.
  Fix de seguridad puntual: interpolaciones de `organizationId` en filtros `.or()` reforzadas con
  validacion de formato UUID.
- **SQO-01**: 54 tests en CI (11 RLS + 28 validador SQL Gateway + 15 guarda de calidad IA). **Correccion
  real**: el documento afirmaba que CI bloquea "lint, tipos, tests y build" — verificado en `ci.yml` que
  **no hay ningun paso de lint**, solo typecheck y build. Los tests RLS corren contra el Supabase remoto
  real en cada PR (funciona, pero es una base de CI mas lenta/costosa/fragil que un Postgres aislado por
  run). Pendiente: unit tests de otros motores, contract tests, tests de worker, Playwright, resto de
  evals IA (ver AI-06).
- **SQO-02**: reclasificado `planned_critical` — no hay libreria de logging estructurado ni error tracking
  en ningun `package.json` del monorepo. Es la carencia de mayor riesgo en proporcion a lo ya construido:
  sin esto, diagnosticar "los pedidos de ayer no aparecen" requiere leer codigo y consultar la DB a mano.
- **SQO-03**: reclasificado `planned_critical`. Hallazgo real concreto: la tabla `public.audit_logs` ya
  existe en el esquema desde DB-02 (columnas correctas: actor, organizacion, accion, entidad, valores
  antes/despues, request_id) pero **ningun endpoint del backend escribe en ella** — es una tabla de
  auditoria vacia, no un vacio de diseño. Conectar las escrituras sensibles ya existentes
  (`updateOrganization`, `decideSummary`, `decideAgentOutput`, borrado de tienda/organizacion) es la
  accion de mayor relacion esfuerzo/impacto de todo este bloque.
- **SQO-04/05/06 (propuestas, no creadas)**: threat model, disaster recovery y runbooks operativos — ver
  `roadmap/roadmaps/06-seguridad-qa-observabilidad/README.md`.

### Operacion/Despliegue (OPS-00 a OPS-02)

Puerto local API fijado en 4000 (web en 3001), `WEB_ORIGIN` configurado para CORS. Supabase remoto
linkeado. Cron de sincronizacion diaria de Shopify a las 2am (`Europe/Madrid`) reemplazando el job de 6h
anterior (2026-07-20).

- **OPS-00**: sin staging (bloqueado por Q-001, proveedor de hosting sin decidir), sin Dockerfiles de
  API/worker, sin politica de migraciones escrita, sin matriz de secrets por entorno.
- **OPS-01 (piloto)**: reclasificado `planned` — el documento anterior exigia Shopify **y** Meta desde el
  arranque, pero Meta esta bloqueado por App Review; dividido en Piloto 1 (Shopify, sin dependencia de
  Meta), Piloto 2 (Meta) y Piloto 3 (Klaviyo). Ninguno de los 10 criterios de entrada al Piloto 1 esta
  marcado todavia — ver `OPS-01-piloto-mvp.md`.
- **OPS-02**: sigue siendo un indice de nombres de runbooks sin contenido real. Priorizado por
  probabilidad x impacto segun `RIESGOS.md`: sync fallido primero.

**Correccion de etiqueta del release**: llamarlo "post-MVP" era prematuro dado lo anterior — corregido a
"Pre-piloto" arriba.
