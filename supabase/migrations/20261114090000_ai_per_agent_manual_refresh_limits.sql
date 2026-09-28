-- Cada agente tiene su propio cupo de actualizaciones manuales por tienda y
-- día. Las filas ausentes usan el valor de respaldo del runtime (1000 durante
-- la fase de pruebas); solo platform_admin puede gestionar estos valores vía
-- API y la tabla no se expone a usuarios de la aplicación.
create table if not exists public.ai_agent_refresh_limits (
  agent_code varchar(80) primary key
    references public.agent_definitions (code) on delete cascade,
  daily_manual_refresh_limit integer not null default 1000,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_agent_refresh_limits_positive check (
    daily_manual_refresh_limit between 1 and 10000
  )
);

alter table public.ai_agent_refresh_limits enable row level security;
revoke all on table public.ai_agent_refresh_limits from anon, authenticated;
grant select, insert, update, delete on table public.ai_agent_refresh_limits to service_role;

comment on table public.ai_agent_refresh_limits is
  'Cupo diario de regeneraciones manuales por agente y organización. Solo lo gestiona el API de platform_admin.';
;
