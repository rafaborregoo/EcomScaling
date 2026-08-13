# INT-03 - Klaviyo

> **Correccion 2026-08-03: backoff del cliente HTTP y backfill historico.** Dos huecos reales cerrados
> antes de conectar a un cliente:
>
> 1. `klaviyo-client.ts` no tenia ningun reintento (ADR-0006 punto 5 incumplido). Ahora respeta
>    `Retry-After` en los 429 y aplica backoff exponencial con jitter y techo de 60 s para 429/5xx;
>    401/403/404 y errores de validacion no se reintentan porque no mejoran solos. Esto importa
>    especialmente en Reporting API, que documenta cuotas de ~1/s, 2/min y 225/dia (guia Klaviyo 13 y 15).
> 2. El reconciliador solo cubria los ultimos 7 dias, asi que un cliente nuevo nunca tendria historico.
>    `nextKlaviyoBackfillPeriod` calcula el siguiente mes pendiente de los ultimos 12 y el reconciliador
>    ejecuta **uno por pasada**: con el cron de 6 h el ano completo se cubre en pocos dias sin agotar la
>    cuota de la cuenta del cliente. Es autoreparable — un mes fallido se reintenta en la siguiente pasada.
>
> Reporting API admite como maximo un ano por solicitud, por eso el backfill va mes a mes y no en un solo
> rango. Sigue pendiente la validacion contra una cuenta Klaviyo real.
>
> Aclaracion vigente 2026-08-02: las notas historicas de este documento que dicen que Klaviyo
> sigue `planned`, que no hay vertical slice o que OAuth/BE-06 siguen sin rutas quedan supersedidas.
> El estado operativo actual es `implemented_partial`: la integracion esta preparada y testeada sin
> cuenta real; la validacion externa, el backfill/reconciliacion profunda y el aprendizaje con datos
> reales siguen pendientes.
>
> **Correccion de estado 2026-08-02:** OAuth PKCE y el vertical slice de lectura ya estan cableados
> a `/v1/organizations/:organizationId/integrations/klaviyo/connect` y
> `/v1/klaviyo/oauth/callback`. El cliente fija `2026-04-15`, valida `links.next` y persiste solo
> metadatos agregados, Reporting API por tipo de informe y seleccion auditable de `conversion_metric_id`.
> INT-03 pasa a `implemented_partial`; faltan validacion con una cuenta Klaviyo real, backfill y
> reconciliacion programada.
>
> **Correccion 2026-08-02:** el workflow `klaviyo-reconcile` ejecuta cada 6 horas sync incremental
> y reports de campañas/flows de los ultimos 7 dias, con idempotencia por cuenta, metrica y periodo.
> No procesa nada cuando no hay conexiones Klaviyo activas.

## Estado

- **Estado real:** `implemented_partial`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-02
- **Dependencias:** INT-00, DB-09, BE-06
- **Bloqueador:** ninguno técnico — sigue sin existir un vertical slice ejecutado, pero ya hay primitives
  aislados en `apps/api/src/klaviyo-oauth.ts` para OAuth/PKCE, deliberadamente no conectados a rutas ni
  almacenamiento hasta cerrar DB-09/BE-06.
- **Referencia de plataforma**: `Klaviyo/EcomScaling_IA_Guia_Klaviyo_API.md` explica como funciona la API
  de Klaviyo; este documento decide como lo implementa EcomScaling. No dupliques la guia aqui.

## Decisiones aprobadas (pendientes de implementar)

- **Autenticacion: OAuth**, no Private API Keys por cliente — obligatorio para multi-tenant y para el
  App Marketplace de Klaviyo; las instalaciones OAuth tienen cuota de rate limit propia.
- **`api_revision` fijada y versionada explicitamente** en el cliente HTTP (no "siempre la ultima"). La
  guia de referencia en este repo esta escrita sobre la revision `2026-04-15`; antes de programar hay que
  reauditarla contra la revision vigente al momento de implementar.
- **Fuente de metricas: Reporting API**, no `Query Metric Aggregates`, para que las cifras coincidan con
  lo que el cliente ve en la interfaz de Klaviyo (`Query Metric Aggregates` agrupa por fecha del evento;
  campanas/flows en la UI de Klaviyo usan fecha de envio — divergen).
- **`conversion_metric_id` configurable por cuenta**, guardado con nombre, origen (Shopify/custom/otro),
  fecha y usuario que lo selecciono. Sin esto "revenue por email" es ambiguo entre clientes.
