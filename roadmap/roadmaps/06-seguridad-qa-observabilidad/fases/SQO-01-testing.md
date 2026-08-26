# SQO-01 - Testing

> **Evidencia API vigente 2026-08-24:** la suite contractual unitaria ejecutada directamente con
> `npx tsx --test --test-force-exit` pasa 53/53. Las cifras inferiores de suites históricas no deben
> usarse para evaluar el estado actual.

> **Lint web vigente 2026-08-24:** `npx eslint .` ejecutado desde `apps/web` termina sin errores y
> deja 13 warnings de hooks React conocidos. Se mantienen como advertencias para no bloquear el flujo
> de fetch-on-mount; no se afirma que el lint tenga cero warnings.

> **Correccion canonica 2026-08-24:** el workflow CI manual ejecuta `npm run lint`, ademas de
> typecheck, build, tests, SBOM y Trivy. La suite vigente del SQL Gateway pasa 31/31; las cifras
> inferiores sobre 28 casos, 60 tests o lint ausente son historicas y quedan supersedidas.

> **Corrección vigente 2026-08-26:** la cobertura de IA ya no es una referencia
> genérica. `agent-eval-dataset.ts` contiene un dataset versionado para los diez
> agentes, `agent-eval-runner.ts` ejecuta la matriz offline y `release-gate.ts`
> puede rechazar versiones con agentes sin evaluar o con fallos. La persistencia
> de evidencia y los modos `shadow`/`live` están preparados; la validación con
> proveedor real sigue siendo externa a este entorno.

## Estado

> Verificacion vigente 2026-08-24: el workflow manual de CI incluye typecheck,
> lint, build web, tests de API/AI/worker/config/integraciones/observabilidad,
> SBOM y Trivy. El typecheck directo de API y web pasa en esta ronda. Siguen
> pendientes, honestamente, Postgres aislado por PR, contract fixtures de
> proveedores, carga y validacion visual asistiva.

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** SQO-00
- **Evidencia:** `.github/workflows/ci.yml`, `apps/api/src/sql-gateway.test.ts` (31 casos),
  `apps/api/src/rls-tenant-isolation.test.ts` (19 casos), `packages/ai/src/index.test.ts` (50 casos).
  **Ampliado 2026-07-22**: 4 archivos de test mas en `apps/api` (ver SQO-00 para el detalle por dominio) —
  total histórico 60 tests en `apps/api` (verificado con `test:remote` en un proyecto aislado), no solo los dos
  archivos citados antes en esta seccion.
- **Correccion a una afirmacion previa de este documento**: decia que CI bloquea "lint, tipos, tests y
  build". **Verificado en `ci.yml`: no hay ningun paso `npm run lint`** — solo `npm run typecheck`
  (que en `apps/api/package.json` el script `lint` es en realidad un alias de `tsc --noEmit`, no un
  linter real) y build de web. `apps/web` si tiene ESLint real configurado, pero CI no lo ejecuta. Lint no
  esta bloqueando nada hoy.
- **Lo que ya funciona**: 82 tests en verde en CI (60 en `apps/api` — RLS, validador SQL Gateway, aislamiento
  tenant de RPC, permisos de `private`, idempotencia de webhooks, aislamiento del RAG — + 22 guarda de
  calidad IA en `packages/ai`), priorizando correctamente las piezas de mayor riesgo de seguridad del
  proyecto (RLS multi-tenant y el validador que es la unica barrera entre "el modelo escribe SQL" y la DB
  real).
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
  - La ejecución live/shadow de evals requiere proveedores y datos reales; la matriz offline y el
    quality gate local ya están implementados (AI-17, AI-20, AI-21, AI-25, AI-27).
- **`npm run lint` anadido a CI 2026-07-22**: los 12 errores reales eran todos la misma causa raiz, no 9
  bugs distintos — `react-hooks/set-state-in-effect` (regla nueva del plugin, parte de la preparacion para
  React Compiler) marca como error el patron estandar "fetch-on-mount" (una funcion async invocada desde
  `useEffect` que llama `setIsLoading(true)` como primera linea, antes de cualquier `await`) que usan
  practicamente todas las paginas de este repo para cargar datos al montar. No hay alternativa estable hoy
  (`useEffectEvent` sigue siendo experimental) sin reescribir el patron de fetching de 9 archivos por una
  regla de estilo sin bug de correctitud detras. Se bajo la regla a `warning` en
  `apps/web/eslint.config.mjs` (documentado ahi el porque) en vez de forzar un refactor de comportamiento;
  los 22 warnings (12 de esta regla + 10 de `exhaustive-deps`, ya existentes) quedan visibles pero no
  bloquean CI. `npm run lint` (que ya corria en todos los workspaces via `--workspaces --if-present`, solo
  no estaba en `ci.yml`) esta ahora en el pipeline y sale en verde.
- **Siguiente accion**: decidir si se justifica un Postgres/Supabase aislado por PR antes de seguir sumando
  tests contra el remoto; revisar individualmente los 12 sitios marcados `warning` cuando `useEffectEvent`
  sea estable, o si aparece un bug real de cascading renders en alguno de ellos.

## Entregables

- Unit tests para motores y mapeadores.
- Tests SQL/RLS.
- Contract tests de APIs externas con fixtures.
- Worker tests de idempotencia y reintentos.
- Playwright para flujos principales.
- IA evals para agentes.

## Criterios de cierre

- CI bloquea lint, tipos, tests y build — **cumplido 2026-07-22** (`ci.yml`: typecheck, lint, tests de
  `@ecomscaling/ai`/`@ecomscaling/api`, build de web).
- Cada fase tiene pruebas proporcionales al riesgo.

## Actualizacion 2026-08-01

- CI incorpora `dependency-scan` con `npm audit --omit=dev --audit-level=high` y `dependency-review` para pull requests.
- El CI manual ya genera SBOM y escanea las imagenes Docker de API/worker con Trivy. Sigue pendiente un entorno Supabase/Postgres aislado por PR; no se simula como cerrado.

## Correccion de estado 2026-08-02

El pipeline normal ya no ejecuta tests RLS con fixtures: ejecuta tests unitarios/contractuales del API sin
escribir en ninguna base de datos. Los tests RLS siguen disponibles en el suite completo, pero requieren un
entorno aislado y deben ejecutarse manualmente cuando exista staging; nunca contra produccion.
