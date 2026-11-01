-- Reconcile deployed A24 through the same atomic promotion path used on replay.
do $promotion$
declare candidate uuid;
begin
  select v.id into candidate from public.agent_versions v
  join public.agent_definitions d on d.id=v.definition_id
  where d.code='a24_medicion_meta' and v.version='v10';
  if candidate is null then raise exception 'a24_v10_candidate_missing'; end if;
  perform public.promote_agent_version(candidate);
end;
$promotion$;
