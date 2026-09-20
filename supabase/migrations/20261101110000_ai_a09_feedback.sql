-- A09: feedback explícito por respuesta para medir utilidad sin guardar datos
-- adicionales de la conversación ni convertirlo en una encuesta invasiva.
create table if not exists public.ai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  message_id uuid not null references public.ai_messages (id) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating varchar(20) not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_message_feedback_rating check (rating in ('helpful', 'not_helpful')),
  constraint ai_message_feedback_one_per_user unique (message_id, user_id)
);

create index if not exists ai_message_feedback_organization_id_idx
  on public.ai_message_feedback (organization_id);
create index if not exists ai_message_feedback_conversation_id_idx
  on public.ai_message_feedback (conversation_id);

drop trigger if exists set_ai_message_feedback_updated_at on public.ai_message_feedback;
create trigger set_ai_message_feedback_updated_at
before update on public.ai_message_feedback
for each row execute function private.set_updated_at();

alter table public.ai_message_feedback enable row level security;

drop policy if exists "ai_message_feedback_select_own" on public.ai_message_feedback;
create policy "ai_message_feedback_select_own" on public.ai_message_feedback
for select to authenticated
using (user_id = (select auth.uid()) and private.can_access_org(organization_id));

drop policy if exists "ai_message_feedback_insert_own" on public.ai_message_feedback;
create policy "ai_message_feedback_insert_own" on public.ai_message_feedback
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_access_org(organization_id)
  and exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.ai_messages m
    where m.id = message_id and m.conversation_id = conversation_id and m.role = 'assistant'
  )
);

drop policy if exists "ai_message_feedback_update_own" on public.ai_message_feedback;
create policy "ai_message_feedback_update_own" on public.ai_message_feedback
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and private.can_access_org(organization_id)
  and exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.ai_messages m
    where m.id = message_id and m.conversation_id = conversation_id and m.role = 'assistant'
  )
);

grant select, insert, update on public.ai_message_feedback to authenticated;
