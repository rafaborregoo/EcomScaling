-- A14 reservations are atomic by organization, store and UTC day.
drop function if exists public.reserve_a14_manual_refresh(uuid, uuid, text, integer, text, uuid);
create or replace function public.reserve_a14_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text, p_daily_limit integer,
  p_request_key text default null, p_store_id uuid default null
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  if p_agent_code <> 'a14_operativa_meta' or p_store_id is null then raise exception 'invalid_a14_scope'; end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    raise exception 'invalid_store_scope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':a14_operativa_meta:' || p_store_id::text || ':' || v_day_start::text, 0));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reservation_day = v_day_start::date and r.request_key = p_request_key and r.store_id = p_store_id
  ) then return 'duplicate'; end if;
  select count(*) into v_runs from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.organization_id = p_organization_id and r.trigger_type = 'manual'
      and r.started_at >= v_day_start and d.code = p_agent_code and r.store_id = p_store_id
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reserved_at >= v_day_start and r.store_id = p_store_id;
  if v_runs + v_reserved >= greatest(p_daily_limit, 0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key, store_id)
  values (p_run_id, p_organization_id, p_agent_code, p_request_key, p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$$;
revoke all on function public.reserve_a14_manual_refresh(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_a14_manual_refresh(uuid, uuid, text, integer, text, uuid) to service_role;

alter table public.ai_diagnostic_gate_log drop constraint if exists ai_diagnostic_gate_log_reason_check;
alter table public.ai_diagnostic_gate_log add constraint ai_diagnostic_gate_log_reason_check check (
  reason in ('ran','no_activity','cooldown','pending_unreviewed','org_run_cap','org_budget',
    'platform_budget','tick_cap','meta_ineligible','error')
);

-- One spend row per ad/account/day. Keep both purchase count and value on one
-- attribution window so the resulting CPA and ROAS use compatible evidence.
drop function if exists public.meta_spend_summary(uuid, date, date, uuid);
create or replace function public.meta_spend_summary(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  spend numeric, impressions bigint, clicks bigint, purchases numeric,
  purchase_value numeric, roas numeric, cac numeric, days_with_data bigint,
  purchase_action_types text[]
)
language sql stable set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select distinct on (r.ad_account_id, r.level, r.external_entity_id, r.metric_date, r.breakdown_hash)
      r.id, r.ad_account_id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id and r.level = 'ad' and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start) and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
    order by r.ad_account_id, r.level, r.external_entity_id, r.metric_date, r.breakdown_hash,
      r.synced_at desc nulls last, r.action_report_time, r.attribution_hash, r.id desc
  ),
  selected_window as (
    select distinct on (m.insight_row_id)
      m.insight_row_id, m.attribution_window
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
      and m.metric_name in ('actions', 'action_values')
    order by m.insight_row_id, public.meta_attribution_window_rank(m.attribution_window), m.attribution_window
  ),
  row_purchases as (
    select m.insight_row_id, m.metric_name, sum(m.value) as value
    from public.meta_insight_action_metrics m
    join selected_window w on w.insight_row_id = m.insight_row_id and w.attribution_window = m.attribution_window
    where m.metric_name in ('actions', 'action_values')
    group by m.insight_row_id, m.metric_name
  ),
  purchase_actions as (
    select coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value
    from row_purchases
  ),
  action_types as (
    select coalesce(array_agg(distinct a.canonical_purchase_action_type), '{}') as types
    from base_rows b join public.meta_ad_accounts a on a.id = b.ad_account_id
  )
  select coalesce(sum(b.spend), 0), coalesce(sum(b.impressions), 0)::bigint,
    coalesce(sum(b.clicks), 0)::bigint, p.purchases, p.purchase_value,
    case when coalesce(sum(b.spend), 0) > 0 then round(p.purchase_value / sum(b.spend), 4) else null end,
    case when p.purchases > 0 then round(coalesce(sum(b.spend), 0) / p.purchases, 2) else null end,
    count(distinct b.metric_date)::bigint, t.types
  from base_rows b cross join purchase_actions p cross join action_types t
  group by p.purchases, p.purchase_value, t.types;
$function$;
grant execute on function public.meta_spend_summary(uuid, date, date, uuid) to authenticated;

-- Materialize a Meta task and its exact Camino link together, only while the
-- same window still has a fresh, usable A24 measurement verdict.
create or replace function public.materialize_a14_operational_task(
  p_task jsonb, p_organization_id uuid, p_store_id uuid, p_output_id uuid, p_proposal_index integer,
  p_plan_id uuid, p_plan_version integer, p_phase text, p_milestone_id uuid,
  p_period_start date, p_period_end date, p_evidence_safe boolean default false
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_task->>'title'), '');
  v_task_id uuid;
  v_created boolean := false;
  v_categories text[];
  v_existing_store_id uuid;
  v_gate_usable boolean;
  v_measurement_investigation boolean;
