# INT-04 — Fathom en catálogo y UI

Incremento local: implementado.

Fathom forma parte ahora de `INTEGRATION_CATALOG` con capacidades explícitas: webhook sí, OAuth y
sync genérico no. La API devuelve la tarjeta junto al resto de integraciones y la UI reutiliza
`IntegrationStatusBadge`/`Banner`: sin credenciales aparece como preparado, sin CTA de OAuth, sin
conexión falsa y sin datos simulados.

La configuración requiere `FATHOM_API_KEY` y `FATHOM_WEBHOOK_SECRET`, siempre server-side. La
conexión real, el registro del webhook y la validación de una cuenta externa siguen siendo gates
operativos posteriores.
