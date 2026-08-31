-- The activity digest is a SECURITY INVOKER function. Keep its lookup path
-- explicit so caller-controlled search_path values cannot shadow objects.
alter function public.organization_activity_digest(uuid)
  set search_path = pg_catalog, public;
