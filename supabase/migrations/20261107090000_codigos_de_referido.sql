-- Programa de consultores: codigo de referido publico.
--
-- NO es la vinculacion (`client_invites` + `consultant_assignments`). Aquella
-- es de un solo uso porque da acceso a la tienda; esta es un enlace que el
-- consultor reparte donde quiera (`/r/ricardo`) y por eso NO da acceso a nada:
--
--   - el cliente recibe un descuento de bienvenida (cupon de Stripe con
--     duracion limitada, ver `vinculacion.ts`);
--   - el consultor queda como quien lo trajo (atribucion, una por cliente);
--   - si el cliente marca la casilla, el consultor puede contactarle. Es un
--     lead, no una asignacion: para llevar la tienda hace falta la invitacion
--     de siempre.
--
-- Escrituras por service role con chequeo manual en el API (ADR-0006 #7).

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  -- Uno por consultor: es "su" enlace, no una campana.
  consultant_user_id uuid not null unique references public.profiles (id) on delete cascade,
  code text not null unique,
  -- El cupon de Stripe se deriva de estos dos: `referido-{pct}-{meses}m`. Lo
  -- ajusta platform_admin, nunca el consultor; el cupon tiene que existir en
  -- Stripe (scripts/stripe-catalogo.mjs crea el de por defecto).
  discount_percent integer not null default 10,
  discount_months integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_code_format check (code ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  constraint referral_codes_discount_range check (discount_percent between 0 and 100 and discount_months between 1 and 36)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes (id) on delete restrict,
  -- Un cliente solo tiene un referidor: el del codigo con el que se registro.
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  -- Consentimiento de contacto (RGPD): se guarda cuando y con que texto. Los
  -- datos de contacto solo se copian si lo dio, y se borran si lo retira.
  contact_consent_at timestamptz,
  contact_consent_revoked_at timestamptz,
  consent_text_version text,
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referral_code_id_idx on public.referrals (referral_code_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- El consultor ve su codigo; los referidos (con datos de contacto) solo pasan
-- por el API, que filtra por consentimiento.
drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own" on public.referral_codes
  for select to authenticated
  using (consultant_user_id = (select auth.uid()));

comment on table public.referral_codes is
  'Codigo de referido publico de cada consultor (/r/<code>). Da descuento y atribucion, nunca acceso a la tienda.';
comment on table public.referrals is
  'Clientes que se registraron con un codigo de referido. Contacto solo con consentimiento vivo.';

-- Referidos de un consultor con su estado de suscripcion. Devuelven `table`:
-- sin el drop, cambiar una columna al reaplicar falla.
drop function if exists public.consultant_referrals(uuid);

create or replace function public.consultant_referrals(p_consultant_user_id uuid)
returns table (
  referral_id uuid,
  organization_name text,
  created_at timestamptz,
  estado text,
  contact_name text,
  contact_email text,
  contact_consent_at timestamptz
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
    case when r.contact_consent_revoked_at is null then r.contact_consent_at end
  from public.referrals r
  join public.referral_codes c on c.id = r.referral_code_id
  join public.organizations o on o.id = r.organization_id
  where c.consultant_user_id = p_consultant_user_id
  order by r.created_at desc;
$$;

alter function public.consultant_referrals(uuid) set search_path = pg_catalog, public;

drop function if exists public.consultant_referral_summary(uuid);
create or replace function public.consultant_referral_summary(p_consultant_user_id uuid)
returns table (registrados bigint, activos bigint, cancelados bigint, leads bigint)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where estado = 'activo'),
    count(*) filter (where estado = 'cancelado'),
    count(*) filter (where contact_consent_at is not null)
  from public.consultant_referrals(p_consultant_user_id);
$$;

alter function public.consultant_referral_summary(uuid) set search_path = pg_catalog, public;

-- Reciben un consultor arbitrario: solo el API (service role) las llama.
revoke execute on function public.consultant_referrals(uuid) from public, anon, authenticated;
revoke execute on function public.consultant_referral_summary(uuid) from public, anon, authenticated;
grant execute on function public.consultant_referrals(uuid) to service_role;
grant execute on function public.consultant_referral_summary(uuid) to service_role;
