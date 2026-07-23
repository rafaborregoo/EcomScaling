-- AI-00/AI-06 (R-011): el runtime de agentes solo registraba coste/latencia,
-- nunca los aplicaba como limite real. Se anade el estado `budget_exceeded`
-- para poder distinguir un corte deliberado por presupuesto de un fallo real
-- (`failed`) o una salida rechazada por calidad (`rejected_output`).
alter table public.agent_runs
  drop constraint agent_runs_status;

alter table public.agent_runs
  add constraint agent_runs_status
  check (status in ('running', 'succeeded', 'failed', 'rejected_output', 'budget_exceeded'));
