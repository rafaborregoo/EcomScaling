# INT-02 - Meta Ads

Preparacion server-to-server 2026-08-26: `metaGraphGet` y `metaGraphGetAll` aceptan el secreto
de la app para generar `appsecret_proof`, tambien al seguir URLs opacas de paginacion. Las rutas
de descubrimiento, estructura e Insights lo pasan desde `LoadedApiEnv`; el intercambio OAuth no
se mezcla con este mecanismo. La cobertura criptografica directa pasa 3/3.
La cobertura vigente incluye tambien `paging.next` y pasa 4/4.

La versiÃ³n Graph se puede configurar con `META_GRAPH_VERSION` validada como `vN.N`; si no se
declara, el cliente mantiene `v23.0`. La documentaciÃ³n oficial no se ha usado para inventar una
versiÃ³n nueva porque el endpoint devolviÃ³ 429 durante esta auditorÃ­a.

> **Recuperación y observabilidad del sync 2026-08-26:** el sync manual recupera conexiones `syncing`
> stale tras diez minutos, valida la transición a `error` y relanza con el estado efectivo. Los
> fallos posteriores persisten el error y no dejan la conexión bloqueada en `syncing`; los logs no
> incluyen tokens ni payloads sensibles.

> **Reconciliación concurrente 2026-08-26:** el job incremental reclama cada conexión `connected`
> mediante una transición condicional antes de ejecutar el sync. Si una ejecución manual ya la
> reclamó, el job queda como `skipped` en vez de duplicar Insights o estructura.

> **Resiliencia Graph 2026-08-24:** `meta-client.ts` aplica timeout abortable de 15 s y hasta 5
> retries para red, 408/425, 429, códigos de rate limit y 5xx, con backoff exponencial acotado a
> 60 s y respeto de `Retry-After`. Los errores permanentes fallan rápido y `paging.next` reutiliza
> el mismo cliente; no se crean rutas fetch paralelas sin estos límites.

> **Permisos concedidos 2026-08-24:** el callback inspecciona el token con `debug_token`, verifica que pertenece a la app configurada y compara los scopes concedidos con `META_SCOPES`. Si faltan permisos, no guarda el token ni marca la conexión como conectada; devuelve `meta_permissions_missing` con los scopes pendientes.

> **Preparación de activación 2026-08-24:** la API expone `configuration.status` para separar credenciales ausentes, feature flag apagado y app configurada; la UI no permite iniciar OAuth hasta que el estado sea `configured`.

> **Correccion 2026-08-03: sincronizacion incremental y reconciliacion periodica.** Hasta ahora el
> conector solo tenia `runMetaInitialSync`: una vez conectado un cliente, los datos se congelaban salvo
> que alguien lanzase un sync manual. Queda parametrizado como `runMetaSync(env, connectionId, mode)`
> (ADR-0006 punto 3, mismo codigo para import completo e incremental) con ventana de insights de 90 dias
> en `initial` y 28 en `incremental` — 28 porque Meta reatribuye conversiones dias despues del clic
> (guia Meta 7.3). `reconcileAllMetaConnections` recorre las conexiones `connected` y el workflow
> `meta-reconcile.yml` lo ejecuta a diario (ADR-0006 punto 4 y guia Meta 10: los webhooks de Meta no
> sustituyen la reextraccion de Insights). El adaptador ya propaga el modo en vez de ignorarlo.
> Sigue sin validarse contra una cuenta real: el bloqueador externo no cambia.
>
> **Correccion 2026-08-03: `canonical_purchase_action_type` (cerrado).** Era el pendiente documentado de
> esta fase y escondia un error de calculo real, no solo una decision sin escribir: `meta_spend_summary`
> sumaba a la vez `purchase`, `omni_purchase` y `offsite_conversion.fb_pixel_purchase`. Meta reporta la
> misma conversion bajo varios `action_type` simultaneamente, asi que una cuenta con pixel + CAPI habria
> mostrado compras y ROAS inflados 2-3x — con el sync funcionando "correctamente" todo el tiempo.
>
> La migracion `20260803120000_int_02_canonical_purchase_action_type.sql` anade el `action_type` canonico
> por cuenta publicitaria (default `omni_purchase`, la columna "Compras" de Ads Manager para ecommerce) con
> quien y cuando lo decidio, y `meta_spend_summary` suma un unico tipo y devuelve `purchase_action_types`
> como procedencia. `GET/PUT /v1/organizations/:organizationId/meta/purchase-action-types` listan los
> `action_type` realmente observados en los insights de cada cuenta (los de compra primero) y permiten
> elegir el canonico con registro en `audit_logs`; `is_default: true` distingue "nadie lo ha decidido" de
> una eleccion humana. Sin insights, la lista sale vacia: no se inventa un catalogo.
>
> **Migracion aplicada 2026-08-03** con `supabase db push --linked`. `migration list --linked` deja
> `20260803120000` con `local == remote` (64 migraciones alineadas), las tres columnas nuevas de
> `meta_ad_accounts` existen y `meta_spend_summary` responde sin error. No se modifico ningun dato de
> negocio: la unica organizacion existente no tiene insights de Meta, asi que la funcion devuelve cero
> filas — comportamiento correcto, no un fallo.

