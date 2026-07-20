# BE-01 - Identidad, tenancy y bootstrap

## Estado

- **Estado real:** `verification_pending` (el propio documento reconocia que faltan verificaciones en
  endpoints de negocio — no cumple su propio criterio de cierre).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - `AuthContext` implementado en `apps/api/src/auth-context.ts`; endpoint `GET /v1/bootstrap`.
  - Ampliacion 2026-07-20: `resolveAuthContext` materializa **memberships virtuales** para acceso
    multi-cliente sin membership real — `platform_admin` recibe todas las organizaciones y `consultant`
    sus `consultant_assignments` activas, ambas con `role: "consultant"`. RLS ya cubria este acceso via
    `private.can_access_org`.
  - Seed operativo con usuario admin/cliente reales para pruebas manuales.
- **Riesgo de diseno abierto (sin resolver, ver `PREGUNTAS_ABIERTAS.md`):** un consultor asignado no es
  realmente un miembro de la organizacion. Materializarlo como membership virtual simplifica el checkeo
  uniforme pero puede confundir permisos, hacer que la UI lo trate como miembro interno, mezclar rol de
  plataforma con rol de organizacion, y complicarse cuando aparezcan mas tipos de acceso (p. ej. un
  auditor de solo lectura). Alternativa mas limpia: que `AuthContext` devuelva
  `{ organizationId, accessSource: "membership" | "consultant_assignment" | "platform_admin",
  organizationRole?, platformRole, permissions[] }` — uniformar el **contrato de acceso**, no la
  **identidad de la relacion**. No implementado todavia; es un cambio de contrato, no un parche.
- **Gaps identificados:**
  - Validacion de organizacion activa no extendida a todos los endpoints de negocio (solo
    bootstrap/listado consultor la tenian completa en origen).
  - Sin test de invalidacion inmediata al suspender una `consultant_assignment` en caliente.
  - Sin test de "organizacion activa manipulada" (un cliente que fuerza `organizationId` de otra org).
  - UUIDs concretos de seed en la documentacion sin etiquetar claramente como datos sinteticos.
- **Siguiente accion:** decidir si se migra a `OrganizationAccess` tipado (ver riesgo de diseno) antes de
  seguir anadiendo superficie que dependa de memberships virtuales.

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
