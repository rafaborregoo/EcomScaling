-- Fase 2 (capacidad) de PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md
--
-- Un consultor no puede tener mas clientes de los que ha contratado (§11, §12,
-- §15 del modelo de planes). Hoy no hay tope: `createClientForConsultant` crea
-- tantos clientes como se le pidan, y la factura se entera despues.
--
-- La plaza se cuenta contra la CONSULTORA, no contra la persona: dos empleados
-- de la misma empresa comparten cartera, y contarlo por persona duplicaria las
-- plazas el dia que entre el segundo.
--
-- Una plaza esta ocupada si hay un cliente asignado y activo, o si hay un
-- codigo de invitacion pendiente. Sin contar los pendientes, un consultor
-- genera diez codigos con tres plazas y el tope no sirve de nada.

alter table public.service_subscriptions
  add column if not exists contracted_client_slots integer;

-- Se rellena antes de poner el `not null`, y nunca por debajo de los clientes
-- que ya tiene: subir el tope a alguien es una decision de negocio, pero
-- bajarselo por una migracion le quitaria clientes que ya atiende.
update public.service_subscriptions ss
set contracted_client_slots = greatest(
  3,
  (
    select count(*)
    from public.consultant_assignments ca
    where ca.consulting_organization_id = ss.organization_id
      and ca.is_active
  )
)
where ss.contracted_client_slots is null
  and ss.organization_id in (
    select id from public.organizations where kind = 'consulting'
  );

-- Un cliente no lleva cartera: su plan no contrata plazas.
update public.service_subscriptions
set contracted_client_slots = 0
where contracted_client_slots is null;

alter table public.service_subscriptions
  alter column contracted_client_slots set default 0;
alter table public.service_subscriptions
  alter column contracted_client_slots set not null;

alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_client_slots_check;
alter table public.service_subscriptions
  add constraint service_subscriptions_client_slots_check
  check (contracted_client_slots >= 0);

-- Quien capto al cliente, separado de quien lo atiende hoy (§26). Reasignar un
-- cliente a otro consultor de la misma consultora no cambia quien lo trajo, y
-- mezclarlo en una sola columna hace imposible reconstruirlo despues.
alter table public.client_invites
  add column if not exists captured_by_consultant_id uuid
  references public.profiles (id) on delete set null;

update public.client_invites
set captured_by_consultant_id = consultant_user_id
where captured_by_consultant_id is null;

-- La consultora a la que se le descuenta la plaza. Se guarda en el codigo y no
-- se deduce al canjearlo: entre que se genera y se canjea el consultor puede
-- haber cambiado de empresa, y la plaza la reservo la de entonces.
alter table public.client_invites
  add column if not exists consulting_organization_id uuid
  references public.organizations (id) on delete set null;

update public.client_invites ci
set consulting_organization_id = (
  select om.organization_id
  from public.organization_members om
  join public.organizations o
    on o.id = om.organization_id and o.kind = 'consulting'
  where om.user_id = ci.consultant_user_id
    and om.is_active
  limit 1
)
where ci.consulting_organization_id is null;

create index if not exists client_invites_consulting_org_pendientes_idx
  on public.client_invites (consulting_organization_id)
  where status = 'pending';

-- Plazas ocupadas ahora mismo por una consultora: clientes activos mas codigos
-- pendientes sin caducar. Una sola definicion para el tope, la factura y lo
-- que ve el consultor en pantalla -- si cada uno cuenta a su manera, el aviso
-- de "te queda 1 plaza" y el cobro discrepan.
create or replace function public.plazas_de_cartera_ocupadas(
  consulting_organization_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      select count(distinct ca.organization_id)
      from public.consultant_assignments ca
      join public.organizations o on o.id = ca.organization_id
      where ca.consulting_organization_id = plazas_de_cartera_ocupadas.consulting_organization_id
        and ca.is_active
        and o.kind = 'client'
        and o.status in ('onboarding', 'active')
    )
    +
    (
      select count(*)
      from public.client_invites ci
      where ci.consulting_organization_id = plazas_de_cartera_ocupadas.consulting_organization_id
        and ci.status = 'pending'
        and ci.expires_at > now()
        -- Un codigo para una organizacion que ya cuenta como cliente activo no
        -- ocupa una segunda plaza.
        and not exists (
          select 1
          from public.consultant_assignments ca
          where ca.organization_id = ci.organization_id
            and ca.consulting_organization_id = ci.consulting_organization_id
            and ca.is_active
        )
    )
  )::integer;
$$;

revoke all on function public.plazas_de_cartera_ocupadas(uuid) from public;
grant execute on function public.plazas_de_cartera_ocupadas(uuid) to authenticated, service_role;
