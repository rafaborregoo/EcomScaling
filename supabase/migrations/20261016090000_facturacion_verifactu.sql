-- Facturacion propia de la plataforma y registros SIF/VERI*FACTU.
-- Los datos fiscales y los registros son internos: se sirven solo a traves
-- del API, nunca directamente desde el Data API de Supabase.

create table if not exists private.platform_billing_settings (
  singleton_id boolean primary key default true check (singleton_id),
  legal_name text not null,
  tax_id varchar(40) not null,
  address_line1 text not null,
  address_line2 text,
  postal_code varchar(20) not null,
  city varchar(120) not null,
  region varchar(120),
  country_code varchar(2) not null default 'ES',
  email varchar(255),
  phone varchar(40),
  invoice_series varchar(20) not null default 'F',
  default_vat_rate numeric(5,2) not null default 21,
  prices_include_vat boolean not null default true,
  vat_regime_code varchar(2) not null default '01',
  system_name varchar(120) not null default 'EcomScaling Facturacion',
  system_id varchar(20) not null default 'ECOMSCALING',
  system_version varchar(30) not null default '1.0.0',
  installation_number varchar(100) not null default '1',
  verifactu_enabled boolean not null default false,
  verifactu_environment varchar(12) not null default 'test'
    check (verifactu_environment in ('test', 'production')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.invoice_number_sequences (
  invoice_series varchar(20) not null,
  invoice_year integer not null,
  next_number bigint not null default 1 check (next_number > 0),
  last_verifactu_hash varchar(64),
  last_invoice_code varchar(80),
  last_issue_date date,
  updated_at timestamptz not null default now(),
  primary key (invoice_series, invoice_year)
);

create table if not exists private.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_series varchar(20) not null,
  invoice_year integer not null,
  invoice_number bigint not null,
  invoice_code varchar(80) not null unique,
  invoice_type varchar(20) not null default 'F1'
    check (invoice_type in ('F1', 'R1', 'R2', 'R3', 'R4', 'R5')),
  status varchar(30) not null default 'needs_customer_data'
    check (status in ('draft', 'needs_customer_data', 'issued', 'paid', 'refunded', 'void', 'rectified', 'error')),
  issue_date date not null,
  operation_date date not null,
  issuer_name text not null,
  issuer_tax_id varchar(40) not null,
  issuer_address jsonb not null default '{}'::jsonb,
  customer_name text,
  customer_tax_id varchar(40),
  customer_email varchar(255),
  customer_address jsonb not null default '{}'::jsonb,
  currency_code varchar(3) not null default 'EUR',
  subtotal numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  total numeric(14,2) not null,
  tax_regime_code varchar(2) not null default '01',
  operation_description text not null,
  payment_method varchar(40) not null default 'whop',
  whop_payment_id varchar(200) unique,
  whop_membership_id varchar(200),
  whop_event_id varchar(200),
  verifactu_status varchar(30) not null default 'pending'
    check (verifactu_status in ('pending', 'submitted', 'accepted', 'accepted_with_errors', 'rejected', 'not_configured', 'error')),
  verifactu_hash varchar(64),
  verifactu_previous_hash varchar(64),
  verifactu_previous_invoice_code varchar(80),
  verifactu_previous_issue_date date,
  verifactu_qr_url text,
  verifactu_xml text,
  verifactu_response jsonb,
  verifactu_submitted_at timestamptz,
  pdf_storage_path text,
  rectifies_invoice_id uuid references private.billing_invoices (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_number_positive check (invoice_number > 0),
  constraint billing_invoices_year_valid check (invoice_year between 2020 and 2200)
);

create unique index if not exists billing_invoices_series_year_number_idx
  on private.billing_invoices (invoice_series, invoice_year, invoice_number);
create index if not exists billing_invoices_status_idx
  on private.billing_invoices (status, issue_date desc);
create index if not exists billing_invoices_verifactu_status_idx
  on private.billing_invoices (verifactu_status, created_at);
create index if not exists billing_invoices_customer_email_idx
  on private.billing_invoices (customer_email);

create table if not exists private.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references private.billing_invoices (id) on delete cascade,
  position integer not null,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null,
  vat_rate numeric(5,2) not null default 21 check (vat_rate >= 0 and vat_rate <= 100),
  base_amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  total_amount numeric(14,2) not null,
  verifactu_classification varchar(2) not null default 'S1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (invoice_id, position)
);

create table if not exists private.billing_invoice_events (
  id uuid primary key default gen_random_uuid(),
  provider varchar(40) not null,
  external_event_id varchar(255) not null,
  event_type varchar(120) not null,
  invoice_id uuid references private.billing_invoices (id) on delete set null,
  status varchar(30) not null default 'received'
    check (status in ('received', 'processed', 'failed', 'duplicate')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index if not exists billing_invoice_events_invoice_idx
  on private.billing_invoice_events (invoice_id, created_at desc);
create index if not exists billing_invoice_events_status_idx
  on private.billing_invoice_events (status, created_at);

drop trigger if exists set_platform_billing_settings_updated_at on private.platform_billing_settings;
create trigger set_platform_billing_settings_updated_at
before update on private.platform_billing_settings
for each row execute function private.set_updated_at();

drop trigger if exists set_billing_invoices_updated_at on private.billing_invoices;
create trigger set_billing_invoices_updated_at
before update on private.billing_invoices
for each row execute function private.set_updated_at();

create or replace function private.allocate_billing_invoice_number(
  target_series varchar,
  target_year integer
)
returns table (invoice_number bigint, previous_verifactu_hash varchar, previous_invoice_code varchar, previous_issue_date date)
language plpgsql
security definer
set search_path = private
as $$
begin
  if target_series is null or length(trim(target_series)) = 0 then
    raise exception 'invoice_series_required';
  end if;
  if target_year < 2020 or target_year > 2200 then
    raise exception 'invoice_year_invalid';
  end if;

  insert into private.invoice_number_sequences (invoice_series, invoice_year)
  values (trim(target_series), target_year)
  on conflict (invoice_series, invoice_year) do nothing;

  return query
  update private.invoice_number_sequences
     set next_number = next_number + 1,
         updated_at = now()
   where invoice_series = trim(target_series)
     and invoice_year = target_year
  returning next_number - 1, last_verifactu_hash, last_invoice_code, last_issue_date;
end;
$$;

create or replace function private.set_billing_verifactu_hash(
  target_series varchar,
  target_year integer,
  target_hash varchar,
  target_invoice_code varchar,
  target_issue_date date
)
returns void
language sql
security definer
set search_path = private
as $$
  update private.invoice_number_sequences
     set last_verifactu_hash = target_hash,
         last_invoice_code = target_invoice_code,
         last_issue_date = target_issue_date,
         updated_at = now()
   where invoice_series = trim(target_series)
     and invoice_year = target_year;
$$;

alter table private.platform_billing_settings enable row level security;
alter table private.invoice_number_sequences enable row level security;
alter table private.billing_invoices enable row level security;
alter table private.billing_invoice_lines enable row level security;
alter table private.billing_invoice_events enable row level security;

revoke all on table private.platform_billing_settings from anon, authenticated;
revoke all on table private.invoice_number_sequences from anon, authenticated;
revoke all on table private.billing_invoices from anon, authenticated;
revoke all on table private.billing_invoice_lines from anon, authenticated;
revoke all on table private.billing_invoice_events from anon, authenticated;
grant select, insert, update, delete on table private.platform_billing_settings to service_role;
grant select, insert, update, delete on table private.invoice_number_sequences to service_role;
grant select, insert, update, delete on table private.billing_invoices to service_role;
grant select, insert, update, delete on table private.billing_invoice_lines to service_role;
grant select, insert, update, delete on table private.billing_invoice_events to service_role;
revoke all on function private.allocate_billing_invoice_number(varchar, integer) from public;
revoke all on function private.set_billing_verifactu_hash(varchar, integer, varchar, varchar, date) from public;
grant execute on function private.allocate_billing_invoice_number(varchar, integer) to service_role;
grant execute on function private.set_billing_verifactu_hash(varchar, integer, varchar, varchar, date) to service_role;

comment on table private.billing_invoices is 'Facturas fiscales propias de la plataforma, con snapshot de emisor y cliente.';
comment on table private.billing_invoice_events is 'Idempotencia y trazabilidad de pagos/refunds de Whop y envios VERI*FACTU.';
