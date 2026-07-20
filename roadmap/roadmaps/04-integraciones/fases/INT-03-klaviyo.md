# INT-03 - Klaviyo

## Estado

- **Estado real:** `planned`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** INT-00, DB-09, BE-06
- **Bloqueador:** ninguno tecnico — es especificacion sin vertical slice ejecutado, no hay codigo en
  `apps/api/src` para Klaviyo (`grep -rl klaviyo apps/api/src` no devuelve nada salvo referencias de
  categoria en `operations.ts`/`ai-runtime.ts`).
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
