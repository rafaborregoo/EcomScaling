-- Fase 4: evidencia de ejecucion de cada accion planificada.
-- Se conservan los datos de planificacion y se añaden hechos operativos.

alter table public.campaign_calendar_items
  add column if not exists owner_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists executed_at timestamptz,
  add column if not exists executed_by uuid references public.profiles (id) on delete set null,
  add column if not exists execution_notes text,
  add column if not exists result_data jsonb not null default '{}'::jsonb,
  add column if not exists blocked_reason text;

create index if not exists campaign_calendar_items_execution_idx
  on public.campaign_calendar_items (organization_id, status, starts_at)
  where deleted_at is null;

alter table public.campaign_calendar_items
  drop constraint if exists campaign_calendar_items_execution_consistency;

update public.campaign_calendar_items
set executed_at = coalesce(executed_at, updated_at, now())
where status = 'completed' and executed_at is null;

alter table public.campaign_calendar_items
  add constraint campaign_calendar_items_execution_consistency check (
    (status = 'completed' and executed_at is not null)
    or status <> 'completed'
  );

comment on column public.campaign_calendar_items.owner_user_id is 'Responsable operativo de la accion.';
comment on column public.campaign_calendar_items.executed_at is 'Momento en que la accion se marco como ejecutada.';
comment on column public.campaign_calendar_items.executed_by is 'Usuario que confirmo la ejecucion.';
comment on column public.campaign_calendar_items.execution_notes is 'Notas de ejecucion o incidencia.';
comment on column public.campaign_calendar_items.result_data is 'Resultado estructurado: KPI observado, enlaces o evidencia.';
comment on column public.campaign_calendar_items.blocked_reason is 'Motivo requerido por el consultor cuando la accion no puede ejecutarse.';
