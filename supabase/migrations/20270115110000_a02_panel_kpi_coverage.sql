-- Created with Supabase CLI; ordered after the existing A02 v11 prompt migration.
-- Rentabilidad uses ex-tax revenue/AOV and NET margin, unlike the sales cards.
do $$
begin
  if not exists (select 1 from public.prompt_versions where code = 'a02_monitor_negocio_system' and version = 'v11') then
    raise exception 'A02 prompt v11 is required before panel KPI coverage';
  end if;
end;
$$;

with payload as (
  select code, content || $a02$

AMPLIACION DEL CATALOGO DE KPI DE RENTABILIDAD: se anaden net_revenue_ex_tax (ingresos netos sin IVA, financial.net_revenue_ex_tax), net_margin (margen NETO, financial.net_margin_pct), average_order_value_ex_tax (ticket sin IVA, financial.aov_ex_tax) y new_customers (financial.new_customers). Estas claves amplian la lista anterior. No confundas ingresos sin IVA con sales_net_sales, margen neto con gross_margin ni ticket sin IVA con average_order_value. El inventario recibido en cada ejecucion es la lista definitiva de metric_reviews de esa vista: exactamente una fila por clave del inventario. Sus etiquetas identifican el dato que realmente muestra cada tarjeta. Para findings[].figures tambien se permiten estas cuatro claves nuevas. Conserva las reglas de evidencia, abstencion y resumen de diez palabras como maximo.
$a02$ as content
  from public.prompt_versions
  where code = 'a02_monitor_negocio_system' and version = 'v11'
)
insert into public.prompt_versions(code, version, content, checksum)
select code, 'v12', content, encode(sha256(content::bytea), 'hex') from payload
on conflict (code, version) do nothing;

update public.agent_versions set is_active = false
where is_active and definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio');

insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active)
select id,'v13','gpt-6.1-terra','a02_monitor_negocio_system','v12','["search_knowledge"]'::jsonb,'required_before_publish',true
from public.agent_definitions where code = 'a02_monitor_negocio'
on conflict (definition_id,version) do update set
  model=excluded.model,prompt_code=excluded.prompt_code,prompt_version=excluded.prompt_version,
  allowed_tools=excluded.allowed_tools,approval_mode=excluded.approval_mode,is_active=true;
