# BE-02 - Integrations core

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

