-- A24: separate the official Meta learning snapshot from the account-change
-- log. The latter is contextual evidence, not confirmation that learning reset.
drop function if exists public.meta_learning_phase_status(uuid, date, date, uuid);

create function public.meta_learning_phase_status(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  ad_set_id uuid,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  optimization_goal text,
  learning_stage_status text,
  learning_conversions integer,
  learning_conversions_needed integer,
  learning_threshold_source text,
  conversions_missing integer,
  daily_budget numeric,
  spend_in_period numeric,
  spend_source_days bigint,
  spend_source_rows bigint,
  last_account_activity_at timestamptz,
  last_account_activity_type text,
  last_account_activity_description text,
  days_since_account_activity numeric,
  activity_sync_state text,
  activity_sync_finished_at timestamptz,
  activity_sync_records_read integer,
  activity_reset_confirmation text,
  account_last_synced_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with scoped_sets as (
    select
      s.id,
      s.organization_id,
      s.external_ad_set_id,
      s.name,
      s.effective_status,
      s.optimization_goal,
      s.learning_stage_status,
      s.learning_conversions,
      s.learning_conversions_needed,
      s.daily_budget,
      c.name as campaign_name,
      c.ad_account_id,
      a.connection_id,
      a.external_ad_account_id,
      a.last_synced_at as account_last_synced_at
    from public.meta_ad_sets s
    join public.meta_campaigns c
      on c.id = s.campaign_id
     and c.organization_id = target_organization_id
    join public.meta_ad_accounts a
      on a.id = c.ad_account_id
     and a.organization_id = target_organization_id
    where s.organization_id = target_organization_id
      and (target_store_id is null or a.store_id = target_store_id)
  ),
  spend_by_set as (
    select
      r.ad_set_id,
      sum(r.spend)::numeric as spend,
      count(distinct r.metric_date)::bigint as source_days,
      count(*)::bigint as source_rows
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_set_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id
          and sa.organization_id = target_organization_id
          and sa.store_id = target_store_id
      ))
    group by r.ad_set_id
  )
  select
    s.id,
    s.name::text,
    s.campaign_name::text,
    s.effective_status::text,
    s.optimization_goal::text,
    s.learning_stage_status::text,
    s.learning_conversions,
    s.learning_conversions_needed,
    case when s.learning_conversions_needed is not null
      then 'local_50_conversion_reference'::text end,
    case when s.learning_conversions_needed is not null
      then greatest(s.learning_conversions_needed - coalesce(s.learning_conversions, 0), 0)
    end,
    s.daily_budget,
    coalesce(sp.spend, 0)::numeric,
    sp.source_days,
    sp.source_rows,
    activity.event_time,
    activity.event_type::text,
    coalesce(activity.translated_event_type, activity.event_type)::text,
    case when activity.event_time is not null
      then round(extract(epoch from (now() - activity.event_time))::numeric / 86400, 1)
    end,
    case
      when activity_sync.status in ('queued', 'running', 'retrying') then 'sync_in_progress'
      when activity_sync.finished_at is null then 'sync_unknown'
      when activity_sync.status <> 'succeeded' then 'sync_failed'
      when activity_sync.finished_at < now() - interval '48 hours' then 'stale'
      else 'fresh'
    end::text,
    activity_sync.finished_at,
    activity_sync.records_read,
    'not_confirmed_by_activity_log'::text,
    s.account_last_synced_at
  from scoped_sets s
  left join spend_by_set sp on sp.ad_set_id = s.id
  left join lateral (
    select a.event_time, a.event_type, a.translated_event_type
    from public.meta_account_activities a
    where a.organization_id = target_organization_id
      and a.ad_account_id = s.ad_account_id
      and a.object_external_id = s.external_ad_set_id
    order by a.event_time desc
    limit 1
  ) activity on true
  left join lateral (
    select r.status, r.finished_at, r.records_read
    from public.integration_sync_runs r
    where r.connection_id = s.connection_id
      and r.organization_id = target_organization_id
      and r.provider = 'meta_ads'
      and r.sync_scope = 'activities:' || s.external_ad_account_id
    order by r.created_at desc
    limit 1
  ) activity_sync on true
  where s.learning_stage_status is not null
     or coalesce(sp.spend, 0) > 0
  order by coalesce(sp.spend, 0) desc, s.name;
$function$;

comment on function public.meta_learning_phase_status(uuid, date, date, uuid) is
  'A24 learning snapshot. Official Meta stage/conversions are separated from generic account activity; a change-log event is never asserted to confirm a learning reset. The 50-conversion count is labeled as a local reference.';

revoke all on function public.meta_learning_phase_status(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.meta_learning_phase_status(uuid, date, date, uuid) to service_role;

with prompt_content as (
  select p.content || E'\n\n14. FRESCURA DEL HISTORIAL DE ACTIVIDAD\nInterpreta `activity_sync_state` para saber si el log de cambios está actualizado: `fresh` significa sync completado hace <=48 h; `stale`, `sync_failed`, `sync_unknown` o `sync_in_progress` hacen que la cobertura del historial sea desconocida. `last_account_activity_*` solo describe el evento más reciente que llegó; `days_since_account_activity` no mide días desde un cambio que reinició aprendizaje. La ausencia de un evento solo permite decir “no aparece en el historial sincronizado”, nunca “no hubo cambios”. Usa `activity_sync_records_read` junto a `activity_sync_finished_at` para contextualizar cobertura; no los conviertas en un conteo de cambios de aprendizaje.' as content
  from public.prompt_versions p
  where p.code = 'a24_medicion_meta_system' and p.version = 'v6'
)
insert into public.prompt_versions (code, version, content, checksum)
select 'a24_medicion_meta_system', 'v7', content, encode(sha256(content::bytea), 'hex')
from prompt_content
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v7', 'claude-sonnet-5', 'a24_medicion_meta_system', 'v7', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a24_medicion_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

with prompt_content as (
  select p.content || E'\n\n13. APRENDIZAJE Y REGISTRO DE CAMBIOS (REGLA VIGENTE)\n`learning_stage_status` y `learning_conversions` son la fotografía que Meta sincronizó; indica su frescura con `account_last_synced_at`. `learning_conversions_needed`/`conversions_missing` llevan `learning_threshold_source=local_50_conversion_reference`: 50 es una referencia interna, no un umbral confirmado en esta respuesta de Meta ni una fecha prometida para salir de aprendizaje. `last_account_activity_*` es el último evento disponible en el registro, no necesariamente un cambio significativo ni prueba de que reinició aprendizaje; `activity_reset_confirmation=not_confirmed_by_activity_log` lo explicita. No uses la ausencia de actividad registrada para afirmar que no hubo cambios. Gasto y `spend_source_days`/`spend_source_rows` describen la cobertura observada de filas ad-level sin breakdown y filtradas por tienda; faltan datos si no hay filas, nunca lo conviertas en cero universal. Prioriza estabilidad, presupuesto o consolidación como hipótesis solo junto con objetivo/evento, gasto, cobertura e incidencias: no recomiendes “no tocar” automáticamente ante un problema real.' as content
  from public.prompt_versions p
  where p.code = 'a24_medicion_meta_system' and p.version = 'v5'
)
insert into public.prompt_versions (code, version, content, checksum)
select 'a24_medicion_meta_system', 'v6', content, encode(sha256(content::bytea), 'hex')
from prompt_content
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v6', 'claude-sonnet-5', 'a24_medicion_meta_system', 'v6', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a24_medicion_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
