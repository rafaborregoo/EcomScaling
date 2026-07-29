# FE-01 - Auth y onboarding

## Estado

- **Estado real:** `functionally_minimal_gaps_confirmed` — **auditado contra codigo real 2026-07-22**,
  reemplaza el `implementation_unknown` anterior (que no habia leido el codigo, solo el documento).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** DB-02, BE-01
- **Bloqueador:** ninguno
- **Evidencia real:**
  - `apps/web/src/app/login/page.tsx`: formulario de email/password contra Supabase Auth
    (`signInWithPassword`), sin registro propio (las cuentas las crea el consultor/admin, coherente con el
    modelo B2B consultor-first, ver `seed-demo-user.ts`).
  - `apps/web/src/app/page.tsx` (raiz): redirige por rol tras `fetchBootstrap` — consultor/admin a
    `/consultor`, cliente a `/dashboard`; sin sesion, a `/login`.
  - `apps/web/src/lib/bootstrap.ts`: refresco de token automatico si expira en <60s
    (`getAccessToken`/`apiFetch`), con reintento de la request original tras un 401.
  - **Gap real confirmado y corregido 2026-07-22**: un cliente con `bootstrap.memberships` vacio (invitado
    sin asignar, o eliminado de su unica organizacion) llegaba a `/dashboard` y veia un panel en blanco sin
    ninguna explicacion — `organization` resolvia a `null` pero nada lo comunicaba. Anadido un
    `EmptyState` explicito ("Sin organización asignada... contacta con tu consultor") en
    `apps/web/src/app/dashboard/page.tsx`.
- **Cerrado 2026-07-29 (sesion expirada con mensaje explicito)**: antes `!accessToken` en `portal-shell.tsx`
  redirigia a `/login` en silencio sin distinguir "nunca hubo sesion" (primera visita, sign-out) de "habia
  una sesion pero expiro/no se pudo refrescar" (el caso que realmente confunde al usuario, incluida la
  suspension en caliente de un consultor). Ahora se comprueba `supabase.auth.getSession()` antes de intentar
  refrescar: si existia una sesion guardada, redirige a `/login?reason=session_expired`, y `login/page.tsx`
  (dividido en `LoginPageContent` + wrapper con `Suspense`, mismo patron que `PortalShell`, para poder usar
  `useSearchParams`) muestra "Tu sesión expiró. Vuelve a iniciar sesión para continuar." Build de
  produccion limpio; sin verificar visualmente en navegador (sin Playwright/Chromium en este entorno).
- **Gaps que siguen sin resolver (confirmados, no solo listados):**
  - No hay pantalla de recuperacion de contrasena ("olvidé mi contraseña") ni de invitacion/signup — la
    unica via de acceso es email/password ya provisionado. Puede ser intencional (B2B, cuentas creadas por
    Rafa), pero no esta declarado como decision de producto en ningun sitio.
  - Sin maquina de estados de onboarding documentada para el flujo completo (conectar Shopify -> configurar
    financiero -> dashboard listo). Sigue siendo la recomendacion correcta antes de anadir mas pantallas.
  - Sin contrato de UX para: correo no verificado, organizacion suspendida vista desde el cliente (existe el
    badge de estado en el header, no una pantalla explicativa), suscripcion suspendida, consultor sin
    asignaciones (el panel de consultor con 0 clientes no se audito esta vuelta), token de Shopify caducado
    durante el proceso de conexion.
  - Selector de organizacion para clientes con varias organizaciones: existe para consultor/admin
    (`bootstrap.memberships.length > 1` en `portal-shell.tsx`), no confirmado si un cliente real puede
    tener membership en mas de una organizacion en este modelo de producto.
- **Siguiente accion:** decidir explicitamente si el signup/invitacion propios son necesarios para el
  Piloto 1 (hoy el aprovisionamiento manual funciona con pocos clientes) antes de invertir en construirlos;
  si no, modelar el onboarding de conexion Shopify -> financiero como maquina de estados explicita.

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

