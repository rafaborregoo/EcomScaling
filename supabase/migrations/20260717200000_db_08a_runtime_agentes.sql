-- DB-08a: runtime inicial de agentes IA (AI-00). Solo la parte de runtime del
-- spec DB-08; las tablas de llamadas (consulting_calls...) llegan con F8.
-- Principios AI-00: organization_id lo resuelve el backend (nunca el modelo),
-- toda ejecucion registra fuentes/coste/latencia/resultado, las salidas se
-- validan contra schema y las escrituras propuestas requieren aprobacion.
-- Lectura via RLS; escritura solo via service role.

create table if not exists public.agent_definitions (
  id uuid primary key default gen_random_uuid(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null,
  version varchar(50) not null,
  content text not null,
  checksum varchar(64) not null,
  created_at timestamptz not null default now(),
  constraint prompt_versions_unique unique (code, version)
);

create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.agent_definitions (id) on delete cascade,
  version varchar(50) not null,
  model varchar(120) not null,
  prompt_code varchar(120) not null,
  prompt_version varchar(50) not null,
  allowed_tools jsonb not null default '[]',
  approval_mode varchar(40) not null default 'required_before_publish',
  output_schema_version varchar(50) not null default 'v1',
  config jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint agent_versions_unique unique (definition_id, version),
  constraint agent_versions_approval_mode check (
    approval_mode in ('none', 'required_before_write', 'required_before_publish')
  )
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_version_id uuid not null references public.agent_versions (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete set null,
  trigger_type varchar(40) not null,
  objective text not null,
  time_range jsonb,
  entity_ids jsonb,
  status varchar(30) not null default 'running',
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_runs_trigger_type check (
    trigger_type in ('chat', 'call', 'cron', 'alert', 'webhook', 'manual')
  ),
  constraint agent_runs_status check (status in ('running', 'succeeded', 'failed', 'rejected_output'))
);

create table if not exists public.agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  position integer not null,
  step_type varchar(40) not null,
  summary text,
  payload jsonb,
  duration_ms integer,
  created_at timestamptz not null default now(),
  constraint agent_run_steps_unique_position unique (run_id, position)
);

create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tool_name varchar(120) not null,
  input jsonb,
  output jsonb,
  is_error boolean not null default false,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_level varchar(4) not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint agent_context_snapshots_level check (context_level in ('C0', 'C1', 'C2', 'C3', 'C4'))
);

create table if not exists public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  schema_version varchar(50) not null default 'v1',
  output jsonb not null,
  approval_required boolean not null default true,
  status varchar(30) not null default 'pending_approval',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_outputs_status check (
    status in ('draft', 'pending_approval', 'approved', 'rejected', 'published')
  ),
  constraint agent_outputs_unique_run unique (run_id)
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.agent_outputs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  decision varchar(20) not null,
  decided_by uuid references public.profiles (id) on delete set null,
  reason text,
  decided_at timestamptz not null default now(),
  constraint agent_approvals_decision check (decision in ('approved', 'rejected'))
);

-- Auditoria de consultas del futuro SQL Gateway (AI-03): cada query queda
-- registrada con tablas, filas y duracion desde el primer dia.
create table if not exists public.agent_query_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sql_text text not null,
  tables_used jsonb,
  rows_returned integer,
  duration_ms integer,
  was_rejected boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists agent_versions_definition_id_idx on public.agent_versions (definition_id);
create index if not exists agent_runs_organization_id_idx on public.agent_runs (organization_id);
create index if not exists agent_runs_agent_version_id_idx on public.agent_runs (agent_version_id);
create index if not exists agent_runs_status_idx on public.agent_runs (status);
create index if not exists agent_runs_started_at_idx on public.agent_runs (started_at);
create index if not exists agent_run_steps_run_id_idx on public.agent_run_steps (run_id);
create index if not exists agent_run_steps_organization_id_idx on public.agent_run_steps (organization_id);
create index if not exists agent_tool_calls_run_id_idx on public.agent_tool_calls (run_id);
create index if not exists agent_tool_calls_organization_id_idx on public.agent_tool_calls (organization_id);
create index if not exists agent_context_snapshots_run_id_idx on public.agent_context_snapshots (run_id);
create index if not exists agent_context_snapshots_organization_id_idx on public.agent_context_snapshots (organization_id);
create index if not exists agent_outputs_organization_id_idx on public.agent_outputs (organization_id);
create index if not exists agent_outputs_status_idx on public.agent_outputs (status);
create index if not exists agent_approvals_output_id_idx on public.agent_approvals (output_id);
create index if not exists agent_approvals_organization_id_idx on public.agent_approvals (organization_id);
create index if not exists agent_query_runs_run_id_idx on public.agent_query_runs (run_id);
create index if not exists agent_query_runs_organization_id_idx on public.agent_query_runs (organization_id);

