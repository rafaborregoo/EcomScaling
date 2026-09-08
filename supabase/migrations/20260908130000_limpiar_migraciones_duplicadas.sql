-- Limpieza del registro de migraciones: dos filas fantasma.
--
-- Que paso. `store_scope_meta_klaviyo` y `store_limit_pricing` se aplicaron dos
-- veces a produccion: primero via MCP `apply_migration`, que le pone al fichero
-- una marca de tiempo automatica (20260907145539 y 20260907150124), y despues
-- via `npm run db:push`, que lo registra con el numero del fichero del repo
-- (20260907210000 y 20260907220000). Mismo SQL, cuatro filas.
--
-- Por que no rompio nada. Las dos migraciones son idempotentes de fabrica
-- (`add column if not exists`, `create or replace function`), asi que la
-- segunda pasada no hizo nada. El esquema es correcto; lo que esta mal es la
-- contabilidad.
--
-- Por que hay que arreglarlo. `report-supabase-migration-drift` compara los
-- ficheros del repo con las filas de la tabla, y esas dos filas no tienen
-- fichero: la guarda reporta "remoteOnly" para siempre y deja de servir para
-- detectar una desviacion de verdad. Una alarma que siempre suena no es una
-- alarma.
--
-- Cual de las dos parejas se borra. Las de MCP. Las que se quedan son las que
-- llevan el numero del fichero que existe en el repo, que es la unica pareja
-- que un entorno nuevo va a poder reproducir.
--
-- Esto NO toca ningun objeto del esquema: solo la tabla de control. En una base
-- limpia estas filas no existen y el delete no hace nada.

delete from supabase_migrations.schema_migrations
where version in ('20260907145539', '20260907150124')
  -- Guarda: solo se borra el duplicado si la fila buena sigue ahi. Si alguien
  -- llega aqui con un historial distinto, esta migracion no hace nada en vez
  -- de dejar la migracion sin registrar en ninguna de sus dos formas.
  and exists (
    select 1
    from supabase_migrations.schema_migrations keep
    where keep.version in ('20260907210000', '20260907220000')
  );
