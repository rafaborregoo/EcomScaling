# DB-01 - Enums del nucleo

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260715123328_db_01_enums_core.sql`, aplicada en remoto el 2026-07-15.
  - Enums incluidos: `platform_role`, `organization_status`, `member_role`, `subscription_status`, `notification_status`.
- **Gaps identificados:**
  - No hay documentacion del significado de cada valor ni de las transiciones validas (p. ej. que puede pasar `active` -> `suspended`, si `cancelled` es reversible, diferencia `paused`/`suspended`).
  - No hay estrategia escrita para evolucionar enums en Postgres (solo anadir al final, nunca reutilizar/eliminar valores sin migrar datos).
  - No hay tests que verifiquen los valores existentes ni tabla de compatibilidad enum-DB vs Zod vs TypeScript.
- **Siguiente accion:** documentar semantica y transiciones de cada enum, y anadir un test que falle si un enum pierde o gana un valor sin migracion explicita.

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