begin
  if p_organization_id is null or p_store_id is null or p_output_id is null or p_proposal_index is null
     or p_proposal_index < 0 or v_title is null or jsonb_typeof(p_task) <> 'object'
     or p_period_start is null or p_period_end < p_period_start then raise exception 'invalid_a14_task_payload'; end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    return jsonb_build_object('status', 'store_scope_changed');
  end if;
  select exists (
    select 1 from public.meta_measurement_verdict_cache g
    where g.organization_id = p_organization_id and g.store_id = p_store_id
      and g.period_start = p_period_start and g.period_end = p_period_end
      and g.verdict_version = 'a24-measurement-v2'
      and g.verdict_status = 'usable_with_attribution_limits'
      and g.evaluated_at <= now() and g.expires_at > now()
  ) into v_gate_usable;
  v_measurement_investigation :=
    lower(coalesce(p_task->>'title','') || ' ' || coalesce(p_task->>'description','')) ~ '(pixel|capi|conversions api|medici[oó]n|tracking|evento de compra|atribuci[oó]n|diagn[oó]stico de eventos|verificar eventos)'
    and lower(coalesce(p_task->>'title','') || ' ' || coalesce(p_task->>'description','')) !~ '(presupuesto|recortar|escalar|pausar|aumentar|reducir|gasto|inversi[oó]n|roas|cpa|cac|campa[nñ]a|anuncio)';
  if (not v_gate_usable or not coalesce(p_evidence_safe, false)) and not v_measurement_investigation then return jsonb_build_object('status', 'measurement_gate_changed'); end if;
  if p_plan_id is null then
    if p_plan_version is not null or p_milestone_id is not null or p_phase is not null then return jsonb_build_object('status', 'incomplete_camino_identity'); end if;
  elsif not exists (
    select 1 from public.strategic_plans p where p.id = p_plan_id and p.organization_id = p_organization_id
      and p.store_id = p_store_id and p.version = p_plan_version and p.status = 'active' and p.approved_at is not null
  ) then return jsonb_build_object('status', 'stale_plan'); end if;
  if p_milestone_id is not null and not exists (
    select 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id = m.phase_id
    join public.strategic_plans p on p.id = ph.plan_id
    where m.id = p_milestone_id and m.organization_id = p_organization_id and m.status in ('active','pending')
      and ph.status in ('active','pending') and ph.name = p_phase and p.id = p_plan_id
      and p.version = p_plan_version and p.status = 'active' and p.approved_at is not null and p.store_id = p_store_id
  ) then return jsonb_build_object('status', 'stale_milestone'); end if;
  select coalesce(array_agg(value), array['meta']::text[]) into v_categories
    from jsonb_array_elements_text(coalesce(p_task->'categories', '["meta"]'::jsonb)) as category(value);
  if not ('meta' = any(v_categories)) then v_categories := array_prepend('meta', v_categories); end if;
  insert into public.tasks (
    organization_id, store_id, source, priority, title, description, created_by,
    assigned_to, metadata, categories, agent_output_id, agent_proposal_index
  ) values (
    p_organization_id, p_store_id, 'ai_consultant',
    case when p_task->>'priority' in ('low','medium','high','urgent') then p_task->>'priority' else 'medium' end,
    v_title, nullif(p_task->>'description',''), nullif(p_task->>'created_by','')::uuid,
    nullif(p_task->>'assigned_to','')::uuid, coalesce(p_task->'metadata','{}'::jsonb), v_categories, p_output_id, p_proposal_index
  ) on conflict (agent_output_id, agent_proposal_index) do nothing returning id into v_task_id;
  if v_task_id is not null then v_created := true;
  else
    select t.id,t.store_id into v_task_id,v_existing_store_id from public.tasks t
    where t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index and t.organization_id = p_organization_id;
    if v_task_id is null then return jsonb_build_object('status','task_recovery_failed'); end if;
    if v_existing_store_id is distinct from p_store_id then return jsonb_build_object('status','existing_task_scope_conflict'); end if;
  end if;
  if p_milestone_id is not null then
    insert into public.milestone_task_links(organization_id,milestone_id,task_id)
    values(p_organization_id,p_milestone_id,v_task_id) on conflict(milestone_id,task_id) do nothing;
  end if;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$$;
revoke all on function public.materialize_a14_operational_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid, date, date, boolean) from public, anon, authenticated;
grant execute on function public.materialize_a14_operational_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid, date, date, boolean) to service_role;

