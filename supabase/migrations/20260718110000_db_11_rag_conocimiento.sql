-- DB-11 / AI-04: conocimiento y RAG con pgvector (decision: pgvector dentro
-- de Supabase, con interfaz de retrieval swappable en packages/ai por si en
-- el futuro se migra a una base vectorial separada).
--
-- Visibilidad en dos niveles:
--   - global: metodologia EcomScaling compartida (organization_id null).
--   - organization: conocimiento privado de un tenant. NUNCA se mezcla hacia
--     global: la visibilidad se fija al crear el documento y un constraint
--     impide estados incoherentes.
-- Embeddings: vector(1024) (voyage-3.5 por defecto; el proveedor es
-- intercambiable siempre que emita 1024 dimensiones).

create extension if not exists vector with schema extensions;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  title varchar(255) not null,
  description text,
  source_type varchar(40) not null default 'manual',
  visibility varchar(20) not null,
  version integer not null default 1,
  checksum varchar(64) not null,
  embedding_model varchar(120),
  status varchar(20) not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_documents_source_type check (
    source_type in ('manual', 'upload', 'url', 'call_transcript')
  ),
  constraint knowledge_documents_visibility check (visibility in ('global', 'organization')),
  constraint knowledge_documents_status check (status in ('active', 'archived')),
  -- Coherencia visibilidad/tenant: global sin organizacion, organization con ella.
  constraint knowledge_documents_visibility_org check (
    (visibility = 'global' and organization_id is null)
    or (visibility = 'organization' and organization_id is not null)
  )
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  constraint knowledge_chunks_unique_index unique (document_id, chunk_index)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_code varchar(80) not null,
  title varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role varchar(20) not null,
  content text not null,
  run_id uuid references public.agent_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_messages_role check (role in ('user', 'assistant'))
);

create index knowledge_documents_organization_id_idx on public.knowledge_documents (organization_id);
create index knowledge_documents_visibility_idx on public.knowledge_documents (visibility, status);
create index knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);
create index knowledge_chunks_organization_id_idx on public.knowledge_chunks (organization_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index ai_conversations_organization_id_idx on public.ai_conversations (organization_id);
create index ai_conversations_user_id_idx on public.ai_conversations (user_id);
create index ai_messages_conversation_id_idx on public.ai_messages (conversation_id);
create index ai_messages_organization_id_idx on public.ai_messages (organization_id);

create trigger set_knowledge_documents_updated_at
before update on public.knowledge_documents
for each row execute function private.set_updated_at();

create trigger set_ai_conversations_updated_at
before update on public.ai_conversations
for each row execute function private.set_updated_at();

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Global: visible a cualquier usuario autenticado (es la metodologia que se
-- entrega a los clientes). Por organizacion: solo quien accede a ese tenant.
create policy "knowledge_documents_select_visible"
on public.knowledge_documents for select to authenticated
using (
  (visibility = 'global')
  or (organization_id is not null and private.can_access_org(organization_id))
);

create policy "knowledge_chunks_select_visible"
on public.knowledge_chunks for select to authenticated
using (
  (organization_id is null)
  or private.can_access_org(organization_id)
);

create policy "ai_conversations_select_own"
on public.ai_conversations for select to authenticated
using (user_id = (select auth.uid()) and private.can_access_org(organization_id));

create policy "ai_messages_select_own"
on public.ai_messages for select to authenticated
using (
  exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = (select auth.uid())
  )
);

grant select on public.knowledge_documents to authenticated;
grant select on public.knowledge_chunks to authenticated;
grant select on public.ai_conversations to authenticated;
grant select on public.ai_messages to authenticated;

-- Retrieval con citas: devuelve los chunks mas cercanos (coseno) del
-- conocimiento global + el privado de la organizacion objetivo. Funcion
-- stable sin security definer (patron ADR-0006): llamada por el API con
-- service role; si la llama un usuario autenticado, la RLS de las tablas
-- base sigue aplicando.
create or replace function public.knowledge_search(
  target_organization_id uuid,
  query_embedding extensions.vector(1024),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title varchar,
  visibility varchar,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.visibility,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding)
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'active'
    and c.embedding is not null
    and (
      d.visibility = 'global'
      or c.organization_id = target_organization_id
    )
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on table public.knowledge_documents is 'Documentos de conocimiento (metodologia global o privado por organizacion) versionados con checksum.';
comment on table public.knowledge_chunks is 'Fragmentos con embedding pgvector(1024) para retrieval semantico con citas.';
comment on function public.knowledge_search is 'Busqueda semantica: conocimiento global + privado del tenant objetivo, nunca privado de otros tenants.';
