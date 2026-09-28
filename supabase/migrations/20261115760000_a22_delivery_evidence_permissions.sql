-- Supabase may grant table privileges through defaults. Keep authenticated
-- users read-only at the SQL privilege layer as well as the RLS layer.
revoke all on table
  public.shopify_fulfillment_events,
  public.shopify_fulfillment_event_sync_state,
  public.shopify_delivery_exceptions
from public, anon, authenticated;

grant select on table
  public.shopify_fulfillment_events,
  public.shopify_fulfillment_event_sync_state,
  public.shopify_delivery_exceptions
to authenticated;

grant all on table
  public.shopify_fulfillment_events,
  public.shopify_fulfillment_event_sync_state,
  public.shopify_delivery_exceptions
to service_role;
