# INT-02 - Meta Ads

## Estado

- **Estado real:** `blocked`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** INT-00, DB-06, BE-04
- **Bloqueador:** Meta App Review / business verification. Sin una app real revisada por Meta no se puede
  validar el flujo completo contra activos reales (ver matriz de endpoints ya verificada en
  `roadmap/roadmaps/02-backend-api/fases/BE-04-meta-adquisicion.md` — no se duplica aqui).
- **Evidencia:** `apps/api/src/meta-oauth.ts`, `meta.ts`, `meta-sync.ts`, `meta-metrics.ts`,
  `meta-client.ts`.

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

## Gaps reales frente a la API de Meta

- No hay evidencia en `meta-sync.ts` de peticiones asincronas de Insights (`report_run_id`,
  `async_percent_completion`) — el fetch es sincrono. Para cuentas con volumen o breakdowns complejos,
  Meta recomienda el modo asincrono; esto no esta implementado.
- No se ha confirmado en codigo el manejo de `action_report_time` como parametro elegido explicitamente
  (aparece como columna de conflicto en el upsert, no como decision documentada de que ventana de
  atribucion se usa por defecto).
- No hay `canonical_purchase_action_type` documentado por cuenta — sin el, "compras" puede significar
  `purchase`, `omni_purchase` u `offsite_conversion.fb_pixel_purchase` segun la cuenta, y la UI no declara
  cual se usa.
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

## Pendiente antes de cerrar INT-02

1. Decidir y documentar `canonical_purchase_action_type` por cuenta (o una prioridad fija) antes de
   mostrar ROAS/CAC como numero unico en UI.
2. Decidir si Insights async es necesario para el volumen real esperado, o si el modo sincrono actual es
   suficiente para el MVP.
3. Si INT-05 (Instagram) depende de esta conexion, ampliar `META_SCOPES` con
   `instagram_basic`/`instagram_manage_insights` aqui, no en INT-05.
4. ~~Cubrir el retry de paginacion opaca~~ — hecho 2026-07-22.
5. El resto (validacion de app real, activos reales, insights reconciliados contra Ads Manager) depende
   integramente de que Meta apruebe la app — ver bloqueador.
