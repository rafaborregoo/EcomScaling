-- Las facturas dejan de llamar "whop" a la pasarela.
--
-- `private.billing_invoices` nacio con tres columnas con el nombre del
-- proveedor dentro (`whop_payment_id`, `whop_membership_id`, `whop_event_id`).
-- Al cambiar a Stripe eso obliga a elegir entre mentir (guardar un `sub_...`
-- en una columna que se llama `whop_`) o volver a migrar en la siguiente.
-- Se renombran a neutro: lo que importa de una factura es contra que cobro se
-- emitio, no quien lo cobro -- y quien lo cobro cabe en una columna propia.
--
-- Se renombra en vez de anadir y copiar porque no hay ninguna factura emitida
-- todavia (cero filas en produccion): una migracion de convivencia aqui seria
-- ceremonia para nadie.

alter table private.billing_invoices
  rename column whop_payment_id to external_payment_id;

alter table private.billing_invoices
  rename column whop_membership_id to external_subscription_id;

alter table private.billing_invoices
  rename column whop_event_id to external_event_id;

-- Quien cobro. Por defecto 'stripe' porque es la pasarela desde ahora; las
-- filas historicas (si alguna vez las hubiera) se marcarian a mano.
alter table private.billing_invoices
  add column if not exists payment_provider text not null default 'stripe';

alter table private.billing_invoices
  drop constraint if exists billing_invoices_payment_provider_check;
alter table private.billing_invoices
  add constraint billing_invoices_payment_provider_check
  check (payment_provider in ('stripe', 'whop', 'manual'));

-- Asercion: el renombrado no puede dejar una factura sin su referencia al
-- cobro, que es lo que la hace rastreable ante una inspeccion.
do $$
declare
  rotas integer;
begin
  select count(*) into rotas
  from private.billing_invoices
  where invoice_type = 'F1'
    and external_payment_id is null;

  if rotas > 0 then
    raise exception '% facturas ordinarias se quedan sin referencia de cobro', rotas;
  end if;
end;
$$;
