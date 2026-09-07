# EcomScaling

Monorepo: `apps/api` (Fastify), `apps/web` (Next.js, ver `apps/web/CLAUDE.md`), `apps/worker` (BullMQ), `packages/*` (config, db, contracts, integrations, ui, ai, observability, domain), `supabase/migrations`.

## Al construir o tocar un modulo de integracion (Shopify, Meta Ads, Klaviyo...)

Sigue **[docs/decisions/ADR-0006-integration-module-pattern.md](docs/decisions/ADR-0006-integration-module-pattern.md)** desde el primer commit del modulo, no como limpieza posterior. Resumen:

1. Estado actual = tabla con upsert in-place (unique + onConflict). Nunca append-only leido con `DISTINCT ON`.
2. Sync en bloques independientes (`sync_scope`), cada uno con su propio try/catch y fila en `integration_sync_runs`.
3. Import completo (bulk/export API del proveedor, sin limite de paginas) e incremental (`updated_at >= last_sync_at`) son el mismo codigo parametrizado, ambos desde el principio.
4. Webhooks + reconciliacion periodica via `apps/worker`, nunca solo webhooks.
5. Backoff ante rate limiting del proveedor desde el primer commit del cliente HTTP.
6. Metricas = funciones SQL `stable`, sin `security definer`, llamadas via `.rpc()`; nunca agregar en Node. Indice que calce con el predicado de fecha, creado junto con la funcion.
7. Escrituras via `SUPABASE_SERVICE_ROLE_KEY` + chequeo manual de membership/rol; RLS de las tablas solo permite `select` a `authenticated`.
8. Validar contra una cuenta de prueba real antes de cerrar el modulo; mientras tanto, logs de diagnostico que delaten si un supuesto de la documentacion del proveedor no se cumple.

Si el modulo expone **ingresos atribuidos** (Klaviyo, Meta, Google), sigue tambien **[docs/decisions/ADR-0021-ingresos-atribuidos-entre-integraciones.md](docs/decisions/ADR-0021-ingresos-atribuidos-entre-integraciones.md)**: nunca sumar atribucion entre plataformas, cada cifra lleva su ventana/metrica, stream first-party en paralelo, y los agentes reciben "EUR atribuidos por X", no "EUR generados".

Otras decisiones arquitectonicas en `docs/decisions/`.
