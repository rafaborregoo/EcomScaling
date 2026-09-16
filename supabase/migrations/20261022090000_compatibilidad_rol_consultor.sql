-- Compatibilidad hacia atras para 20261018090000 (organizacion consultora).
--
-- EL PROBLEMA QUE ARREGLA
--
-- 20261018090000 movio el plan del consultor de la persona
-- (`service_subscriptions.user_id`) a su consultora (`organization_id`), y
-- dejo `user_id` a null. La RLS quedo bien: `private.is_consultant` ya mira la
-- consultora. Pero el API DESPLEGADO todavia deriva el rol leyendo una fila
-- con `user_id` -- ese cambio esta en el working tree, sin desplegar. Resultado
-- inmediato: los consultores que no son staff entran como cliente y pierden el
-- panel, aunque la base de datos diga que son consultores.
--
-- Aplicar el esquema antes que el codigo es correcto (el esquema nuevo tiene
-- que estar cuando llegue el codigo nuevo); lo que no vale es que el paso
-- intermedio rompa. Se resuelve como ya se resolvio `platform_role` en
-- 20261006090000: expandir primero, contraer despues. Durante la ventana, las
-- DOS fuentes dicen lo mismo.
--
-- QUE HACE
--
-- Devuelve la fila con `user_id` a cada miembro de una consultora con plan
-- vigente. No sustituye a la de la consultora: convive con ella. El codigo
-- viejo lee la suya y sigue funcionando; el codigo nuevo lee la de la
-- organizacion y tambien.
--
-- CUANDO SE BORRA
--
-- En cuanto el API nuevo este en produccion, una migracion de contraccion
-- borra estas filas (`plan_code = 'consultant_legacy'`, que es justo para poder
-- reconocerlas sin adivinar) y con ellas la columna `user_id` deja de tener
-- sentido. Hasta entonces, borrarlas deja fuera a quien las necesita.
--
-- OJO AL REAPLICAR: despues de esta migracion, la asercion de 20261018090000
-- ("ninguna suscripcion viva a nombre de una persona") ya no se cumple. Si
-- hubiera que reaplicar aquella, primero hay que borrar estas filas.

insert into public.service_subscriptions (user_id, plan_code, status, starts_at)
select distinct om.user_id, 'consultant_legacy', 'active'::public.subscription_status, now()
from public.organization_members om
join public.organizations o
  on o.id = om.organization_id and o.kind = 'consulting'
join public.service_subscriptions ss
  on ss.organization_id = o.id
where om.is_active
  and o.status in ('onboarding', 'active')
  and ss.status in ('trial', 'active')
  and (ss.starts_at is null or ss.starts_at <= now())
  and (ss.ends_at is null or ss.ends_at > now())
  -- `service_subscriptions_one_current_per_user` solo admite una fila viva por
  -- persona: si ya la tiene, no se toca.
  and not exists (
    select 1
    from public.service_subscriptions previa
    where previa.user_id = om.user_id
      and previa.status in ('trial', 'active')
  );

-- Estas filas no llevan cartera ni saldo: la plaza y los tokens son de la
-- consultora. Dejarlas con el default (3 plazas, 1M tokens) haria que el mismo
-- consultor contara dos veces el dia que alguien sume por `user_id`.
update public.service_subscriptions
set contracted_client_slots = 0,
    copilot_monthly_tokens = 0
where plan_code = 'consultant_legacy';

-- Asercion: nadie que sea consultor segun la regla nueva se queda sin la
-- fila que el codigo viejo necesita. Es la unica propiedad que hace util a
-- esta migracion; si no se cumple, no arregla nada y mejor que falle.
do $$
declare
  sin_compat integer;
begin
  select count(*) into sin_compat
  from public.profiles p
  where p.is_active
    and private.is_consultant(p.id)
    and not p.is_platform_staff
    and not exists (
      select 1
      from public.service_subscriptions ss
      where ss.user_id = p.id
        and ss.status in ('trial', 'active')
    );

  if sin_compat > 0 then
    raise exception '% consultores siguen sin la fila de compatibilidad', sin_compat;
  end if;
end;
$$;
