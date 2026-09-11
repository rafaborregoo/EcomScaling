-- Indice duplicado: 20260911120000 creo klaviyo_report_values_unique_metric sin
-- ver que 20260802151000 ya habia creado klaviyo_report_values_code_contract_uidx
-- con exactamente las mismas columnas. Dos indices unicos identicos = el doble
-- de escritura por fila y una tabla que se lee peor. Se queda el del contrato,
-- que es el que nombran las migraciones anteriores.
drop index if exists public.klaviyo_report_values_unique_metric;
