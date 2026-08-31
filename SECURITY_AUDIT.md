# Auditoria de seguridad EcomScaling

Fecha: 2026-08-31. Alcance: API, web, worker, Supabase, agentes IA, RLS,
permisos, secretos, CI/CD y dependencias.

## Resultado ejecutivo

La auditoria de codigo esta implementada. El proyecto tiene parser AST y
allowlist para el SQL Gateway, aislamiento multi-tenant, RLS, clientes
Supabase ligados al token, aprobacion humana, presupuestos, circuit breaker,
trazabilidad de herramientas y sanitizacion de errores.

La evidencia remota confirma que el destino es el proyecto de produccion
`cthjwpeygpzwdmjkxeqa` y que no existe staging. Por seguridad, no se han
aplicado migraciones ni ejecutado pruebas mutantes sobre produccion.

## Hallazgos implementados

### SEC-001 - Regresion de privilegios del SQL Gateway

Severidad: alta. Estado: corregido en el worktree; pendiente de aplicar y
verificar en Supabase.

Se anadio `supabase/migrations/20260901140000_security_audit_gateway_hardening.sql`.
La definicion final conserva el guard de coste, limite de filas, timeouts y
`search_path` fijo; usa `SECURITY INVOKER`, ejecuta `SET LOCAL ROLE ai_gateway`
antes del SQL dinamico y revoca ejecucion a `PUBLIC`, `anon` y `authenticated`,
dejando solo `service_role`.

### SEC-002 - Canje no atomico de invitaciones

Severidad: media. Estado: corregido en el worktree; pendiente de prueba
concurrente remota.

El canje actualiza con `status = 'pending'`, comprueba el error y devuelve
conflicto si no reclama ninguna fila. La ruta publica tiene un limite dedicado
de 10 peticiones por minuto y por IP. El hash del codigo queda como mejora
opcional; no se registra ni devuelve el codigo en errores.

### SEC-003 - Verificacion remota incompleta

Severidad: media. Estado: pendiente de un destino seguro.

El proyecto confirmado es `cthjwpeygpzwdmjkxeqa`, ACTIVE_HEALTHY, en
`eu-west-3`, sin branches ni proyecto de staging. `test:remote` bloquea
correctamente las mutaciones cuando test y produccion coinciden. Los advisors
remotos estan recogidos en `SECURITY_AUDIT_EVIDENCE.md`.

### SEC-004 - Search paths mutables en funciones

Severidad: media. Estado: aplicado en produccion; pendiente de confirmar con
advisors post-migracion.

Las migraciones `20260901150000_security_audit_advisor_hardening.sql` y
`20260901160000_security_audit_activity_digest_hardening.sql` fijan el
`search_path` de las 22 funciones reportadas por el advisor, sin cambiar sus
grants. Los helpers `SECURITY DEFINER` privados usados por RLS se mantienen
intencionadamente: ya tienen `search_path = ''`, `PUBLIC` revocado y necesitan
ser ejecutables por `authenticated` para que funcionen las politicas RLS.

La proteccion de contrasenas filtradas de Auth (HIBP) debe activarse en el
panel de Supabase; no es una migracion segura para aplicar silenciosamente.

## Cobertura y evidencia

| Area | Evidencia | Resultado |
|---|---|---|
| SQL injection Node | `apps/api/src/sql-gateway.ts` y tests | 33/33 casos locales |
| SQL dinamico DB | migracion final `agent_sql_gateway` | hardening anadido; falta runtime |
| RLS | guard `assert-rls-coverage.mjs` | 103/103 habilitadas; 2 tablas internas clasificadas |
| Tenant isolation | auth context, guards y tests | correcto en codigo; falta staging |
| Agentes | tools allowlist, approval, budgets, circuit breaker | controles presentes |
| Prompt injection | contexto no confiable tratado como datos | tests locales correctos |
| Secretos | `.env.local` no versionado, sin literales detectados | sin hardcode detectado |
| Dependencias | `npm audit --omit=dev` | 0 vulnerabilidades |
| Contenedores | Dockerfiles API/worker | usuario no root |
| CI/CD | Gitleaks, Trivy, SBOM, dependency review y guard del gateway | CI principal activo en main y PR |
| Advisors Supabase | `SECURITY_AUDIT_EVIDENCE.md` | 34 seguridad y 166 rendimiento revisados |

## Verificaciones ejecutadas

- Suite unitaria API: **74/74 correctas**.
- Matriz SQL Gateway/BE-07: **33/33 correctas**.
- Typecheck y build de todos los workspaces: **correcto**.
- Lint del monorepo: **0 errores**, con 47 warnings de React existentes.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**.
- `git diff --check`: **correcto**.
- Guard de precedencia del SQL Gateway: **correcto**, escanea las 5 definiciones
  de migracion y valida la ultima.
- Guard de cobertura RLS: **correcto**, 103/103 tablas habilitadas.
- Guard de funciones SQL: **correcto**, 22/22 `search_path` endurecidos.
- Analisis estatico previo: 103/103 tablas publicas con RLS.

## Pendientes de despliegue

1. Ejecutar advisors de seguridad post-migracion para confirmar que
   `organization_activity_digest` desaparece de
   `function_search_path_mutable`.
2. Ejecutar `test:remote`, advisors de seguridad y pruebas de RLS, permisos,
   aislamiento cross-tenant y gateway.
3. Repetir la prueba concurrente de redencion de invitaciones en staging.
4. Activar HIBP en Auth → Password security.
5. Revisar/rotar credenciales de `.env.local` si el workspace fue compartido.
6. Revisar las migraciones nuevas no versionadas antes de desplegarlas.

El historial local/remoto queda alineado con los identificadores reales
`20260831082735`, `20260831082802` y `20260831082831`. `npx supabase db push`
aplico correctamente las dos migraciones de hardening nuevas. El aviso de
Docker solo impidio cachear el catalogo local; no impidio aplicar las
migraciones.

Los avisos de rendimiento (71 FKs sin indice, 72 indices no usados, 22
politicas permisivas y 1 indice duplicado) no se han modificado
automaticamente: requieren validar carga y semantica en staging para no
romper consultas ni autorizacion.
