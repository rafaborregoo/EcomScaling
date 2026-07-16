# OPS-00 - Entornos y CI/CD

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
