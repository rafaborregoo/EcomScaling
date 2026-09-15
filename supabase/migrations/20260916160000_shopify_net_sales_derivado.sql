-- Correccion de la migracion anterior (20260916150000).
--
-- Aquella dejo la coherencia de `net_sales` como check constraint. El
-- razonamiento era bueno y el resultado peligroso: **la API desplegada en el
-- VPS no escribe la columna**. Con solo el check, el siguiente webhook de
-- pedido habria sido rechazado, Shopify habria reintentado y el pedido se
-- habria perdido. Se cambio un dato mal calculado por una ingesta rota, que es
-- peor.
--
-- El arreglo correcto no es rechazar: es **derivar**. Un trigger `before` que
-- calcula `net_sales` siempre deja bien el dato venga de donde venga, sin
-- depender de que nadie despliegue nada:
--
--   - el codigo desplegado hoy, que omite la columna, pasa a guardar el valor
--     correcto desde el proximo webhook;
--   - el sync bulk, que si la manda, obtiene el mismo numero;
--   - ninguna via futura puede escribir un valor incoherente.
--
-- El check se conserva como cable trampa: con el trigger puesto no puede
-- saltar nunca, pero si alguien quita el trigger, vuelve a fallar en voz alta
-- en lugar de guardar ceros en silencio.

create or replace function private.shopify_order_facts_net_sales()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Misma formula que el sync bulk, ahora en un solo sitio y de verdad.
  new.net_sales := coalesce(new.current_total_price, 0) - coalesce(new.refunds, 0);
  return new;
end;
$$;

comment on function private.shopify_order_facts_net_sales() is
  'Deriva net_sales = current_total_price - refunds en cada escritura. Existe '
  'porque el ingreso neto se calculaba en dos mappers y el de webhooks se '
  'olvidaba de la columna, que es not null default 0: 248 pedidos quedaron a '
  'cero euros sin que fallara nada.';

drop trigger if exists shopify_order_facts_net_sales on public.shopify_order_facts;
create trigger shopify_order_facts_net_sales
  before insert or update on public.shopify_order_facts
  for each row execute function private.shopify_order_facts_net_sales();
