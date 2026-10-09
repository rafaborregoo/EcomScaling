-- El plan puede incluir un numero definido de personas con acceso a la
-- organizacion. NULL conserva compatibilidad y significa que no hay tope.
ALTER TABLE public.service_subscriptions
  ADD COLUMN IF NOT EXISTS member_limit integer;

ALTER TABLE public.service_subscriptions
  DROP CONSTRAINT IF EXISTS service_subscriptions_member_limit_positive;

ALTER TABLE public.service_subscriptions
  ADD CONSTRAINT service_subscriptions_member_limit_positive
  CHECK (member_limit IS NULL OR member_limit > 0);

COMMENT ON COLUMN public.service_subscriptions.member_limit IS
  'Numero de miembros activos e invitaciones pendientes incluidos en el plan. NULL significa sin limite.';
