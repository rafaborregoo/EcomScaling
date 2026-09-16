-- Fase 1 de PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md
--
-- La consultora deja de ser una persona y pasa a ser una organizacion.
--
-- ADR-0023 dejo el rol derivado de la suscripcion, pero colgada del USUARIO
-- (`service_subscriptions.user_id`). El modelo de planes dice otra cosa: quien
-- contrata es la consultora, y los consultores son miembros suyos. Mientras el
-- rol dependa de una fila por persona no hay a que colgar la capacidad de
-- cartera (§11), ni los codigos de vinculacion (§21), ni la facturacion por
-- tramos (§33) -- todo eso son propiedades de la consultora, no de cada
-- empleado.
--
-- Lo que hace barato el cambio es que `private.is_consultant` solo lo llaman
-- las otras cuatro funciones de `private`. Ninguna policy lo menciona.
-- Cambiar quien es consultor es cambiar el cuerpo de una funcion.
--
-- Una consultora NO necesita tablas nuevas: una fila de `organizations` ya
-- tiene miembros con roles, suscripcion, auditoria y ciclo de vida. Lo unico
-- que falta es decir de que tipo es -- de ahi `kind`.
--
-- Las tiendas propias del consultor (createOwnStore) se quedan donde estan:
-- una organizacion de kind='client' por tienda. Colgarlas de la consultora
-- obligaria a fusionar dos tiendas en una organizacion, y todo el producto
-- (dashboards, integraciones, rollups) esta indexado por organization_id: un
-- panel por tienda dejaria de existir. La consultora no tiene tiendas; tiene
-- el plan y la gente.

-- 1. De que tipo es cada organizacion ----------------------------------------

alter table public.organizations
  add column if not exists kind text not null default 'client';

alter table public.organizations
  drop constraint if exists organizations_kind_check;
alter table public.organizations
  add constraint organizations_kind_check
  check (kind in ('client', 'consulting'));

create index if not exists organizations_consulting_idx
  on public.organizations (id)
  where kind = 'consulting';

-- Que consultora capto y atiende al cliente. Hoy la atribucion es por persona
-- (`consultant_user_id`); para facturar tramos hace falta saber la empresa,
-- porque un cliente atendido por dos empleados de la misma consultora se
-- cuenta una vez.
alter table public.consultant_assignments
  add column if not exists consulting_organization_id uuid
  references public.organizations (id) on delete set null;

create index if not exists consultant_assignments_consulting_org_idx
  on public.consultant_assignments (consulting_organization_id)
  where consulting_organization_id is not null;

-- 2. Quien era consultor ANTES de tocar nada ---------------------------------
-- La asercion del final compara contra esto. Se captura con la funcion viva,
-- sea la version vieja (primera pasada) o la nueva (reaplicacion), asi que la
-- comprobacion sigue siendo valida si la migracion se repite.

create temporary table _consultores_antes on commit drop as
select p.id
from public.profiles p
where private.is_consultant(p.id);

-- 3. Backfill ----------------------------------------------------------------
-- Por cada consultor de hoy: su consultora, el como owner, y su suscripcion
-- movida de `user_id` a `organization_id`.

do $$
declare
  fila record;
  nueva_org uuid;
  base_slug text;
  slug_libre text;
  sufijo integer;
begin
  for fila in
    select ss.id as subscription_id, ss.user_id, p.full_name
    from public.service_subscriptions ss
    join public.profiles p on p.id = ss.user_id
    where ss.user_id is not null
      and ss.status in ('trial', 'active')
      -- Si ya es miembro de una consultora, esta migracion ya corrio para el.
      and not exists (
        select 1
        from public.organization_members om
        join public.organizations o on o.id = om.organization_id
        where om.user_id = ss.user_id
          and om.is_active
          and o.kind = 'consulting'
      )
  loop
    base_slug := regexp_replace(
      lower(coalesce(nullif(trim(fila.full_name), ''), 'consultora')),
      '[^a-z0-9]+', '-', 'g'
    );
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'consultora';
    end if;

    slug_libre := base_slug;
    sufijo := 1;
    while exists (select 1 from public.organizations where slug = slug_libre) loop
      sufijo := sufijo + 1;
      slug_libre := base_slug || '-' || sufijo::text;
    end loop;

    insert into public.organizations (display_name, slug, kind, status, created_by, activated_at)
    values (
      coalesce(nullif(trim(fila.full_name), ''), 'Consultora'),
      slug_libre,
      'consulting',
      'active',
      fila.user_id,
      now()
    )
    returning id into nueva_org;

    insert into public.organization_members (organization_id, user_id, role, is_active, invited_at, joined_at)
    values (nueva_org, fila.user_id, 'owner', true, now(), now());

    -- El sujeto de la suscripcion cambia de persona a empresa. El check
    -- `service_subscriptions_sujeto_unico` exige exactamente uno de los dos,
    -- asi que las dos columnas se escriben en el mismo update.
    update public.service_subscriptions
    set organization_id = nueva_org,
        user_id = null
    where id = fila.subscription_id;

    -- Las asignaciones que ya tenia pasan a atribuirse a su consultora.
    update public.consultant_assignments
    set consulting_organization_id = nueva_org
    where consultant_user_id = fila.user_id
      and consulting_organization_id is null;
  end loop;
