-- Categorizacion de tareas por modulo (Shopify/Meta/Klaviyo/general), a peticion
-- de Rafa: hoy solo existe Shopify, pero cuando se activen Meta/Klaviyo (A03/A05/
-- A07) el consultor necesita distinguir de un vistazo a que integracion
-- corresponde cada tarea sin abrir cada una. La categoria es determinista (la
-- decide el modulo que crea la tarea: agente IA, motor de reglas o el
-- consultor al crearla a mano), nunca algo que el LLM "adivina" en el texto.

alter table public.tasks
  add column category varchar(20) not null default 'general',
  add constraint tasks_category check (category in ('shopify', 'meta', 'klaviyo', 'general'));

create index tasks_organization_category_idx on public.tasks (organization_id, category);

alter table public.alert_rule_templates
  add column category varchar(20) not null default 'general',
  add constraint alert_rule_templates_category check (category in ('shopify', 'meta', 'klaviyo', 'general'));

update public.alert_rule_templates set category = 'shopify' where code in ('shopify_stock_out', 'shopify_revenue_drop');
-- 'integration_sync_failed' se deja en 'general': el proveedor real (shopify/meta/klaviyo)
-- solo se conoce en tiempo de deteccion via {context_provider}, no en la plantilla.
