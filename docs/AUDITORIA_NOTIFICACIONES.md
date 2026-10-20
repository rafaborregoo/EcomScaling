# Auditoría de notificaciones — 2026-10-19

Estado real del código (no de la documentación). Cubre la campana web, que es la fuente
de la que salen también el email (`notification-email.ts`) y el push móvil (`mobile-push.ts`):
los tres leen la misma fila de `notifications`, así que lo que está mal aquí está mal en los tres.

## 1. Inventario: lo que notificamos hoy

18 avisos distintos, creados desde 9 sitios. "Destino" = a dónde lleva al pulsar.
"¿Llega?" = si el destino muestra lo que ha pasado (✅ sí · 🟡 lleva a la pantalla correcta pero no lo señala · ❌ no).

### Para el consultor

| # | Tipo | Cuándo salta | Copy actual (título · texto) | Destino | ¿Llega? |
|---|------|--------------|------------------------------|---------|---------|
| C1 | `client_settings` | El cliente cambia los permisos del consultor | «Prueba Borrego ha cambiado lo que puedes hacer en su cuenta» · *(sin texto)* | `/configuracion?section=resumen` | ❌ No dice qué cambió, ni antes/después. Sale una vez por cada guardado, sin agrupar (en tu captura: 4 seguidas) |
| C2 | `client_linked` | Un cliente se da de alta con el código del consultor | «X se ha dado de alta con tu código» · «Ya está en tu cartera. Empieza por su configuración.» | `/consultor` | 🟡 Lleva a la cartera; no abre al cliente nuevo ni lo destaca |
| C3 | `client_decided_ai_output` | El cliente aprueba o descarta una propuesta de la IA | «Tu cliente ha descartado una propuesta de la IA» · «La ha decidido el propio cliente… Revisa el resultado si quieres…» | `/tareas` | ❌ No hay ninguna pantalla que muestre esa propuesta. *(Hoy he cambiado el texto para que liste lo decidido, pero sigue sin haber destino)* |
| C4 | `task_assigned` | El cliente acepta o rechaza una tarea propuesta por el consultor | «Tu cliente ha aceptado la tarea «…»» | `/tareas?…&task=` | ✅ desde hoy (abre la ficha). Dice «Tu cliente», no su nombre |
| C5 | `campaign_review` ×5 | El cliente crea, edita, escribe, marca una corrección como hecha o programa una campaña | «X ha creado/editado/escrito en «…»» | `/marketing?section=campanas&campaign=` | ✅ Abre la campaña. No señala qué cambió ni qué mensaje es el nuevo |
| C6 | `message` | El cliente escribe en Mensajes | «Mensaje nuevo de X» · *(el propio mensaje)* | `/mensajes` | 🟡 No abre el hilo de ese cliente |
| C7 | `camino_objective` | El cliente cambia un objetivo o la meta de Mi Camino | «X ha cambiado un objetivo de Mi Camino» · antes→después + «La IA revisará…» | `/camino?organizationId=` | 🟡 Abre el Camino, no el objetivo |

### Para el cliente

| # | Tipo | Cuándo salta | Copy actual | Destino | ¿Llega? |
|---|------|--------------|-------------|---------|---------|
| K1 | `task_assigned` | El consultor aprueba propuestas de la IA y se crean tareas | «Tu consultor te ha asignado N tareas nuevas» · «Revisa el detalle y marca su avance…» | `/tareas?organizationId=` | 🟡 Lista entera; no marca cuáles son las nuevas |
| K2 | `task_assigned` | El consultor propone una tarea | «Tu consultor te propone una tarea: «…»» | `/tareas?…&task=` | ✅ desde hoy |
| K3 | `campaign_review` ×4 | El consultor escribe, pide cambios, revisa o programa | «Tu consultor te pide cambios en «…»» | campaña | ✅ Abre la campaña; no señala la nota nueva |
| K4 | `message` | El consultor escribe | «Mensaje nuevo de {nombre}» | `/mensajes` | ✅ (el cliente solo tiene un hilo) |
| K5 | `camino_objective` | El consultor cambia un objetivo | igual que C7 | Camino | 🟡 |

### Para los dos

| # | Tipo | Cuándo salta | Copy actual | Destino | ¿Llega? |
|---|------|--------------|-------------|---------|---------|
| A1 | `alert` / `alert_critical` | Una regla detecta algo en los datos (caída de ventas, stock…) | Plantilla de la regla | `/tareas?…&alert=` | ✅ desde hoy (solo esa alerta). Solo la reciben owner/manager, **no el consultor** |
| A2 | `camino_objective` | La IA termina de revisar el Camino tras un cambio de objetivo | «La IA propone N ajustes en Mi Camino por el cambio de objetivo» | Camino | 🟡 No abre Seguimiento ni los ajustes |
| A3 | `integration_error` | Shopify/Meta/Klaviyo/Instagram pierde el permiso | «Hay que volver a conectar Meta Ads» | `/integraciones` | 🟡 No abre esa conexión |
| A4 | `integration_expiring` | El token de Meta está a punto de caducar | «El permiso de Meta Ads caduca el DD/MM» | `/integraciones` | 🟡 Ídem |

