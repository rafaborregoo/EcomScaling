-- Whop pasa a ser quien escribe las suscripciones.
--
-- ADR-0023 dejo el rol derivandose de `service_subscriptions`, y con un cabo
-- suelto escrito en el propio ADR: "hoy nada mueve una suscripcion a expired".
-- El cobro era manual, asi que la caducidad tambien lo era -- es decir, no
-- existia. Los webhooks de Whop son lo que cierra ese lazo: activar, cancelar y
-- desactivar dejan de ser cosas que alguien tiene que acordarse de reflejar.
--
-- Aqui solo va lo que la base de datos tiene que garantizar. El mapeo de
-- estados y de planes vive en `apps/api/src/whop.ts`.

-- 1. Los eventos de Whop se guardan donde los demas -------------------------
-- `private.webhook_events` ya da deduplicacion por (provider, external_event_id)
-- y el payload crudo para poder reprocesar. Un cobro duplicado por un reintento
-- de Whop es exactamente lo que esa tabla existe para evitar.

alter table private.webhook_events
  drop constraint if exists webhook_events_provider_check;

alter table private.webhook_events
  add constraint webhook_events_provider_check check (
    provider in (
      'shopify',
      'meta_ads',
      'klaviyo',
      'instagram',
      'fathom',
      'loom',
      'whop'
    )
  );

-- 2. Una membresia de Whop = como mucho una suscripcion ---------------------
-- El handler busca por `external_subscription_id` para decidir entre crear y
-- actualizar. Sin unicidad, dos entregas simultaneas del mismo evento crean dos
-- filas y el limite de tiendas pasa a depender de cual lea primero el que
-- pregunte.

create unique index if not exists service_subscriptions_external_id_unique
  on public.service_subscriptions (external_subscription_id)
  where external_subscription_id is not null;

-- 3. Una persona, un plan vigente -------------------------------------------
-- Lo de organizacion ya lo garantizaba `service_subscriptions_one_current_per_org`
-- desde DB-02. Las de usuario (las del consultor, desde 20261006090000) no
-- tenian equivalente, y a partir de ahora entran solas por webhook: sin este
-- indice, un cambio de plan deja dos filas activas y `private.is_consultant`
-- diria que si por la vieja aunque la nueva se hubiera cancelado.
--
-- El saneo previo es defensivo y hoy no deberia tocar nada (el backfill de
-- 20261006090000 iba guardado con un `not exists`). Si tocara algo, es
-- justamente el estado que el indice no admitiria: se conserva la mas reciente.

with duplicadas as (
  select
    id,
    row_number() over (
      partition by user_id
      order by coalesce(starts_at, created_at) desc, created_at desc
    ) as posicion
  from public.service_subscriptions
  where user_id is not null
    and status in ('trial', 'active')
)
update public.service_subscriptions s
set status = 'expired'::public.subscription_status,
    ends_at = coalesce(s.ends_at, now())
from duplicadas d
where d.id = s.id
  and d.posicion > 1;

create unique index if not exists service_subscriptions_one_current_per_user
  on public.service_subscriptions (user_id)
  where user_id is not null and status in ('trial', 'active');

-- 4. Atribuir una compra a una cuenta ----------------------------------------
-- La atribucion buena es la metadata que la plataforma mete en la checkout
-- configuration. Pero una compra puede empezar en un enlace de Whop suelto, sin
-- pasar por la app, y entonces lo unico que llega es el correo del comprador.
--
-- `profiles` no guarda el correo: vive en `auth.users`, que PostgREST no expone.
-- De ahi esta funcion. Es `security definer` sobre una tabla de auth, asi que
-- solo la ejecuta `service_role` -- nunca un usuario con sesion, que podria
-- usarla para comprobar si un correo esta registrado.

create or replace function private.user_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(target_email))
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function private.user_id_by_email(text) from public;
revoke all on function private.user_id_by_email(text) from authenticated;
revoke all on function private.user_id_by_email(text) from anon;
grant execute on function private.user_id_by_email(text) to service_role;

comment on function private.user_id_by_email(text) is
  'Resuelve el usuario por correo para atribuir una compra de Whop. Solo service_role.';
