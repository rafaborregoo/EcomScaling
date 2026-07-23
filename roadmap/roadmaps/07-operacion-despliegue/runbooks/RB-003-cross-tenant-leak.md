# RB-003 - Fuga cross-tenant (un cliente ve datos de otra organizacion)

## Sintoma

Un cliente o consultor reporta ver datos (pedidos, tareas, alertas, metricas, credenciales, resultados de
IA) que no corresponden a su organizacion, o un `organizationId` distinto al propio aparece en una
respuesta de la API, en un log, o en la URL sin que el usuario deba tener acceso a el.

## Impacto

Maximo. Es el escenario que R-004 (`RIESGOS.md`) trata como el riesgo de mayor severidad del proyecto —
compromete la confianza de todos los clientes del piloto, no solo del afectado, y puede implicar exposicion
de datos financieros o credenciales de integracion de un tercero.

## Severidad

**SEV-1 siempre.** No hay un escalon intermedio para este tipo de incidente — cualquier fuga confirmada
para a tratamiento inmediato, incluso si solo se vio una fila.

## Comprobaciones iniciales

1. Confirmar el alcance exacto: que endpoint devolvio el dato, con que `organizationId` en la URL/params y
   con la sesion de que usuario. Pedir al reportante el `request_id` si esta disponible (log JSON de
   Fastify, ver SQO-02) o la hora exacta y el endpoint.

2. Identificar la capa que fallo. El proyecto tiene **dos capas independientes** de aislamiento por
   organizacion — hay que saber cual de las dos (o ambas) fallo:
   - **Capa de aplicacion (Node)**: cada funcion de servicio que recibe un `organizationId` en el path
     valida la membership del usuario autenticado contra `context.memberships` antes de tocar datos
     (`context.memberships.some(...)` o el helper local `requireMembership`/`requireOrganizationAccess`,
     repetido en `shopify-overview.ts`, `operations.ts`, `financial-config.ts`, `integrations.ts`,
     `calls.ts`, etc.). Rechaza con `403 organization_access_denied` antes de llamar a Supabase.
   - **Capa de base de datos (RLS)**: las policies de Postgres filtran por `private.can_access_org(...)`
     (`supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql`), que exige membership activa +
     suscripcion valida, o ser consultor asignado, o `platform_admin`. Esta capa protege incluso si la
     validacion de Node tuviera un bug — es la razon por la que existe `be-07-sql-gateway-tenant-isolation.test.ts`.

3. Reproducir el escenario exacto con un usuario de prueba real (nunca con datos de un cliente real):
   ```sql
   -- Confirmar la membership real del usuario afectado
   select organization_id, role, is_active
   from organization_members
   where user_id = '<user_id>';

   -- Confirmar si el usuario tiene consultor_assignment o es platform_admin
   -- (accesos legitimos "virtuales" que no son membership directa, ver BE-01)
   select platform_role from profiles where id = '<user_id>';
   select organization_id, is_active from consultant_assignments where consultant_user_id = '<user_id>';
   ```
   Si el usuario **si** tiene un acceso legitimo (consultor asignado, platform_admin) al `organizationId`
   en cuestion, no es una fuga — es el comportamiento esperado de "memberships virtuales" (ver BE-01,
   riesgo de diseño documentado, no un bug).

4. Revisar si el endpoint afectado es uno de los ya cubiertos por
   `be-01-cross-tenant-route-manipulation.test.ts` (`shopify/overview`, `shopify/connections`,
   `integrations`, `operations`, `financial-config`) o uno nuevo sin ese test todavia — la cobertura no es
   universal (ver Prevencion).

## Diagnostico

- **Si el endpoint afectado ya tiene test de BE-01 y pasa en CI/local**: el escenario reportado
  probablemente no es una fuga real (revisar paso 3, accesos legitimos) o es una condicion no cubierta por
  ese test (p. ej. un metodo HTTP o parametro distinto al probado) — ampliar el test con el caso exacto
  reportado antes de cerrar el incidente.
