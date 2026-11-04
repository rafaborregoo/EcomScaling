-- Solicitudes de acceso: el registro libre se cierra y toda cuenta nueva pasa
-- por una solicitud que revisa la direccion (platform_admin).
--
-- Tres clases de solicitud, en una sola tabla porque comparten el ciclo
-- entero (revisar -> aprobar -> invitar) y la pantalla que lo lleva:
--
-- - `client`: una tienda que entra directa, sin consultor. Ocupa una de las
--   plazas de cliente.
-- - `consultant`: un consultor. Ocupa una de las plazas de consultor y trae
--   `client_slots`: cuantos clientes podra llevar su consultora.
-- - `consultant_client`: un cliente que declara un consultor, en su
--   solicitud (`parent_request_id`) o ya desde su portal
--   (`consulting_organization_id`). NO ocupa plaza de cliente: gasta plaza de
--   la cartera de su consultor.
--
-- Aprobar reserva la plaza; invitar (otro paso, el dia que se abra) crea la
-- cuenta y manda el correo. Por eso `approved` y `invited` cuentan los dos.
--
-- Idempotente (CLAUDE.md): si el esquema ya se toco por fuera, reaplicar no
-- rompe nada.

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'pending',
  email text not null,
  full_name text,
  business_name text,
  store_url text,
  store_domain text,
  platform text,
  answers jsonb not null default '{}'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  client_slots integer,
  parent_request_id uuid references public.access_requests (id) on delete cascade,
  consultant_user_id uuid references public.profiles (id) on delete set null,
  consulting_organization_id uuid references public.organizations (id) on delete set null,
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  invited_at timestamptz,
  created_user_id uuid references public.profiles (id) on delete set null,
  created_organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.access_requests drop constraint if exists access_requests_kind_check;
alter table public.access_requests add constraint access_requests_kind_check
  check (kind in ('client', 'consultant', 'consultant_client'));

alter table public.access_requests drop constraint if exists access_requests_status_check;
alter table public.access_requests add constraint access_requests_status_check
  check (status in ('pending', 'approved', 'waitlisted', 'rejected', 'invited'));

alter table public.access_requests drop constraint if exists access_requests_email_check;
alter table public.access_requests add constraint access_requests_email_check
  check (email = lower(email) and char_length(email) between 3 and 320 and position('@' in email) > 1);

alter table public.access_requests drop constraint if exists access_requests_lengths_check;
alter table public.access_requests add constraint access_requests_lengths_check
  check (
    coalesce(char_length(full_name), 0) <= 200
    and coalesce(char_length(business_name), 0) <= 200
    and coalesce(char_length(store_url), 0) <= 500
    and coalesce(char_length(store_domain), 0) <= 255
    and coalesce(char_length(platform), 0) <= 50
    and coalesce(char_length(admin_note), 0) <= 4000
  );

alter table public.access_requests drop constraint if exists access_requests_client_slots_check;
alter table public.access_requests add constraint access_requests_client_slots_check
  check (client_slots is null or client_slots >= 0);

-- Un cliente declarado siempre cuelga de alguien; los otros dos, de nadie.
alter table public.access_requests drop constraint if exists access_requests_owner_check;
alter table public.access_requests add constraint access_requests_owner_check
  check (
    (kind = 'consultant_client')
    = (parent_request_id is not null or consulting_organization_id is not null)
  );

-- Una solicitud abierta por correo y clase. Un cliente declarado no entra: que
-- dos consultores declaren el mismo correo es justo la señal que hay que ver.
create unique index if not exists access_requests_email_abierta_idx
  on public.access_requests (kind, email)
  where kind in ('client', 'consultant')
    and status in ('pending', 'approved', 'waitlisted');

create index if not exists access_requests_kind_status_idx
  on public.access_requests (kind, status);
create index if not exists access_requests_parent_idx
  on public.access_requests (parent_request_id)
  where parent_request_id is not null;
create index if not exists access_requests_consulting_org_idx
  on public.access_requests (consulting_organization_id)
  where consulting_organization_id is not null;

