-- Marketing → Flows: flows diseñados a mano en NORA antes de crearlos en
-- Klaviyo. El diseño es nuestro (pasos, ramas, piezas del Estudio); lo que se
-- manda a Klaviyo se deriva de él al crear, así que no se guarda aparte.
-- Las escrituras pasan por la API (service role + chequeo de rol), igual que
-- marketing_content_drafts: aquí solo hay lectura para el mismo público.

create table if not exists public.marketing_flow_designs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid references public.integration_connections (id) on delete set null,
  name varchar(255) not null,
  design jsonb not null,
  status text not null default 'draft',
  klaviyo_flow_id varchar(255),
  pushed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_flow_designs
  drop constraint if exists marketing_flow_designs_status_check;
alter table public.marketing_flow_designs
  add constraint marketing_flow_designs_status_check check (status in ('draft', 'in_klaviyo'));

create index if not exists marketing_flow_designs_org_updated_idx
  on public.marketing_flow_designs (organization_id, updated_at desc);

drop trigger if exists set_marketing_flow_designs_updated_at on public.marketing_flow_designs;
create trigger set_marketing_flow_designs_updated_at
before update on public.marketing_flow_designs
for each row execute function private.set_updated_at();

alter table public.marketing_flow_designs enable row level security;

drop policy if exists "marketing_flow_designs_select_workspace" on public.marketing_flow_designs;
create policy "marketing_flow_designs_select_workspace" on public.marketing_flow_designs for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner', 'manager')
);

revoke all on public.marketing_flow_designs from anon;
grant select on public.marketing_flow_designs to authenticated;
grant all on public.marketing_flow_designs to service_role;

comment on table public.marketing_flow_designs is
  'Flows de Klaviyo diseñados en NORA (Marketing → Flows). Se crean en Klaviyo en borrador desde la API.';
