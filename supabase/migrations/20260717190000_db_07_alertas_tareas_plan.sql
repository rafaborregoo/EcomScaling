-- DB-07: alertas, tareas y plan estrategico (Mi Camino) segun contrato DBML v0.2.
-- Reglas globales (templates) + overrides por organizacion, alertas idempotentes
-- por fingerprint, tareas con historial de estados automatico y visibilidad
-- cliente/consultor, y estructura de planes con notas internas solo-consultor.
-- Lectura via RLS; escritura via API con service role + chequeo de rol.

create type public.task_status as enum ('pending', 'in_progress', 'completed', 'ignored', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_source as enum ('manual', 'alert', 'consulting_call', 'strategic_plan', 'ai_consultant', 'system');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type public.alert_severity as enum ('info', 'low', 'medium', 'high', 'critical');
create type public.plan_status as enum ('draft', 'active', 'completed', 'archived');
create type public.plan_phase_status as enum ('locked', 'pending', 'active', 'completed');
create type public.milestone_status as enum ('locked', 'pending', 'in_progress', 'completed', 'skipped');

create table public.alert_rule_templates (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  description text,
  metric_code varchar(120),
  default_severity public.alert_severity not null,
  default_lookback_days int,
  default_condition jsonb not null,
  alert_title_template text not null,
  alert_message_template text not null,
  task_title_template text,
  task_description_template text,
  is_active boolean not null default true,
  phase int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null references public.alert_rule_templates (id) on delete cascade,
  is_enabled boolean not null default true,
  severity_override public.alert_severity,
  condition_override jsonb,
  configured_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_alert_rules_unique unique (organization_id, template_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_template_id uuid references public.alert_rule_templates (id) on delete set null,
  organization_rule_id uuid references public.organization_alert_rules (id) on delete set null,
  source_entity_type varchar(100),
  source_entity_id uuid,
  status public.alert_status not null default 'open',
  severity public.alert_severity not null,
  title varchar(255) not null,
  message text not null,
  metric_code varchar(120),
  metric_value numeric(16, 4),
  threshold_value numeric(16, 4),
  context_data jsonb,
  fingerprint varchar(255),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  source public.task_source not null,
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  title varchar(255) not null,
  description text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  ignored_at timestamptz,
  ignored_reason text,
  is_visible_to_client boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  previous_status public.task_status,
  new_status public.task_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategic_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(255) not null,
  description text,
  status public.plan_status not null default 'draft',
  version int not null default 1,
  starts_on date,
  completed_on date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategic_plan_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.strategic_plans (id) on delete cascade,
  name varchar(255) not null,
  description text,
  position int not null,
  status public.plan_phase_status not null default 'locked',
  activated_at timestamptz,
  completed_at timestamptz,
  activated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategic_plan_phases_unique_position unique (plan_id, position)
);

create table public.strategic_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phase_id uuid not null references public.strategic_plan_phases (id) on delete cascade,
  name varchar(255) not null,
  description text,
  position int not null,
  status public.milestone_status not null default 'locked',
  target_date date,
  activated_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategic_plan_milestones_unique_position unique (phase_id, position)
);

create table public.milestone_task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  milestone_id uuid not null references public.strategic_plan_milestones (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint milestone_task_links_unique unique (milestone_id, task_id)
);

create table public.milestone_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  milestone_id uuid not null references public.strategic_plan_milestones (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_alert_rules_organization_id_idx on public.organization_alert_rules (organization_id);
create index alerts_organization_id_idx on public.alerts (organization_id);
create index alerts_status_idx on public.alerts (status);
create index alerts_severity_idx on public.alerts (severity);
create index alerts_fingerprint_idx on public.alerts (fingerprint);
create index alerts_org_status_severity_idx on public.alerts (organization_id, status, severity);
-- Idempotencia del motor de reglas: una alerta viva por fingerprint y organizacion.
create unique index alerts_unique_live_fingerprint
on public.alerts (organization_id, fingerprint)
where fingerprint is not null and status in ('open', 'acknowledged');
create index tasks_organization_id_idx on public.tasks (organization_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_idx on public.tasks (status);
create index tasks_priority_idx on public.tasks (priority);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_org_status_priority_idx on public.tasks (organization_id, status, priority);
-- Una alerta genera como maximo una tarea (criterio de cierre DB-07/BE-05).
create unique index tasks_unique_alert on public.tasks (alert_id) where alert_id is not null;
create index task_status_history_task_id_idx on public.task_status_history (task_id);
create index task_status_history_organization_id_idx on public.task_status_history (organization_id);
create index task_comments_task_id_idx on public.task_comments (task_id);
create index task_comments_organization_id_idx on public.task_comments (organization_id);
create index strategic_plans_organization_id_idx on public.strategic_plans (organization_id);
create index strategic_plans_status_idx on public.strategic_plans (status);
create index strategic_plan_phases_organization_id_idx on public.strategic_plan_phases (organization_id);
create index strategic_plan_milestones_organization_id_idx on public.strategic_plan_milestones (organization_id);
create index milestone_task_links_organization_id_idx on public.milestone_task_links (organization_id);
create index milestone_internal_notes_milestone_id_idx on public.milestone_internal_notes (milestone_id);
create index milestone_internal_notes_organization_id_idx on public.milestone_internal_notes (organization_id);

create trigger set_alert_rule_templates_updated_at
before update on public.alert_rule_templates
for each row execute function private.set_updated_at();

create trigger set_organization_alert_rules_updated_at
before update on public.organization_alert_rules
for each row execute function private.set_updated_at();

create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function private.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function private.set_updated_at();

create trigger set_task_comments_updated_at
before update on public.task_comments
for each row execute function private.set_updated_at();

create trigger set_strategic_plans_updated_at
before update on public.strategic_plans
for each row execute function private.set_updated_at();

create trigger set_strategic_plan_phases_updated_at
before update on public.strategic_plan_phases
for each row execute function private.set_updated_at();

create trigger set_strategic_plan_milestones_updated_at
before update on public.strategic_plan_milestones
for each row execute function private.set_updated_at();

create trigger set_milestone_internal_notes_updated_at
before update on public.milestone_internal_notes
for each row execute function private.set_updated_at();

-- Integridad cross-org (criterio: no enlazar tarea de A con alerta/hito/plan de B).
create or replace function private.enforce_task_alert_same_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.alert_id is not null then
    if not exists (
      select 1 from public.alerts a
      where a.id = new.alert_id and a.organization_id = new.organization_id
    ) then
      raise exception 'task alert must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_alert_same_org() from public;

create trigger enforce_task_alert_same_org
before insert or update of alert_id on public.tasks
for each row execute function private.enforce_task_alert_same_org();

create or replace function private.enforce_milestone_task_link_same_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.strategic_plan_milestones m
    where m.id = new.milestone_id and m.organization_id = new.organization_id
  ) then
    raise exception 'milestone must belong to the same organization';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.organization_id = new.organization_id
  ) then
    raise exception 'task must belong to the same organization';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_milestone_task_link_same_org() from public;

create trigger enforce_milestone_task_link_same_org
before insert or update on public.milestone_task_links
for each row execute function private.enforce_milestone_task_link_same_org();

-- Historial automatico de estados: cualquier cambio de tasks.status deja fila,
-- venga del API, del motor de reglas o de un update manual con service role.
create or replace function private.record_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (organization_id, task_id, previous_status, new_status, changed_by)
    values (new.organization_id, new.id, null, new.status, coalesce(auth.uid(), new.created_by));
  elsif new.status is distinct from old.status then
    insert into public.task_status_history (organization_id, task_id, previous_status, new_status, changed_by)
    values (new.organization_id, new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.record_task_status_change() from public;

create trigger record_task_status_change
after insert or update of status on public.tasks
for each row execute function private.record_task_status_change();

alter table public.alert_rule_templates enable row level security;
alter table public.organization_alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_comments enable row level security;
alter table public.strategic_plans enable row level security;
alter table public.strategic_plan_phases enable row level security;
alter table public.strategic_plan_milestones enable row level security;
alter table public.milestone_task_links enable row level security;
alter table public.milestone_internal_notes enable row level security;

create policy "alert_rule_templates_select_all"
on public.alert_rule_templates
for select
to authenticated
using (true);

create policy "organization_alert_rules_select_authorized"
on public.organization_alert_rules
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "alerts_select_authorized"
on public.alerts
for select
to authenticated
using (private.can_access_org(organization_id));

-- Tareas internas del consultor no se exponen al cliente (criterio FE-03).
create policy "tasks_select_authorized"
on public.tasks
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    is_visible_to_client
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "task_status_history_select_authorized"
on public.task_status_history
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "task_comments_select_authorized"
on public.task_comments
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    not is_internal
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "strategic_plans_select_authorized"
on public.strategic_plans
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "strategic_plan_phases_select_authorized"
on public.strategic_plan_phases
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "strategic_plan_milestones_select_authorized"
on public.strategic_plan_milestones
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "milestone_task_links_select_authorized"
on public.milestone_task_links
for select
to authenticated
using (private.can_access_org(organization_id));

-- Notas internas de hitos: solo consultores asignados y platform admins.
create policy "milestone_internal_notes_select_consultants"
on public.milestone_internal_notes
for select
to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
);

grant select on public.alert_rule_templates to authenticated;
grant select on public.organization_alert_rules to authenticated;
grant select on public.alerts to authenticated;
grant select on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;
grant select on public.task_comments to authenticated;
grant select on public.strategic_plans to authenticated;
grant select on public.strategic_plan_phases to authenticated;
grant select on public.strategic_plan_milestones to authenticated;
grant select on public.milestone_task_links to authenticated;
grant select on public.milestone_internal_notes to authenticated;

comment on table public.alert_rule_templates is 'Reglas globales: ROAS bajo, stock cero, sin campana, flow sin envios, etc.';
comment on table public.milestone_internal_notes is 'Solo visibles para consultores y administradores.';

-- Plantillas iniciales del motor de reglas (fase 1: solo datos Shopify + sync).
insert into public.alert_rule_templates
  (code, name, description, metric_code, default_severity, default_lookback_days, default_condition, alert_title_template, alert_message_template, task_title_template, task_description_template)
values
  (
    'shopify_stock_out',
    'Productos sin stock',
    'Detecta items activos con stock 0 en Shopify.',
    'out_of_stock_items',
    'high',
    null,
    '{"operator": ">", "threshold": 0}',
    'Tienes {metric_value} productos sin stock',
    'Hay {metric_value} items activos con stock 0. Cada dia sin stock es venta perdida y hunde el ranking del producto.',
    'Reponer productos sin stock',
    'Revisa los {metric_value} items agotados en la seccion Shopify y decide reposicion o pausa de campanas que apunten a ellos.'
  ),
  (
    'integration_sync_failed',
    'Sincronizacion fallida',
    'Detecta conexiones de integracion en estado de error.',
    'failed_connections',
    'critical',
    null,
    '{"operator": ">", "threshold": 0}',
    'Una integracion ha dejado de sincronizar',
    'La conexion {context_provider} esta en error: los datos del dashboard pueden estar desactualizados. Motivo: {context_error}',
    'Reconectar integracion {context_provider}',
    'Entra en Integraciones y reautoriza la conexion. Si el error persiste, contacta con soporte.'
  ),
  (
    'shopify_revenue_drop',
    'Caida de facturacion',
    'Compara la facturacion neta de los ultimos 7 dias contra los 7 anteriores.',
    'net_sales_wow_change_pct',
    'medium',
    14,
    '{"operator": "<", "threshold": -30}',
    'La facturacion ha caido un {metric_value_abs}% semana contra semana',
    'Ventas netas de los ultimos 7 dias: {context_current}. Semana anterior: {context_previous}. Caida superior al {threshold_abs}% configurado.',
    'Investigar caida de facturacion',
    'Revisa campanas activas, stock de los productos top y posibles incidencias de la tienda. Documenta la causa en los comentarios.'
  );
