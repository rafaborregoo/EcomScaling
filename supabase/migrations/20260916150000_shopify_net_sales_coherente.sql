-- El ingreso neto de un pedido se estaba calculando en dos sitios y solo uno lo
-- hacia bien. El sync bulk escribia `net_sales = total - devoluciones`; el
-- webhook de `orders/create` y `orders/updated` **no escribia la columna**, y
-- como es `not null default 0`, todo pedido que entraba por webhook quedaba con
-- ingreso cero sin que fallara nada.
--
-- El efecto en produccion: desde el 14-08-2026, cuando el webhook paso a ser la
-- via principal de ingesta, el 99% de los pedidos de septiembre figuraban con
-- cero euros. Ninguna alerta salto, porque `orders_count` seguia siendo correcto
-- y la unica senal era que el dinero no aparecia.
--
-- Esta migracion hace dos cosas: recalcula lo que ya esta mal y deja la
-- coherencia como check constraint, para que la proxima via de escritura que se
-- olvide de `net_sales` falle en voz alta en lugar de guardar un cero.

-- 1. Recalculo. La formula es la del sync bulk, que es la buena: reproduce
--    exactamente las filas ya correctas, asi que solo mueve las rotas.
update public.shopify_order_facts
set net_sales = current_total_price - refunds
where net_sales is distinct from current_total_price - refunds;

-- 2. La garantia. Idempotente: si ya existe, no se toca.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_order_facts'::regclass
      and conname = 'order_facts_net_sales_coherente'
  ) then
    alter table public.shopify_order_facts
      add constraint order_facts_net_sales_coherente
      check (net_sales = current_total_price - refunds);
  end if;
end $$;

comment on column public.shopify_order_facts.net_sales is
  'Ingreso neto del pedido = current_total_price - refunds. La igualdad la impone '
  'order_facts_net_sales_coherente: no es una convencion, es un check. Cualquier '
  'escritura que omita la columna falla en vez de guardar el default 0.';
