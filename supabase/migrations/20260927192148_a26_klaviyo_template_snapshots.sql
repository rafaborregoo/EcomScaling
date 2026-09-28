-- Keep a small, bounded history of materially changed Klaviyo template bodies.
-- These are sync observations, not proof of the exact personalized message sent.

create table if not exists public.klaviyo_template_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts(id) on delete cascade,
  external_template_id varchar(255) not null,
  name varchar(255),
  editor_type varchar(80),
  html_content text,
  text_content text,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  observed_at timestamptz not null,
  superseded_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint klaviyo_template_snapshots_observed_order
    check (superseded_at >= observed_at)
);

create index if not exists klaviyo_template_snapshots_lookup_idx
  on public.klaviyo_template_snapshots
  (organization_id, account_id, external_template_id, observed_at desc);

alter table public.klaviyo_template_snapshots enable row level security;
revoke all on table public.klaviyo_template_snapshots from public, anon, authenticated;
grant select, insert, delete on table public.klaviyo_template_snapshots to service_role;

create or replace function private.archive_klaviyo_template_body_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
begin
  if old.html_content is not distinct from new.html_content
     and old.text_content is not distinct from new.text_content then
    return new;
  end if;

  insert into public.klaviyo_template_snapshots (
    organization_id, account_id, external_template_id, name, editor_type,
    html_content, text_content, external_created_at, external_updated_at,
    observed_at, superseded_at
  ) values (
    old.organization_id, old.account_id, old.external_template_id, old.name,
    old.editor_type, old.html_content, old.text_content, old.external_created_at,
    old.external_updated_at,
    coalesce(old.last_synced_at, old.updated_at, now()),
    greatest(
      coalesce(new.last_synced_at, now()),
      coalesce(old.last_synced_at, old.updated_at, now())
    )
  );

  -- Hard cap: retain the eight most recent observed bodies for each template.
  delete from public.klaviyo_template_snapshots s
  where s.id in (
    select older.id
    from public.klaviyo_template_snapshots older
    where older.organization_id = new.organization_id
      and older.account_id = new.account_id
      and older.external_template_id = new.external_template_id
    order by older.observed_at desc, older.created_at desc, older.id desc
    offset 8
  );
  return new;
end
$function$;

revoke all on function private.archive_klaviyo_template_body_change() from public, anon, authenticated;
grant execute on function private.archive_klaviyo_template_body_change() to postgres, service_role;

drop trigger if exists archive_klaviyo_template_body_change on public.klaviyo_templates;
create trigger archive_klaviyo_template_body_change
  before update of html_content, text_content on public.klaviyo_templates
  for each row execute function private.archive_klaviyo_template_body_change();

comment on table public.klaviyo_template_snapshots is
  'Last eight materially distinct sync-observed HTML/text versions per Klaviyo template. Not a verified recipient-specific sent-message snapshot.';
comment on column public.klaviyo_template_snapshots.observed_at is
  'When this body was last observed by our Klaviyo sync before it was superseded; not the provider send timestamp.';
comment on column public.klaviyo_template_snapshots.superseded_at is
  'When a later sync observed changed content; temporal matching is approximate and must be labeled as such.';

drop function if exists public.klaviyo_template_body_at_send(uuid, uuid, jsonb);

create or replace function public.klaviyo_template_body_at_send(
  target_organization_id uuid,
  target_store_id uuid,
  template_requests jsonb
)
returns table (
  account_id uuid,
  external_template_id text,
  send_time timestamptz,
  html_content text,
  text_content text,
  version_source text,
  version_observed_at timestamptz,
  version_superseded_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with requested as (
    select
      (item->>'account_id')::uuid as account_id,
      item->>'external_template_id' as external_template_id,
      nullif(item->>'send_time', '')::timestamptz as send_time
    from jsonb_array_elements(
      case when jsonb_typeof(template_requests) = 'array' then template_requests else '[]'::jsonb end
    ) as request_row(item)
    where request_row.item->>'external_template_id' is not null
      and nullif(request_row.item->>'account_id', '') is not null
      and nullif(request_row.item->>'send_time', '') is not null
  )
  select
    r.account_id,
    r.external_template_id,
    r.send_time,
    candidate.html_content,
    candidate.text_content,
    candidate.version_source,
    candidate.version_observed_at,
    candidate.version_superseded_at
  from requested r
  join public.klaviyo_accounts ka
    on ka.id = r.account_id
   and ka.organization_id = target_organization_id
   and (target_store_id is null or ka.store_id = target_store_id)
  left join lateral (
    select versions.html_content, versions.text_content, versions.version_source,
      versions.version_observed_at, versions.version_superseded_at
    from (
      select s.html_content, s.text_content, 'sync_window_candidate'::text as version_source,
        s.observed_at as version_observed_at, s.superseded_at as version_superseded_at
      from public.klaviyo_template_snapshots s
      where s.organization_id = target_organization_id
        and s.account_id = r.account_id
        and s.external_template_id = r.external_template_id
        and s.observed_at <= r.send_time
        and s.superseded_at >= r.send_time
        and not exists (
          select 1 from public.klaviyo_templates current_template
          where current_template.organization_id = target_organization_id
            and current_template.account_id = r.account_id
            and current_template.external_template_id = r.external_template_id
            and current_template.external_updated_at <= r.send_time
        )
      union all
      select t.html_content, t.text_content, 'sync_observed_current'::text,
        t.last_synced_at, null::timestamptz
      from public.klaviyo_templates t
      where t.organization_id = target_organization_id
        and t.account_id = r.account_id
        and t.external_template_id = r.external_template_id
        and t.last_synced_at <= r.send_time
      union all
      select t.html_content, t.text_content, 'provider_updated_at_precedes_send'::text,
        t.external_updated_at, null::timestamptz
      from public.klaviyo_templates t
      where t.organization_id = target_organization_id
        and t.account_id = r.account_id
        and t.external_template_id = r.external_template_id
        and t.external_updated_at <= r.send_time
    ) versions
    order by versions.version_observed_at desc nulls last
    limit 1
  ) candidate on true
$function$;

revoke all on function public.klaviyo_template_body_at_send(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.klaviyo_template_body_at_send(uuid, uuid, jsonb) to service_role;
comment on function public.klaviyo_template_body_at_send(uuid, uuid, jsonb) is
  'Matches email send times to bounded sync-observed template versions. This is an approximation of provider content, not proof of recipient-specific rendering.';
