-- Bind A09 conversation history and each agent run to the validated context
-- scope. Old threads remain legacy_unknown because their store cannot be
-- reconstructed safely from existing messages.
alter table public.ai_conversations
  add column if not exists scope_kind text not null default 'legacy_unknown',
  add column if not exists scope_store_id uuid;

alter table public.ai_conversations
  drop constraint if exists ai_conversations_scope_check;
alter table public.ai_conversations
  add constraint ai_conversations_scope_check check (
    (scope_kind = 'store' and scope_store_id is not null)
    or (scope_kind in ('organization', 'legacy_unknown') and scope_store_id is null)
  );

comment on column public.ai_conversations.scope_store_id is
  'Store scope captured at conversation creation. Intentionally has no FK: this immutable scope marker prevents history from becoming organization-wide if a store is disconnected or removed.';

comment on column public.ai_conversations.scope_kind is
  'organization, store, or legacy_unknown when existing history has no provable store scope.';

do $a09_scope_prompt_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a09_copiloto_consultor_system' and version = 'v8'
  ) then
    raise exception 'A09_PROMPT_V8_REQUIRED_FOR_SCOPE_CONFIRMATION';
  end if;
  if not exists (
    select 1
    from public.agent_versions av
    join public.agent_definitions ad on ad.id = av.definition_id
    where ad.code = 'a09_copiloto_consultor' and av.version = 'v13'
  ) then
    raise exception 'A09_AGENT_V13_REQUIRED_FOR_SCOPE_CONFIRMATION';
  end if;
end
$a09_scope_prompt_guard$;

with next_prompt as (
  select source.code,
    source.content || E'\n\nALCANCE Y PROCEDENCIA DE CADA RESPUESTA\nEl backend fija el alcance de las tools y valida la tienda activa antes de este turno. Usa las cifras de las tools, nunca los numeros de la vista ni la conversacion previa como dato actual. En toda afirmacion numerica cita en sources la herramienta/fuente, la tienda o alcance, el periodo y la cobertura/frescura cuando este disponible; si no puedes darlo, explica la limitacion. Si el usuario pide otra tienda o todas las tiendas pero el alcance de este turno es una tienda concreta, no consultes ni extrapoles: pide que cambie el selector e inicie una conversacion nueva para ese alcance. Si el backend entrega alcance agregado, responde solo con cifras agregadas; si el usuario pide una tienda concreta, solicita que la seleccione antes de consultar. Una conversacion pertenece al mismo alcance durante toda su vida. Las propuestas siguen pendientes de aprobacion humana.' as content
  from public.prompt_versions source
  where source.code = 'a09_copiloto_consultor_system' and source.version = 'v8'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v9', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a09_copiloto_consultor');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v14', v.model, v.prompt_code, 'v9', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a09_copiloto_consultor' and v.version = 'v13'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
