# Plan de mejoras de Mi Camino

## Propósito

Mi Camino debe ayudar a cada tienda a mejorar y consolidarse a partir de su situación real. No debe reducir todos los caminos a crecimiento económico, tres fases, plazos iguales ni un número fijo de hitos o tareas. La persona participa aportando el contexto que los datos conectados no pueden explicar; el sistema lo conserva para evitar volver a preguntar lo mismo.

Este documento es la guía de producto e implementación. Los puntos marcados como **pendientes** son propuestas acordadas para continuar, no funcionalidades terminadas.

## Principios de producto

- Diagnosticar antes de recomendar y explicar qué datos se revisaron, cuáles faltan y cuáles no son fiables.
- Elegir el objetivo según la necesidad de la tienda: cliente, producto, conversión, retención, captación, operaciones, medición, rentabilidad u otra prioridad respaldada por el contexto.
- Preguntar solo por datos que puedan cambiar una decisión. Permitir «No lo sé todavía» y convertir la incertidumbre relevante en una comprobación o aprendizaje del camino.
- Ajustar fases, hitos, tareas, fechas y dependencias al trabajo real. No dividir el horizonte en partes iguales por defecto.
- Distinguir hechos medidos, declaraciones del equipo, sugerencias estacionales y supuestos del agente.
- Guardar el contexto con alcance de tienda y permitir revisarlo, corregirlo y retirar datos que hayan caducado.
- Toda propuesta es revisable. La generación de un borrador no equivale a activar una campaña, publicar contenido ni enviar mensajes.

## Estado actual

Hay una primera versión local del recorrido guiado: prioridad, resultado deseado, mercado, fechas, límites y aprendizajes; revisión de señales disponibles; preguntas adaptadas a la prioridad; y persistencia del contexto por tienda. A19 recibe las respuestas como contexto declarado y tiene instrucciones para no imponer un objetivo económico ni duraciones de fase iguales.

La primera sugerencia automática de calendario cubre Black Friday y Navidad. Las fechas locales, temporadas propias y aniversarios todavía dependen de lo que confirme o aporte el equipo. Este trabajo está en el árbol local; aún no está validado mediante pruebas ni desplegado.

## Mejoras acordadas y orden de trabajo

### 1. Cerrar el diagnóstico adaptativo

La selección de prioridades admite de una a tres áreas; la primera es la principal. No se puede avanzar sin elegir al menos una. Las opciones se guardan como conocimiento de tienda, conservando la lectura de registros anteriores que solo tenían una prioridad.

**Objetivo:** que el formulario descubra qué sabe ya la plataforma y pregunte solo lo que falte para tomar decisiones.

- Revisar datos de Shopify, finanzas, stock, camino anterior, tareas, alertas y futuras fuentes conectadas.
- Mostrar a la persona qué fuentes se consultaron y si se pudieron leer; no presentar una consulta exitosa como prueba de que los datos estén completos.
- Adaptar las preguntas a la prioridad y a los huecos reales. No volver a pedir métricas que ya se obtienen de una integración.
- Pedir capacidad del equipo cuando cambie el plazo o el orden de las fases.
- Tratar «No lo sé» como incertidumbre explícita, no como respuesta afirmativa ni como dato medido.
- Guardar las respuestas para futuras planificaciones, indicando su alcance y permitiendo revisarlas.

**Criterio de aceptación:** dos tiendas con datos y prioridades distintas reciben preguntas distintas; el formulario no repite contexto ya guardado; y A19 puede proponer una primera acción útil cuando parte de la información sea desconocida.

### 2. Permitir caminos con estructura variable

**Implementación iniciada:** el contrato de propuesta ya incorpora tareas por hito, valida sus fechas contra el horizonte y el hito, las traduce a tareas reales enlazadas y las muestra en la revisión del borrador. A19 recibirá instrucciones sin cantidades objetivo fijas. Falta validar y desplegar el cambio.

**Objetivo:** dejar que A19 proponga la estructura que necesite el caso.

