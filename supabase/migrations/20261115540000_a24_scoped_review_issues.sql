-- A24 issue inventory scoped to the selected store, with the owning Meta
-- account/ad identity and sync freshness. Text remains a bounded observation,
-- never a categorical rejection unless its source explicitly says so.
drop function if exists public.meta_scoped_review_issues(uuid, date, date, uuid);

create or replace function public.meta_scoped_review_issues(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table (
  issue_id uuid,
  ad_id uuid,
  ad_name text,
  ad_effective_status text,
  ad_set_id uuid,
  ad_set_name text,
  campaign_id uuid,
  campaign_name text,
  ad_account_id uuid,
  account_name text,
  store_id uuid,
  issue_level text,
  error_code integer,
  error_type text,
  error_summary text,
  review_category text,
  detected_at timestamptz,
  account_last_synced_at timestamptz,
  freshness text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_organization_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_scoped_review_issues_input';
  end if;

  return query
  select
    i.id,
    d.id,
    d.name::text,
    d.effective_status::text,
    s.id,
    s.name::text,
    c.id,
    c.name::text,
    a.id,
    a.account_name::text,
    a.store_id,
    i.level::text,
    i.error_code,
    i.error_type::text,
    left(i.error_summary, 400),
    case
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(reject(ed|ion)?|disapprov(ed|al)?)([^a-z]|$)' then 'rejected'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(limit(ed|ation)?|delivery)([^a-z]|$)' then 'limited_or_delivery'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(warning|warn)([^a-z]|$)' then 'warning'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(error|technical|invalid)([^a-z]|$)' then 'technical_issue'
      else 'unclassified_issue'
    end,
    i.detected_at,
    a.last_synced_at,
    case
      when a.last_synced_at is null then 'unknown_sync'
      when a.last_synced_at < now() - interval '24 hours' then 'stale'
      else 'fresh'
    end
  from public.meta_ad_issues i
  join public.meta_ads d
    on d.id = i.ad_id and d.organization_id = target_organization_id
  join public.meta_ad_sets s
    on s.id = d.ad_set_id and s.organization_id = target_organization_id
  join public.meta_campaigns c
    on c.id = s.campaign_id and c.organization_id = target_organization_id
  join public.meta_ad_accounts a
    on a.id = c.ad_account_id and a.organization_id = target_organization_id
  where i.organization_id = target_organization_id
    and i.detected_at >= period_start::timestamptz
    and i.detected_at < (period_end + 1)::timestamptz
    and (target_store_id is null or a.store_id = target_store_id)
  order by i.detected_at desc, i.id
  limit 30;
end;
$$;

comment on function public.meta_scoped_review_issues(uuid, date, date, uuid) is
  'Read-only A24 list of current synced Meta review issues, tenant/store scoped and joined to ad/account state and account sync freshness; issue text is only classified when explicit terms support it.';

revoke all on function public.meta_scoped_review_issues(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.meta_scoped_review_issues(uuid, date, date, uuid) to service_role;

-- Correct the prior prompt's unsafe assumption: missing Purchase statistics or
-- a pixel with no rows means unknown/coverage gap until optimization mapping
-- and store activity prove otherwise. A free-text issue is not always reject.
with prompt_content as (
  select p.content || E'\n\n10. DATOS DE COBERTURA Y PROBLEMAS DE REVISIÓN (REGLA VIGENTE)\nEsta regla sustituye cualquier instrucción anterior que equipare ausencia de eventos Purchase con pixel roto o una fila de problema con anuncio rechazado. Sin estadísticas o sin evento no significa fallo confirmado: clasifica como cobertura insuficiente/desconocido, salvo evidencia explícita de actividad comparable y objetivo/evento configurado. No declares ROAS inválido si no puedes vincular el evento requerido con el objetivo de optimización del conjunto; di que la alineación no está disponible.\nEn incidencias, `review_category` y `freshness` describen una observación sincronizada. `rejected` solo autoriza decir rechazado si la categoría lo indica y la sincronización es fresh; `limited_or_delivery`, `warning`, `technical_issue` y `unclassified_issue` no son rechazos. Si está stale/unknown, presenta la fecha y pide comprobarlo en Meta antes de proponer apelación. Pixel/CAPI deduplicación, calidad de coincidencia y responsabilidad causal quedan desconocidas si no hay dato fuente. El aprendizaje es contexto, no motivo automático de no actuar.' as content
  from public.prompt_versions p
  where p.code = 'a24_medicion_meta_system' and p.version = 'v2'
)
insert into public.prompt_versions (code, version, content, checksum)
select 'a24_medicion_meta_system', 'v3', content, encode(sha256(content::bytea), 'hex')
from prompt_content
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-sonnet-5', 'a24_medicion_meta_system', 'v3', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a24_medicion_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
