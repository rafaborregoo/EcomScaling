# BE-04 - Meta Ads y adquisicion

> **Corrección vigente 2026-08-20:** el núcleo local está preparado para
> OAuth, descubrimiento, selección auditable de cuenta/acción canónica, sync,
> insights, paginación, backoff y estados vacíos. La migración de acción de
> compra canónica ya está aplicada. El único bloqueo del vertical slice real es
> externo: App Review, business verification, permisos y una cuenta publicitaria
> de prueba/cliente; no se deben inventar activos ni métricas para cubrirlo.

## Estado

- **Estado real:** `blocked_external_validation` (el nucleo local puede estar hecho; el vertical slice
  completo esta bloqueado por validacion externa, no es simplemente "parcial").
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-20
- **Dependencias:** DB-04, DB-06
- **Bloqueador:** falta `META_APP_ID`/`META_APP_SECRET` de una app real de Meta con App Review y business
  verification aprobados. Sin eso no se puede validar redirect URI real, revision de permisos, acceso a
  activos, restricciones del portfolio empresarial, insights reales, rate limits reales ni expiracion de
  tokens.
- **Evidencia:** codigo en `apps/api/src/meta.ts` (OAuth, descubrimiento) y `meta-metrics.ts` (metricas),
  sin poder ejecutarse contra una cuenta real.
- **Matriz de flujo (a completar con endpoint/estado/prueba real, hoy solo lista lo que existe en codigo):**

  | Flujo                | Endpoint/job                                                                           | Estado             | Prueba      | Bloqueador |
  | -------------------- | -------------------------------------------------------------------------------------- | ------------------ | ----------- | ---------- |
  | Inicio OAuth         | `createMetaConnectionAuthUrl` / `POST /v1/organizations/:id/integrations/meta/connect` | Implementado       | Ninguna     | App real   |
  | Callback             | `handleMetaOAuthCallback` / `GET /v1/meta/oauth/callback`                              | Implementado       | Ninguna     | App real   |
  | Seleccion ad account | `GET/PUT .../meta/assets` y `.../meta/assets/selection`                                | Implementado local | Contractual | App real   |
  | Sync estructura      | `triggerMetaSync` / `POST /v1/organizations/:id/meta/sync`                             | Implementado       | Ninguna     | App real   |
  | Insights             | `getMetaMetrics` / `GET /v1/organizations/:id/meta/metrics`                            | Implementado       | Ninguna     | App real   |

- **Gaps identificados (documentacion, no solo pruebas):**
  - La validación contra una cuenta real, Ads Manager y App Review sigue pendiente y no puede
    sustituirse por fixtures de producción.
  - La selección de cuenta publicitaria ya está expuesta mediante
    `GET /v1/organizations/:organizationId/meta/assets` y
    `PUT /v1/organizations/:organizationId/meta/assets/selection`.
- **Evidencia documental:** `META_GRAPH_VERSION` configurable y validada en `packages/config/src/index.ts` y
  `apps/api/src/meta-client.ts` (fallback conservador `v23.0` mientras no se confirme otra versión);
  `omni_purchase` como acción canónica por defecto y persistencia de ventana de atribución en
  `INT-02-meta-ads.md`; fórmulas de ROAS/CAC y estados de reautorización en el contrato común.
- **Siguiente accion:** validación externa con una app Meta real, permisos aprobados y una cuenta
  publicitaria de prueba; después comparar insights y Ads Manager sin cambiar el dominio.

## Correccion de evidencia 2026-08-26

La version Graph ya no esta fijada exclusivamente en codigo: `META_GRAPH_VERSION` se valida
como `vN.N`, se propaga desde configuracion y mantiene `v23.0` como fallback. El cliente Meta
tambien incluye `appsecret_proof` en requests server-to-server y paginacion. La validacion real
de App Review, permisos, activos e Insights sigue siendo externa.

## Objetivo

Traer inversion, ROAS, estructura publicitaria y creatividades para comparar adquisicion con break-even.

## Contrato de preparación 2026-08-02

El backend queda preparado para activación futura aunque la validación externa esté
bloqueada: OAuth, descubrimiento, selección explícita de activos, sync, salud,
freshness y errores deben exponer contratos normalizados al portal. No se permiten
tokens en frontend ni datos simulados. El flujo de varias cuentas y de acceso directo
o Business Manager/System User se documenta en
[`../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).

## Entregables

- OAuth Meta.
- Descubrimiento de business, pages y ad accounts.
- Sync de campaigns, ad sets, ads y creatives.
- Insights async por periodo/nivel.
- Calculos de ROAS, CAC y gasto.

## Criterios de cierre

- Rate limits controlados.
- Acciones arrays normalizadas.
- Datos muestran periodo, fuente y freshness.
