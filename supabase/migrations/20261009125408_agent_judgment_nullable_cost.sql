-- Unknown model prices are unknown, never a fabricated zero-dollar cost.
alter table public.agent_run_judgments
  alter column estimated_cost_usd drop default,
  alter column estimated_cost_usd drop not null;

