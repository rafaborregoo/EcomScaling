-- FASE 3 / D07 -- La semilla del grafo causal global.
--
-- La migracion `20260918090000` dejo las cinco tablas del grafo y **ninguna
-- fila**. Un grafo vacio no se recorre: `causal_paths` no podia escribirse
-- porque no habia aristas que seguir, y por eso D07 llevaba tres semanas en
-- `contrato`.
--
-- Esto es lo mismo que hizo D06 con `metric_dependencies` el 2026-09-28:
-- **declarar el conocimiento en una migracion**, sin organizacion, porque no es
-- una particularidad de nadie. Las ventas netas son pedidos por ticket medio en
-- cualquier tienda.
--
-- LA REGLA QUE DECIDE QUE ENTRA AQUI Y QUE NO: solo se declara lo que se puede
-- sostener con un mecanismo escrito y una metrica que la plataforma sabe leer
-- hoy. Seis nodos y cinco aristas es poco para un grafo causal del ecommerce, y
-- es exactamente lo que tenemos. El resto lo declara quien sepa, desde la
-- pantalla de D07, y queda con `knowledge_source = 'expert_heuristic'` y su
-- techo de evidencia puesto por el esquema (guardrail 45).
--
-- CUATRO DE LAS CINCO ARISTAS SON ARITMETICA, Y ESO NO ES UN DEFECTO OCULTO.
-- `relation_type = 'mathematical'` existe justo para esto: el guardrail 4 dice
-- que el linaje no es el grafo causal, y `checkCausalInvariants` impide que una
-- ruta hecha solo de aritmetica se presente como explicacion. Declararlas sirve
-- para **acotar la busqueda** --si las ventas cayeron, o cayeron los pedidos o
-- cayo el ticket, no hay tercera opcion-- no para explicar nada.
--
-- `sessions` Y `conversion_rate` SON `observed_metric` A PROPOSITO. Salen del
-- tracking de la tienda, y un fallo de tracking las mueve sin que se mueva el
-- negocio. Esa etiqueta es lo que hace saltar los guardrails 37-39 en cuanto una
-- ruta pase por ellas sin validar la medicion. `net_sales`, `orders_count` y
-- `ad_spend` no: salen del registro de pedidos y del de facturacion del
-- anunciante, que son el sistema de registro, no una medida indirecta.

-- ---------------------------------------------------------------------------
-- 1. Los nodos: el vocabulario que la plataforma sabe leer
-- ---------------------------------------------------------------------------

insert into public.causal_nodes
  (organization_id, code, label, node_type, capability, observability, measurement_layer, scope, provenance, notes)
select v.organization_id, v.code, v.label, v.node_type, v.capability,
       v.observability, v.measurement_layer, v.scope, v.provenance, v.notes
