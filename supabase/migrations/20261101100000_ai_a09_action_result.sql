-- A09: conservar el resultado de una aprobacion para que el copiloto pueda
-- reconstruirlo al recargar una conversacion, no solo durante el click.
alter table public.agent_approvals
  add column if not exists tasks_created integer not null default 0;

alter table public.agent_approvals
  drop constraint if exists agent_approvals_tasks_created_nonnegative;

alter table public.agent_approvals
  add constraint agent_approvals_tasks_created_nonnegative
  check (tasks_created >= 0);
