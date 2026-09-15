-- AI-04/admin-conocimiento: knowledge_documents solo guardaba el chunking
-- (knowledge_chunks), nunca el texto original -- no habia forma de "ver bien"
-- un documento entero en el panel, solo su ficha (titulo/estado/autoridad).
-- Se guarda el contenido completo junto al documento; el chunking para
-- embeddings sigue igual, esto no lo sustituye.

alter table public.knowledge_documents add column if not exists content text;

-- Backfill de lo ya ingerido: reconstruye el contenido concatenando sus
-- chunks en orden. No es byte-a-byte identico al original (el chunking
-- repite el titulo de seccion en cada trozo que la cruza), pero es fiel al
-- contenido y de sobra para leerlo -- la alternativa era dejar sin texto
-- todo lo ingerido antes de este cambio.
update public.knowledge_documents d
set content = backfill.joined
from (
  select document_id, string_agg(content, e'\n\n' order by chunk_index) as joined
  from public.knowledge_chunks
  group by document_id
) as backfill
where backfill.document_id = d.id
  and d.content is null;
