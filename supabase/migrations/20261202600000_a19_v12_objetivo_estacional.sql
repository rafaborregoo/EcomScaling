-- A19 v12: la meta y la confianza se razonan como las razonaria un consultor.
--
-- En el Camino de 7 meses de una tienda de nieve la meta fue "ventas del mes de
-- cierre" (abril, temporada baja) 38k -> 43k: por debajo de lo que la tienda ya
-- vendia, midiendo en el mes equivocado, y con confianza "baja" para todo el
-- plan porque faltaba historico. v12 sustituye esas reglas; el servidor aporta
-- ahora la linea base y la estacionalidad ya calculadas.
do $a19_v12_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v11'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V11_REQUIRED_FOR_V12';
  end if;
end
$a19_v12_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nOBJETIVO, METAS MENSUALES Y CONFIANZA (sustituye cualquier regla anterior sobre baseline, meta y confianza)\nUsa el bloque «Línea base y estacionalidad» que calcula el servidor; no reconstruyas la serie ni reetiquetes meses.\n- BASELINE: es run_rate_3m (el ritmo actual de ventas netas mensuales), no el mismo mes del año pasado. Dilo en el rationale con las cifras de esos tres meses.\n- META: debe medir el resultado que importa del ciclo, no un mes cualquiera. Si el horizonte contiene la temporada alta o el mes pico de la tienda (por su calendario, su categoría o su serie), la meta es el objetivo de ese mes pico y target_offset_days cae en él; no cierres la meta en un mes de temporada baja. Si no hay temporada, la meta es el último mes. goal.target tiene que coincidir con uno de los target_value de monthly_targets.\n- AMBICIÓN: la meta supera el ritmo actual ajustado por temporada. Calcula cada target_value mensual como el mismo mes del año pasado (same_month_last_year) o el ritmo actual multiplicado por el índice del mes, más el crecimiento que justifiquen las palancas del Camino (temporada, stock completo de los productos que más venden, recompra, ticket medio, flows). Indica en cada rationale la cifra de partida y el crecimiento que asumes y por qué. Un target por debajo del ritmo actual o del mismo mes del año anterior sin motivo explícito es un error.\n- Cuando el histórico es de un solo año, úsalo como referencia de estacionalidad, avísalo en assumptions y pon el target en el tramo prudente-ambicioso; no lo conviertas en motivo para no comprometer cifra.\n- CONFIANZA: confidence del plan indica cuánto se sostiene la estrategia y las acciones (fechas comerciales, producto, stock, oferta, flows); es medium o high si las ventas, el catálogo y el calendario cubren lo esencial, aunque el histórico sea corto. goal.confidence indica cuánto se sostiene la cifra: baja solo si la serie no permite fijarla (menos de 6 meses con ventas, ventas no comparables o moneda dudosa); media con un año de histórico; alta con dos temporadas comparables. Explica en una frase por qué tiene esa confianza y qué dato la subiría. Los costes estimados, la ausencia de búsqueda web o un transportista sin muestra son avisos concretos en warnings, no motivo para bajar la confianza de todo el plan.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v11'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v12', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.version <> 'v12'
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v12', v.model, v.prompt_code, 'v12', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v11'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
