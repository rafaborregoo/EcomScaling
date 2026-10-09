-- A19 v11 corre con el modelo avanzado de OpenAI: no hay clave de Anthropic
-- operativa. El runtime ya elige gpt-6-sol para A19 cuando el cliente no tiene
-- modelo propio; esto deja la version del agente diciendo lo mismo.
update public.agent_versions v
set model = 'gpt-6-sol'
from public.agent_definitions d
where d.id = v.definition_id
  and d.code = 'a19_arquitecto_camino'
  and v.version = 'v11'
  and v.model is distinct from 'gpt-6-sol';
