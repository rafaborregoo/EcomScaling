-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Keep the internal lease table inaccessible to browser roles and index each FK action directly.
create policy a21_generation_jobs_deny_client
  on public.a21_generation_jobs as restrictive for all to anon, authenticated
  using (false) with check (false);

create index if not exists a21_generation_jobs_store_fk_idx
  on public.a21_generation_jobs(store_id);
create index if not exists a21_generation_jobs_output_fk_idx
  on public.a21_generation_jobs(output_id);


