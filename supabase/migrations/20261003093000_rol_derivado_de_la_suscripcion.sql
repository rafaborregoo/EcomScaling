-- El rol deja de concederse y pasa a derivarse.
--
-- `profiles.platform_role` mezclaba dos cosas que no son la misma:
--
--   1. si alguien lleva la plataforma (staff). Eso no lo otorga ningun plan:
--      es una decision nuestra, y si dependiera de una fila de facturacion,
--      cancelarla dejaria a la plataforma sin administradores.
--   2. si alguien es consultor o cliente. Eso SI es consecuencia de lo que
--      paga, y tenerlo ademas como columna suelta son dos fuentes de verdad
--      que se separan en cuanto una suscripcion caduca: alguien se queda con
--      platform_role = 'consultant' y sin plan que lo respalde, o al reves.
--
-- A partir de aqui:
--   staff     -> profiles.is_platform_staff (explicito, solo lo da otro staff)
--   consultor -> tiene una suscripcion activa A SU NOMBRE
--                (service_subscriptions.user_id), no de una tienda
--   cliente   -> todo lo demas
--
-- Ligar la suscripcion al usuario y no a la organizacion es lo que hace que
-- esto no dependa del catalogo de planes: no hay que saber "que codigos de
-- plan son de consultor", basta con a quien pertenece la fila.
--
-- Esta migracion NO borra platform_role todavia. Añade las fuentes nuevas,
-- rellena, y reapunta las 5 funciones que lo leian. La columna se retira en
-- una migracion posterior, cuando se haya comprobado contra produccion que
-- nadie perdio ni gano acceso.

-- 1. Fuentes nuevas ----------------------------------------------------------

alter table public.profiles
  add column if not exists is_platform_staff boolean not null default false;

alter table public.service_subscriptions
  add column if not exists user_id uuid references public.profiles (id) on delete cascade;

-- La suscripcion de un consultor no cuelga de ninguna tienda.
alter table public.service_subscriptions
  alter column organization_id drop not null;

-- Exactamente una de las dos: o es de una organizacion, o es de una persona.
-- Una fila con las dos (o con ninguna) no se sabe a quien cobrarle.
alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_sujeto_unico;
alter table public.service_subscriptions
  add constraint service_subscriptions_sujeto_unico
  check ((organization_id is not null) <> (user_id is not null));

create index if not exists service_subscriptions_user_idx
  on public.service_subscriptions (user_id)
  where user_id is not null;

-- 2. Backfill ----------------------------------------------------------------
-- Sin esto, al cambiar la fuente todo el mundo pierde su rol de golpe.

update public.profiles
set is_platform_staff = true
where platform_role = 'platform_admin'
  and is_platform_staff = false;

-- Cada consultor de hoy pasa a tener su suscripcion a nombre propio. Los
-- platform_admin tambien: llevan cartera ademas de la plataforma, y sin
-- suscripcion dejarian de ser consultores al reapuntar las funciones.
insert into public.service_subscriptions (user_id, plan_code, status, starts_at)
select p.id, 'consultant', 'active'::public.subscription_status, now()
from public.profiles p
where p.platform_role in ('consultant', 'platform_admin')
  and not exists (
    select 1
    from public.service_subscriptions s
    where s.user_id = p.id
      and s.status in ('trial', 'active')
  );

-- 3. La regla, en un solo sitio ----------------------------------------------

create or replace function private.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_staff
      and p.is_active
  );
$$;

-- Consultor = tiene plan a su nombre. Se mira la vigencia igual que
-- `has_valid_subscription` hace con las de organizacion: un plan caducado deja
-- de dar rol sin que nadie tenga que acordarse de bajar una columna.
create or replace function private.is_consultant(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_subscriptions ss
    join public.profiles p on p.id = ss.user_id
    where ss.user_id = target_user_id
      and ss.status in ('trial', 'active')
      and (ss.starts_at is null or ss.starts_at <= now())
      and (ss.ends_at is null or ss.ends_at > now())
      and p.is_active
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.is_platform_staff
      and p.is_active
  );
$$;

revoke all on function private.is_platform_staff() from public;
revoke all on function private.is_consultant(uuid) from public;
grant execute on function private.is_platform_staff() to authenticated;
grant execute on function private.is_consultant(uuid) to authenticated;

-- 4. Las 5 funciones que leian la columna ------------------------------------
-- Ninguna policy menciona platform_role directamente (comprobado en
-- pg_policies contra produccion): todas pasan por estas.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_staff();
$$;

create or replace function private.is_assigned_consultant(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consultant_assignments ca
    join public.profiles p on p.id = ca.consultant_user_id
    join public.organizations o on o.id = ca.organization_id
    where ca.organization_id = target_organization_id
      and ca.consultant_user_id = auth.uid()
      and ca.is_active
      and p.is_active
      and private.is_consultant(ca.consultant_user_id)
      and o.status in ('onboarding', 'active')
  );
$$;

create or replace function private.assigned_consultant_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  select ca.organization_id
  from public.consultant_assignments ca
  join public.profiles p on p.id = ca.consultant_user_id
  join public.organizations o on o.id = ca.organization_id
  where ca.consultant_user_id = auth.uid()
    and ca.is_active
    and p.is_active
    and private.is_consultant(ca.consultant_user_id)
    and o.status in ('onboarding', 'active');
