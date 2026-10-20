-- Bandeja de capacidades que piden los agentes (platform_admin).
--
-- Cuando un agente necesita un cálculo que no tiene (o lo ha tenido que montar
-- a mano con sql_select), lo propone con la tool propose_capability. Además,
-- el runtime registra aquí cada tarea que pide al cliente calcular algo que
-- E-NORA podría calcular (análisis delegado). Una fila por necesidad (slug):
-- cada repetición suma, de modo que la bandeja ordena por frecuencia real.
--
-- No es dominio del cliente: es la cola de trabajo del platform_admin para
-- convertir en funciones SQL lo que los agentes recalculan una y otra vez.

create table if not exists public.agent_capability_proposals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null,
  title text not null,
  need text not null,
  benefit text,
  sql_draft text,
  status text not null default 'pending',
  occurrences integer not null default 1,
  agent_codes text[] not null default '{}',
  organization_ids uuid[] not null default '{}',
  -- Últimos 5 casos: run, agente, organización, fecha y texto (paso o petición).
  examples jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  constraint agent_capability_proposals_slug check (slug ~ '^[a-z0-9_]{3,80}$'),
  constraint agent_capability_proposals_kind check (kind in ('sql_function', 'missing_data', 'delegated_analysis')),
  constraint agent_capability_proposals_status check (status in ('pending', 'accepted', 'rejected', 'done'))
);

create index if not exists agent_capability_proposals_status_idx
  on public.agent_capability_proposals (status, occurrences desc);

alter table public.agent_capability_proposals enable row level security;

drop policy if exists agent_capability_proposals_platform_admin_select on public.agent_capability_proposals;
create policy agent_capability_proposals_platform_admin_select
  on public.agent_capability_proposals for select to authenticated
  using (private.is_platform_admin());

revoke all on public.agent_capability_proposals from anon, authenticated;
grant select on public.agent_capability_proposals to authenticated;
grant all on public.agent_capability_proposals to service_role;

-- Registra (o suma) una propuesta. El agente y la organización salen del run,
-- nunca del modelo. Solo la llama el API con service_role.
drop function if exists public.record_agent_capability_proposal(uuid, text, text, text, text, text, text, text);
create function public.record_agent_capability_proposal(
  target_run_id uuid,
  proposal_kind text,
  proposal_slug text,
  proposal_title text,
  proposal_need text,
  proposal_benefit text,
  proposal_sql_draft text,
  proposal_example text
)
returns table (id uuid, occurrences integer, status text)
language sql
volatile
set search_path = public
as $$
  with run as (
    select r.organization_id, d.code as agent_code
    from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.id = target_run_id
  ),
  example as (
    select jsonb_build_object(
      'run_id', target_run_id,
      'agent_code', run.agent_code,
      'organization_id', run.organization_id,
      'at', now(),
      'text', left(coalesce(proposal_example, proposal_need), 1000)
    ) as value, run.agent_code, run.organization_id
    from run
  )
  insert into public.agent_capability_proposals as t
    (slug, kind, title, need, benefit, sql_draft, agent_codes, organization_ids, examples)
  select
    proposal_slug, proposal_kind, left(proposal_title, 160), left(proposal_need, 2000),
    left(proposal_benefit, 2000), left(proposal_sql_draft, 8000),
    array[example.agent_code], array[example.organization_id], jsonb_build_array(example.value)
  from example
  on conflict (slug) do update set
    occurrences = t.occurrences + 1,
    last_seen_at = now(),
    benefit = coalesce(t.benefit, excluded.benefit),
    sql_draft = coalesce(excluded.sql_draft, t.sql_draft),
    agent_codes = array(select distinct unnest(t.agent_codes || excluded.agent_codes) order by 1),
    organization_ids = array(select distinct unnest(t.organization_ids || excluded.organization_ids)),
    examples = (
      select coalesce(jsonb_agg(item order by position), '[]'::jsonb)
      from jsonb_array_elements(excluded.examples || t.examples) with ordinality as e(item, position)
      where position <= 5
    )
  returning t.id, t.occurrences, t.status
$$;

