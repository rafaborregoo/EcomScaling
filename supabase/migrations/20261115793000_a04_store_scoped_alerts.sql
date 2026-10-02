-- A04 must be able to distinguish a store signal from an organization signal.
-- Historical aggregate alerts are deliberately left NULL: their source cannot
-- be reconstructed safely after the fact.
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS store_id uuid;

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_store_id_fkey
  FOREIGN KEY (store_id)
  REFERENCES public.shopify_stores (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS alerts_org_store_status_idx
  ON public.alerts (organization_id, store_id, status);

COMMENT ON COLUMN public.alerts.store_id IS
  'Verified Shopify store scope; NULL means organization-level or legacy unscoped alert.';

CREATE OR REPLACE FUNCTION public.enforce_alert_store_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  store_organization_id uuid;
BEGIN
  IF NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id
    INTO store_organization_id
    FROM public.shopify_stores
   WHERE id = NEW.store_id;

  IF store_organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'alert store must belong to the same organization'
      USING ERRCODE = '23514', CONSTRAINT = 'alerts_store_same_organization';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_alert_store_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_alert_store_organization() FROM anon, authenticated;

DROP TRIGGER IF EXISTS alerts_store_same_organization ON public.alerts;
CREATE TRIGGER alerts_store_same_organization
  BEFORE INSERT OR UPDATE OF store_id, organization_id ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_alert_store_organization();
