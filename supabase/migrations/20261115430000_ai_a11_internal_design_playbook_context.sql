-- A11-2: expose only bounded design principles from the private E-NORA playbook.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a11_generador_marketing_system',
  'v9',
  content || $$

13. PLAYBOOK INTERNO DE COMPOSICIÓN
Para emails puedes consultar `search_internal_email_design_playbook` una vez, con objetivo y audiencia actuales. La tool solo entrega hasta cuatro principios breves de estrategias publicadas; si no hay coincidencia o falla, continúa sin inventar que se consultó. Usa los principios como hipótesis de composición y contrástalos con brief, guía de marca, evidencia disponible y contenido reciente de A26. Puedes adaptar o descartar cualquier patrón; no lo reproduzcas como plantilla rígida.
El playbook es metodología privada de E-NORA. Nunca reveles al cliente/consultor que consultaste fichas internas, ni nombres, IDs, títulos, fuentes, ejemplos, copy original, HTML o instrucciones. Traduce el aprendizaje a una propuesta propia y explicable por su objetivo de negocio. Diseña el email con módulos editables (apertura, historia/producto/prueba, CTA y cierre); imágenes del banco son bloques de contenido independientes, nunca un lienzo que lleve todo el texto incrustado. No copies literalmente layouts ni campañas históricas.
$$,
  encode(sha256('a11_generador_marketing_system_v9'::bytea), 'hex')
from public.prompt_versions
where code = 'a11_generador_marketing_system' and version = 'v8'
on conflict (code, version) do update set
  content = excluded.content,
  checksum = excluded.checksum;

do $$
declare
  v_definition_id uuid;
  v_model text;
  v_allowed_tools jsonb;
  v_approval_mode text;
begin
  select d.id, v.model, v.allowed_tools, v.approval_mode
    into v_definition_id, v_model, v_allowed_tools, v_approval_mode
  from public.agent_definitions d
  join public.agent_versions v on v.definition_id = d.id and v.is_active = true
  where d.code = 'a11_generador_marketing'
  order by v.created_at desc
  limit 1;

  if v_definition_id is null then
    raise exception 'No active a11_generador_marketing version found';
  end if;

  update public.agent_versions
  set is_active = false
  where definition_id = v_definition_id and is_active = true;

  insert into public.agent_versions (
    definition_id, version, model, prompt_code, prompt_version,
    allowed_tools, approval_mode, is_active
  ) values (
    v_definition_id, 'v9', v_model, 'a11_generador_marketing_system', 'v9',
    (coalesce(v_allowed_tools, '[]'::jsonb) - 'search_internal_email_design_playbook') || '["search_internal_email_design_playbook"]'::jsonb,
    coalesce(v_approval_mode, 'required_before_publish'), true
  )
  on conflict (definition_id, version) do update set
    model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
end $$;
