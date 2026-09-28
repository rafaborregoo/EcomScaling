-- A27 emits a decision-ready sequence proposal before A11 creates any draft.
-- The application must show this contract and require an explicit user action
-- before creating/scheduling drafts.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v4',
  p.content || E'\n\n9. DECISION Y CRITERIOS DE LA PROPUESTA\nDevuelve una decision util para que la persona pueda revisarla antes de crear borradores. Explica la estrategia elegida, por que encaja con el objetivo y la audiencia, y hasta cuatro alternativas relevantes descartadas con su motivo. No generes alternativas de relleno. Evalua la cadencia pedida: conserva las fechas indicadas en los emails, pero recomienda reducir o espaciar envios cuando la evidencia, la fatiga o la cobertura lo justifiquen. Indica claramente si la propuesta requiere aprobacion expresa.\nDefine una hipotesis comprobable, una metrica primaria, metricas de proteccion, un diseno de prueba y una regla de decision. Si no hay muestra, instrumentacion o volumen suficiente, usa evidence_status=insufficient_evidence y no declares ganador. No confundas atribucion con causalidad ni optimices aperturas por defecto.\nIncluye criterios observables de exito y de parada, limites de confianza y una regla de salida/fin de secuencia. Asigna sequence_role a cada correo para explicar su funcion narrativa distinta. No inventes descuentos, stock, testimonios, urgencia ni cifras; si faltan datos, dilo y evita convertir una recomendacion en hecho. La interfaz mostrara esta propuesta y pedira confirmacion humana antes de llamar a A11 o guardar/programar borradores.' ,
  encode(sha256((p.content || E'\n\n9. DECISION Y CRITERIOS DE LA PROPUESTA\nDevuelve una decision util para que la persona pueda revisarla antes de crear borradores. Explica la estrategia elegida, por que encaja con el objetivo y la audiencia, y hasta cuatro alternativas relevantes descartadas con su motivo. No generes alternativas de relleno. Evalua la cadencia pedida: conserva las fechas indicadas en los emails, pero recomienda reducir o espaciar envios cuando la evidencia, la fatiga o la cobertura lo justifiquen. Indica claramente si la propuesta requiere aprobacion expresa.\nDefine una hipotesis comprobable, una metrica primaria, metricas de proteccion, un diseno de prueba y una regla de decision. Si no hay muestra, instrumentacion o volumen suficiente, usa evidence_status=insufficient_evidence y no declares ganador. No confundas atribucion con causalidad ni optimices aperturas por defecto.\nIncluye criterios observables de exito y de parada, limites de confianza y una regla de salida/fin de secuencia. Asigna sequence_role a cada correo para explicar su funcion narrativa distinta. No inventes descuentos, stock, testimonios, urgencia ni cifras; si faltan datos, dilo y evita convertir una recomendacion en hecho. La interfaz mostrara esta propuesta y pedira confirmacion humana antes de llamar a A11 o guardar/programar borradores.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a27_planificador_mailing_system'
  and p.version = 'v3'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (select id from public.agent_definitions where code = 'a27_planificador_mailing');

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select
  id,
  'v4',
  'claude-sonnet-5',
  'a27_planificador_mailing_system',
  'v4',
  '["data_coverage","search_knowledge","get_organization_profile","get_financial_settings","get_strategic_plan","get_current_milestone","list_open_alerts","list_open_tasks","get_task_history","get_call_history","klaviyo_email_content","klaviyo_measurement_health"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a27_planificador_mailing'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
