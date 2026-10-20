# Especificación de UI y guía de implementación

Fecha: **19-10-2026**. Complementa el [plan principal](../PLAN_ORGANIZACION_CANALES_STOCK_Y_AUDITORIA_2026-10-19.md).

**Estado:** especificación propuesta, lista para descomponer en tickets. Los layouts, breakpoints y composiciones de este documento son objetivos de implementación, no pantallas ya construidas o verificadas visualmente. La disponibilidad de datos y operaciones sigue los límites de los cuatro informes de auditoría.

## 1. Dirección visual y reglas del producto

Modo de uso: operar una tienda y tomar decisiones con datos. Prioridad de lectura: **alcance → estado → recurso afectado → siguiente acción**.

Conservar [DESIGN.md](../../apps/web/DESIGN.md), IBM Plex Sans y el catálogo [components/ui](../../apps/web/src/components/ui/index.ts). Superficies blancas, fondo neutro, texto grafito y bordes discretos. Las marcas identifican el canal; no colorean todos los bloques.

Preferencias explícitas del usuario que prevalecen:

- Sin franjas superiores de color en las cards del dashboard.
- Acento de cada métrica en su título; tamaño orientativo 14.5 px y peso 600.
- Mini gráficas coherentes con su métrica; evitar el marrón compartido anterior.
- Variaciones favorables en verde y desfavorables en rojo, con flecha/signo y texto. En costes, una bajada puede ser favorable; un valor sin cambio es neutro.
- No reutilizar el color de un canal para indicar éxito o riesgo.

Estas preferencias se aplican al componente correspondiente, no autorizan cambiar toda la paleta de la aplicación. Al implementar, consolidar los tokens semánticos necesarios: el tema anterior neutraliza algunos colores de éxito y no debe volver a neutralizar las variaciones solicitadas.

### Escala propuesta

| Elemento | Regla |
| --- | --- |
| Título de página | 28 px/600 escritorio, 24 px móvil |
| Título de sección | 20–22 px/600 |
| Texto operativo | 14 px, interlineado 1.5–1.55 |
| Datos secundarios | 12–13 px; no esconder en ellos una condición decisiva |
| Números | Cifras tabulares; moneda y unidad visibles |
| Espaciado | Escala 4/8/12/16/24/32; separar secciones 24–32 |
| Controles | 40 px escritorio; objetivo táctil 44 px en móvil |
| Superficie | Radio 12 px y borde neutro; evitar tarjetas dentro de tarjetas |
| Color | Texto normal con contraste mínimo 4.5:1; foco/controles reconocibles sin color como único indicador |

## 2. Shell y navegación

Reutilizar PortalShell, el contexto de organización/conexión y el catálogo de navegación actual. No construir un segundo shell para cada canal.

En escritorio, el sidebar selecciona área y canal; el submenú contextual contiene sus recursos. Solo se expande la rama que se está usando. Cabecera persistente con organización, tienda y cuenta publicitaria/Klaviyo cuando corresponda. Diferenciar tienda comercial y activo del proveedor.

En móvil, menú en Drawer y alcance visible en la cabecera. Una navegación secundaria larga usa selector accesible o lista; evitar una fila horizontal de diez tabs.

Reglas:

1. El recurso seleccionado tiene un solo destino canónico.
2. El canal operativo y Analítica tienen etiquetas y breadcrumbs distintos.
3. Acciones de escritura exigen un objetivo concreto; la cartera agregada sirve para investigar.
4. La conexión no autorizada muestra un estado de acceso y cómo resolverlo.
5. Cambiar tienda limpia selecciones, invalida datos ajenos y protege borradores no guardados.
6. Sidebar, breadcrumbs, buscador, notificaciones y copiloto comparten registro de destinos.

## 3. Cuatro patrones de pantalla para construir el sistema

### A. Colección operativa

Para catálogo, inventario, descuentos, campañas, anuncios, emails, audiencias y formularios.

