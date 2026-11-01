-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create table if not exists public.agent_judge_eval_cases (
  id uuid primary key default gen_random_uuid(),
  agent_code text not null,
  dataset_version text not null,
  rubric_version text not null,
  split text not null check (split in ('development','calibration','holdout')),
  provenance text not null check (provenance in ('synthetic','anonymized_production')),
  privacy_reviewed boolean not null default false,
  scenario text not null check (length(scenario) between 1 and 300),
  evidence jsonb not null,
  artifact jsonb not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (content_sha256),
  check (pg_column_size(evidence) + pg_column_size(artifact) <= 102400),
  check (provenance <> 'anonymized_production' or privacy_reviewed),
  check (provenance <> 'synthetic' or split = 'development')
);

create table if not exists public.agent_judge_eval_case_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.agent_judge_eval_cases(id),
  reviewer_id uuid not null references auth.users(id),
  labels jsonb not null,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  unique (case_id, reviewer_id)
);

create table if not exists public.agent_judge_eval_case_adjudications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.agent_judge_eval_cases(id),
  adjudicator_id uuid not null references auth.users(id),
  request_id uuid not null unique,
  resolution text not null check (resolution in ('agreement','adjudicated')),
  labels jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_judge_eval_cases_queue_idx
  on public.agent_judge_eval_cases (split, agent_code, created_at);
create index if not exists agent_judge_eval_reviews_case_idx
  on public.agent_judge_eval_case_reviews (case_id, created_at);

alter table public.agent_judge_eval_cases enable row level security;
alter table public.agent_judge_eval_case_reviews enable row level security;
alter table public.agent_judge_eval_case_adjudications enable row level security;
revoke all on public.agent_judge_eval_cases, public.agent_judge_eval_case_reviews, public.agent_judge_eval_case_adjudications from public, anon, authenticated;
grant select, insert on public.agent_judge_eval_cases to service_role;
grant select, insert on public.agent_judge_eval_case_reviews to service_role;
grant select, insert on public.agent_judge_eval_case_adjudications to service_role;

create or replace function public.reject_agent_judge_eval_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'agent_judge_eval_rows_are_append_only' using errcode = '42501';
end;
$$;
revoke all on function public.reject_agent_judge_eval_mutation() from public, anon, authenticated;

drop trigger if exists agent_judge_eval_cases_append_only on public.agent_judge_eval_cases;
create trigger agent_judge_eval_cases_append_only before update or delete on public.agent_judge_eval_cases
for each row execute function public.reject_agent_judge_eval_mutation();
drop trigger if exists agent_judge_eval_reviews_append_only on public.agent_judge_eval_case_reviews;
create trigger agent_judge_eval_reviews_append_only before update or delete on public.agent_judge_eval_case_reviews
for each row execute function public.reject_agent_judge_eval_mutation();
drop trigger if exists agent_judge_eval_adjudications_append_only on public.agent_judge_eval_case_adjudications;
create trigger agent_judge_eval_adjudications_append_only before update or delete on public.agent_judge_eval_case_adjudications
for each row execute function public.reject_agent_judge_eval_mutation();

create or replace function public.limit_agent_judge_eval_case_reviews()
returns trigger language plpgsql set search_path = '' as $$
declare review_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.case_id::text, 0));
  select count(*) into review_count from public.agent_judge_eval_case_reviews where case_id = new.case_id;
  if review_count >= 2 then
    raise exception 'agent_judge_eval_case_review_limit_reached' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_agent_judge_eval_case_reviews() from public, anon, authenticated;
drop trigger if exists agent_judge_eval_case_review_limit on public.agent_judge_eval_case_reviews;
create trigger agent_judge_eval_case_review_limit before insert on public.agent_judge_eval_case_reviews
for each row execute function public.limit_agent_judge_eval_case_reviews();

create or replace function public.validate_agent_judge_eval_adjudication()
returns trigger language plpgsql set search_path = '' as $$
declare reviewer_ids uuid[]; review_labels jsonb[]; review_count integer; case_split text; case_provenance text;
begin
  select array_agg(reviewer_id order by reviewer_id), array_agg(labels order by reviewer_id), count(*)
    into reviewer_ids, review_labels, review_count
    from public.agent_judge_eval_case_reviews where case_id = new.case_id;
  if review_count <> 2 or new.adjudicator_id = any(reviewer_ids) then
    raise exception 'agent_judge_eval_adjudication_requires_two_independent_reviews' using errcode = '23514';
  end if;
  select split, provenance into case_split, case_provenance from public.agent_judge_eval_cases where id = new.case_id;
  if case_split in ('calibration', 'holdout') and case_provenance <> 'anonymized_production' then
    raise exception 'agent_judge_eval_nonproduction_case_cannot_enter_calibration' using errcode = '23514';
  end if;
  if new.resolution = 'agreement' and (review_labels[1] <> review_labels[2] or new.labels <> review_labels[1]) then
    raise exception 'agent_judge_eval_agreement_labels_must_match' using errcode = '23514';
  end if;
  if new.resolution = 'adjudicated' and review_labels[1] = review_labels[2] then
    raise exception 'agent_judge_eval_agreement_must_be_recorded_as_agreement' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_agent_judge_eval_adjudication() from public, anon, authenticated;
drop trigger if exists agent_judge_eval_adjudication_validate on public.agent_judge_eval_case_adjudications;
create trigger agent_judge_eval_adjudication_validate before insert on public.agent_judge_eval_case_adjudications
for each row execute function public.validate_agent_judge_eval_adjudication();

comment on table public.agent_judge_eval_cases is 'Blind, PII-reviewed agent judge benchmark cases. Production labels are stored separately.';
comment on table public.agent_judge_eval_case_reviews is 'Independent blind human labels; reviewers never receive other labels or judge outputs.';
comment on table public.agent_judge_eval_case_adjudications is 'Immutable adjudicated gold labels for calibration and holdout evaluation.';


