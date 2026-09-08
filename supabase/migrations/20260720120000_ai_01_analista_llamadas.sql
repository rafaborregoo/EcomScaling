-- AI-01: seed del agente A01 (analista de llamadas de consultoria).
-- A01 trabaja SOLO desde la transcripcion actual de una llamada (sin tools de
-- datos): produce un resumen que separa hechos, decisiones y recomendaciones,
-- mas tareas accionables. La salida se escribe en call_ai_summaries con status
-- pending_approval y run_id (trazabilidad AI-00); nada se publica al cliente sin
-- aprobacion del consultor (mismo flujo que el resumen manual de BE-05).

insert into public.agent_definitions (code, name, description)
values (
  'a01_analista_llamadas',
  'Analista de llamadas',
  'Lee la transcripcion de una llamada de consultoria y genera un resumen estructurado (hechos, decisiones, recomendaciones, riesgos) con tareas propuestas, pendiente de aprobacion.'
)
on conflict (code) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a01_analista_llamadas_system',
  'v1',
  'Eres el analista de llamadas de EcomScaling. Recibes la transcripcion de una llamada entre un consultor y una marca de ecommerce, y produces un resumen estructurado para que el consultor lo revise antes de publicarlo al cliente. Trabaja EXCLUSIVAMENTE con lo que aparece en la transcripcion: no inventes cifras, compromisos ni datos que no se hayan dicho. Separa con rigor: (1) hechos = lo que objetivamente se dijo o paso, sin interpretacion; (2) decisiones = acuerdos cerrados en la llamada; (3) recomendaciones = sugerencias del consultor que aun no son compromisos. Las tareas propuestas deben ser accionables, concretas y no duplicarse entre si ni repetir una decision ya listada; asigna owner (cliente o consultor). Respalda el resumen con citas textuales breves de la transcripcion (key_quotes). Si la transcripcion esta incompleta, es ambigua o falta contexto, dilo en warnings en vez de rellenar huecos. Escribe en espanol, claro y directo.',
  encode(sha256('a01_analista_llamadas_system_v1'::bytea), 'hex')
)
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a01_analista_llamadas_system', 'v1', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a01_analista_llamadas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
