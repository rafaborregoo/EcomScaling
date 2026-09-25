-- ---------------------------------------------------------------------------
-- D03 y D06: el resto del grafo de capacidades y la aritmetica del embudo
-- ---------------------------------------------------------------------------
--
-- Propuesta en conocimiento/fase-03/PROPUESTA_GRAFOS_D03_D06.md, validada el
-- 2026-09-25. Las siete aristas del artefacto (20260930090000) ya estaban; estas
-- son las 17 de la propuesta (C1-C17).
--
-- De las relaciones entre metricas solo entran M1-M3: la identidad
-- ventas = pedidos x ticket y pedidos = sesiones x conversion, que ata las dos
-- metricas que D05 emite hoy. M4-M12 usan nombres que ningun motor calcula
-- todavia; se declaran junto con la senal que los emita, para que el nombre lo
-- fije quien la calcula (misma regla que SYMPTOM_TEMPLATES).

insert into public.capability_dependencies (capability, depends_on, relation, rationale)
select v.capability, v.depends_on, v.relation, v.rationale
from (values
  ('retention', 'data', 'requires',
   'Sin identidad de cliente ni eventos no hay segmentacion ni flujos que midan nada.'),
  ('retention', 'product', 'requires',
   'La recompra depende de que el producto merezca volver; el CRM no la crea.'),
  ('retention', 'operations', 'requires',
   'Una mala entrega anula cualquier flujo de post-compra.'),
  ('conversion', 'technology', 'requires',
   'La conversion no se optimiza sobre una tienda lenta o inestable.'),
  ('conversion', 'offer', 'requires',
   'El CRO no compensa una oferta que no convence.'),
  ('conversion', 'data', 'requires',
   'Optimizar conversion exige medir el embudo.'),
  ('offer', 'unit_economics', 'requires',
   'Descuentos y precios sin margen conocido regalan dinero.'),
  ('unit_economics', 'finance', 'requires',
   'La economia unitaria necesita costes registrados.'),
  ('inventory', 'finance', 'requires',
   'Comprar stock exige caja y prevision.'),
  ('inventory', 'data', 'requires',
   'Reponer sin ventas por referencia es adivinar.'),
  ('operations', 'inventory', 'requires',
   'No se puede cumplir lo que no esta en stock.'),
  ('creative', 'product', 'requires',
   'La creatividad comunica un producto; no lo sustituye.'),
  ('strategy', 'data', 'requires',
   'Decidir la direccion exige saber que funciona.'),
  ('acquisition', 'unit_economics', 'ceiling',
   'El CAC que se puede pagar lo fija el margen: por encima, crecer destruye valor.'),
  ('retention', 'team', 'ceiling',
   'Los flujos y campanas necesitan quien los mantenga.'),
  ('acquisition', 'technology', 'ceiling',
   'El tracking y la velocidad de la web limitan cuanto se puede escalar en pago.'),
  ('operations', 'team', 'ceiling',
   'El volumen que se puede preparar lo pone el equipo o el 3PL.')
) as v(capability, depends_on, relation, rationale)
where not exists (
  select 1 from public.capability_dependencies d
  where d.capability = v.capability
    and d.depends_on = v.depends_on
    and d.relation = v.relation
);

insert into public.metric_dependencies (organization_id, metric, depends_on, relation, rationale)
select null, v.metric, v.depends_on, v.relation, v.rationale
from (values
  ('net_sales', 'average_order_value', 'component',
   'Ventas = pedidos x ticket medio: si las ventas se mueven sin los pedidos, lo que cambio es el ticket.'),
  ('orders_count', 'sessions', 'component',
   'Pedidos = sesiones x conversion: menos pedidos con la misma conversion es menos trafico.'),
  ('orders_count', 'conversion_rate', 'component',
   'Pedidos = sesiones x conversion: menos pedidos con el mismo trafico es peor conversion.')
) as v(metric, depends_on, relation, rationale)
where not exists (
  select 1 from public.metric_dependencies m
  where m.organization_id is null
    and m.metric = v.metric
    and m.depends_on = v.depends_on
    and m.relation = v.relation
);
