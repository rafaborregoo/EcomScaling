-- RLS: evaluar el permiso una vez por consulta, no una vez por fila.
--
-- Sintoma: /shopify/metrics devolvia 500 y /ai/monitor 502 de forma
-- intermitente. Causa medida con EXPLAIN ANALYZE como rol `authenticated`:
--
--   Seq Scan on shopify_order_facts (rows=738)  Buffers: shared hit=5662
--     Filter: (organization_id = '...' AND private.can_access_org(organization_id))
--   Execution Time: 863.644 ms
--
-- 738 filas, tabla de 688 kB, 863 ms. Al recibir una COLUMNA como argumento,
-- `can_access_org` no se puede sacar del bucle y se ejecuta una vez por fila
-- (~1,2 ms cada una: cuatro funciones anidadas con sus propios lookups). Con un
-- argumento constante el planificador la evalua UNA vez: 1000 llamadas = 0 ms.
-- Medido. `getShopifyMetrics` lanza 10 de estas RPC en paralelo y el dashboard
-- del cliente las pide dos veces a la vez, asi que se cruzaba el
-- `statement_timeout` de 8s del rol `authenticated` (57014) y el codigo hacia
-- throw -> 500. Y crece lineal con las filas: a 10k pedidos no carga nunca.
--
-- Arreglo: el predicado pasa de "funcion(columna)" a "columna in (select
-- conjunto())". Un conjunto sin argumentos se evalua una sola vez por consulta
-- (SubPlan hasheado) y despues cada fila es una busqueda en hash. La semantica
-- es identica -- se comprueba abajo con una asercion sobre los datos reales
-- antes de tocar ninguna policy.
--
-- Solo se tocan las 108 policies de SELECT (rol `authenticated`). Las de
-- escritura usan `can_manage_org` sobre una fila y no tienen este problema.
--
-- Idempotente: `create or replace` en las funciones y `alter policy ... using`
-- fija la expresion final, se ejecute las veces que se ejecute.

-- Organizaciones a las que el usuario actual tiene acceso. Es `can_access_org`
-- del reves: mismas tres vias (platform admin / consultor asignado / miembro
-- activo con suscripcion valida), pero devolviendo el conjunto de una vez en
-- lugar de responder si/no organizacion por organizacion.
create or replace function private.accessible_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  -- platform_admin: todas, sin filtrar por estado de la organizacion (es lo
  -- que hacia `can_access_org`, que cortocircuitaba antes de mirar el estado).
  select o.id
  from public.organizations o
  where (select private.is_platform_admin())
  union
  select ca.organization_id
  from public.consultant_assignments ca
  join public.profiles p on p.id = ca.consultant_user_id
  join public.organizations o on o.id = ca.organization_id
  where ca.consultant_user_id = auth.uid()
    and ca.is_active
    and p.is_active
    and p.platform_role in ('consultant', 'platform_admin')
    and o.status in ('onboarding', 'active')
  union
  select om.organization_id
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.is_active
    and o.status in ('onboarding', 'active')
    and exists (
      select 1
      from public.service_subscriptions ss
      where ss.organization_id = om.organization_id
        and ss.status in ('trial', 'active')
        and (ss.starts_at is null or ss.starts_at <= now())
        and (ss.ends_at is null or ss.ends_at > now())
    );
$fn$;

-- Mismo tratamiento para `is_assigned_consultant`, que aparece con la columna
-- como argumento en las policies compuestas (tasks, consulting_calls...).
create or replace function private.assigned_consultant_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  select ca.organization_id
  from public.consultant_assignments ca
  join public.profiles p on p.id = ca.consultant_user_id
  join public.organizations o on o.id = ca.organization_id
  where ca.consultant_user_id = auth.uid()
    and ca.is_active
    and p.is_active
    and p.platform_role in ('consultant', 'platform_admin')
    and o.status in ('onboarding', 'active');
$fn$;

grant execute on function private.accessible_org_ids() to authenticated;
grant execute on function private.assigned_consultant_org_ids() to authenticated;

-- Asercion: para CADA par (usuario, organizacion) de los datos reales, el
-- conjunto nuevo tiene que decir exactamente lo mismo que la funcion que
-- sustituye. Si diverge, la migracion aborta y no se reescribe ninguna policy
-- -- un permiso de mas aqui es una fuga entre tenants.
do $check$
declare
  claims_previos text := current_setting('request.jwt.claims', true);
  divergencias int;
