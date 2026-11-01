-- A05 remains a read-only strategist. Preserve the configured model/prompt and
-- add investigation capabilities; no sending, scheduling or write tools.
update public.agent_versions av
set allowed_tools = (
  select jsonb_agg(tool_name order by tool_name)
  from (
    select jsonb_array_elements_text(coalesce(av.allowed_tools, '[]'::jsonb)) as tool_name
    union
    select unnest(array[
      'get_email_campaign_pipeline', 'get_shopify_product_catalog',
      'get_brand_profile', 'get_organization_profile', 'search_knowledge',
      'klaviyo_email_content', 'klaviyo_measurement_health',
      'klaviyo_performance_summary', 'klaviyo_entity_performance',
      'klaviyo_deliverability_health'
    ])
  ) granted
)
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a05_estrategia_campanas');
