-- AI-07: memoria acumulativa del consultor experto (contrato tecnico
-- endurecido 2026-07-22, ver
-- roadmap/roadmaps/05-agentes-ia/fases/AI-07-memoria-acumulativa-consultor-experto.md).
--
-- Amplia knowledge_documents con scope jerarquico (store), audiencia con
-- enforcement obligatorio en knowledge_search, origen/autoridad separados de
-- "revisado por humano", ciclo de vida completo, y procedencia real
-- (source_actor_id != ingested_by). Anade memory_ingestion_queue (outbox
-- asincrono e idempotente) y client_constraints (restricciones criticas
-- inyectadas siempre en el contexto de los agentes, sin depender del
-- top-k semantico).

alter table public.knowledge_documents
  add column store_id uuid references public.shopify_stores (id) on delete cascade,
  add column audience varchar(20) not null default 'client_visible',
  add column origin varchar(20) not null default 'human_authored',
  add column authority varchar(20) not null default 'operational',
  add column source_actor_id uuid references public.profiles (id) on delete set null,
  add column ingested_by varchar(20) not null default 'human',
  add column source_entity_type varchar(40),
  add column source_entity_id uuid,
  add column source_version integer,
  add column source_event_id uuid;

alter table public.knowledge_documents
  add constraint knowledge_documents_audience check (
    audience in ('client_visible', 'consultant_only', 'system_only')
  ),
  add constraint knowledge_documents_origin check (
    origin in ('human_authored', 'human_approved_ai', 'human_decision')
  ),
  add constraint knowledge_documents_authority check (
    authority in ('canonical', 'operational', 'contextual')
  ),
  add constraint knowledge_documents_ingested_by check (ingested_by in ('human', 'system'));

-- Ciclo de vida ampliado (antes solo active/archived): pending_indexing
-- mientras el outbox procesa, active en retrieval, superseded cuando una
-- version mas nueva de la misma fuente la reemplaza, deleted cuando se borra
-- la fuente, indexing_failed si el worker no pudo generar los embeddings.
alter table public.knowledge_documents drop constraint knowledge_documents_status;
alter table public.knowledge_documents
  add constraint knowledge_documents_status check (
    status in ('pending_indexing', 'active', 'archived', 'superseded', 'deleted', 'indexing_failed')
  );

-- Idempotencia (criterio de cierre): la misma fuente (mismo evento/version)
-- nunca genera dos documentos aunque el job se relance o el evento se
-- dispare dos veces. Parcial porque source_entity_id es nullable (documentos
-- subidos a mano en /conocimiento no tienen fuente ligada).
create unique index knowledge_documents_source_idempotency_idx
on public.knowledge_documents (organization_id, source_type, source_entity_id, source_version)
where source_entity_id is not null;

create index knowledge_documents_store_id_idx on public.knowledge_documents (store_id);
create index knowledge_documents_audience_idx on public.knowledge_documents (audience);

comment on column public.knowledge_documents.store_id is 'Scope de tienda (null = toda la organizacion cuando visibility=organization). Mismo patron que shopify_financial_summary/shopify_stock_summary.';
comment on column public.knowledge_documents.audience is 'client_visible: cualquier miembro/agente. consultant_only: nunca expuesto via search_knowledge en V1 (ver AI-07). system_only: reservado, sin uso todavia.';
comment on column public.knowledge_documents.origin is 'Quien genero el contenido originalmente, independiente de quien lo autorizo.';
comment on column public.knowledge_documents.authority is 'Cuanto se puede confiar en el contenido como hecho. No reordena knowledge_search todavia.';
comment on column public.knowledge_documents.source_actor_id is 'Quien origino/aprobo/decidio el contenido (el consultor, nunca null para las 3 fuentes de AI-07). Distinto de created_by, que sigue siendo quien subio un documento manual.';
comment on column public.knowledge_documents.ingested_by is 'system para las 3 fuentes automaticas de AI-07; human para documentos subidos a mano en /conocimiento.';

