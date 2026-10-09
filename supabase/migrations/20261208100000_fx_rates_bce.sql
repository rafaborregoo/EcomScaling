-- Tipos de cambio de referencia del BCE (base EUR), uno por dia habil y moneda.
--
-- Hasta ahora ninguna cifra se convertia: si una fuente estaba en USD y la
-- tienda en EUR, el copiloto se negaba a comparar. Con esta tabla se convierte
-- con el tipo oficial del dia (no en tiempo real: el BCE publica una vez al dia,
-- que es el criterio contable habitual).
--
-- La rellena la API bajo demanda (apps/api/src/fx-rates.ts) con service role.
-- No es dato de ningun cliente: cualquier usuario autenticado puede leerla.
-- Idempotente: si el esquema se toco por fuera, db:push la reaplica.

create table if not exists public.fx_rates (
  rate_date date not null,
  currency_code text not null,
  eur_rate numeric(18, 8) not null,
  fetched_at timestamptz not null default now(),
  primary key (rate_date, currency_code),
  constraint fx_rates_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint fx_rates_rate_positive check (eur_rate > 0)
);

create index if not exists fx_rates_currency_date_idx
  on public.fx_rates (currency_code, rate_date desc);

alter table public.fx_rates enable row level security;

drop policy if exists fx_rates_select_authenticated on public.fx_rates;
create policy fx_rates_select_authenticated on public.fx_rates
  for select to authenticated using (true);

-- Cuantas unidades de `to_ccy` vale 1 unidad de `from_ccy` en `on_date`,
-- con el ultimo tipo publicado ese dia o antes (fines de semana y festivos
-- usan el del ultimo dia habil). null si falta alguno de los dos tipos.
create or replace function public.fx_rate(from_ccy text, to_ccy text, on_date date default current_date)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when upper(from_ccy) = upper(to_ccy) then 1::numeric
    else (
      select case when upper(to_ccy) = 'EUR' then 1::numeric else t.eur_rate end
      from (select 1) one
      left join lateral (
        select eur_rate from public.fx_rates
        where currency_code = upper(to_ccy) and rate_date <= on_date
        order by rate_date desc limit 1
      ) t on true
    ) / (
      select case when upper(from_ccy) = 'EUR' then 1::numeric else f.eur_rate end
      from (select 1) one
      left join lateral (
        select eur_rate from public.fx_rates
        where currency_code = upper(from_ccy) and rate_date <= on_date
        order by rate_date desc limit 1
      ) f on true
    )
  end
$$;
