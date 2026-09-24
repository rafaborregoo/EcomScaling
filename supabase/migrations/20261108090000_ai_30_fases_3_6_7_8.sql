-- AI-30 fases 3, 6, 7 y 8 (docs/ai/AI_ARCHITECTURE.md, seccion 7).
--
-- Mismo criterio que 20260909130000: columnas en las tablas que ya existen y
-- funciones SQL de lectura. Ninguna tabla nueva.
--
-- Fase 3 (prompt / skill / context tracking): el run guarda QUE prompt, QUE
--   herramientas y CUANTO contexto recibio el modelo. prompt_code/version se
--   copian de agent_versions al insertar (trigger), asi los 6 puntos que crean
--   runs lo heredan sin tocarlos y editar una version no reescribe el pasado.
--   system_prompt_hash es el SHA-256 del prompt EFECTIVO (politica runtime +
--   prompt + esquema SQL), que no es prompt_versions.content.
-- Fase 6 (memoria): una sustitucion deja rastro de quien sustituyo a quien.
-- Fase 7 (feedback humano): el rechazo lleva categoria.
-- Fase 8 (propuestas de mejora): los fallos y rechazos se agrupan por agente,
--   version y clase -- el "failure cluster" sale de una consulta.
--
-- Idempotente (CLAUDE.md): if not exists, drop antes de crear.

-- --------------------------------------------------------------------------
-- Fase 3
-- --------------------------------------------------------------------------

alter table public.agent_runs add column if not exists prompt_code varchar(120);
alter table public.agent_runs add column if not exists prompt_version varchar(50);
alter table public.agent_runs add column if not exists system_prompt_hash char(64);
alter table public.agent_runs add column if not exists declared_tools text[];
alter table public.agent_runs add column if not exists context_truncated boolean;

comment on column public.agent_runs.prompt_code is
  'Prompt del agente en el momento de la ejecucion (copiado de agent_versions al insertar). null = ejecucion anterior a AI-30 fase 3.';
comment on column public.agent_runs.system_prompt_hash is
  'SHA-256 del prompt de sistema efectivo enviado al modelo. Dos runs con el mismo hash recibieron exactamente las mismas instrucciones.';
comment on column public.agent_runs.declared_tools is
  'Herramientas declaradas al modelo tras el filtrado por permisos y conectores. Las usadas estan en agent_tool_calls.';
comment on column public.agent_runs.context_truncated is
  'true = el contexto se recorto por limite de tamano y el modelo vio menos evidencia. null = no registrado.';

create or replace function public.agent_runs_snapshot_prompt()
returns trigger
language plpgsql
as $$
begin
  if new.prompt_code is null then
    select av.prompt_code, av.prompt_version
      into new.prompt_code, new.prompt_version
    from public.agent_versions av
    where av.id = new.agent_version_id;
  end if;
  return new;
end;
$$;

alter function public.agent_runs_snapshot_prompt()
  set search_path = pg_catalog, public;

revoke all on function public.agent_runs_snapshot_prompt() from public;

drop trigger if exists agent_runs_snapshot_prompt on public.agent_runs;
create trigger agent_runs_snapshot_prompt
  before insert on public.agent_runs
  for each row execute function public.agent_runs_snapshot_prompt();

-- --------------------------------------------------------------------------
-- Fase 6
-- --------------------------------------------------------------------------

alter table public.knowledge_documents
  add column if not exists superseded_by uuid
  references public.knowledge_documents (id) on delete set null;

comment on column public.knowledge_documents.superseded_by is
  'Documento que sustituyo a este (status = superseded). Lo escribe enqueueMemoryIngestion al ingerir una version mas nueva de la misma fuente.';

create index if not exists knowledge_documents_superseded_by_idx
  on public.knowledge_documents (superseded_by)
  where superseded_by is not null;

-- --------------------------------------------------------------------------
-- Fase 7
-- --------------------------------------------------------------------------

alter table public.agent_approvals
  add column if not exists reason_category varchar(30);

alter table public.agent_approvals
  drop constraint if exists agent_approvals_reason_category;

