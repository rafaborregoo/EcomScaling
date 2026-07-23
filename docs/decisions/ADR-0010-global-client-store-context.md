# ADR-0010: Contexto global de cliente/tienda activos

- **Fecha:** 2026-07-20 (riesgo resuelto 2026-07-21, ver abajo)
- **Estado:** Aprobada
- **Relacionada:** [`ADR-0012-memberships-virtuales.md`](ADR-0012-memberships-virtuales.md) — separada de
  esta decision el 2026-07-20 porque son dos decisiones independientes que pueden cambiar por separado
  (una es de frontend/estado de UI, la otra es de autorizacion backend); antes vivian mezcladas aqui.

## Contexto

Antes de esta decision, cada pagina mantenia su propio estado local de "organizacion seleccionada" y/o
"tienda seleccionada", con hasta 5 selectores duplicados por pantalla y comportamiento inconsistente al
navegar entre paginas.

## Decision

**Contexto global compartido**: `ActiveOrganizationContext` y `ActiveConnectionContext` (React Context)
alimentados por `PortalShell`. **Fuente primaria: la URL** (`?organizationId=&connectionId=`, decidido
2026-07-21); `localStorage` (`ecomscaling.activeOrganization`, `ecomscaling.activeConnectionByOrg`) es el
fallback cuando se navega sin esos params. Un unico selector de cliente y uno de tienda en la mini barra de
contexto del shell, no por pagina.

## Implementacion

`apps/web/src/components/active-organization.tsx`, `active-connection.tsx`, `portal-shell.tsx`.

## Consecuencias y riesgo (resuelto 2026-07-21)

Riesgo original: **localStorage como (casi) unica fuente de verdad** — un enlace compartido no reproducia
el contexto de quien lo abria; existia riesgo real de operar una accion sobre el cliente equivocado si el
contexto quedaba obsoleto. Resuelto (Q-010, decision de Rafa): `PortalShell` ahora prioriza
`?organizationId=&connectionId=` sobre `localStorage` en cada resolucion de contexto, y escribe la URL al
seleccionar cliente/tienda (`router.replace`) para que la URL actual siempre refleje lo que se esta viendo.
De paso se encontro y corrigio un bug real: `integraciones/page.tsx` mantenia su propio estado de
organizacion activa leido solo de la URL al montar, independiente de este contexto compartido — podia
desincronizarse del selector del header. Ver `RIESGOS.md` R-009.

## Historial relacionado

Detalle cronologico en `roadmap/roadmaps/03-frontend-ux/CHANGELOG-UX.md` (v2.3 y v2.4).
