-- Fase 2: calendario operativo y snapshots KPI.
-- El calendario es tenant-scoped: organization_id obligatorio y store_id
-- opcional (null = todas las tiendas de esa organizacion).

create table if not exists public.campaign_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  name varchar(255) not null,
  year smallint not null,
  status varchar(30) not null default 'draft',
  description text,
  is_visible_to_client boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_calendars_year_valid check (year between 2000 and 2200),
  constraint campaign_calendars_status_valid check (status in ('draft', 'active', 'completed', 'archived'))
);

create table if not exists public.campaign_calendar_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  calendar_id uuid not null references public.campaign_calendars (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  title varchar(255) not null,
  description text,
  channel varchar(50) not null,
  item_type varchar(50) not null default 'campaign',
  starts_at timestamptz not null,
  ends_at timestamptz,
  status varchar(30) not null default 'planned',
  is_visible_to_client boolean not null default true,
  task_id uuid references public.tasks (id) on delete set null,
  milestone_id uuid references public.strategic_plan_milestones (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_calendar_items_status_valid check (status in ('planned', 'in_progress', 'published', 'completed', 'cancelled')),
  constraint campaign_calendar_items_dates_valid check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  period varchar(20) not null default 'weekly',
  period_start date not null,
  period_end date not null,
  net_sales numeric(14, 2),
  orders_count integer,
  aov numeric(14, 2),
  ad_spend numeric(14, 2),
  roas numeric(14, 4),
  cac numeric(14, 2),
  net_profit numeric(14, 2),
  notes text,
  captured_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpi_snapshots_period_valid check (period in ('weekly', 'monthly', 'quarterly', 'yearly')),
  constraint kpi_snapshots_dates_valid check (period_end >= period_start),
  constraint kpi_snapshots_non_negative_orders check (orders_count is null or orders_count >= 0),
  constraint kpi_snapshots_unique_period unique (organization_id, store_id, period, period_start, period_end)
);

create index if not exists campaign_calendars_org_year_idx on public.campaign_calendars (organization_id, year);
create index if not exists campaign_calendars_store_idx on public.campaign_calendars (store_id);
create index if not exists campaign_calendar_items_org_dates_idx on public.campaign_calendar_items (organization_id, starts_at, ends_at);
create index if not exists campaign_calendar_items_calendar_idx on public.campaign_calendar_items (calendar_id, starts_at);
create index if not exists campaign_calendar_items_store_idx on public.campaign_calendar_items (store_id);
create index if not exists campaign_calendar_items_task_idx on public.campaign_calendar_items (task_id);
create index if not exists kpi_snapshots_org_period_idx on public.kpi_snapshots (organization_id, period, period_start desc);
create index if not exists kpi_snapshots_store_idx on public.kpi_snapshots (store_id, period_start desc);

drop trigger if exists set_campaign_calendars_updated_at on public.campaign_calendars;
create trigger set_campaign_calendars_updated_at
before update on public.campaign_calendars
for each row execute function private.set_updated_at();

drop trigger if exists set_campaign_calendar_items_updated_at on public.campaign_calendar_items;
create trigger set_campaign_calendar_items_updated_at
before update on public.campaign_calendar_items
for each row execute function private.set_updated_at();

drop trigger if exists set_kpi_snapshots_updated_at on public.kpi_snapshots;
create trigger set_kpi_snapshots_updated_at
before update on public.kpi_snapshots
for each row execute function private.set_updated_at();

create or replace function private.enforce_campaign_calendar_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_id is not null and not exists (
    select 1 from public.shopify_stores s
    where s.id = new.store_id and s.organization_id = new.organization_id
  ) then
    raise exception 'store must belong to the same organization';
  end if;
  if tg_table_name = 'campaign_calendar_items' then
    if not exists (
      select 1 from public.campaign_calendars c
      where c.id = new.calendar_id and c.organization_id = new.organization_id
    ) then
      raise exception 'calendar must belong to the same organization';
    end if;
    if exists (
      select 1 from public.campaign_calendars c
      where c.id = new.calendar_id and c.store_id is not null
        and new.store_id is distinct from c.store_id
    ) then
      raise exception 'item store must match calendar store';
    end if;
    if new.task_id is not null and not exists (
      select 1 from public.tasks t
      where t.id = new.task_id and t.organization_id = new.organization_id
    ) then
      raise exception 'task must belong to the same organization';
    end if;
    if new.milestone_id is not null and not exists (
      select 1 from public.strategic_plan_milestones m
      where m.id = new.milestone_id and m.organization_id = new.organization_id
    ) then
      raise exception 'milestone must belong to the same organization';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_campaign_calendar_scope() from public;

drop trigger if exists enforce_campaign_calendars_scope on public.campaign_calendars;
create trigger enforce_campaign_calendars_scope
before insert or update on public.campaign_calendars
for each row execute function private.enforce_campaign_calendar_scope();

drop trigger if exists enforce_campaign_calendar_items_scope on public.campaign_calendar_items;
create trigger enforce_campaign_calendar_items_scope
before insert or update on public.campaign_calendar_items
for each row execute function private.enforce_campaign_calendar_scope();

drop trigger if exists enforce_kpi_snapshots_scope on public.kpi_snapshots;
create trigger enforce_kpi_snapshots_scope
before insert or update on public.kpi_snapshots
for each row execute function private.enforce_campaign_calendar_scope();

alter table public.campaign_calendars enable row level security;
alter table public.campaign_calendar_items enable row level security;
alter table public.kpi_snapshots enable row level security;

drop policy if exists "campaign_calendars_select_authorized" on public.campaign_calendars;
create policy "campaign_calendars_select_authorized" on public.campaign_calendars for select to authenticated
using (
  private.can_access_org(organization_id)
  and (is_visible_to_client or private.is_platform_admin() or private.is_assigned_consultant(organization_id))
);

drop policy if exists "campaign_calendar_items_select_authorized" on public.campaign_calendar_items;
create policy "campaign_calendar_items_select_authorized" on public.campaign_calendar_items for select to authenticated
using (
  private.can_access_org(organization_id)
  and (is_visible_to_client or private.is_platform_admin() or private.is_assigned_consultant(organization_id))
  and exists (
    select 1 from public.campaign_calendars c
    where c.id = calendar_id
      and c.organization_id = organization_id
      and (c.is_visible_to_client or private.is_platform_admin() or private.is_assigned_consultant(organization_id))
  )
);

drop policy if exists "kpi_snapshots_select_authorized" on public.kpi_snapshots;
create policy "kpi_snapshots_select_authorized" on public.kpi_snapshots for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.campaign_calendars to authenticated;
grant select on public.campaign_calendar_items to authenticated;
grant select on public.kpi_snapshots to authenticated;

comment on table public.campaign_calendars is 'Calendario de campañas por organización; store_id null significa todas las tiendas.';
comment on table public.campaign_calendar_items is 'Acciones de campaña enlazables a una tarea y/o hito de Mi Camino.';
comment on table public.kpi_snapshots is 'Snapshot manual o consolidado de KPI para comparar periodos sin mutar el histórico sincronizado.';
