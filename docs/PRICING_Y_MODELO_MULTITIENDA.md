# Modelo multitienda y dimensiones de pricing (borrador de trabajo)

- **Estado:** SUPERADO por [MODELO_PLANES_Y_VINCULACION.md](MODELO_PLANES_Y_VINCULACION.md)
  (2026-09-16), que fija las cifras y el modelo de organizacion consultora. Se
  conserva por el inventario de la seccion 1 (donde se mide cada cosa hoy) y
  porque las preguntas de la seccion 5 explican por que se decidio lo que se
  decidio. **Los precios de este documento ya no son validos.**
- **Fecha:** 2026-08-31
- **Relacionado:** [ADR-0010](decisions/ADR-0010-global-client-store-context.md) (contexto cliente/tienda),
  [ADR-0012](decisions/ADR-0012-memberships-virtuales.md) (acceso de consultor), `service_subscriptions`.

## 1. Estado actual

| Concepto | Tabla / sitio | Granularidad hoy |
|---|---|---|
| Cliente / cuenta | `organizations` | — |
| Suscripcion / plan | `service_subscriptions` (`plan_code`, `status`, `external_subscription_id`) | **por organizacion** |
| Tienda / cuenta de proveedor conectada | `integration_connections` (`provider`, `provider_account_id`, `status`) | N por organizacion (ya soportado) |
| Shop de Shopify sincronizado | `shopify_stores` (`connection_id`, `organization_id`, `myshopify_domain`) | N por organizacion |
| Consultor ↔ cliente | `consultant_assignments` (`organization_id`, `consultant_user_id`, `is_primary`, `is_active`, `ended_at`) | **por organizacion** (no por tienda) |
| Acceso del consultor | `resolveAuthContext` materializa membership virtual desde `consultant_assignments` activas | por organizacion |
| Selector de tienda en UI | `portal-shell.tsx` `showStoreSelect` | visible solo si `integration_connections` (shopify) `>= 2` |
| Tareas / alertas | `tasks`, `alerts` | **por organizacion**, sin dimension tienda |

Resumen: los datos ya permiten varias tiendas por cliente. Lo que **no** existe es
(a) asociacion consultor↔tienda, (b) UI/producto que trate la tienda como unidad de primera clase,
(c) medicion para pricing.

## 2. Modelo objetivo

1. **Un cliente puede tener varias tiendas.** Ya posible en datos; falta UI y reglas de negocio.
2. **La asociacion con el consultor es por tienda, no por cliente.** Un cliente puede tener la tienda A
   dentro del servicio de consultoria y la tienda B fuera (self-serve o sin consultor).
3. **El pricing se cuantifica por numero de tiendas**, **numero de usuarios que usan la app** y
   **limites de IA** por plan (mas otras dimensiones, seccion 4).

### Cambios que implica

- **`consultant_assignments` con alcance por tienda.** Opciones a decidir en ADR:
  - **A)** anadir `connection_id uuid NULL` (NULL = toda la organizacion). Cambio minimo, retrocompatible.
  - **B)** tabla nueva `consultant_store_assignments`. Mas limpia si la logica por tienda crece
    (permisos, facturacion, informes por tienda).
- **Acceso del consultor (ADR-0012).** `resolveAuthContext` pasa de materializar acceso `(org)` a
  `(org, tienda)` cuando la asignacion es parcial. Cada endpoint que hoy autoriza y filtra a nivel
  organizacion tendria que aceptar y aplicar el filtro de tienda. **Este es el trabajo grande** y el
  principal riesgo (fuga entre tiendas de un mismo cliente).
- **Contexto UI (ADR-0010).** El selector de tienda pasa a primera clase: visible para cliente con
  `>= 1` tienda; "vista general" = todas las tiendas a las que se tiene acceso, con distincion visual
  por tienda (ya hecho en /tareas para la vista de cartera del consultor: badge de tienda por fila).
