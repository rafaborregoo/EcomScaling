-- AI-31: conservar plazos explícitos de las llamadas al materializar tareas.
-- Reutiliza el prompt v4 como base, sin duplicar manualmente sus instrucciones.

insert into public.prompt_versions (code, version, content, checksum)
select
  source.code,
  'v5',
  replace(
    replace(
      source.content,
      '- No inventes cifras, compromisos, responsables ni fechas.',
      '- No inventes cifras, compromisos, responsables ni fechas. En `due_hint`, conserva literalmente el plazo solo si se dijo en la llamada; usa null si no se menciono. No conviertas "el viernes", "la semana que viene" ni "antes de la proxima llamada" en fechas absolutas. Solo usa YYYY-MM-DD cuando esa fecha exacta se dijo explicitamente.'
    ),
    'proposed_tasks (title, description, priority, owner)',
    'proposed_tasks (title, description, priority, owner, due_hint; null si no se dijo)'
  ),
  encode(
    sha256(
      replace(
        replace(
          source.content,
          '- No inventes cifras, compromisos, responsables ni fechas.',
          '- No inventes cifras, compromisos, responsables ni fechas. En `due_hint`, conserva literalmente el plazo solo si se dijo en la llamada; usa null si no se menciono. No conviertas "el viernes", "la semana que viene" ni "antes de la proxima llamada" en fechas absolutas. Solo usa YYYY-MM-DD cuando esa fecha exacta se dijo explicitamente.'
        ),
        'proposed_tasks (title, description, priority, owner)',
        'proposed_tasks (title, description, priority, owner, due_hint; null si no se dijo)'
      )::bytea
    ),
    'hex'
  )
from public.prompt_versions source
where source.code = 'a01_analista_llamadas_system'
  and source.version = 'v4'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id = (
    select id from public.agent_definitions
    where code = 'a01_analista_llamadas'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select
  id,
  'v6',
  'claude-sonnet-5',
  'a01_analista_llamadas_system',
  'v5',
  '[]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a01_analista_llamadas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
;
