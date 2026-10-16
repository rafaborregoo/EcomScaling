# ADR-0026 — Guarda de escritura por organización

Fecha: 2026-10-12 · Estado: aceptada

## Contexto

La auditoría de Configuración (2026-10-12) encontró que los roles prometían más
de lo que hacían:

- «Miembro» y «Solo lectura» eran idénticos: los 31 chequeos de la API son
  `["owner", "manager"]` y nadie miraba `readonly`.
- El consultor asignado tenía poderes de gestor en cada cliente y el cliente no
  podía recortarlos.
- No había forma de exigir la verificación en dos pasos al equipo.

Cada servicio decide por su cuenta quién escribe; arreglarlo servicio a servicio
eran decenas de cambios y una regla fácil de olvidar en el siguiente.

## Decisión

Un `preHandler` único (`apps/api/src/org-access-guard.ts`, registrado en
`organization-settings.ts`) corre antes de toda ruta con `:organizationId`:

1. **Solo lectura** no escribe, salvo una lista corta (marcar leído, buscar,
   preguntar al copiloto, generar informes, feedback).
2. **Consultor asignado**: cada familia de rutas pide un permiso de
   `organization_consultant_permissions` (editar configuración, tareas,
   borradores de marketing, publicar campañas, invitar personas). Sin fila =
   valores por defecto; publicar arranca apagado.
3. **2FA obligatoria**: si `organizations.require_mfa`, un miembro sin sesión
   `aal2` no opera sobre la organización (lectura incluida).

No sustituye a los chequeos de cada servicio: los endurece. La matriz que ve el
usuario está en `apps/web/src/app/configuracion/role-permissions.ts`.

## Consecuencias

- Una ruta nueva bajo `/v1/organizations/:organizationId/` queda protegida sin
  hacer nada. Si es una escritura inocua para Solo lectura, va a
  `READONLY_ALLOWED`; si el consultor no debe poder hacerla sin permiso, va a
  `CONSULTANT_RULES`.
- El contexto de auth se resuelve también en el hook; va cacheado por token, no
  añade otra resolución completa. Los permisos del consultor solo se leen en
  escrituras de consultor que los necesitan.
- Migración: `20261219100000_configuracion_permisos.sql`.
