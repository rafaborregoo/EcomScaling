# EcomScaling

Monorepo: `apps/api` (Fastify), `apps/web` (Next.js, ver `apps/web/CLAUDE.md`), `apps/worker` (BullMQ), `packages/*` (config, db, contracts, integrations, ui, ai, observability, domain), `supabase/migrations`.

## Migraciones

**Se aplican con `npm run db:push`, nunca con `apply_migration` del MCP de Supabase.** El MCP ejecuta el
SQL pero **no lo anota** en `supabase_migrations.schema_migrations`: el esquema queda cambiado y el
historial no se entera, sin ningun error. A partir de ahi, `db:push` cree que la migracion sigue
pendiente y cualquiera que mire `schema_migrations` concluye que no se aplico.

Consecuencia practica: **toda migracion se escribe idempotente** (`add column if not exists`,
`create index if not exists`, `create or replace function`, `drop ... if exists` antes de crear,
`update ... where <columna> is null` en los backfills). Asi, si el esquema se ha tocado por fuera,
`db:push` la reaplica sin dano y deja el historial correcto — que es como se recupera la deriva.

Antes de decir que una migracion esta pendiente, comprobar `schema_migrations` en produccion, no
suponerlo por el listado de ficheros.

Anadir un parametro con `default` a una funcion existente **no** basta con `create or replace`: crea
una sobrecarga, y entonces la llamada antigua encaja en las dos firmas y Postgres la rechaza por
ambigua. Hay que `drop function` la firma vieja en la misma migracion.

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

Shopify y Klaviyo tienen ademas su propia guia de permisos y errores en
**[docs/INTEGRACION_SHOPIFY.md](docs/INTEGRACION_SHOPIFY.md)** y
**[docs/INTEGRACION_KLAVIYO.md](docs/INTEGRACION_KLAVIYO.md)** (que permiso desbloquea que,
que se comprueba al conectar y como se explican los fallos de permisos).

Otras decisiones arquitectonicas en `docs/decisions/`.
