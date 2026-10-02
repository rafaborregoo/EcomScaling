create table if not exists public.platform_health_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'slow', 'sync', 'other')),
  satisfaction smallint check (satisfaction between 1 and 5),
  message text not null check (char_length(message) between 8 and 2000),
  page_path text check (page_path is null or char_length(page_path) <= 300),
  request_id text check (request_id is null or char_length(request_id) <= 128),
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists platform_health_feedback_created_at_idx
  on public.platform_health_feedback (created_at desc);
create index if not exists platform_health_feedback_organization_created_idx
  on public.platform_health_feedback (organization_id, created_at desc);

alter table public.platform_health_feedback enable row level security;

-- Los usuarios envían informes a través de la API, que valida membership y
-- usa service_role. El navegador no tiene acceso directo a esta tabla.
revoke all on public.platform_health_feedback from anon, authenticated;
grant select, insert, update on public.platform_health_feedback to service_role;
