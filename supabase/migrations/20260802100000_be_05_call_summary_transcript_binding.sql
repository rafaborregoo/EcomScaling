-- BE-05: liga cada resumen a la transcripcion exacta que lo originó.
-- La columna es nullable para conservar resúmenes históricos creados antes de
-- esta migración; los nuevos flujos manual/A01 siempre la rellenan.
alter table public.call_ai_summaries
  add column if not exists transcript_id uuid references public.call_transcripts(id) on delete set null;

create index if not exists call_ai_summaries_transcript_id_idx
  on public.call_ai_summaries(transcript_id);

comment on column public.call_ai_summaries.transcript_id is
  'Transcripcion exacta que originó el resumen; nullable para filas históricas anteriores a BE-05.';
