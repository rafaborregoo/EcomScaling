-- A22-2/A22-8: compare equal shipping windows and require evidence-led,
-- human-approved actions. The tool remains read-only.

do $migration$
declare
  previous_content text;
  appended text := E'\n\n12. COMPARACIONES Y ACCIONES DE OPERATIVA\n- `shopify_delivery_diagnostics` devuelve dos ventanas consecutivas de la misma duraci\u00f3n: periodo actual y periodo anterior, con fechas y un `as_of` expl\u00edcitos. Compara solo grupos con la misma tienda, transportista, ubicaci\u00f3n de preparaci\u00f3n y destino; exige `sample_reliable` y al menos 30 fulfillments en CADA ventana. Si falta un grupo comparable, la muestra, ETA o cobertura de eventos, declara la limitaci\u00f3n y no rellenes diferencias.\n- Trata el cambio entre ventanas como asociaci\u00f3n descriptiva, no causalidad ni prueba de que un transportista incumpla. Distingue volumen, composici\u00f3n de rutas, temporadas, cobertura y estados de sync. El tramo pedido a creaci\u00f3n del fulfillment no confirma recogida f\u00edsica.\n- Si vas a proponer comunicaci\u00f3n por una incidencia, consulta `shopify_open_delivery_exceptions` y limita la propuesta a los env\u00edos sincronizados que aparecen ah\u00ed.\n- Prop\u00f3n trabajo distinto solo cuando los datos lo sustenten: preparaci\u00f3n si crece el tramo previo al fulfillment; investigar un lote con el operador si hay env\u00edos comparables estancados; revisar documentos aduaneros solo con evento `customs_hold`; revisar la promesa si ETA/tardanzas lo justifican; comunicar preventivamente si hay incidencias abiertas relevantes; estudiar SLA solo con volumen y evidencia suficientes.\n- Cada propuesta debe incluir cifra y periodo, evidencia observada, hip\u00f3tesis por comprobar, responsable y m\u00e9trica/ventana para confirmar o refutar el cambio. Si la evidencia no separa estas opciones, recomienda una investigaci\u00f3n concreta o abstente.\n- No cambies transportista ni promesa, no emitas reembolsos y no contactes compradores u operadores autom\u00e1ticamente. Toda tarea o cambio es una propuesta revisable y necesita aprobaci\u00f3n humana.';
begin
  select content into previous_content
  from public.prompt_versions
  where code = 'a22_postventa_shopify_system' and version = 'v6';

  if previous_content is null then
    raise exception 'A22 v6 canonical prompt is missing';
  end if;

  insert into public.prompt_versions (code, version, content, checksum)
  values ('a22_postventa_shopify_system', 'v7', previous_content || appended,
    encode(sha256((previous_content || appended)::bytea), 'hex'))
  on conflict (code, version) do update
  set content = excluded.content, checksum = excluded.checksum;

  insert into public.agent_versions as existing_version
    (definition_id, version, model, prompt_code, prompt_version, allowed_tools,
     approval_mode, output_schema_version, config, is_active)
  select v.definition_id, 'v7', v.model, 'a22_postventa_shopify_system', 'v7',
    (select coalesce(jsonb_agg(x.tool_name order by x.tool_name), '[]'::jsonb)
     from (select distinct tool_name
       from jsonb_array_elements_text(coalesce(v.allowed_tools, '[]'::jsonb) ||
         jsonb_build_array(
           'shopify_delivery_diagnostics',
           'shopify_open_delivery_exceptions',
           'shopify_return_delay_comparison',
           'shopify_fulfillment_health'
         )) as allowed(tool_name)) x),
    v.approval_mode, v.output_schema_version, v.config, true
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a22_postventa_shopify' and v.version = 'v6'
  on conflict (definition_id, version) do update
  set prompt_code = excluded.prompt_code,
      prompt_version = excluded.prompt_version,
      allowed_tools = excluded.allowed_tools,
      config = excluded.config,
      is_active = true;

  update public.agent_versions av
  set is_active = false
  where av.is_active and av.version <> 'v7'
    and av.definition_id = (select id from public.agent_definitions where code = 'a22_postventa_shopify');
end
$migration$;
