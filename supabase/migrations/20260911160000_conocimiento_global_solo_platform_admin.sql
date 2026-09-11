-- El conocimiento global (metodologia de EcomScaling, visibility = 'global',
-- organization_id null) solo debe leerlo un platform admin. El corte estaba
-- SOLO en Node (listKnowledgeDocuments/searchKnowledge descartan lo global
-- para quien no es platform_admin); en la base, las policies dejaban:
--
--   knowledge_documents: visibility = 'global'   -> cualquier authenticated
--   knowledge_chunks:    organization_id is null -> cualquier authenticated
--
-- Es decir: una cuenta cliente con su propio token podia leer el texto
-- integro de nuestra metodologia contra PostgREST, saltandose la API.
--
-- El retrieval del copiloto NO se ve afectado: searchKnowledge usa el service
-- role (createServiceClient), que no pasa por RLS. El conocimiento global
-- sigue alimentando a los agentes de todos los clientes; lo que se corta es
-- la lectura directa del corpus.

drop policy if exists "knowledge_documents_select_visible" on public.knowledge_documents;
create policy "knowledge_documents_select_visible" on public.knowledge_documents for select to authenticated
using (
  (visibility::text = 'global'::text and (select private.is_platform_admin()))
  or (
    organization_id is not null
    and organization_id in (select private.accessible_org_ids())
  )
);

drop policy if exists "knowledge_chunks_select_visible" on public.knowledge_chunks;
create policy "knowledge_chunks_select_visible" on public.knowledge_chunks for select to authenticated
using (
  (organization_id is null and (select private.is_platform_admin()))
  or organization_id in (select private.accessible_org_ids())
);