```text
Breadcrumb                             Tienda / cuenta
Inventario                             [Acción principal]
Estado del dato · última lectura · alcance
Resumen breve: agotados | bajo mínimo | sin seguimiento
Buscar...   Estado   Ubicación   [Filtros] [Limpiar]
Filtros activos y número de resultados
-------------------------------------------------------
Tabla o rejilla del recurso
-------------------------------------------------------
Resultados y paginación
```

La búsqueda y los filtros llevan directamente al trabajo. El resumen solo contiene contadores que se pueden explicar y filtrar. Etiquetar la unidad: variantes, productos o unidades; no mezclar contadores de endpoints distintos.

### B. Detalle de recurso

Para producto, variante, descuento, campaña, anuncio, email y formulario.

```text
Ruta / recurso                       [Abrir en proveedor]
Nombre · identificador · estado       [Acción principal]
Dato actualizado... / evidencia incompleta...
Resumen | Contenido | Relaciones | Actividad
Contenido principal                  Contexto / acción
Historial y resultado de cambios
```

Las tabs representan vistas del mismo objeto y conservan URL. En pantallas estrechas el contexto pasa debajo del contenido. Un Sheet sirve para inspección o una edición breve; un editor complejo tiene página propia. Abrir una fila puede ofrecer preview, pero el nombre del recurso siempre conserva un enlace al detalle completo.

### C. Espacio de trabajo

Para Studio, flow, formulario, reposición y revisión web.

```text
Objeto · estado guardado       [Vista previa] [Acción]
Herramientas | Documento / vista | Propiedades / evidencia
Validación y cambios pendientes
```

Un solo editor por tipo de documento. Mostrar estado guardado y versión; proteger cambios al salir. Deshacer/rehacer se refiere al documento local y no promete revertir un envío remoto.

### D. Analítica

Periodo, comparación, moneda y fuente encima de las cifras. Cada gráfica responde una pregunta e incluye unidad, leyenda y alternativa tabular. Las recomendaciones enlazan al recurso operativo. La tabla principal no desaparece detrás de párrafos de IA.

## 4. Reutilización de componentes

Confirmados en el catálogo actual: Breadcrumbs, Heading, Button, ButtonLink, Table, Pagination, Tabs, Badge, Banner, Field, Input, Select, Combobox, DateRangePicker, Sheet, Drawer, Dialog, ConfirmDialog, AsyncState, EmptyState, ErrorBlock, IntegrationStatusBadge, AiEvidence y componentes de gráficas.

| Necesidad | Reutilización / composición propuesta |
| --- | --- |
| Cabecera y alcance | PortalShell + Breadcrumbs + Heading + controles existentes |
| Estado de conexión/datos | IntegrationStatusBadge, Banner y presentación común de frescura |
| Lista paginada | Table + Pagination; filtros con Field/Input/Select |
| Estado vacío/error/cargando | AsyncState, EmptyState, ErrorBlock |
| Detalle breve | Sheet; formulario complejo en página |
| Evidencia IA | AiEvidence y bloque de decisión estructurada |
| Acción sensible | ConfirmDialog solo cuando la decisión necesita confirmación |
| Publicación/job | Estado persistente de operación; Toast como confirmación secundaria |

Composiciones nuevas sugeridas, **todavía no componentes existentes**: cabecera de recurso, barra de filtros, estado de calidad del dato, bloque de decisión de stock y panel de resultado de acción. Crearlas cuando el primer recorrido las necesite; extraer lo compartido al confirmar un segundo uso. No crear un framework de listas antes de entregar Inventario.

## 5. Estado de lista y URL

Campos propuestos de navegación: organización/tienda/activo según el contrato existente, búsqueda, filtro, orden, dirección, página, tamaño y vista. Usar nombres consistentes y listas de valores permitidos; el servidor valida todo.

