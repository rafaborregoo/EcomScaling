-- Corrige un warning del linter de Supabase (function_search_path_mutable)
-- introducido por la migracion anterior: sin search_path fijo, la funcion es
-- vulnerable a hijacking via un schema malicioso antepuesto en el search_path
-- de la sesion. No cambia el comportamiento, solo lo hace inmune a eso.
alter function private.enum_labels(text) set search_path = public, private;
