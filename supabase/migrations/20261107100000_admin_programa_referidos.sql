-- Vista de platform_admin del programa de consultores: cada consultor con su
-- codigo (o sin el) y sus cifras. Reusa `consultant_referral_summary` para que
-- el panel del consultor y el de admin cuenten lo mismo.

drop function if exists public.admin_referral_program();
create or replace function public.admin_referral_program()
returns table (
  consultant_user_id uuid,
  consultant_name text,
  code text,
  discount_percent integer,
  discount_months integer,
  is_active boolean,
  registrados bigint,
  activos bigint,
  cancelados bigint,
  leads bigint
)
language sql
stable
as $$
  select
    p.id,
    p.full_name::text,
    c.code,
    c.discount_percent,
    c.discount_months,
    c.is_active,
    coalesce(s.registrados, 0),
    coalesce(s.activos, 0),
    coalesce(s.cancelados, 0),
    coalesce(s.leads, 0)
  from public.profiles p
  left join public.referral_codes c on c.consultant_user_id = p.id
  left join lateral public.consultant_referral_summary(p.id) s on true
  where p.platform_role = 'consultant' or c.id is not null
  order by p.full_name nulls last;
$$;

alter function public.admin_referral_program() set search_path = pg_catalog, public;

revoke execute on function public.admin_referral_program() from public, anon, authenticated;
grant execute on function public.admin_referral_program() to service_role;