- El número de fases se decide por el diagnóstico, el horizonte, las dependencias, la capacidad y las fechas. No usar tres fases como plantilla obligatoria.
- Cada fase puede tener los hitos que hagan falta para representar resultados verificables, sin un número fijo impuesto por la interfaz.
- Cada hito puede tener las tareas necesarias para alcanzarlo, sin un número fijo impuesto por la interfaz.
- Evitar planes inflados: cada fase, hito y tarea debe justificar su contribución; consolidar acciones redundantes y declarar qué queda fuera del alcance.
- Aplicar límites técnicos de seguridad solo para proteger la generación y la interfaz. Si se alcanza un límite, no truncar en silencio: avisar y pedir revisión o permitir continuar por partes.
- Revisar el contrato de salida, validación, persistencia, importación, mapa y vistas para que todas soporten estructuras de longitud variable.

**Criterio de aceptación:** propuestas cortas y largas pueden representarse de extremo a extremo; las fases no se rellenan para alcanzar una cantidad fija; no se pierden hitos o tareas al validar, guardar, cargar o editar.

### 3. Planificar campañas desde una fecha importante

**Implementación iniciada:** el equipo puede guardar varias fechas en el conocimiento de tienda y distinguir las confirmadas de las sugerencias del calendario. A19 recibirá una instrucción versionada para calcular hacia atrás desde un evento confirmado, justificar la antelación según la complejidad y convertir incertidumbres en validaciones previas. Falta aplicar la migración, desplegar y validar propuestas con fechas de tiendas reales.

**Objetivo:** convertir una fecha comercial confirmada en un plan progresivo hacia ese evento.

Para cada fecha, A19 debe considerar:

- mercado y calendario aplicable;
- fecha confirmada o fecha sugerida que requiere confirmación;
- objetivo de campaña, público y canales relevantes;
- tiempo para revisar stock, oferta, segmentación, contenido, aprobaciones y pruebas;
- dependencias y capacidad del equipo;
- ventanas de comunicación antes, durante y después del evento.

**Mejora detectada al probar un horizonte de 12 meses:** el selector de mercados y fechas no puede limitarse a sugerir eventos del año de creación. Debe cubrir todo el horizonte del Camino, incluidas fechas del año siguiente si el plan cruza de año. Por ejemplo, un Camino de 12 meses creado en octubre debe poder contemplar Black Friday y Navidad del año siguiente cuando caigan dentro de sus fechas, además de los eventos pertinentes del año actual. El agente debe filtrar los eventos por mercado y por el intervalo real del plan, evitar duplicados y distinguir eventos recurrentes sugeridos de fechas confirmadas por la tienda.

El agente calcula hacia atrás desde la fecha del evento y justifica el tiempo de preparación. No se fija un aviso universal de «30 días antes»: una campaña compleja puede requerir más preparación; una acción menor, menos.

Black Friday, Navidad, verano, festivos locales, aniversarios y lanzamientos son candidatos, no supuestos de participación. Si la fecha o el mercado no se pueden verificar, pedir confirmación antes de comprometer el calendario.

### 4. Conectar camino, hitos, tareas y materiales de marketing

**Implementación local inicial:** las tareas cuyo título o categorías indican email/campaña pueden activar A11 desde el mapa y el árbol de Mi Camino, y desde el detalle de la tarea en Tareas. El servidor valida que la tarea y la tienda pertenecen al mismo ámbito, añade al agente el contexto verificado del hito y guarda el enlace de origen en el borrador de Marketing. Al terminar, abre ese borrador en el editor; el borrador muestra desde qué tarea y hito se creó. El contenido queda pendiente de revisión y no se envía ni programa. La generación usa idempotencia por tarea para no crear duplicados al repetir la acción.

**Seguimiento local añadido:** Camino carga los borradores enlazados de la tienda activa y muestra su estado en cada tarea y un resumen en el hito. La tarea cambia de «Activar agente» a «Abrir borrador» y vuelve a la misma pieza de Marketing. Tareas también muestra el estado y abre el borrador existente. La lectura se limita a usuarios con acceso al espacio de Marketing y al mismo ámbito de tienda.

