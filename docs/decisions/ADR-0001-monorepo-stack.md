# ADR-0001 - Monorepo y stack inicial

## Estado

Aprobada.

## Decision

Usar un monorepo TypeScript con npm workspaces:

- `apps/web`: Next.js App Router.
- `apps/api`: Fastify.
- `apps/worker`: proceso separado para jobs.
- `packages/*`: contratos, dominio, integraciones, IA, DB, UI, observabilidad y configuracion compartida.
- `supabase/`: migraciones y tests SQL.

## Motivo

El roadmap exige separar web, API y jobs sin duplicar contratos ni tipos. npm workspaces evita depender de `pnpm` global, que no esta instalado en esta maquina.

## Consecuencias

- Las operaciones sensibles pasan por API/worker.
- El frontend solo usa Supabase para Auth y lecturas autorizadas por RLS.
- Las migraciones Supabase se versionan en el repo.