from (values
  (null::uuid, 'net_sales', 'Ventas netas', 'metric', 'unit_economics',
   'derived', 'real_world', 'business', 'system_logic',
   null::text),
  (null::uuid, 'orders_count', 'Pedidos', 'metric', 'conversion',
   'directly_observed', 'real_world', 'business', 'system_logic',
   null::text),
  (null::uuid, 'average_order_value', 'Ticket medio', 'metric', 'unit_economics',
   'derived', 'real_world', 'business', 'system_logic',
   null::text),
  (null::uuid, 'sessions', 'Sesiones', 'metric', 'acquisition',
   'directly_observed', 'observed_metric', 'business', 'system_logic',
   null::text),
  (null::uuid, 'conversion_rate', 'Tasa de conversion', 'metric', 'conversion',
   'derived', 'observed_metric', 'business', 'system_logic',
   null::text),
  (null::uuid, 'ad_spend', 'Inversion publicitaria', 'metric', 'acquisition',
   'directly_observed', 'real_world', 'business', 'system_logic',
   null::text)
) as v(organization_id, code, label, node_type, capability, observability, measurement_layer, scope, provenance, notes)
where not exists (
  select 1 from public.causal_nodes n
  where n.organization_id is null
    and n.code = v.code
    and n.scope = v.scope
    and n.scope_detail = '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2. Las aristas: cuatro de aritmetica y una de mecanismo
-- ---------------------------------------------------------------------------
--
-- El `mechanism` de una arista aritmetica es la identidad misma, y tiene que
-- decirla entera: el check exige 20 caracteres porque el guardrail 9 dice que un
-- eslogan no es un mecanismo. El `diagnostic_rationale` dice para que sirve
-- **diagnosticando**, que es lo que el guardrail 10 pide y lo que impide que el
-- grafo se llene de relaciones ciertas e inutiles.

insert into public.causal_edges
  (organization_id, from_node_id, to_node_id, edge_kind, relation_type, expected_sign,
   mechanism, diagnostic_rationale, conditions, expected_lag_days,
   strength, evidence_level, knowledge_source)
select null, origen.id, destino.id, v.edge_kind, v.relation_type, v.expected_sign,
       v.mechanism, v.diagnostic_rationale, v.conditions, v.expected_lag_days,
       v.strength, v.evidence_level, v.knowledge_source
from (values
  ('orders_count', 'net_sales', 'causal', 'mathematical', 'positive',
   'Las ventas netas son la suma del importe de los pedidos: un pedido mas suma su importe al total, y uno menos lo resta. No hay tercera via.',
   'Separa una caida de ventas por menos pedidos de una caida por ticket mas bajo. Son problemas distintos y se arreglan en sitios distintos.',
   null::text, 0, 'strong', 'deterministic', 'system_logic'),

  ('average_order_value', 'net_sales', 'causal', 'mathematical', 'positive',
   'Las ventas netas son el numero de pedidos por el importe medio de cada uno: con los mismos pedidos, un ticket mas bajo baja las ventas.',
   'Es la otra mitad de la descomposicion. Si los pedidos aguantan y las ventas caen, lo que se hundio es el ticket.',
   null::text, 0, 'strong', 'deterministic', 'system_logic'),

  ('sessions', 'orders_count', 'causal', 'mathematical', 'positive',
   'Los pedidos son las sesiones por la tasa de conversion: sin visita no hay pedido, asi que menos sesiones son menos pedidos a igualdad de conversion.',
   'Separa un problema de trafico de uno de conversion, que es la primera bifurcacion de cualquier caida de pedidos.',
   null::text, 0, 'strong', 'deterministic', 'system_logic'),

  ('conversion_rate', 'orders_count', 'causal', 'mathematical', 'positive',
   'Los pedidos son las sesiones por la tasa de conversion: con el mismo trafico, una conversion mas baja son menos pedidos.',
   'La otra rama de la misma bifurcacion. Si el trafico aguanta y los pedidos caen, el problema esta en la tienda, no en traerlos.',
   null::text, 0, 'strong', 'deterministic', 'system_logic'),

  -- La unica que explica algo, y por eso es la unica que no es determinista.
  ('ad_spend', 'sessions', 'causal', 'economic', 'positive',
   'La inversion en anuncios compra impresiones que se convierten en clics hacia la tienda: a igualdad de coste por clic, mas inversion trae mas sesiones pagadas, y recortarla las quita.',
   'Distingue una caida de sesiones por recorte de inversion --que es una decision, no una averia-- de una caida con la inversion intacta, que si lo es.',
   'Se sostiene mientras el coste por clic y la mezcla de campanas no cambien a la vez. Si cambian, la relacion sigue existiendo pero ya no explica la magnitud.',
   1, 'moderate', 'common_mechanism', 'system_logic')
) as v(from_code, to_code, edge_kind, relation_type, expected_sign,
       mechanism, diagnostic_rationale, conditions, expected_lag_days,
       strength, evidence_level, knowledge_source)
join public.causal_nodes origen
  on origen.organization_id is null and origen.code = v.from_code and origen.scope = 'business'
join public.causal_nodes destino
  on destino.organization_id is null and destino.code = v.to_code and destino.scope = 'business'
where not exists (
  select 1 from public.causal_edges e
  where e.organization_id is null
    and e.from_node_id = origen.id
    and e.to_node_id = destino.id
    and e.relation_type = v.relation_type
);

-- ---------------------------------------------------------------------------
-- 3. Escritura: el consultor declara aristas propias de su tienda
-- ---------------------------------------------------------------------------
--
-- La migracion original solo dio politicas de `select`. Sin `insert`, la unica
-- forma de anadir conocimiento causal era una migracion, y eso deja el grafo
-- congelado en lo que supiera quien escribio el SQL.
--
-- Solo para lo del tenant: `organization_id` no puede ser nulo en una fila
-- escrita desde la pantalla. Una arista global es conocimiento de ecommerce y se
-- revisa antes de entrar; una arista de tenant es lo que este consultor ha visto
-- en esta tienda, y el guardrail 44 ya impide que ascienda sola.

drop policy if exists "causal_nodes_insert_consultor" on public.causal_nodes;
create policy "causal_nodes_insert_consultor" on public.causal_nodes
  for insert to authenticated
  with check (
    organization_id is not null
    and (private.is_platform_admin() or private.is_assigned_consultant(organization_id))
  );

drop policy if exists "causal_edges_insert_consultor" on public.causal_edges;
create policy "causal_edges_insert_consultor" on public.causal_edges
  for insert to authenticated
  with check (
    organization_id is not null
    and (private.is_platform_admin() or private.is_assigned_consultant(organization_id))
  );

drop policy if exists "causal_edges_update_consultor" on public.causal_edges;
create policy "causal_edges_update_consultor" on public.causal_edges
  for update to authenticated
  using (
    organization_id is not null
    and (private.is_platform_admin() or private.is_assigned_consultant(organization_id))
  )
  with check (organization_id is not null);
