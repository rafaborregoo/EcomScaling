-- Daily/weekly/monthly work is now anchored to the approved Camino and exact
-- milestone IDs. Outputs remain proposals; no task is written automatically.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v8',
  p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nUsa el bloque de Mi Camino activo de la misma tienda como objetivo padre: su meta y sus hitos aprobados son el norte, no una orden para inventar trabajo. A18 propone los pocos movimientos mensuales que empujan la meta; A17 convierte movimientos vigentes en entregables semanales; A04 propone pasos ejecutables hoy o atiende incidencias urgentes. No dupliques una iniciativa o entregable entre horizontes cambiando solo la fecha. Una urgencia diaria puede adelantarse, pero no se convierte por eso en estrategia mensual.\nCada propuesta debe indicar que resultado padre hace avanzar, o explicar por que es una incidencia independiente. Si un hito activo encaja claramente, devuelve su UUID exacto en `milestone_id`; utiliza solo IDs del bloque de Mi Camino de esta misma tienda. Si no hay Camino/hito adecuado, devuelve `milestone_id: null` y no inventes ni enlaces a otro. Prioriza el estado del hito y las tareas relacionadas: no repitas trabajo abierto, completado o pendiente de aprobacion como si fuera nuevo. Distingue propuestas hermanas pendientes, aprobadas, rechazadas y obsoletas. Si no hay una tarea con impacto verificable, `proposed_writes` vacio es una salida correcta.' ,
  encode(sha256((p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nUsa el bloque de Mi Camino activo de la misma tienda como objetivo padre: su meta y sus hitos aprobados son el norte, no una orden para inventar trabajo. A18 propone los pocos movimientos mensuales que empujan la meta; A17 convierte movimientos vigentes en entregables semanales; A04 propone pasos ejecutables hoy o atiende incidencias urgentes. No dupliques una iniciativa o entregable entre horizontes cambiando solo la fecha. Una urgencia diaria puede adelantarse, pero no se convierte por eso en estrategia mensual.\nCada propuesta debe indicar que resultado padre hace avanzar, o explicar por que es una incidencia independiente. Si un hito activo encaja claramente, devuelve su UUID exacto en `milestone_id`; utiliza solo IDs del bloque de Mi Camino de esta misma tienda. Si no hay Camino/hito adecuado, devuelve `milestone_id: null` y no inventes ni enlaces a otro. Prioriza el estado del hito y las tareas relacionadas: no repitas trabajo abierto, completado o pendiente de aprobacion como si fuera nuevo. Distingue propuestas hermanas pendientes, aprobadas, rechazadas y obsoletas. Si no hay una tarea con impacto verificable, `proposed_writes` vacio es una salida correcta.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a04_generador_tareas_system'
  and p.version = 'v7'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nConsulta el Camino activo de la misma tienda. A18 define los movimientos mensuales ligados a la meta; tu traduces solo los vigentes en entregables semanales verificables. No repitas una iniciativa mensual ni una tarea diaria con otro plazo. Identifica el hito padre; cuando un hito activo encaje claramente, devuelve su UUID exacto en `milestone_id` tomado del bloque de Mi Camino. Si no encaja, devuelve null. No uses IDs de otra tienda ni inventes uno. No dupliques trabajo abierto, completado, pendiente de aprobacion o ya descartado sin evidencia nueva; si no hay entregable semanal con valor defendible, devuelve proposed_writes vacio.' ,
  encode(sha256((p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nConsulta el Camino activo de la misma tienda. A18 define los movimientos mensuales ligados a la meta; tu traduces solo los vigentes en entregables semanales verificables. No repitas una iniciativa mensual ni una tarea diaria con otro plazo. Identifica el hito padre; cuando un hito activo encaje claramente, devuelve su UUID exacto en `milestone_id` tomado del bloque de Mi Camino. Si no encaja, devuelve null. No uses IDs de otra tienda ni inventes uno. No dupliques trabajo abierto, completado, pendiente de aprobacion o ya descartado sin evidencia nueva; si no hay entregable semanal con valor defendible, devuelve proposed_writes vacio.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a17_plan_semanal_system'
  and p.version = 'v1'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nConsulta el Camino activo de la misma tienda. Formula solo 1-3 movimientos estructurales del mes que hagan avanzar la meta aprobada; A17 debe poder convertirlos en entregables semanales y A04 en pasos diarios sin duplicarlos. Explica que hito padre impulsa cada movimiento; cuando uno encaje claramente, devuelve su UUID exacto en `milestone_id` tomado del bloque de Mi Camino. En otro caso devuelve null. Nunca uses un hito de otra tienda ni inventes un UUID. No presentes una propuesta hermana pendiente o descartada como compromiso aprobado; si faltan datos o capacidad, baja confianza y no fuerces una cuota de iniciativas.' ,
  encode(sha256((p.content || E'\n\n10. JERARQUIA A18 > A17 > A04 Y ENLACE A MI CAMINO\nConsulta el Camino activo de la misma tienda. Formula solo 1-3 movimientos estructurales del mes que hagan avanzar la meta aprobada; A17 debe poder convertirlos en entregables semanales y A04 en pasos diarios sin duplicarlos. Explica que hito padre impulsa cada movimiento; cuando uno encaje claramente, devuelve su UUID exacto en `milestone_id` tomado del bloque de Mi Camino. En otro caso devuelve null. Nunca uses un hito de otra tienda ni inventes un UUID. No presentes una propuesta hermana pendiente o descartada como compromiso aprobado; si faltan datos o capacidad, baja confianza y no fuerces una cuota de iniciativas.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a18_plan_mensual_system'
  and p.version = 'v1'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions
    where code in ('a04_generador_tareas', 'a17_plan_semanal', 'a18_plan_mensual')
  );

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v8', 'claude-sonnet-5', 'a04_generador_tareas_system', 'v8', '["sql_select","search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    is_active = true;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-sonnet-5', 'a17_plan_semanal_system', 'v2', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a17_plan_semanal'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    is_active = true;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-sonnet-5', 'a18_plan_mensual_system', 'v2', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a18_plan_mensual'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    is_active = true;
