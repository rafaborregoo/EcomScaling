# Auditoría de UI y accesibilidad: Hoy en Marketing

Fecha: 25 de octubre de 2026. Ruta: `http://localhost:3001/marketing?section=plan`.

## Dictamen

La estructura implementada es adecuada para una pantalla operativa: siguiente acción, resumen, semana, propuestas y atención. Conviene conservarla y corregir legibilidad, estados de datos y acceso a pendientes. No hace falta añadir una barra con más botones generales.

No se puede declarar accesibilidad completa con esta revisión. La herramienta de navegador devolvió `No browser is available`; el inventario posterior confirmó `apps: [], browsers: []`. No se han visto capturas, ni probado interacciones, zoom de navegador, lector de pantalla o tamaños reales de controles. Los hallazgos siguientes proceden de los archivos actuales, no de una observación del contenido de la sesión del usuario.

## Alcance y evidencias

- Fuente principal: `apps/web/src/app/marketing/today-view.tsx` y su uso en `page.tsx:1722`.
- Estilos: `marketing-views.module.css`, `marketing-polish.css`, `components/trabajo-ui.module.css` y `app/globals.css`.
- Componentes comunes: `trabajo-ui.tsx`, `ui/button.tsx` y `ui/card.tsx`.
- Contexto leído: `apps/web/PRODUCT.md`, `apps/web/DESIGN.md`, `apps/web/AGENTS.md`.
- Detector Impeccable ejecutado sobre `today-view.tsx` y `trabajo-ui.tsx`: resultado `[]`, código de salida 0. Ese resultado no valida contraste renderizado, teclado ni comportamiento asíncrono.
- Contraste calculado con luminancia relativa sRGB para los valores declarados, sin muestreo de píxeles ni estilos calculados del navegador.
- Sin cambios en código de aplicación.

## Hallazgos por prioridad

### P1 — La ausencia de datos se representa como un estado confirmado

Ubicación: `today-view.tsx:82`, `today-view.tsx:169`, `today-view.tsx:452`; integración en `page.tsx:1722`.

`connected = Boolean(workspace?.connected)` convierte también `undefined` en falso. Hoy recibe `workspace.data`, pero no `isLoading` ni `error`. Con colecciones vacías durante la primera carga puede anunciar «No hay nada pendiente para hoy» y ofrecer «Conectar Klaviyo» antes de conocer el resultado. Un fallo sin datos previos puede dejar mensajes equivalentes a un estado vacío. La consulta del plan y la de contexto tampoco exponen sus errores en esta vista.

Impacto: transmite tranquilidad o desconexión sin evidencia y puede ocultar una incidencia de carga.

Recomendación: distinguir carga inicial, resultado vacío confirmado, error y datos previos en actualización. Mostrar «Cargando tu actividad…» antes de confirmar pendientes; reservar la invitación de conexión para una desconexión confirmada y ofrecer «Reintentar» cuando falle la consulta. Anunciar cambios relevantes mediante una región de estado adecuada.

### P1 — Los pendientes posteriores al séptimo no tienen acceso desde el bloque

Ubicación: `today-view.tsx:406` y `today-view.tsx:409`.

La cabecera muestra `attention.length`, pero el contenido usa `attention.slice(0, 7)` sin expansión, paginación ni enlace al conjunto completo. Los tipos se concatenan: retrasadas, sin pieza, aprobaciones y flows. Una acumulación de los primeros tipos puede dejar fuera las aprobaciones o flows.

Impacto: el resumen promete más asuntos de los que permite consultar o resolver desde esa lista.

Recomendación: conservar un resumen acotado y añadir «Ver los N pendientes» o «Mostrar todos», con acceso real a la cola completa. Si se prioriza, hacer explícito el criterio. Es la principal acción adicional que sí está justificada.

### P2 — Textos pequeños y reducción global de escala

Ubicación: `globals.css:144`, `globals.css:148`; `marketing-views.module.css:355`, `:368`, `:390`; `trabajo-ui.module.css:116`.

Desde 1024 px de viewport se aplica `html { zoom: 0.9 }`. Esto reduce también los textos de Hoy. Con zoom de navegador al 100 %, las magnitudes visuales aproximadas resultan:

| Uso | Tamaño declarado | Tras escala 0,9 |
|---|---:|---:|
| Ayuda bajo indicadores | 12 px | 10,8 px |
| Descripciones y fechas secundarias | 12,5 px | 11,25 px |
| Etiquetas de indicadores | 13 px | 11,7 px |
| Calendario y título de pendiente | 13,5 px | 12,15 px |
| Texto principal y botones del bloque destacado | 14 px | 12,6 px |
| Título del bloque destacado | 20 px | 18 px |
| Cifras del resumen | 26 px | 23,4 px |

Son cálculos de CSS, no medidas del dispositivo del usuario. El tamaño pequeño por sí solo no demuestra una infracción WCAG.

Recomendación: revisar primero la escala global para evitar compensarla componente a componente. Objetivo de diseño: contenido principal 15–16 px; texto secundario y calendario 14 px; botones 14–15 px; títulos de sección 16–18 px. Interlineado 1,45–1,6 en descripciones. Son recomendaciones de legibilidad, no mínimos normativos. No ampliar todas las cifras o títulos de forma indiscriminada.

### P2 — La semana móvil requiere desplazamiento poco evidente

Ubicación: `marketing-views.module.css:221` y `:789`; `today-view.tsx:285`.

