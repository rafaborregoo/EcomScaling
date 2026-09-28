-- A27/A11: prevent duplicate sequence drafts when the client retries a request.
alter table public.marketing_content_drafts
  add column if not exists idempotency_key text,
  add column if not exists idempotency_fingerprint text;

alter table public.marketing_content_drafts
  drop constraint if exists marketing_content_drafts_idempotency_pair_check;
alter table public.marketing_content_drafts
  add constraint marketing_content_drafts_idempotency_pair_check
  check (
    (idempotency_key is null and idempotency_fingerprint is null)
    or (
      idempotency_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:[1-9][0-9]?$'
      and idempotency_fingerprint ~ '^[0-9a-f]{64}$'
    )
  );

alter table public.marketing_content_drafts enable row level security;

create unique index if not exists marketing_content_drafts_org_idempotency_uidx
  on public.marketing_content_drafts (organization_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.marketing_content_drafts.idempotency_key is
  'Optional sequence/email key. Unique per organization; used only for safe server-side retries.';
comment on column public.marketing_content_drafts.idempotency_fingerprint is
  'SHA-256 of the normalized request; a reused key with different content is rejected.';
