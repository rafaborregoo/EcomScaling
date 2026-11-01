-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Raise judge calibration storage capacity to cover the full 26-agent holdout.
alter table public.agent_judge_calibration_runs drop constraint if exists agent_judge_calibration_runs_case_count_check;
alter table public.agent_judge_calibration_runs add constraint agent_judge_calibration_runs_case_count_check check (case_count between 0 and 5000);
alter table public.agent_judge_calibration_runs drop constraint if exists agent_judge_calibration_runs_estimated_cost_usd_check;
alter table public.agent_judge_calibration_runs add constraint agent_judge_calibration_runs_estimated_cost_usd_check check (estimated_cost_usd between 0 and 50);

create or replace function private.enforce_agent_judge_holdout_sample_floor()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_code text;
  v_cases integer;
  v_positive integer;
  v_negative integer;
begin
  for v_code in
    select unnest(array[
      'a01_analista_llamadas','a02_monitor_negocio','a04_generador_tareas','a05_estrategia_campanas',
      'a06_planificador_stock','a08_gestor_conocimiento','a09_copiloto_consultor','a11_generador_marketing',
      'a12_analista_email','a13_operativa_shopify','a14_operativa_meta','a15_analista_imagenes',
      'a16_texto_sobre_imagen','a17_plan_semanal','a18_plan_mensual','a19_arquitecto_camino',
      'a19_revision_camino','a20_retencion_clientes','a21_adquisicion_shopify','a22_postventa_shopify',
      'a23_creatividad_meta','a24_medicion_meta','a25_cambios_meta','a26_contenido_email',
      'a27_planificador_mailing','a28_arquitecto_flujos'
    ])
  loop
    select count(*)::integer,
      count(*) filter (where exists (
        select 1 from jsonb_array_elements(a.labels) as item(label)
        where coalesce((label->>'critical_failure')::boolean, false)
      ))::integer,
      count(*) filter (where not exists (
        select 1 from jsonb_array_elements(a.labels) as item(label)
        where coalesce((label->>'critical_failure')::boolean, false)
      ))::integer
      into v_cases, v_positive, v_negative
    from public.agent_judge_eval_cases c
    join public.agent_judge_eval_case_adjudications a on a.case_id = c.id
    where c.dataset_version = new.dataset_version and c.split = 'holdout' and c.agent_code = v_code;

    if v_cases < 50 or v_positive < 10 or v_negative < 10 then
      raise exception 'agent_judge_holdout_not_ready:sample_floor:%:%:%:%', v_code, v_cases, v_positive, v_negative
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.enforce_agent_judge_holdout_sample_floor() from public, anon, authenticated;
drop trigger if exists agent_judge_holdout_sample_floor on public.agent_judge_eval_dataset_freezes;
create trigger agent_judge_holdout_sample_floor
before insert on public.agent_judge_eval_dataset_freezes
for each row execute function private.enforce_agent_judge_holdout_sample_floor();

comment on function private.enforce_agent_judge_holdout_sample_floor() is 'Requires at least 50 independently adjudicated holdout cases per active agent, including 10 critical-positive and 10 critical-negative cases, before freeze.';


