# Mesa de trabajo del consultor: widgets, orden visual y animaciones

Fecha: 22 de septiembre de 2026.
Estado: propuesta de producto y diseño; no acredita funcionalidades implementadas.
Ámbito: mesa de cartera en `/consultor` y detalle de un cliente.

## 1. Qué pondría y por qué

La mesa debe ayudar al consultor a responder tres preguntas en pocos segundos: **qué necesita atención, por qué y cuál es la siguiente acción**.

Mi propuesta es una mesa sobria, compacta y con jerarquía clara. La cola de trabajo ocupa el espacio principal; la cartera permite comparar clientes; la agenda aporta contexto. Las métricas de negocio aparecen cuando ayudan a tomar una decisión.

Esta propuesta complementa el [plan funcional de mesa diaria](PLAN_MESA_TRABAJO_DIARIA_CONSULTOR.md). Se apoya en el [contexto de producto](../apps/web/PRODUCT.md) y conserva los [tokens visuales aprobados](decisions/ADR-0020-design-tokens-y-escala.md).

Supuesto de uso: un consultor entra varias veces al día, gestiona varios clientes y necesita preparar llamadas, desbloquear trabajo y revisar propuestas. Las recomendaciones siguientes describen cómo organizar esa experiencia; la disponibilidad de cada fuente debe comprobarse al implementarla.

## 2. Distribución de la pantalla

### Vista de cartera en escritorio

```text
┌────────────────────────────────────────────────────────────────────┐
│ Mesa de trabajo       Buscar cliente       Hoy · Actualizar         │
│ Mi cartera / cliente seleccionado                  Gestionar cartera│
├────────────────────────────────────────────────────────────────────┤
│ Clientes urgentes · Tareas vencidas · Revisiones pendientes · Datos │
├──────────────────────────────────────────┬─────────────────────────┤
│ PARA RESOLVER HOY                        │ AGENDA                  │
│ Todo · Urgente · Mi decisión · Datos     │ Próxima llamada         │
│                                          │ Hoy / próximos 7 días   │
│ Cliente · acción · motivo · responsable │                         │
│ Evidencia breve                 [Abrir] │ PREPARAR CONVERSACIÓN   │
│                                          │ Compromisos pendientes  │
│ Hasta 8 acciones             [Ver todas]│ [Preparar llamada]      │
├──────────────────────────────────────────┴─────────────────────────┤
│ CARTERA                                                            │
│ Cliente | Estado | Siguiente acción | Pendientes | Datos | Próximo  │
│ ...                                                                │
├──────────────────────────────────────────┬─────────────────────────┤
│ ESTA SEMANA                             │ ACTIVIDAD RELEVANTE     │
│ Hitos, campañas y compromisos            │ Decisiones y bloqueos   │
├──────────────────────────────────────────┴─────────────────────────┤
│ ▸ Pulso del negocio              ▸ Datos y conexiones              │
└────────────────────────────────────────────────────────────────────┘
```

La zona superior usa una proporción aproximada de dos tercios para trabajo y un tercio para agenda. La cartera ocupa todo el ancho. No impondría alturas fijas: las filas crecen cuando el contenido lo necesita.

La cabecera conserva el selector de organización existente. El filtro temporal de métricas, cuando corresponda, se muestra junto al bloque analítico: cambiar de 30 a 7 días no debe ocultar tareas vencidas ni cambiar el significado de «hoy».

## 3. Catálogo de widgets

P0 = primera entrega; P1 = ampliación; P2 = mejora posterior. «Visible» indica la composición propuesta por defecto, no el estado actual del código.