insert into public.prompt_versions(code, version, content, checksum)
select p.code, 'v3', p.content || E'\n\nA14 v3 · CONTRATO OPERATIVO: analiza solo la tienda, cuenta, moneda y ventana UTC completa indicadas. CPA Meta es coste por compra atribuida, no CAC; CAC blended procede de clientes nuevos Shopify y no se sustituye por la atribución Meta. Compara ROAS atribuido con equilibrio solo si cobertura financiera y moneda están marcadas compatibles; el umbral incluye costes conocidos y gastos compartidos solo si están asignados. Diferencia costes confirmados, estimados y desconocidos; no conviertas ausencias en cero. Ventanas actual/anterior son contiguas y no se solapan. A24 es una barrera: si su estado no es usable_with_attribution_limits, no propongas tareas de inversión; conserva el diagnóstico, explica el bloqueo y pide investigación de medición. Nunca afirmes causalidad ni incrementalidad a partir de atribución. Contrasta cada prioridad con la meta vigente de Mi Camino y su factibilidad. Para propuestas, devuelve phase, plan_id, plan_version, milestone_id y alignment_rationale exactos del plan mostrado; usa null en todos si la tarea es libre. Incluye categorías con meta, responsable, criterio de cierre, métrica/ventana de revisión y evidencia de partida. No inventes nombres de campañas ni cambios de presupuesto; no propongas mutaciones Meta. Las recomendaciones informativas se muestran aunque no haya tareas. Usa search_knowledge solo para metodología; los bloques de ejecución del servidor son la fuente factual.',
  encode(sha256(convert_to(p.content || E'\n\nA14 v3 · CONTRATO OPERATIVO: analiza solo la tienda, cuenta, moneda y ventana UTC completa indicadas. CPA Meta es coste por compra atribuida, no CAC; CAC blended procede de clientes nuevos Shopify y no se sustituye por la atribución Meta. Compara ROAS atribuido con equilibrio solo si cobertura financiera y moneda están marcadas compatibles; el umbral incluye costes conocidos y gastos compartidos solo si están asignados. Diferencia costes confirmados, estimados y desconocidos; no conviertas ausencias en cero. Ventanas actual/anterior son contiguas y no se solapan. A24 es una barrera: si su estado no es usable_with_attribution_limits, no propongas tareas de inversión; conserva el diagnóstico, explica el bloqueo y pide investigación de medición. Nunca afirmes causalidad ni incrementalidad a partir de atribución. Contrasta cada prioridad con la meta vigente de Mi Camino y su factibilidad. Para propuestas, devuelve phase, plan_id, plan_version, milestone_id y alignment_rationale exactos del plan mostrado; usa null en todos si la tarea es libre. Incluye categorías con meta, responsable, criterio de cierre, métrica/ventana de revisión y evidencia de partida. No inventes nombres de campañas ni cambios de presupuesto; no propongas mutaciones Meta. Las recomendaciones informativas se muestran aunque no haya tareas. Las herramientas meta_spend_detail, meta_delivery_health, meta_change_log y meta_creative_health son de lectura y solo pueden investigar la tienda seleccionada y el mismo periodo; los bloques servidor son la fuente del gate financiero y de medición.', 'UTF8')), 'hex')
from public.prompt_versions p where p.code = 'a14_operativa_meta_system' and p.version = 'v2'
on conflict (code, version) do nothing;
update public.prompt_versions
set content = content || E'\n\nCorrección de alcance de alertas: ignora la frase heredada de v2 que dice que ninguna alerta tiene tienda. Usa las alertas cuyo store_id coincide con la tienda seleccionada; las alertas legacy sin store_id son solo contexto organizativo.',
    checksum = encode(sha256(convert_to(content || E'\n\nCorrección de alcance de alertas: ignora la frase heredada de v2 que dice que ninguna alerta tiene tienda. Usa las alertas cuyo store_id coincide con la tienda seleccionada; las alertas legacy sin store_id son solo contexto organizativo.', 'UTF8')), 'hex')
where code = 'a14_operativa_meta_system' and version = 'v3'
  and position('Corrección de alcance de alertas' in content) = 0;
update public.agent_versions set is_active = false
where is_active and definition_id in (select id from public.agent_definitions where code = 'a14_operativa_meta');
insert into public.agent_versions(definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active)
select v.definition_id, 'v3', v.model, v.prompt_code, 'v3',
  jsonb_build_array('search_knowledge','meta_spend_detail','meta_delivery_health','meta_change_log','meta_creative_health'),
  v.approval_mode, false
from public.agent_versions v join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a14_operativa_meta' and v.version = 'v2'
on conflict (definition_id, version) do nothing;
select public.promote_agent_version(v.id)
from public.agent_versions v join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a14_operativa_meta' and v.version = 'v3' and v.prompt_version = 'v3';
