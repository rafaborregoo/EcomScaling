-- Programación de publicaciones + hilo de conversación bidireccional sobre el
-- borrador. El SaaS se comporta como una conversación constante consultor <->
-- cliente (y consultor IA): cada borrador lleva su hilo, y la fecha prevista de
-- publicación es un dato más que se discute en ese hilo.

-- 1. Fecha/hora prevista de publicación del borrador. La fija el cliente
--    (owner/manager); el consultor la ve en su calendario y puede objetar en
--    el hilo. null = sin programar.
alter table public.marketing_content_drafts
  add column if not exists scheduled_for timestamptz;

create index if not exists marketing_content_drafts_scheduled_idx
  on public.marketing_content_drafts (organization_id, scheduled_for)
  where scheduled_for is not null;

comment on column public.marketing_content_drafts.scheduled_for is
  'Fecha/hora prevista de publicación que fija el cliente; null = sin programar. El consultor la ve en su calendario de publicaciones.';

-- 2. El hilo de notas deja de ser "solo objeciones del consultor": el cliente
--    también responde. author_kind etiqueta quién habla sin join al leer.
alter table public.marketing_content_draft_notes
  add column if not exists author_kind text not null default 'consultant';

alter table public.marketing_content_draft_notes
  drop constraint if exists marketing_content_draft_notes_author_kind_check;
alter table public.marketing_content_draft_notes
  add constraint marketing_content_draft_notes_author_kind_check
  check (author_kind in ('consultant', 'client', 'platform', 'ai'));

comment on column public.marketing_content_draft_notes.author_kind is
  'Quién escribió el mensaje: consultant | client | platform | ai. Se fija en el insert desde el rol del actor. Las líneas de sistema (cambios de fecha) también usan este campo.';

comment on table public.marketing_content_draft_notes is
  'Hilo de conversación bidireccional sobre un borrador de marketing (consultor, cliente, plataforma, IA). Insert solo via API (service role) con frontera de workspace; select workspace.';
