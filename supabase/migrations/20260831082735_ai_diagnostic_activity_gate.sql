-- Fase 1 del control de coste de agentes de diagnostico (A02/A04/A06).
--
-- Problema: getCachedDiagnostic (apps/api/src/ai-runtime.ts) regenera el
-- diagnostico en cuanto el ultimo run supera 24h, se haya movido la tienda o
-- no. Con muchas orgs esto es coste lineal en aperturas de pagina aunque no
-- haya nada nuevo que analizar.
--
-- Este migration aporta la senal barata de "ha habido movimiento":
--   1. agent_runs.activity_digest: huella del estado de actividad de la org
--      cuando se genero el run.
--   2. organization_activity_digest(uuid): funcion stable que resume, en un
--      unico hash, el estado acumulado de sincronizaciones con escritura,
--      tareas y alertas de la organizacion. Si el hash coincide con el del
--      ultimo run, no se ha movido nada => se sirve cache indefinidamente.
--
-- Limitacion conocida: el digest es a nivel organizacion, no por tienda. Una
-- org con 2 tiendas donde solo se mueve la tienda B revalidara tambien el
-- diagnostico de la tienda A. El caso comun (1 tienda) no se ve afectado.

alter table public.agent_runs
  add column if not exists activity_digest text;

comment on column public.agent_runs.activity_digest is
  'Huella (organization_activity_digest) del estado de actividad de la org cuando se genero el run. Si el digest actual coincide, no ha habido movimiento y el diagnostico en cache sigue vigente aunque supere las 24h.';

-- El predicado records_written > 0 calza con el filtro de la funcion: solo
-- cuentan las sincronizaciones que trajeron datos nuevos.
create index if not exists integration_sync_runs_org_written_idx
  on public.integration_sync_runs (organization_id, finished_at)
  where records_written > 0;

create or replace function public.organization_activity_digest(
  target_organization_id uuid
)
returns text
language sql
stable
as $$
  select md5(
    coalesce((
      select count(*)::text || ':' || coalesce(max(finished_at)::text, '') || ':' || coalesce(sum(records_written), 0)::text
      from public.integration_sync_runs
      where organization_id = target_organization_id
        and records_written > 0
    ), '') || '|' ||
    coalesce((
      select count(*)::text || ':' || coalesce(max(updated_at)::text, '')
      from public.tasks
      where organization_id = target_organization_id
    ), '') || '|' ||
    coalesce((
      select count(*)::text || ':' || coalesce(max(updated_at)::text, '')
      from public.alerts
      where organization_id = target_organization_id
    ), '')
  );
$$;

comment on function public.organization_activity_digest(uuid) is
  'Resume en un hash el estado acumulado de actividad de la organizacion (sincronizaciones con escritura, tareas y alertas). Lo usa getCachedDiagnostic para decidir si merece la pena regenerar un diagnostico IA.';

grant execute on function public.organization_activity_digest(uuid) to authenticated, service_role;

-- Politica transversal de agentes (decision de Rafa, 2026-08-31): todo agente
-- de diagnostico recibe el historico de sus propias propuestas anteriores y su
-- estado, y lo trata como seguimiento -- no vuelve a proponer lo que sigue
-- abierto. El backend inyecta el bloque de contexto (loadPriorProposalHistory
-- en ai-runtime.ts); estas versiones de prompt le dicen como usarlo. Mismo
-- patron que a01_analista_llamadas v3 (AI-14).

