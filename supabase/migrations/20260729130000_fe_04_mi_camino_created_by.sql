-- FE-04 (Mi Camino): el consultor y el cliente pueden ambos crear fases/hitos
-- (assertCanManagePlan ya permite owner/manager ademas de consultor/admin),
-- pero no habia forma de saber quien creo cada uno -- necesario para
-- distinguirlos visualmente en la UI (peticion de Rafa 2026-07-29, analogia
-- "como en GitHub": que se note quien propuso que).
alter table public.strategic_plan_phases
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.strategic_plan_milestones
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

comment on column public.strategic_plan_phases.created_by is
  'Quien creo la fase (consultor/admin o cliente owner/manager) -- para distinguir el origen en la UI.';
comment on column public.strategic_plan_milestones.created_by is
  'Quien creo el hito (consultor/admin o cliente owner/manager) -- para distinguir el origen en la UI.';
