# Cierre de F1

Fecha: 19-10-2026.

F1 cierra el mapa de navegación por canal, los destinos de los avisos prioritarios y el contexto de tienda. Las rutas de menú ya separan Shopify, Meta, Klaviyo y Analítica. Los enlaces desde Pulso llevan al módulo actual del canal y conservan `organizationId`; los enlaces de Shopify conservan además `connectionId`.

| Entrada | Destino | Contexto esperado |
| --- | --- | --- |
| Alerta de stock agotado en Pulso | `/shopify/inventario?filter=out` | Tienda y conexión Shopify activas |
| Alerta de stock bajo en Pulso | `/shopify/inventario?filter=low` | Tienda y conexión Shopify activas |
| Ventas / resumen de tienda | `/shopify` | Tienda y conexión Shopify activas |
| Meta Ads conectado / no conectado | `/meta` o `/integraciones/meta` | Tienda activa |
| Klaviyo conectado / no conectado | `/klaviyo` o `/integraciones/klaviyo` | Tienda activa |
| Notificación con organización y tarea/alerta | `action_url` con `organizationId`, `task`/`alert` y `focus` | Organización propietaria; el foco de entidad se conserva |
| Acciones de cuenta para reconectar | `/integraciones?organizationId=…` | Organización propietaria de la conexión |

Se añadió `withPortalRouteContext` para mantener los filtros, hashes y organización de enlaces internos. El identificador de conexión solo se añade a rutas Shopify; no se filtra por accidente a Meta o Klaviyo. Se añadieron tres pruebas para filtro y conexión, destino con contexto explícito, y hash de entidad.

Verificación local: `npx tsx --test --test-force-exit apps/web/src/lib/portal-route-context.test.ts` (3 correctas) y typecheck web (sin errores). La tabla de inventario ya lee `filter=out|low` al cargar. Las acciones de reconexión ya incluyen el `organizationId` en su contrato API.

Este cierre cubre el mapa y la navegación estática del código. La autorización efectiva de cada tienda se sigue aplicando en el shell/API/RLS y no se certifica con pruebas de cuenta real en esta fase. No se requiere ninguna acción del usuario en Shopify, Meta o Klaviyo para F1. El código sigue local, sin despliegue.