| Widget | Pregunta que responde | Contenido y acción | Posición | Prioridad |
| --- | --- | --- | --- | --- |
| Resumen de jornada | ¿Cuánto necesita mi atención? | Cuatro contadores filtrables: clientes urgentes, tareas vencidas, revisiones pendientes y problemas de datos. | Franja superior | P0 |
| Para resolver hoy | ¿Qué hago ahora? | Cola con cliente, acción, motivo, evidencia, responsable y vencimiento. CTA al módulo correspondiente. | Principal, visible | P0 |
| Cartera | ¿Cómo están mis clientes? | Tabla con estado explicado, siguiente acción, pendientes, salud del dato y próximo compromiso. | Ancho completo | P0 |
| Agenda | ¿Qué tengo por delante? | Llamadas y compromisos fechados, agrupados por día y cliente. | Lateral, visible | P0 |
| Preparar próxima llamada | ¿Con qué contexto entro? | Próxima cita, asuntos abiertos, último resumen aprobado y acceso a la ficha del cliente. | Junto a agenda | P1 |
| Esperando mi decisión | ¿Qué depende de mí? | Resúmenes de llamadas y propuestas IA por revisar. Abre el flujo de revisión. | Filtro de la cola | P0 |
| Esta semana | ¿Qué debo preparar? | Hitos de Camino, campañas y entregas próximas; muestra responsable y bloqueo. | Debajo de cartera | P1 |
| Mensajes pendientes | ¿A quién debo responder? | Cliente, antigüedad e hilo pendiente; vista previa breve cuando el permiso lo permita. | Integrado en cola | P1 |
| Actividad relevante | ¿Qué ha cambiado? | Decisiones, tareas cerradas y bloqueos resueltos con autor y fecha. | Bloque secundario | P1 |
| Datos y conexiones | ¿Puedo confiar en lo que veo? | Conector, última sincronización, cobertura y acción para corregir problemas. | Plegable; incidencias en cola | P0 |
| Pulso del negocio | ¿Dónde conviene profundizar? | Ventas y otras métricas disponibles, con periodo, cobertura y enlace al Dashboard. | Plegable | P1 |
| Clientes sin revisión reciente | ¿A quién estoy dejando atrás? | Última revisión explícita y próximo seguimiento. Requiere eventos fiables de revisión. | Filtro de cartera | P2 |
| Mis accesos | ¿Qué herramientas repito? | Accesos a Tareas, Llamadas, Camino y documentos vinculados. | Menú secundario | P2 |

No mostraría todos como tarjetas independientes. Revisiones y mensajes forman parte de la misma cola; los accesos viven en un menú. Así se cubre el trabajo sin llenar la pantalla de módulos redundantes.

### 3.1. Para resolver hoy: el widget principal

Cada fila debe permitir entender y abrir una acción sin leer una ficha completa:

```text
[Urgente]  Cliente de ejemplo
Reconectar Shopify
La sincronización falló; los datos necesitan actualizarse.
Fuente: Integraciones · Último intento: fecha real · Responsable: nombre
                                                   [Ir a Integraciones]
```

El ejemplo es ilustrativo. Cliente, fecha, estado y responsable se sustituyen por datos reales.

- Máximo ocho filas iniciales y «Ver todas» con el total.
- Una acción principal por fila; detalles adicionales mediante expansión o enlace.
- Orden estable: incidencias críticas, vencimientos, impacto documentado y antigüedad.
- Explicar el motivo de prioridad; evitar una puntuación opaca de riesgo.
- Si una alerta tiene una tarea asociada, representar una unidad de trabajo y enlazar ambas.
- Las actualizaciones en segundo plano no reordenan la lista mientras el usuario interactúa. Mostrar «Hay novedades» para aplicarlas de forma controlada.
- Completar, asignar o posponer solo aparece si existe una operación real con permiso y persistencia. En la primera entrega basta con abrir el módulo de origen.

### 3.2. Cartera: tabla operativa

Columnas propuestas, por orden:

1. **Cliente:** nombre y tienda cuando resulte necesario distinguirla.
2. **Estado:** urgente, revisar, vigilar o al día, con motivo accesible.
3. **Siguiente acción:** texto concreto y enlace.
4. **Pendientes:** tareas vencidas y decisiones por revisar.
5. **Datos:** actualizado, incompleto o conexión pendiente.
6. **Próximo compromiso:** fecha e hito o llamada.

Buscar por cliente y filtrar por estado, responsable y necesidad de revisión. Mantener el filtro al volver desde una ficha. El estado «al día» requiere cobertura suficiente: falta de datos no equivale a buena salud.

Ventas y ROAS serían columnas opcionales. Las cifras entre clientes solo se comparan con periodos, moneda y definiciones compatibles.

### 3.3. Preparación de llamadas

Mostrar la siguiente llamada y un botón «Preparar llamada». Este abre el cliente con tres bloques: decisiones pendientes, compromisos de la conversación anterior y cambios verificables del periodo.

Si hay resumen IA, identificarlo como borrador hasta su aprobación. Una llamada sin resumen muestra «Resumen pendiente»; no se reconstruye una conversación a partir de suposiciones.

## 4. Mesa de un cliente

Al abrir un cliente, conservar su identidad de forma visible y ofrecer «Volver a mi cartera». Usar el contexto existente y el enlace previsto `/consultor?organizationId=<id>`.

