-- A21 now receives Shopify connector freshness in the exact selected-store scope.
do $a21_sync_coverage_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a21_adquisicion_shopify_system' and version = 'v4'
  ) or not exists (
    select 1
    from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a21_adquisicion_shopify' and v.version = 'v5'
  ) then
    raise exception 'A21_V5_REQUIRED_FOR_STORE_SYNC_COVERAGE';
  end if;
end
$a21_sync_coverage_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v5',
  p.content || E'\n\nSINCRONIZACION DE SHOPIFY POR TIENDA\nEl bloque "Estado de conexión y sincronización Shopify" describe la conexión de la tienda activa (o cada tienda activa si el alcance es agregado), su ultima sincronizacion conocida y cualquier error posterior. La frescura del conector no prueba que cada metrica cubra toda la ventana: para el embudo manda days_with_funnel_data/requested_days y para las demas fuentes declara desconocida la frescura si no hay evidencia especifica. Si la lectura de cobertura falla, no infieras conexion, sincronizacion ni ausencia de actividad.',
  encode(sha256(convert_to(
    p.content || E'\n\nSINCRONIZACION DE SHOPIFY POR TIENDA\nEl bloque "Estado de conexión y sincronización Shopify" describe la conexión de la tienda activa (o cada tienda activa si el alcance es agregado), su ultima sincronizacion conocida y cualquier error posterior. La frescura del conector no prueba que cada metrica cubra toda la ventana: para el embudo manda days_with_funnel_data/requested_days y para las demas fuentes declara desconocida la frescura si no hay evidencia especifica. Si la lectura de cobertura falla, no infieras conexion, sincronizacion ni ausencia de actividad.',
    'UTF8'
  )), 'hex')
from public.prompt_versions p
where p.code = 'a21_adquisicion_shopify_system' and p.version = 'v4'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.agent_versions as existing_version
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v6', v.model, 'a21_adquisicion_shopify_system', 'v5',
  v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, v.is_active
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a21_adquisicion_shopify' and v.version = 'v5'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = existing_version.is_active or excluded.is_active;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.version <> 'v6'
  and av.definition_id = (select id from public.agent_definitions where code = 'a21_adquisicion_shopify');

do $a21_sync_coverage_verify$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a21_adquisicion_shopify_system'
      and version = 'v5'
      and position('SINCRONIZACION DE SHOPIFY POR TIENDA' in content) > 0
  ) or not exists (
    select 1
    from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a21_adquisicion_shopify'
      and v.version = 'v6'
      and v.prompt_version = 'v5'
      and v.allowed_tools = (select prior.allowed_tools from public.agent_versions prior where prior.definition_id = d.id and prior.version = 'v5')
  ) then
    raise exception 'A21_STORE_SYNC_COVERAGE_VERIFICATION_FAILED';
  end if;
end
$a21_sync_coverage_verify$;