## Estado

> Verificacion vigente 2026-08-24: el contrato de ventana de atribucion
> `META_ACTION_REPORT_TIME` esta definido en `packages/config`, validado por
> `meta-sync-contract.test.ts` y el typecheck del API pasa tras reconstruir el
> paquete de configuracion. Meta sigue correctamente bloqueado solo por
> App Review/business verification y ausencia de credenciales reales.

- **Estado real:** `blocked`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** INT-00, DB-06, BE-04
- **Bloqueador:** Meta App Review / business verification. Sin una app real revisada por Meta no se puede
  validar el flujo completo contra activos reales (ver matriz de endpoints ya verificada en
  `roadmap/roadmaps/02-backend-api/fases/BE-04-meta-adquisicion.md` — no se duplica aqui).
- **Evidencia:** `apps/api/src/meta-oauth.ts`, `meta.ts`, `meta-sync.ts`, `meta-metrics.ts`,
  `meta-client.ts`.

## Contrato de preparación para activación futura

INT-02 se evalúa contra el [objetivo global del SaaS](../../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md).
Mientras no existan credenciales y permisos aprobados, el estado correcto es preparado/bloqueado para
validación externa; no se crean cuentas, campañas ni métricas ficticias.

La implementación futura debe conservar estas decisiones de contrato:

- soportar varias cuentas publicitarias, negocios y rutas de acceso (OAuth de usuario y Business
  Manager/System User), diferenciando el origen del acceso;
- normalizar los identificadores externos sin perder el formato requerido por Meta (`act_<id>` para
  cuentas publicitarias) y conservar los cursores/URLs opacos de `paging.next`;
- modelar explícitamente permisos, expiración/reautorización, estado de conexión, cuenta seleccionada,
  freshness, ventana de atribución y nivel de insight;
- mantener una superficie de selección de activos reutilizable por otros conectores, con empty/loading/error
  y “aún no disponible” honestos;
- activar capacidades de escritura por separado de lectura y exigir autorización y aprobación humana antes
  de cualquier creación o modificación;
- poder encender el conector mediante feature flag y credenciales reales sin cambiar las pantallas de
  dashboard, tareas, alertas, agentes o métricas.

La referencia técnica externa para el diseño de autenticación, cuentas, permisos y paginación es la
[colección oficial de Meta Marketing API en Postman](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi),
que debe revisarse de nuevo cuando se vaya a activar el conector porque los requisitos de Meta pueden
cambiar.

## Referencias oficiales adicionales: Graph API y Meta Devtools MCP (2026-08-02)