Esta primera entrega cubre borradores de email de campaña. Falta ampliar el selector según el tipo de tarea y los agentes apropiados, y permitir actualizar el mismo material enlazado cuando el trabajo de la tarea cambie. La tarea, hito y borrador conservan ahora la relación en el contexto JSON del borrador; si hace falta consultar o filtrar estas relaciones a escala, se añadirá una tabla relacional específica.

**Objetivo:** que el trabajo de campaña sea ejecutable desde Mi Camino y reutilice los objetos de Marketing existentes.

- Una campaña vive como iniciativa dentro del camino y enlaza con sus fases e hitos.
- Las tareas describen el trabajo y sus responsables/fechas; una tarea de mailing puede ofrecer «Activar agente de email».
- El borrador generado vive en Marketing como plantilla o contenido independiente, y conserva enlaces al camino, hito, tarea, evento y campaña de origen.
- La misma acción puede iniciarse desde el hito, la tarea o la campaña; todas deben abrir o actualizar el mismo borrador enlazado, no crear copias huérfanas.
- Reutilizar la biblioteca y los flujos de borradores de Marketing/Klaviyo cuando proceda, en lugar de crear una biblioteca paralela dentro de Mi Camino.
- Mostrar estado del material: pendiente, en borrador, en revisión, aprobado, programado o enviado. No atribuir rendimiento a un borrador que no se ha enviado.

**Ejemplo de recorrido:** desde un hito «Preparar campaña de Black Friday», abrir la tarea «Crear email de acceso anticipado», generar una plantilla editable en Marketing y volver desde esa plantilla a la tarea y al hito relacionados.

### 5. Crear comunicaciones y avisos con anticipación

**Implementación local iniciada:** una nueva versión de A19 propone secuencias opcionales de tareas para eventos confirmados: preparar audiencia y condiciones, valorar lista de espera/acceso anticipado, crear y revisar comunicaciones, comprobar preparación antes del evento y medir después. Los plazos se calculan según complejidad, dependencias y capacidad. Eventos sugeridos sin confirmar solo generan una validación inicial, no una campaña completa. Las acciones quedan como tareas revisables; no se activan listas, descuentos ni envíos. Falta aplicar la migración y validar propuestas en Mi Camino.

**Objetivo:** ayudar a preparar la audiencia y la campaña a tiempo, no solo producir una pieza el día del evento.

El agente podrá proponer, si son pertinentes:

- captación para una lista de espera o segmento de acceso anticipado;
- aviso de inscripción y confirmación de condiciones de acceso;
- comunicación previa, apertura del acceso, lanzamiento y seguimiento;
- tareas de preparación de audiencia, contenido, stock y medición;
- fechas límite y recordatorios calculados hacia atrás desde el evento.

La lista de espera, el acceso anticipado y la secuencia de mensajes son opciones que el agente justifica; no se activan automáticamente. El porcentaje de descuento, el precio, las condiciones de acceso, la audiencia y las fechas comerciales deben proceder de datos o confirmación humana. El agente no inventa una promoción para completar el plan.

### 6. Aprobación y control de acciones

**Implementación local:** el flujo de Marketing ya separa borrador, revisión, aprobación y envío a Klaviyo; el backend bloquea el envío de una pieza que no esté aprobada. Al abrir desde Mi Camino, Marketing ahora muestra junto al borrador la lista de comprobaciones comerciales que debe revisar la persona antes de solicitar aprobación. No crea una aprobación automática ni activa el envío. Falta validar la experiencia de extremo a extremo.

**Objetivo:** mantener revisión humana en acciones con efecto comercial o público.

- A19 puede proponer y crear borradores editables.
- El equipo revisa oferta, descuento, elegibilidad, audiencia, fechas y contenido antes de programar o publicar.
- Enviar emails, activar segmentos, aplicar descuentos o publicar cambios requiere la autorización correspondiente en el flujo existente.
- Una revisión posterior puede cambiar fechas y tareas sin duplicar campañas, borradores ni recordatorios.