- Escribir en búsqueda puede usar debounce; Enter confirma. Volver desde el detalle recupera contexto.
- Cambiar búsqueda, filtro, orden o tienda reinicia la página.
- Orden estable con desempate por ID; paginación del servidor en conjuntos grandes.
- Filtros activos visibles, botón Limpiar y descripción del universo consultado.
- Sin selección masiva entre tiendas. Mantener explícito si se seleccionó esta página o todos los resultados.
- No emitir consultas del proveedor por cada tecla/render; consumir API propia, caché y sincronización.
- Navegación atrás/adelante y URL compartida deben restaurar filtros. Una inicialización de filtro solo al montar es una solución provisional, no el contrato final.
- Si un recurso desaparece o pierde permiso, mostrar su estado; no abrir otro silenciosamente.

## 6. Especificación prioritaria: Inventario y Reposición

### UI-INV-01 · /shopify/inventario

**Pregunta:** qué variantes necesitan atención, dónde y antes de cuándo.

Vista por defecto: tabla de variantes con riesgo primero. Filtros: agotado, bajo mínimo, riesgo durante campaña, riesgo posterior, dato antiguo/parcial, sin seguimiento; ubicación, producto y campaña.

| Columna | Contenido / comportamiento |
| --- | --- |
| Producto / variante | Miniatura pequeña, nombre enlazado, talla/color y SKU |
| Ubicación | Nombre y elegibilidad para el canal |
| Disponible | Unidades según definición de origen; desconocido = “Sin dato” |
| Dato | Fecha de lectura y estado de cobertura |
| Horizonte | Campaña o periodo del escenario |
| Saldo tras campaña | Solo si se puede calcular; etiqueta “Escenario” |
| Primer riesgo | Fecha condicional y motivo; no fecha garantizada |
| Reposición sugerida | Cantidad y estado de cálculo o dependencia que falta |
| Acción | “Ver previsión”, “Completar proveedor” o “Revisar sincronización” |

La primera pantalla puede entregar solo columnas con datos fiables. No rellenar las otras con cero. En móvil conservar producto, disponible, estado y siguiente acción; columnas secundarias en detalle. Permitir desplazamiento horizontal en una región nombrada si hace falta comparación tabular.

### UI-INV-02 · Detalle de variante

Orden de lectura: disponible y fecha → decisión → gráfico diario → campaña/entradas → proveedor/política → evidencia.

La curva muestra saldo proyectado, línea de seguridad, recepción confirmada y tramo de campaña. Base y escenario comercial se distinguen por leyenda y trazado, no solo color. No mezclar ventas reales y demanda proyectada sin separación temporal.

El bloque principal responde:

1. Qué variante tiene el problema y cuántas quedan.
2. Qué ocurriría antes/durante/después de campaña bajo el escenario indicado.
3. Qué cantidad se propone y para qué recepción.
4. Qué supuesto o dato condiciona la propuesta.
5. Qué acción puede realizar el usuario ahora.

### UI-REP-01 · /shopify/reposicion

Tabla de necesidades por proveedor y fecha requerida, con entradas confirmadas separadas de propuestas. Formularios: plazo y procedencia, seguridad, MOQ, múltiplo, cantidad, ETA y estado. Ninguno de esos valores se inventa desde el LLM.

Acciones iniciales: completar datos, guardar escenario, crear/abrir tarea, registrar confirmación y recepción según implementación. “Pedir al proveedor” solo se habilita cuando exista ese flujo real. Guardar una propuesta no modifica disponible en Shopify.

Al aprobar: releer stock, campaña, entradas y política. Si cambiaron, mostrar cantidades anteriores y nuevas antes de continuar. Una recomendación caducada no se aplica silenciosamente.

### UI-DASH-01 · Decisión de stock en Inicio

Hasta tres decisiones priorizadas, sin listado largo de hallazgos técnicos:

```text
Sudadera Arena · M
Quedan 30 · inventario actualizado hace 12 min
En este escenario terminarías la promoción con 6.
Prepara 20 para recibir antes del 27 de noviembre.
Supuesto: aumento de demanda pendiente de validar.
[Ver previsión]   [Abrir tarea]
```

Es un ejemplo hipotético; los números completos y sus supuestos están en el anexo A06. Si el dato es antiguo, sustituir la recomendación por “No podemos confirmar la necesidad: inventario sin actualizar desde…” y una acción de sincronización. Los contadores deterministas pueden permanecer con su fecha y alcance.

