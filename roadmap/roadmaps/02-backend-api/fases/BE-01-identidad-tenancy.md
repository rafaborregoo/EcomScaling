# BE-01 - Identidad, tenancy y bootstrap

## Estado

- **Estado real:** `verification_pending` (el propio documento reconocia que faltan verificaciones en
  endpoints de negocio — no cumple su propio criterio de cierre).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
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
- **Test anadido y confirmado 2026-07-22**: `rls-tenant-isolation.test.ts` incluye "un consultor pierde
  acceso en cuanto se desactiva su asignacion (en caliente, sin re-login)" -- desactiva
  `consultant_assignments.is_active` para un consultor real y confirma que pierde visibilidad de la
  organizacion en la siguiente query, sin re-login, contra el Supabase remoto real.
- **Resuelto 2026-07-23**: el test de "organizacion activa manipulada" ya existe --
  `apps/api/src/be-01-cross-tenant-route-manipulation.test.ts` levanta el servidor Fastify real
  (`buildApp()` + `app.inject`, mismo pipeline de rutas/hooks que produccion, no Supabase directo) con un
  usuario real que solo pertenece a la organizacion A, y pide 5 endpoints de negocio
  (`shopify/overview`, `shopify/connections`, `integrations`, `operations`, `financial-config`) con el
  `organizationId` de la organizacion B en el path. Los 5 rechazan con 403 `organization_access_denied`
  (mas un control positivo por endpoint confirmando que la propia organizacion si responde) -- 10/10 tests
  pasan contra Supabase remoto real. Esto confirma que la validacion en Node (`context.memberships.some(...)`
  o `requireMembership`, repetida en cada servicio) funciona de verdad como primera linea de defensa, no
  solo la RLS.
  - **Hallazgo real al escribir el test**: el fixture inicial daba 409 `membership_missing` incluso para la
    propia organizacion del usuario -- `private.can_access_org` exige una fila en `service_subscriptions`
    con `status in ('trial','active')` ademas de la membership activa (`private.has_valid_subscription`);
    sin eso RLS bloquea incluso al dueño real. No es un bug del sistema, es una precondicion del RLS real
    que no estaba en el fixture de este test nuevo (el resto de tests de RLS ya la seedeaban).
  - **Bug real corregido de paso**: `app.close()` se colgaba indefinidamente porque el cliente Redis que
    `server.ts` le pasa a `@fastify/rate-limit` nunca se desconectaba -- ese plugin asume que un cliente
    externo se administra fuera de Fastify. Anadido un hook `onClose` en `buildApp()` que lo desconecta.
    Esto tambien es un gap real de shutdown graceful (ver BE-00): sin este fix, un `SIGTERM` en produccion
    dejaria la conexion de Redis colgada.
  - Validacion de organizacion activa no extendida a todos los endpoints de negocio (solo
    bootstrap/listado consultor la tenian completa en origen) -- el test de arriba confirma que los 5
    endpoints probados si la tienen; no se auditaron los ~57 restantes uno por uno.
  - UUIDs concretos de seed en la documentacion sin etiquetar claramente como datos sinteticos.
  - **Correccion 2026-07-22**: una revision anterior de este documento afirmaba que no existia API para
    gestionar memberships/asignaciones de consultor -- **era falso**, error de buscar la tabla equivocada
    (`"memberships"` en vez de `organization_members`). Si existen: `upsertOrganizationMember` y
    `upsertConsultantAssignment` (`apps/api/src/consultant.ts`, montadas en `server.ts`, exigen
    `platform_admin`, ambas auditadas via `recordAuditLog` desde antes de esta correccion). De paso se
    encontro y corrigio un bug real de tipos en `upsertOrganizationMember`: el `select` de la fila previa
    no traia `invited_at`/`joined_at`, asi que cada edicion de rol los sobreescribia con la fecha actual en
    vez de preservar los originales.
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

## Actualizacion 2026-07-22

- Se cerró el gap de gestión de acceso existente: `GET /v1/consultant/organizations/:organizationId/access` lista miembros, asignaciones y perfiles activos disponibles para un `platform_admin`.
- `PUT /v1/consultant/organizations/:organizationId/members` permite añadir o reactivar/desactivar perfiles existentes con rol `owner`, `manager`, `member` o `readonly`.
- `PUT /v1/consultant/organizations/:organizationId/assignments` permite asignar/reactivar/desactivar consultores y marcar uno como principal; al cambiarlo se desmarca el principal anterior.
- Todas las mutaciones usan soft-deactivate, no crean usuarios de Auth, no eliminan datos y escriben `audit_logs`.
- El panel web muestra estas operaciones dentro de cada cliente con estados de carga, error y vacío. Sigue pendiente el flujo de invitación de nuevos usuarios de Auth, que requiere correo/proveedor de identidad y no debe simularse con perfiles.
