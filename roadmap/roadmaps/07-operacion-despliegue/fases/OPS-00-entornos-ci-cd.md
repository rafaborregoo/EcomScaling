# OPS-00 - Entornos y CI/CD

## Estado

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** Q-001 (proveedor API/worker), Q-007 (Docker local)
- **Bloqueador:** ninguno tecnico, pero sin decision de Q-001 no hay staging real posible.
- **Evidencia:** `.github/workflows/ci.yml` (typecheck + build web + tests, sin lint — ver SQO-01),
  `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `.dockerignore` (**corregido 2026-07-22**: existen, ya
  no es un gap — la version anterior de esta seccion decia "sin Dockerfiles confirmados").
- **Lo que si existe**: local funciona contra Supabase remoto (sin Docker, ver Q-007), CI corre en cada
  push/PR con los tests reales de SQO-00/01, Dockerfiles de API y worker listos (copian `apps/web/package.json`
  explicitamente para que `npm ci` resuelva el workspace completo, ver nota en el propio Dockerfile).
- **Lo que no existe, confirmado, no solo "por documentar"**: no hay staging (ni entorno ni proveedor
  decidido, ver Q-001), no hay politica de migraciones escrita (expansion/contraccion, quien aplica,
  rollback), no hay matriz de secrets por entorno, y trabajar contra Supabase remoto directamente en
  local/tests tiene los riesgos ya documentados en SQO-01 (datos compartidos, migraciones accidentales,
  tests que interfieren entre si). Los Dockerfiles no se han probado corriendo un build real (`docker
  build`) en esta sesion, solo revisados por lectura.
- **Hallazgo real 2026-07-23** (ver `RB-005-failed-migration.md`, OPS-02): esta falta de politica de
  migraciones ya produjo drift real, no solo riesgo teorico -- 10 de las 46 migraciones locales tienen un
  timestamp de archivo distinto al que Supabase registro como version aplicada (`list_migrations` del
  proyecto real vs `ls supabase/migrations/`), probablemente por renombrarse tras aplicar para reordenar
  migraciones del mismo dia. El schema esta correcto (confirmado con la suite completa de tests), pero
  automatizar `supabase db push` en CI sin corregir antes este drift fallaria en el primer intento.
- **Siguiente accion real**: resolver Q-001 (proveedor de hosting API/worker) — sin eso no se puede crear
  un staging real, y sin staging no se puede cerrar ningun criterio de entrada al piloto (OPS-01).

## Entregables

- Local reproducible.
- Preview por PR.
- Staging con OAuth y secretos propios.
- Produccion con migraciones aprobadas.
- CI para lint, typecheck, tests, build y smoke.
- Dockerfiles de API y worker.
- `docker-compose.yml` de desarrollo para API, worker y Redis si se decide trabajar con Redis local.
- Estrategia de despliegue separada: web en Vercel o equivalente; API y worker como servicios persistentes.

## Criterios de cierre

- Clonar, instalar y arrancar local funciona con un comando documentado.
- Secrets separados por entorno.
- La API y el worker tienen una ruta clara a staging/produccion mediante contenedor.

## Decision Docker

- No se dockeriza Supabase gestionado.
- No se bloquea el MVP por Supabase local si se trabaja directamente contra el proyecto remoto.
- Si se necesita test local de DB/RLS, Supabase CLI requerira Docker Desktop.
- API y worker si deben tener Dockerfile antes del piloto MVP.