- **Tareas / alertas por tienda.** Decidir si `tasks`/`alerts` ganan `connection_id` explicito o se
  deriva la tienda por otro medio. Hoy `tasks.categories` distingue modulo (shopify/meta/klaviyo)
  pero no *que* tienda.
- **Onboarding.** Alta de tienda adicional como flujo propio (hoy el onboarding asume una).

## 3. Cambio pequeno e independiente (no bloquea el ADR)

Mostrar el selector de tienda para un cliente con **una sola** tienda (hoy exige `>= 2`):
`portal-shell.tsx` `showStoreSelect` (`shopifyConnections.length >= 2` → `>= 1`). Una linea.
Pendiente de confirmar: con una tienda el selector solo tendria "Todas las tiendas" + esa tienda.

## 4. Dimensiones de pricing a cuantificar

Checklist de todo lo que podria facturarse, con donde se mide hoy y si hay medicion.

Confirmadas por Rafa (2026-08-31): **tiendas**, **usuarios que usan la app**, **limites de IA**.

| Dimension | Unidad | Donde se mide hoy | ¿Medicion lista? |
|---|---|---|---|
| **Tiendas** (confirmada) | nº de `integration_connections` (o `shopify_stores`) activas por cuenta | tabla existe | conteo trivial, sin limite ni enforcement |
| **Usuarios que usan la app** (confirmada) | nº `organization_members` activos (¿+ usuarios activos/mes?) | tabla existe | conteo trivial; falta definir "usa la app" (miembro vs login reciente) y enforcement |
| **Limites de IA** (confirmada) | cuota por plan: acciones IA / tokens / mes, con bloqueo o degradado al superar | `ai-runtime` (ADR-0019), diagnosticos Shopify, generador marketing, copilot, analisis de llamadas | **sin metering ni cuota**, hay que anadir contador central + enforcement por plan |
| Integraciones activas | Shopify / Meta Ads / Klaviyo por tienda | `integration_connections.provider` + `status` | conteo trivial |
| Llamadas de consultoria | nº de llamadas / periodo | modulo llamadas | existe registro |
| Transcripcion + analisis IA de llamadas | minutos transcritos / llamadas analizadas | pipeline IA llamadas (ADR-0016 retencion) | cuenta contra el limite de IA; hay que instrumentar contador |
| Planes estrategicos / Mi Camino | ¿nº de planes activos? ¿incluido en todos los planes? | `strategic_plans` | conteo trivial |
| Alertas / reglas | nº de reglas activas o alertas/mes | `alerts` + reglas | conteo trivial |
| Volumen de datos sincronizados | pedidos/productos/mes por tienda | tablas `shopify_*` | agregable por SQL |
| Retencion de datos | ventana de audit logs (ADR-0018) y transcripciones (ADR-0016) | politicas existentes | parametro de plan, no medido |
| Consultor dedicado vs self-serve | boolean / tier | derivable de `consultant_assignments` | trivial |

## 5. Preguntas abiertas (decidir antes del ADR)

1. ¿La suscripcion sigue viviendo en `organizations` con una cantidad = nº de tiendas, o pasa a haber
   una linea/suscripcion por tienda? (El enunciado "cuantas tiendas necesitas" encaja con lo primero.)
2. Una tienda **sin consultor**: ¿el cliente la paga igual (modo self-serve del panel) o no cuenta?
3. ¿"Tienda" = solo Shopify, o Meta/Klaviyo conectados tambien son unidad facturable?
4. ¿Que pasa con los datos historicos de una tienda cuando sale del servicio del consultor
   (se conservan, se ocultan, se purgan segun ADR-0018)?
5. ¿Limites duros (bloquear al superar el plan) o solo medicion + aviso? Aplica sobre todo a IA.
6. "Usuario que usa la app": ¿todo miembro de `organization_members` cuenta, o solo los que han
   entrado en los ultimos N dias? ¿El consultor cuenta como usuario del cliente?
7. Limite de IA: ¿por cuenta o repartido por tienda? ¿Se resetea mensual? ¿Que pasa al agotarlo
   (bloqueo, cola, degradado a modelo mas barato)?
