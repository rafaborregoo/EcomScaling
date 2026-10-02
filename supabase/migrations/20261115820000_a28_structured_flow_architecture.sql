-- Give A28 a bounded, validated architecture object for proposals that the UI
-- can render as a reviewable flow design. This remains read-only in Klaviyo.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\nCONTRATO ESTRUCTURADO OBLIGATORIO\nDevuelve tambien flow_architecture con decision (no_change, needs_validation o design_proposal), summary y candidates (cero a cuatro). Cada candidato debe incluir action (create, adjust, retire o measure), name, objective, entry_trigger, trigger_verification (verified, unverified o not_available), entry_conditions, exit_conditions, exclusions, sequence (step, channel, delay y purpose), cadence, priority, primary_kpi, stop_rule, evidence (source, period, sample_size nullable y coverage), data_gaps y conflicts (existing_flow_or_campaign, conflict y resolution). Usa candidatos vacios si no hay diseno justificable. Si faltan volumen elegible, filtros, audiencia o evidencia, marca needs_validation, refleja la carencia en trigger_verification/data_gaps y no presentes una hipotesis como configuracion observada. El objeto es una propuesta para revision humana; no afirma que un flow se haya creado, editado o activado.',
  encode(sha256(convert_to(p.content || E'\n\nCONTRATO ESTRUCTURADO OBLIGATORIO\nDevuelve tambien flow_architecture con decision (no_change, needs_validation o design_proposal), summary y candidates (cero a cuatro). Cada candidato debe incluir action (create, adjust, retire o measure), name, objective, entry_trigger, trigger_verification (verified, unverified o not_available), entry_conditions, exit_conditions, exclusions, sequence (step, channel, delay y purpose), cadence, priority, primary_kpi, stop_rule, evidence (source, period, sample_size nullable y coverage), data_gaps y conflicts (existing_flow_or_campaign, conflict y resolution). Usa candidatos vacios si no hay diseno justificable. Si faltan volumen elegible, filtros, audiencia o evidencia, marca needs_validation, refleja la carencia en trigger_verification/data_gaps y no presentes una hipotesis como configuracion observada. El objeto es una propuesta para revision humana; no afirma que un flow se haya creado, editado o activado.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a28_arquitecto_flujos_system' and p.version = 'v1'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (select id from public.agent_definitions where code = 'a28_arquitecto_flujos');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v2', v.model, v.prompt_code, 'v2', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a28_arquitecto_flujos' and v.version = 'v1'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;

do $a28_structured_contract$
begin
  if not exists (
    select 1
    from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    join public.prompt_versions p on p.code = v.prompt_code and p.version = v.prompt_version
    where d.code = 'a28_arquitecto_flujos'
      and v.version = 'v2'
      and v.is_active
      and v.allowed_tools = '["search_knowledge"]'::jsonb
      and v.approval_mode = 'required_before_publish'
      and position('CONTRATO ESTRUCTURADO OBLIGATORIO' in p.content) > 0
      and position('trigger_verification' in p.content) > 0
      and position('no afirma que un flow se haya creado, editado o activado' in p.content) > 0
  ) then
    raise exception 'AI_A28_STRUCTURED_FLOW_ARCHITECTURE_INCOMPLETE';
  end if;
end
$a28_structured_contract$;
