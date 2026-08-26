-- AI-26: evidencia durable de evals por version de agente.
-- La evaluacion se ejecuta fuera de la peticion de usuario y se persiste con
-- service role. La lectura queda restringida a plataforma/consultoria; no se
-- expone a clientes ni se usa una fila de empresa ficticia.

create table public.agent_version_evaluations (
  id uuid primary key default gen_random_uuid(),
  agent_version_id uuid not null references public.agent_versions (id) on delete cascade,
  dataset_version varchar(80) not null,
  evaluation_mode varchar(30) not null,
  status varchar(20) not null,
  overall_score numeric(8, 6),
  scores jsonb not null default '{}'::jsonb,
  rates jsonb not null default '{}'::jsonb,
  evaluated_agent_codes jsonb not null default '[]'::jsonb,
  agent_eval_failures jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint agent_version_evaluations_mode check (
    evaluation_mode in ('offline', 'shadow', 'live')
  ),
  constraint agent_version_evaluations_status check (
    status in ('passed', 'failed', 'incomplete')
  ),
  constraint agent_version_evaluations_unique_run unique (
    agent_version_id, dataset_version, evaluation_mode
  )
);

create table public.agent_version_eval_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.agent_version_evaluations (id) on delete cascade,
  agent_code varchar(80) not null,
  passed boolean not null,
  checks integer not null default 0,
  failed jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_version_eval_results_unique_agent unique (evaluation_id, agent_code),
  constraint agent_version_eval_results_checks_nonnegative check (checks >= 0)
);

create index agent_version_evaluations_version_idx
  on public.agent_version_evaluations (agent_version_id, evaluated_at desc);
create index agent_version_eval_results_evaluation_idx
  on public.agent_version_eval_results (evaluation_id);

alter table public.agent_version_evaluations enable row level security;
alter table public.agent_version_eval_results enable row level security;

create policy "agent_version_evaluations_select_platform"
on public.agent_version_evaluations for select to authenticated
using (private.is_platform_admin());

create policy "agent_version_eval_results_select_platform"
on public.agent_version_eval_results for select to authenticated
using (
  private.is_platform_admin()
);

grant select on public.agent_version_evaluations to authenticated;
grant select on public.agent_version_eval_results to authenticated;

comment on table public.agent_version_evaluations is
  'Evidencia durable de release gate por version, dataset y modo de evaluacion (AI-26).';
comment on table public.agent_version_eval_results is
  'Resultado auditable por agente dentro de una evaluacion versionada (AI-26).';

-- La escritura se hace en una transaccion unica. El payload lo construye el
-- runner validado; no se concede INSERT directo a usuarios autenticados.
create or replace function private.record_agent_version_evaluation(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_evaluation_id uuid;
begin
  insert into public.agent_version_evaluations (
    agent_version_id,
    dataset_version,
    evaluation_mode,
    status,
    overall_score,
    scores,
    rates,
    evaluated_agent_codes,
    agent_eval_failures,
    evidence
  )
  values (
    (p_payload->'evaluation'->>'agent_version_id')::uuid,
    p_payload->'evaluation'->>'dataset_version',
    p_payload->'evaluation'->>'evaluation_mode',
    p_payload->'evaluation'->>'status',
    nullif(p_payload->'evaluation'->>'overall_score', '')::numeric,
    coalesce(p_payload->'evaluation'->'scores', '{}'::jsonb),
    coalesce(p_payload->'evaluation'->'rates', '{}'::jsonb),
    coalesce(p_payload->'evaluation'->'evaluated_agent_codes', '[]'::jsonb),
    coalesce(p_payload->'evaluation'->'agent_eval_failures', '[]'::jsonb),
    coalesce(p_payload->'evaluation'->'evidence', '{}'::jsonb)
  )
  on conflict (agent_version_id, dataset_version, evaluation_mode)
  do update set
    status = excluded.status,
    overall_score = excluded.overall_score,
    scores = excluded.scores,
    rates = excluded.rates,
    evaluated_agent_codes = excluded.evaluated_agent_codes,
    agent_eval_failures = excluded.agent_eval_failures,
    evidence = excluded.evidence,
    evaluated_at = now()
  returning id into v_evaluation_id;

  delete from public.agent_version_eval_results
  where agent_version_eval_results.evaluation_id = v_evaluation_id;

  insert into public.agent_version_eval_results (
    evaluation_id, agent_code, passed, checks, failed, metrics
  )
  select
    v_evaluation_id,
    item->>'agent_code',
    coalesce((item->>'passed')::boolean, false),
    coalesce((item->>'checks')::integer, 0),
    coalesce(item->'failed', '[]'::jsonb),
    coalesce(item->'metrics', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_payload->'results', '[]'::jsonb)) item;

  return v_evaluation_id;
end;
$$;

revoke all on function private.record_agent_version_evaluation(jsonb) from public;
grant execute on function private.record_agent_version_evaluation(jsonb) to service_role;
