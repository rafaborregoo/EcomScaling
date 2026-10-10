-- Informes PDF: historial y envío mensual programado.
--
-- Hasta ahora un informe solo existía en el mensaje del chat que lo pidió: el
-- PDF quedaba en el bucket `copilot-reports` sin ninguna fila que lo listara.
-- `copilot_reports` es el historial (una fila por PDF, mismo id que el fichero)
-- y `report_schedules` lo que el worker envía el día 1 de cada mes.
--
-- Escrituras siempre desde la API con service role y chequeo de acceso
-- (ADR-0006 §7); RLS solo deja leer a quien accede a la organización.
-- Idempotente: se puede reaplicar con db:push sin daño.

create table if not exists public.copilot_reports (
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete set null,
  template_id text not null,
  template_version text not null default 'v1',
  title text not null,
  period_start date not null,
  period_end date not null,
  currency_code text,
  file_name text not null,
  storage_path text not null,
  -- copilot = pedido en el chat; scheduled = envío mensual; portfolio = cartera del consultor.
  source text not null default 'copilot' check (source in ('copilot', 'scheduled', 'portfolio')),
  requested_by uuid references public.profiles (id) on delete set null,
  prepared_by text,
  highlights jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  key_metrics jsonb not null default '[]'::jsonb,
  emailed_to text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists copilot_reports_org_created_idx
  on public.copilot_reports (organization_id, created_at desc);

alter table public.copilot_reports enable row level security;

drop policy if exists copilot_reports_select on public.copilot_reports;
create policy copilot_reports_select on public.copilot_reports
  for select to authenticated using (private.can_access_org(organization_id));

grant select on public.copilot_reports to authenticated;

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id text not null,
  store_id uuid references public.shopify_stores (id) on delete set null,
  recipients text[] not null default '{}',
  is_active boolean not null default true,
  -- Último mes enviado (fin de periodo): evita repetir si el job se relanza.
  last_period_end date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_id)
);

alter table public.report_schedules enable row level security;

drop policy if exists report_schedules_select on public.report_schedules;
create policy report_schedules_select on public.report_schedules
  for select to authenticated using (private.can_access_org(organization_id));

grant select on public.report_schedules to authenticated;