| Orden | Bloque | Qué pondría |
| --- | --- | --- |
| 1 | Cabecera | Cliente, tienda, estado de datos y siguiente acción principal. |
| 2 | Decidir ahora | Hasta tres acciones con evidencia y destino claro. |
| 3 | Estado del negocio | Cuatro a seis métricas disponibles: ventas netas, pedidos, ticket medio, inversión y rentabilidad cuando esté calculada correctamente. |
| 4 | Cambios relevantes | Comparación temporal explícita. «Desde mi última revisión» solo con una revisión guardada. |
| 5 | Camino y compromisos | Fase actual, siguiente hito, tareas vinculadas y principal bloqueo. |
| 6 | Relación con el cliente | Próxima llamada, resumen aprobado y mensajes pendientes. |
| 7 | Datos y administración | Conectores, cobertura financiera y gestión de tiendas según permisos. |

El detalle de una acción puede abrirse en un panel lateral para consultar contexto breve. La edición profunda sigue en su módulo. Al cerrar el panel, el foco vuelve al control que lo abrió.

La IA puede proponer y explicar; su bloque debe incluir fuente, fecha y evidencia. El CTA será «Revisar propuesta». Aprobar o publicar mantiene el flujo humano previsto por el producto.

## 5. Estilo visual

**Dirección:** herramienta de consultoría clara, precisa y cómoda para sesiones largas. El protagonismo lo tienen los nombres de clientes, las acciones y sus motivos.

| Elemento | Propuesta |
| --- | --- |
| Fondo | Blanco y superficies neutras según tokens existentes. |
| Acento | Acento actual de marca para selección, foco y acción principal. |
| Estados | Peligro para vencido/destructivo; aviso para atención; cada color acompañado por texto o icono con nombre accesible. |
| Tipografía | IBM Plex Sans existente. Títulos de página de 18 px; secciones de 16 px; filas de 14 px; descripciones de 13 px; metadatos de 12 px. |
| Cifras | Números tabulares; componente `Metric` cuando se trate de una métrica. |
| Separación | Escala aprobada de 4, 8, 12, 16, 24 y 32 px según el contexto. Usar el padding del componente compartido. |
| Bordes | Divisores suaves y radio existente de 6 px. |
| Tarjetas | Contenedores para bloques con identidad propia; listas internas separadas por líneas. |
| Botones | Una acción primaria por contexto; secundarias discretas y gestión en menú. |
| Iconos | Familia existente, significado constante y etiqueta accesible en botones sin texto. |
| Gráficos | Solo para comparar datos reales; etiqueta de periodo, fuente y alternativa textual. |

Máximo un badge de estado por fila. Responsable, canal, fecha y tienda se presentan como metadatos. Evitar la acumulación de etiquetas que compiten con el título.

Conservar los componentes de `apps/web/src/components/ui` sobre HeroUI v3. La propuesta no introduce otro catálogo ni cambia la identidad visual aprobada.

## 6. Animaciones y microinteracciones

El contrato visual actual permite transiciones de color de **100–150 ms** y excluye animaciones de layout. Adoptaría ese comportamiento como base: la mesa debe permanecer estable mientras se lee y se trabaja.

| Interacción | Comportamiento propuesto | Tiempo |
| --- | --- | --- |
| Hover de enlace o botón | Cambio sutil de color según el componente compartido. | 100–150 ms |
| Selección de filtro | Color activo y contador actualizado; conservar el foco. | 100–150 ms para color |
| Foco de teclado | Indicador existente, visible de inmediato. | Inmediato |
| Abrir detalles | Mostrar el panel o contenido con el comportamiento del componente aprobado; sin desplazar elementos mediante animación. | Sin animación añadida |
| Acción de red | Botón deshabilitado y texto «Guardando…» o «Actualizando…». | Feedback inmediato |
| Acción completada | Mensaje concreto de éxito; actualizar la fila al confirmar el servidor. | Inmediato |
| Error | Mensaje junto al bloque y opción de reintentar. | Inmediato |
| Carga inicial | Skeleton estático que reserva el espacio aproximado del bloque. | Sin bucle decorativo |
| Refresco de datos | Conservar contenido previo y mostrar «Actualizando». | Sin parpadeo |

No añadiría contadores que suben desde cero, tarjetas que entran en cascada, rebotes, efectos de brillo ni filas que cambian de posición por sí solas.

Respetar `prefers-reduced-motion`: eliminar cualquier movimiento no esencial y mantener todo el feedback mediante texto, color y estados accesibles. No hacer depender la comprensión de una animación.

Una futura transición de opacidad o deslizamiento necesitaría acordarse en el sistema visual antes de incorporarse. No es necesaria para esta propuesta.