- Scopes minimos MVP: `accounts:read`, `flows:read`, `campaigns:read`, `forms:read`, `lists:read`,
  `segments:read`, `metrics:read`. `events:read`, `templates:read`, `profiles:read` y
  `webhooks:read/write` quedan fuera del MVP salvo necesidad concreta.

La fase incluye también un generador de contenido email dentro de EcomScaling:
crear borradores de campañas y plantillas reutilizables con IA, con revisión humana,
versionado y publicación futura a Klaviyo sin rehacer la interfaz cuando llegue OAuth.

## Recursos a sincronizar (MVP)

Cuenta y configuracion (timezone, currency, site_id) · lists/segments (conteo, no miembros individuales en
MVP) · flows y sus messages · campaigns y sus messages · forms disponibles · Reporting API para
campaigns/flows con la `conversion_metric_id` de la cuenta.

## Pendiente antes de empezar implementacion

1. Reauditar `api_revision` vigente contra la guia de referencia (escrita sobre `2026-04-15`).
2. Confirmar paginacion por cursor (`links.next`, no offsets) en el cliente HTTP desde el primer commit.
3. Decidir frecuencia real de sync por bloque (cuenta diaria, flows/campaigns cada 3-6h, reporting
   reciente varias veces al dia, reconciliacion completa semanal) siguiendo el patron de
   `docs/decisions/ADR-0006-integration-module-pattern.md`.
4. Registrar aqui, cuando exista codigo, ruta de OAuth/callback/sync igual que INT-01/INT-02.

## Criterios de cierre

- Revenue por email y por flow calculado con `conversion_metric_id` explicito y trazable, no un supuesto
  implicito.
- Alertas de flow/campana basadas en datos reales de Reporting API, no en `Query Metric Aggregates`.
- El generador devuelve un contrato estructurado validado, guarda el borrador asociado
  a una ejecución IA y conserva fuentes, coste, modelo, versión y decisión humana.
- Los borradores pueden revisarse y editarse sin Klaviyo conectado; publicar/enviar
  exige conexión saludable, permisos adecuados y aprobación humana.

## Verificacion documental oficial 2026-08-02

La reauditoria contra la documentacion oficial de Klaviyo confirma el contrato que debe implementar
la futura Fase B:

- OAuth usa `GET https://www.klaviyo.com/oauth/authorize` y el intercambio/refresco/revocacion se
  realiza contra `https://a.klaviyo.com/oauth/token` y `https://a.klaviyo.com/oauth/revoke`; el flujo
  debe usar PKCE S256 y `application/x-www-form-urlencoded` para token.
- Las llamadas API autenticadas usan `Authorization: Bearer` y una cabecera `revision` fijada; no se
  debe enviar el trafico de token a `www.klaviyo.com`.
- Para el MVP de reporting, los scopes de lectura relevantes son `flows:read`, `campaigns:read`,
  `forms:read` y `segments:read`; el Reporting API es la fuente de verdad para igualar las cifras de
  la interfaz de Klaviyo, no Query Metric Aggregates.

Fuentes oficiales: [OAuth de Klaviyo](https://developers.klaviyo.com/en/v2026-01-15/docs/set_up_oauth),
[autenticacion y scopes](https://developers.klaviyo.com/en/v2026-01-15/docs/authenticate_),
[Reporting API](https://developers.klaviyo.com/en/v2026-01-15/reference/reporting_api_overview).
Estas referencias no implican que el conector este activo: las credenciales, App Review y el runner
de sincronizacion siguen pendientes.

## Correccion de estado 2026-08-01

Klaviyo sigue sin vertical slice ni credenciales: permanece `planned` para la integración operativa.
El repositorio ya expone el contrato/adaptador no disponible y primitives OAuth/PKCE aislados, con estado
honesto (`unknown` / `integration_not_available`) para que la UI y el dominio puedan activarlo más
adelante sin datos simulados ni cambios de interfaz.

## Preparación de producto 2026-08-02

La pantalla de integraciones, el catálogo de capacidades y los estados de datos
incompletos quedan definidos aunque Klaviyo no esté conectado. La activación futura
debe implementar OAuth versionado, paginación por cursor, Reporting API y una
`conversion_metric_id` seleccionada por cuenta, reutilizando el contrato común y sin
crear una UI paralela. Ver [`../CONTRATO_PREPARACION_CONECTORES.md`](../CONTRATO_PREPARACION_CONECTORES.md).