drop trigger if exists set_agent_definitions_updated_at on public.agent_definitions;
create trigger set_agent_definitions_updated_at
before update on public.agent_definitions
for each row execute function private.set_updated_at();

drop trigger if exists set_agent_outputs_updated_at on public.agent_outputs;
create trigger set_agent_outputs_updated_at
before update on public.agent_outputs
for each row execute function private.set_updated_at();

alter table public.agent_definitions enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.agent_versions enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_run_steps enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_context_snapshots enable row level security;
alter table public.agent_outputs enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_query_runs enable row level security;

drop policy if exists "agent_definitions_select_all" on public.agent_definitions;
create policy "agent_definitions_select_all" on public.agent_definitions for select to authenticated using (true);

drop policy if exists "prompt_versions_select_all" on public.prompt_versions;
create policy "prompt_versions_select_all" on public.prompt_versions for select to authenticated using (true);

drop policy if exists "agent_versions_select_all" on public.agent_versions;
create policy "agent_versions_select_all" on public.agent_versions for select to authenticated using (true);

drop policy if exists "agent_runs_select_authorized" on public.agent_runs;
create policy "agent_runs_select_authorized" on public.agent_runs for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "agent_run_steps_select_authorized" on public.agent_run_steps;
create policy "agent_run_steps_select_authorized" on public.agent_run_steps for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "agent_tool_calls_select_authorized" on public.agent_tool_calls;
create policy "agent_tool_calls_select_authorized" on public.agent_tool_calls for select to authenticated
using (private.can_access_org(organization_id));

-- Snapshots de contexto pueden contener datos amplios: solo consultores/admins.
drop policy if exists "agent_context_snapshots_select_consultants" on public.agent_context_snapshots;
create policy "agent_context_snapshots_select_consultants" on public.agent_context_snapshots for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

-- El cliente solo ve salidas ya aprobadas/publicadas; consultores/admins ven todas.
drop policy if exists "agent_outputs_select_authorized" on public.agent_outputs;
create policy "agent_outputs_select_authorized" on public.agent_outputs for select to authenticated
using (
  private.can_access_org(organization_id)
  and (
    status in ('approved', 'published')
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

drop policy if exists "agent_approvals_select_consultants" on public.agent_approvals;
create policy "agent_approvals_select_consultants" on public.agent_approvals for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "agent_query_runs_select_consultants" on public.agent_query_runs;
create policy "agent_query_runs_select_consultants" on public.agent_query_runs for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.agent_definitions to authenticated;
grant select on public.prompt_versions to authenticated;
grant select on public.agent_versions to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.agent_run_steps to authenticated;
grant select on public.agent_tool_calls to authenticated;
grant select on public.agent_context_snapshots to authenticated;
grant select on public.agent_outputs to authenticated;
grant select on public.agent_approvals to authenticated;
grant select on public.agent_query_runs to authenticated;

comment on table public.agent_runs is 'Ejecuciones de agentes IA con coste, latencia y resultado (AI-00: trazabilidad completa).';
comment on table public.agent_outputs is 'Salida estructurada validada contra schema; requiere aprobacion antes de publicar al cliente segun approval_mode.';
comment on table public.agent_query_runs is 'Auditoria del SQL Gateway: cada consulta con tablas, filas y duracion.';

-- Seed: agente A02-lite (resumen ejecutivo del negocio) con su prompt versionado.
insert into public.agent_definitions (code, name, description)
values (
  'a02_monitor_negocio',
  'Monitor del negocio',
  'Analiza las metricas sincronizadas y genera un diagnostico ejecutivo con hallazgos y recomendaciones.'
)
on conflict (code) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v1',
  'Eres el consultor IA de EcomScaling para marcas de ecommerce. Analiza exclusivamente los datos que se te entregan en el contexto (metricas ya verificadas de la organizacion activa). Nunca inventes cifras ni hables de otras organizaciones. Cada hallazgo debe citar la metrica y el periodo del que sale. Se directo, cuantitativo y accionable; prioriza margen y beneficio neto sobre facturacion bruta. Si faltan datos (costes sin configurar, integraciones sin conectar), dilo como warning en vez de rellenar huecos.',
  encode(sha256('a02_monitor_negocio_system_v1'::bytea), 'hex')
)
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v1', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
