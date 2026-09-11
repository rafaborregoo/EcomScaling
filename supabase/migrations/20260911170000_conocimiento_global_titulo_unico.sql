-- El conocimiento global no tenia ninguna restriccion de unicidad, asi que el
-- mismo documento podia entrar dos veces. El dedupe vivia solo en el script de
-- ingesta, que lee la lista de existentes UNA vez al arrancar: dos ingestas
-- solapadas leen las dos una lista vieja y meten el mismo documento por
-- duplicado (paso de verdad: 8 documentos y 222 chunks repetidos).
--
-- Un corpus con el documento duplicado no falla ruidosamente, se degrada: la
-- busqueda reparte la similitud entre dos copias del mismo texto y gasta dos
-- de los 8 huecos de resultados en decir lo mismo.
--
-- ADR-0006 punto 1: estado actual = tabla con unicidad, no dedupe en el
-- llamador. Parcial a proposito:
--  - solo `global`, porque la memoria acumulativa (visibility 'organization')
--    genera titulos a partir del contenido y ahi repetir es legitimo;
--  - fuera 'archived' y 'superseded', porque reingestar un documento consiste
--    justo en archivar el viejo y crear uno nuevo con el mismo titulo.

create unique index if not exists knowledge_documents_global_titulo_unico
  on public.knowledge_documents (title)
  where visibility = 'global' and status in ('pending_indexing', 'active');