## 7. Fichas de pantallas por canal

### Shopify

| Pantalla | Vista y campos principales | Acción inicial / detalle |
| --- | --- | --- |
| Catálogo | Tabla por defecto, rejilla opcional; producto, SKU, estado, precio, variantes, calidad | Abrir ficha; ficha enlaza inventario, promociones y activos relacionados |
| Colecciones | Nombre, tipo, estado y cantidad de productos | Abrir miembros y reglas; editar solo campos soportados |
| Promociones | Nombre, tipo automático, vigencia, productos, estado y límites | Abrir regla; editor comparte dominio de descuentos |
| Códigos | Código, nombre, vigencia, requisitos, uso y estado | Crear/editar tipo soportado; mostrar conflictos y fecha efectiva |
| Popups | Preview, proveedor, borrador/live, páginas/segmento objetivo y última sync | Abrir editor canónico o proveedor; separar “pieza diseñada” de “instalado” |
| Páginas/contenido | Título, URL/slug, tipo, publicación y origen | Editar el campo soportado o abrir editor externo; evitar prometer constructor universal |
| Web y revisiones | Captura, URL, viewport, fecha, revisiones y hallazgos | Analizar o comparar; espacio de trabajo descrito en sección 10 |

Los formularios de descuentos deben especificar tipo, valor, productos/colecciones, vigencia/zona horaria, elegibilidad, límites y combinaciones admitidas. Mostrar resumen legible antes de aplicar. Un importe exige moneda; un porcentaje exige rango válido; las condiciones se validan también en servidor.

### Meta

| Pantalla | Vista y campos principales | Acción inicial / detalle |
| --- | --- | --- |
| Campañas | Nombre, objetivo, estado remoto, presupuesto aplicable y cuenta | Abrir jerarquía; no presentar dry run como creación |
| Conjuntos | Campaña, audiencia, presupuesto/calendario y optimización | Inspeccionar configuración soportada y anuncios |
| Anuncios | Preview, nombre, estado de revisión/entrega, conjunto y creativo | Abrir anuncio con creativo y landing |
| Creativos | Rejilla visual con filtros; origen, formato, producto, versión y usos | Abrir pieza local o creativo remoto según identidad |
| Audiencias | Nombre, tipo, disponibilidad/tamaño cuando exista y estado | Inspeccionar; edición condicionada a permiso y origen |
| Medición | Dataset/píxel, eventos y fecha de evidencia, incidencias | Resolver configuración; no declarar “medición correcta” por conexión activa |
| Catálogos | Fuente, catálogo, conjuntos y correspondencia de productos | Ver errores de correspondencia antes de ofrecer escritura |

Detalle de creativo: preview, texto, formato/ubicación, producto/landing, versión aprobada, anuncios que lo usan y resultados atribuidos con periodo. La maqueta local lleva etiqueta “Vista previa E-NORA”; preview oficial lleva su procedencia. Biblioteca global y biblioteca Meta son vistas de recursos relacionados, sin duplicar archivos.

Entrega inicial de escritura: crear en pausa, verificar recurso remoto y presentar estado. Activar requiere capacidad efectiva y revisión del presupuesto, destino y audiencia. El estado de revisión de Meta sigue visible aunque la petición de creación haya sido correcta.

### Klaviyo

| Pantalla | Vista y campos principales | Acción inicial / detalle |
| --- | --- | --- |
| Campañas | Nombre, audiencia, mensajes/canal, estado, programación y zona | Abrir campaña; revisar remitente, exclusiones y contenido antes de enviar |
| Flows | Nombre, disparador, estado y mensajes; vista de lista y canvas en detalle | Abrir definición y editar solo operaciones soportadas |
| Emails/mensajes | Asunto/nombre, canal, origen campaña/flow, plantilla y estado | Preview y relaciones; rendimiento en tab separada |
| Plantillas | Miniatura, tipo HTML/DnD, origen, versión y usos | Abrir Studio adaptado; avisar si una conversión crea un objeto nuevo |
| Listas/segmentos | Nombre, tipo, definición/tamaño y estado de procesamiento | Editar recurso según permiso; segmento no es lista manual |
| Perfiles | Identidad mínima, actividad y consentimiento por canal | Detalle con historial; pertenecer a lista no concede consentimiento |
| Formularios | Preview, draft/live, tipo, páginas objetivo, versión y sync | Editar draft, preview y publicar si el contrato soportado lo permite |
| Cupones | Contenedor/código, disponibilidad, origen y usos conocidos | Enlazar descuento del comercio cuando exista correspondencia |

