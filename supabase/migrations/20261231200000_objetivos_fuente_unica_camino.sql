-- Mi Camino es la unica fuente de objetivos (decision de Rafa, 2026-10-19).
--
-- Hasta ahora habia dos escritores sobre organization_metric_targets que no se
-- hablaban: Configuracion (claves net_revenue_ex_tax, aov_ex_tax, cac_blended;
-- apilaba filas sin cerrar la anterior) y Mi Camino (claves net_sales, aov,
-- cac; cerraba con valid_until = ayer). El panel buscaba por una clave y el
-- Camino por otra, asi que el mismo objetivo existia dos veces con dos cifras.
-- Desde aqui solo escribe Mi Camino, con el vocabulario del panel.
--
-- Idempotente: se puede reaplicar sin dano (ver CLAUDE.md, Migraciones).

-- 1. Un solo vocabulario de metricas. Si en el mismo alcance y dia ya existe la
--    fila con la clave nueva, la antigua sobra (el trigger de auditoria guarda
--    su old_data); si no, se renombra.
delete from public.organization_metric_targets legacy
using (values ('net_sales', 'net_revenue_ex_tax'), ('aov', 'aov_ex_tax'), ('cac', 'cac_blended'))
  as alias(old_key, new_key)
where legacy.metric_key = alias.old_key
  and exists (
    select 1
    from public.organization_metric_targets canonical
    where canonical.organization_id = legacy.organization_id
      and canonical.store_id is not distinct from legacy.store_id
      and canonical.milestone_id is not distinct from legacy.milestone_id
      and canonical.metric_key = alias.new_key
      and canonical.period = legacy.period
      and canonical.valid_from = legacy.valid_from
  );

update public.organization_metric_targets target
set metric_key = alias.new_key
from (values ('net_sales', 'net_revenue_ex_tax'), ('aov', 'aov_ex_tax'), ('cac', 'cac_blended'))
  as alias(old_key, new_key)
where target.metric_key = alias.old_key;

-- Los tipos de objetivo del consultor que apuntaban a una clave antigua. El CAC
-- pasa a ser el de todas las plataformas, que se calcula desde Shopify.
update public.objective_definitions definition
set metric_key = alias.new_key,
    source = case when alias.new_key = 'cac_blended' then 'shopify' else definition.source end
from (values ('net_sales', 'net_revenue_ex_tax'), ('aov', 'aov_ex_tax'), ('cac', 'cac_blended'))
  as alias(old_key, new_key)
where definition.metric_key = alias.old_key;

-- 2. Un objetivo vigente por alcance. Configuracion insertaba una fila nueva sin
--    cerrar la anterior: se cierra cada una en la fecha en que empezo la siguiente.
update public.organization_metric_targets older
set valid_until = newer.valid_from
from public.organization_metric_targets newer
where older.valid_until is null
  and newer.valid_until is null
  and newer.id <> older.id
  and newer.organization_id = older.organization_id
  and newer.store_id is not distinct from older.store_id
  and newer.milestone_id is not distinct from older.milestone_id
  and newer.metric_key = older.metric_key
  and newer.period = older.period
  and newer.valid_from > older.valid_from;

comment on table public.organization_metric_targets is
  'Objetivos de negocio. Solo los escribe Mi Camino (/objectives); Configuracion y el panel los leen. milestone_id null = objetivo vigente de la tienda/organizacion; con hito = meta de ese hito, que no se pinta en el panel.';

-- 3. Registro de cambios de objetivos hechos por personas. Es lo que lee la
--    revision del Camino para saber que ha cambiado y proponer ajustes, y lo que
--    explica en la pantalla quien cambio que.
create table if not exists public.camino_objective_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  plan_id uuid references public.strategic_plans (id) on delete cascade,
  -- Sin FK: quitar un objetivo borra su fila y el cambio debe seguir aqui.
  target_id uuid,
  milestone_id uuid references public.strategic_plan_milestones (id) on delete set null,
  scope text not null,
  metric_key varchar(80) not null,
  metric_label text,
  period varchar(20),
  action text not null,
  previous_value numeric,
  new_value numeric,
  reason text,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role text not null,
  created_at timestamptz not null default now(),
  constraint camino_objective_changes_scope check (scope in ('objective', 'plan_goal')),
  constraint camino_objective_changes_action check (action in ('created', 'updated', 'removed')),
  constraint camino_objective_changes_actor_role check (actor_role in ('consultant', 'client')),
  constraint camino_objective_changes_reason_length check (reason is null or char_length(reason) <= 500)
);

create index if not exists camino_objective_changes_org_created_idx
  on public.camino_objective_changes (organization_id, created_at desc);

alter table public.camino_objective_changes enable row level security;
drop policy if exists camino_objective_changes_select_authorized on public.camino_objective_changes;
create policy camino_objective_changes_select_authorized
  on public.camino_objective_changes for select to authenticated
  using (private.can_access_org(organization_id));
grant select on public.camino_objective_changes to authenticated;

comment on table public.camino_objective_changes is
  'Historial append-only de cambios de objetivos de Mi Camino (objetivos y meta del plan), con autor y rol. Escritura solo via API con service role.';

-- 4. La revision del Camino ya no es solo periodica: un cambio de objetivo la
--    dispara fuera de ciclo. trigger_key separa esas revisiones de la periodica
--    ('' = periodica; 'objectives:<ms>' = la del cambio que la disparo).
alter table public.strategic_plan_weekly_reviews
  add column if not exists trigger_kind text not null default 'scheduled',
  add column if not exists trigger_key text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.strategic_plan_weekly_reviews'::regclass
      and conname = 'strategic_plan_weekly_reviews_trigger_kind'
  ) then
    alter table public.strategic_plan_weekly_reviews
      add constraint strategic_plan_weekly_reviews_trigger_kind
      check (trigger_kind in ('scheduled', 'objective_change'));
  end if;
end;
$$;

alter table public.strategic_plan_weekly_reviews
  drop constraint if exists strategic_plan_weekly_reviews_unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.strategic_plan_weekly_reviews'::regclass
      and conname = 'strategic_plan_weekly_reviews_unique_trigger'
  ) then
    alter table public.strategic_plan_weekly_reviews
      add constraint strategic_plan_weekly_reviews_unique_trigger
      unique (plan_id, review_week_start, trigger_key);
  end if;
end;
$$;
