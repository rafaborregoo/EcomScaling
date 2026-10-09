-- Campañas creadas por el cliente + hilo de revisión del consultor.
--
-- Hasta ahora, con consultor asignado la agenda de campañas la llevaba solo él:
-- el cliente podia "sugerir" una accion y poco mas. Decision de producto
-- (Rafa, 2026-10-07): un cliente puede crear su propia campaña aunque tenga
-- consultor; el consultor recibe un aviso, la revisa y la anota o corrige, a
-- mano o con IA. Sin consultor, el cliente se gobierna solo (no cambia).
--
-- 1. campaign_calendar_items: de donde viene la campaña y en que punto de la
--    revision esta.
-- 2. campaign_item_notes: el hilo de la campaña (notas, correcciones,
--    propuestas de la IA y lineas de sistema). Un hilo por campaña; el hilo de
--    cada pieza (marketing_content_draft_notes) sigue existiendo y se lee junto.
--
-- Todo es idempotente: si el esquema se tocó por fuera, db:push la reaplica.

alter table public.campaign_calendar_items
  add column if not exists origin text not null default 'staff',
  add column if not exists review_status text,
  add column if not exists review_requested_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.campaign_calendar_items
  drop constraint if exists campaign_calendar_items_origin_valid;
alter table public.campaign_calendar_items
  add constraint campaign_calendar_items_origin_valid
  check (origin in ('staff', 'client', 'ai'));

alter table public.campaign_calendar_items
  drop constraint if exists campaign_calendar_items_review_status_valid;
alter table public.campaign_calendar_items
  add constraint campaign_calendar_items_review_status_valid
  check (review_status is null or review_status in ('pending', 'changes_requested', 'reviewed'));

comment on column public.campaign_calendar_items.origin is
  'Quien la creó: staff (consultor/plataforma o cliente sin consultor), client (cliente con consultor, entra a revisión) o ai (propuesta de A05 aplicada).';
comment on column public.campaign_calendar_items.review_status is
  'Revision del consultor: pending (espera su revision), changes_requested (espera cambios del cliente), reviewed (revisada). null = no requiere revision.';

create index if not exists campaign_calendar_items_review_idx
  on public.campaign_calendar_items (organization_id, review_status)
  where review_status is not null and deleted_at is null;

-- Backfill: lo que ya existia. Las propuestas de A05 aplicadas son 'ai'; las
-- sugerencias del cliente aun sin aceptar ya son campañas "de cliente" por revisar.
update public.campaign_calendar_items
set origin = 'ai'
where origin = 'staff'
  and metadata -> 'a05_proposal' is not null;

update public.campaign_calendar_items
set origin = 'client',
    review_status = 'pending',
    review_requested_at = coalesce(review_requested_at, created_at)
where origin = 'staff'
  and review_status is null
  and coalesce(metadata -> 'client_suggestion' ->> 'pending', 'false') = 'true';

-- Hilo de la campaña.
create table if not exists public.campaign_item_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id uuid not null references public.campaign_calendar_items (id) on delete cascade,
  author_user_id uuid references public.profiles (id) on delete set null,
  author_kind text not null,
  kind text not null default 'note',
  target text,
  body text not null,
  visible_to_client boolean not null default true,
  payload jsonb,
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_item_notes_author_kind_valid
    check (author_kind in ('consultant', 'client', 'platform', 'ai', 'system')),
  constraint campaign_item_notes_kind_valid
    check (kind in ('note', 'correction', 'ai_proposal', 'system')),
  constraint campaign_item_notes_target_valid
    check (target is null or target in ('subject', 'preheader', 'body', 'cta', 'schedule', 'audience', 'creative', 'flow', 'other')),
  constraint campaign_item_notes_resolution_valid
    check (resolution is null or resolution in ('resolved', 'applied', 'dismissed')),
  constraint campaign_item_notes_body_length
    check (char_length(body) between 1 and 4000)
);

create index if not exists campaign_item_notes_item_idx
  on public.campaign_item_notes (item_id, created_at);
create index if not exists campaign_item_notes_open_idx
  on public.campaign_item_notes (organization_id, kind)
  where resolution is null and kind in ('correction', 'ai_proposal');

-- La nota y su campaña son de la misma organizacion (lo comprueba la API; esto
-- lo impide aunque se escriba por otro camino).
create or replace function private.enforce_campaign_item_note_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.campaign_calendar_items i
    where i.id = new.item_id and i.organization_id = new.organization_id
  ) then
    raise exception 'campaign note must belong to the same organization as its campaign';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_campaign_item_note_scope() from public;

drop trigger if exists enforce_campaign_item_notes_scope on public.campaign_item_notes;
create trigger enforce_campaign_item_notes_scope
before insert or update on public.campaign_item_notes
for each row execute function private.enforce_campaign_item_note_scope();

alter table public.campaign_item_notes enable row level security;

-- Staff ve todo el hilo (incluidas las notas internas); owner/manager del
-- cliente solo lo que se marcó como visible para el.
drop policy if exists "campaign_item_notes_select_workspace" on public.campaign_item_notes;
create policy "campaign_item_notes_select_workspace" on public.campaign_item_notes for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or (visible_to_client and private.current_member_role(organization_id) in ('owner', 'manager'))
);

-- Las escrituras van con service role desde la API, que comprueba rol y
-- pertenencia antes de insertar: la RLS solo abre select a authenticated.
grant select on public.campaign_item_notes to authenticated;

comment on table public.campaign_item_notes is
  'Hilo de revision de una campaña del calendario: notas, correcciones del consultor, propuestas de la IA (payload con los cambios) y lineas de sistema. Insert/update solo via API (service role); select workspace con las notas internas ocultas al cliente.';
comment on column public.campaign_item_notes.payload is
  'Solo para kind = ai_proposal: { edits: [{ field, label, was, now, why }] } propuestos por la IA; nada se escribe hasta que una persona los aplica.';