Canvas de flow: herramientas a la izquierda, grafo central y propiedades del nodo a la derecha. Tipos de nodo no editables conservan lectura y explicación. Una transición a live explica el efecto sobre comunicaciones y perfiles; no esconderla como un simple Guardar.

Editor de formulario: documento draft, preview móvil/escritorio, destino de suscripción/consentimiento y condiciones de aparición. Preservar campos que nuestro editor no comprende o bloquear su edición; no borrarlos al serializar una definición parcial. A/B y operaciones no cubiertas enlazan al editor nativo.

## 8. Estados obligatorios y microcopy

| Estado | Presentación y siguiente paso |
| --- | --- |
| Cargando sin datos | Skeleton de estructura estable y etiqueta de carga; ningún cero ficticio |
| Refrescando con datos | Mantener datos con fecha y estado “Actualizando”; evitar saltos de layout |
| Vacío real | “Todavía no hay…” y acción válida de conectar/importar/crear |
| Sin resultados | Mostrar filtros activos y “Limpiar filtros”; no sugerir reconexión por una búsqueda vacía |
| Conexión ausente | Proveedor y “Conectar…” |
| Permiso insuficiente | Se puede mostrar lectura útil; explicar qué operación falta y quién puede autorizarla |
| Datos parciales/antiguos | Banner concreto de alcance/fecha; no bloquear lectura histórica innecesariamente |
| Error | Mensaje útil, datos conservados cuando sea posible, Reintentar y referencia de soporte |
| Demo/shadow/dry run | Etiqueta visible antes y después de la acción; no mezclar con resultados remotos reales |
| Operación en curso | Objeto/acción y estado; evitar doble envío; abandonar pantalla no pierde seguimiento |
| Resultado desconocido | “Estamos comprobando si se aplicó”; reconciliar antes de permitir reintento |
| Conflicto concurrente | Diferencias y opción de recargar/revisar; no sobrescribir silenciosamente |
| Entidad eliminada | Contexto y retorno a lista; no sustituir por otro recurso |

Ejemplos: “Preparar anuncio” para dry run; “Crear en pausa” para una escritura real con ese efecto; “Programar envío” muestra cuándo y a quién; “Sin dato” expresa desconocido; “0 unidades” exige evidencia.

No llenar la interfaz de scopes, payloads o códigos de infraestructura. La UI muestra “Falta permiso para publicar formularios” y un siguiente paso; los detalles técnicos quedan en un desplegable de soporte.

## 9. Analítica y dashboard

Inicio conserva pocas métricas decisivas y una cola de acciones. Las páginas operativas muestran indicadores secundarios solo cuando ayudan a elegir recursos.

Analítica ofrece periodo/comparación, moneda, fuentes y frescura. Beneficio con costes incompletos se etiqueta provisional. Meta y Klaviyo muestran atribución por separado; una gráfica de negocio no suma sus ingresos atribuidos a Shopify.

Cada alerta lleva entidad y destino semántico: abrir Inventario afectado, código concreto, anuncio rechazado, mensaje o hallazgo web. El texto de IA debe poder verificarse desde la pantalla destino. Registrar “Ver más análisis” como destino distinto de “Resolver”.

## 10. Web y revisiones: layout operativo

Espacio central de captura o navegador autorizado; panel lateral con hallazgos y panel de evidencia. Cabecera con URL, fecha, viewport y modo: captura o sesión en vivo.

