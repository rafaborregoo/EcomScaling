-- Clicks por enlace: que CTA funciona, no solo cuanta gente clicó.
--
-- El rendimiento de Klaviyo da "clicks_unique" por envio, que responde "cuanta
-- gente pulsó algo". La pregunta util para el copy es otra: QUE pulsaron. Eso
-- solo esta en los eventos "Clicked Email", donde cada click lleva su URL.
--
-- Forma comprobada contra la API real (revision 2026-07-15): las propiedades
-- del evento van en `attributes.event_properties`, NO en `attributes.properties`
-- como sugiere parte de la documentacion, y el perfil y la metrica cuelgan de
-- `relationships`.
--
-- Se guarda el evento crudo y se agrega en SQL (ADR-0006 pto 6), no al reves:
-- agregar en el sync obligaria a re-sincronizar para cambiar de pregunta.
--
-- Solo el id opaco del perfil, nunca su email ni su nombre: para contar
-- personas distintas basta, y asi esta tabla no es un duplicado de la lista de
-- suscriptores del cliente.

create table if not exists public.klaviyo_email_click_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_event_id varchar(255) not null,
  occurred_at timestamptz not null,
  url text,
  external_message_id varchar(255),
  external_profile_id varchar(255),
  raw_data jsonb,
  created_at timestamptz not null default now(),
  constraint klaviyo_email_click_events_unique unique (account_id, external_event_id)
);

create index if not exists klaviyo_email_click_events_org_time_idx
  on public.klaviyo_email_click_events (organization_id, occurred_at desc);

alter table public.klaviyo_email_click_events enable row level security;

drop policy if exists "klaviyo_email_click_events_select_authorized"
  on public.klaviyo_email_click_events;
create policy "klaviyo_email_click_events_select_authorized"
  on public.klaviyo_email_click_events
  for select to authenticated
  using (organization_id in (select private.accessible_org_ids()));

grant select on public.klaviyo_email_click_events to authenticated;

comment on table public.klaviyo_email_click_events is
  'Clicks en enlaces de email (evento "Clicked Email" de Klaviyo) con su URL. Guarda el id opaco del perfil para contar personas distintas, nunca su email ni su nombre.';

-- Clicks agrupados por destino. `personas` cuenta perfiles distintos: un mismo
-- suscriptor que pulsa cinco veces el mismo boton es una persona interesada, no
-- cinco.
drop function if exists public.klaviyo_link_clicks(uuid, timestamptz, timestamptz, uuid);
create or replace function public.klaviyo_link_clicks(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid default null
)
returns table (
  url text,
  clicks bigint,
  personas bigint,
  primer_click timestamptz,
  ultimo_click timestamptz,
  mensajes bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    e.url,
    count(*) as clicks,
    count(distinct e.external_profile_id) as personas,
    min(e.occurred_at) as primer_click,
    max(e.occurred_at) as ultimo_click,
    count(distinct e.external_message_id) as mensajes
  from public.klaviyo_email_click_events e
  where e.organization_id = target_organization_id
    and e.occurred_at >= period_start
    and e.occurred_at <= period_end
    and e.url is not null
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = e.account_id and ka.store_id = target_store_id
    ))
  group by e.url
  order by count(*) desc, e.url;
$function$;

grant execute on function public.klaviyo_link_clicks(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.klaviyo_link_clicks is
  'Clicks de email agrupados por URL de destino, con cuantas personas distintas pulsaron y en cuantos mensajes aparece ese enlace. Responde "que CTA funciona", que el rendimiento por envio no puede responder.';
