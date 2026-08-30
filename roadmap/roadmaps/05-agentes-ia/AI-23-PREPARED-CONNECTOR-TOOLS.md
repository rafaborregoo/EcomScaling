# AI-23 — Contratos de tools para agentes preparados

La capa de tools registra y ejecuta sobre datos normalizados los contratos de
lectura que necesitan A03, A05 y A07:

- `meta_read_ad_accounts` (activo sobre `meta_ad_accounts` sincronizado);
- `meta_read_campaign_insights` (activo sobre `meta_insight_rows_daily` sincronizado);
- `instagram_read_media` (activo sobre `instagram_media`);
- `instagram_read_insights` (activo sobre `instagram_media_insight_values`).

Cada contrato tiene connector, permiso de lectura, paginación acotada, fechas
opcionales y salida con provenance. Las cuatro tools tienen executor local y
solo se registran en el runtime cuando el agente las permite y existe la
conexión correspondiente. Leen exclusivamente tablas normalizadas y tenant-
scoped; si aún no hay sincronización devuelven un conjunto vacío. No se
simulan respuestas ni se exponen credenciales.

La evidencia está en `packages/ai/src/prepared-tools.test.ts`.
