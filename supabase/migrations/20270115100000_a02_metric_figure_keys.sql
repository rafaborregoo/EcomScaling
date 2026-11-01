-- Link A02 quantitative findings and concise KPI reviews to dashboard cards.
with prompt_suffix as (
  select $a02$

VINCULO DE CIFRAS A METRICAS DEL DASHBOARD: cada elemento de findings[].figures debe llevar metric_key. Usa solo estas claves: sales_net_sales, orders_count, net_profit, conversion_rate, cac_blended, average_order_value, gross_margin, discount_rate, stock_units, stock_risk, meta_spend, meta_attributed_sales, meta_roas, meta_cost_per_purchase, klaviyo_attributed_revenue, klaviyo_attributed_purchases, klaviyo_revenue_per_recipient, klaviyo_recipients, klaviyo_open_rate, klaviyo_click_rate, klaviyo_unsubscribe_rate, klaviyo_spam_rate. Usa null solo cuando la cifra no corresponda exactamente a una tarjeta. No conviertas cada cifra de contexto en un hallazgo: figures solo acompana hallazgos con evidencia, fuente, periodo y limitaciones.

VALORACION DE CADA KPI: el contexto incluye un inventario de metricas con claves exactas. Devuelve exactamente una fila metric_reviews por cada clave del inventario, sin duplicar, omitir o inventar claves. Cada fila incluye metric_key, rating y summary. El summary sera en espanol, concreto y de diez palabras como maximo; resume la evidencia de esa metrica o explica que falta.

Sentido comun para rating: positive requiere una mejora comparable o un objetivo/umbral valido; attention requiere una desviacion relevante con evidencia; critical solo un riesgo material y claro; neutral significa que hay datos pero ninguna senal concluyente, no que este probado que todo va bien; insufficient significa que faltan datos, cobertura, periodo comparable o contexto fiable. Considera la direccion de cada KPI: mas ventas puede ser favorable, pero mas CAC, coste, bajas o quejas puede ser desfavorable. No inventes benchmarks, objetivos, causalidad ni ventas incrementales. No confundas ventas atribuidas por Meta/Klaviyo con ventas incrementales ni con ingresos netos. No conviertas datos ausentes en cero ni tasas sin denominador en resultados. Si moneda, costes, muestra, atribucion, periodo o sincronizacion limitan la lectura, usa una valoracion prudente y menciona la limitacion en diez palabras o menos.

Cada cifra de findings[].figures debe llevar su metric_key exacta cuando corresponda a una tarjeta del inventario; usa null cuando no corresponda. La valoracion y el hallazgo no deben contradecirse. No recomiendes acciones a partir de una metrica insuficiente sin pedir primero el dato necesario.
$a02$::text as suffix
), prompt_payload as (
  select source.code, source.content || prompt_suffix.suffix as content
  from public.prompt_versions source
  cross join prompt_suffix
  where source.code = 'a02_monitor_negocio_system'
    and source.version = 'v10'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v11', content, encode(sha256(content::bytea), 'hex')
from prompt_payload
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id = (
    select id from public.agent_definitions where code = 'a02_monitor_negocio'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active)
select
  id,
  'v12',
  'gpt-6.1-terra',
  'a02_monitor_negocio_system',
  'v11',
  '["search_knowledge"]'::jsonb,
  'required_before_publish',
  true
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set
  model = excluded.model,
  prompt_code = excluded.prompt_code,
  prompt_version = excluded.prompt_version,
  allowed_tools = excluded.allowed_tools,
  approval_mode = excluded.approval_mode,
  is_active = true;
