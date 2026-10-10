-- Expose per-agent holdout coverage to the admin dataset workspace.
drop function if exists public.get_agent_judge_holdout_coverage(text);
create or replace function public.get_agent_judge_holdout_coverage(p_dataset_version text)
returns table(agent_code text, case_count integer, approved_case_count integer, critical_positive_cases integer, critical_negative_cases integer)
language sql stable security definer
set search_path = pg_catalog, public as $$
  with expected(agent_code) as (
    select unnest(array[
      'a01_analista_llamadas','a02_monitor_negocio','a04_generador_tareas','a05_estrategia_campanas',
      'a06_planificador_stock','a08_gestor_conocimiento','a09_copiloto_consultor','a11_generador_marketing',
      'a12_analista_email','a13_operativa_shopify','a14_operativa_meta','a15_analista_imagenes',
      'a16_texto_sobre_imagen','a17_plan_semanal','a18_plan_mensual','a19_arquitecto_camino',
      'a19_revision_camino','a20_retencion_clientes','a21_adquisicion_shopify','a22_postventa_shopify',
      'a23_creatividad_meta','a24_medicion_meta','a25_cambios_meta','a26_contenido_email',
      'a27_planificador_mailing','a28_arquitecto_flujos'
    ])
  ), coverage as (
    select c.agent_code, count(c.id)::integer as case_count,
      count(*) filter (where a.id is not null)::integer as approved_case_count,
      count(*) filter (where a.id is not null and exists (
        select 1 from jsonb_array_elements(a.labels) as item(label)
        where coalesce((label->>'critical_failure')::boolean, false)
      ))::integer as critical_positive_cases,
      count(*) filter (where a.id is not null and not exists (
        select 1 from jsonb_array_elements(a.labels) as item(label)
        where coalesce((label->>'critical_failure')::boolean, false)
      ))::integer as critical_negative_cases
    from public.agent_judge_eval_cases c
    left join public.agent_judge_eval_case_adjudications a on a.case_id = c.id
    where c.dataset_version = p_dataset_version and c.split = 'holdout'
    group by c.agent_code
  )
  select e.agent_code, coalesce(c.case_count, 0), coalesce(c.approved_case_count, 0),
    coalesce(c.critical_positive_cases, 0), coalesce(c.critical_negative_cases, 0)
  from expected e left join coverage c using (agent_code)
  order by e.agent_code;
$$;
revoke all on function public.get_agent_judge_holdout_coverage(text) from public, anon, authenticated;
grant execute on function public.get_agent_judge_holdout_coverage(text) to service_role;
comment on function public.get_agent_judge_holdout_coverage(text) is 'Returns case, approval, critical-positive and critical-negative holdout coverage for every active agent; service-role only.';
