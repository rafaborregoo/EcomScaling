-- AI-11 fase 3: el generador de marketing pasa de claude-opus-4-8 a
-- claude-sonnet-5 (decisión de Rafa: más capacidad que 4-8, sin el coste de
-- Opus 5). Alinea a11 con a04/a06/a09, que ya usan sonnet-5.

update public.agent_versions
set model = 'claude-sonnet-5'
where definition_id = (
  select id from public.agent_definitions where code = 'a11_generador_marketing'
)
and is_active = true;
