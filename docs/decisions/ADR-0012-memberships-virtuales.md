# ADR-0012: Memberships virtuales para acceso de consultor

- **Fecha:** 2026-07-20
- **Estado:** Aprobada, con riesgo abierto (ver abajo)
- **Relacionada:** separada de [`ADR-0010-global-client-store-context.md`](ADR-0010-global-client-store-context.md)
  el 2026-07-20 — misma sesion de trabajo, pero decision independiente (autorizacion backend, no estado de
  UI) que puede revisarse sin tocar el contexto global de cliente/tienda.

## Contexto

Un consultor no tiene una fila real en `organization_members` para las organizaciones que atiende — solo
una fila en `consultant_assignments`. El backend necesitaba una forma uniforme de autorizar acceso a una
organizacion sin que cada endpoint tuviera que distinguir si el acceso viene de una membership real, de una
asignacion de consultor o de ser `platform_admin`.

## Decision

`resolveAuthContext` materializa un membership sintetico ("virtual") para `platform_admin` (todas las
organizaciones) y `consultant` (sus `consultant_assignments` activas), de forma que el resto del backend
autoriza acceso de forma uniforme sin distinguir el origen.

## Implementacion

`apps/api/src/auth-context.ts` (`resolveAuthContext`).

## Consecuencias y riesgo abierto (resuelto parcialmente 2026-07-28)

Las memberships virtuales mezclan dos fuentes de acceso distintas (membership real vs
`consultant_assignment`) bajo una misma forma de dato. **Cerrado 2026-07-28 (Q-008)**: se anadio
`Membership.accessSource: "membership" | "consultant_assignment" | "platform_admin"` en
`apps/api/src/auth-context.ts` -- cada entrada de `AuthContext.memberships` ahora declara su origen real,
verificado con `auth-context-access-source.test.ts` (3/3 contra Supabase remoto real). Decision deliberada:
se resolvio el riesgo real (indistinguibilidad de origen) con un campo aditivo, sin migrar a un tipo
`OrganizationAccess` completo con `permissions[]` -- esa reestructuracion mas amplia seguia sin
justificarse por ningun bug real, solo por limpieza de diseño, y el cambio aditivo no rompe ningun
consumidor existente (`role`/`organization_id` se siguen leyendo igual).

## Historial relacionado

Detalle cronologico en `roadmap/roadmaps/03-frontend-ux/CHANGELOG-UX.md` (v2.2).
