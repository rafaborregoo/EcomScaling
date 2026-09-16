-- Fase 4 y 5 de PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md
--
-- Saldo de tokens del copiloto, y que modelos puede elegir cada plan.
--
-- El copiloto es la unica superficie de IA sin tope por uso: el resto de
-- agentes corren N veces al dia y su coste esta acotado por diseño. Aqui es el
-- usuario quien decide cuantas veces pregunta, asi que el coste lo decide el.
-- El saldo es lo que lo hace visible antes de que llegue la factura.
--
-- NO hay tabla de concesiones. El saldo de un mes es
--
--     copilot_monthly_tokens  -  consumido en el mes en curso
--
-- y el consumo ya esta escrito en `agent_runs`. Una tabla paralela de saldos
-- seria un segundo contador que hay que mantener sincronizado con el primero,
-- y en cuanto un run falle a medias los dos numeros dejan de cuadrar. Cuando
-- haga falta regalar tokens sueltos se añade la tabla; hoy no hace falta.
--
-- Se cuentan tokens de entrada y salida, NO los de cache. La media real de
-- `cache_read_tokens` en produccion (6.286 por mensaje) es mayor que la de
-- entrada, y cuestan una decima parte: contarlos le partiria la cuota por la
-- mitad al usuario a cambio de nada.

-- 1. Cuanto trae el plan -----------------------------------------------------

-- 1M tokens ~ 190 mensajes con el consumo real medido en produccion
-- (3.358 entrada + 1.940 salida por mensaje), ~12 USD/mes de coste sobre 216 EUR
-- de ingreso en el plan Starter. Es el tope por defecto, no el definitivo:
-- cada suscripcion lo lleva escrito para poder subirlo por plan sin tocar codigo.
alter table public.service_subscriptions
  add column if not exists copilot_monthly_tokens bigint not null default 1000000;

alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_copilot_tokens_check;
alter table public.service_subscriptions
  add constraint service_subscriptions_copilot_tokens_check
  check (copilot_monthly_tokens >= 0);

-- Que modelos puede elegir el usuario. 'sonnet' = solo Sonnet 5. 'opus' =
-- ademas Opus 5. Atado al plan y no al capricho: un token es un token en el
-- contador, pero en Opus cuesta varias veces mas, asi que sin esto el mismo
-- numero en pantalla significa margenes distintos.
alter table public.service_subscriptions
  add column if not exists copilot_model_tier text not null default 'sonnet';

alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_copilot_tier_check;
alter table public.service_subscriptions
  add constraint service_subscriptions_copilot_tier_check
  check (copilot_model_tier in ('sonnet', 'opus'));

-- El plan de consultor si trae Opus: es quien mas lo va a usar y quien lo paga.
update public.service_subscriptions
set copilot_model_tier = 'opus'
where plan_code = 'consultant'
  and copilot_model_tier = 'sonnet';

-- 2. De quien es el saldo ----------------------------------------------------
--
-- La pregunta que decide todo: un consultor abre el copiloto dentro de la
-- tienda de un cliente, ¿a quien se le descuenta? Al consultor. El cliente
-- paga su plan para preguntar el, no para financiar el trabajo de su agencia.
--
-- La regla, en una linea: el banco es el de quien pregunta. Si quien pregunta
-- pertenece a una consultora, se le descuenta a la consultora; si no, a la
-- organizacion donde corre.
create or replace function public.copilot_bank_organization(
  actor_user_id uuid,
  run_organization_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select om.organization_id
      from public.organization_members om
      join public.organizations o
        on o.id = om.organization_id and o.kind = 'consulting'
      where om.user_id = actor_user_id
        and om.is_active
      limit 1
    ),
    run_organization_id
  );
$$;

-- 3. Cuanto se ha gastado ----------------------------------------------------
--
-- ponytail: recorre `agent_runs` y resuelve el banco fila a fila. Con 231 runs
-- historicos sobra. Cuando la tabla crezca, la salida es materializar el banco
-- como columna en `agent_runs` al insertar el run -- la firma de aqui no
-- cambia.
create or replace function public.copilot_tokens_consumidos(
  bank_organization_id uuid,
  desde timestamptz,
  hasta timestamptz
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.input_tokens + r.output_tokens), 0)::bigint
  from public.agent_runs r
  where r.trigger_type = 'chat'
    and r.started_at >= desde
    and r.started_at < hasta
    and r.actor_user_id is not null
    and public.copilot_bank_organization(r.actor_user_id, r.organization_id)
        = bank_organization_id;
$$;

create index if not exists agent_runs_chat_actor_idx
  on public.agent_runs (started_at)
  where trigger_type = 'chat' and actor_user_id is not null;

revoke all on function public.copilot_bank_organization(uuid, uuid) from public;
revoke all on function public.copilot_tokens_consumidos(uuid, timestamptz, timestamptz) from public;
grant execute on function public.copilot_bank_organization(uuid, uuid) to authenticated, service_role;
grant execute on function public.copilot_tokens_consumidos(uuid, timestamptz, timestamptz) to authenticated, service_role;
