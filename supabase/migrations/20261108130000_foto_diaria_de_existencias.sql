-- Historico de existencias (conocimiento/TAREAS_PENDIENTES.md, deuda de D03:
-- "se sabe el stock de hoy, no el de la semana pasada").
--
-- `shopify_inventory_level_snapshots` dejo de escribirse cuando las lecturas de
-- "stock ahora" pasaron a `shopify_inventory_current_state` (upsert). Esta
-- funcion saca una foto diaria de ese estado actual: una fila por
-- (item, ubicacion, dia). Reaplicarla el mismo dia no duplica nada (el unique
-- de la tabla ya incluye captured_at). La llama la reconciliacion nocturna de
-- Shopify via service role.
--
-- Idempotente (CLAUDE.md).

drop function if exists private.capture_inventory_snapshot();
create or replace function private.capture_inventory_snapshot()
returns jsonb
language sql
as $$
  with inserted as (
    insert into public.shopify_inventory_level_snapshots (
      organization_id, inventory_item_id, location_id,
      external_inventory_level_id, available_quantity, on_hand_quantity,
      committed_quantity, incoming_quantity, quantities_data, is_active,
      captured_at
    )
    select
      s.organization_id, s.inventory_item_id, s.location_id,
      s.external_inventory_level_id, s.available_quantity, s.on_hand_quantity,
      s.committed_quantity, s.incoming_quantity, s.quantities_data, s.is_active,
      date_trunc('day', now())
    from public.shopify_inventory_current_state s
    on conflict (inventory_item_id, location_id, captured_at) do nothing
    returning 1
  )
  select jsonb_build_object('inventory_snapshots_captured', count(*)) from inserted;
$$;

alter function private.capture_inventory_snapshot()
  set search_path = pg_catalog, public;

revoke all on function private.capture_inventory_snapshot() from public;
grant execute on function private.capture_inventory_snapshot() to service_role;

create index if not exists shopify_inventory_level_snapshots_org_captured_idx
  on public.shopify_inventory_level_snapshots (organization_id, captured_at);
