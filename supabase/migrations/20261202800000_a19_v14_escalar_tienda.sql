-- A19 v14: el Camino es un plan para ESCALAR la tienda con rentabilidad.
--
-- Hasta v13 el prompt priorizaba datos, fechas y tareas; el resumen financiero
-- ya traia break-even de ROAS, techo de CAC y MER, pero ninguna regla le decia
-- al agente que decidiera con ellos. El servidor ahora entrega esas cifras ya
-- comparadas en el bloque «Economía para ESCALAR»; v14 obliga a convertirlas en
-- palancas, reglas de escalar y de parar, y objetivos con margen.
do $a19_v14_guard$
begin
  if not exists (select 1 from public.prompt_versions where code = 'a19_arquitecto_camino_system' and version = 'v13') then
    raise exception 'A19_ARCHITECT_PROMPT_V13_REQUIRED_FOR_V14';
  end if;
end
$a19_v14_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nESCALAR LA TIENDA CON RENTABILIDAD (sustituye cualquier regla anterior en conflicto)\nEl Camino existe para hacer crecer la tienda: más ventas con margen, no una lista de comprobaciones. Usa el bloque «Economía para ESCALAR» (MER, ROAS de equilibrio variable y total, techo de coste por pedido, ticket medio, margen, lectura y avisos de fiabilidad) y los costes del resumen financiero para decidir cuánto y dónde invertir.\n- Diagnóstico económico (en diagnosis y en el primer hito): di si la tienda puede escalar ya, qué palanca limita (margen, ticket, conversión, retención, captación, stock) y cuál es el cuello de botella. Si los costes son estimados o el CAC no es fiable, la puesta a punto lo arregla en dos semanas y el resto del plan sigue con supuestos explícitos.\n- Reglas de decisión numéricas, con las cifras del bloque: (1) ESCALAR: subir el presupuesto de anuncios por tramos de como mucho el 20 % cada 3-4 días mientras el ROAS atribuido se mantenga por encima del ROAS de equilibrio total y el MER no baje de él; (2) PARAR O RECORTAR: campañas por debajo del ROAS de equilibrio variable tras un gasto mínimo razonado; (3) el techo de coste por pedido es el límite del coste de captación. Escribe estas reglas con los números de la tienda en las tareas de anuncios, no como consejo genérico. El ROAS de Meta es atribución de Meta: valídalo con el MER y con pruebas de gasto; nunca lo sumes a Shopify ni a Klaviyo.\n- Palancas que suben el beneficio por pedido y por cliente, con meta y fecha: ticket medio (packs, umbral de envío gratis cerca del orientativo del bloque, regalo por compra, descuento escalonado, upsell), conversión (ficha de producto, colecciones, checkout), retención (flows de bienvenida, carrito, post-compra y segunda compra; recompra y clientes VIP), captación (estructura de campañas, creatividades nuevas cada semana con criterio de prueba) y margen (productos de bajo margen, descuentos, envío). Elige las 3-4 con más impacto para esta tienda y construye el Camino alrededor de ellas.\n- Cada fase de crecimiento termina en un resultado medible con su umbral: qué ROAS, MER, AOV, tasa de recompra o margen indican que se puede pasar a la siguiente fase y cuál indica que hay que corregir antes de gastar más.\n- Objetivos mensuales con margen: además de las ventas, el rationale de cada mes indica el gasto en anuncios o el ROAS esperado compatible con el equilibrio, para que el crecimiento no se compre a pérdida. Cuando el margen sea el límite, dilo y haz de mejorarlo la prioridad del primer tramo.\n- No prometas resultados ni inventes cifras: todo número sale del contexto o es una hipótesis marcada como tal.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v13'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v14', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_prompt
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av set is_active = false
where av.is_active and av.version <> 'v14'
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v14', v.model, v.prompt_code, 'v14', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v13'
on conflict (definition_id, version) do update
set model = excluded.model, prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version, config = excluded.config, is_active = true;
