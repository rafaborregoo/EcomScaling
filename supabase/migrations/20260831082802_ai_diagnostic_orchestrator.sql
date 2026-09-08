-- Fase 3 del control de coste de agentes de diagnostico: el orquestador de
-- fondo (runDiagnosticOrchestratorTick, apps/api/src/ai-runtime.ts) corre 2
-- veces al dia, decide por organizacion + agente si merece la pena regenerar
-- (misma senal de actividad de la fase 1) y ejecuta como mucho N agentes por
-- pasada, priorizados y dentro del presupuesto de plataforma.
--
-- Esta tabla es el registro de esas decisiones: por que se ejecuto o por que
-- se salto cada (org, agente). La lee el panel platform_admin de
-- observabilidad; nadie mas. Las escrituras van con service_role (bypass RLS),
-- igual que el resto del runtime de agentes (ADR-0006 pto. 7).

create table if not exists public.ai_diagnostic_gate_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete set null,
  agent_code varchar(60) not null,
  -- "ran" = se lanzo el agente; "skipped" = no se lanzo (ver reason).
  decision varchar(20) not null,
  -- no_activity | cooldown | pending_unreviewed | org_run_cap | org_budget |
  -- platform_budget | tick_cap | ran | error
  reason varchar(40) not null,
  activity_digest text,
  tick_id uuid not null,
  created_at timestamptz not null default now(),
  constraint ai_diagnostic_gate_log_decision_check check (decision in ('ran', 'skipped')),
  constraint ai_diagnostic_gate_log_reason_check check (
    reason in (
      'ran', 'no_activity', 'cooldown', 'pending_unreviewed',
      'org_run_cap', 'org_budget', 'platform_budget', 'tick_cap', 'error'
    )
  )
);

comment on table public.ai_diagnostic_gate_log is
  'Registro de decisiones del orquestador de diagnosticos IA (runDiagnosticOrchestratorTick): por que se ejecuto o se salto cada agente en cada pasada. Solo lectura platform_admin; escritura service_role.';

create index if not exists ai_diagnostic_gate_log_org_created_idx on public.ai_diagnostic_gate_log (organization_id, created_at desc);

create index if not exists ai_diagnostic_gate_log_tick_idx on public.ai_diagnostic_gate_log (tick_id);

alter table public.ai_diagnostic_gate_log enable row level security;

drop policy if exists "ai_diagnostic_gate_log_select_admin" on public.ai_diagnostic_gate_log;
create policy "ai_diagnostic_gate_log_select_admin" on public.ai_diagnostic_gate_log for select to authenticated
using (private.is_platform_admin());
