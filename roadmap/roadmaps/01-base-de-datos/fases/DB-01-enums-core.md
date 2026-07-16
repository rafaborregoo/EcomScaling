# DB-01 - Enums del nucleo

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

## Implementacion actual

- Migracion creada: `supabase/migrations/20260715123328_db_01_enums_core.sql`.
- Enums incluidos: `platform_role`, `organization_status`, `member_role`, `subscription_status`, `notification_status`.
- Aplicada en Supabase remoto el 2026-07-15 mediante `supabase db push --linked`.
