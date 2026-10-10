-- Integraciones: cierra la escritura directa y prepara la busqueda del state.
--
-- 1. integration_connections solo se escribe desde la API con service role
--    (ADR-0006 pto 7). La politica "write_managers" y el grant de
--    insert/update permitian a un owner/manager crear o cambiar conexiones
--    desde el navegador con la clave publica: sembrar una conexion pendiente
--    de cualquier dominio, saltarse el limite de tiendas o marcar una
--    conexion como conectada. Toda escritura de la API ya va por service role.
drop policy if exists "integration_connections_write_managers" on public.integration_connections;
revoke insert, update, delete on public.integration_connections from authenticated;

-- 2. Los callbacks OAuth buscan la conexion pendiente por su state. Meta lo
--    buscaba entre las 20 conexiones mas recientes de toda la plataforma: con
--    trafico, un state bueno no se encontraba. Indice parcial sobre el state.
create index if not exists integration_connections_oauth_state_idx
  on public.integration_connections ((metadata->>'state'))
  where metadata ? 'state';
