# INT-08 - Matriz de validación externa de conectores

## Propósito

Convertir la llegada de credenciales y aprobaciones en una ejecución repetible.
Esta matriz no inventa datos ni marca un conector como operativo por tener un
flag: cada fila exige evidencia del proveedor, del sync y de la UI.

## Regla común de promoción

Un conector sólo pasa a `operational` cuando se cumplen todas las pruebas de su
fila y `provider.activation.ready` es verdadero. La secuencia obligatoria es:

1. configurar secretos en el entorno aislado de validación;
2. completar OAuth/instalación y comprobar scopes efectivos;
3. validar identidad y selección de cuenta/tienda;
4. ejecutar sync inicial y repetirlo de forma incremental;
5. provocar o esperar un error recuperable y demostrar recuperación;
6. comprobar freshness, deduplicación, tenant, UI, agentes y observabilidad;
7. promover sólo con evidencia redactada, `traceId`/`job_id` y rollback claro.

Nunca se copian secretos ni payloads completos a commits, tests, logs o
LangSmith. Las pruebas destructivas se ejecutan sólo en una cuenta/tienda de
validación autorizada.

## Matriz por proveedor

| Proveedor | Precondiciones externas | Pruebas obligatorias | Evidencia de salida | Criterio de fallo |
| --- | --- | --- | --- | --- |
| Shopify | App/custom distribution autorizada, tienda de prueba, scopes y webhook URL | OAuth/HMAC, instalación, scopes, sync inicial, incremental, webhooks duplicados, uninstall/reconnect, 429/5xx y reconciliación | connection id, scopes, sync runs, counts/reconcile, webhook fingerprints, resultado UI | secreto expuesto, webhook no idempotente, tenant incorrecto, freshness fuera de SLA o diferencia sin explicación |
| Meta Ads | App Review/business verification, `META_APP_ID/SECRET`, scopes aprobados, usuario y ad account de prueba | OAuth, identidad verificable, selección de cuenta, insights inicial/incremental, paginación/batch, 429/5xx, reautorización y permisos insuficientes | account id enmascarado, scopes efectivos, filas/periodos, sync runs, errores normalizados y trazas | datos fabricados, cuenta no verificable, scope no concedido, conversiones duplicadas, circuito ausente o UI con salud falsa |
| Klaviyo | App OAuth aprobada, cuenta de prueba, scopes y versión API fijados | OAuth/refresh, scopes, paginación segura, Reporting API por tipo, `Retry-After`, 403/token caducado y backfill | account id enmascarado, revision, páginas, reportes, retries, freshness y estado UI | links fuera de host, retry de permisos, periodos mezclados, `unavailable` oculto o token persistido |
| Instagram | App Meta aprobada, cuenta profesional, Página vinculada o Instagram Login según estrategia, scopes efectivos | descubrimiento, media/insights, permisos, paginación, límites, cuenta sin media y dependencia Meta | estrategia, identidad enmascarada, métricas/periodos, errores y activación | cuenta no profesional, datos orgánicos mezclados con Ads, dependencia Meta ignorada o datos demo presentados como reales |

## Checklist operativo

- [ ] Entorno de validación aislado y snapshot/rollback disponible.
- [ ] Scopes solicitados y concedidos registrados por separado.
- [ ] Conexión asociada al `organization_id` correcto; sin lectura cross-tenant.
- [ ] Primer sync idempotente y segundo sync sin duplicados.
- [ ] Periodos y zonas horarias documentados; precisión de totales conocida.
- [ ] Rate limit/error transitorio probado con retry/backoff.
- [ ] Timeout y circuito abierto probados sin espera indefinida.
- [ ] `partial` seguido de `succeeded` demuestra recuperación; un error aislado no.
- [ ] Agentes reciben `available`, `unavailable` o `stale` y se abstienen si falta evidencia.
- [ ] UI distingue `configured`, `connected`, `degraded`, `stale`, `denied` y `not_implemented`.
- [ ] Sólo se conservan ids enmascarados, estados, tiempos, agregados y trazas redactadas.

## Evidencia local ya disponible

- Meta, Klaviyo y Shopify: suite contractual offline 15/15 verificada el
  2026-08-26.
- Activación por capacidades y recuperación: `INT-07-CAPABILITY-AWARE-ACTIVATION-GATE.md`.
- Estados de salud: `INT-06-STATUS-HEALTH-UI-CONTRACT.md`.
- Preparación general: `CONTRATO_PREPARACION_CONECTORES.md`.
- Resiliencia común: módulo de resiliencia de `packages/ai`.

## Qué queda fuera hasta que existan proveedores

No se puede demostrar desde este repositorio la aprobación de Meta/Shopify, la
concesión real de scopes, la estabilidad de una cuenta externa o la exactitud
de sus datos. Esos estados permanecen `blocked_external` y no impiden terminar
la interfaz, contratos, agentes, evals ni controles locales.

## Cobertura de campos frente a las APIs oficiales (auditorÃ­a 2026-08-26)

La cobertura es completa para el alcance de negocio del MVP, pero no literal
para todos los campos que ofrecen las APIs. Importante: Meta y Klaviyo conservan
el payload recibido en `raw_data`; Shopify no guarda el payload Ã­ntegro por
decisiÃ³n de privacidad y minimizaciÃ³n de PII. Sus campos no normalizados quedan
como extensiÃ³n futura mediante una decisiÃ³n explÃ­cita de retenciÃ³n.
para todos los campos que ofrecen las APIs. Las tablas normalizadas conservan
ademÃ¡s el payload del proveedor en `raw_data` cuando un campo no necesita una
columna propia; ese dato no queda todavÃ­a tipado ni indexado para analÃ­tica.

