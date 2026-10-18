-- An approved note proposal is an idempotent note on its source output.
alter table public.agent_output_notes
  add column if not exists agent_proposal_index integer;

create unique index if not exists agent_output_notes_proposal_idx
  on public.agent_output_notes (output_id, agent_proposal_index);

comment on column public.agent_output_notes.agent_proposal_index
  is 'Original proposed_writes index; null for ordinary human notes.';
