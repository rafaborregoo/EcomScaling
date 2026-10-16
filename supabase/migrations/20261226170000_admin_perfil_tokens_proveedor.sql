-- Corrige admin_ai_run_profile: solo OpenAI incluye la cache dentro del input; Anthropic (o proveedor sin registrar) la informa aparte.
--
-- Solo ejecuciones correctas y con tokens: las que fallan antes de llamar al
-- modelo no dicen cuanto cuesta una ejecucion de verdad. `input_total` incluye
-- lo leido de cache: Anthropic lo informa aparte, OpenAI ya dentro del input.

drop function if exists public.admin_ai_run_profile(timestamptz);
create or replace function public.admin_ai_run_profile(since timestamptz default null)
returns table (
  agent_code varchar,
  run_count bigint,
  avg_input_total numeric,
  avg_cache_read numeric,
  avg_output numeric
)
language sql
stable
set search_path = pg_catalog, public
as $$
  select
    ad.code::varchar,
    count(*),
    round(avg(case when ar.provider = 'openai' then ar.input_tokens else ar.input_tokens + ar.cache_read_tokens end), 0),
    round(avg(ar.cache_read_tokens), 0),
    round(avg(ar.output_tokens), 0)
  from public.agent_runs ar
  join public.agent_versions av on av.id = ar.agent_version_id
  join public.agent_definitions ad on ad.id = av.definition_id
  where ar.status = 'succeeded'
    and ar.input_tokens > 0
    and (since is null or ar.started_at >= since)
  group by ad.code;
$$;

revoke execute on function public.admin_ai_run_profile(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_run_profile(timestamptz) to service_role;
