-- OPS: tenant-scoped data export. Credentials remain excluded by design:
-- private.integration_credentials is never read by this function.

create or replace function private.export_organization_data(p_organization_id uuid)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  current_table_name text;
  table_rows jsonb;
  export_payload jsonb := jsonb_build_object(
    'schema_version', 'v1',
    'organization_id', p_organization_id,
    'exported_at', clock_timestamp(),
    'tables', '{}'::jsonb
  );
  export_tables constant text[] := array[
    'organization_members', 'organization_subscriptions',
    'organization_metric_targets', 'organization_financial_settings',
    'organization_fixed_expenses', 'organization_shipping_rules',
    'integration_connections', 'integration_sync_runs',
    'shopify_stores', 'shopify_locations', 'shopify_products',
    'shopify_variants', 'shopify_inventory_items',
    'shopify_inventory_level_snapshots', 'shopify_order_facts',
    'shopify_order_items', 'shopify_refunds', 'shopify_refund_items',
    'shopify_customers', 'product_costs',
    'meta_business_accounts', 'meta_pages', 'meta_ad_accounts',
    'meta_campaigns', 'meta_ad_sets', 'meta_ads', 'meta_creatives',
    'meta_insight_rows_daily', 'meta_insight_action_metrics',
    'meta_calculated_metrics_daily', 'klaviyo_accounts', 'klaviyo_lists',
    'klaviyo_segments', 'klaviyo_flows', 'klaviyo_flow_messages',
    'klaviyo_campaigns', 'klaviyo_campaign_messages', 'klaviyo_forms',
    'klaviyo_metrics', 'klaviyo_report_runs', 'klaviyo_report_values',
    'klaviyo_daily_account_metrics', 'agent_runs', 'agent_run_steps',
    'agent_tool_calls', 'agent_context_snapshots', 'agent_outputs',
    'agent_approvals', 'agent_query_runs', 'consulting_calls',
    'call_transcripts', 'call_ai_summaries', 'call_internal_notes',
    'call_task_links', 'tasks', 'task_comments', 'alerts',
    'knowledge_documents', 'audit_logs'
  ];
begin
  if p_organization_id is null then
    raise exception 'organization_id_required';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization_not_found';
  end if;

  foreach current_table_name in array export_tables loop
    if exists (
      select 1
      from information_schema.columns as c
      where table_schema = 'public'
        and c.table_name = current_table_name
        and column_name = 'organization_id'
    ) then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(row)), ''[]''::jsonb) from public.%I row where row.organization_id = $1',
        current_table_name
      ) into table_rows using p_organization_id;
      export_payload := jsonb_set(
        export_payload,
        array['tables', current_table_name],
        coalesce(table_rows, '[]'::jsonb),
        true
      );
    end if;
  end loop;

  return export_payload;
end;
$$;

revoke all on function private.export_organization_data(uuid) from public;
grant execute on function private.export_organization_data(uuid) to service_role;

comment on function private.export_organization_data(uuid) is
  'Exports organization-scoped public data as JSONB; intentionally excludes private credentials and secrets.';
