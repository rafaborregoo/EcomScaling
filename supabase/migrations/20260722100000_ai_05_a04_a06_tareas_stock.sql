-- AI-05 (parcial): seed de los agentes A04 (generador/priorizador de tareas)
-- y A06 (planificador inteligente de stock). Ambos usan el contrato generico
-- de salida (findings/recommendations/proposed_writes) porque los dos
-- diagnostican y proponen tareas, igual que A02. approval_mode
-- 'required_before_publish': el diagnostico se ve sin aprobar (criterio
-- [[ia-ver-vs-escribir]]); la aprobacion solo materializa las tareas
-- propuestas via decideAgentOutput (mismo flujo que A02).

insert into public.agent_definitions (code, name, description)
values (
  'a04_generador_tareas',
  'Generador y priorizador de tareas',
  'Revisa el backlog de tareas abiertas junto a alertas y metricas activas para priorizar lo que ya existe y proponer tareas nuevas donde haya un vacio, evitando duplicados.'
)
on conflict (code) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v1',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa. Recibes el backlog de tareas abiertas (pendientes o en progreso), las alertas activas y un resumen de ventas de los ultimos 30 dias. Tu trabajo: (1) en "findings" senala que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra; (2) en "recommendations" indica que tareas YA ABIERTAS deberian subir o bajar de prioridad y por que, citando su titulo exacto; (3) en "proposed_writes" propone SOLO tareas nuevas y accionables para los vacios detectados en el punto 1 -- nunca dupliques el titulo de una tarea que ya esta en el backlog. Usa la tool sql_select si necesitas contexto adicional (por ejemplo, historial de una metrica concreta) y search_knowledge si quieres fundamentar una recomendacion en la metodologia EcomScaling. Se concreto: cada tarea propuesta debe ser una accion unica, no un objetivo generico. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v1'::bytea), 'hex')
)
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas'
on conflict (definition_id, version) do update set is_active = excluded.is_active;

insert into public.agent_definitions (code, name, description)
values (
  'a06_planificador_stock',
  'Planificador inteligente de stock',
  'Cruza el stock disponible con la velocidad de venta reciente para detectar quiebres de stock inminentes en productos que si venden, y proponer tareas de reposicion priorizadas.'
)
on conflict (code) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v1',
  'Eres el planificador de stock de EcomScaling para la organizacion activa. Recibes un resumen agregado de stock (items rastreados, disponibles, en stock bajo y agotados) y el top de productos por ventas de los ultimos 30 dias. Usa la tool sql_select para cruzar, producto a producto, el stock disponible actual (shopify_inventory_current_state via shopify_inventory_items y shopify_variants) con su venta reciente (shopify_order_items/shopify_order_facts), y asi identificar SKUs concretos que venden bien pero se estan quedando sin stock. No propongas reposicion de productos con venta nula o irrelevante aunque esten agotados: el riesgo real es "vende y se acaba", no "esta en cero". En "findings" lista los SKUs en riesgo con su evidencia (unidades vendidas en 30 dias vs. disponible). En "proposed_writes" propone una tarea de reposicion por cada SKU en riesgo real, con el titulo incluyendo el nombre del producto, y en la descripcion la unidad vendida/disponible que justifica la urgencia. Usa search_knowledge si necesitas fundamentar el criterio de cuanto stock de seguridad mantener. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas.',
  encode(sha256('a06_planificador_stock_system_v1'::bytea), 'hex')
)
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
