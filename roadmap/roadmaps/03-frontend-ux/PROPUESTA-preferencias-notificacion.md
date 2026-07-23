# Propuesta - Preferencias de notificacion (email / SMS / push)

## Estado

`not_started` - propuesta pendiente de priorizar, no forma parte de ninguna fase FE-* actual.

## Contexto

Rafa pidio (2026-07-23) una pantalla de preferencias de notificacion (email, SMS, push) usando
`CheckboxGroup` de HeroUI. Verificado antes de construir nada: **no existe soporte real en el
backend hoy** - no hay columna en base de datos, ni endpoint de API, ni ningun lugar que lea o
escriba esa preferencia. Construir solo la UI seria una pantalla que no hace nada, en contra de la
regla ya documentada de "sin datos falsos" (ver FE-08). Decision de Rafa: documentar el alcance
aqui y construirlo mas adelante, no ahora.

## Alcance real si se construye

1. **Migracion de base de datos**: columna o tabla nueva para guardar la preferencia por usuario
   (p. ej. `profiles.notification_preferences jsonb` o tabla dedicada si crece). Seguir
   [ADR-0014](../../../docs/decisions/ADR-0014-migration-policy.md).
2. **Endpoint de API**: `GET`/`PATCH` para leer y actualizar la preferencia del usuario autenticado
   (`apps/api`), con su chequeo de autorizacion habitual.
3. **Canales que de verdad hay que conectar**: hoy no existe envio de SMS ni push en ningun sitio
   del codigo (`apps/worker`/`apps/api`) - antes de ofrecer esos checkboxes en la UI, confirmar que
   existe (o se va a construir) el canal de envio correspondiente. Ofrecer un checkbox que no
   dispara ningun envio real es el mismo problema de datos falsos, aplicado al canal en vez de al
   dato.
4. **UI real**: en `/configuracion`, usando el `CheckboxGroup`/`Checkbox` ya disponibles en
   `apps/web/src/components/ui` (HeroUI, wireados 2026-07-23), leyendo el valor real del endpoint y
   guardando el cambio al marcar/desmarcar.

## Componente ya listo

`Checkbox` (`apps/web/src/components/ui/checkbox.tsx`) ya migrado y en uso real (ver `/consultor`).
`CheckboxGroup`, `Description`, `Label` re-exportados directos de `@heroui/react` en
`apps/web/src/components/ui/index.ts` sin wrapper propio (sin uso existente que preservar). No hace
falta trabajo adicional de componente cuando se retome esto - el bloqueo es el backend (pasos 1-3).

## Siguiente accion

Ninguna hasta que Rafa priorice esta propuesta. No crear la migracion ni el endpoint sin decision
explicita.
