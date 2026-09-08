-- Cambio de modelo pedido por Rafa (2026-07-27): los 6 agentes automaticos
-- (A01/A02/A04/A06/A08/A09) corrian sobre claude-opus-4-8; se migran a
-- claude-sonnet-5 (mas barato, `MODEL_PRICING` en packages/ai/src/index.ts ya
-- lo tenia tarifado: $3/$15 por MTok input/output vs $5/$25 de Opus).
-- Solo cambia `model` -- prompt/allowed_tools/approval_mode se mantienen
-- identicos a la version activa de cada agente, se reusa el mismo
-- prompt_code/prompt_version (sin insertar prompt_versions nuevo). Es
-- routing plano para todos los agentes a la vez, no por agente/organizacion
-- (eso sigue siendo AI-09 real, `planned`).

-- a01_analista_llamadas: v1 -> v2
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a01_analista_llamadas')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-sonnet-5', 'a01_analista_llamadas_system', 'v1', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a01_analista_llamadas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

-- a02_monitor_negocio: v4 -> v5
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v4';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a02_monitor_negocio_system', 'v4', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

-- a04_generador_tareas: v4 -> v5
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a04_generador_tareas')
  and version = 'v4';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a04_generador_tareas_system', 'v4', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

-- a06_planificador_stock: v5 -> v6
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v5';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v6', 'claude-sonnet-5', 'a06_planificador_stock_system', 'v5', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

-- a08_gestor_conocimiento: v1 -> v2
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a08_gestor_conocimiento')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-sonnet-5', 'a08_gestor_conocimiento_system', 'v1', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a08_gestor_conocimiento'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

-- a09_copiloto_consultor: v1 -> v2
update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a09_copiloto_consultor')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-sonnet-5', 'a09_copiloto_consultor_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'none'
from public.agent_definitions
where code = 'a09_copiloto_consultor'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
