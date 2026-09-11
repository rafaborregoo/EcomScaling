-- Datos protegidos de Shopify: la ubicacion aproximada del cliente
-- (ciudad/provincia/pais) no la lee nadie en el producto, asi que deja de
-- pedirse y deja de guardarse. Cuanto menos dato protegido se toca, menos hay
-- que justificar en la solicitud de acceso y menos hay que proteger despues.
--
-- Idempotente (ver CLAUDE.md): el indice se borra antes que las columnas.
drop index if exists public.shopify_customers_country_idx;

alter table public.shopify_customers
  drop column if exists default_country_code,
  drop column if exists default_province_code,
  drop column if exists default_city;
