# BE-02 - Integrations core

## Estado

- **Estado real:** `planned` (documento de intenciones, no de contrato implementable — a pesar de que
  Shopify/Meta ya usan un nucleo comun de hecho, ese nucleo nunca se documento aqui).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-04
- **Bloqueador:** ninguno tecnico; falta escribir el contrato antes de declarar el bloque cerrado.
- **Evidencia:** codigo real disperso en `apps/api/src/shopify.ts`, `shopify-webhook-handler.ts`,
  `shopify-webhooks.ts`, `meta.ts` — funciona (validado con tienda Shopify real), pero **no esta descrito
  como contrato reutilizable** en este documento; cada proveedor repite su propia logica en vez de
  compartir una interfaz de conector comun.
- **Gaps identificados (los mismos que bloquean tratarlo como "implementable"):**
  - Sin interfaz comun de conectores declarada.
  - Sin maquina de estados OAuth documentada (aunque existe una implementacion dual publica/custom con
    fallback de secret, ver DB-04/INT-01).
  - Sin politica de rotacion de credenciales, retry, circuit breaker, rate limiting o dead-letter queue
    documentada como contrato transversal (existe ad-hoc por proveedor).
  - Sin lista de archivos/endpoints/eventos/tests que demuestren el cierre.
- **Siguiente accion:** extraer el patron que ya funciona en Shopify (conexion, credenciales, sync runs,
  webhooks) a un contrato explicito en este documento antes de que Klaviyo (BE-06) tenga que reinventarlo.

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

