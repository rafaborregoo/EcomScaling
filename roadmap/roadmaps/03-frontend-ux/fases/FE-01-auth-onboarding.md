# FE-01 - Auth y onboarding

## Estado

- **Estado real:** `implementation_unknown` (el documento no aporta evidencia suficiente para verificar
  que esta completado; no confundir con "no funciona" — significa "no demostrado aqui").
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-02, BE-01
- **Bloqueador:** ninguno
- **Evidencia:** login funcional en `/login` (Supabase Auth), redirect por rol tras login (confirmado en
  trabajo de sesiones previas sobre `portal-shell.tsx`/routing). No hay mas evidencia estructurada en
  este documento.
- **Gaps identificados:**
  - Sin maquina de estados de onboarding documentada. Se recomienda modelarla explicitamente:
    `account_created -> organization_ready -> shopify_pending -> shopify_syncing ->
    financial_config_pending -> dashboard_ready`, con una fuente de verdad unica del paso actual (evita
    que el frontend termine repartiendo condicionales por cada pagina).
  - Sin contrato de UX para: sesion expirada, correo no verificado, invitacion, usuario sin organizacion,
    usuario con varias organizaciones, organizacion suspendida, suscripcion suspendida, consultor sin
    asignaciones, error de bootstrap, onboarding abandonado, conexion incompleta.
  - Sin definicion de reanudacion del onboarding, que puede saltarse, ni que pasa al caducar un token de
    Shopify durante el proceso.
- **Siguiente accion:** modelar el onboarding como maquina de estados explicita antes de seguir anadiendo
  pantallas que dependan de el implicitamente.

## Objetivo

Permitir acceso seguro y guiar al cliente hasta conectar datos reales.

## Entregables

- Login y recuperacion de acceso.
- Cuenta inactiva/suspendida.
- Selector de organizacion si aplica.
- Pantallas de conexion Shopify/Meta/Klaviyo segun feature flag.
- Formularios financieros iniciales.

## Criterios de cierre

- El cliente solo ve su organizacion.
- El consultor no puede entrar en cuentas no asignadas.
- El usuario entiende que debe conectar Shopify antes del dashboard.