### 7. Seguimiento y aprendizaje

**Implementación local y migración aplicada:** la revisión semanal de A19 guarda aprendizajes con evidencia, ámbito de aplicación y nivel de confianza en el historial fechado del Camino. Una persona autorizada puede aprobar un aprendizaje para guardarlo en el Conocimiento de esa tienda; A19 vuelve a recibirlo al crear futuros Caminos de ese mismo ámbito. El contrato del agente pide revisar todas las fases, hitos, tareas y fechas de eventos, justificar retrasos o cambios y no duplicar tareas operativas. La pantalla muestra todos los avances, riesgos y aprendizajes devueltos, sin recortarlos a tres. La migración está aplicada en TEST y producción; falta desplegar el código de aplicación para habilitar el flujo completo.

**Objetivo:** comprobar si la ruta avanza y adaptarla cuando la tienda cambia.

- Revisar cada hito contra su criterio de cierre y sus evidencias.
- Detectar retrasos, dependencias bloqueadas, nuevas alertas, cambios de stock y proximidad de eventos.
- Recalcular fechas al mover una fecha comercial, preservar historial y explicar qué tareas cambian.
- Registrar aprendizaje posterior a la campaña y utilizarlo en el conocimiento de la tienda, con fecha y alcance.
- No duplicar el trabajo que ya generan A04/A17/A18 u otros agentes; enlazarlo al hito correcto cuando corresponda.

### 8. Progresión mensual rentable conectada a Conocimiento

**Implementación local y migración aplicada:** el contrato del objetivo incorpora un valor y fundamento de revisión por cada mes del horizonte. A19 debe explicar una progresión gradual hasta la meta final y dejar cifras pendientes cuando falte evidencia. La revisión compara ventas, pedidos, AOV y métricas financieras contra el mes natural en curso y el mes anterior; para el primer mes cuenta desde el inicio del Camino y ajusta el ritmo esperado a los días transcurridos. Beneficio y margen quedan sin evaluación cuando faltan costes o datos financieros fiables. Las preguntas de entrada incluyen una opción económica que aclara cifra, métrica (ventas, beneficio o margen) y fecha. Una revisión puede guardar un aprendizaje candidato en Conocimiento de la tienda solo cuando una persona lo aprueba. La web compila; el typecheck del API sigue señalado por un fixture de test existente que no incluye las tareas requeridas. La migración está aplicada en TEST y producción; falta desplegar el código de aplicación para habilitar el flujo completo.

**Objetivo:** que el Camino sea una guía de avance del negocio, incluyendo una meta económica cuando sea relevante sin reducir toda la estrategia a facturación.

- Conservar baseline, moneda, ventana temporal y confianza; diferenciar ventas, margen y beneficio.
- Construir una progresión con un punto de revisión por cada mes del horizonte. Explicar cada escalón con datos, capacidad, dependencias, estacionalidad y estado de las bases.
- Si el baseline o los datos financieros no son fiables, pedir la comprobación necesaria y mantener el objetivo mensual pendiente en vez de fabricar cifras.
- En cada revisión, contrastar el ritmo del mes con el objetivo intermedio aplicable y la meta final; separar observación, explicación y causalidad.
- Equilibrar crecimiento económico con experiencia de cliente, producto, conversión, retención, operaciones, stock y medición.
- Guardar aprendizajes reutilizables por tienda con evidencia, periodo, alcance y confianza. Requerir aprobación explícita antes de que afecten futuras propuestas.

**Criterio de aceptación:** una tienda con baseline comparable ve objetivos mensuales progresivos que llegan exactamente a la meta final; con cobertura incompleta ve preguntas y meses pendientes de cuantificar; una revisión evalúa el escalón correspondiente; y una lección aprobada se reutiliza al preparar otro Camino de la misma tienda sin cruzar datos entre tiendas.

