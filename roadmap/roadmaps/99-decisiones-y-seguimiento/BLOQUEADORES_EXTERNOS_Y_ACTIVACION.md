# Bloqueadores externos y activación

> Checklist canónico para cerrar el piloto. Lo que aparece aquí no se simula ni se marca como
> conectado hasta que exista evidencia del proveedor. La infraestructura local puede continuar
> mientras estos puntos estén en `blocked_external` o `verification_pending`.

## Regla de cierre

Un conector solo pasa a `connected` cuando se cumplen todos estos pasos: credenciales válidas,
redirect URI exacta, scopes realmente concedidos, respuesta real del proveedor, selección de
activo/cuenta, sincronización inicial idempotente, métricas con freshness, reautorización y una
prueba de error recuperable. La UI debe mostrar el estado real en cada paso.

El contrato ejecutable para esta regla es `evaluateIntegrationActivation` en
`packages/integrations/src/index.ts`. Solo acepta evidencia booleana y devuelve `ready` o la lista
de requisitos que faltan; no almacena secretos ni payloads del proveedor. Todo conector nuevo debe
usar este contrato antes de presentarse como conectado.

## Meta Ads

Estado actual: `blocked_external_validation`. Contratos, OAuth, discovery, métricas, paginación,
permisos concedidos y estados de UI están preparados.

- [ ] Crear o confirmar la app Meta de producción y conservar `META_APP_ID`/`META_APP_SECRET` solo en el gestor de secretos.
- [ ] Confirmar exactamente la callback URI configurada en Meta y en EcomScaling.
- [ ] Completar Business Verification y App Review/Advanced Access para los permisos de cada capacidad.
- [ ] Conectar una cuenta publicitaria de prueba real y guardar el `ad_account_id` seleccionado.
- [ ] Ejecutar OAuth y comprobar con `debug_token` que el token es válido, pertenece a la app correcta, no está expirado y contiene los scopes requeridos.
- [ ] Probar discovery, insights y paginación contra una ventana real; comprobar la métrica de compra canónica.
- [ ] Probar revocación/expiración y reautorización sin dejar la conexión en estado falsamente sano.

El callback ya convierte denegaciones OAuth y fallos de intercambio en `error` persistido y la UI
ofrece un mensaje explícito para reintentar; la prueba con una cuenta Meta real sigue pendiente.

Referencias: [Meta Graph API](https://developers.facebook.com/docs/graph-api) y [creación básica de anuncios](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation).

## Klaviyo

Estado actual: `implemented_partial`. OAuth PKCE, scopes normalizados, sync, reporting,
reconciliación, backfill y UI están preparados; falta una cuenta real.

- [ ] Obtener `KLAVIYO_CLIENT_ID`/`KLAVIYO_CLIENT_SECRET` de la app correcta y registrar la callback URI exacta.
- [ ] Solicitar el conjunto mínimo de scopes y verificar el `scope` devuelto por el token.
- [ ] Completar la revisión/publicación de la app si la distribución elegida la requiere.
- [ ] Conectar una cuenta real y seleccionar el perfil/lista/activo válido.
- [ ] Ejecutar sync inicial, incremental, Reporting API, backfill y reconciliación; comprobar freshness, cursores y duplicados.
- [ ] Verificar revocación, expiración y ausencia de scopes como estados de reautorización.

Las denegaciones y scopes insuficientes no dejan la conexión en `pending`/`connected` de forma
ambigua: se registra el error y se muestra el resultado en Integraciones.

Referencias: [Klaviyo OAuth](https://developers.klaviyo.com/en/v2026-01-15/docs/set_up_oauth) y [versionado de la API](https://developers.klaviyo.com/en/docs/api_versioning_and_deprecation_policy).

## Instagram

Estado actual: `implemented_partial` / `prepared_dependency`. Foundation DB/RLS, catálogo,
contrato y matriz de estrategias están preparados; el adaptador permanece deliberadamente no
disponible hasta elegir estrategia y validar una cuenta profesional.

- [ ] Elegir `facebook_login` si la cuenta profesional está vinculada a una Página; elegir `instagram_login` si procede el flujo directo de Instagram.
- [ ] Confirmar que la cuenta es Business o Creator; las cuentas personales no entran en el flujo preparado.
- [ ] Configurar app, callback URI, scopes mínimos y App Review/Advanced Access necesarios.
- [ ] Probar una cuenta profesional real: identidad, medios, insights y, solo si procede, comentarios, mensajes o publicación.
- [ ] No presentar Ads, etiquetado ni capacidades no soportadas por la estrategia elegida.
- [ ] Validar expiración, revocación, paginación y estados de cuenta no elegible.

Referencias: [Instagram API con Facebook Login](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) y [Instagram API con Instagram Login](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-ab559ffb-8e2c-4b0a-b43a-5737b6d2f672).

## Shopify

Estado actual: `pilot_ready`, con validación externa operativa aún necesaria para el cierre de producción.

- [ ] Confirmar app/distribución, scopes y callback URI del entorno productivo.
- [ ] Ejecutar OAuth con una tienda real y verificar selección de tienda/organización.
- [ ] Completar sync inicial, incremental, webhooks de privacidad, `app/uninstalled` y reconciliación.
- [ ] Registrar evidencia de freshness, diferencias explicadas, reintentos e idempotencia.

## Supabase, backup y restore

Estado actual: `verification_pending`. Las migraciones y gates locales/remotos están alineados;
falta un simulacro de restauración aislado.

- [ ] Configurar backup diario y conservar evidencia de una ejecución correcta.
- [ ] Disponer de un proyecto Supabase desechable o entorno aislado para restaurar; nunca restaurar sobre producción durante el drill.
- [ ] Ejecutar RB-007 y medir RPO <= 24 h / RTO <= 4 h.
- [ ] Verificar migraciones, RLS, grants, conteos y aislamiento tenant después de restaurar.
- [ ] Registrar resultado e incidencias. Mientras no exista entorno aislado no se debe afirmar que el restore está probado.

## Evidencia mínima

Para cada conector: fecha, entorno, cuenta/activo enmascarado, scopes concedidos, capacidad
probada, resultado, freshness, error/reautorización probada y referencia al audit log. Nunca
guardar tokens, secretos, PII innecesaria ni respuestas completas del proveedor en Markdown.

## Qué sigue siendo implementable sin credenciales

Contratos normalizados, schemas, agentes, RAG, evaluaciones con fixtures demo/shadow, UI de estados,
permisos, observabilidad, paginación, idempotencia, reautorización, pruebas unitarias y runbooks.
No se puede fabricar una conexión, métrica o validación de proveedor para cerrar estos bloqueadores.
