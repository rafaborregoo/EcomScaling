-- AI-13: el modo de ejecucion del agente debe ser un dato auditable.
-- El piloto opera en shadow por defecto: las salidas pueden generar evidencia
-- y propuestas, pero ninguna escritura de dominio se ejecuta sin decision humana.
alter table public.agent_runs
  add column if not exists execution_mode varchar(20) not null default 'shadow';

alter table public.agent_runs
  drop constraint if exists agent_runs_execution_mode;

alter table public.agent_runs
  add constraint agent_runs_execution_mode
  check (execution_mode in ('shadow', 'live'));

comment on column public.agent_runs.execution_mode is
  'Modo operativo auditable: shadow es el valor por defecto del piloto; live requiere una activacion futura explicita.';
