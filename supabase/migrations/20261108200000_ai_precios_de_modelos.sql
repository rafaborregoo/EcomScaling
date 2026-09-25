-- ---------------------------------------------------------------------------
-- Precios de los modelos de IA, fuera del codigo
-- ---------------------------------------------------------------------------
--
-- Hasta hoy la tarifa vivia en MODEL_PRICING (packages/ai): cambiar un precio
-- exigia un deploy, y un modelo nuevo (claude-opus-5, el id fechado de Haiku)
-- dejaba sus ejecuciones sin coste hasta que alguien lo anotara a mano. Con
-- Sonnet 5 el panel llevaba semanas contando 3/15 USD cuando la tarifa es 2/10.
--
-- Ahora el job diario `ai-pricing-sync` rellena esta tabla desde la lista
-- publica de LiteLLM, el runtime la lee (MODEL_PRICING queda como respaldo si
-- la tabla no responde) y `reprice_unknown_agent_runs` pone coste a las
-- ejecuciones que se quedaron sin el.

create table if not exists public.ai_model_prices (
  model varchar(120) primary key,
  provider varchar(20) not null,
  input_per_mtok numeric(12, 6) not null,
  output_per_mtok numeric(12, 6) not null,
  cache_read_per_mtok numeric(12, 6),
  source varchar(40) not null,
  source_url text,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_model_prices_provider check (provider in ('anthropic', 'openai', 'voyage')),
  constraint ai_model_prices_source check (source in ('litellm', 'code_default', 'manual')),
  constraint ai_model_prices_positivos check (
    input_per_mtok >= 0 and output_per_mtok >= 0
    and (cache_read_per_mtok is null or cache_read_per_mtok >= 0)
  )
);

comment on table public.ai_model_prices is
  'USD por millon de tokens de cada modelo. La escribe el job ai-pricing-sync (fuente LiteLLM); checked_at = ultima comprobacion, updated_at = ultimo cambio de tarifa.';

alter table public.ai_model_prices enable row level security;

drop policy if exists "ai_model_prices_select_admin" on public.ai_model_prices;
create policy "ai_model_prices_select_admin" on public.ai_model_prices
  for select to authenticated
  using (private.is_platform_admin());

grant select on public.ai_model_prices to authenticated;

-- Pone coste a las ejecuciones marcadas `unknown_model` cuyo modelo ya tiene
-- precio. Casa tambien el id fechado (claude-haiku-4-5-20251001,
-- gpt-5.5-2026-04-23) con el alias sin fecha.
create or replace function public.reprice_unknown_agent_runs()
returns integer
language sql
as $$
  with repriced as (
    update public.agent_runs r
    set estimated_cost_usd = round(
          (r.input_tokens / 1000000.0) * p.input_per_mtok
          + (r.output_tokens / 1000000.0) * p.output_per_mtok,
          6),
        cost_basis = 'priced',
        pricing_version = to_char(p.updated_at at time zone 'UTC', 'YYYY-MM-DD')
    from public.ai_model_prices p
    where r.cost_basis = 'unknown_model'
      and r.model is not null
      and p.model = case
        when exists (select 1 from public.ai_model_prices e where e.model = r.model) then r.model
        else regexp_replace(r.model, '-([0-9]{8}|[0-9]{4}-[0-9]{2}-[0-9]{2})$', '')
      end
    returning 1
  )
  select count(*)::integer from repriced;
$$;

alter function public.reprice_unknown_agent_runs() set search_path = pg_catalog, public;

revoke all on function public.reprice_unknown_agent_runs() from public, anon, authenticated;
grant execute on function public.reprice_unknown_agent_runs() to service_role;
