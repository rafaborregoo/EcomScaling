-- Atribucion de los pedidos que entran por webhook.
--
-- EL PROBLEMA, medido en produccion el 2026-09-15: de 788 pedidos, **35 tienen
-- origen de visita y 753 no**. Los 35 son todos del ultimo mes. No es un
-- problema de permisos --el campo se rellena cuando llega-- sino de por donde
-- entra el pedido:
--
--   * la importacion masiva pide `customerJourneySummary` y lo guarda;
--   * el webhook de Shopify **no trae el customer journey en el payload**, y
--     nuestro manejador no va a buscarlo;
--   * la reconciliacion incremental filtra por `updated_at >= last_sync_at`, o
--     sea que un pedido que entro por webhook y no se volvio a tocar **nunca**
--     se vuelve a pedir.
--
-- Resultado: cada pedido nuevo nace sin atribucion y se queda asi para siempre.
-- Y sin atribucion, `D03` no puede decir nada de la capacidad de adquisicion:
-- es literalmente el motivo por el que la declara no observable.
--
-- POR QUE UNA COLUMNA Y NO SOLO "LOS QUE TIENEN EL ORIGEN A NULO". Porque no es
-- lo mismo **no haber preguntado** que **haber preguntado y que Shopify no
-- tuviera nada**. Un pedido puede ser una visita directa sin origen ninguno, y
-- eso es un dato, no un hueco. Sin esta columna el backfill reintentaria para
-- siempre los mismos pedidos y nadie podria distinguir un hueco de un directo.
-- Es el mismo criterio que el motor de madurez: "no lo se" y "no lo hay" son
-- cosas distintas.
--
-- Los pedidos anteriores a la ventana de retencion de Shopify se quedan con la
-- columna a nulo y no entran nunca en el indice: no se les pregunta porque la
-- respuesta ya no existe, y fingir que se comprobaron seria mentir.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

alter table public.shopify_order_facts
  add column if not exists journey_checked_at timestamptz;

comment on column public.shopify_order_facts.journey_checked_at is
  'Cuando se le pregunto a Shopify por el customer journey de este pedido. Nulo = no se ha '
  'preguntado. Con fecha y `first_visit_source_type` nulo = se pregunto y no habia origen, '
  'que es un dato (visita directa) y no un hueco.';

-- Solo los pendientes: el indice es del tamano de la cola, no de la tabla.
create index if not exists shopify_order_facts_journey_pendiente_idx
  on public.shopify_order_facts (store_id, processed_at desc)
  where journey_checked_at is null;

-- Los que ya traen origen vinieron de la importacion masiva y ya estan
-- contestados: marcarlos ahora evita que el primer backfill gaste llamadas en
-- preguntar lo que ya sabemos.
update public.shopify_order_facts
  set journey_checked_at = coalesce(updated_at, created_at, now())
  where journey_checked_at is null
    and first_visit_source_type is not null;