-- Outbox: publicar un resumen, escribir una nota o decidir una salida de IA
-- nunca debe fallar porque Voyage este caido o el embedding tarde. La accion
-- humana solo inserta una fila aqui; un worker aparte la procesa.
create table public.memory_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  source_type varchar(40) not null,
  source_entity_type varchar(40) not null,
  source_entity_id uuid not null,
  source_version integer not null default 1,
  source_event_id uuid not null default gen_random_uuid(),
  source_actor_id uuid references public.profiles (id) on delete set null,
  audience varchar(20) not null,
  origin varchar(20) not null,
  authority varchar(20) not null,
  title varchar(255) not null,
  content text not null,
  status varchar(20) not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  document_id uuid references public.knowledge_documents (id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint memory_ingestion_queue_source_type check (
    source_type in ('call_summary', 'internal_note', 'ai_output_decision')
  ),
  constraint memory_ingestion_queue_audience check (
    audience in ('client_visible', 'consultant_only', 'system_only')
  ),
  constraint memory_ingestion_queue_origin check (
    origin in ('human_authored', 'human_approved_ai', 'human_decision')
  ),
  constraint memory_ingestion_queue_authority check (
    authority in ('canonical', 'operational', 'contextual')
  ),
  constraint memory_ingestion_queue_status check (status in ('pending', 'processed', 'failed')),
  constraint memory_ingestion_queue_idempotency unique (
    organization_id, source_type, source_entity_id, source_version
  )
);

create index memory_ingestion_queue_status_idx on public.memory_ingestion_queue (status, created_at);
create index memory_ingestion_queue_organization_id_idx on public.memory_ingestion_queue (organization_id);

alter table public.memory_ingestion_queue enable row level security;

-- Solo backend (service role) lee/escribe esta cola: no es contenido para
-- mostrar directamente al usuario, es un mecanismo interno de ingestion.
-- Sin policies de select para authenticated (a diferencia de knowledge_*).

comment on table public.memory_ingestion_queue is 'Outbox asincrono de AI-07: decideSummary/addTaskComment/decideAgentOutput encolan aqui, un worker aparte genera embeddings y crea knowledge_documents/knowledge_chunks.';

-- Restricciones explicitas del cliente: no dependen del top-k semantico,
-- se inyectan siempre en el contexto de A02/A04/A06/A09 cuando
-- priority='critical' y status='active'.
create table public.client_constraints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  category varchar(40) not null,
  statement text not null,
  status varchar(20) not null default 'active',
  priority varchar(20) not null default 'normal',
  created_by uuid references public.profiles (id) on delete set null,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_constraints_category check (
    category in ('pricing', 'discounts', 'inventory', 'brand', 'campaigns', 'operations')
  ),
  constraint client_constraints_status check (status in ('active', 'inactive')),
  constraint client_constraints_priority check (priority in ('normal', 'critical')),
  constraint client_constraints_valid_range check (valid_until is null or valid_until >= valid_from)
);

create index client_constraints_organization_id_idx on public.client_constraints (organization_id, status);
create index client_constraints_store_id_idx on public.client_constraints (store_id);

create trigger set_client_constraints_updated_at
before update on public.client_constraints
for each row execute function private.set_updated_at();

alter table public.client_constraints enable row level security;

create policy "client_constraints_select_visible"
on public.client_constraints for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.client_constraints to authenticated;

comment on table public.client_constraints is 'Restricciones criticas del cliente (AI-07): se inyectan siempre en el evidence pack de los agentes, nunca compiten por un lugar en el top-k de knowledge_search.';

-- knowledge_search gana target_store_id (mismo patron de scope que
-- shopify_financial_summary/shopify_stock_summary) y audience_allowed
-- (obligatorio, sin default permisivo -- imposible llamarla "olvidando" el
-- filtro de audiencia). Solo status='active' entra en retrieval por defecto.
drop function if exists public.knowledge_search(uuid, extensions.vector, integer);

create or replace function public.knowledge_search(
  target_organization_id uuid,
  query_embedding extensions.vector(1024),
  audience_allowed text[],
  target_store_id uuid default null,
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title varchar,
  visibility varchar,
  audience varchar,
  authority varchar,
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
    d.audience,
    d.authority,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding)
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'active'
    and c.embedding is not null
    and d.audience = any(audience_allowed)
    and (
      d.visibility = 'global'
      or c.organization_id = target_organization_id
    )
    and (
      target_store_id is null
      or d.store_id is null
      or d.store_id = target_store_id
    )
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.knowledge_search is 'Busqueda semantica: conocimiento global + privado del tenant/tienda objetivo, filtrado por audiencia obligatoria (AI-07). Nunca privado de otros tenants ni de otra tienda de la misma organizacion.';
