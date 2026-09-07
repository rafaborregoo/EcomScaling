-- Arregla el sync de Klaviyo: `klaviyo_metrics` tiene el trigger
-- `klaviyo_metrics_set_updated_at` pero le falta la columna `updated_at`, asi
-- que `private.set_updated_at()` revienta en cada upsert con
-- `record "new" has no field "updated_at"` y tumba el bloque entero.
--
-- Visto en integration_sync_runs (2026-09-02):
--   klaviyo_sync_klaviyo_metrics_failed: record "new" has no field "updated_at"
--
-- Es la unica de las siete tablas de Klaviyo sin la columna; las otras seis
-- (accounts, campaigns, flows, forms, lists, segments) la tienen junto a su
-- trigger. Se anade en vez de quitar el trigger para dejarlas todas iguales.
--
-- Importa mas de lo que parece: mientras el sync falla, `klaviyo_flows` se
-- queda a 0 filas y A12 (analista de email) lee eso como "esta tienda no tiene
-- ningun flujo" y propone montarlos. Vacio y desconocido no son lo mismo.

alter table public.klaviyo_metrics
  add column if not exists updated_at timestamptz not null default now();

comment on column public.klaviyo_metrics.updated_at is
  'Ultima modificacion de la fila. La rellena el trigger klaviyo_metrics_set_updated_at, que existia antes que la columna (sync roto hasta 2026-09-03).';
