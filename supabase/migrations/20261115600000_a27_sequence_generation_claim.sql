-- A27: reserve a sequence ID before provider work so concurrent retries cannot
-- start duplicate strategy generations for the same plan.
alter table public.marketing_mailing_sequences
  drop constraint if exists marketing_mailing_sequences_status_check;

alter table public.marketing_mailing_sequences
  add constraint marketing_mailing_sequences_status_check
  check (status in ('generating', 'planned', 'in_progress', 'completed', 'abandoned', 'failed'));

create index if not exists marketing_mailing_sequences_generation_lease_idx
  on public.marketing_mailing_sequences (updated_at)
  where status = 'generating';

comment on column public.marketing_mailing_sequences.updated_at is
  'Also acts as the lease heartbeat for A27 status=generating; stale claims may be reclaimed after the generation timeout.';
