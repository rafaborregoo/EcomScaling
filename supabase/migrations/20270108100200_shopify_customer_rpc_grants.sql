-- /shopify (Resumen, bloque Clientes) mostraba «No se pudo cargar la recurrencia».
-- `getShopifyInsights` llama a estas cinco RPC con el cliente del usuario (rol authenticated) y
-- Postgres respondia «permission denied for function shopify_customer_recurrence» (y las otras
-- cuatro): en TEST y PROD solo conservaban execute postgres y service_role, aunque las migraciones
-- que las crearon (20260907160000, 20261108140000) concedian execute a authenticated.
--
-- Son `stable`, sin `security definer`: las filas las sigue filtrando la RLS de shopify_order_facts,
-- asi que devolver el permiso no abre datos de otras organizaciones.
--
-- Idempotente: grant se puede repetir. No se tocan las RPC de A22 (delivery_exceptions,
-- return_delay_comparison), cuyo revoke a authenticated es deliberado.

grant execute on function public.shopify_customer_recurrence(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.shopify_customer_value(uuid, uuid) to authenticated;
grant execute on function public.shopify_cohorts(uuid, uuid, integer) to authenticated;
grant execute on function public.shopify_customer_churn(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.shopify_customer_lifetime(uuid, uuid, timestamptz) to authenticated;
