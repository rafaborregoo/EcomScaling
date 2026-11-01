-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.agent_release_eval_cases'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%pg_column_size(fixture)%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.agent_release_eval_cases drop constraint %I', existing_constraint);
  end if;
end;
$$;

alter table public.agent_release_eval_cases
  add constraint agent_release_eval_cases_fixture_size_limit
  check (pg_column_size(fixture) <= 9437184);

comment on constraint agent_release_eval_cases_fixture_size_limit on public.agent_release_eval_cases is
  'Supports bounded multimodal release fixtures while retaining a 9 MiB database-side cap';
