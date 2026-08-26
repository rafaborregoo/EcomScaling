# DB-01 - Enums del nucleo

## Estado

> Verificacion vigente 2026-08-24: el esquema remoto y las 64 migraciones
> locales estan alineados (`GENERATED_SCHEMA_OK: 64 migrations`), por lo que
> no existe drift de enums conocido. La suite remota documentada sigue siendo
> la evidencia funcional (47/47 tests de API en la validacion anterior); queda
> mantener una ejecucion aislada reproducible antes de cambiar el estado a
> `done`.

- **Estado real:** `verification_pending` (drift resuelto 2026-07-21; semantica/transiciones documentadas
  2026-07-23, ver abajo)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** DB-00
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123328_db_01_enums_core.sql`, aplicada en remoto el 2026-07-15.
  - Enums incluidos: `platform_role`, `organization_status`, `member_role`, `subscription_status`, `notification_status`.
  - **`organization_status` gano un valor 2026-07-21**: `pending_deletion` (R-008, soft-delete de
    organizaciones/tiendas), via `supabase/migrations/20260722200000_db_12_pending_deletion_enum.sql`.
  - **Test anadido y aplicado 2026-07-21**: `apps/api/src/db-01-enum-drift.test.ts` lee los valores reales de
    los 5 enums via `private.enum_labels` (funcion de solo lectura, `SECURITY INVOKER`, `search_path` fijo,
    solo `service_role` — migraciones `20260722210000`/`20260722210100`) y falla si no coinciden exactamente
    con la lista documentada aqui. Confirmado contra el Supabase remoto real, 47/47 tests de `apps/api`
    pasando. Corre en CI.
- **Resuelto 2026-07-23**: semantica y transiciones reales de los 5 enums, verificadas contra el codigo
  (no inferidas) — `apps/api/src/*.ts` y las migraciones. Ningun enum tiene CHECK/trigger que restrinja
  transiciones a nivel DB (la unica excepcion es `private.prevent_profile_privilege_escalation`, que
  restringe _quien_ puede cambiar `platform_role`, no que valores son validos); toda la logica de
  transicion que existe es de aplicacion, no de base de datos.
  - **`platform_role`** (`profiles.platform_role`): `user` (sin privilegios de plataforma, default) ->
    `consultant` (acceso cross-org via `consultant_assignments`) -> `platform_admin` (bypassa membership,
    ~15 gates de autorizacion en `apps/api/src/*.ts`). **Sin evidencia de codigo de producto que promueva
    o degrade este valor** — el unico `.update({ platform_role: ... })` esta en un script de seed/eval
    (`eval-a02-monitor.ts:90`), no en un endpoint.
  - **`organization_status`** (`organizations.status`): `onboarding` (default al crear) -> `active`
    (operando) -> `suspended`/`cancelled` (sin evidencia de codigo de producto que los use fuera de
    fixtures de test) -> `pending_deletion` (soft-delete, R-008; `deleteOrganization` en `consultant.ts`
    lo setea desde cualquier estado previo, con guard de idempotencia si ya esta en `pending_deletion`) ->
    `active` (unico camino de vuelta: `restoreOrganization`, que hardcodea el destino a `active` sin
    importar el estado anterior porque no se conserva, `consultant.ts:816-818`). El endpoint generico
    `updateOrganization` (platform-admin) permite cualquier valor entre
    `{onboarding, active, suspended, cancelled}` sin maquina de estados — pero `pending_deletion` **no**
    esta en esa whitelist, asi que solo se entra/sale via `deleteOrganization`/`restoreOrganization`. La
    purga definitiva (sin restauracion posible) la hace un cron aparte, no `apps/api/src`.
  - **`member_role`** (`organization_members.role`): `owner`/`manager` (privilegiados, chequeados en
    `financial-config.ts`, `shopify.ts`, `operations.ts`) > `member` (estandar) > `readonly` (declarado en
    el enum pero **sin ninguna rama de autorizacion que lo trate distinto** — ningun `.includes("readonly")`
    en el codebase). Unico camino de escritura: `upsertOrganizationMember` (`consultant.ts:388-399`), un
    `upsert` que sirve tanto para invitar como para cambiar de rol, sin restriccion de que rol puede pasar
    a que otro.
  - **`subscription_status`** (`service_subscriptions.status`): `pending` (default al crear) -> `trial`/
    `active` (unico estado "vigente" — garantizado por un indice unico parcial,
    `service_subscriptions_one_current_per_org ... where status in ('trial','active')`, la unica
    restriccion real a nivel DB entre los 5 enums) -> `paused`/`cancelled`/`expired` (sin indice que los
    distinga entre si). **Sin ningun endpoint de escritura en `apps/api/src`** — solo lectura
    (`auth-context.ts`, `consultant.ts`). El unico lugar que escribe estos valores es
    `scripts/seed-demo-user.ts` (datos de prueba). No se puede documentar la diferencia real entre
    `paused`/`cancelled`/`expired` porque ningun flujo del producto las usa hoy — este enum esta pensado
    para una integracion de facturacion (Stripe u otra) que todavia no existe.
  - **`notification_status`** (`notifications.status`, default `'unread'`): `unread` -> `read` ->
    `archived`, triaje estandar. **Sin ningun `.update({ status: ... })` sobre `notifications` en todo
    `apps/api/src`** — el unico uso es un `insert` sin `status` explicito (usa el default). Marcar
    como leida/archivada es una accion de UI que no esta implementada todavia, no una transicion que se
    decidio omitir.
- **Estrategia de evolucion de enums**: no hay documento formal, pero la practica ya establecida (y usada
  correctamente en `db_12_pending_deletion_enum.sql`) es: solo `ALTER TYPE ... ADD VALUE IF NOT EXISTS` en
  su propia migracion nueva, nunca reordenar/eliminar/renombrar valores existentes con datos ya escritos.
- **Siguiente accion:** ninguna pendiente en este documento. Si se activa `service_subscriptions` de verdad
  (integracion de facturacion), definir ahi mismo la semantica real de `paused`/`cancelled`/`expired`.

## Objetivo

Crear solo los enums necesarios para identidad, organizaciones, suscripcion, notificaciones y auditoria del primer vertical slice.

## Entregables

- Enums de roles de plataforma y miembros.
- Enums de estado de suscripcion.
- Enums de notificacion basicos.
- Convencion para versionar enums posteriores sin romper datos existentes.

## No incluido

- Enums de Shopify, Meta, Klaviyo, Instagram o agentes si no son necesarios para F2.

## Criterios de cierre

- No hay enums adelantados por comodidad.
- Las migraciones posteriores pueden extender el modelo sin editar migraciones ya aplicadas.