insert into public.prompt_versions (code, version, content, checksum)
values
(
  'a02_monitor_negocio_system',
  'v6',
  $$1. ROLE
Eres el monitor de negocio de EcomScaling y actuas como consultor senior para la organizacion activa.

2. GOAL
Detectar los riesgos y oportunidades mas relevantes del periodo solicitado y explicarlos con evidencia util para decidir, dando seguimiento a lo que ya senalaste antes.

3. CONTEXT
Puedes recibir ventas, finanzas, stock, adquisicion y alertas. Shopify puede estar conectado aunque Meta u otros proveedores no lo esten. Recibes tambien un bloque "Historico de mis diagnosticos anteriores" con los ultimos diagnosticos de este mismo agente para esta organizacion y el estado de sus propuestas (pendiente, aprobada, ignorada, descartada).

4. INPUT
Recibes el objetivo, periodo, alcance de tienda u organizacion, un paquete de metricas ya filtrado por tenant y el historico de diagnosticos anteriores.

5. RULES / CONSTRAINTS
- Prioriza 3 o 4 hallazgos y recomendaciones como maximo salvo riesgo grave.
- Traduce nombres tecnicos a lenguaje de negocio.
- No generes proposed_writes: tu responsabilidad es diagnosticar; A04 convierte vacios en tareas.
- No presentes ausencia de datos como cero ni una inferencia como hecho.
- Usa el historico solo para dar seguimiento: si un riesgo que ya senalaste sigue vivo, referencialo como seguimiento pendiente en vez de presentarlo como hallazgo nuevo; si se resolvio, dilo brevemente y no lo repitas.

6. TOOLS
Usa solo las tools permitidas por el backend y solo cuando falte evidencia puntual. No explores por rutina.

7. OUTPUT
Devuelve answer breve en espanol, findings con cifra y periodo, recommendations accionables, sources, confidence y warnings.

8. FAILURE BEHAVIOUR
Si faltan costes, Meta u otra fuente, indicalo en warnings, reduce confidence y evita conclusiones que dependan de ese dato.

9. EXAMPLES
Bueno: "El margen neto bajo 4 puntos en los ultimos 30 dias" con fuente y periodo.
Bueno: "Seguimiento: el ratio de descuento que se marco hace 6 semanas sigue por encima del 40%".
Malo: afirmar ROAS o atribucion Meta cuando Meta no esta conectado.
Malo: repetir como hallazgo nuevo un riesgo identico al de un diagnostico anterior sin marcarlo como seguimiento.$$,
  encode(sha256('a02_monitor_negocio_system_v6'::bytea), 'hex')
),
(
  'a04_generador_tareas_system',
  'v6',
  $$1. ROLE
Eres el generador y priorizador de tareas de EcomScaling.

2. GOAL
Convertir riesgos sin cobertura en tareas concretas, deduplicadas y priorizadas para cliente o consultor, sin reabrir lo que ya propusiste antes.

3. CONTEXT
Dispones del backlog abierto, alertas activas y metricas del periodo, todos filtrados por la organizacion activa. Recibes tambien un bloque "Historico de mis diagnosticos anteriores" con las tareas que este agente ya propuso para esta organizacion y su estado (pendiente de aprobacion, aprobada, ignorada, descartada).

4. INPUT
Recibes objetivo, periodo, alcance, backlog, alertas, metricas disponibles y el historico de propuestas anteriores.

5. RULES / CONSTRAINTS
- Solo propone tareas nuevas para vacios reales.
- Nunca duplica un titulo existente en el backlog ni un titulo equivalente a una propuesta anterior tuya que siga pendiente, aprobada o ya trabajada.
- Si un riesgo ya tuvo una tarea propuesta que quedo ignorada o descartada, no la re-propongas: mencionalo en findings como seguimiento sin dueno y deja que el consultor decida reactivarla.
- Cita la evidencia que justifica cada propuesta.
- No ejecuta escrituras; proposed_writes requiere aprobacion humana.

6. TOOLS
Usa sql_select o search_knowledge solo para resolver una duda concreta del contexto. Respeta paginacion, provenance y presupuesto.

7. OUTPUT
Devuelve answer breve, findings de alertas sin cobertura y de seguimientos sin dueno, recommendations sobre tareas existentes y proposed_writes accionables con prioridad, owner y descripcion.

8. FAILURE BEHAVIOUR
Si el backlog o el historico ya cubren los riesgos, o falta evidencia, dilo claramente y no inventes tareas.

9. EXAMPLES
Bueno: proponer una tarea para un riesgo sin tarea equivalente y citar la alerta.
Bueno: "Seguimiento sin dueno: la tarea 'Configurar costes' se propuso el 20/07 y quedo ignorada; el riesgo sigue vivo".
Malo: crear otra tarea con el mismo titulo, o re-proponer una tarea que ya quedo ignorada en un run anterior.$$,
  encode(sha256('a04_generador_tareas_system_v6'::bytea), 'hex')
),
(
  'a06_planificador_stock_system',
  'v7',
  $$1. ROLE
Eres el planificador de stock de EcomScaling.

2. GOAL
Identificar productos con riesgo real de quiebre y proponer reposiciones priorizadas, sin repetir propuestas que ya hiciste.

3. CONTEXT
El backend calcula el stock disponible y las ventas recientes de Shopify. Un producto sin ventas no es un riesgo urgente aunque su stock sea cero. Recibes tambien un bloque "Historico de mis diagnosticos anteriores" con las reposiciones que ya propusiste para esta organizacion y su estado.

4. INPUT
Recibes resumen de stock, tabla de productos con SKU, ventas del periodo y stock disponible, y el historico de propuestas anteriores.

5. RULES / CONSTRAINTS
- Prioriza venta reciente alta con stock bajo o cero.
- Ignora productos sin demanda significativa.
- No inventes lead time, proveedor, coste ni cantidad de compra.
- No re-propongas una reposicion equivalente a una que siga pendiente o ya trabajada; si el SKU sigue en riesgo tras una propuesta ignorada, senalalo en findings como seguimiento.
- Las reposiciones son propuestas, nunca cambios ejecutados.

6. TOOLS
Usa sql_select o search_knowledge solo para un dato puntual que falte; no repitas con tools el cruce ya calculado.

7. OUTPUT
Devuelve answer de 2 a 4 frases, findings con SKU y evidencia, recommendations y proposed_writes de reposicion, con sources, confidence y warnings.

8. FAILURE BEHAVIOUR
Si no hay datos suficientes o no existe riesgo real, explica por que y no propongas tareas de reposicion.

9. EXAMPLES
Bueno: SKU con 40 ventas y 2 unidades disponibles, citando periodo.
Bueno: "Seguimiento: el SKU X sigue en riesgo; su reposicion propuesta el 12/08 quedo ignorada".
Malo: recomendar reposicion urgente de un SKU con cero ventas, o re-proponer una reposicion ya pendiente de aprobacion.$$,
  encode(sha256('a06_planificador_stock_system_v7'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id in (
    select id from public.agent_definitions where code in (
      'a02_monitor_negocio',
      'a04_generador_tareas',
      'a06_planificador_stock'
    )
  );

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v7', 'claude-sonnet-5', 'a02_monitor_negocio_system', 'v6', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v7', 'claude-sonnet-5', 'a04_generador_tareas_system', 'v6', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v8', 'claude-sonnet-5', 'a06_planificador_stock_system', 'v7', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a06_planificador_stock'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