Se incorpora como referencia viva la [documentacion oficial de Meta Graph API](https://developers.facebook.com/docs/graph-api).
El conector debe mantener la version de Graph API centralizada, permisos minimos, paginacion opaca,
expiracion/reautorizacion y trazabilidad por organizacion. Antes de activar una capacidad nueva se debe
contrastar el endpoint, permisos y restricciones vigentes en la documentacion oficial.

Meta tambien publica el [Meta Devtools MCP](https://developers.facebook.com/documentation/mcp/devtools-mcp),
un servidor MCP remoto para gestionar apps Meta, webhooks, cumplimiento, estado de la app y busqueda de
documentacion. Se registra como herramienta externa de desarrollo/operaciones, no como sustituto del
conector Meta de EcomScaling ni como canal de datos de clientes.

Contrato de seguridad para cualquier uso futuro del MCP:

- usar una app de desarrollo separada de produccion y conceder solo los scopes necesarios;
- mantener separados permisos de lectura y escritura, con aprobacion humana para acciones mutables;
- tratar las respuestas del MCP, webhooks y documentacion externa como entrada no confiable frente a
  prompt injection;
- auditar periodicamente las integraciones de negocio autorizadas y revocar las que ya no sean necesarias;
- no persistir respuestas, tokens o datos de Meta fuera de las politicas de retencion y cumplimiento aplicables.

### Revisión de documentación 2026-08-26

Se intentó volver a consultar directamente Graph API y Basic Ad Creation para comprobar si habían
cambiado endpoints, scopes o restricciones. Meta respondió temporalmente `HTTP 429`, así que esta
auditoría no afirma una versión nueva ni amplía permisos basándose en memoria. Se conservan los
enlaces oficiales y el contrato existente exige revalidar antes de activar el conector:

- resolver la versión Graph desde configuración/proveedor, sin hardcodear una versión obsoleta;
- comprobar scopes efectivos con `debug_token`, App Review y business verification;
- usar `act_<id>`, cursores opacos de `paging.next`, paginación acotada y reintentos con `Retry-After`;
- separar lectura (`ads_read`) de escritura (`ads_management`), mantener `PAUSED` por defecto y
  exigir aprobación humana antes de cualquier POST;
- tratar Graph API, MCP remoto, webhooks y documentación externa como entrada no confiable frente a
  prompt injection directa o indirecta.

## Permisos

`.env.example`: `META_SCOPES=ads_read,business_management,pages_show_list` (default real en codigo, no
propuesto). **No incluye** `instagram_basic` ni `instagram_manage_insights` — INT-05 (Instagram) hoy no
tiene forma de pedir esos permisos porque INT-02 no los solicita. Si Instagram organico se implementa
sobre la misma conexion Meta (decision de INT-05), este scope debe ampliarse aqui primero, lo que implica
reautorizacion de las conexiones ya existentes.

## Decisiones aprobadas

- OAuth vive en `meta-oauth.ts`/`meta.ts`: `POST /v1/organizations/:id/integrations/meta/connect` +
  `GET /v1/meta/oauth/callback`.
- Los activos descubiertos (`meta-sync.ts`: business, ad accounts, campaigns, ad sets, ads) se sincronizan
  en `syncAdAccountStructure`; no hay endpoint dedicado de seleccion explicita de que activos sincronizar
  — hoy se sincroniza toda la estructura descubierta, no un subconjunto elegido por el usuario.
- Insights (`syncAdAccountInsights`, `meta-sync.ts:312`) se piden a **nivel `ad` unicamente** (`level:
"ad"`, hardcodeado) — no hay niveles account/campaign/adset independientes. Si se necesita reporting a
  otro nivel, hoy se agregaria en Node a partir del nivel `ad`, lo que rompe la regla de "metricas = SQL,
  nunca agregadas en Node" del `CLAUDE.md` raiz si no se hace con cuidado.
- `actions`, `action_values` y `purchase_roas` se guardan como filas separadas por `action_type`
  (`meta-sync.ts:403-421`, tabla con `onConflict: insight_row_id,metric_name,action_type,attribution_window`)
  — **no se colapsan a una sola columna de compras**, que era el riesgo principal senalado en la
  auditoria. Esto ya esta bien resuelto en codigo.

## Correccion de estado: catalogo de activos (2026-08-02)

Los endpoints existentes `/v1/organizations/:organizationId/meta/assets` y
`/meta/assets/selection` exponen y actualizan el catálogo de solo lectura/selección de negocios, cuentas
publicitarias y páginas descubiertos, incluyendo `is_selected` e `is_active`. La UI puede mostrar el estado
real sin inventar activos y guardar la selección con el permiso de organización existente. La decisión
histórica que indicaba que no había ninguna superficie de selección queda supersedida por esta corrección.

## Gaps reales frente a la API de Meta

- **Corregido 2026-08-20:** `meta-sync.ts` ya incluye el contrato y runner de Insights asíncronos
  (`report_run_id`, `async_status`, `async_percent_completion`, polling acotado y timeout). Se activa
  únicamente con `META_INSIGHTS_MODE=async`; el default sigue siendo `sync` para no cambiar el piloto
  actual ni ejecutar llamadas nuevas sin credenciales reales.
- **Corregido 2026-08-24:** `META_ACTION_REPORT_TIME` permite parametrizar explícitamente `impression`,
  `conversion` o `mixed` y se propaga a las consultas sync/async de Insights. Sigue siendo opcional y no
  cambia el piloto hasta validar contra Ads Manager; sin valor configurado Meta conserva su comportamiento
  por defecto. La elección debe confirmarse con una cuenta real antes de fijarla en producción.
- `canonical_purchase_action_type` ya está documentado y persistido por cuenta; el valor por defecto es
  `omni_purchase` y la selección humana queda auditada. Sin insights observados, la lista permanece vacía
  y no inventa opciones.
- **Verificado y corregido 2026-07-22** (antes "pendiente de confirmar, no asumir"): `meta-client.ts` si
  implementa backoff real -- HTTP 429 y codigos de error de rate limit de la Graph API
  (`4, 17, 32, 613, 80000, 80004`, incluye el 613 de Marketing API y el 80004 de Ads Insights) con backoff
  exponencial (`BASE_BACKOFF_MS * 2^intento`). El unico hueco real -- las URLs opacas de paginacion
  (`paging.next`) no reintentaban -- ya esta cerrado: `fetchGraphJsonWithRetry` es ahora el backoff
  compartido entre la primera peticion y el seguimiento de paginacion.

## Decision: acceso multi-cliente vía Business Manager (2026-07-22)

EcomScaling es consultor-first: el consultor no es dueño de las cuentas publicitarias que analiza, son de
sus clientes. El flujo de OAuth actual (`POST /v1/organizations/:id/integrations/meta/connect`) asume
implicitamente que quien autoriza es dueño directo de los activos — eso solo cubre el caso de un cliente
que conecta su propia cuenta. Para el caso real de agencia (un consultor gestionando N cuentas de N
clientes distintos) existe un mecanismo estandar de Meta que todavia no esta contemplado aqui:

- Las cuentas publicitarias pertenecen al **Business Manager de cada cliente**, no al de EcomScaling.
- El cliente comparte acceso a su cuenta publicitaria con el Business Manager de EcomScaling (o con un
  **System User** de la app), desde `Configuracion del negocio -> Cuentas publicitarias ->
Agregar/Solicitar acceso` (o via `Socios`), del lado del cliente.
- Una vez compartido, la Graph API expone esa cuenta como un ad account accesible para el System User /
  Business Manager de EcomScaling, sin que el cliente tenga que crear su propia app ni pasar por el OAuth
  "connect" actual.

**Implicacion para `discoverAssets`/`syncAdAccountStructure`:** hoy se asume un unico flujo de
descubrimiento tras OAuth de un usuario. Con acceso via Business Manager, el descubrimiento de activos
debe tambien listar cuentas publicitarias **compartidas con el Business Manager/System User de
EcomScaling**, no solo las accesibles por el token del usuario que hizo el OAuth inicial — son dos rutas de
acceso distintas a la misma Graph API y deben quedar diferenciadas en el modelo de datos (de forma similar
a como BE-01 distingue `accessSource` para el acceso de consultor vs. membership real).

**Pendiente de decidir antes de implementar la ruta de agencia** (no bloquea el OAuth individual ya
existente):

- Si `integration_connections` necesita un campo que distinga `oauth_direct` vs.
  `business_manager_shared` como origen del acceso a una cuenta publicitaria.
- Si se usa un **System User token** de larga duracion (recomendado por Meta para apps de agencia, no
  expira como un token de usuario) en vez de/ademas del token de usuario actual.
- Como el frontend comunica al cliente que debe compartir acceso desde su propio Business Manager, con
  instrucciones concretas (no asumir que el cliente sabe navegar Configuracion del negocio de Meta).
- Si una misma cuenta publicitaria puede aparecer accesible por dos rutas a la vez (OAuth directo +
  compartida via BM) y como se evita duplicar la conexion en ese caso.

## Nota: creacion de campanas (fuera de alcance de INT-02 hoy, 2026-07-28)

Rafa compartio el sample oficial de Meta (`facebook-nodejs-business-sdk`, `AdAccount.createCampaign`) para
crear campanas via Marketing API -- **no lo copiamos tal cual**: el sample hardcodea el access token en el
archivo (compartido en el chat, ya revocado) y usa el SDK oficial de Node, que este repo no usa en ningun
otro punto de la integracion Meta (`meta-client.ts` hace fetch directo a la Graph API con backoff propio,
ver arriba). Si se implementa creacion de campanas mas adelante, seguir el mismo patron que el resto de
INT-02, no el SDK:

- Token: el ya obtenido via OAuth (`meta-oauth.ts`), nunca hardcodeado, nunca en un archivo suelto fuera de
  `integration_credentials` (cifrado, ver DB-04).
- Llamada: `POST https://graph.facebook.com/<version>/act_<ad_account_id>/campaigns` con
  `fetchGraphJsonWithRetry` (mismo backoff/rate-limit ya implementado en `meta-client.ts`), no una llamada
  fetch nueva sin retry.
- Esto es una capacidad de **escritura** sobre la cuenta publicitaria del cliente (crear campana,
  aunque sea en `status: PAUSED`) -- requiere su propia decision de aprobacion humana antes de escribir
  (mismo criterio que el resto del producto: IA/automatismos no escriben directo, un humano aprueba), y
  todavia no tiene endpoint ni UI. No iniciar sin decidir antes el flujo de aprobacion y sin que la app
  tenga ya los permisos de escritura (`ads_management`) aprobados por Meta App Review -- hoy `META_SCOPES`
  solo pide permisos de lectura (`ads_read,business_management,pages_show_list`).

## Preparación de producto 2026-08-02

INT-02 está **preparada para activación**, aunque no validada externamente. La UI y
el dominio deben permitir mostrar OAuth, permisos, identidad verificada, cuentas
publicitarias descubiertas, selección explícita, sync, freshness, errores y
reautorización sin fabricar activos ni métricas. El contrato común está en
[`../CONTRATO_PREPARACION_CONECTORES.md`](../CONTRATO_PREPARACION_CONECTORES.md).

Al activar Meta se debe conservar el origen del acceso (OAuth directo frente a
Business Manager/System User), soportar varias cuentas por organización y tratar por
separado tokens de usuario y de System User. La selección de activos es obligatoria
antes de importar datos; la futura implementación de Insights asíncronos debe poder
sustituir al modo síncrono sin cambiar las pantallas consumidoras.

## Referencia oficial para creación básica de anuncios (2026-08-02)

La referencia canónica para preparar la futura superficie de escritura es la
[documentación oficial de Meta: Basic Ad Creation](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation).
El flujo debe conservar la jerarquía de Meta y no mezclarla con el modelo de reporting:

`campaign` → `ad set` → `ad creative` → `ad`

La preparación técnica queda definida así:

- cada recurso tendrá un contrato tipado, validación de campos, `external_id`, estado y vínculo con la cuenta publicitaria seleccionada;
- la creación se ejecutará en orden y será idempotente, guardando los IDs de cada nivel para poder reintentar sin duplicar;
- las propuestas se crearán inicialmente en `PAUSED`, con previsualización y aprobación humana antes de cualquier llamada de escritura;
- el cliente reutilizará el mismo `meta-client.ts`, retry, app-secret proof, auditoría y aislamiento tenant-scoped que usa la lectura;
- `ads_management` se tratará como permiso futuro separado de `ads_read`, pendiente de App Review y de validación con una cuenta real.

No se implementa todavía ningún `POST` de creación ni se muestran campañas de prueba. La UI debe poder mostrar la capacidad como “preparada, requiere conexión y aprobación” hasta que existan credenciales, permisos efectivos y validación externa.

## Pendiente antes de cerrar INT-02

### Verificación documental Meta 2026-08-02

La implementación mantiene una única versión Graph (`META_GRAPH_VERSION`) para OAuth y
las peticiones del cliente. La activación sigue condicionada a App Review, permisos
concedidos y una cuenta real. Como referencia operativa se revisaron la colección oficial
de Meta Marketing API y la documentación de Insights; los permisos efectivos deben
confirmarse con el caso de uso y el estado de la app, no copiarse como credenciales o
datos de prueba.

- [Meta Marketing API (colección oficial)](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi)
- [Marketing API Insights](https://developers.facebook.com/docs/marketing-api/insights/)

1. Validar la acción canónica y ROAS/CAC contra Ads Manager con una cuenta real; la decisión local ya
   está implementada y documentada.
2. Decidir si Insights async es necesario para el volumen real esperado, o si el modo sincrono actual es
   suficiente para el MVP.

## Correccion de estado 2026-08-01

El vertical slice y el `IntegrationAdapter` de Meta Ads estan implementados para el modo preparado/piloto:
OAuth, discovery, sync y health se ejecutan solo con credenciales reales configuradas. La interfaz no
fabrica cuentas ni metricas. Si Meta no devuelve un ID de identidad verificable durante OAuth, la conexion
no pasa a `connected`; la fila pendiente usa un identificador tecnico `pending:<state>`. La validacion
productiva sigue bloqueada hasta disponer de App Review, credenciales y una cuenta Meta real. 3. Si INT-05 (Instagram) depende de esta conexion, ampliar `META_SCOPES` con
`instagram_basic`/`instagram_manage_insights` aqui, no en INT-05. 4. ~~Cubrir el retry de paginacion opaca~~ — hecho 2026-07-22. 5. El resto (validacion de app real, activos reales, insights reconciliados contra Ads Manager) depende
integramente de que Meta apruebe la app — ver bloqueador.
