-- `klaviyo_report_runs.idempotency_key` es varchar(255) en produccion y tiene
-- que ser `text`.
--
-- Historia de la deriva: la migracion 20260802150000 la declaro varchar(500) y
-- la 20260802150100 la redeclaro `text`, pero las dos usan
-- `add column if not exists`, que NO cambia el tipo de una columna que ya
-- existe. La columna venia del create table original como varchar(255) y ahi se
-- quedo, con el historial diciendo que se habia ampliado dos veces.
--
-- Consecuencia real, no teorica: `runKlaviyoReport` construye la clave como
--   <tipo>:<metrica>:<inicio>:<fin>:<20 estadisticas separadas por coma>
-- que pasa holgadamente de 255 caracteres. Cada intento moria en el insert con
-- "value too long for type character varying(255)" ANTES de crear la fila del
-- run, asi que no dejaba ni rastro del error en klaviyo_report_runs. Resultado:
-- desde agosto, el rendimiento de email en produccion solo contenia lo que
-- escribio el seed. Se vio al ejecutar la reconciliacion con una metrica de
-- conversion real.
--
-- `alter column ... type` es idempotente en la practica: reejecutarlo sobre una
-- columna que ya es `text` no hace nada y no falla. El indice unico parcial
-- (account_id, idempotency_key) se reconstruye solo.

alter table public.klaviyo_report_runs
  alter column idempotency_key type text;

comment on column public.klaviyo_report_runs.idempotency_key is
  'Clave de idempotencia del informe: tipo, metrica de conversion, periodo y lista de estadisticas. `text` a proposito -- con 20 estadisticas pasa de 255 caracteres.';
