-- Cada uno puede ver su propia suscripcion.
--
-- La policy de select era `organization_id in (accessible_org_ids())`, escrita
-- cuando toda suscripcion colgaba de una organizacion. Desde
-- 20261006090000 la de un consultor va a su nombre y tiene organization_id
-- nulo -- y `null in (...)` no es cierto nunca, asi que esas filas no las veia
-- NADIE salvo platform admin. Verificado contra produccion: un consultor
-- consultando su propia fila recibia 0.
--
-- Importa mas de lo que parece: el rol de consultor se deriva justo de esa
-- fila, asi que con la policy vieja la API (que consulta con el token del
-- usuario, no con la service key) no podia derivar el rol de nadie.
--
-- Se separa en dos policies en vez de ampliar la condicion con un `or`: la de
-- organizacion y la de persona responden a preguntas distintas, y una sola
-- expresion con `or` es donde se cuela el permiso de mas cuando alguien la
-- toque dentro de un año.

drop policy if exists service_subscriptions_select_authorized on public.service_subscriptions;
create policy service_subscriptions_select_authorized
  on public.service_subscriptions
  for select
  to authenticated
  using (
    organization_id is not null
    and organization_id in (select private.accessible_org_ids())
  );

drop policy if exists service_subscriptions_select_propia on public.service_subscriptions;
create policy service_subscriptions_select_propia
  on public.service_subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));
