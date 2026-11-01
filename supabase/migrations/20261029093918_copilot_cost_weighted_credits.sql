-- El campo histórico copilot_monthly_tokens conserva su nombre para no romper
-- altas de suscripciones. Desde esta migración su unidad comercial son créditos.
-- 200.000 créditos = 1 USD. No se reescriben costes históricos ni suscripciones.
comment on column public.service_subscriptions.copilot_monthly_tokens is
  'Cuota mensual de créditos del Copiloto (nombre histórico). 200000 créditos = 1 USD de coste API.';

create or replace function public.copilot_credit_usage(
  bank_organization_id uuid, desde timestamptz, hasta timestamptz
) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with runs as (
    select r.model, r.estimated_cost_usd,
      case when r.estimated_cost_usd >= 0
        then ceil(round(r.estimated_cost_usd::numeric * 200000, 8))::bigint else 0 end credits,
      (coalesce(r.input_tokens, 0) + coalesce(r.output_tokens, 0)
        + coalesce(r.cache_read_tokens, 0) + coalesce(r.cache_creation_tokens, 0)) > 0 has_usage
    from public.agent_runs r
    where r.trigger_type = 'chat'
      and r.started_at >= desde and r.started_at < hasta
      and r.actor_user_id is not null
      and public.copilot_bank_organization(r.actor_user_id, r.organization_id) = bank_organization_id
  ), by_model as (
    select model, count(*) runs, sum(credits) credits,
      coalesce(sum(estimated_cost_usd), 0) cost_usd
    from runs where has_usage group by model
  )
  select jsonb_build_object(
    'used', coalesce((select sum(credits) from runs), 0),
    'unpriced_runs', (select count(*) from runs where has_usage
      and (estimated_cost_usd is null or estimated_cost_usd < 0)),
    'by_model', coalesce((select jsonb_agg(jsonb_build_object(
      'model', model, 'runs', runs, 'credits', credits, 'cost_usd', cost_usd
    ) order by credits desc) from by_model), '[]'::jsonb)
  );
$$;
revoke all on function public.copilot_credit_usage(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.copilot_credit_usage(uuid, timestamptz, timestamptz) to service_role;
