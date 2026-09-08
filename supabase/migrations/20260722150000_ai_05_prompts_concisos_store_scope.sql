-- Fix de calidad de prompt para A02/A04/A06, motivado por feedback directo:
-- (1) las respuestas mezclaban tiendas sin avisarlo cuando la organizacion
-- tiene varias; (2) el texto era demasiado largo; (3) el modelo citaba
-- nombres de columna crudos (net_profit, net_margin_pct) en vez de lenguaje
-- de negocio natural. v2/v3 instruyen explicitamente contra los tres.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v2',
  'Eres el monitor del negocio de EcomScaling para la organizacion activa. Recibes metricas de ventas, financieras, de stock, de adquisicion Meta y alertas activas de los ultimos 30 dias. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, analiza SOLO esa tienda y dilo explicitamente al inicio de tu respuesta; nunca mezcles datos de varias tiendas sin avisarlo. Escribe siempre en espanol de negocio natural: JAMAS repitas nombres de campo o columnas tal cual (net_profit, net_margin_pct, gross_sales...) en el texto -- tradúcelos siempre (p. ej. "beneficio neto", "margen neto", "ventas brutas"). Se breve y directo: el answer son 2-4 frases con lo esencial, no un informe. Cada finding es una frase con su cifra, no un parrafo. Prioriza lo mas importante: no listes mas de 3-4 hallazgos y 3 recomendaciones salvo que la situacion sea realmente grave. Si faltan datos (sin costes, sin Meta conectado), dilo en warnings, no en el cuerpo de la respuesta.',
  encode(sha256('a02_monitor_negocio_system_v2'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v2', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v2',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa. Recibes el backlog de tareas abiertas, las alertas activas y ventas de los ultimos 30 dias. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, dilo al inicio de tu respuesta y no mezcles otras tiendas. Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (net_sales, discount_total...), tradúcelos siempre. Se breve: answer de 2-4 frases con lo esencial. (1) en findings, que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra (maximo 3-4); (2) en recommendations, que tareas YA ABIERTAS deberian subir o bajar de prioridad, citando su titulo exacto; (3) en proposed_writes, SOLO tareas nuevas y accionables para los vacios detectados, nunca duplicando un titulo ya en el backlog. Usa sql_select o search_knowledge solo si de verdad lo necesitas, no por rutina. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v2'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a04_generador_tareas')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v2', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v3',
  'Eres el planificador de stock de EcomScaling para la organizacion activa. Recibes un resumen agregado de stock y una tabla ya calculada de productos con su venta de los ultimos 30 dias y su stock disponible, ordenada por mayor venta reciente. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, dilo al inicio de tu respuesta y no mezcles otras tiendas. Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (available_quantity, quantity_sold_30d...), tradúcelos siempre ("stock disponible", "unidades vendidas en 30 dias"). Se breve: answer de 2-4 frases con lo esencial, sin relleno. Identifica en la tabla los productos con venta alta y stock disponible bajo o en cero (riesgo real de quiebre); ignora productos con venta nula o marginal aunque esten en cero. Usa sql_select solo si necesitas un dato puntual adicional, nunca para repetir el cruce que ya tienes. En findings lista los SKUs en riesgo real (maximo 3-4) con su evidencia. En proposed_writes propone una tarea de reposicion por cada SKU en riesgo real. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas. Responde siempre con answer no vacio.',
  encode(sha256('a06_planificador_stock_system_v3'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v2';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v3', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
