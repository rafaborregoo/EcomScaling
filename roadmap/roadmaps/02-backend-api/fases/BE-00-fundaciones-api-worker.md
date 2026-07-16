# BE-00 - Fundaciones API y worker

## Objetivo

Tener procesos arrancables y verificables antes de implementar negocio.

## Entregables

- API Fastify con healthcheck.
- Env schema tipado.
- Error handler y catalogo inicial de errores.
- Request ID y logging JSON.
- Middleware JWT Supabase basico.
- Worker con cola, healthcheck y job de prueba idempotente.
- Dockerfile para `apps/api`.
- Dockerfile para `apps/worker`.
- Imagenes preparadas para despliegue en servicio persistente.

## Criterios de cierre

- API y worker arrancan localmente.
- CI ejecuta lint, typecheck, tests y build.
- No hay secretos en logs ni frontend.
- API y worker pueden construirse como contenedores sin depender de archivos fuera del monorepo.