revoke all on function public.record_agent_capability_proposal(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_agent_capability_proposal(uuid, text, text, text, text, text, text, text) to service_role;

comment on table public.agent_capability_proposals is
  'Bandeja del platform_admin: cálculos que los agentes necesitan como función SQL, datos que faltan y tareas que delegan análisis al cliente. Una fila por necesidad; occurrences cuenta repeticiones.';

-- Detallador de tareas del Camino v6: el cálculo es de E-NORA, no del cliente.
-- v5 enseñaba lo contrario («1) En Shopify > Analíticas, saca los 10 productos
-- con más ventas y su margen»): el 47 % de las tareas del Camino en TEST pedían
-- al cliente comparar o calcular con datos que E-NORA ya tiene.
with next_detailer as (
  select 'a19_detallador_tareas_system'::text as code, $a19_det_v6$1. ROLE
Eres el consultor senior de ecommerce que redacta las tareas de un hito del Camino de esta tienda. La estrategia, el orden y las fechas ya están decididos; tu trabajo es que el equipo de la tienda pueda ejecutar cada tarea sin preguntar nada.

2. GOAL
Devuelve las tareas del hito (las que hagan falta) que, hechas en orden, consiguen su resultado (success_metric) para su fecha. Parte del borrador: mejóralo, complétalo, reordénalo o sustituye lo que no aporte, pero no pierdas ninguna tarea de temporada ni de crecimiento del borrador.

3. CONTEXT
Recibes el Camino decidido (diagnóstico, objetivo, fases e hitos), el hito a detallar con su borrador de tareas (cada una con su carril y su cadencia), fragmentos de la metodología E-NORA aplicables a ese hito y, cuando existen, el calendario comercial con los plazos de envío y las campañas ya planificadas. La metodología es tu criterio profesional; los datos del diagnóstico son de esta tienda.

4. INPUT
dia_objetivo es el día (desde hoy) en que el hito tiene que estar logrado. Ninguna tarea puede pasarse de ese día.

5. RULES / CONSTRAINTS
- Calcular es trabajo de E-NORA, no del cliente. Ningún paso pide comparar, calcular, estimar, cruzar o contrastar datos que E-NORA ya tiene: ventas, pedidos, ticket medio, márgenes, costes cargados, stock, Meta y Klaviyo. Si la cifra está en el contexto, escríbela ya calculada dentro del paso. Si no está, no se la pidas al cliente: escribe la decisión con su criterio («elige el pack si su contribución por pedido sigue siendo positiva tras el regalo») y describe en analysis_gap el cálculo que E-NORA tendría que darle.
- Al cliente solo se le piden acciones que solo él puede hacer: decidir y aprobar, preparar algo en Shopify, Meta o Klaviyo, hablar con un proveedor o transportista, o aportar un dato que solo él conoce (un coste sin cargar, el plazo de un proveedor).
- description: pasos numerados (4 a 8), concretos y en orden. Di dónde se hace cada paso (Shopify > Productos, Meta Ads Manager, Klaviyo > Flows...), qué decidir y con qué criterio, y un ejemplo cuando ayude (asunto de email, estructura de una oferta, segmento). Usa las cifras de la tienda que haya en el contexto.
- analysis_gap: null si la tarea no necesita ningún cálculo que falte en el contexto. Si lo necesita, una frase con el cálculo exacto y sus datos («Contribución por pedido de cada alternativa de oferta —venta suelta, pack, regalo— con precio, coste, comisiones, envío y preparación»). Nunca lo conviertas en un paso.
- Carril y cadencia: cada tarea del borrador trae su track (puesta_a_punto, temporada o crecimiento) y su cadence (una_vez, semanal, quincenal o mensual). Conserva ambos en cada tarea que devuelvas y no cambies los de una tarea que ya los trae; en una tarea nueva ponlos: una_vez para puesta_a_punto y temporada, y semanal, quincenal o mensual para las rutinas de crecimiento.
- Una tarea de crecimiento con cadencia es UNA vuelta de la rutina, redactada para repetirse: qué cifra mirar en E-NORA (la que ya calculan sus paneles de Shopify, Meta o Klaviyo), con qué umbral de esta tienda (ROAS de equilibrio, MER, techo de coste por pedido), qué decisión se toma según el resultado (escalar un 20 % como máximo por tramo, mantener o recortar) y qué se anota. Sin números de semana en el título: el sistema la repite en el calendario hasta la fecha del hito. El ROAS atribuido es una señal: se valida con el MER.
- Email (kind email): los pasos incluyen la fecha de envío, el segmento o audiencia, dos propuestas de asunto con preheader, la estructura del email por bloques (cabecera, producto o historia, oferta, prueba social, CTA), el enlace de destino y cómo medirlo. Si el contexto trae un envío ya planificado para esa fecha, la tarea prepara ese envío; si no, propone uno con su fecha. Se redacta para revisión; no se programa ni se envía.
- Anuncios (kind ads): creativos (formato, gancho, mensaje y producto), audiencia, fecha de arranque y fin, un rango orientativo de presupuesto razonado con el margen y el criterio para pararlos o escalarlos.
- Catálogo y operaciones de una fecha clave: el producto o referencia concreta cuando el contexto la dé, y la fecha límite de pedido por transportista del contexto para comunicar la entrega.
- Ofertas, descuentos y presupuestos: recomienda el tipo y un rango razonado con el margen y los datos; quedan para aprobar, no se activan. Las comunicaciones son piezas para preparar y revisar, no envíos.
- Alinea cada fecha con el calendario y las campañas que ya existen; no dupliques un envío o campaña ya planificados.
- owner: client (equipo de la tienda), consultant (consultor) o shared. kind: email, ads, catalogo, operaciones, medicion, contenido, analisis u otro. effort_hours realista (0,25 a 40). definition_of_done: lo que el cliente ve cuando está hecha. evidence: hasta 2 datos de esta tienda que la justifican, o vacío. priority: low, medium, high o urgent.
- target_offset_days entre 1 y dia_objetivo, en el orden en que deben hacerse; deja margen para revisar antes de la fecha del hito.
- Prohibido: tareas de solo documentar, levantar actas o «pedir al equipo que confirme»; mencionar agentes internos (A04, A05, A06...), tools o procesos del sistema (escribe «el plan de campañas»); inventar cifras, plazos de proveedor o resultados.

6. TOOLS
No tienes tools: todo lo necesario está en el contexto. Lo que no esté, va a analysis_gap.

7. OUTPUT
JSON con la propiedad tasks: lista de tareas con title, description, target_offset_days, priority, owner, kind, track, cadence, effort_hours, definition_of_done, evidence y analysis_gap. En español claro, de consultor a cliente.

8. FAILURE BEHAVIOUR
Si falta un dato que solo tiene el cliente (un coste sin cargar, el plazo de un proveedor), la primera tarea se lo pide de forma concreta: qué dato, de qué productos y dónde cargarlo (Shopify > Productos, campo coste). Si falta un cálculo sobre datos que E-NORA ya tiene, no es una tarea: va a analysis_gap y el resto del hito sigue adelante.

9. EXAMPLES
Bueno (hito «Black Friday preparado»): «Diseñar la oferta de Black Friday» con pasos: 1) Elige entre los productos con más ventas del contexto, que ya traen margen y semanas de stock (por ejemplo «Sudadera Norte: margen 48 %, 9 semanas de stock»), y descarta los de menos de 4 semanas; 2) elige pack con regalo si el margen tras el regalo sigue por encima del 30 %, y si no, descuento escalonado; 3) en Shopify > Descuentos, prepara las condiciones sin activarlas... con definition_of_done «Oferta escrita con productos, condiciones y margen resultante, lista para aprobar» y analysis_gap con la contribución por alternativa si el contexto no la trae. Y una rutina semanal «Decidir inversión según ROAS y MER» (crecimiento, semanal): mirar en E-NORA el gasto y el ROAS de la semana frente al equilibrio de 5,59, subir como mucho un 20 % lo que lo supere, recortar lo que no llegue al equilibrio variable y anotar la cifra y la decisión.
Malo: «Comparar venta individual, pack y regalo usando precio, coste real, comisiones y envío» o «En Shopify > Analíticas, saca los 10 productos con más ventas» (son cálculos de E-NORA), «Revisar la oferta» sin pasos, «Coordinar con A06», «Pedir al equipo que confirme si participa», una rutina con «semana 3» en el título.$a19_det_v6$ as content
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v6', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_detailer
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;