begin
  select count(*)
  into divergencias
  from public.profiles u
  cross join public.organizations o
  cross join lateral (
    select set_config(
      'request.jwt.claims',
      json_build_object('sub', u.id, 'role', 'authenticated')::text,
      true
    )
  ) _
  where private.can_access_org(o.id)
        is distinct from (o.id in (select private.accessible_org_ids()))
     or private.is_assigned_consultant(o.id)
        is distinct from (o.id in (select private.assigned_consultant_org_ids()));

  perform set_config('request.jwt.claims', coalesce(claims_previos, ''), true);

  if divergencias > 0 then
    raise exception
      'accessible_org_ids/assigned_consultant_org_ids divergen de can_access_org/is_assigned_consultant en % pares (usuario, organizacion): no se reescriben las policies',
      divergencias;
  end if;
end;
$check$;

-- Las 90 policies cuyo predicado es exactamente `can_access_org(organization_id)`.
alter policy agent_run_steps_select_authorized on public.agent_run_steps
  using (organization_id in (select private.accessible_org_ids()));
alter policy agent_runs_select_authorized on public.agent_runs
  using (organization_id in (select private.accessible_org_ids()));
alter policy agent_tool_calls_select_authorized on public.agent_tool_calls
  using (organization_id in (select private.accessible_org_ids()));
alter policy alerts_select_authorized on public.alerts
  using (organization_id in (select private.accessible_org_ids()));
alter policy call_task_links_select_authorized on public.call_task_links
  using (organization_id in (select private.accessible_org_ids()));
alter policy client_constraints_select_visible on public.client_constraints
  using (organization_id in (select private.accessible_org_ids()));
alter policy fixed_expenses_select_authorized on public.fixed_expenses
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_account_insights_select_authorized on public.instagram_account_insight_values
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_account_snapshots_select_authorized on public.instagram_account_snapshots
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_accounts_select_authorized on public.instagram_accounts
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_follower_winners_select_authorized on public.instagram_follower_winners
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_image_bank_select on public.instagram_image_bank
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_image_overlays_select on public.instagram_image_overlays
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_media_select_authorized on public.instagram_media
  using (organization_id in (select private.accessible_org_ids()));
alter policy instagram_media_insights_select_authorized on public.instagram_media_insight_values
  using (organization_id in (select private.accessible_org_ids()));
alter policy integration_connections_select_authorized on public.integration_connections
  using (organization_id in (select private.accessible_org_ids()));
alter policy integration_sync_runs_select_authorized on public.integration_sync_runs
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_accounts_select_authorized on public.klaviyo_accounts
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_campaign_audiences_select_authorized on public.klaviyo_campaign_audiences
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_campaign_messages_select_authorized on public.klaviyo_campaign_messages
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_campaigns_select_authorized on public.klaviyo_campaigns
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_daily_account_metrics_select_authorized on public.klaviyo_daily_account_metrics
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_flow_actions_select_authorized on public.klaviyo_flow_actions
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_flow_messages_select_authorized on public.klaviyo_flow_messages
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_flows_select_authorized on public.klaviyo_flows
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_forms_select_authorized on public.klaviyo_forms
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_list_daily_snapshots_select_authorized on public.klaviyo_list_daily_snapshots
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_lists_select_authorized on public.klaviyo_lists
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_metrics_select_authorized on public.klaviyo_metrics
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_report_runs_select_authorized on public.klaviyo_report_runs
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_report_values_select_authorized on public.klaviyo_report_values
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_segment_daily_snapshots_select_authorized on public.klaviyo_segment_daily_snapshots
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_segments_select_authorized on public.klaviyo_segments
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_templates_select_authorized on public.klaviyo_templates
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_tracking_consents_select_authorized on public.klaviyo_tracking_consents
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_tracking_events_select_authorized on public.klaviyo_tracking_events
  using (organization_id in (select private.accessible_org_ids()));
alter policy klaviyo_tracking_profiles_select_authorized on public.klaviyo_tracking_profiles
  using (organization_id in (select private.accessible_org_ids()));
alter policy kpi_snapshots_select_authorized on public.kpi_snapshots
  using (organization_id in (select private.accessible_org_ids()));
alter policy marketing_campaign_products_select_authorized on public.marketing_campaign_products
  using (organization_id in (select private.accessible_org_ids()));
