# BE-02 - Integrations core

## Estado

- **Estado real:** `implemented_partial` (el contrato común de adaptadores y el catálogo de estados ya
  existen; Shopify y Meta tienen runners reales, mientras Klaviyo e Instagram exponen adapters no
  disponibles sin fingir conexión).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-02
- **Dependencias:** DB-04
- **Bloqueador:** ninguno técnico para Shopify; la operación real de Meta/Klaviyo/Instagram depende de
  credenciales, App Review o runners que todavía no existen.
- **Evidencia:** `apps/api/src/integration-adapters.ts`, `packages/integrations/src/index.ts`,
  `apps/api/src/integration-adapters.test.ts`; Shopify/Meta reutilizan `IntegrationAdapter`, y los
  conectores futuros devuelven `unknown`/`connector_not_enabled` sin datos inventados.
- **Gaps identificados (los mismos que bloquean tratarlo como "implementable"):**
  - La interfaz común ya está declarada; falta ampliar el runner de sincronización a cada proveedor futuro.
  - Sin maquina de estados OAuth documentada (aunque existe una implementacion dual publica/custom con
    fallback de secret, ver DB-04/INT-01).
  - Sin politica de rotacion de credenciales, retry, circuit breaker, rate limiting o dead-letter queue
    documentada como contrato transversal (existe ad-hoc por proveedor).
  - Sin lista de archivos/endpoints/eventos/tests que demuestren el cierre.
- **Siguiente accion:** mantener el contrato como frontera única y añadir OAuth versionado, paginación,
  rate limits, reconciliación y runners de Klaviyo/Instagram cuando existan credenciales aprobadas.

## Objetivo

Crear la capa comun para proveedores externos.

## Entregables

- OAuth state/PKCE cuando aplique.
- Cifrado y lectura de credenciales desde backend/worker.
- Registro de sync runs.
- Webhook handler con verificacion de firma.
- Idempotency keys y dead-letter policy.

## Criterios de cierre

- Conector nuevo puede usar el nucleo comun.
- Reintentos no duplican efectos.
- Errores externos son auditables y accionables.
