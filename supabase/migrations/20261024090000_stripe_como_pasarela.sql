-- Stripe sustituye a Whop como pasarela de cobro.
--
-- El cambio es de borde, no de modelo: `service_subscriptions` sigue siendo la
-- fuente de la que ADR-0023 deriva el rol, el limite de tiendas, la capacidad
-- de cartera y el saldo del copiloto. Ninguna de esas nueve lecturas sabe quien
-- cobra, que es justo lo que hace barato el cambio.
--
-- Whop se deja en el check mientras existan filas suyas en `webhook_events`
-- (hoy: cero en produccion). Quitarlo a la vez que se anade Stripe romperia el
-- historico si en algun entorno quedara alguna, y no gana nada.

alter table private.webhook_events
  drop constraint if exists webhook_events_provider_check;

alter table private.webhook_events
  add constraint webhook_events_provider_check check (
    provider in (
      'shopify',
      'meta_ads',
      'klaviyo',
      'instagram',
      'fathom',
      'loom',
      'whop',
      'stripe'
    )
  );

-- Asercion: nadie se queda con un proveedor que el check ya no admite.
do $$
declare
  huerfanos integer;
begin
  select count(*) into huerfanos
  from private.webhook_events
  where provider not in (
    'shopify', 'meta_ads', 'klaviyo', 'instagram', 'fathom', 'loom', 'whop', 'stripe'
  );

  if huerfanos > 0 then
    raise exception '% eventos con un proveedor fuera del check', huerfanos;
  end if;
end;
$$;
