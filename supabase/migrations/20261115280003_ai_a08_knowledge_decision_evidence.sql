-- A08-3: link only explicit missing-knowledge rejection reasons to empty RAG searches in the same run.
with base_prompt as (
  select content
  from public.prompt_versions
  where code = 'a08_gestor_conocimiento_system' and version = 'v5'
), prompt_v6 as (
  select content || E'\n\n8. DECISION EVIDENCE\nA rejected agent output is a knowledge-gap signal only when its decision reason explicitly says information/data/evidence/source/context was missing or insufficient AND it belongs to the exact same run as a successful zero-result search_knowledge call for the topic. A generic rejection, tone preference, or unrelated quality concern is not evidence of missing knowledge. The server sends only the normalized evidence category and source IDs; never quote, reconstruct, or expose the original decision reason. This linkage is evidence for review, not proof that missing documentation caused the business outcome.' as content
  from base_prompt
)
insert into public.prompt_versions (code, version, content, checksum)
select
  'a08_gestor_conocimiento_system',
  'v6',
  content,
  encode(sha256('a08_gestor_conocimiento_system_v6'::bytea), 'hex')
from prompt_v6
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id = (
    select id from public.agent_definitions
    where code = 'a08_gestor_conocimiento'
  );

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select id, 'v7', 'claude-sonnet-5', 'a08_gestor_conocimiento_system', 'v6',
  '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a08_gestor_conocimiento'
on conflict (definition_id, version) do update
set is_active = excluded.is_active;
;
