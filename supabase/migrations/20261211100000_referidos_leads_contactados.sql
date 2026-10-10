-- Leads de captación: el consultor marca los que ya ha llamado.
-- `contacted_at` es del consultor, no del cliente: no se borra al retirar el
-- consentimiento, que ya anula nombre y email en `consultant_referrals`.

alter table public.referrals add column if not exists contacted_at timestamptz;

comment on column public.referrals.contacted_at is
  'Cuando el consultor marco el lead como contactado. Null = pendiente de llamar.';

-- Devuelven `table`: sin el drop, cambiar una columna al reaplicar falla.
drop function if exists public.consultant_referrals(uuid);

create or replace function public.consultant_referrals(p_consultant_user_id uuid)
returns table (
  referral_id uuid,
  organization_name text,
  created_at timestamptz,
  estado text,
  contact_name text,
  contact_email text,
  contact_consent_at timestamptz,
  contacted_at timestamptz
)
language sql
stable
as $$
  select
    r.id,
    o.display_name::text,
    r.created_at,
    case
      when exists (
        select 1 from public.service_subscriptions s
        where s.organization_id = r.organization_id and s.status in ('trial', 'active')
      ) then 'activo'
      when exists (
        select 1 from public.service_subscriptions s
        where s.organization_id = r.organization_id and s.status <> 'pending'
      ) then 'cancelado'
      else 'registrado'
    end,
    case when r.contact_consent_revoked_at is null then r.contact_name end,
    case when r.contact_consent_revoked_at is null then r.contact_email end,
    case when r.contact_consent_revoked_at is null then r.contact_consent_at end,
    r.contacted_at
  from public.referrals r
  join public.referral_codes c on c.id = r.referral_code_id
  join public.organizations o on o.id = r.organization_id
  where c.consultant_user_id = p_consultant_user_id
  order by r.created_at desc;
$$;

alter function public.consultant_referrals(uuid) set search_path = pg_catalog, public;

drop function if exists public.consultant_referral_summary(uuid);
create or replace function public.consultant_referral_summary(p_consultant_user_id uuid)
returns table (registrados bigint, activos bigint, cancelados bigint, leads bigint, leads_pendientes bigint)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where estado = 'activo'),
    count(*) filter (where estado = 'cancelado'),
    count(*) filter (where contact_consent_at is not null),
    count(*) filter (where contact_consent_at is not null and contacted_at is null)
  from public.consultant_referrals(p_consultant_user_id);
$$;

alter function public.consultant_referral_summary(uuid) set search_path = pg_catalog, public;

-- Reciben un consultor arbitrario: solo el API (service role) las llama.
revoke execute on function public.consultant_referrals(uuid) from public, anon, authenticated;
revoke execute on function public.consultant_referral_summary(uuid) from public, anon, authenticated;
grant execute on function public.consultant_referrals(uuid) to service_role;
grant execute on function public.consultant_referral_summary(uuid) to service_role;
