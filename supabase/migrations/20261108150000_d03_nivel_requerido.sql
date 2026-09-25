-- D03: el nivel que ESTE negocio necesita de cada capacidad.
--
-- Decision de producto del 2026-09-24: lo fija el consultor por tienda en el
-- panel de madurez. El apartado 19 del artefacto no define algoritmo para
-- derivarlo, asi que es un juicio declarado y vive con el resto de lo que
-- declara el consultor. Con el, maturity-engine calcula la brecha
-- (critically_behind / structural_weakness / appropriate / overengineering).
--
-- Idempotente (CLAUDE.md).

alter table public.capability_maturity_declarations
  add column if not exists required_level varchar(16);

alter table public.capability_maturity_declarations
  drop constraint if exists capability_maturity_declarations_nivel_requerido;
alter table public.capability_maturity_declarations
  add constraint capability_maturity_declarations_nivel_requerido check (
    required_level is null or required_level in (
      'absent', 'ad_hoc', 'repeatable', 'defined', 'measured', 'optimized', 'adaptive'
    )
  );

comment on column public.capability_maturity_declarations.required_level is
  'Lo que este negocio necesita de la capacidad, declarado por el consultor. Null = nadie lo ha dicho, y entonces no hay brecha.';
