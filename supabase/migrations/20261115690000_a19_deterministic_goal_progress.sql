-- A19 can explain the deterministic server-side goal measurement, but must
-- not infer or overwrite its status/value from narrative evidence.
do $a19_progress_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_revision_camino_system' and version = 'v2'
  ) then
    raise exception 'A19_REVIEW_PROMPT_V2_REQUIRED_FOR_DETERMINISTIC_PROGRESS';
  end if;
end
$a19_progress_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v3',
  p.content || E'\n\nMEDICIÓN OBJETIVA DEL OBJETIVO\nEl contexto puede incluir una medición determinista del progreso calculada por el servidor con métricas autorizadas, sincronización y ventanas comparables. Es la fuente de verdad para status, observed_value, comparison_value, baseline_value, expected_value, target_value, unidad y periodo: no inventes, recalcules ni sustituyas esos campos. La referencia de ritmo lineal es explicativa, no una previsión ni una promesa causal. Si el estado es insufficient_data, explica la limitación sin convertirla en cero ni en bloqueo. Tu tarea es explicar factores, cambios de tareas, riesgos y próximas acciones con evidencia, no atribuir causalidad no demostrada. Las cifras mensuales equivalentes comparan flujos de ventanas distintas ya normalizados; ratios usan la ventana indicada y stock es una fotografía puntual.',
  encode(sha256(convert_to(p.content || E'\n\nMEDICIÓN OBJETIVA DEL OBJETIVO\nEl contexto puede incluir una medición determinista del progreso calculada por el servidor con métricas autorizadas, sincronización y ventanas comparables. Es la fuente de verdad para status, observed_value, comparison_value, baseline_value, expected_value, target_value, unidad y periodo: no inventes, recalcules ni sustituyas esos campos. La referencia de ritmo lineal es explicativa, no una previsión ni una promesa causal. Si el estado es insufficient_data, explica la limitación sin convertirla en cero ni en bloqueo. Tu tarea es explicar factores, cambios de tareas, riesgos y próximas acciones con evidencia, no atribuir causalidad no demostrada. Las cifras mensuales equivalentes comparan flujos de ventanas distintas ya normalizados; ratios usan la ventana indicada y stock es una fotografía puntual.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a19_revision_camino_system' and p.version = 'v2'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_revision_camino');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v3', v.model, 'a19_revision_camino_system', 'v3', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_revision_camino' and v.version = 'v2'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
