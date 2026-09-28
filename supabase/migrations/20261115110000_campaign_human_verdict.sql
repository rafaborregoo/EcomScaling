-- Veredicto humano del resultado real de una campaña; no se infiere de métricas.
alter table public.campaign_calendar_items
  add column if not exists outcome_verdict text,
  add column if not exists outcome_reason text,
  add column if not exists outcome_decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists outcome_decided_at timestamptz;

alter table public.campaign_calendar_items
  drop constraint if exists campaign_calendar_items_outcome_verdict_valid;
alter table public.campaign_calendar_items
  add constraint campaign_calendar_items_outcome_verdict_valid
  check (outcome_verdict is null or outcome_verdict in ('worked','did_not_work','mixed'));
alter table public.campaign_calendar_items
  drop constraint if exists campaign_calendar_items_outcome_complete;
alter table public.campaign_calendar_items
  add constraint campaign_calendar_items_outcome_complete check (
    (outcome_verdict is null and outcome_reason is null and outcome_decided_at is null)
    or (outcome_verdict is not null and length(btrim(coalesce(outcome_reason,''))) >= 8 and outcome_decided_at is not null)
  );
create index if not exists campaign_calendar_items_outcome_idx
  on public.campaign_calendar_items(organization_id, outcome_decided_at desc)
  where outcome_verdict is not null and deleted_at is null;
comment on column public.campaign_calendar_items.outcome_verdict is
  'Veredicto humano explícito de una campaña ejecutada; no inferido por la IA ni por métricas aisladas.';
;
