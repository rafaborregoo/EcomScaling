-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
alter table public.organization_financial_settings
  add column if not exists klaviyo_revenue_currency_code varchar(3);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_financial_settings_klaviyo_currency_format'
      and conrelid = 'public.organization_financial_settings'::regclass
  ) then
    alter table public.organization_financial_settings
      add constraint organization_financial_settings_klaviyo_currency_format
      check (
        klaviyo_revenue_currency_code is null
        or klaviyo_revenue_currency_code ~ '^[A-Z]{3}$'
      );
  end if;
end;
$$;

comment on column public.organization_financial_settings.klaviyo_revenue_currency_code is
  'Currency explicitly confirmed for Klaviyo attributed revenue. Klaviyo preferred_currency is a display preference and is not accepted as proof of report currency.';
