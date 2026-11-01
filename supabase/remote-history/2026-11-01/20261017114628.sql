-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Cover the organization foreign key used by claim cleanup/cascade operations.
create index if not exists agent_output_decision_claims_org_idx
  on public.agent_output_decision_claims (organization_id);


