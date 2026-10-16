-- A04 v11 = prompt v10 con el modelo con el que A04 corre de verdad.
-- La v10 se registró con claude-sonnet-5, pero en ejecución A04 usa
-- gpt-6-luna (ai-runtime: modelo del cliente o, sin él, gpt-6-luna para todo
-- agente salvo A02/A19). La evaluación de release fija el modelo de la
-- versión: evaluar sonnet-5 certificaba un modelo que nunca se usa, y además
-- Anthropic rechaza el esquema estricto completo ("compiled grammar is too
-- large"). La v10 ya tiene manifest y es inmutable, por eso va como v11.
-- Inactiva: activarla pasa por el gate de release. Idempotente.
insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active)
select id, 'v11', 'gpt-6-luna', 'a04_generador_tareas_system', 'v10', '["sql_select","search_knowledge"]'::jsonb, 'required_before_publish', false
from public.agent_definitions where code = 'a04_generador_tareas'
on conflict (definition_id, version) do nothing;
