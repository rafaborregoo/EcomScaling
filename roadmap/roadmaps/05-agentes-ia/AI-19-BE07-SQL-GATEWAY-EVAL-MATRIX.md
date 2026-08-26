# AI-19 / BE-07 - Matriz de evals del SQL Gateway

## Estado

`implemented`: la matriz offline vive en
`apps/api/src/be-07-sql-gateway-evals.test.ts` y se ejecuta antes de cualquier
RPC o acceso a Supabase.

## Cobertura

- Analitica segura con joins, agregaciones y CTE.
- Escrituras directas, ocultas en CTE y sentencias apiladas.
- Acceso cross-schema a `public`, `auth` y `private`.
- Abuso de recursos (`pg_sleep`, `generate_series`, recursion) y `dblink`.
- SQL no parseable y funciones peligrosas cualificadas.

No sustituye los tests remotos de tenant/RLS: comprueba la primera frontera AST,
mientras la RPC y las vistas `ai.*` siguen siendo la segunda frontera.
