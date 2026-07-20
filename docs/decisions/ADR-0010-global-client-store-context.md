# ADR-0010: Contexto global de cliente/tienda activos

- **Fecha:** 2026-07-20
- **Estado:** Aprobada, con riesgo abierto (ver abajo)
- **Relacionada:** [`ADR-0012-memberships-virtuales.md`](ADR-0012-memberships-virtuales.md) — separada de
  esta decision el 2026-07-20 porque son dos decisiones independientes que pueden cambiar por separado
  (una es de frontend/estado de UI, la otra es de autorizacion backend); antes vivian mezcladas aqui.

## Contexto

Antes de esta decision, cada pagina mantenia su propio estado local de "organizacion seleccionada" y/o
"tienda seleccionada", con hasta 5 selectores duplicados por pantalla y comportamiento inconsistente al
navegar entre paginas.

## Decision

**Contexto global compartido**: `ActiveOrganizationContext` y `ActiveConnectionContext` (React Context)
alimentados por `PortalShell`, con seleccion persistida en `localStorage`
(`ecomscaling.activeOrganization`, `ecomscaling.activeConnectionByOrg`). Un unico selector de cliente y uno
de tienda en la mini barra de contexto del shell, no por pagina.

## Implementacion

`apps/web/src/components/active-organization.tsx`, `active-connection.tsx`, `portal-shell.tsx`.

## Consecuencias y riesgo abierto (sin resolver)

**localStorage como (casi) unica fuente de verdad**: un enlace compartido no reproduce el contexto de
quien lo abre; varias pestañas pueden quedar con contexto inconsistente; existe riesgo real de operar una
accion sobre el cliente equivocado si el contexto quedo obsoleto. Mitigacion parcial ya presente: varias
paginas soportan deep-link `?organizationId=...&connectionId=...` que no se pisa con el estado en vuelo
del shell — pero no es la via principal. **Pendiente**: evaluar mover el contexto a la URL como fuente
primaria (`/clientes/:organizationId/tiendas/:connectionId/...`), dejando `localStorage` como fallback de
conveniencia, no como unica fuente. Ver pregunta abierta correspondiente en `PREGUNTAS_ABIERTAS.md`.

## Historial relacionado

Detalle cronologico en `roadmap/roadmaps/03-frontend-ux/CHANGELOG-UX.md` (v2.3 y v2.4).
