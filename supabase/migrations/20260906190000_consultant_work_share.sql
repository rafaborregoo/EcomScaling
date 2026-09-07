-- Reparto de trabajo entre los consultores de una misma tienda.
--
-- Es un peso relativo, no un porcentaje absoluto: el reparto normaliza sobre la
-- suma de los consultores activos de la organizacion. Asi 100/100 es 50/50 y
-- 100/0 manda todo al principal, sin ningun caso especial en el codigo.
--
-- 0 = no recibe tareas automaticas. Sigue viendo la tienda y puede trabajarla:
-- quitar el reparto no es quitar el acceso.
--
-- Default 100 para las filas existentes: una tienda con un solo consultor le
-- sigue asignando todo, que es lo que ya pasaba de hecho.
alter table public.consultant_assignments
  add column work_share smallint not null default 100
  check (work_share >= 0 and work_share <= 100);
