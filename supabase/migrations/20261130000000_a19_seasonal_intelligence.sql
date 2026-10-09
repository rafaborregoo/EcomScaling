-- A19 adds sourced seasonal research and a compact, tenant-scoped monthly
-- sales series so market seasonality is not confused with this store's sales.

create or replace function public.shopify_sales_monthly(
  target_organization_id uuid,
  months_back integer,
  target_store_id uuid
)
returns table (
  bucket_month date,
  orders_count bigint,
  gross_sales numeric,
  net_sales numeric,
  discounts numeric,
  refunds numeric,
  units_sold bigint,
  aov numeric
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      m::date as bucket_month,
      m as period_start,
      m + interval '1 month' as period_end
    from generate_series(
      date_trunc('month', now()) - make_interval(months => greatest(least(months_back, 60), 1) - 1),
      date_trunc('month', now()),
      interval '1 month'
    ) as m
  ), monthly as (
    select
      date_trunc('month', coalesce(f.processed_at, f.external_created_at))::date as bucket_month,
      count(*) as orders_count,
      coalesce(sum(f.gross_sales), 0) as gross_sales,
      coalesce(sum(f.net_sales), 0) as net_sales,
      coalesce(sum(f.discounts), 0) as discounts,
      coalesce(sum(f.refunds), 0) as refunds,
      coalesce(sum(f.total_items), 0) as units_sold,
      case when count(*) > 0 then round(coalesce(sum(f.net_sales), 0) / count(*), 2) else 0 end as aov
    from public.shopify_order_facts f
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and f.is_test_order = false
      and f.cancelled_at is null
      and coalesce(f.processed_at, f.external_created_at) >= (
        date_trunc('month', now()) - make_interval(months => greatest(least(months_back, 60), 1) - 1)
      )
      and coalesce(f.processed_at, f.external_created_at) < date_trunc('month', now()) + interval '1 month'
    group by 1
  )
  select
    b.bucket_month,
    coalesce(m.orders_count, 0),
    coalesce(m.gross_sales, 0),
    coalesce(m.net_sales, 0),
    coalesce(m.discounts, 0),
    coalesce(m.refunds, 0),
    coalesce(m.units_sold, 0),
    coalesce(m.aov, 0)
  from bounds b
  left join monthly m using (bucket_month)
  order by b.bucket_month;
$$;

revoke all on function public.shopify_sales_monthly(uuid, integer, uuid) from public, anon;
grant execute on function public.shopify_sales_monthly(uuid, integer, uuid) to authenticated, service_role;
comment on function public.shopify_sales_monthly(uuid, integer, uuid) is
  'Monthly Shopify sales series for seasonality analysis. Bounded to 60 months; '
  'null target_store_id retains organization scope, matching shopify_sales_summary.';

do $a19_seasonal_prompt_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v8'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V8_REQUIRED_FOR_SEASONAL_INTELLIGENCE';
  end if;
end
$a19_seasonal_prompt_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nINTELIGENCIA ESTACIONAL CON EVIDENCIA Y ALCANCE\nAnaliza en bloques separados (1) el histórico mensual real de esta tienda, (2) las fechas y conocimiento declarados por el equipo, y (3) las oportunidades de mercado investigadas en fuentes públicas. No mezcles las tres evidencias ni atribuyas una tendencia del mercado a esta marca. La serie mensual puede contener meses sin pedidos y periodos incompletos: comprueba cobertura y número de años antes de afirmar recurrencia; compara el mismo mes entre años y considera pedidos, ventas netas y AOV sin derivar beneficio si faltan costes/divisas. Con menos de dos temporadas comparables, clasifica la señal propia como insuficiente o preliminar.\nPara eventos/temporadas dentro de TODO el horizonte, busca fuentes web actuales y relevantes para el mercado y categoría declarados; usa fechas de calendario de fuentes oficiales cuando sea una festividad móvil y fuentes sectoriales/publicaciones reconocidas para patrones de categoría. No uses resultados de búsqueda como prueba de demanda específica de esta tienda. Si no hay acceso a búsqueda web o faltan mercado/categoría, indícalo y pide el dato; nunca inventes URLs, fechas, rankings, porcentajes de crecimiento o cifras de demanda.\nIncluye en sources cada página realmente consultada: kind=tool, reference con título/editor y URL completa, period con fecha de consulta y ventana/fecha que respalda. En diagnosis, fases o hitos deja claro qué señal es propia, cuál externa y cuál es una hipótesis. Para cada oportunidad relevante estima el tiempo de preparación hacia atrás (investigación, oferta, inventario, creatividades, email/lista de espera, QA y medición según aplique), con hitos fechados por dependencia; no des por aprobada una campaña, descuento, compra de stock o envío. No fuerces una oportunidad estacional si no encaja con el cliente, capacidad, producto o caja.\nGuarda las fuentes públicas citadas como conocimiento de temporada de esta tienda mediante el contexto persistente del sistema; registra fecha de consulta y caducidad de 12 meses. Es conocimiento específico de la tienda y no debe promoverse al conocimiento global de E-NORA ni incluir datos de ventas identificables en conocimiento compartido. Trátalo como investigación revisable, no como una verdad permanente.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v8'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v9', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v9', v.model, v.prompt_code, 'v9', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v8'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
