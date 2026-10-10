-- Feedback changes are recorded as new events; the service role only reads them.
revoke all on public.agent_judgment_feedback from anon, authenticated, service_role;
grant select on public.agent_judgment_feedback to service_role;
