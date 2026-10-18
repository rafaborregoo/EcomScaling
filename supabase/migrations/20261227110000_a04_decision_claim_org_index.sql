-- Cover the organization foreign key used by claim cleanup/cascade operations.
create index if not exists agent_output_decision_claims_org_idx
  on public.agent_output_decision_claims (organization_id);
