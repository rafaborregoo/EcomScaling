-- F8.00/F8.01: raíces contractuales del framework y ejecutabilidad explícita.
alter table public.execution_supervision_runs drop constraint if exists execution_supervision_runs_stage;
alter table public.execution_supervision_runs add constraint execution_supervision_runs_stage check (stage in ('UNIVERSAL','EXECUTABILITY_AUTHORIZATION','CAPABILITIES','SAFE_EXECUTION','MONITORING','GUARDRAILS','LIFECYCLE','INCIDENTS','ROLLBACK_RECOVERY','OVERRIDE_ESCALATION','CONCURRENCY','VERIFICATION','REPORTING'));
comment on table public.execution_supervision_runs is 'F8.00-F8.17: contrato universal, ejecutabilidad, autorización y supervisión por etapas; sin autoridad implícita.';
