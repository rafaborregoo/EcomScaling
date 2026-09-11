-- Deriva de esquema en las tres tablas de mensajes de Klaviyo.
--
-- El fichero 20260802140000_db_09_klaviyo_foundation.sql declara para
-- klaviyo_campaign_messages, klaviyo_flow_actions y klaviyo_flow_messages
-- bastantes mas columnas de las que existen en produccion (asunto, preheader,
-- remitente, plantilla, fechas externas...). Produccion se creo desde una
-- version anterior de ese fichero y nunca se puso al dia: el fichero se edito
-- despues, y como `create table` no es idempotente, `db:push` no reaplico nada
-- y el historial quedo "alineado" con dos formas distintas. Es exactamente la
-- deriva que avisa CLAUDE.md, y se detecto porque el sync fallo con
-- "Could not find the 'external_template_id' column ... in the schema cache".
--
-- Aqui se anaden las columnas que faltan, de forma idempotente. NO se toca la
-- forma de las claves: klaviyo_flow_messages en produccion cuelga de
-- (flow_id, external_message_id) con `action_id` como puntero opcional a la
-- accion, en vez del `flow_action_id` del fichero. Esa forma es valida --
-- soporta un mensaje cuya accion se borro -- y renombrar columnas con FK y
-- unique por detras es una cirugia que no aporta nada. El codigo del sync se
-- adapta a la forma real; esta migracion es la que manda a partir de ahora.
--
-- Las tres tablas estan vacias, asi que no hay backfill que hacer.

alter table public.klaviyo_campaign_messages
  add column if not exists external_template_id varchar(255),
  add column if not exists name varchar(255),
  add column if not exists label varchar(255),
  add column if not exists subject varchar(500),
  add column if not exists preview_text text,
  add column if not exists from_email varchar(255),
  add column if not exists from_label varchar(255),
  add column if not exists reply_to_email varchar(255),
  add column if not exists scheduled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.klaviyo_flow_actions
  add column if not exists status varchar(80),
  add column if not exists settings_data jsonb,
  add column if not exists external_created_at timestamptz,
  add column if not exists external_updated_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Convergencia de forma (anadido al replicar el esquema en un proyecto nuevo,
-- 2026-09-11): en produccion esta tabla cuelga del FLUJO -- flow_id +
-- external_message_id, con action_id como puntero opcional -- y el sync hace
-- upsert con ese onConflict. Una base creada desde cero solo con estos ficheros
-- nacia colgando de la accion (flow_action_id not null), asi que el sync no
-- habria funcionado en desarrollo. Produccion ya tiene esta forma; estas lineas
-- son para cualquier entorno que se cree de nuevo.
alter table public.klaviyo_flow_messages
  add column if not exists flow_id uuid references public.klaviyo_flows (id) on delete cascade,
  add column if not exists action_id uuid references public.klaviyo_flow_actions (id) on delete set null;

do $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'klaviyo_flow_messages'
      and column_name = 'flow_action_id'
      and is_nullable = 'NO'
  ) then
    alter table public.klaviyo_flow_messages alter column flow_action_id drop not null;
  end if;
end
$do$;

-- El unique real del upsert. Indice en vez de constraint para poder usar
-- `if not exists` (Postgres no lo admite en add constraint).
create unique index if not exists klaviyo_flow_messages_unique_flow_external
  on public.klaviyo_flow_messages (flow_id, external_message_id);

alter table public.klaviyo_flow_messages
  add column if not exists external_template_id varchar(255),
  add column if not exists name varchar(255),
  add column if not exists subject varchar(500),
  add column if not exists preview_text text,
  add column if not exists from_email varchar(255),
  add column if not exists from_label varchar(255),
  add column if not exists reply_to_email varchar(255),
  add column if not exists external_created_at timestamptz,
  add column if not exists external_updated_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Estas tres tablas eran las unicas del modulo sin trigger de updated_at,
-- porque no tenian la columna. Se crean ahora, con el mismo nombre que usan las
-- demas en produccion (klaviyo_<tabla>_set_updated_at).
drop trigger if exists klaviyo_campaign_messages_set_updated_at on public.klaviyo_campaign_messages;
create trigger klaviyo_campaign_messages_set_updated_at
  before update on public.klaviyo_campaign_messages
  for each row execute function private.set_updated_at();

drop trigger if exists klaviyo_flow_actions_set_updated_at on public.klaviyo_flow_actions;
create trigger klaviyo_flow_actions_set_updated_at
  before update on public.klaviyo_flow_actions
  for each row execute function private.set_updated_at();

drop trigger if exists klaviyo_flow_messages_set_updated_at on public.klaviyo_flow_messages;
create trigger klaviyo_flow_messages_set_updated_at
  before update on public.klaviyo_flow_messages
  for each row execute function private.set_updated_at();

-- El join con el cuerpo del email: mensaje -> klaviyo_templates por id externo.
create index if not exists klaviyo_campaign_messages_template_idx
  on public.klaviyo_campaign_messages (organization_id, external_template_id)
  where external_template_id is not null;

create index if not exists klaviyo_flow_messages_template_idx
  on public.klaviyo_flow_messages (organization_id, external_template_id)
  where external_template_id is not null;

comment on column public.klaviyo_campaign_messages.external_template_id is
  'Plantilla del mensaje (klaviyo_templates.external_template_id). Viene en relationships.template, no en attributes.';
comment on column public.klaviyo_flow_messages.action_id is
  'Accion del flujo que envia este mensaje. Opcional a proposito: el mensaje sobrevive al borrado de su accion (on delete set null).';
