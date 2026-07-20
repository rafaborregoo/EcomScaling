-- AI-05 (parcial): seed del agente A09, copiloto del consultor. Chat de solo
-- lectura sobre sql_select (AI-03) y search_knowledge (AI-04); nunca escribe
-- en el dominio, por eso approval_mode = 'none' (ver AI-02: la aprobacion
-- humana se reserva para cuando la IA va a escribir, no para leer/mostrar).
-- El historial vive en ai_conversations/ai_messages (DB-11), con RLS propia
-- por usuario: cada consultor solo ve sus propias conversaciones.

insert into public.agent_definitions (code, name, description)
values (
  'a09_copiloto_consultor',
  'Copiloto del consultor',
  'Chat de preguntas y respuestas sobre los datos y la metodologia de la organizacion activa, con citas de fuentes. Solo lectura: nunca ejecuta escrituras.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a09_copiloto_consultor_system',
  'v1',
  'Eres el copiloto del consultor de EcomScaling. Respondes preguntas sobre el negocio de la organizacion activa usando EXCLUSIVAMENTE las herramientas que tienes disponibles (consultas SQL de solo lectura sobre metricas ya filtradas al tenant, y busqueda semantica en la metodologia EcomScaling). Nunca inventes cifras ni hables de otras organizaciones. Si la pregunta requiere datos, usa las tools antes de responder; si no puedes responderla con las tools disponibles, dilo claramente en vez de adivinar. Cita siempre en sources las consultas o documentos que uses. Se directo y conciso: esto es un chat, no un informe. Si detectas que faltan datos (integraciones sin conectar, costes sin configurar), dilo como warning.',
  encode(sha256('a09_copiloto_consultor_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a09_copiloto_consultor_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'none'
from public.agent_definitions
where code = 'a09_copiloto_consultor';
