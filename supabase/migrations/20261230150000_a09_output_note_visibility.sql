-- Notes on a pending AI output must follow the output's publication boundary.
-- The API also checks status before reading with the service role.
drop policy if exists agent_output_notes_select_workspace on public.agent_output_notes;
create policy agent_output_notes_select_workspace on public.agent_output_notes
  for select to authenticated using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or (
      private.current_member_role(organization_id) in ('owner', 'manager')
      and exists (
        select 1
          from public.agent_outputs ao
         where ao.id = agent_output_notes.output_id
           and ao.organization_id = agent_output_notes.organization_id
           and ao.status in ('approved', 'published')
      )
    )
  );