## Modelo conceptual de una campaña

| Objeto | Responsabilidad | Enlaces esperados |
|---|---|---|
| Fecha/evento | Ancla confirmada o pendiente de confirmar | tienda, fecha y mercado |
| Iniciativa de campaña | Estrategia hacia el evento | camino y fases |
| Hito | Resultado verificable previo, durante o posterior | iniciativa y fecha objetivo |
| Tarea | Acción asignable con responsable y plazo | hito, iniciativa y estado |
| Material de Marketing | Email/plantilla/contenido editable | tarea, hito, evento y estado de aprobación |
| Revisión de resultado | Resultado observado y aprendizaje | evento, material enviado y conocimiento de tienda |

Este es un modelo de producto propuesto. Antes de añadir tablas u objetos, comprobar si Planificación, Marketing, tareas y Mi Camino ya representan parte de estas relaciones.

## Dependencias de producto existentes

### Inteligencia estacional por tienda

**Implementación local en curso:** A19 consulta una serie mensual de Shopify de hasta 36 meses y puede usar búsqueda web de Anthropic para fechas oficiales y señales públicas de categoría. El prompt separa ventas observadas de la tienda, contexto declarado y tendencias externas; exige URLs citadas, limita cada búsqueda a cinco consultas y trata las oportunidades como hipótesis. Las fuentes y oportunidades estacionales citadas se guardan en un documento de Conocimiento asociado a esa tienda, con fecha de consulta y caducidad a 12 meses. El formulario solicita marca/categorías además del mercado y fechas relevantes. La serie requiere una tienda concreta para evitar mezclar marcas; si no está seleccionada, el agente no la usa como histórico propio. La migración está creada localmente y aún no se ha aplicado ni desplegado.

**Límites actuales que quedan visibles:** el acceso a búsqueda web está disponible en la ruta Anthropic; con OpenAI se deben omitir afirmaciones externas no verificadas. Los meses con cero pedidos no prueban que la sincronización cubra todo el periodo. Si faltan dos temporadas completas comparables, la señal propia se marca como preliminar. No se comparten cifras identificables entre tiendas.

- [Plantilla de Mi Camino](./PLANTILLA_MI_CAMINO.md)
- [Biblioteca de plantillas de Marketing](./PLAN_BIBLIOTECA_PLANTILLAS_MARKETING.md)
- [Planificación y tracking operativo](./PLAN_TRACKING_OPERATIVO_FASES.md)
- [Plan de tareas de IA](./PLAN_TAREAS_IA.md)
- [Revisión de agentes, sección A19](./REVISION_AGENTES.md)

## Fuera del alcance de esta guía

Este documento no autoriza envíos, descuentos, cambios en Shopify/Klaviyo ni publicaciones. Define la experiencia y las relaciones que deben diseñarse; cada acción ejecutable conserva los permisos, aprobaciones, aislamiento por tienda y controles de duplicados del producto.

## Línea posterior: previsión continua de stock (A06)

Esta capacidad se abordará después de cerrar las mejoras del creador de Mi Camino y dentro del planificador de stock A06. A06 ya compara ventas recientes con inventario actual y puede señalar riesgo de reposición; la previsión de demanda futura por temporada o evento no forma parte de esa capacidad actual.

La evolución deberá refrescarse semana a semana y cuando se acerquen eventos confirmados. Combinará ventas y estacionalidad observadas, promociones confirmadas, stock por variante, inventario entrante y plazos de proveedor cuando sean fiables. Deberá estimar rangos de demanda para el evento, existencias necesarias antes de empezar y riesgo de agotarse durante o después, indicando incertidumbre y calidad de datos. Si faltan cobertura, mapeo, sincronización o plazo de reposición, pedirá los datos necesarios y no inventará una cantidad de compra. El aviso se incorporará al seguimiento operativo y podrá proponer hitos o tareas enlazados al Camino; A06 mantendrá la responsabilidad de la previsión y las alertas de stock.
