-- A04 v10: con un Camino aprobado el backlog tiene decenas de tareas con fecha
-- lejana y el planificador diario concluia "ya esta cubierto" sin consultar
-- nada (0 llamadas a herramientas, contexto truncado). Dos reglas nuevas:
--   * una tarea abierta con fecha lejana no cubre una urgencia de hoy;
--   * antes de devolver vacio, consulta el RAG y la lectura A02.
-- Idempotente: reaplicable si el esquema se ha tocado por fuera.
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v10', content, encode(sha256(content::bytea), 'hex')
from (
  select p.code, p.content || E'\n\n13. BACKLOG LEJANO Y CONSULTA OBLIGATORIA\nEl bloque de tareas abiertas separa `near_term` (con detalle) y `later` (solo titulares con fecha lejana). Una tarea de `later` NO cubre una urgencia de hoy: solo evita repetir el mismo titulo. Una tarea abierta solo cubre un hallazgo si vence en los proximos 3 dias o esta en curso; si el hallazgo es de severidad alta o critica y la tarea que lo cubre vence mas tarde, propon el primer paso ejecutable hoy (adelantarlo), citando la tarea existente en el rationale.\nANTES de devolver proposed_writes vacio debes: (a) llamar a search_knowledge con al menos una consulta construida desde los hallazgos de mayor severidad del diagnostico A02 y las alertas activas (por ejemplo stock bajo en best-sellers, medicion, margen), y (b) comprobar que cada hallazgo alto o critico tiene una tarea de near_term que lo cubre. Si lo has hecho y todo esta cubierto, dilo en answer nombrando que tareas lo cubren y cuando vencen; no basta con decir que ya hay trabajo abierto. Si search_knowledge falla o no devuelve material, dilo en warnings.' as content
  from public.prompt_versions p
  where p.code = 'a04_generador_tareas_system' and p.version = 'v9'
) v
on conflict (code, version) do nothing;

-- Se registra INACTIVA: el trigger require_agent_version_release_evidence exige
-- evidencia de release (eval offline/live + holdout del juez) para activar una
-- version. Activarla es un paso aparte (promote_agent_version), no de esta migracion.
insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active)
select id, 'v10', 'claude-sonnet-5', 'a04_generador_tareas_system', 'v10', '["sql_select","search_knowledge"]'::jsonb, 'required_before_publish', false
from public.agent_definitions where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode;
