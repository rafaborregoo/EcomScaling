-- A19: cada Camino pertenece a una tienda Shopify concreta o al agregado
-- organizativo (NULL). Hitos/tareas heredan el alcance mediante plan_id.
alter table public.strategic_plans
  add column if not exists store_id uuid references public.shopify_stores(id) on delete cascade;

create index if not exists strategic_plans_org_store_version_idx
  on public.strategic_plans (organization_id, store_id, version desc);

comment on column public.strategic_plans.store_id is
  'Alcance de Mi Camino. NULL representa explícitamente el agregado de la organización; si tiene ID, el plan y sus revisiones corresponden a esa tienda Shopify.';
;
