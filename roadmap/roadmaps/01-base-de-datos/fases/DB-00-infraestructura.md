# DB-00 - Infraestructura Supabase

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

## Implementacion actual

- Migracion creada: `supabase/migrations/20260715123324_db_00_infraestructura.sql`.
- Aplicada en Supabase remoto el 2026-07-15 mediante `supabase db push --linked`.
- Nota: `pgcrypto` ya existia en el proyecto remoto; la migracion lo omitio correctamente con `if not exists`.
