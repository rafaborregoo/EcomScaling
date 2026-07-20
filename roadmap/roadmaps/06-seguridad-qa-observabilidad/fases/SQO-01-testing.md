# SQO-01 - Testing

## Estado

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** SQO-00
- **Evidencia:** `.github/workflows/ci.yml`, `apps/api/src/sql-gateway.test.ts` (28 casos),
  `apps/api/src/rls-tenant-isolation.test.ts` (11 casos), `packages/ai/src/index.test.ts` (15 casos).
- **Correccion a una afirmacion previa de este documento**: decia que CI bloquea "lint, tipos, tests y
  build". **Verificado en `ci.yml`: no hay ningun paso `npm run lint`** — solo `npm run typecheck`
  (que en `apps/api/package.json` el script `lint` es en realidad un alias de `tsc --noEmit`, no un
  linter real) y build de web. `apps/web` si tiene ESLint real configurado, pero CI no lo ejecuta. Lint no
  esta bloqueando nada hoy.
- **Lo que ya funciona**: 54 tests en verde en CI (11 RLS + 28 validador SQL Gateway + 15 guarda de calidad
  IA), priorizando correctamente las dos piezas de mayor riesgo de seguridad del proyecto (RLS multi-tenant
  y el validador que es la unica barrera entre "el modelo escribe SQL" y la DB real).
- **Riesgo de diseño de CI, no solo cobertura**: los tests RLS corren **contra el Supabase remoto real** en
  cada push/PR (crean y borran organizaciones/usuarios efimeros ahi mismo) — funciona como smoke test, pero
  como base principal de CI implica dependencia de red, lentitud, riesgo de residuos y coste creciente con
  cada PR. No hay un Postgres/Supabase aislado por CI run con migraciones desde cero.
- **Gaps reales confirmados, no solo "amplio pendiente"**:
  - Sin test de migraciones desde base vacia (aplicar todas, seed, drift de tipos) ni de actualizacion
    incremental.
  - Sin unit tests de motores deterministas (financiero, alertas, stock, ROAS/CAC) mas alla del SQL
    Gateway.
  - Sin contract tests de Shopify/Meta/Klaviyo/Fathom con fixtures versionadas.
  - Sin tests del worker (retry, backoff, idempotencia, lock, dead-letter).
  - Sin Playwright ni pruebas de carga/resiliencia.
  - AI-06 (evals de agentes) sigue como referencia generica en este archivo — enlazar a los datasets y
    quality gates concretos cuando existan (ver AI-06).
- **Siguiente accion**: anadir `npm run lint` a `ci.yml` (correccion de una linea, ya hay scripts) y decidir
  si se justifica un Postgres/Supabase aislado por PR antes de seguir sumando tests contra el remoto.

## Entregables

- Unit tests para motores y mapeadores.
- Tests SQL/RLS.
- Contract tests de APIs externas con fixtures.
- Worker tests de idempotencia y reintentos.
- Playwright para flujos principales.
- IA evals para agentes.

## Criterios de cierre

- CI bloquea lint, tipos, tests y build.
- Cada fase tiene pruebas proporcionales al riesgo.
