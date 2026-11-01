-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A16: una intenciÃ³n de generaciÃ³n crea un Ãºnico run recuperable.
alter table public.instagram_overlay_draft_outputs
  alter column draft drop not null,
  add column if not exists status text not null default 'succeeded',
  add column if not exists agent_output_id uuid references public.agent_outputs(id) on delete set null,
  add column if not exists request_fingerprint text not null default '',
  add column if not exists estimated_cost_usd numeric(12, 6),
  add column if not exists error_code text,
  add column if not exists finished_at timestamptz;

alter table public.instagram_overlay_draft_outputs
  drop constraint if exists instagram_overlay_draft_outputs_status_check,
  add constraint instagram_overlay_draft_outputs_status_check
    check (status in ('running', 'succeeded', 'failed'));

create index if not exists instagram_overlay_draft_outputs_recovery_idx
  on public.instagram_overlay_draft_outputs (overlay_id, status, created_at desc);

grant select on public.instagram_overlay_draft_outputs to authenticated;
grant all on public.instagram_overlay_draft_outputs to service_role;


