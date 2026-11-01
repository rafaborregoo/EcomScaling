-- Textos de las tres reglas de alerta (DB-07), reescritos.
--
-- Las plantillas eran del seed de julio: sin tildes ni eñes («campanas»,
-- «Sincronizacion»), con jerga («items») y, en la de integración, con el error
-- técnico del proveedor dentro del aviso («Motivo: meta_token_expired_...») y
-- la clave del proveedor («La conexion meta_ads...»). Ahora el motor
-- (operations.ts) pasa en {context_provider} el nombre legible y la cuenta, y
-- el error técnico se queda en context_data, que no se enseña.
--
-- Idempotente: UPDATE por código; reaplicarla deja lo mismo.

update public.alert_rule_templates
set
  name = 'Productos sin stock',
  description = 'Avisa cuando hay productos activos de Shopify con el stock a cero.',
  alert_title_template = 'Productos sin stock: {metric_value}',
  alert_message_template = 'Cada día sin stock es una venta perdida y el producto baja en las búsquedas. Revisa cuáles son y decide si reponer o pausar los anuncios que llevan a ellos.',
  task_title_template = 'Reponer los productos sin stock',
  task_description_template = 'Revisa los productos agotados en Shopify › Inventario ({metric_value} ahora mismo) y decide si reponerlos o pausar las campañas que llevan a ellos.'
where code = 'shopify_stock_out';

update public.alert_rule_templates
set
  name = 'Integración que no sincroniza',
  description = 'Avisa cuando una integración deja de traer datos.',
  alert_title_template = '{context_provider} ha dejado de sincronizar',
  alert_message_template = 'Sus datos pueden estar desactualizados hasta que vuelva. Lo reintentamos solos; si sigue así, revisa la conexión en Integraciones.',
  task_title_template = 'Revisar la conexión de {context_provider}',
  task_description_template = 'Entra en Integraciones y comprueba la conexión. Si te pide volver a conectarla, hazlo: el histórico no se pierde.'
where code = 'integration_sync_failed';

update public.alert_rule_templates
set
  name = 'Caída de facturación',
  description = 'Compara las ventas netas de los últimos 7 días con las de los 7 anteriores.',
  alert_title_template = 'La facturación ha caído un {metric_value_abs} % esta semana',
  alert_message_template = 'Ventas netas de los últimos 7 días: {context_current}. La semana anterior: {context_previous}. Avisamos a partir de una caída del {threshold_abs} %.',
  task_title_template = 'Investigar la caída de facturación',
  task_description_template = 'Revisa las campañas activas, el stock de los productos que más venden y si ha habido alguna incidencia en la tienda. Apunta la causa en los comentarios.'
where code = 'shopify_revenue_drop';

-- Las alertas de integración que siguen abiertas se crearon con el texto viejo
-- (clave del proveedor y error técnico). El motor solo refresca cifras, no el
-- texto, así que se reescriben aquí con el mismo formato que usa ahora.
with live as (
  select
    alert.id as alert_id,
    case connection.provider
      when 'shopify' then 'Shopify'
      when 'meta_ads' then 'Meta Ads'
      when 'klaviyo' then 'Klaviyo'
      when 'instagram' then 'Instagram'
      else 'La integración'
    end || coalesce(' (' || nullif(connection.provider_account_name, '') || ')', '') as provider_text
  from public.alerts alert
  join public.alert_rule_templates template on template.id = alert.rule_template_id
  join public.integration_connections connection on connection.id = alert.source_entity_id
  where template.code = 'integration_sync_failed'
    and alert.status in ('open', 'acknowledged')
    and alert.source_entity_type = 'integration_connection'
)
update public.alerts alert
set
  title = left(live.provider_text || ' ha dejado de sincronizar', 255),
  message = 'Sus datos pueden estar desactualizados hasta que vuelva. Lo reintentamos solos; si sigue así, revisa la conexión en Integraciones.'
from live
where alert.id = live.alert_id
  and alert.title is distinct from left(live.provider_text || ' ha dejado de sincronizar', 255);

with live as (
  select
    alert.id as alert_id,
    case connection.provider
      when 'shopify' then 'Shopify'
      when 'meta_ads' then 'Meta Ads'
      when 'klaviyo' then 'Klaviyo'
      when 'instagram' then 'Instagram'
      else 'la integración'
    end || coalesce(' (' || nullif(connection.provider_account_name, '') || ')', '') as provider_text
  from public.alerts alert
  join public.alert_rule_templates template on template.id = alert.rule_template_id
  join public.integration_connections connection on connection.id = alert.source_entity_id
  where template.code = 'integration_sync_failed'
    and alert.status in ('open', 'acknowledged')
    and alert.source_entity_type = 'integration_connection'
)
update public.tasks task
set
  title = left('Revisar la conexión de ' || live.provider_text, 255),
  description = 'Entra en Integraciones y comprueba la conexión. Si te pide volver a conectarla, hazlo: el histórico no se pierde.'
from live
where task.alert_id = live.alert_id
  and task.status not in ('completed', 'cancelled', 'ignored')
  and task.title is distinct from left('Revisar la conexión de ' || live.provider_text, 255);