alter policy marketing_campaigns_select_authorized on public.marketing_campaigns
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_account_activities_select_authorized on public.meta_account_activities
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_ad_accounts_select_authorized on public.meta_ad_accounts
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_ad_creative_assignments_select_authorized on public.meta_ad_creative_assignments
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_ad_issues_select_authorized on public.meta_ad_issues
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_ad_sets_select_authorized on public.meta_ad_sets
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_ads_select_authorized on public.meta_ads
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_business_accounts_select_authorized on public.meta_business_accounts
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_calculated_metrics_daily_select_authorized on public.meta_calculated_metrics_daily
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_campaigns_select_authorized on public.meta_campaigns
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_creative_assets_select_authorized on public.meta_creative_assets
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_creatives_select_authorized on public.meta_creatives
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_custom_audiences_select_authorized on public.meta_custom_audiences
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_insight_action_metrics_select_authorized on public.meta_insight_action_metrics
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_insight_report_runs_select_authorized on public.meta_insight_report_runs
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_insight_rows_daily_select_authorized on public.meta_insight_rows_daily
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_pages_select_authorized on public.meta_pages
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_pixel_daily_stats_select_authorized on public.meta_pixel_daily_stats
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_pixels_select_authorized on public.meta_pixels
  using (organization_id in (select private.accessible_org_ids()));
alter policy meta_recommendations_select_authorized on public.meta_recommendations
  using (organization_id in (select private.accessible_org_ids()));
alter policy organization_alert_rules_select_authorized on public.organization_alert_rules
  using (organization_id in (select private.accessible_org_ids()));
alter policy organization_financial_settings_select_authorized on public.organization_financial_settings
  using (organization_id in (select private.accessible_org_ids()));
alter policy organization_members_select_authorized_org on public.organization_members
  using (organization_id in (select private.accessible_org_ids()));
alter policy organization_metric_targets_select_authorized on public.organization_metric_targets
  using (organization_id in (select private.accessible_org_ids()));
alter policy product_costs_select_authorized on public.product_costs
  using (organization_id in (select private.accessible_org_ids()));
alter policy service_subscriptions_select_authorized on public.service_subscriptions
  using (organization_id in (select private.accessible_org_ids()));
alter policy shipping_cost_rules_select_authorized on public.shipping_cost_rules
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_abandoned_checkout_items_select_authorized on public.shopify_abandoned_checkout_items
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_abandoned_checkouts_select_authorized on public.shopify_abandoned_checkouts
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_collections_select_authorized on public.shopify_collections
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_customers_select_authorized on public.shopify_customers
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_discounts_select_authorized on public.shopify_discounts
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_fulfillments_select_authorized on public.shopify_fulfillments
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_inventory_current_state_select_authorized on public.shopify_inventory_current_state
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_inventory_items_select_authorized on public.shopify_inventory_items
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_inventory_level_snapshots_select_authorized on public.shopify_inventory_level_snapshots
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_locations_select_authorized on public.shopify_locations
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_marketing_events_select_authorized on public.shopify_marketing_events
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_order_discount_applications_select_authorized on public.shopify_order_discount_applications
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_order_facts_select_authorized on public.shopify_order_facts
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_order_items_select_authorized on public.shopify_order_items
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_order_transactions_select_authorized on public.shopify_order_transactions
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_product_collections_select_authorized on public.shopify_product_collections
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_products_select_authorized on public.shopify_products
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_refund_items_select_authorized on public.shopify_refund_items
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_refunds_select_authorized on public.shopify_refunds
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_return_line_items_select_authorized on public.shopify_return_line_items
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_returns_select_authorized on public.shopify_returns
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_sessions_daily_select_authorized on public.shopify_sessions_daily
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_stores_select_authorized on public.shopify_stores
  using (organization_id in (select private.accessible_org_ids()));
alter policy shopify_variants_select_authorized on public.shopify_variants
  using (organization_id in (select private.accessible_org_ids()));

-- Las 18 compuestas. Ademas de `can_access_org` se saca del bucle
-- `is_platform_admin()` (sin argumentos -> InitPlan) y
-- `is_assigned_consultant(organization_id)`. Las llamadas que quedan dentro de
-- un EXISTS correlacionado (`is_assigned_consultant(c.organization_id)`) se
-- dejan como estaban: ahi el subplan ya recorre una sola fila.
-- Los nombres de tabla dentro de los EXISTS van cualificados con `public.`
-- porque la migracion no puede depender del search_path con el que se aplique.

alter policy organizations_select_authorized on public.organizations
  using (id in (select private.accessible_org_ids()));

