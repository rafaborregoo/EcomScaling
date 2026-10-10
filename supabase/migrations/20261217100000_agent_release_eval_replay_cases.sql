create table if not exists public.agent_release_eval_cases (
  id uuid primary key default gen_random_uuid(),
  agent_code text not null check (agent_code in (
    'a01_analista_llamadas','a02_monitor_negocio','a04_generador_tareas','a05_estrategia_campanas',
    'a06_planificador_stock','a08_gestor_conocimiento','a09_copiloto_consultor','a11_generador_marketing',
    'a12_analista_email','a13_operativa_shopify','a14_operativa_meta','a15_analista_imagenes',
    'a16_texto_sobre_imagen','a17_plan_semanal','a18_plan_mensual','a19_arquitecto_camino',
    'a19_revision_camino','a20_retencion_clientes','a21_adquisicion_shopify','a22_postventa_shopify',
    'a23_creatividad_meta','a24_medicion_meta','a25_cambios_meta','a26_contenido_email',
    'a27_planificador_mailing','a28_arquitecto_flujos'
  )),
  dataset_version text not null check (length(dataset_version) between 1 and 80),
  rubric_version text not null,
  split text not null check (split in ('development','calibration','release')),
  provenance text not null check (provenance in ('synthetic','anonymized_production')),
  privacy_reviewed boolean not null default false,
  content_sha256 text not null unique check (content_sha256 ~ '^[a-f0-9]{64}$'),
  fixture jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (pg_column_size(fixture) <= 204800),
  check (fixture ->> 'schema_version' = 'agent-release-replay-v1'),
  check (fixture ->> 'agent_code' = agent_code),
  check (fixture ->> 'dataset_version' = dataset_version),
  check (fixture ->> 'rubric_version' = rubric_version),
  check (fixture ->> 'split' = split),
  check (fixture ->> 'provenance' = provenance),
  check (coalesce((fixture ->> 'privacy_reviewed')::boolean, false) = privacy_reviewed),
  check (provenance <> 'synthetic' or split = 'development'),
  check (provenance <> 'anonymized_production' or privacy_reviewed)
);

create index if not exists agent_release_eval_cases_lookup_idx
  on public.agent_release_eval_cases(dataset_version, agent_code, split, created_at);

alter table public.agent_release_eval_cases enable row level security;
revoke all on public.agent_release_eval_cases from public, anon, authenticated;
grant select, insert on public.agent_release_eval_cases to service_role;

drop trigger if exists agent_release_eval_cases_append_only on public.agent_release_eval_cases;
create trigger agent_release_eval_cases_append_only
before update or delete on public.agent_release_eval_cases
for each row execute function public.reject_agent_judge_eval_mutation();

comment on table public.agent_release_eval_cases is
  'Immutable, privacy-reviewed candidate execution fixtures. Separate from judge artifact calibration cases; tool results are replay-only.';
