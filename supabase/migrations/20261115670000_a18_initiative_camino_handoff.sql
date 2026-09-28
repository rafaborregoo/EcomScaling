-- A18 initiatives must carry a measurable contract and their exact Camino
-- parent into A17. They remain human-approved tasks, never automatic actions.
do $a18_handoff_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a18_plan_mensual_system' and version = 'v4'
  ) then
    raise exception 'A18_PROMPT_V4_REQUIRED_FOR_INITIATIVE_HANDOFF';
  end if;
end
$a18_handoff_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v5',
  p.content || E'\n\n13. INICIATIVA MENSUAL ESTRUCTURADA PARA A17\nCada propuesta kind="task" representa una iniciativa mensual accionable, no una fase nueva de Camino ni una garantia de crecimiento. En initiative_measurement, nombra una metrica y ventana de evaluacion; baseline y target deben ser valores numericos observados/justificados o null cuando no se conozcan: null nunca significa cero, y no inventes un objetivo. La unidad debe coincidir con la metrica (porcentaje, EUR, pedidos, etc.). Alinea rationale, evidence y expected_metric con esos valores y explicita comparabilidad/limitaciones.\nSi el contexto muestra hitos activos de Mi Camino, enlaza milestone_id al UUID exacto del hito que esta iniciativa apoya; no uses una etiqueta de fase, un hito completado ni un ID inferido. Si Camino no esta disponible o ningun hito encaja, usa milestone_id=null y describe la dependencia o la ausencia, sin inventar ni aceptar que el servidor asigne otro hito automaticamente. La iniciativa aprobada se transmitira a A17 con su hito, metrica, baseline/target, responsable y estado de aprobacion; A17 la desglosa en entregables semanales sin repetirla.\nRevisa el backlog y las dependencias antes de sumar trabajo. Si hay saturacion, bloqueos, iniciativas mensuales previas obsoletas o una propuesta hermana pendiente/rechazada, recomienda una sustitucion o revision aprobable en vez de acumular trabajo; preserva el historial y nunca declares aceptada una propuesta pendiente. Propón cero a tres iniciativas, sin minimo obligatorio. Conserva la comparacion entre ventanas equivalentes, menciona si el dato no cubre costes, estacionalidad/promociones o sincronizacion suficiente y no presentes el cambio entre periodos como causalidad.' ,
  encode(sha256(convert_to(p.content || E'\n\n13. INICIATIVA MENSUAL ESTRUCTURADA PARA A17\nCada propuesta kind="task" representa una iniciativa mensual accionable, no una fase nueva de Camino ni una garantia de crecimiento. En initiative_measurement, nombra una metrica y ventana de evaluacion; baseline y target deben ser valores numericos observados/justificados o null cuando no se conozcan: null nunca significa cero, y no inventes un objetivo. La unidad debe coincidir con la metrica (porcentaje, EUR, pedidos, etc.). Alinea rationale, evidence y expected_metric con esos valores y explicita comparabilidad/limitaciones.\nSi el contexto muestra hitos activos de Mi Camino, enlaza milestone_id al UUID exacto del hito que esta iniciativa apoya; no uses una etiqueta de fase, un hito completado ni un ID inferido. Si Camino no esta disponible o ningun hito encaja, usa milestone_id=null y describe la dependencia o la ausencia, sin inventar ni aceptar que el servidor asigne otro hito automaticamente. La iniciativa aprobada se transmitira a A17 con su hito, metrica, baseline/target, responsable y estado de aprobacion; A17 la desglosa en entregables semanales sin repetirla.\nRevisa el backlog y las dependencias antes de sumar trabajo. Si hay saturacion, bloqueos, iniciativas mensuales previas obsoletas o una propuesta hermana pendiente/rechazada, recomienda una sustitucion o revision aprobable en vez de acumular trabajo; preserva el historial y nunca declares aceptada una propuesta pendiente. Propón cero a tres iniciativas, sin minimo obligatorio. Conserva la comparacion entre ventanas equivalentes, menciona si el dato no cubre costes, estacionalidad/promociones o sincronizacion suficiente y no presentes el cambio entre periodos como causalidad.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a18_plan_mensual_system' and p.version = 'v4'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a18_plan_mensual');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v5', v.model, 'a18_plan_mensual_system', 'v5', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a18_plan_mensual' and v.version = 'v4'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;

-- A17 must receive A18's exact initiative parent/measurement handoff.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v7',
  p.content || E'\n\n15. DESGLOSE DE UNA INICIATIVA A18\nEl contexto de otros horizontes conserva milestone_id, estado de aprobacion y, si se proporciono, initiative_measurement (metrica, unidad, baseline, target y ventana). Si una iniciativa A18 esta aprobada/publicada y es pertinente, crea entregables semanales que mantengan exactamente su milestone_id; no sustituyas el UUID por una fase parecida ni conviertas baseline/target null en cero o en un objetivo inventado. Una propuesta A18 pendiente, rechazada u obsoleta no es un compromiso activo: no la dupliques ni la des por aprobada. Contrasta los indicadores con datos actuales y trata su medicion como hipotesis/ventana de seguimiento, no como prediccion.' ,
  encode(sha256(convert_to(p.content || E'\n\n15. DESGLOSE DE UNA INICIATIVA A18\nEl contexto de otros horizontes conserva milestone_id, estado de aprobacion y, si se proporciono, initiative_measurement (metrica, unidad, baseline, target y ventana). Si una iniciativa A18 esta aprobada/publicada y es pertinente, crea entregables semanales que mantengan exactamente su milestone_id; no sustituyas el UUID por una fase parecida ni conviertas baseline/target null en cero o en un objetivo inventado. Una propuesta A18 pendiente, rechazada u obsoleta no es un compromiso activo: no la dupliques ni la des por aprobada. Contrasta los indicadores con datos actuales y trata su medicion como hipotesis/ventana de seguimiento, no como prediccion.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a17_plan_semanal_system' and p.version = 'v6'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a17_plan_semanal');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v7', v.model, 'a17_plan_semanal_system', 'v7', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a17_plan_semanal' and v.version = 'v6'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
