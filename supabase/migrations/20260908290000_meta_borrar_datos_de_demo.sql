-- Saca los datos de demo de Meta Ads, por el mismo motivo que los de Klaviyo:
-- estan en `cliente-demo-store`, que pese al nombre es la organizacion real de
-- Rafa, y manana se conecta ahi una cuenta de Meta de verdad.
--
-- A diferencia del seed de Klaviyo, este NO secuestraba la conexion real: crea
-- la suya con `provider_account_id = 'demo-act-0'` y su cuenta publicitaria
-- `act_demo_0`. El problema es otro: al conectar la cuenta buena la org tendria
-- dos conexiones Meta a la vez, y la de demo ya viene con `is_selected = true`
-- y 550 dias x 3 anuncios de insights sinteticos.
--
-- Basta borrar la conexion: meta_ad_accounts cuelga de ella, y de la cuenta
-- cuelgan meta_insight_rows_daily y meta_insight_action_metrics, todo con
-- `on delete cascade` (20260717170000_db_06_meta_ads.sql).
--
-- Idempotente: un `delete` que no encuentra nada no falla.

delete from public.integration_connections
where provider = 'meta_ads'
  and provider_account_id = 'demo-act-0';
