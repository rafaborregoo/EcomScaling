-- Gastos propios de EcomScaling. No pertenecen a una organización cliente y
-- solo se sirven a platform_admin a través del API con service_role.

create table if not exists private.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  vendor varchar(160),
  category varchar(40) not null default 'other'
    check (category in (
      'software', 'hosting', 'ai', 'accounting', 'marketing', 'banking',
      'contractors', 'insurance', 'taxes', 'office', 'travel', 'other'
    )),
  amount numeric(14,2) not null check (amount > 0),
  tax_amount numeric(14,2) not null default 0
    check (tax_amount >= 0 and tax_amount <= amount),
  currency_code varchar(3) not null default 'EUR',
  billing_period varchar(20) not null default 'one_time'
    check (billing_period in ('one_time', 'monthly', 'yearly')),
  starts_on date not null default current_date,
  ends_on date,
  deductible boolean not null default true,
  notes text,
  document_url text,
  status varchar(20) not null default 'active'
    check (status in ('active', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_expenses_dates_valid
    check (ends_on is null or ends_on >= starts_on)
);

create index if not exists platform_expenses_status_dates_idx
  on private.platform_expenses (status, starts_on, ends_on);
create index if not exists platform_expenses_category_idx
  on private.platform_expenses (category, currency_code);

drop trigger if exists set_platform_expenses_updated_at
  on private.platform_expenses;
create trigger set_platform_expenses_updated_at
before update on private.platform_expenses
for each row execute function private.set_updated_at();

alter table private.platform_expenses enable row level security;
revoke all on table private.platform_expenses from anon, authenticated;
grant select, insert, update, delete on table private.platform_expenses
  to service_role;

comment on table private.platform_expenses is
  'Gastos de la plataforma EcomScaling: puntuales o recurrentes. Acceso exclusivo por API de platform_admin.';
