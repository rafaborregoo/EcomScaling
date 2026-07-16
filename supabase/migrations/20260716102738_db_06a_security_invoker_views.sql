-- DB-06a: force RLS to apply through public views.
--
-- In Postgres/Supabase, views can bypass underlying table RLS unless they are
-- created with security_invoker=true. This view is granted to authenticated
-- users, so it must execute with the caller's permissions.

alter view public.shopify_inventory_current_levels
set (security_invoker = true);