En móvil se mantienen siete columnas de al menos 104 px, más seis separaciones de 6 px: 764 px de contenido desplazable. La región tiene nombre accesible, foco y `overflow-x: auto`, lo que es una buena base. La instrucción de desplazarse está en `aria-label`, sin una indicación visible equivalente.

Impacto: un usuario puede no descubrir días fuera del recorte. No se ha confirmado un fallo de reflujo: el desplazamiento es local al calendario y requiere prueba visual.

Recomendación: ofrecer una vista de agenda por día para móvil o una señal visible de desplazamiento, fecha activa y acceso a hoy. Verificar también los anchos intermedios, donde las siete columnas son flexibles y pueden estrechar mucho los textos.

### P2 — Las entradas del calendario no ofrecen la misma interacción

Ubicación: `today-view.tsx:313` y `today-view.tsx:325`.

Las campañas de `dayRows` se dibujan como botones; otras acciones de canal se dibujan como `div` con la misma clase `ev`. Los eventos de negocio también son informativos. Los botones de campañas contienen nombre y estado, pero no incorporan una fecha completa u hora en su nombre accesible.

Impacto: elementos de apariencia similar tienen capacidades distintas; al recorrer botones con tecnología de asistencia falta contexto temporal en el propio nombre.

Recomendación: si una acción Meta permite detalle, hacerla activable; si es informativa, diferenciar su presentación. Vincular cada botón a su fecha mediante una etiqueta o descripción accesible, incluyendo la hora cuando exista. No convertir eventos informativos en falsos botones.

### P2 — «Hoy» queda fijado al montar el componente

Ubicación: `today-view.tsx:78`.

La fecha se guarda con `useState(() => Date.now())`, sin actualización posterior. Si la pestaña permanece montada al cambiar de día, el calendario y las prioridades siguen calculándose con la fecha anterior.

Recomendación: actualizar al cambiar de día y al recuperar visibilidad. No requiere un nuevo botón.

## Qué funciona bien

- El bloque principal cambia según el trabajo pendiente y usa acciones concretas: revisar, programar, resolver y escribir.
- La semana tiene una región desplazable con nombre accesible, foco y contorno de foco explícito.
- Los eventos activables del calendario declaran una altura mínima de 44 px antes de cualquier escala. Los botones compartidos contemplan dispositivos táctiles; el bloque principal llega a 44 px en móvil. Falta comprobar dimensiones renderizadas, incluida la escala global.
- Los estados se expresan con palabras y no dependen exclusivamente del color.
- Los indicadores aclaran que los ingresos se atribuyen por Klaviyo.
- La vista pasa a una columna bajo 1100 px; el bloque destacado permite que las acciones salten de línea.
- Existe tratamiento de movimiento reducido y una jerarquía de encabezados en el DOM.

## Contraste de los valores declarados

| Texto | Fondo | Relación calculada |
|---|---|---:|
| `#6b6662` | `#ffffff` | 5,67:1 |
| `#6b6662` | `#f8f7f5` | 5,30:1 |
| `#6b6662` | `#f9e6ef` | 4,75:1 |
| `#3d3b3a` | `#ffffff` | 11,14:1 |

Estos pares superan 4,5:1 para texto normal. No hay evidencia para oscurecer toda la interfaz. El margen del texto secundario sobre rosa es menor, por lo que conviene no añadirle opacidad. No se ha auditado cada estado, fondo o combinación de colores.

Referencia: [W3C: contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). El objetivo de 44 px para controles es una recomendación de comodidad; el criterio AA de WCAG 2.2 establece 24 × 24 CSS px con excepciones: [W3C: tamaño mínimo del objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Valoración por dimensión

No se asigna una nota global ni un porcentaje de cumplimiento sin inspección de la pantalla renderizada.

| Dimensión | Evidencia disponible | Pendiente |
|---|---|---|
| Accesibilidad | Contrastes declarados adecuados; controles nativos y foco explícito en varios componentes | Teclado completo, lector, zoom 200 %, contexto temporal y dimensiones reales |
| Responsive | Una columna y desplazamiento local implementados | Capturas móvil/tableta/escritorio y descubrimiento del desplazamiento |
| Temas | Tokens compartidos e identidad coherente con DESIGN.md | Estados renderizados y cualquier variante de tema disponible |
| Rendimiento | Consultas con caché y deduplicación; animaciones cortas | Métricas de carga, renderizado y respuesta; no se afirma que sea rápido o lento |
| Integridad | Detector sin hallazgos en los dos TSX escaneados | Resolver estados engañosos y acceso al conjunto de pendientes |

## Propuesta de acciones

Mantener una acción principal contextual y una secundaria cuando sea útil. Evitar añadir exportar, filtros o accesos genéricos sin un caso de uso observado. Conservar los accesos a Campañas; «Ver en Campañas» puede precisar qué abre, por ejemplo «Ver el plan en Campañas», manteniendo su destino real.

Orden recomendado: `$impeccable harden` para estados y pendientes; `$impeccable typeset` para legibilidad y escala; `$impeccable adapt` para el calendario; `$impeccable polish` como cierre después de verificar las correcciones.

La validación de cierre debe cubrir escritorio y móvil, teclado, 200 % de zoom y los casos de carga, error, datos vacíos, más de siete pendientes y nombres largos. Las capturas y pruebas de interacción siguen pendientes por falta de navegador disponible en esta sesión.
