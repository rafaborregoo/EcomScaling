alter table public.strategic_plan_milestones
  add column if not exists completion_evidence text;

alter table public.strategic_plan_milestones
  add constraint strategic_plan_milestones_completion_evidence_length
  check (completion_evidence is null or char_length(completion_evidence) between 20 and 2000);
