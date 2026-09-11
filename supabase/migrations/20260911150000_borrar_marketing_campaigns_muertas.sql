-- marketing_campaigns y marketing_campaign_products: el primer diseño de
-- "planificar campañas", nacido en la migracion de fundacion de Klaviyo y
-- abandonado. La planificacion real vive en campaign_calendar_items y las
-- piezas en marketing_content_drafts, que son las que van a Klaviyo.
--
-- Comprobado antes de borrar (2026-09-11), en produccion:
--   referencias en el codigo (apps/api, apps/web, packages): ninguna
--   vistas o funciones que dependan de ellas:                 ninguna
--   otras tablas con clave ajena hacia ellas:                 ninguna
--   filas:                                                    0 en ambos entornos
--
-- Ademas tenian dos formas distintas segun el entorno, asi que mantenerlas
-- obligaba a converger un esquema que nadie lee. Se borran.
drop table if exists public.marketing_campaign_products;
drop table if exists public.marketing_campaigns;
