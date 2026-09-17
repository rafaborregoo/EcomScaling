alter table public.playbook_framework_runs
  drop constraint if exists playbook_framework_domain_check;

alter table public.playbook_framework_runs
  add constraint playbook_framework_domain_check
  check (domain in ('GENERAL', 'ACQUISITION', 'PAID_MEDIA', 'CONVERSION'));