alter policy agent_outputs_select_authorized on public.agent_outputs
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      status::text = any ((array['approved'::character varying, 'published'::character varying])::text[])
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy ai_conversations_select_own on public.ai_conversations
  using (
    user_id = (select auth.uid())
    and organization_id in (select private.accessible_org_ids())
  );

alter policy call_ai_summaries_select_authorized on public.call_ai_summaries
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      status = 'published'::call_summary_status
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy call_transcripts_select_authorized on public.call_transcripts
  using (
    organization_id in (select private.accessible_org_ids())
    and exists (
      select 1
      from public.consulting_calls c
      where c.id = call_transcripts.call_id
        and (
          c.is_visible_to_client
          or (select private.is_platform_admin())
          or private.is_assigned_consultant(c.organization_id)
        )
    )
  );

-- Ojo: el tercer AND de esta policy arrastra de antes `c.organization_id =
-- c.organization_id`, que es siempre cierto y casi seguro queria comparar con
-- `campaign_calendar_items.organization_id`. Se deja igual: esta migracion es
-- de rendimiento y no debe cambiar quien ve que. Corregirlo aparte.
alter policy campaign_calendar_items_select_authorized on public.campaign_calendar_items
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      is_visible_to_client
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
    and exists (
      select 1
      from public.campaign_calendars c
      where c.id = campaign_calendar_items.calendar_id
        and c.organization_id = c.organization_id
        and (
          c.is_visible_to_client
          or (select private.is_platform_admin())
          or private.is_assigned_consultant(c.organization_id)
        )
    )
  );

alter policy campaign_calendars_select_authorized on public.campaign_calendars
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      is_visible_to_client
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy consultant_assignments_select_authorized on public.consultant_assignments
  using (
    (select private.is_platform_admin())
    or consultant_user_id = (select auth.uid())
    or organization_id in (select private.accessible_org_ids())
  );

alter policy consulting_calls_select_authorized on public.consulting_calls
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      is_visible_to_client
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy knowledge_chunks_select_visible on public.knowledge_chunks
  using (
    organization_id is null
    or organization_id in (select private.accessible_org_ids())
  );

alter policy knowledge_documents_select_visible on public.knowledge_documents
  using (
    visibility::text = 'global'::text
    or (
      organization_id is not null
      and organization_id in (select private.accessible_org_ids())
    )
  );

alter policy milestone_task_links_select_authorized on public.milestone_task_links
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
      or exists (
        select 1
        from public.strategic_plan_milestones m
        join public.strategic_plan_phases ph on ph.id = m.phase_id
        join public.strategic_plans p on p.id = ph.plan_id
        where m.id = milestone_task_links.milestone_id
          and p.status <> 'draft'::plan_status
      )
    )
  );

alter policy strategic_plan_milestones_select_authorized on public.strategic_plan_milestones
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
      or exists (
        select 1
        from public.strategic_plan_phases ph
        join public.strategic_plans p on p.id = ph.plan_id
        where ph.id = strategic_plan_milestones.phase_id
          and p.status <> 'draft'::plan_status
      )
    )
  );

alter policy strategic_plan_phases_select_authorized on public.strategic_plan_phases
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
      or exists (
        select 1
        from public.strategic_plans p
        where p.id = strategic_plan_phases.plan_id
          and p.status <> 'draft'::plan_status
      )
    )
  );

alter policy strategic_plans_select_authorized on public.strategic_plans
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      status <> 'draft'::plan_status
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy task_comments_select_authorized on public.task_comments
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      not is_internal
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

alter policy task_status_history_select_authorized on public.task_status_history
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
      or exists (
        select 1
        from public.tasks t
        where t.id = task_status_history.task_id
          and t.is_visible_to_client
      )
    )
  );

alter policy tasks_select_authorized on public.tasks
  using (
    organization_id in (select private.accessible_org_ids())
    and (
      is_visible_to_client
      or (select private.is_platform_admin())
      or organization_id in (select private.assigned_consultant_org_ids())
    )
  );

-- Red de seguridad: si quedara alguna policy de SELECT con la forma antigua
-- (una anadida entre medias, o deriva de esquema), la migracion falla en vez
-- de dejar el arreglo a medias.
do $pendientes$
declare
  restantes text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename)
  into restantes
  from pg_policies
  where schemaname = 'public'
    and cmd = 'SELECT'
    and qual like '%can_access_org(%';

  if restantes is not null then
    raise exception 'quedan policies de SELECT con can_access_org(columna): %', restantes;
  end if;
end;
$pendientes$;
