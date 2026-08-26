# RB-009 - Alta de un cliente nuevo y activación de conectores

> Creado 2026-08-03. Procedimiento **proactivo** (no reactivo como el resto de runbooks): qué se ejecuta,
> en qué orden y qué se comprueba cuando entra un cliente real. Complementa
> [`CONTRATO_PREPARACION_CONECTORES.md`](../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md), que
> define el contrato; esto es la secuencia operativa.

## Precondiciones de plataforma (una vez, no por cliente)

| Proveedor | Secretos requeridos                                                          | Gate externo                                       |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Shopify   | `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` (o custom, ver ADR-0011)              | ninguno — operativo                                |
| Meta Ads  | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_SCOPES`         | App Review + business verification + `ads_read`    |
| Klaviyo   | `KLAVIYO_CLIENT_ID`, `KLAVIYO_CLIENT_SECRET`, `KLAVIYO_REDIRECT_URI`, scopes | revisión de la app y scopes de lectura aprobados   |
| Instagram | reutiliza Meta                                                               | permisos + cuenta profesional (INT-05, no ejecuta) |

`INTEGRATION_FEATURE_FLAGS` es un allowlist **global por proveedor**, no por organización: si está vacío
solo se habilita Shopify. Mientras Meta o Klaviyo no estén validados, mantenerlo explícito (`shopify`); al
validar cada proveedor, añadirlo (`shopify,meta_ads` o `shopify,klaviyo`) para que el cron o callback pueda
activarlo de forma controlada. Los mismos secretos deben existir en los workflows de reconciliación
(`meta-reconcile.yml`, `klaviyo-reconcile.yml`), no solo en el servidor de la API.

## Secuencia por cliente

### 1. Organización y acceso

Crear la organización, invitar al owner del cliente y asignar el consultor. Confirmar en `/consultor` que
la organización aparece y que `subscription.status` es `trial`/`active`.

### 2. Shopify (obligatorio — es la fuente operativa)

1. `/integraciones` → conectar tienda (`POST /v1/organizations/:organizationId/integrations/shopify/connect`).
2. Lanzar sync manual (`POST /v1/organizations/:organizationId/shopify/sync`) sin esperar al cron de las 2:00.
3. Comprobar los bloques en `integration_sync_runs` y `/shopify/diagnostico`.
4. Configurar costes de producto y gastos fijos: sin esto el motor financiero no calcula margen real.

Sin Shopify no se sigue: el resto del producto degrada a estados vacíos honestos, no a datos parciales.

### 3. Meta Ads (solo si hay App Review y cuenta real)

1. Conectar (`POST /v1/organizations/:organizationId/integrations/meta/connect` → callback `/v1/meta/oauth/callback`).
2. Revisar los activos descubiertos (`GET /v1/organizations/:organizationId/meta/assets`) y **seleccionar
   explícitamente** las cuentas publicitarias (`POST .../meta/assets/selection`). Nada se sincroniza sin
   selección explícita: es una decisión del cliente, no un default.
3. Sync inicial (`POST /v1/organizations/:organizationId/meta/sync`) → importa estructura completa e
   Insights de 90 días.
4. A partir de ahí, `meta-reconcile.yml` (diario, 03:17 UTC) reejecuta el sync en modo incremental con
   ventana móvil de 28 días, porque Meta reatribuye conversiones días después del clic.
5. **Revisar el `action_type` canónico de compra por cuenta**
   (`GET /v1/organizations/:organizationId/meta/purchase-action-types` →
   `PUT` con `{ adAccountId, actionType }`). El default es `omni_purchase` — la columna "Compras" que el
   anunciante ve en Ads Manager para ecommerce — pero una cuenta con configuración distinta (solo píxel,
   conversiones personalizadas, CAPI con deduplicación propia) necesita otro. Elegir mal aquí no rompe el
   sync: infla o hunde el ROAS silenciosamente. La respuesta marca `is_default: true` mientras nadie haya
   decidido, y lista solo los `action_type` realmente observados en los insights de esa cuenta.
6. Comparar una muestra (gasto de 3 días, una campaña) con el Ads Manager del cliente y registrar la
   discrepancia si la hay. **Esta comparación es el criterio de cierre de INT-02**, no que el sync no falle.
   Si las compras no cuadran, el primer sospechoso es el paso 5, no el sync.

### 4. Klaviyo (solo si hay OAuth y scopes aprobados)

1. Conectar (`POST /v1/organizations/:organizationId/integrations/klaviyo/connect` → `/v1/klaviyo/oauth/callback`).
   El callback dispara el sync inicial de metadatos (cuenta, listas, segmentos, flows, campañas, forms, métricas).
2. **Seleccionar la `conversion_metric_id`** (`GET .../klaviyo/metrics` → `POST .../klaviyo/conversion-metric`).
   Hasta que exista, el reconciliador marca la conexión como `skipped` y no se genera ningún reporting:
   "revenue por email" sin métrica de conversión explícita sería ambiguo entre clientes, no un cero.
3. `klaviyo-reconcile.yml` (cada 6 h) hace tres cosas por pasada: sync incremental de metadatos, reporting
   de los últimos 7 días y **un** mes pendiente del histórico de 12 meses. El histórico completo tarda
   varios días a propósito: Reporting API admite ~2 solicitudes por minuto y 225 al día por cuenta.
4. Confirmar en `/integraciones` que aparecen ejecuciones de reporting reales antes de prometer al cliente
   informes de email.

### 5. Agentes IA

Se habilitan al final y en `shadow`: toda propuesta de escritura pasa por aprobación humana en `/agentes`.
Un agente sin Meta o Klaviyo conectados degrada a "fuente no conectada"; nunca rellena la métrica que falta.

## Validación de alta completada

- `integration_connections.status = 'connected'` para cada proveedor activado.
- Al menos un `integration_sync_runs` `succeeded` por bloque y proveedor.
- Dashboard sin marcadores `sin_datos` en los módulos que el cliente tiene contratados.
- Una métrica de cada proveedor comparada contra el panel nativo del proveedor, con la discrepancia
  registrada por escrito si existe.

## Qué NO hacer

- No dar de alta un conector "para que se vea completo" sin credenciales: el estado no disponible es un
  estado de producto válido y la UI ya lo explica.
- No escribir datos de negocio manualmente en producción para rellenar un hueco de sync.
- No activar `ads_management` (escritura en Meta) durante un alta: es un permiso separado, sin validar.

## Si algo falla

Todo mensaje de error del portal termina en `(ref: <request id>)`. Ese id es el `x-request-id` de la
respuesta y el `reqId` de los logs estructurados de Fastify: pedirselo al cliente (o leerlo en la captura
que envie) es la forma mas rapida de encontrar el log exacto en vez de buscar por hora aproximada.

| Síntoma                                      | Runbook                               |
| -------------------------------------------- | ------------------------------------- |
| Sync de Shopify falla o queda degradado      | `RB-001-shopify-sync-failed.md`       |
| Token expirado o revocado                    | `RB-002-oauth-token-expired.md`       |
| Backlog o duplicados de webhooks             | `RB-004-webhook-duplicate-backlog.md` |
| Coste de IA disparado tras habilitar agentes | `RB-006-ai-cost-spike.md`             |

## Seguimiento posterior

A partir del alta, el cliente entra en la rutina semanal de
[`CHECKLIST-SALUD-CLIENTE.md`](../CHECKLIST-SALUD-CLIENTE.md).
