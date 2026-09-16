alter table public.playbook_framework_runs
  add column if not exists domain varchar(32) not null default 'GENERAL';

alter table public.playbook_framework_runs
  drop constraint if exists playbook_framework_domain_check;

alter table public.playbook_framework_runs
  add constraint playbook_framework_domain_check
  check (domain in ('GENERAL', 'ACQUISITION'));

create index if not exists playbook_framework_domain_idx
  on public.playbook_framework_runs (domain, evaluated_at desc);
