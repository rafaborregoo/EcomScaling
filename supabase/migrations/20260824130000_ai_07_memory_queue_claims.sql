-- AI-07: evita que dos workers procesen la misma fila de memoria y permite
-- recuperar una fila cuyo worker murió durante la generación de embeddings.
alter table public.memory_ingestion_queue
  add column if not exists processing_started_at timestamptz;

alter table public.memory_ingestion_queue
  drop constraint if exists memory_ingestion_queue_status;

alter table public.memory_ingestion_queue
  add constraint memory_ingestion_queue_status check (
    status in ('pending', 'processing', 'processed', 'failed')
  );

create index if not exists memory_ingestion_queue_claim_idx on public.memory_ingestion_queue (status, processing_started_at, created_at);
