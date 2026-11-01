-- Reuniones ↔ llamadas de consultoría.
--
-- Cada reunión reservada crea su `consulting_calls` (programada). De ahí cuelga
-- todo lo que ya existía: transcripción (manual o Fathom), resumen del agente A01,
-- aprobación antes de publicar al cliente y tareas desde la llamada. Por eso las
-- columnas de transcripción/resumen/acuerdos/análisis que `meetings` traía de la
-- migración anterior sobran: se retiran (la tabla es de hoy y no tiene datos).
--
-- Idempotente: se puede reaplicar si el esquema se ha tocado por fuera.

alter table public.meetings
  add column if not exists call_id uuid references public.consulting_calls (id) on delete set null;

alter table public.meetings drop column if exists transcript;
alter table public.meetings drop column if exists summary;
alter table public.meetings drop column if exists action_items;
alter table public.meetings drop column if exists analysis;
alter table public.meetings drop column if exists analyzed_at;

create index if not exists meetings_call_idx on public.meetings (call_id) where call_id is not null;

-- Tipo de llamada que crea cada tipo de reunión (el mismo catálogo que consulting_calls).
alter table public.meeting_types
  add column if not exists call_type varchar(40) not null default 'ad_hoc';

alter table public.meeting_types drop constraint if exists meeting_types_call_type_valid;
alter table public.meeting_types
  add constraint meeting_types_call_type_valid
  check (call_type in ('monthly_review', 'onboarding', 'strategy', 'ad_hoc'));

update public.meeting_types set call_type = 'monthly_review'
  where call_type = 'ad_hoc' and name = 'Revisión mensual';
update public.meeting_types set call_type = 'strategy'
  where call_type = 'ad_hoc' and name = 'Sesión de estrategia';

-- Las reuniones de una misma llamada de Fathom se casan con la programada por hora.
create index if not exists consulting_calls_scheduled_match_idx
  on public.consulting_calls (organization_id, scheduled_at)
  where status = 'scheduled' and external_recording_id is null;
