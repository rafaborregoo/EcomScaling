create schema extensions;
create extension vector with schema extensions;
create table public.knowledge_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid,store_id uuid,title varchar(255),description text,
 source_type text,visibility varchar(20),audience varchar(20),authority varchar(20) default 'operational',
 origin text default 'human_authored',ingested_by text default 'human',source_actor_id uuid,
 content text,checksum text,embedding_model text,created_by uuid,version integer default 1,status text default 'active',
 updated_at timestamptz default now()
);
create unique index global_active_title on public.knowledge_documents(title) where visibility='global' and status='active';
create table public.knowledge_chunks(
 id uuid primary key default gen_random_uuid(),document_id uuid references public.knowledge_documents(id) on delete cascade,
 organization_id uuid,chunk_index integer,content text,token_count integer,embedding extensions.vector(1024) not null,
 unique(document_id,chunk_index)
);
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
create policy fixture_document_reader on public.knowledge_documents for select to authenticated using (
 audience='client_visible' and (visibility='global' or organization_id=nullif(current_setting('imp04.organization_id',true),'')::uuid)
 and (store_id is null or store_id=nullif(current_setting('imp04.store_id',true),'')::uuid)
);
create policy fixture_chunk_reader on public.knowledge_chunks for select to authenticated using (
 exists(select 1 from public.knowledge_documents d where d.id=document_id)
);
grant select on public.knowledge_documents,public.knowledge_chunks to authenticated;
grant all on public.knowledge_documents,public.knowledge_chunks to service_role;
grant usage on schema extensions to service_role,authenticated;
