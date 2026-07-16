# BE-01 - Identidad, tenancy y bootstrap

## Objetivo

Resolver usuario, rol, organizacion activa y permisos en backend.

## Entregables

- `AuthContext`. Estado: implementado inicialmente en `apps/api/src/auth-context.ts`.
- Endpoint `bootstrap`. Estado: implementado en `GET /v1/bootstrap`.
- Servicios de onboarding, activacion, suspension, membresias y asignaciones.
- Endpoints de panel consultor para clientes. Estado: primer endpoint `GET /v1/consultant/organizations`.

## Avance 2026-07-15

- Seed operativo para usuario admin y usuario cliente normal.
- Usuario cliente `40e2d772-02d3-4884-b8b6-755c22c0b561` queda con `platform_role=user`, organizacion propia y suscripcion activa.
- Admin `95ca12f1-72b1-474c-ab53-73320f78d6a3` queda asignado como consultor principal del cliente demo.
- El endpoint consultor rechaza usuarios normales y lista organizaciones para `platform_admin`/`consultant`.

## Criterios de cierre

- La API no acepta `organization_id` libre sin verificar autorizacion. Estado: cubierto en bootstrap/listado consultor; falta extender a endpoints de negocio.
- Suspension corta acceso.
- El panel consultor solo opera organizaciones asignadas o admin. Estado: implementado en listado inicial; faltan acciones operativas.
