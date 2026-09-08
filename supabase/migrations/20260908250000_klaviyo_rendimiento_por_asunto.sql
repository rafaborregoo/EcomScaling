-- Rendimiento por ASUNTO: la pregunta que justifica leer el contenido.
--
-- No es una vista mas del rendimiento: es el rendimiento cruzado con rasgos del
-- propio texto (longitud, si lleva emoji, si es pregunta, si lleva cifra, si
-- personaliza con una variable de Klaviyo). Con eso se puede pasar de "este
-- email abre poco" a "los asuntos largos de esta tienda abren la mitad".
--
-- Fuente: klaviyo_email_report, que ya devuelve el asunto real y las metricas
-- por mes y entidad. Aqui NO se vuelve a agregar nada: se anaden columnas
-- derivadas del texto y las tasas, que es lo que la funcion de arriba no hace.
--
-- Importante: las tasas se calculan sobre ENTREGADOS, no sobre destinatarios.
-- Un email que rebota no tuvo oportunidad de abrirse, y meterlo en el
-- denominador castiga a la tienda por un problema de entregabilidad como si
-- fuera un problema de copy. Son cosas distintas y se arreglan distinto.
--
-- ADR-0006 pto 6: `stable`, SECURITY INVOKER, llamada via .rpc().

drop function if exists public.klaviyo_subject_performance(uuid, date, date, uuid);
create or replace function public.klaviyo_subject_performance(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table (
  bucket_month date,
  entity_type text,
  entity_name text,
  subject text,
  subject_chars integer,
  subject_words integer,
  has_emoji boolean,
  is_question boolean,
  has_number boolean,
  has_personalization boolean,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  open_rate numeric,
  click_rate numeric,
  click_to_open_rate numeric,
  unsubscribe_rate numeric,
  revenue numeric,
  revenue_per_delivered numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    r.bucket_month,
    r.entity_type,
    r.entity_name,
    r.subject,
    length(r.subject) as subject_chars,
    -- Palabras: separadores reales, no un split por espacio que cuenta vacios.
    coalesce(
      array_length(
        array_remove(regexp_split_to_array(trim(r.subject), '\s+'), ''), 1
      ),
      0
    ) as subject_words,
    -- Rangos de emoji que aparecen de verdad en un asunto comercial. No
    -- pretende cubrir Unicode entero: pretende no dar falsos positivos con
    -- acentos ni con simbolos de moneda.
    r.subject ~ '[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]'
      as has_emoji,
    r.subject like '%?%' as is_question,
    r.subject ~ '[0-9]' as has_number,
    -- Klaviyo personaliza con {{ ... }} o {% ... %}.
    (r.subject like '%{{%' or r.subject like '%{\%%') as has_personalization,
    r.delivered,
    r.opens_unique,
    r.clicks_unique,
    -- Sobre entregados, y null (no cero) cuando no hubo entregas: cero
    -- aperturas de cero envios no es un 0% de apertura, es que no hay dato.
    case when r.delivered > 0 then r.opens_unique / r.delivered end as open_rate,
    case when r.delivered > 0 then r.clicks_unique / r.delivered end as click_rate,
    case when r.opens_unique > 0 then r.clicks_unique / r.opens_unique end
      as click_to_open_rate,
    case when r.delivered > 0 then r.unsubscribes / r.delivered end
      as unsubscribe_rate,
    r.revenue,
    case when r.delivered > 0 then r.revenue / r.delivered end
      as revenue_per_delivered
  from public.klaviyo_email_report(
    target_organization_id, period_start, period_end, target_store_id
  ) r
  where r.subject is not null
  order by r.delivered desc nulls last, r.bucket_month desc;
$function$;

grant execute on function public.klaviyo_subject_performance(uuid, date, date, uuid) to authenticated;

comment on function public.klaviyo_subject_performance is
  'Rendimiento de cada envio junto a los rasgos de su asunto (longitud, emoji, pregunta, cifra, personalizacion) y las tasas calculadas sobre ENTREGADOS. Sirve para relacionar como se escribe un asunto con como funciona. Solo devuelve envios cuyo asunto conocemos.';
