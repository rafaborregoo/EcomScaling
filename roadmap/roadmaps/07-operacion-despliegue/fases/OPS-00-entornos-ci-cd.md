# OPS-00 - Entornos y CI/CD

## Estado

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** Q-001 (proveedor API/worker), Q-007 (Docker local)
- **Bloqueador:** ninguno tecnico, pero sin decision de Q-001 no hay staging real posible.
- **Evidencia:** `.github/workflows/ci.yml` (typecheck + build web + tests, sin lint — ver SQO-01), sin
  Dockerfiles confirmados para `apps/api`/`apps/worker` (gap ya documentado en BE-00).
- **Lo que si existe**: local funciona contra Supabase remoto (sin Docker, ver Q-007), CI corre en cada
  push/PR con los tests reales de SQO-00/01.
- **Lo que no existe, confirmado, no solo "por documentar"**: no hay staging (ni entorno ni proveedor
  decidido, ver Q-001), no hay Dockerfiles de API/worker, no hay politica de migraciones escrita
  (expansion/contraccion, quien aplica, rollback), no hay matriz de secrets por entorno, y trabajar contra
  Supabase remoto directamente en local/tests tiene los riesgos ya documentados en SQO-01 (datos
  compartidos, migraciones accidentales, tests que interfieren entre si).
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
