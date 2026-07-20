# ADR-0009: Navegacion del shell por rol (portal = panel de consultor)

- **Fecha:** 2026-07-20
- **Estado:** Aprobada

## Contexto

EcomScaling sirve a dos audiencias con el mismo shell: clientes que operan su propia organizacion, y
consultores/platform_admin que gestionan multiples organizaciones de clientes distintos. La navegacion
original trataba a ambos igual, obligando al consultor a un selector de cliente adicional superpuesto a
una navegacion pensada para un solo usuario/una sola organizacion.

## Decision

Para `platform_admin`/`consultant`, el portal **es** el panel de consultor: la navegacion agrupa
"Consultoria" (Clientes) primero, luego "Cliente activo" (Dashboard/Tareas/Mi Camino/Llamadas) y "Datos
del cliente" (Integraciones/Shopify/Conocimiento/Configuracion) — todo operando sobre el cliente activo
seleccionado. Los clientes ven su navegacion operativa de siempre, sin la seccion de Consultoria.
Login y `/` redirigen por rol: consultor/admin aterrizan en `/consultor`.

## Implementacion

`apps/web/src/components/portal-shell.tsx` — `consultantNavGroups` vs `clientNavGroups`, seleccionados
segun `bootstrap.profile.platform_role`.

## Consecuencias

- Un solo componente de shell sirve a ambas audiencias sin duplicar codigo de navegacion.
- El cambio de cliente activo (ver ADR-0010) se convierte en la operacion mas frecuente de un consultor,
  por lo que su rendimiento y consistencia son criticos.
- Riesgo: si en el futuro aparecen mas tipos de acceso (auditor de solo lectura, soporte), la navegacion
  por rol binaria (`isConsultant` boolean) necesitara generalizarse — ver tambien la nota de diseno de
  `AuthContext.accessSource` en BE-01.

## Historial relacionado

Detalle cronologico de los ajustes de este shell en
`roadmap/roadmaps/03-frontend-ux/CHANGELOG-UX.md` (v2.2 y siguientes).
