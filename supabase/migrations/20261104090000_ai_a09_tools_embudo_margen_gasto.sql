-- A09: el copiloto ya podia leer clientes, demanda y fulfillment, pero no el
-- embudo, ni el margen, ni el gasto por campana. Esas cifras estaban en
-- pantalla y a dos clics del consultor, y el agente no tenia con que responder
-- "donde se me cae la conversion" ni "que me come el margen".
--
-- Tres tools, no siete: el criterio de `packages/ai/src/tool-layer.ts` es que
-- cada tool responda una pregunta entera, para que el modelo no tenga que
-- elegir entre metricas parecidas.
--
--   shopify_funnel_health -> shopify_funnel_summary + funnel_daily + checkout_recovery
--   shopify_margin_health -> margin_summary + top_products + discount_cost_by_code + sales_daily
--   meta_spend_detail     -> meta_spend_by_campaign + meta_spend_daily
--
-- No se toca el prompt: misma `prompt_version` que la v10. Lo unico que cambia
-- es el alcance de lectura, y por eso va como version nueva y no editando la
-- v10 en su sitio -- `allowed_tools` solo se mueve con una version
-- identificable del agente.
--
-- Idempotente (CLAUDE.md): las tools se anaden solo si faltan, la v11 se
-- reaplica sin danar, y si esta migracion ya corrio el `jsonb` no crece con
-- duplicados.

do $$
declare
  v_definition_id uuid;
  v_model text;
  v_prompt_version text;
  v_allowed_tools jsonb;
  v_approval_mode text;
  v_nuevas text[] := array['shopify_funnel_health', 'shopify_margin_health', 'meta_spend_detail'];
  v_tool text;
begin
  select d.id, v.model, v.prompt_version, v.allowed_tools, v.approval_mode
    into v_definition_id, v_model, v_prompt_version, v_allowed_tools, v_approval_mode
  from public.agent_definitions d
  join public.agent_versions v on v.definition_id = d.id and v.is_active = true
  where d.code = 'a09_copiloto_consultor'
  limit 1;

  if v_definition_id is null then
    raise exception 'No active a09_copiloto_consultor version found';
  end if;

  v_allowed_tools := coalesce(v_allowed_tools, '[]'::jsonb);

  -- Anadir solo lo que falte: si la migracion se reaplica, la lista no crece.
  foreach v_tool in array v_nuevas loop
    if not (v_allowed_tools @> to_jsonb(array[v_tool])) then
      v_allowed_tools := v_allowed_tools || to_jsonb(v_tool);
    end if;
  end loop;

  update public.agent_versions
  set is_active = false
  where definition_id = v_definition_id and is_active = true;

  insert into public.agent_versions (
    definition_id, version, model, prompt_code, prompt_version,
    allowed_tools, approval_mode, is_active
  ) values (
    v_definition_id, 'v11', v_model, 'a09_copiloto_consultor_system',
    coalesce(v_prompt_version, 'v6'), v_allowed_tools,
    coalesce(v_approval_mode, 'none'), true
  )
  on conflict (definition_id, version) do update set
    model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
end $$;
