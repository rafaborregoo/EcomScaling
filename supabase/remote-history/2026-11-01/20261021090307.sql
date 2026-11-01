-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Delivery analytics is read through the authenticated application gateway.
-- Keep direct execution limited to application roles; the function remains
-- SECURITY INVOKER and therefore continues to respect table RLS.
revoke all on function public.shopify_delivery_times(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.shopify_delivery_times(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;