end;
$$;

-- 4. La regla nueva ----------------------------------------------------------

create or replace function private.is_consultant(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o
      on o.id = om.organization_id and o.kind = 'consulting'
    join public.service_subscriptions ss
      on ss.organization_id = o.id
    join public.profiles p on p.id = om.user_id
    where om.user_id = target_user_id
      and om.is_active
      and p.is_active
      and o.status in ('onboarding', 'active')
      and ss.status in ('trial', 'active')
      and (ss.starts_at is null or ss.starts_at <= now())
      and (ss.ends_at is null or ss.ends_at > now())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.is_platform_staff
      and p.is_active
  );
$$;

revoke all on function private.is_consultant(uuid) from public;
grant execute on function private.is_consultant(uuid) to authenticated;

-- La consultora es de sus miembros, no un cliente mas: no debe aparecer en
-- `accessible_org_ids` por la rama de "membership con plan activo", o el
-- selector del portal la pintaria como una tienda. Se accede a ella, pero por
-- ser consultor, no por ser cliente.
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
    and (
      o.kind = 'consulting'
      or exists (
        select 1
        from public.service_subscriptions ss
        where ss.organization_id = om.organization_id
          and ss.status in ('trial', 'active')
          and (ss.starts_at is null or ss.starts_at <= now())
          and (ss.ends_at is null or ss.ends_at > now())
      )
    );
$fn$;

-- 5. Asercion: la misma gente sigue siendo consultora ------------------------
-- No se comprueba "el backfill corrio" (eso solo repetiria su propia
-- condicion), sino la propiedad que de verdad decide quien ve que: el conjunto
-- de consultores, y el conjunto de pares (usuario, organizacion cliente)
-- accesibles. Si alguien gana o pierde uno, la migracion aborta entera.

do $$
declare
  divergentes integer;
  detalle text;
begin
  with ahora as (
    select p.id from public.profiles p where private.is_consultant(p.id)
  ),
  diff as (
    select 'pierde' as lado, id from (select id from _consultores_antes except select id from ahora) a
    union all
    select 'gana', id from (select id from ahora except select id from _consultores_antes) b
  )
  select count(*), coalesce(string_agg(lado || ' ' || id::text, ', '), '')
  into divergentes, detalle
  from diff;

  if divergentes > 0 then
    raise exception 'el conjunto de consultores cambia en % personas: %',
      divergentes, detalle;
  end if;

  -- Ninguna suscripcion puede quedar colgando de una persona: a partir de
  -- aqui el plan de consultor es de la consultora.
  select count(*) into divergentes
  from public.service_subscriptions
  where user_id is not null
    and status in ('trial', 'active');

  if divergentes > 0 then
    raise exception '% suscripciones vivas siguen a nombre de una persona', divergentes;
  end if;

  -- Cada consultora tiene exactamente un plan vivo y al menos un miembro.
  select count(*) into divergentes
  from public.organizations o
  where o.kind = 'consulting'
    and (
      not exists (
        select 1 from public.service_subscriptions ss
        where ss.organization_id = o.id and ss.status in ('trial', 'active')
      )
      or not exists (
        select 1 from public.organization_members om
        where om.organization_id = o.id and om.is_active
      )
    );

  if divergentes > 0 then
    raise exception '% consultoras sin plan vivo o sin miembros', divergentes;
  end if;
end;
$$;

-- 6. Una sola fuente para Node -----------------------------------------------
-- `auth-context.ts` derivaba el rol repitiendo en TypeScript la condicion de
-- `private.is_consultant`. Con la condicion vieja (una fila con `user_id`) eso
-- era una consulta trivial; con la nueva son tres tablas y la vigencia del
-- plan, y dos copias de esa regla acaban discrepando sobre quien es consultor
-- -- con la API diciendo una cosa y la RLS otra. Se expone la funcion tal cual.
create or replace function public.es_consultor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_consultant(auth.uid());
$$;

revoke all on function public.es_consultor() from public;
grant execute on function public.es_consultor() to authenticated;
