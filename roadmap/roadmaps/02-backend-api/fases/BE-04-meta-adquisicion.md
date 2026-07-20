# BE-04 - Meta Ads y adquisicion

## Estado

- **Estado real:** `blocked_external_validation` (el nucleo local puede estar hecho; el vertical slice
  completo esta bloqueado por validacion externa, no es simplemente "parcial").
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-04, DB-06
- **Bloqueador:** falta `META_APP_ID`/`META_APP_SECRET` de una app real de Meta con App Review y business
  verification aprobados. Sin eso no se puede validar redirect URI real, revision de permisos, acceso a
  activos, restricciones del portfolio empresarial, insights reales, rate limits reales ni expiracion de
  tokens.
- **Evidencia:** codigo en `apps/api/src/meta.ts` (OAuth, descubrimiento) y `meta-metrics.ts` (metricas),
  sin poder ejecutarse contra una cuenta real.
- **Matriz de flujo (a completar con endpoint/estado/prueba real, hoy solo lista lo que existe en codigo):**

  | Flujo | Endpoint/job | Estado | Prueba | Bloqueador |
  | --- | --- | --- | --- | --- |
  | Inicio OAuth | `createMetaConnectionAuthUrl` / `POST /v1/organizations/:id/integrations/meta/connect` | Implementado | Ninguna | App real |
  | Callback | `handleMetaOAuthCallback` / `GET /v1/meta/oauth/callback` | Implementado | Ninguna | App real |
  | Seleccion ad account | no existe endpoint dedicado | No implementado | Ninguna | App real |
  | Sync estructura | `triggerMetaSync` / `POST /v1/organizations/:id/meta/sync` | Implementado | Ninguna | App real |
  | Insights | `getMetaMetrics` / `GET /v1/organizations/:id/meta/metrics` | Implementado | Ninguna | App real |

- **Gaps identificados (documentacion, no solo pruebas):**
  - Sin version exacta de Meta Graph API documentada.
  - Sin `action_type` canonico para compras definido (`purchase` vs `omni_purchase` vs
    `offsite_conversion.fb_pixel_purchase`) ni criterio de prioridad.
  - Sin ventana de atribucion documentada.
  - Sin formula documentada de CAC y ROAS (existe en codigo, no en este documento).
  - Sin diferencias esperadas frente a Ads Manager documentadas.
  - Sin politica de reautorizacion ni estados de revision de la app.
- **Siguiente accion:** ninguna posible en codigo hasta tener app real; mientras tanto, completar la
  matriz de flujo y documentar `action_type`/ventana de atribucion/formulas, que no dependen de acceso
  real.

## Objetivo

Traer inversion, ROAS, estructura publicitaria y creatividades para comparar adquisicion con break-even.

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