## 7. Personalización sin perder el orden

Primera entrega: disposición fija y filtros útiles. No hace falta construir un editor de dashboards para validar la mesa.

Después, permitir:

- Mostrar u ocultar bloques secundarios como actividad y pulso del negocio.
- Guardar filtros personales y columnas opcionales de cartera.
- Restaurar la vista predeterminada.
- Recordar preferencias por usuario y ámbito autorizado, sin mezclar clientes ni organizaciones.

La cola principal y las incidencias que impiden interpretar datos siguen siendo visibles. Si más adelante se permite reordenar widgets, ofrecer controles de teclado equivalentes a arrastrar.

## 8. Tablet y móvil

- **Escritorio:** cola y agenda en dos columnas; cartera a ancho completo.
- **Tablet:** una o dos columnas según el espacio real; la agenda baja cuando comprime las acciones.
- **Móvil:** resumen, cola, próxima cita y cartera, en ese orden. Los bloques secundarios quedan plegados.
- La cartera móvil se convierte en filas apiladas: cliente, estado, siguiente acción y compromiso. Los datos secundarios se consultan al abrir el detalle.
- Los paneles laterales pasan a vista completa cuando no hay ancho suficiente.
- Los controles táctiles tienen una superficie cómoda, preferentemente de al menos 44 × 44 px, aunque el icono sea menor.
- A 200 % de zoom, el contenido se redistribuye sin cortar acciones ni ocultar el cliente activo.

## 9. Estados que deben diseñarse

| Estado | Respuesta de la mesa |
| --- | --- |
| Cartera vacía | Explicar cómo empezar y ofrecer crear o asignar cliente según permiso. |
| Todo al día | «No tienes acciones pendientes» y acceso a cartera y próximos compromisos. |
| Filtro sin resultados | Indicar qué filtro está activo y ofrecer limpiarlo. |
| Fuente sin conectar | «Conecta Shopify para consultar sus datos», con destino a Integraciones. |
| Datos incompletos | Mostrar qué falta y qué lecturas quedan limitadas. |
| Datos antiguos | Mostrar última actualización y posibilidad de refrescar según capacidad. |
| Error parcial | Mantener el resto de bloques; reintentar solo la fuente afectada. |
| Sin permiso | Explicar la limitación sin exponer información de otros clientes. |
| Demo o shadow | Identificar el modo de forma persistente y reflejar sus restricciones reales. |
| Muchas acciones | Mostrar total, filtros y paginación o carga adicional; conservar orden estable. |

«Sin datos», «cero» y «error» son estados diferentes. Beneficio y margen requieren costes y cobertura suficientes. Los ingresos atribuidos por distintas plataformas no se suman como si fueran ventas únicas.

## 10. Orden de entrega que recomiendo

### Primera entrega: resolver el día

Resumen de jornada, cola unificada, cartera, agenda básica y estado de datos. Enlaces correctos con cliente seleccionado, permisos aplicados y estados de carga, vacío y error. Estilo y transiciones del catálogo actual.

### Segunda entrega: preparar decisiones

Ficha de cliente, preparación de llamadas, cambios verificables, Camino y compromisos. Mensajes y propuestas IA dentro de la cola cuando las fuentes y permisos estén disponibles.

### Tercera entrega: adaptar el trabajo

Filtros guardados, bloques secundarios configurables y seguimiento de revisiones basado en eventos reales. Decidir estas mejoras tras observar el uso diario; mantener el aplazamiento de nueva telemetría recogido en el plan funcional.

## 11. Criterios para revisar el diseño

- Al entrar, se identifica la primera acción y su motivo sin abrir otra pantalla.
- Cada fila de trabajo nombra al cliente y lleva a un destino útil con el contexto correcto.
- La mesa permite preparar la próxima conversación sin reconstruir todo el historial.
- Los contadores y filtros usan las mismas definiciones; las entidades duplicadas no inflan la carga de trabajo.
- Una caída de un conector deja el resto de la mesa operativa y hace visible la limitación.
- Cargar la página no ejecuta IA, aprueba propuestas ni cambia estados de negocio.
- El teclado permite recorrer filtros, filas y paneles; cerrar un panel restaura el foco.
- Se comprueba la composición con cartera vacía, un cliente, diez o más clientes y nombres largos.
- Se revisa escritorio, móvil, zoom al 200 % y movimiento reducido.

**Mi elección para empezar:** cola de prioridades protagonista, cartera compacta y agenda lateral. Es la composición que mejor conecta el estado de los clientes con el trabajo concreto del consultor.
