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
- No se ha verificado backoff/rate-limit real (`throttleStatus` de Meta) en `meta-client.ts` — pendiente
  de confirmar, no asumir.

## Pendiente antes de cerrar INT-02

1. Decidir y documentar `canonical_purchase_action_type` por cuenta (o una prioridad fija) antes de
   mostrar ROAS/CAC como numero unico en UI.
2. Decidir si Insights async es necesario para el volumen real esperado, o si el modo sincrono actual es
   suficiente para el MVP.
3. Si INT-05 (Instagram) depende de esta conexion, ampliar `META_SCOPES` con
   `instagram_basic`/`instagram_manage_insights` aqui, no en INT-05.
4. El resto (validacion de app real, activos reales, insights reconciliados contra Ads Manager) depende
   integramente de que Meta apruebe la app — ver bloqueador.
