-- El CHECK de `sync_scope` era una lista cerrada de cinco valores de julio y
-- ya rompia dos cosas en produccion:
--
-- 1. Shopify: `ensureSyncRun` inserta la fila ANTES de ejecutar ningun bloque.
--    Un scope rechazado no rompe su bloque: tira el sync entero de la tienda
--    antes de empezar. El bloque de sesiones ya estaba escrito con ese destino.
-- 2. Meta: sus scopes llevan el id de la cuenta dentro (`insights:act_123`,
--    `backfill:2026-01:act_123`), asi que ninguno pasaba la lista. Como el
--    insert no comprueba el error, Meta sincroniza sin dejar rastro en
--    `integration_sync_runs` -- invisible para observabilidad y frescura.
--
-- El scope es un dato abierto por proveedor, no un enum del dominio: la
-- restriccion pasa a ser de forma (minusculas y segmentos separados por `:`),
-- que es lo que si evita el typo sin volver a caducar cada vez que un modulo
-- añade un bloque.

alter table public.integration_sync_runs
  drop constraint if exists integration_sync_runs_sync_scope_check;

-- `backfill:2026-01:act_<17 digitos>` se come 38 de los 40 antiguos: el limite
-- estaba a dos caracteres de convertirse en el siguiente fallo silencioso.
alter table public.integration_sync_runs
  alter column sync_scope type varchar(80);

alter table public.integration_sync_runs
  add constraint integration_sync_runs_sync_scope_check check (
    sync_scope is null
    or sync_scope ~ '^[a-z0-9_]+(:[A-Za-z0-9_.-]+)*$'
  );
