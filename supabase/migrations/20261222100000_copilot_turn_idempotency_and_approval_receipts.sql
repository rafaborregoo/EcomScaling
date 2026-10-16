-- Copilot retries reuse one client turn identifier and must not create another
-- user message/run. Approval receipts are one durable decision per output.

-- Preserve any historical duplicate approval receipts before selecting the
-- latest decision as the active receipt. This retains the full audit trail
-- while allowing the runtime to upsert one receipt per output_id.
create table if not exists public.agent_approval_duplicate_archive as
select approvals.*, now() as archived_at
from public.agent_approvals as approvals
with no data;

revoke all on public.agent_approval_duplicate_archive from public, anon, authenticated;
grant all on public.agent_approval_duplicate_archive to service_role;
alter table public.agent_approval_duplicate_archive enable row level security;

with ranked_approvals as (
  select
    id,
    row_number() over (
      partition by output_id
      order by decided_at desc nulls last, id desc
    ) as duplicate_rank
  from public.agent_approvals
),
archived_approvals as (
  insert into public.agent_approval_duplicate_archive
  select approvals.*, now()
  from public.agent_approvals as approvals
  join ranked_approvals using (id)
  where ranked_approvals.duplicate_rank > 1
  returning id
)
delete from public.agent_approvals as approvals
using archived_approvals
where approvals.id = archived_approvals.id;

create unique index if not exists agent_approvals_one_decision_per_output_idx
  on public.agent_approvals (output_id);

create unique index if not exists ai_messages_copilot_client_turn_id_idx
  on public.ai_messages (
    organization_id,
    (metadata ->> 'client_turn_id')
  )
  where role = 'user'
    and metadata ? 'client_turn_id';

comment on index public.agent_approvals_one_decision_per_output_idx is
  'One durable decision receipt per AI output; retries update the same receipt.';

comment on index public.ai_messages_copilot_client_turn_id_idx is
  'Prevents duplicate Copilot question messages and runs when a client retries a turn.';
