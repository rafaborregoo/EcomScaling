-- Saca los datos de demo de Klaviyo de cualquier organizacion que ademas tenga
-- una conexion real.
--
-- Que paso: `scripts/seed-klaviyo-history.ts` reutilizaba la conexion Klaviyo
-- que ya existiera en la org "cliente-demo-store" -- que es justo la que tiene
-- la clave real. Resultado en produccion: /klaviyo mostraba arriba el
-- inventario de verdad (1 flujo, 5 emails, los de NORA) y abajo, en
-- "Rendimiento", 56 campanas sinteticas con 592.060 entregados y 466.109 EUR
-- de ingresos atribuidos que no existen. Nada en la pantalla distinguia unas
-- de otras, porque van a las mismas tablas.
--
-- Las filas del seed son inequivocas y no se solapan con ninguna real:
--   klaviyo_report_runs.idempotency_key  like 'demo:campaign-values:%'
--   klaviyo_campaigns.external_campaign_id like 'demo-camp-%'
--   klaviyo_accounts.conversion_metric_id = 'demo-metric-placed-order'
-- klaviyo_report_values cuelga de report_runs con `on delete cascade`, asi que
-- se va con ellos.
--
-- El seed ya no puede repetirlo: ahora exige que la org NO tenga conexion
-- Klaviyo real y aborta con KLAVIYO_SEED_REAL_CONNECTION_REFUSED.
--
-- Idempotente por naturaleza: un `delete` que no encuentra nada no falla.

delete from public.klaviyo_report_runs
where idempotency_key like 'demo:campaign-values:%';

delete from public.klaviyo_campaigns
where external_campaign_id like 'demo-camp-%';

-- El seed tambien piso la cuenta real: le puso nombre de demo y una metrica de
-- conversion inventada. Con ese id los informes de Klaviyo no pueden pedir
-- valores. Se deja a null para que el consultor vuelva a elegirla en /klaviyo,
-- que es de donde sale (no la resuelve el sync sola).
update public.klaviyo_accounts
set conversion_metric_id = null,
    conversion_metric_name = null,
    conversion_metric_source = null
where conversion_metric_id = 'demo-metric-placed-order';

update public.klaviyo_accounts
set name = null
where name like '%— Klaviyo (demo)';

update public.integration_connections
set provider_account_name = null
where provider = 'klaviyo'
  and provider_account_name = 'Klaviyo (datos de demo)';

-- La conexion de demo pura (la que el seed crea cuando la org no tiene ninguna)
-- se queda: ahi los datos sinteticos son legitimos y no enganan a nadie.
