-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Expose exact historical Camino versions to the consultant audience.
do $$
declare
  v_current public.agent_versions%rowtype;
  v_definition_id uuid;
  v_tools jsonb;
  v_new_id uuid;
begin
  select id into v_definition_id from public.agent_definitions
   where code='a09_copiloto_consultor';
  if v_definition_id is null then raise exception 'A09 definition is missing'; end if;
  select * into v_current from public.agent_versions
   where definition_id=v_definition_id and is_active=true
   order by created_at desc limit 1 for update;
  if not found then raise exception 'A09 active version is missing'; end if;
  if v_current.version='v23' then return; end if;
  if v_current.version<>'v22' then raise exception 'Unexpected A09 version: %',v_current.version; end if;
  select jsonb_agg(name order by name) into v_tools from (
    select distinct name from (
      select jsonb_array_elements_text(v_current.allowed_tools) as name
      union all select 'get_strategic_plan_version'
    ) as names
  ) as distinct_names;
  insert into public.agent_versions (
    definition_id,version,model,prompt_code,prompt_version,allowed_tools,
    approval_mode,output_schema_version,config,is_active
  ) values (
    v_definition_id,'v23',v_current.model,v_current.prompt_code,v_current.prompt_version,
    v_tools,v_current.approval_mode,v_current.output_schema_version,v_current.config,false
  ) returning id into v_new_id;
  perform public.promote_agent_version(v_new_id);
end;
$$;
