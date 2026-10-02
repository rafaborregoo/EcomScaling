-- Configuración explícita del agente de IA por cliente.
-- La ausencia de fila significa que la organización no tiene agentes activos.
create table if not exists public.organization_ai_agent_runtime_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  active_agent_code text,
  model_id text not null default 'gpt-6-luna',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint organization_ai_agent_runtime_config_model_check
    check (model_id in (
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'gpt-6-luna',
      'gpt-6-sol'
    ))
);

alter table public.organization_ai_agent_runtime_config enable row level security;

revoke all on public.organization_ai_agent_runtime_config from anon, authenticated;
grant all on public.organization_ai_agent_runtime_config to service_role;

comment on table public.organization_ai_agent_runtime_config is
  'Un único agente de IA y modelo elegido por organización cliente; sin fila, todos los agentes están desactivados.';
