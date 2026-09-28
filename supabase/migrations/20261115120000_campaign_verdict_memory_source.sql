-- AI-07 T6: index only an explicit, human-authored campaign outcome.
alter table public.memory_ingestion_queue
  drop constraint if exists memory_ingestion_queue_source_type;
alter table public.memory_ingestion_queue
  add constraint memory_ingestion_queue_source_type check (
    source_type in ('call_summary','internal_note','ai_output_decision','campaign_outcome_verdict')
  );

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_source_type;
alter table public.knowledge_documents
  add constraint knowledge_documents_source_type check (
    source_type in (
      'manual','upload','url','call_transcript','call_summary','internal_note',
      'ai_output_decision','instagram_image','campaign_outcome_verdict'
    )
  );

comment on column public.knowledge_documents.source_actor_id is
  'Actor humano responsable de la fuente AI-07; las fuentes humanas actuales incluyen resúmenes aprobados, notas internas, decisiones y veredictos de campañas.';
comment on column public.knowledge_documents.ingested_by is
  'system para las fuentes automáticas de AI-07; human para documentos subidos manualmente a Conocimiento.';
;
