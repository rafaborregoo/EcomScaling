import pg from "pg";

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const result = await client.query(`
    select
      (select c.relrowsecurity from pg_class c where c.oid='public.shopify_delivery_exceptions'::regclass) as rls_enabled,
      has_table_privilege('authenticated','public.shopify_delivery_exceptions','SELECT') as member_read_grant,
      has_table_privilege('authenticated','public.shopify_delivery_exceptions','INSERT') as member_insert_grant,
      has_function_privilege('service_role','public.refresh_shopify_delivery_exception(uuid,uuid,uuid)','EXECUTE') as service_refresh_execute,
      has_function_privilege('authenticated','public.refresh_shopify_delivery_exception(uuid,uuid,uuid)','EXECUTE') as member_refresh_execute,
      has_function_privilege('service_role','public.shopify_open_delivery_exceptions(uuid,uuid,integer)','EXECUTE') as service_list_execute,
      has_function_privilege('authenticated','public.shopify_open_delivery_exceptions(uuid,uuid,integer)','EXECUTE') as member_list_execute,
      exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='refresh_shopify_delivery_exception' and not p.prosecdef) as refresh_invoker,
      exists(select 1 from public.prompt_versions where code='a22_postventa_shopify_system' and version='v5') as prompt_v5,
      exists(select 1 from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id where d.code='a22_postventa_shopify' and v.version='v5' and v.is_active and v.allowed_tools ? 'shopify_open_delivery_exceptions') as v5_active_with_tool,
      (select count(*)::int from public.shopify_open_delivery_exceptions('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',50)) as scoped_empty_result
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end();
}
