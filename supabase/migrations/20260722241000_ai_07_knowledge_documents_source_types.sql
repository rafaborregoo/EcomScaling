-- AI-07 (parte 2, mismo dia): knowledge_documents.source_type solo admitia
-- manual/upload/url/call_transcript (documentos subidos a mano). Las 3
-- fuentes automaticas de memoria necesitan sus propios valores, alineados 1:1
-- con memory_ingestion_queue.source_type para que un documento sea trazable
-- a su origen sin ambiguedad.

alter table public.knowledge_documents drop constraint if exists knowledge_documents_source_type;
alter table public.knowledge_documents
  add constraint knowledge_documents_source_type check (
    source_type in (
      'manual', 'upload', 'url', 'call_transcript',
      'call_summary', 'internal_note', 'ai_output_decision'
    )
  );