$fn$;

create or replace function private.accessible_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  select o.id
  from public.organizations o
  where (select private.is_platform_admin())
  union
  select ca.organization_id
  from public.consultant_assignments ca
  join public.profiles p on p.id = ca.consultant_user_id
  join public.organizations o on o.id = ca.organization_id
  where ca.consultant_user_id = auth.uid()
    and ca.is_active
    and p.is_active
    and private.is_consultant(ca.consultant_user_id)
    and o.status in ('onboarding', 'active')
  union
  select om.organization_id
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.is_active
    and o.status in ('onboarding', 'active')
    and exists (
      select 1
      from public.service_subscriptions ss
      where ss.organization_id = om.organization_id
        and ss.status in ('trial', 'active')
        and (ss.starts_at is null or ss.starts_at <= now())
        and (ss.ends_at is null or ss.ends_at > now())
    );
$fn$;

-- El guardarrail de "no te subas el rol a ti mismo" pasa a proteger la bandera
-- nueva. Se deja tambien platform_role mientras la columna siga existiendo.
create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id
    and (
      new.platform_role is distinct from old.platform_role
      or new.is_platform_staff is distinct from old.is_platform_staff
      or new.is_active is distinct from old.is_active
    )
  then
    raise exception 'profiles.is_platform_staff and profiles.is_active cannot be changed by the profile owner';
  end if;

  return new;
end;
$$;

-- 5. Asercion: nadie gana ni pierde acceso -----------------------------------
-- Mismo patron que 20260908190000: para CADA par (usuario, organizacion) de
-- los datos reales, el rol derivado tiene que coincidir con el que decia la
-- columna. Si diverge, la migracion aborta entera y el esquema se queda como
-- estaba -- un permiso de mas aqui es una fuga entre tenants.
-- Lo que se compara NO es "el rol derivado coincide con la columna" -- eso solo
-- comprobaria que el backfill de arriba corrio, porque usa su misma condicion.
-- Se compara el conjunto de organizaciones accesibles por cada usuario, que es
-- lo que de verdad decide quien ve que. Se calculan las dos versiones enteras,
-- la vieja (por platform_role) y la nueva (por private.is_consultant), y
-- cualquier par que aparezca en una y no en la otra aborta la migracion.
do $$
declare
  divergentes integer;
  detalle text;
begin
  with viejo as (
    select p.id as user_id, o.id as org_id
    from public.profiles p cross join public.organizations o
    where p.platform_role = 'platform_admin' and p.is_active
    union
    select ca.consultant_user_id, ca.organization_id
    from public.consultant_assignments ca
    join public.profiles p on p.id = ca.consultant_user_id
    join public.organizations o on o.id = ca.organization_id
    where ca.is_active and p.is_active
      and p.platform_role in ('consultant', 'platform_admin')
      and o.status in ('onboarding', 'active')
    union
    select om.user_id, om.organization_id
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.is_active and o.status in ('onboarding', 'active')
      and exists (
        select 1 from public.service_subscriptions ss
        where ss.organization_id = om.organization_id
          and ss.status in ('trial', 'active')
          and (ss.starts_at is null or ss.starts_at <= now())
          and (ss.ends_at is null or ss.ends_at > now())
      )
  ),
  nuevo as (
    select p.id as user_id, o.id as org_id
    from public.profiles p cross join public.organizations o
    where p.is_platform_staff and p.is_active
    union
    select ca.consultant_user_id, ca.organization_id
    from public.consultant_assignments ca
    join public.profiles p on p.id = ca.consultant_user_id
    join public.organizations o on o.id = ca.organization_id
    where ca.is_active and p.is_active
      and private.is_consultant(ca.consultant_user_id)
      and o.status in ('onboarding', 'active')
    union
    select om.user_id, om.organization_id
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.is_active and o.status in ('onboarding', 'active')
      and exists (
        select 1 from public.service_subscriptions ss
        where ss.organization_id = om.organization_id
          and ss.status in ('trial', 'active')
          and (ss.starts_at is null or ss.starts_at <= now())
          and (ss.ends_at is null or ss.ends_at > now())
      )
  ),
  diff as (
    select 'pierde' as lado, user_id, org_id from (select * from viejo except select * from nuevo) a
    union all
    select 'gana', user_id, org_id from (select * from nuevo except select * from viejo) b
  )
  select count(*), coalesce(string_agg(lado || ' ' || user_id::text || '/' || org_id::text, ', '), '')
  into divergentes, detalle
  from diff;

  if divergentes > 0 then
    raise exception 'el acceso cambia en % pares (usuario, organizacion): %',
      divergentes, detalle;
  end if;

  select count(*) into divergentes
  from public.profiles p
  where p.is_active
    and (p.platform_role = 'platform_admin') is distinct from p.is_platform_staff;

  if divergentes > 0 then
    raise exception 'is_platform_staff no coincide con platform_role en % perfiles', divergentes;
  end if;
end;
$$;
;
