-- Permite activar varios agentes de IA para una misma organización cliente.
-- Conserva el agente que estuviera activo con el esquema anterior.
alter table public.organization_ai_agent_runtime_config
  add column if not exists active_agent_codes text[] not null default '{}'::text[];

update public.organization_ai_agent_runtime_config
set active_agent_codes = array[active_agent_code]
where cardinality(active_agent_codes) = 0
  and active_agent_code is not null;

comment on column public.organization_ai_agent_runtime_config.active_agent_codes is
  'Códigos de agentes de IA activos para la organización cliente; un array vacío significa que todos están desactivados.';