## 2. Problemas transversales

1. **Nadie señala lo que ha cambiado al llegar.** Ningún destino resalta el elemento: ni scroll, ni
   animación, ni «nuevo». Aunque el enlace sea correcto, hay que buscar a ojo.
2. **Enlaces sin contexto.** Hasta hoy casi todos eran `/tareas` o `/mensajes` a secas; el consultor
   caía en la cartera completa. Lo he arreglado en la campana para tareas y alertas, pero **Mensajes,
   Integraciones, Camino y Cartera siguen sin aceptar un id** al que ir.
3. **Copy de sistema, no de persona.** «Ha cambiado lo que puedes hacer en su cuenta», «una propuesta
   de la IA», «Revisa el resultado si quieres…», «Configuración › Integraciones». Dice que *algo* pasó,
   no *qué* pasó ni *qué tienes que hacer*. Mezcla «Tu cliente» (sin nombre) con el nombre de la tienda.
4. **Sin agrupar.** Cada guardado es una notificación: 4× «ha cambiado lo que puedes hacer». Mensajes
   sí deduplica (una sin leer por hilo); el resto no.
5. **Tipos fuera de su categoría.** `client_decided_ai_output` y `camino_objective` caen en «Otros»,
   que por defecto **no manda email** y no se puede configurar con sentido en Preferencias.
6. **Sin «qué hacer».** Ninguna notificación distingue «solo para que lo sepas» de «necesita que actúes».
   El cliente no sabe cuáles le piden algo.

## 3. Lo que no notificamos y debería

Ordenado por importancia. «Hay datos» = el evento ya existe en la base de datos; solo falta avisar.

| Prioridad | Evento | Para | ¿Hay datos? |
|-----------|--------|------|-------------|
| Alta | **La IA ha dejado propuestas pendientes de tu aprobación** (salidas `pending_approval`). Hoy el consultor solo las ve si entra a buscarlas | Consultor (o cliente sin consultor) | Sí |
| Alta | **Alertas críticas del cliente** (A1). Hoy solo le llegan al cliente, nunca a su consultor | Consultor | Sí, solo hay que ampliar destinatarios |
| Alta | **Comentario nuevo en una tarea** (`task_comments`). Se puede hablar en una tarea y el otro no se entera | Los dos | Sí |
| Alta | **El cliente completa una tarea** (con o sin resultado medido): es justo lo que el consultor quiere ver | Consultor | Sí |
| Alta | **Tarea que vence hoy / va tarde** | Responsable de la tarea (+ resumen al consultor) | Sí (`due_at`) |
| Media | **Informe mensual listo / compartido** (copiloto) | Cliente | Sí (`copilot-report-sharing`) |
| Media | **Campaña enviada** + sus primeros resultados a las 24-48 h | Los dos | Sí (Klaviyo) |
| Media | **Llamada agendada / resumen de llamada listo** con sus tareas | Los dos | Sí (`calls.ts`) |
| Media | **Hito o fase de Mi Camino completado** | Los dos | Sí |
| Media | **Primera importación de Shopify/Meta/Klaviyo terminada** («ya tienes datos») | Quien conecta | Sí (`integration_sync_runs`) |
| Media | **El cliente no entra en N días** / un cliente lleva tiempo sin actividad | Consultor | Parcial |
| Baja | Cambios en el plan o en la facturación (fin de prueba, pago fallido) | Cliente (owner) | Revisar Stripe |
| Baja | Alguien nuevo entra en el equipo del cliente / se va | Owner + consultor | Sí |
| Baja | Nota del consultor en una zona del panel (aporte por zona) | Cliente | Sí (`zone_notes`) |

## 4. Propuesta

### 4.1 Una regla de copy para todas

- **Título = quién + qué, con nombres concretos.** «Prueba Borrego ha descartado 2 tareas de la IA», no
  «Tu cliente ha descartado una propuesta de la IA». Para el consultor siempre el nombre de la tienda;
  para el cliente, el nombre de su consultor.
- **Texto = el detalle o lo que tienes que hacer**, nunca «revisa el resultado si quieres».
  Si no hay nada que añadir, no hay texto.
- **Marca de acción:** las que piden algo llevan un verbo en la etiqueta («Aprobar», «Responder»,
  «Reconectar»); las informativas, no.

Ejemplos reescritos:

| Hoy | Propuesta |
|-----|-----------|
| «Prueba Borrego ha cambiado lo que puedes hacer en su cuenta» | «Prueba Borrego te ha quitado permiso para programar campañas» · «Ya no puedes: programar campañas. Sigues pudiendo: editar borradores, crear tareas.» |
| «Tu cliente ha descartado una propuesta de la IA» | «Prueba Borrego ha descartado 2 tareas de la IA» · «"Subir precio del pack", "Email de carrito". Motivo: ya lo hacemos.» |
| «Tu consultor te ha asignado 3 tareas nuevas» · «Revisa el detalle…» | «Rafa te ha dejado 3 tareas» · «La primera vence el viernes: "Revisar fichas sin foto".» |
| «Hay que volver a conectar Meta Ads» · «…Configuración › Integraciones…» | «Meta Ads se ha desconectado» · «Los datos de anuncios están parados desde el 17/10. Reconectar →» |

### 4.2 Llegar y ver qué ha cambiado

- Cada notificación guarda **dónde está lo que ha cambiado** (`entity_type` + `entity_id`, que ya existe)
  y la campana arma el enlace con `?focus=<id>`. Hoy esto ya funciona para tareas y alertas.
- Una pieza común `useFocusTarget()`: en el destino, cuando aparece el elemento con ese id, hace scroll
  hasta él y le pone un **pulso de resaltado de ~2 s** (borde + fondo que se desvanece). Se pone una
  vez y la usan todas las pantallas destino.
- Pantallas que tienen que aceptar el id: Mensajes (hilo del cliente), Integraciones (conexión),
  Camino (objetivo / Seguimiento), Cartera (cliente), Configuración (fila del permiso cambiado),
  Campañas (nota nueva del hilo).
- Para lo que no tiene pantalla (propuesta IA decidida): o se le da una vista de solo lectura, o el
  aviso lleva todo el detalle y no tiene enlace. Recomiendo la vista: es la misma que se usa para aprobar.

### 4.3 Agrupar

- Mismo tipo + misma entidad + sin leer → **se actualiza la notificación existente** en vez de crear otra
  («…ha cambiado 4 permisos»). Mensajes ya lo hace; se generaliza a todas.
- Todos los tipos nuevos van a su categoría de Preferencias (sin «Otros» para nada importante).

## 5. Orden de trabajo sugerido

1. **Copy + agrupar** de las 18 actuales (sin pantallas nuevas). Rápido, se nota mucho.
2. **`useFocusTarget` + ids en los 6 destinos** que hoy no lo aceptan.
3. **Avisos nuevos de prioridad alta** (propuestas IA pendientes, alertas al consultor, comentarios en
   tareas, tarea completada, vencimientos).
4. Prioridad media y baja de la tabla 3.

## 6. Preguntas antes de empezar

1. **Alertas al consultor:** ¿todas o solo las críticas? Con varios clientes, todas puede ser mucho ruido.
2. **Vencimientos:** ¿un aviso por tarea o un único «Para hoy» diario por tienda?
3. **Propuestas IA pendientes:** ¿un aviso por cada salida de agente o uno diario agrupado por tienda?
4. **Propuesta IA decidida por el cliente:** ¿vista de solo lectura (recomendado) o todo el detalle en el aviso?

## 7. Decisiones y estado (2026-10-19)

Decidido: al consultor solo alertas críticas; «Para hoy» uno al día por tienda; propuestas IA
pendientes, uno al día por tienda (solo si hay alguna nueva); propuesta decidida → pantalla de
solo lectura `/propuestas/<id>`.

Hecho:
- `apps/api/src/notify.ts`: punto único (audiencias, nombres, agrupar sobre el aviso sin leer).
- Copy reescrito: permisos (qué cambió, agrupado), alta de cliente, propuestas IA, tareas
  propuestas/aceptadas, mensajes, campañas (nombre del consultor), Mi Camino.
- Nuevos: alerta crítica al consultor, comentario en tarea, tarea completada (con resultado),
  «Para hoy» y propuestas IA pendientes (`notification-daily.ts`, worker 8:00 Madrid).
- Llegar y verlo: `?focus=` + `components/focus-target.tsx` (destello) en Tareas, Alertas,
  Integraciones y permisos del consultor; `?chat=` en Mensajes; `?vista=` en Mi Camino; las
  tareas señaladas suben arriba de la lista.
- Migración `20270101100000_avisos_categorias_nuevas` (categorías) en TEST y PROD.
- El job `mobile-push` estaba programado sin rama en el worker: no se mandaba ningún push. Arreglado.

Pendiente: copy de los avisos de integración (viven en funciones SQL), prioridad media/baja de §3,
resaltar la nota nueva dentro de una campaña.