Filtros de hallazgos: claridad comercial, experiencia móvil, contenido, accesibilidad y rendimiento medido. Cada hallazgo incluye observación, evidencia, URL/elemento, hipótesis si aplica y siguiente acción. Seleccionarlo resalta su zona en la captura cuando exista localización fiable.

Captura anterior y actual se pueden comparar. Si la web impide iframe, ofrecer captura o enlace externo con explicación breve. Un fallo de acceso no se presenta como defecto de conversión de la tienda.

Acciones iniciales: Analizar, Comparar revisión y Crear tarea. Publicar cambios pertenece a otro recorrido con capacidades concretas, diff y preview; no es un botón genérico del visor.

## 11. Responsive, accesibilidad y rendimiento

Breakpoints propuestos, a validar sobre el contenido real: menos de 640 px móvil; 640–1023 compacto; desde 1024 escritorio. Usar también contenedores donde el shell reduzca el ancho disponible.

- Tabla semántica con encabezados y regiones de scroll nombradas; miniaturas no sustituyen nombres.
- Filtros principales visibles; filtros adicionales en Sheet/Drawer con Aplicar y Limpiar.
- Acciones de fila con nombre accesible y foco visible; no depender del hover.
- Menú de acciones secundarias; una acción primaria por nivel de decisión.
- Diálogos con foco inicial/retorno, escape y título; resultado de validación asociado al campo.
- En zoom 200 % siguen accesibles recurso, estado y acción; no cortar cantidades/monedas decisivas.
- Imágenes con tamaño reservado, carga diferida fuera de pantalla y alt útil cuando aportan información.
- Paginación/filtrado servidor; evitar miles de filas/preview pesados simultáneos.
- Estados de carga y resultados anunciables sin leer de nuevo toda la página.
- Respetar reducción de movimiento; las transiciones no retrasan acceso a datos.

## 12. Ficha obligatoria antes de codificar cada pantalla

Copiar esta estructura a cada ticket:

1. ID UI, ruta canónica y rutas antiguas que conserva.
2. Persona/rol, tarea y criterio de éxito.
3. Proveedor, organización/tienda/activo y recurso objetivo.
4. Patrón A/B/C/D y wireframe del contenido.
5. Campos y columnas con unidades, procedencia y tratamiento de null.
6. Filtros, orden, paginación y contrato URL.
7. Lecturas/API/contratos existentes que reutiliza y datos que faltan.
8. Acciones: efecto local/remoto, permiso, confirmación, estado y recuperación.
9. Estados de sección 8, responsive y teclado.
10. Casos de aceptación, dependencias y evidencia de revisión.

No inventar una respuesta API para desbloquear frontend: añadir un contrato propuesto y señalar qué parte del backend necesita implementarse. Mockups/fixtures llevan etiqueta y no se conectan como datos reales.

## 13. Orden recomendado para implementarlo con menos retrabajo

1. Cerrar bloqueos P1 y fijar registro de destinos/capacidades.
2. Construir Inventario de lectura con datos reales y estados completos.
3. Extraer de ese recorrido las composiciones realmente compartidas.
4. Añadir detalle de variante y reposición determinista.
5. Reutilizar patrones para catálogo/códigos y listas de canal.
6. Conectar Studio y recursos remotos; habilitar escritura por operación probada.
7. Entregar Web y revisión con evidencia.
8. Migrar analítica/rutas antiguas y verificar el recorrido completo.

### Aceptación visual y funcional por entrega

Una revisión conjunta de escritorio y móvil con dato normal, vacío, error y permiso limitado; corregir los problemas encontrados y confirmar el resultado. Se aceptan layouts al comprobar recurso, estado, alcance y siguiente acción en pocos segundos, sin depender de explicación externa.

También deben pasar: abrir URL filtrada, entrar desde aviso/tarea, volver al listado, cambiar tienda, denegación por rol y resultado de acción remota cuando exista. Capturas estáticas no sustituyen esas comprobaciones.

Esta especificación reduce decisiones de interfaz durante la implementación. Los mocks visuales de alta fidelidad, los contratos API nuevos y la verificación real siguen siendo entregables de cada recorrido; no se consideran terminados por haber escrito el documento.