| Proveedor | Campos/capacidades cubiertos y normalizados | Fuera del MVP o conservados en `raw_data` | Estado sin credenciales |
| --- | --- | --- | --- |
| Shopify | Tienda, dominio, moneda, zona horaria, plan, impuestos; productos, variantes, SKU, barcode, precios, estado y proveedor; inventario, ubicaciones y cantidades; pedidos, lÃ­neas, descuentos agregados, impuestos, envÃ­o, pagos agregados, fulfillment; clientes minimizados; refunds y costes de producto | Metafields, media/colecciones, opciones avanzadas, direcciones/PII detalladas, transacciones y fulfillments completos, attribution y extensiones Shopify | Esquema preparado y slice operativo; falta validar cada campo contra una tienda real y sus scopes |
| Meta Ads | Business Accounts, Pages, ad accounts, campaÃ±as, ad sets, ads, creatives/assets; estados, objetivos, presupuestos, pujas, targeting, CTA, copy, enlaces; Insights diarios, niveles, breakdowns, impresiones, alcance, frecuencia, clics, CTR, CPC, CPM, CPP, gasto y acciones/conversiones; report runs y mÃ©tricas calculadas | Pixels, custom conversions, audiences, catÃ¡logos, commerce assets, placements especÃ­ficos y campos nuevos no usados por el MVP; payload original en `raw_data` | Preparado localmente; faltan App Review, permisos efectivos y cuenta real |
| Klaviyo | Cuenta, moneda, zona horaria, listas, segmentos, conteos, flows, acciones/mensajes, campaigns, audiencias, forms, metrics y mÃ©trica de conversiÃ³n; Reporting API por campaÃ±a/flow, periodo, revenue, conversions, moneda y estado idempotente | Perfiles individuales, eventos crudos, catÃ¡logo, templates completos, webhooks y definiciones/contenido avanzados; respuestas conservadas en `raw_data` | Implementado parcialmente y preparado; falta cuenta real para scopes, revision, backfill y reconciliaciÃ³n |

### ConclusiÃ³n operativa

La comprobaciÃ³n reproducible `node scripts/assert-connector-field-coverage.mjs`
verifica que existen 27 tablas y 135 campos MVP en los tipos generados desde
Supabase. La inspecciÃ³n de los adaptadores confirma los mapeos principales en
`apps/api/src/shopify-sync.ts`, `apps/api/src/meta-sync.ts` y
`apps/api/src/klaviyo-sync.ts`; esta evidencia es estÃ¡tica y no sustituye una
ejecuciÃ³n con payloads reales, scopes efectivos y cambios de versiÃ³n de cada API.

- No falta ninguna tabla estructural para el MVP definido en DB-05, DB-06 y DB-09.
- SÃ­ existen campos oficiales sin columna dedicada porque estÃ¡n fuera del MVP,
  contienen PII sensible, cambian con frecuencia o solo sirven como evidencia.
- Shopify limita por defecto el histÃ³rico de pedidos salvo scopes protegidos; es
  una limitaciÃ³n temporal/de permisos, no una falta de columnas.
- Klaviyo separa metadatos de campaÃ±as de rendimiento; el esquema separa
  `klaviyo_campaigns` de `klaviyo_report_values`, tal como exige su Reporting API.
- Meta conserva nivel, breakdown, ventana de atribuciÃ³n y payload para no mezclar
  cifras de Ads Manager antes de validar permisos y respuestas reales.

CorrecciÃ³n de retenciÃ³n: Shopify no conserva `raw_data` Ã­ntegro por diseÃ±o de
privacidad; la frase histÃ³rica que lo generaliza a todos los proveedores queda
supeditada a esta excepciÃ³n. Meta y Klaviyo sÃ­ conservan el payload recibido.
CorrecciÃ³n de retenciÃ³n: Shopify no conserva `raw_data` Ã­ntegro por diseÃ±o de
privacidad; la frase histÃ³rica que lo generaliza a todos los proveedores queda
supeditada a esta excepciÃ³n. Meta y Klaviyo sÃ­ conservan el payload recibido.

Actualizacion de mapeos 2026-08-26: el sync de Shopify solicita y escribe
`InventoryItem.unitCost` en `shopify_inventory_items.current_unit_cost` y
`cost_currency_code`; Shopify puede omitirlo si falta el permiso View product costs.
El sync de Meta solicita dimensiones de Insights, persiste breakdowns y hashes,
`action_report_time` y ventanas `1d_click`, `7d_click` y `1d_view`; las acciones
se guardan con `attribution_window` para no mezclar atribuciones.

Referencias oficiales: [Shopify Order API](https://shopify.dev/docs/api/admin-graphql/latest/queries/order),
[Shopify HasMetafields](https://shopify.dev/docs/api/admin-graphql/latest/interfaces/HasMetafields),
[Meta Graph API](https://developers.facebook.com/docs/graph-api),
[Klaviyo Campaigns API](https://developers.klaviyo.com/en/reference/campaigns_api_overview),
[Klaviyo Metrics API](https://developers.klaviyo.com/en/reference/metrics_api_overview),
[Klaviyo Events API](https://developers.klaviyo.com/en/reference/events_api_overview).
