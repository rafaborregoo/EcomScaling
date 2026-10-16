-- Ajustes de plataforma por agente, que platform admin aplica desde Costes de IA:
--   runs_per_day: ejecuciones programadas al dia por cliente. El orquestador
--     escala su intervalo minimo en proporcion a la cadencia de diseno; 0 deja
--     de programarlo (sigue pudiendo lanzarse a mano). Nulo = diseno.
--   model: modelo por defecto del agente. Una eleccion por cliente (Clientes ›
--     agentes) sigue mandando sobre esto. Nulo = el por defecto del runtime.
-- Solo la escribe el API de platform_admin; ningun usuario de la app la lee.

create table if not exists public.platform_ai_agent_settings (
  agent_code varchar(80) primary key
    references public.agent_definitions (code) on delete cascade,
  runs_per_day numeric(6, 2),
  model varchar(80),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_ai_agent_settings
  drop constraint if exists platform_ai_agent_settings_runs_range;
alter table public.platform_ai_agent_settings
  add constraint platform_ai_agent_settings_runs_range check (runs_per_day is null or runs_per_day between 0 and 48);

alter table public.platform_ai_agent_settings
  drop constraint if exists platform_ai_agent_settings_model_known;
alter table public.platform_ai_agent_settings
  add constraint platform_ai_agent_settings_model_known check (
    model is null or model in ('claude-sonnet-5', 'claude-opus-5', 'gpt-6-sol', 'gpt-6-luna')
  );

alter table public.platform_ai_agent_settings enable row level security;
revoke all on table public.platform_ai_agent_settings from anon, authenticated;
grant select, insert, update, delete on table public.platform_ai_agent_settings to service_role;

comment on table public.platform_ai_agent_settings is
  'Cadencia (ejecuciones/dia por cliente) y modelo por defecto de cada agente, fijados por platform_admin en Costes de IA.';
