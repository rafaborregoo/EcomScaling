-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Pin release evidence to the exact agent configuration and prompt bytes.
-- A certified candidate cannot be edited in place after manifest capture.

create table if not exists public.agent_version_release_manifests (
  agent_version_id uuid primary key
    references public.agent_versions(id) on delete restrict,
  manifest_sha256 varchar(64) not null,
  prompt_sha256 varchar(64) not null,
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  constraint agent_version_release_manifest_hash check (
    manifest_sha256 ~ '^[0-9a-f]{64}$' and prompt_sha256 ~ '^[0-9a-f]{64}$'
  )
);

alter table public.agent_version_release_manifests enable row level security;
revoke all on public.agent_version_release_manifests from public, anon, authenticated;
grant select on public.agent_version_release_manifests to service_role;

create or replace function private.agent_version_release_manifest(p_agent_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_manifest jsonb;
  v_prompt_sha256 text;
begin
  select encode(extensions.digest(convert_to(p.content, 'UTF8'), 'sha256'), 'hex')
    into v_prompt_sha256
  from public.agent_versions av
  join public.agent_definitions d on d.id = av.definition_id
  join public.prompt_versions p
    on p.code = av.prompt_code and p.version = av.prompt_version
  where av.id = p_agent_version_id;

  if v_prompt_sha256 is null then
    raise exception using errcode = 'P0002',
      message = 'agent_release_gate:version_or_prompt_missing';
  end if;

  select jsonb_build_object(
    'agent_version_id', av.id,
    'agent_code', d.code,
    'version', av.version,
    'model', av.model,
    'prompt_code', av.prompt_code,
    'prompt_version', av.prompt_version,
    'prompt_sha256', v_prompt_sha256,
    'allowed_tools', av.allowed_tools,
    'approval_mode', av.approval_mode,
    'output_schema_version', av.output_schema_version,
    'config', coalesce(av.config, '{}'::jsonb)
  ) into v_manifest
  from public.agent_versions av
  join public.agent_definitions d on d.id = av.definition_id
  where av.id = p_agent_version_id;

  return v_manifest || jsonb_build_object(
    'manifest_sha256', encode(
      extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex'
    )
  );
end;
$$;

create or replace function public.capture_agent_version_release_manifest(p_agent_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_manifest jsonb;
  v_existing jsonb;
begin
  v_manifest := private.agent_version_release_manifest(p_agent_version_id);
  insert into public.agent_version_release_manifests (
    agent_version_id, manifest_sha256, prompt_sha256, manifest
  ) values (
    p_agent_version_id,
    v_manifest->>'manifest_sha256',
    v_manifest->>'prompt_sha256',
    v_manifest
  ) on conflict (agent_version_id) do nothing;

  select manifest into v_existing
  from public.agent_version_release_manifests
  where agent_version_id = p_agent_version_id;

  if v_existing->>'manifest_sha256' is distinct from v_manifest->>'manifest_sha256' then
    raise exception using errcode = '23514',
      message = 'agent_release_gate:manifest_changed_create_new_version';
  end if;
  return v_existing;
end;
$$;

revoke all on function private.agent_version_release_manifest(uuid) from public, anon, authenticated;
revoke all on function public.capture_agent_version_release_manifest(uuid) from public, anon, authenticated;
grant execute on function public.capture_agent_version_release_manifest(uuid) to service_role;

create or replace function private.protect_manifested_agent_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if (to_jsonb(new) - 'is_active') is distinct from (to_jsonb(old) - 'is_active')
     and exists (
       select 1 from public.agent_version_release_manifests m
       where m.agent_version_id = old.id
     ) then
    raise exception using errcode = '23514',
      message = 'agent_release_gate:manifested_version_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists agent_versions_manifest_immutable on public.agent_versions;
create trigger agent_versions_manifest_immutable
before update on public.agent_versions
for each row execute function private.protect_manifested_agent_version();

create or replace function private.protect_manifested_prompt()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.agent_versions av
      join public.agent_version_release_manifests m on m.agent_version_id = av.id
      where av.prompt_code = old.code and av.prompt_version = old.version
    ) then
      raise exception using errcode = '23514',
        message = 'agent_release_gate:manifested_prompt_is_immutable';
    end if;
    return old;
  end if;

  if (new.content, new.checksum, new.code, new.version)
       is distinct from (old.content, old.checksum, old.code, old.version)
     and exists (
       select 1 from public.agent_versions av
       join public.agent_version_release_manifests m on m.agent_version_id = av.id
       where av.prompt_code = old.code and av.prompt_version = old.version
     ) then
    raise exception using errcode = '23514',
      message = 'agent_release_gate:manifested_prompt_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prompt_versions_manifest_immutable on public.prompt_versions;
create trigger prompt_versions_manifest_immutable
before update or delete on public.prompt_versions
for each row execute function private.protect_manifested_prompt();

revoke all on function private.protect_manifested_agent_version() from public, anon, authenticated;
revoke all on function private.protect_manifested_prompt() from public, anon, authenticated;

create or replace function private.agent_version_has_release_evidence(p_agent_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_code text;
  v_fingerprint text;
  v_mode text;
begin
  select d.code, m.manifest_sha256
    into v_code, v_fingerprint
  from public.agent_versions av
  join public.agent_definitions d on d.id = av.definition_id
  join public.agent_version_release_manifests m on m.agent_version_id = av.id
  where av.id = p_agent_version_id
    and m.manifest_sha256 = private.agent_version_release_manifest(av.id)->>'manifest_sha256';
  if v_code is null or v_fingerprint is null then return false; end if;

  foreach v_mode in array array['offline', 'live'] loop
    if not exists (
      select 1
      from public.agent_version_evaluations e
      join public.agent_version_eval_results r on r.evaluation_id = e.id
      where e.agent_version_id = p_agent_version_id
        and e.dataset_version = '2026-09-29.v2'
        and e.evaluation_mode = v_mode
        and e.status = 'passed'
        and e.evaluated_agent_codes @> to_jsonb(array[v_code]::text[])
        and e.evidence->>'candidate_fingerprint' = v_fingerprint
        and e.evidence->>'release_eligible' = 'true'
        and (v_mode <> 'live' or (
          coalesce((e.evidence->>'gold_cases')::integer, 0) >= 10
          and coalesce((e.evidence->>'holdout_cases')::integer, 0) >= 3
        ))
        and r.agent_code = v_code
        and r.passed is true
        and r.checks > 0
        and r.failed = '[]'::jsonb
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

-- A passed eval without the exact pinned candidate fingerprint is rejected at
-- the evidence write boundary, not merely hidden from the release UI.
create or replace function private.record_agent_version_evaluation(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_evaluation_id uuid;
  v_version_id uuid;
  v_fingerprint text;
  v_current_fingerprint text;
begin
  v_version_id := (p_payload->'evaluation'->>'agent_version_id')::uuid;
  v_fingerprint := p_payload->'evaluation'->'evidence'->>'candidate_fingerprint';
  if p_payload->'evaluation'->>'status' = 'passed'
     and p_payload->'evaluation'->>'evaluation_mode' in ('offline', 'live') then
    select manifest_sha256 into v_current_fingerprint
    from public.agent_version_release_manifests
    where agent_version_id = v_version_id;
    if v_current_fingerprint is null
       or v_fingerprint is distinct from v_current_fingerprint
       or v_current_fingerprint is distinct from
         private.agent_version_release_manifest(v_version_id)->>'manifest_sha256' then
      raise exception using errcode = '23514',
        message = 'agent_release_gate:candidate_fingerprint_required';
    end if;
    if p_payload->'evaluation'->>'evaluation_mode' = 'live'
       and (
         coalesce((p_payload->'evaluation'->'evidence'->>'gold_cases')::integer, 0) < 10
         or coalesce((p_payload->'evaluation'->'evidence'->>'holdout_cases')::integer, 0) < 3
         or p_payload->'evaluation'->'evidence'->>'release_eligible' is distinct from 'true'
       ) then
      raise exception using errcode = '23514',
        message = 'agent_release_gate:adjudicated_live_suite_required';
    end if;
  end if;

  insert into public.agent_version_evaluations (
    agent_version_id, dataset_version, evaluation_mode, status, overall_score,
    scores, rates, evaluated_agent_codes, agent_eval_failures, evidence
  ) values (
    v_version_id,
    p_payload->'evaluation'->>'dataset_version',
    p_payload->'evaluation'->>'evaluation_mode',
    p_payload->'evaluation'->>'status',
    nullif(p_payload->'evaluation'->>'overall_score', '')::numeric,
    coalesce(p_payload->'evaluation'->'scores', '{}'::jsonb),
    coalesce(p_payload->'evaluation'->'rates', '{}'::jsonb),
    coalesce(p_payload->'evaluation'->'evaluated_agent_codes', '[]'::jsonb),
    coalesce(p_payload->'evaluation'->'agent_eval_failures', '[]'::jsonb),
    coalesce(p_payload->'evaluation'->'evidence', '{}'::jsonb)
  ) on conflict (agent_version_id, dataset_version, evaluation_mode)
  do update set
    status = excluded.status,
    overall_score = excluded.overall_score,
    scores = excluded.scores,
    rates = excluded.rates,
    evaluated_agent_codes = excluded.evaluated_agent_codes,
    agent_eval_failures = excluded.agent_eval_failures,
    evidence = excluded.evidence,
    evaluated_at = now()
  returning id into v_evaluation_id;

  delete from public.agent_version_eval_results
  where evaluation_id = v_evaluation_id;
  insert into public.agent_version_eval_results (
    evaluation_id, agent_code, passed, checks, failed, metrics
  ) select
    v_evaluation_id,
    item->>'agent_code',
    coalesce((item->>'passed')::boolean, false),
    coalesce((item->>'checks')::integer, 0),
    coalesce(item->'failed', '[]'::jsonb),
    coalesce(item->'metrics', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_payload->'results', '[]'::jsonb)) item;
  return v_evaluation_id;
end;
$$;

revoke all on function private.record_agent_version_evaluation(jsonb) from public, anon, authenticated;
grant execute on function private.record_agent_version_evaluation(jsonb) to service_role;
revoke all on function private.agent_version_has_release_evidence(uuid) from public, anon, authenticated;

comment on table public.agent_version_release_manifests is
  'Immutable SHA-256 release manifest binding an agent version to its prompt bytes, model, tools and output contract.';