alter table public.agent_approvals
  add constraint agent_approvals_reason_category
  check (
    reason_category is null
    or (
      decision = 'rejected'
      and reason_category in (
        'incorrecto', 'sin_evidencia', 'irrelevante',
        'incompleto', 'duplicado', 'otro'
      )
    )
  );

-- --------------------------------------------------------------------------
-- Fases 7 y 8: calidad por agente/version y fallos agrupados
-- --------------------------------------------------------------------------

drop function if exists public.admin_agent_quality_stats(timestamptz);
create or replace function public.admin_agent_quality_stats(since timestamptz)
returns table (
  agent_code varchar,
  agent_version varchar,
  run_count bigint,
  succeeded_count bigint,
  context_truncated_count bigint,
  approved_count bigint,
  rejected_count bigint
)
language sql
stable
as $$
  select
    ad.code,
    av.version,
    count(distinct ar.id),
    count(distinct ar.id) filter (where ar.status = 'succeeded'),
    count(distinct ar.id) filter (where ar.context_truncated),
    count(ap.id) filter (where ap.decision = 'approved'),
    count(ap.id) filter (where ap.decision = 'rejected')
  from public.agent_runs ar
  join public.agent_versions av on av.id = ar.agent_version_id
  join public.agent_definitions ad on ad.id = av.definition_id
  left join public.agent_outputs ao on ao.run_id = ar.id
  left join public.agent_approvals ap on ap.output_id = ao.id
  where ar.started_at >= since
  group by ad.code, av.version
  order by ad.code, av.version;
$$;

alter function public.admin_agent_quality_stats(timestamptz)
  set search_path = pg_catalog, public;

revoke all on function public.admin_agent_quality_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_agent_quality_stats(timestamptz) to service_role;

-- La clase de un fallo tecnico es su mensaje sin ids ni numeros, para que
-- "timeout tras 45000ms en run 1a2b..." y "timeout tras 45012ms en run 9f8e..."
-- caigan en el mismo grupo. La de un rechazo humano es su categoria.
drop function if exists public.admin_ai_failure_clusters(timestamptz);
create or replace function public.admin_ai_failure_clusters(since timestamptz)
returns table (
  agent_code varchar,
  agent_version varchar,
  source text,
  failure_class text,
  occurrences bigint,
  last_seen timestamptz,
  sample_run_id uuid
)
language sql
stable
as $$
  with failures as (
    select
      ad.code as agent_code,
      av.version as agent_version,
      'runtime'::text as source,
      ar.status || ': ' || coalesce(
        left(regexp_replace(ar.error_message, '[0-9a-f-]{8,}|[0-9]+', '#', 'gi'), 120),
        'sin mensaje'
      ) as failure_class,
      ar.started_at as seen_at,
      ar.id as run_id
    from public.agent_runs ar
    join public.agent_versions av on av.id = ar.agent_version_id
    join public.agent_definitions ad on ad.id = av.definition_id
    where ar.started_at >= since
      and ar.status in ('failed', 'rejected_output', 'budget_exceeded', 'timeout')
    union all
    select
      ad.code,
      av.version,
      'human_rejection'::text,
      coalesce(ap.reason_category, 'sin_categoria'),
      ap.decided_at,
      ar.id
    from public.agent_approvals ap
    join public.agent_outputs ao on ao.id = ap.output_id
    join public.agent_runs ar on ar.id = ao.run_id
    join public.agent_versions av on av.id = ar.agent_version_id
    join public.agent_definitions ad on ad.id = av.definition_id
    where ap.decided_at >= since
      and ap.decision = 'rejected'
  )
  select
    agent_code,
    agent_version,
    source,
    failure_class,
    count(*),
    max(seen_at),
    (array_agg(run_id order by seen_at desc))[1]
  from failures
  group by agent_code, agent_version, source, failure_class
  order by count(*) desc, max(seen_at) desc
  limit 50;
$$;

alter function public.admin_ai_failure_clusters(timestamptz)
  set search_path = pg_catalog, public;

revoke all on function public.admin_ai_failure_clusters(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_failure_clusters(timestamptz) to service_role;

-- Predicado de fecha de la rama de rechazos (la de runs ya usa el indice de
-- started_at existente).
create index if not exists agent_approvals_decided_at_idx
  on public.agent_approvals (decided_at);