- **Si el endpoint no tiene validacion de membership en Node** (falta el `requireMembership`/
  `context.memberships.some(...)` al inicio de la funcion de servicio): es un bug real de la capa de
  aplicacion. La RLS deberia haber bloqueado el acceso igualmente salvo que tambien falle — confirmar el
  paso siguiente.
- **Si la RLS tambien fallo** (el usuario pudo leer filas de otra organizacion incluso via el cliente
  `service_role`/consulta directa simulando su JWT): revisar la policy de la tabla afectada en
  `supabase/migrations/` — buscar si usa `private.can_access_org` o si tiene una condicion mas laxa
  (p. ej. una policy vieja que solo comprueba `auth.uid() is not null` sin filtrar por organizacion).

## Acciones

1. **Contener primero, investigar despues.** Si el endpoint tiene un bug de Node claro y reproducible,
   deshabilitarlo temporalmente (feature flag, o comentar la ruta en `server.ts` y redeployar) es preferible
   a dejarlo expuesto mientras se escribe el fix con calma.
2. Escribir el fix: añadir/corregir la validacion de membership en Node (patron ya establecido,
   `requireMembership`/`context.memberships.some(...)`, 403 `organization_access_denied`) y/o corregir la
   policy RLS de la tabla afectada (nunca relajar una policy sin un test de regresion en el mismo commit).
3. Añadir un test de regresion real contra Supabase remoto (mismo patron que
   `be-01-cross-tenant-route-manipulation.test.ts`: usuario real de org A, `app.inject` contra el endpoint
   con `organizationId` de org B, esperar 403) **antes** de cerrar el incidente, no despues.
4. Revisar `audit_logs` para el rango de tiempo afectado y confirmar que no hubo una escritura real
   (no solo lectura) beneficiandose del mismo bug.

## Rollback

No aplica un rollback de datos en el sentido tradicional — el dato de otra organizacion nunca deberia
haberse escrito en el contexto del usuario afectado (es una fuga de lectura o, en el peor caso, de
escritura cross-tenant). Si hubo una escritura cross-tenant real, revertirla requiere identificar la fila
exacta insertada/modificada (via `audit_logs` o `created_at`/`updated_at` en el rango del incidente) y
corregirla manualmente — no hay automatismo para esto todavia.

## Validacion de recuperacion

- El endpoint afectado, probado de nuevo con el mismo usuario y el mismo `organizationId` ajeno, devuelve
  403 `organization_access_denied`.
- El nuevo test de regresion pasa en local contra Supabase remoto y queda anadido a `npm run test`.
- Si se toco una policy RLS, correr la suite completa de `rls-tenant-isolation.test.ts` para confirmar que
  el cambio no rompio ningun acceso legitimo (consultor asignado, platform_admin, owner/manager/member).

## Comunicacion al cliente

Fuga cross-tenant confirmada = notificacion obligatoria al cliente afectado, incluso si el alcance fue
minimo (una fila, un campo). No es una decision tecnica — comunicar que datos se expusieron, durante cuanto
tiempo, y que se corrigio. Tratar como incidente de privacidad real, no como un bug interno.

## Escalado

SEV-1 siempre implica parar cualquier otro trabajo hasta contener y confirmar el alcance. Sin equipo de
guardia formal todavia (R-018, equipo de una persona) — este runbook es la unica guia hasta que exista.

## Evidencias a conservar

Request/response completos del endpoint afectado (con `request_id`), la fila exacta de `audit_logs` si
hubo escritura, la membership real del usuario en el momento del incidente, y el diff del fix (Node y/o
RLS) aplicado.

## Prevencion

`be-01-cross-tenant-route-manipulation.test.ts` (BE-01, 2026-07-23) cubre 5 endpoints de negocio
representativos, no la totalidad de los ~60+ que llevan `:organizationId` en el path — no se ha auditado
uno por uno. `be-07-sql-gateway-tenant-isolation.test.ts` cubre el SQL Gateway de agentes IA por separado.
Ampliar la cobertura de BE-01 a mas endpoints (o generalizarla en un test parametrizado sobre todas las
rutas registradas en `server.ts`) cerraria este gap de raiz en vez de depender de este runbook reactivo.