-- Las escrituras van por el API con service role (ADR-0006 pto 7). Solo la
-- direccion lee.
alter table public.access_requests enable row level security;
drop policy if exists access_requests_admin_select on public.access_requests;
create policy access_requests_admin_select on public.access_requests
  for select to authenticated
  using ((select private.is_platform_admin()));

comment on table public.access_requests is
  'Solicitudes de acceso a E-NORA (cliente directo, consultor, cliente declarado por un consultor). Las aprueba e invita platform_admin.';

-- Plazas abiertas por clase. Se cambian desde /admin/solicitudes.
create table if not exists public.access_seat_limits (
  kind text primary key,
  seat_limit integer not null,
  updated_at timestamptz not null default now()
);

alter table public.access_seat_limits drop constraint if exists access_seat_limits_kind_check;
alter table public.access_seat_limits add constraint access_seat_limits_kind_check
  check (kind in ('client', 'consultant'));
alter table public.access_seat_limits drop constraint if exists access_seat_limits_limit_check;
alter table public.access_seat_limits add constraint access_seat_limits_limit_check
  check (seat_limit >= 0);

insert into public.access_seat_limits (kind, seat_limit)
values ('client', 10), ('consultant', 5)
on conflict (kind) do nothing;

alter table public.access_seat_limits enable row level security;
drop policy if exists access_seat_limits_admin_select on public.access_seat_limits;
create policy access_seat_limits_admin_select on public.access_seat_limits
  for select to authenticated
  using ((select private.is_platform_admin()));

-- Plazas ocupadas de una clase. Un cliente directo deja su hueco en cuanto se
-- asocia a una consultora (pasa a gastar plaza de esa cartera), y cualquiera
-- lo deja si su cuenta se da de baja. Contarlo al vuelo en vez de guardar un
-- contador es lo que hace que el hueco se libere solo.
create or replace function public.plazas_de_acceso_ocupadas(p_kind text)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.access_requests r
  where r.kind = p_kind
    and r.status in ('approved', 'invited')
    and (
      p_kind <> 'client'
      or r.created_organization_id is null
      or (
        exists (
          select 1 from public.organizations o
          where o.id = r.created_organization_id
            and o.status in ('onboarding', 'active')
        )
        and not exists (
          select 1 from public.consultant_assignments ca
          where ca.organization_id = r.created_organization_id
            and ca.is_active
            and ca.consulting_organization_id is not null
        )
      )
    )
    and (
      p_kind <> 'consultant'
      or r.created_user_id is null
      or exists (
        select 1 from public.profiles p
        where p.id = r.created_user_id and p.is_active
      )
    );
$$;

revoke all on function public.plazas_de_acceso_ocupadas(text) from public, anon, authenticated;
grant execute on function public.plazas_de_acceso_ocupadas(text) to service_role;

