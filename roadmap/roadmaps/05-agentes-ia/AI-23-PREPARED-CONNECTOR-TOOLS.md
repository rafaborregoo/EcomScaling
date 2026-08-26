# AI-23 — Contratos de tools para agentes preparados

La capa de tools ya registra los contratos de lectura que necesitarán A03, A05
y A07 cuando estén disponibles los proveedores:

- `meta_read_ad_accounts`;
- `meta_read_campaign_insights`;
- `instagram_read_media`;
- `instagram_read_insights`.

Cada contrato tiene connector, permiso de lectura, paginación acotada, fechas
opcionales y salida con provenance. Su estado es `planned`, por lo que
`authorizeTool` las rechaza hasta que exista un executor real, conexión y
`allowed_tools` de una versión aprobada. No se simulan respuestas ni se
exponen credenciales.

La evidencia está en `packages/ai/src/prepared-tools.test.ts`.
