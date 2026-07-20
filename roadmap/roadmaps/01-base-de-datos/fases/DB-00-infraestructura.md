# DB-00 - Infraestructura Supabase

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123324_db_00_infraestructura.sql`, aplicada en remoto el 2026-07-15 (`supabase db push --linked`).
  - `pgcrypto` ya existia en el proyecto remoto; la migracion lo omitio correctamente con `if not exists`.
- **Gaps identificados:**
  - No existe un test que valide que `private` es inaccesible para `anon`/`authenticated` (criterio de cierre declarado pero sin prueba: no hay ningun archivo en `apps/api/src` que verifique privilegios de schema).
  - No esta documentado en que schema se instala cada extension ni el `search_path` seguro para funciones `SECURITY DEFINER`.
  - La decision de `vector` quedo "solo si se activa RAG": ya se activo (ver DB-11), este documento no lo refleja.
- **Siguiente accion:** escribir un test que confirme `anon`/`authenticated` sin `USAGE`/`CREATE` sobre `private`, y actualizar la decision de `vector`.

## Objetivo

Preparar la base tecnica para migraciones futuras sin introducir tablas de negocio todavia.

## Entregables

- Schema `private`.
- Extension `pgcrypto`.
- Extension `vector` solo si se activa RAG; si no, dejar decision documentada.
- Funcion comun `set_updated_at`.
- Permisos base de schemas.
- Carpeta de tests SQL preparada.

## Dependencias

- Monorepo y Supabase local inicializados.
- Decision de convenciones SQL aprobada.

## Criterios de cierre

- Las migraciones corren desde una base vacia.
- `private` no es accesible por `anon` ni `authenticated`.
- Existe una prueba minima que valida permisos de schema.