-- Aprobar = reservar plaza, en la misma transaccion que cuenta. Contar en Node
-- y escribir despues deja que dos aprobaciones a la vez se lleven la ultima
-- plaza las dos; el `for update` sobre la fila del limite las pone en fila.
create or replace function public.aprobar_solicitud_de_acceso(
  p_request_id uuid,
  p_reviewer uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.access_requests%rowtype;
  parent public.access_requests%rowtype;
  v_limit integer;
  v_occupied integer;
begin
  select * into r from public.access_requests where id = p_request_id for update;
  if not found then
    return 'not_found';
  end if;
  if r.status not in ('pending', 'waitlisted', 'rejected') then
    return 'invalid_status';
  end if;

  if r.kind in ('client', 'consultant') then
    select seat_limit into v_limit
    from public.access_seat_limits
    where kind = r.kind
    for update;
    v_occupied := public.plazas_de_acceso_ocupadas(r.kind);
  elsif r.consulting_organization_id is not null then
    -- Consultora ya dada de alta: su tope es el plan, y lo ocupado son sus
    -- clientes y codigos (`plazas_de_cartera_ocupadas`) mas lo que ya le
    -- hemos aprobado y aun no se ha invitado.
    perform 1 from public.organizations
    where id = r.consulting_organization_id
    for update;
    select ss.contracted_client_slots into v_limit
    from public.service_subscriptions ss
    where ss.organization_id = r.consulting_organization_id
      and ss.status in ('trial', 'active')
    order by ss.starts_at desc nulls last
    limit 1;
    v_occupied := public.plazas_de_cartera_ocupadas(r.consulting_organization_id)
      + (
        select count(*)::integer
        from public.access_requests o
        where o.consulting_organization_id = r.consulting_organization_id
          and o.kind = 'consultant_client'
          and o.status = 'approved'
          and o.id <> r.id
      );
  else
    -- Declarado en la solicitud de un consultor que aun no tiene cuenta: el
    -- tope son las plazas que se le dieron al aprobarle.
    select * into parent from public.access_requests
    where id = r.parent_request_id
    for update;
    if parent.status not in ('approved', 'invited') then
      return 'parent_not_approved';
    end if;
    v_limit := parent.client_slots;
    v_occupied := (
      select count(*)::integer
      from public.access_requests o
      where o.parent_request_id = r.parent_request_id
        and o.status in ('approved', 'invited')
        and o.id <> r.id
    );
  end if;

  if coalesce(v_limit, 0) <= v_occupied then
    return 'no_seats';
  end if;

  update public.access_requests
  set status = 'approved',
      reviewed_by = p_reviewer,
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;
  return 'approved';
end;
$$;

revoke all on function public.aprobar_solicitud_de_acceso(uuid, uuid) from public, anon, authenticated;
grant execute on function public.aprobar_solicitud_de_acceso(uuid, uuid) to service_role;

-- Arreglo de paso: el codigo suelto creaba la asignacion SIN consultora, asi
-- que `plazas_de_cartera_ocupadas` dejaba de contar al cliente en cuanto
-- canjeaba el codigo y el tope de cartera no servia. Misma firma: basta con
-- `create or replace`.
create or replace function public.link_client_invite(
  p_invite_id uuid,
  p_organization_id uuid,
  p_user_id uuid,
  p_consultant_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consulting_organization_id uuid;
begin
  update public.client_invites
  set organization_id = p_organization_id,
      invited_user_id = p_user_id,
      status = 'redeemed',
      redeemed_at = now()
  where id = p_invite_id
    and status = 'pending'
    and organization_id is null
  returning consulting_organization_id into v_consulting_organization_id;

  if not found then
    return false;
  end if;

  insert into public.consultant_assignments (
    organization_id, consultant_user_id, consulting_organization_id, is_primary, is_active, assigned_by
  ) values (
    p_organization_id, p_consultant_user_id, v_consulting_organization_id, true, true, p_consultant_user_id
  );

  return true;
end;
$$;

revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from public;
revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from anon;
revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from authenticated;
grant execute on function public.link_client_invite(uuid, uuid, uuid, uuid) to service_role;

update public.consultant_assignments ca
set consulting_organization_id = ci.consulting_organization_id
from public.client_invites ci
where ci.status = 'redeemed'
  and ci.organization_id = ca.organization_id
  and ci.consultant_user_id = ca.consultant_user_id
  and ci.consulting_organization_id is not null
  and ca.consulting_organization_id is null;

-- Aviso nuevo (ADR-0028): `access_request` cae en «Clientes».
create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('alert', 'alert_critical', 'task_assigned', 'message', 'campaign_review') then p_type
    when p_type in ('integration_error', 'integration_expiring') then 'integration'
    when p_type in ('client_linked', 'client_settings', 'client_decided_ai_output', 'access_request') then 'client'
    when p_type in ('task_comment', 'task_completed', 'daily_today', 'ai_pending', 'camino_objective',
                    'meeting_booked', 'meeting_rescheduled', 'meeting_cancelled') then 'task_assigned'
    else 'other'
  end;
$$;
