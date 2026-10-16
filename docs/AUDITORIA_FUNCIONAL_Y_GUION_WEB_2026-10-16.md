# E-NORA: auditoría funcional y guion de la web pública

Fecha: 16 de octubre de 2026.

## Alcance y criterio de evidencia

Auditoría de capacidades para explicar el producto en la web de marketing: navegación de cliente y consultor, interfaces, contratos, APIs, conectores, cálculos, agentes y trabajos programados. Se contrastó el grafo del repositorio con el código actual; algunos fragmentos indexados y documentos históricos están desactualizados.

**Implementado** significa que hay un recorrido en el código. No demuestra que una cuenta de producción tenga credenciales, permisos, feature flags, datos o versiones de agentes activos. Esta revisión no ejecutó envíos, publicaciones, agentes de pago ni cambios en cuentas de proveedores. Tampoco es una auditoría exhaustiva de seguridad o rendimiento.

## Qué es realmente el producto

E-NORA reúne los datos y la operación del ecommerce: conecta canales, calcula indicadores, permite investigar sus resultados, propone decisiones con IA, construye planes, produce piezas de marketing y coordina su ejecución entre tienda y consultoría.

El recorrido es cíclico: conectar → contextualizar y medir → analizar → decidir → crear y ejecutar → colaborar → medir de nuevo. No requiere tener las tres aplicaciones conectadas para aportar valor. Shopify puede ser el punto de partida; Meta y Klaviyo amplían el contexto y las acciones disponibles.

La navegación tiene tres públicos: equipo de una tienda, consultor con cartera y administrador de plataforma. La web pública debe explicar los dos primeros; observabilidad, evaluación de agentes, facturación interna y administración pertenecen a la operación de la plataforma.

## Inventario funcional contrastado

| Área | Qué existe en el código | Condición o límite relevante |
| --- | --- | --- |
| Integraciones | Conexión, permisos, selección de activos/tienda, sincronización, histórico, estados y reautorización para Shopify, Meta y Klaviyo. Superficie adicional de Instagram. | La disponibilidad depende de configuración, feature flags y permisos. La documentación de piloto identifica Shopify como integración operativa validada y reserva validaciones externas para otros canales. |
| Inicio y dashboard | Prioridades, resumen por aplicación, tienda/organización, comparaciones, objetivos y acceso al detalle. Vista de cartera para consultores. | La calidad y el periodo del dato condicionan lo que puede interpretarse. |
| Economía del negocio | Ventas, ingresos sin impuestos, COGS, margen, costes de pago y envío, gastos fijos, inversión publicitaria, beneficio estimado, CAC blended, contribución por pedido y umbrales de equilibrio. | Necesita costes y monedas coherentes. No todo se importa desde Shopify; parte es configuración aportada por el negocio. |
| Shopify comercial | Ventas, ticket medio, productos destacados, descuentos y promociones; comparaciones con periodo anterior y año anterior. | Se basa en el histórico importado, no en una garantía de cobertura histórica completa. |
| Shopify clientes y conversión | Clientes nuevos/recurrentes, recompra, valor por cliente, cohortes, curva LTV, churn, payback, origen de demanda, sesiones, embudo y recuperación de checkout. | Algunas métricas requieren sesiones/ShopifyQL, cohortes maduras, costes y cobertura suficiente. |
| Catálogo y stock | Productos, variantes, imágenes, SKU, precio, disponibilidad por ubicación, actividad de venta, días de cobertura, previsión de demanda y componentes de bundles cuando están disponibles. | Es seguimiento, estimación y propuesta. No se encontró un recorrido operativo de compra a proveedores o ajuste automático de existencias. |
| Logística y posventa | Preparación, entrega, retrasos, incidencias abiertas, reembolsos y análisis relacionados con devoluciones. | El catálogo de ingesta todavía marca el detalle de devoluciones como `planned`; no prometer sincronización completa de motivos/devoluciones sin verificar ese bloque. |
| Meta Ads | Inversión, impresiones, clics, compras e ingresos atribuidos, ROAS, coste por compra, CPC/CPM, campañas, anuncios, creatividades, vídeo, rankings, aprendizaje, píxeles, audiencias y cambios. | Mantener ventanas de atribución, muestra suficiente y moneda. Los ingresos atribuidos no se suman a las ventas de Shopify. |
| Klaviyo analítica | Campañas y flows, inventario de emails, contenido y plantillas, ingresos y conversiones atribuidos, destinatarios, entregas, aperturas, clics, bajas, rebotes y spam; salud de medición y seguimiento. | Parte del reporting está agregado por mes; no describir todos los indicadores como datos en tiempo real. |
| IA especializada | Monitor de negocio, prioridades/tareas, stock, email, Shopify/retención/adquisición/posventa, Meta/creatividades/medición/cambios, contenido de emails y arquitectura de flows. Planificación semanal/mensual y revisión del Camino. | Cada agente necesita datos, versión activa, herramientas permitidas, presupuesto y configuración. Las propuestas sensibles pasan por revisión. |
| Copiloto | Conversación contextual, consultas a datos, metodología y documentos, lectura de tareas/alertas/plan/llamadas, explicación de cifras y generación de informes PDF. Atajos `/informe`, `/comparar`, `/embudo`, `/margen`, `/campañas`, `/tareas`. | Su alcance es la tienda y la información disponible. El registro de tools distingue lectura/propuesta/escritura; muchas escrituras autónomas siguen planeadas. |
| Camino y planificación | Diagnóstico ejecutivo, intake, contexto estacional/comercial, propuesta estratégica, fases, hitos, objetivos, tareas detalladas, aprobación, activación, calendario y revisión periódica. También importación de plan desde Markdown. | Crear una propuesta y activar un plan son decisiones distintas. La revisión periódica no debe dibujarse como un rediseño automático del plan aprobado. |
| Estudio de contenido | Diseño libre por bloques, plantillas, importación de Klaviyo, generación/mejora con IA, productos del catálogo, guía de marca, imágenes, canales email/Meta/Instagram/popup, preview móvil/escritorio, versiones y revisión. Prueba de email al usuario. | Crear o aprobar una pieza no equivale a publicarla en un proveedor. El test depende del servicio de correo configurado. |
| Campañas Klaviyo | Pieza aprobada → plantilla → destinatarios/exclusiones → remitente/asunto → programación/envío mediante Klaviyo; cancelación cuando procede y seguimiento. | Requiere conexión y permisos; las campañas pendientes de revisión del consultor tienen una guarda específica. |
| Flows Klaviyo | Diseñador con disparador, emails, esperas, condiciones, ramas y actualización de propiedades; validación y creación en Klaviyo con piezas aprobadas. La IA propone arquitectura de automatizaciones. | Los emails se crean en borrador. El agente de arquitectura propone; el constructor es el recorrido de creación. No se encontró activación autónoma por IA. |
| Creación para Meta | Piezas, textos y preview; preparación de jerarquía campaña/conjunto/anuncio con cuenta, objetivo y presupuesto. Existe un ejecutor de integración aislado. | La ruta usada por la interfaz devuelve `mode: dry_run` y `executionReady: false`; el ejecutor solo aparece llamado por tests en el grafo. La interfaz dice que todavía no crea nada en Meta. |
| Trabajo compartido | Tareas, responsables, prioridad, estados, fechas, comentarios, calendario, tracking, revisión de propuestas y notas de campañas. | La visibilidad cambia según rol y asignación; las notas internas no se deben representar como públicas. |
| Comunicación | Hilo por organización entre equipo de tienda y consultor, adjuntos privados, no leídos y seguimiento. Llamadas, transcripciones aportadas, análisis, resumen, compromisos y creación de tareas tras revisión. | No se encontró mensajería privada independiente entre compañeros o grupos arbitrarios, ni se verificó un servicio nativo de videollamada/transcripción en directo. |
| Conocimiento | Cuestionario del negocio, documentos, reglas, contexto y gestor IA de cobertura. Marca del cliente y contexto comercial para las propuestas y los diseños. | La metodología general y el contexto específico de la tienda deben representarse como dos fuentes que se encuentran. |
| Consultoría y cartera | Clientes, varias tiendas, prioridades transversales, reparto de trabajo, rentabilidad de consultoría, agenda y marca de consultora en informes. | Merece una entrada «Para consultores»; no todas esas pantallas pertenecen al cliente de una tienda. |

## Datos que merece la pena mostrar al conectar

La escena debe diferenciar **qué se importa** de **qué calcula E-NORA**. Mostrar solo «pedidos/campañas/emails» oculta la profundidad del producto; mostrar todas las columnas haría ilegible la explicación.

### Shopify

- Datos de entrada: pedidos y líneas, catálogo/variantes, clientes, inventario por ubicación, promociones/descuentos, cobros/reembolsos y preparación/entrega. Sesiones y checkout cuando existe cobertura y permisos.
- Indicadores prioritarios: ventas netas, pedidos, ticket medio, margen/beneficio con costes, conversión, recompra y cobertura de stock.
- Profundización: COGS, contribución por pedido, break-even, CAC blended, LTV/payback, cohortes, promociones y retrasos.
- Objeto propuesto: una tienda/almacén con caja de pedido, estantería, ficha de producto y lector de ventas; no solo un bloque verde.

### Meta Ads

- Datos de entrada: cuenta publicitaria, campañas, conjuntos, anuncios, creatividades, inversión, impresiones, clics, acciones y valor atribuido; píxeles, audiencias y actividad cuando están disponibles.
- Indicadores prioritarios: inversión, compras atribuidas, ROAS, coste por compra, CTR, CPC y CPM.
- Profundización: rendimiento del anuncio y vídeo, aprendizaje, salud de píxel/medición y comparaciones antes/después de cambios.
- Objeto propuesto: una pieza publicitaria en un proyector/visor, con su circuito de audiencia, clic y compra atribuida.

### Klaviyo

- Datos de entrada: campañas, flows, mensajes, asuntos/preheaders/cuerpos, plantillas, listas/segmentos e informes de rendimiento.
- Indicadores prioritarios: ingresos atribuidos, conversiones, entregas, clics, aperturas, bajas y rebotes; reparto campañas/flows.
- Profundización: entregabilidad, spam, seguimiento/UTM, rendimiento de cada email, secuencia y contenido.
- Objeto propuesto: un distribuidor de mensajes que abre una bifurcación de flow y un email; permite pasar de resultado agregado a pieza concreta.

Los ingresos de Shopify, Meta y Klaviyo describen perspectivas que pueden solaparse. La web debe mostrar «ventas del negocio» y «atribución de cada plataforma» por separado. Tampoco debe equiparar coste por compra de Meta con CAC de clientes nuevos sin explicar el denominador.

## Hallazgos para corregir la comunicación

1. **Las cuatro escenas actuales cubren una fracción del producto.** Faltan catálogo/stock, economía, emails concretos, creación libre/IA, flows, copiloto, informes, Camino y colaboración.
2. **La IA está demasiado agrupada.** Los agentes automáticos detectan y proponen; el copiloto responde/investiga/genera informes; el arquitecto del Camino construye estrategia. Necesitan escenas y ejemplos distintos.
3. **No hay paridad de publicación entre Klaviyo y Meta.** Klaviyo tiene una ruta de envío/programación; Meta está en preparación local del plan. Esta diferencia debe aparecer también en los dibujos.
4. **Los conectores no son todo el contexto.** Costes, objetivos, marca, restricciones y documentación aportados por la persona hacen posibles los análisis y diseños útiles.
5. **El software distingue dato ausente de cero y fuente de atribución.** El marketing debe conservar esa precisión sin trasladar al visitante detalles técnicos de tablas o flags.
6. **Chats es un hilo compartido por tienda.** El equipo puede participar según permisos; los mensajes privados entre dos compañeros no están demostrados por este recorrido.
7. **Hay documentación histórica que infrarrepresenta el estado del código.** `AGENT_CATALOG` es una lista parcial; el runtime tiene más especialistas. Los documentos de agosto sobre conectores no certifican su activación actual. `INVENTARIO_METRICAS.md` cuenta funciones SQL y usa heurísticas; no es el número total de indicadores del producto.
8. **Hay que verificar alcance de devoluciones.** Los reembolsos y las analíticas existentes no demuestran que la ingesta de todos los motivos de devolución esté activa.
9. **No debemos prometer conocimiento ilimitado o ejecución total de la IA.** La promesa defendible es metodología de ecommerce aplicada a los datos y contexto de la tienda, con fuentes, límites y revisión de las acciones.

## Guion del producto: diez fases, con escenas propias

Estas fases son capítulos editoriales, no un asistente obligatorio que fuerce a conectar todas las aplicaciones. Cada aplicación tiene varias vistas explorables y las secciones de trabajo vuelven a las métricas para cerrar el ciclo.

| Fase | Qué debe entender la persona | Dibujo y movimiento | Interacción propuesta |
| --- | --- | --- | --- |
| 1. Conectar las cuentas | Shopify como base; después Meta y Klaviyo. Qué datos aporta cada una. | Tres objetos propios conectados a E-NORA; pulsos continuos de su color. | Seleccionar cada proveedor revela sus datos y métricas principales; secuencia Shopify → Meta → Klaviyo al desplazarse. |
| 2. Construir una lectura del negocio | E-NORA normaliza datos, calcula indicadores y añade costes/objetivos/contexto. | Mesa de cálculo: registros entran, quedan agrupados por tienda y periodo y salen como métricas. | Cambiar «ventas / rentabilidad / adquisición» cambia las fuentes visibles y muestra la fórmula de negocio en lenguaje simple. |
| 3. Explorar Shopify | Ventas, margen, clientes, catálogo, promociones, stock y operaciones. | Tienda y almacén desplegables: pedido, estante, SKU, paquetes y ruta de entrega. | Vistas Ventas y margen; Clientes y conversión; Productos y stock; Promociones y entregas. Un SKU abre cobertura/riesgo sin salir del dibujo. |
| 4. Entender Meta Ads | Qué campañas funcionan, qué creativo cambia el resultado y si la medición acompaña. | Proyector/visor de anuncios conectado a audiencia y contador de inversión. | Alternar Rendimiento; Creatividades; Medición y cambios. Seleccionar anuncio cambia la explicación y sus indicadores ilustrativos. |
| 5. Entender Klaviyo | Qué aportan campañas y flows, cómo se entrega el email y qué dice cada pieza. | Distribuidor de correo con ramificación; sobre desplegable en una pieza de email. | Alternar Métricas; Correos; Flows y audiencias. Abrir un email muestra asunto, CTA, contenido y ejemplos de revisión IA. |
| 6. Recibir análisis y propuestas | Los especialistas detectan señales y las convierten en mejoras y tareas justificadas. | Estaciones distintas para margen, adquisición, retención, stock y contenido; una señal viaja a una propuesta. | Elegir una señal explica dato → interpretación → propuesta → revisión; ejemplos marcados como ilustrativos. |
| 7. Consultar al copiloto y generar informes | Preguntar por el negocio, contrastar cifras y obtener un PDF contextual. | Mesa de conversación que despliega una fuente, un gráfico y un documento multipágina. | Preguntas de ejemplo controladas («qué reduce el margen», «qué campaña revisar», «resumen del mes»); preview de informe. |
| 8. Construir y revisar el Camino | Traducir objetivos y contexto en fases, hitos, tareas y revisiones. | Mapa de ruta con bifurcaciones/hitos, calendario comercial y punto de revisión. | Cambiar objetivo y explorar un hito; distinguir propuesta, aprobación, trabajo activo y revisión periódica. |
| 9. Crear marketing y llevarlo al canal | Diseño libre o IA, marca y catálogo, revisión, audiencia y salida al proveedor. | Taller de composición: piezas del email/creativo se montan; bifurcación hacia Klaviyo o plan Meta. Un flow usa nodos/ramas, no la misma mesa con otro color. | Rutas Email y campaña; Automatización; Creativo Meta. Selector Desde cero / Plantilla / IA. Klaviyo termina en programación; Meta en plan preparado hasta completar su publicación. |
| 10. Ejecutar, colaborar y volver a medir | Equipo y consultor comparten tareas, conversaciones, llamadas y seguimiento. Los resultados alimentan la siguiente decisión. | Mesa compartida con tarea, calendario, conversación, transcripción revisada y retorno a las métricas. | Seguir una propuesta hasta su tarea, comentario, fecha y resultado. Selector Tienda / Consultoría muestra qué ve cada rol. |

### Qué no debe convertirse en otro paso lineal

Conocimiento, permisos, costes y marca acompañan el recorrido y se revelan donde hacen falta. Las analíticas por aplicación se exploran dentro de su capítulo. Informes también puede abrirse desde el copiloto, el dashboard o el cierre del ciclo. El usuario puede saltar a su interés desde una navegación persistente.

## Arquitectura pública recomendada

La primera entrega concentra las diez fases en /conoce-e-nora, con una escena a pantalla completa por fase, navegación directa por anclas y el selector público actual. Las páginas de detalle de aplicaciones quedan como expansión posterior; el lanzamiento continúa cerrado y no se añade Crear cuenta.

```text
/conoce-e-nora                       visión del producto y recorrido principal
├── /conoce-e-nora/shopify            ventas, clientes, catálogo, stock, promociones y logística
├── /conoce-e-nora/meta-ads           rendimiento, creatividades, medición y plan publicitario
├── /conoce-e-nora/klaviyo            métricas, correos, automatizaciones y audiencias
├── /conoce-e-nora/inteligencia       especialistas, copiloto, conocimiento, Camino e informes
├── /conoce-e-nora/marketing          diseño libre/IA, biblioteca, revisión, campañas y flows
└── /conoce-e-nora/consultores        cartera, varias tiendas, trabajo compartido y seguimiento
```

En la portada, los capítulos resumen el valor y enlazan al detalle correspondiente. Cada página de aplicación vuelve al recorrido común: Shopify → stock/agente → tarea; Klaviyo → análisis de un correo → Estudio → campaña; Meta → creativo → diagnóstico → plan; Camino → calendario → campaña/tarea → revisión. Ninguna página importante queda aislada.

La expansión inicial puede usar secciones ancladas en la misma ruta, con el mismo modelo de contenido; las páginas de detalle se publican cuando exista suficiente contenido propio. No crear URLs vacías ni enlazar al usuario a pantallas privadas como demostración pública.

### Dirección visual e interacción

- Mantener IBM Plex Sans, grafito `#3D3B3A`, superficies claras y petróleo para acciones; verde Shopify, azul Meta y carbón Klaviyo para procedencia.
- Anatomy proporciona la construcción geométrica de las ilustraciones actuales. El recorrido, selección, estados y animaciones deben componerse expresamente; importar el kit no resuelve por sí solo la narrativa.
- Alternar composiciones: ecosistema completo, dibujo expandido de almacén, visor de anuncio, ramificación de email, taller de diseño, mapa de ruta, conversación y documento. Evitar diez tableros idénticos recoloreados.
- Movimiento continuo para el flujo visible; detener trabajo fuera de pantalla. Incluir pausa manual y alternativa estática con reducción de movimiento.
- Las preguntas/indicadores del recorrido público son ejemplos explícitos, no lecturas de cuentas reales ni resultados garantizados.
- En móvil, priorizar una escena compacta con controles táctiles y contenido legible; el dibujo no debe ocupar casi toda la pantalla durante la lectura.
- Las selecciones funcionan con teclado. Los textos explicativos y fuentes de datos tienen equivalente HTML; el color no es la única señal de plataforma o estado.

## Fases de construcción de la web

| Entrega | Resultado concreto | Cobertura |
| --- | --- | --- |
| A. Inventario y guion | Este documento, estado de cada promesa, métricas prioritarias y relaciones. | Auditoría funcional y mapa editorial. |
| B. Recorrido principal | Nueva composición de la portada y navegación por capítulos; conexión secuencial y cálculo de métricas. | Fases 1–2 y esquema navegable del producto entero. |
| C. Aplicaciones | Tres experiencias propias con sus vistas internas y objetos específicos. | Fases 3–5; catálogo/stock, Meta y correos/flows. |
| D. Inteligencia y estrategia | Relación entre señal, agente, propuesta, copiloto, informe y Camino. | Fases 6–8, conocimiento y contexto. |
| E. Crear y trabajar | Taller de piezas, campañas/flows, colaboración y ciclo de resultados. | Fases 9–10 y recorrido de consultoría. |
| F. Cierre | Revisión desktop/móvil, teclado, movimiento reducido, estados, enlaces y coste de render de las escenas. | Recorrido público completo; revisión de promesas frente a código. |

## Implementación de la página pública

- /conoce-e-nora presenta diez capítulos de scroll: conexión, contexto de métricas, Shopify, Meta Ads, Klaviyo, análisis IA, copiloto e informes, Camino, creación de marketing y colaboración.
- Una escena Anatomy isométrica permanece sticky en escritorio y cambia su composición al avanzar por los capítulos; en móvil queda anclada arriba en formato compacto. El índice indica la fase activa y permite navegar.
- Las diez composiciones usan los sólidos isométricos del kit Anatomy. La conexión anima un flujo continuo con pausa manual y estado estático con movimiento reducido. Los selectores Shopify, Meta y Klaviyo actualizan el énfasis visual y las métricas destacadas.
- La escena de conexión usa los sólidos y componentes React de Anatomy, tubos isométricos con anillos y el runtime `useLoop`/`useInView` para mover pulsos por las rutas Shopify, Meta y Klaviyo. La animación se pausa con el control y se detiene con movimiento reducido o cuando la escena sale de vista. No integra shaders WebGL ni el modo 3D beta; esos modos se reservan para otra revisión visual y una medición de rendimiento.
- Shopify permite explorar ventas, margen, clientes y stock; Meta, rendimiento, creatividades y medición; Klaviyo, rendimiento, correos y flows. Los selectores actualizan el resumen y sus indicadores, con el color propio de cada aplicación.
- La información usa jerarquía clara entre título, explicación y métricas; incluye las dependencias de costes, cobertura, permisos e histórico y aclara la atribución por canal.
- La fase de colaboración incluye tareas y acuerdos de llamadas. La escena de marketing separa la campaña de Klaviyo del plan de Meta y no presenta la publicación en Meta como disponible.
- Revisión en navegador en escritorio y a 390 × 844: la escena sticky se mantiene en su sitio; el capítulo de conexión muestra conductos, pulsos y sus controles. Pausa y reanudación funcionan, los capítulos y selectores conservan su estado. TypeScript y ESLint del cambio pasan.
## Evidencias principales

- Navegación de roles y módulos: [portal-navigation.ts](../apps/web/src/components/portal-navigation.ts).
- Datos Shopify y cobertura: [shopify-overview.ts](../apps/api/src/shopify-overview.ts), [shopify-metrics.ts](../apps/api/src/shopify-metrics.ts), [shopify-insights.ts](../apps/api/src/shopify-insights.ts), [shopify-catalog.ts](../apps/api/src/shopify-catalog.ts).
- Costes y economía: [financial-config.ts](../apps/api/src/financial-config.ts), [shopify-product-costs.ts](../apps/api/src/shopify-product-costs.ts).
- Meta: [meta.ts](../apps/api/src/meta.ts), [meta-sync.ts](../apps/api/src/meta-sync.ts), [meta-insights.ts](../apps/api/src/meta-insights.ts), [meta-campaigns.ts](../apps/api/src/meta-campaigns.ts).
- Klaviyo: [klaviyo-sync.ts](../apps/api/src/klaviyo-sync.ts), [klaviyo-insights.ts](../apps/api/src/klaviyo-insights.ts), [klaviyo-emails.ts](../apps/api/src/klaviyo-emails.ts), [marketing-klaviyo.ts](../apps/api/src/marketing-klaviyo.ts).
- IA, copiloto y Camino: [ai-runtime.ts](../apps/api/src/ai-runtime.ts), [ai-agent-groups.ts](../apps/api/src/ai-agent-groups.ts), [tool-layer.ts](../packages/ai/src/tool-layer.ts), [strategic-plans.ts](../apps/api/src/strategic-plans.ts), [copilot-tools.ts](../apps/web/src/lib/copilot-tools.ts).
- Estudio y automatización: [content-studio.tsx](../apps/web/src/app/marketing/studio/content-studio.tsx), [marketing-studio.ts](../apps/api/src/marketing-studio.ts), [marketing-flows.ts](../apps/api/src/marketing-flows.ts).
- Límite actual de Meta: [meta-ad-plan-block.tsx](../apps/web/src/app/marketing/meta-ad-plan-block.tsx), [meta-ad-write-plan.ts](../apps/api/src/meta-ad-write-plan.ts), [meta-ad-executor.ts](../packages/integrations/src/meta-ad-executor.ts).
- Informes: [report-generate.ts](../apps/api/src/report-generate.ts), [report-templates.ts](../apps/api/src/report-templates.ts), [reports-api.ts](../apps/api/src/reports-api.ts).
- Colaboración: [consultant-messages.ts](../apps/api/src/consultant-messages.ts), [operations.ts](../apps/api/src/operations.ts), [calls.ts](../apps/api/src/calls.ts), [calls-client.tsx](../apps/web/src/app/llamadas/calls-client.tsx).
- Contraste histórico: [PRODUCT.md](../apps/web/PRODUCT.md), [INVENTARIO_METRICAS.md](./INVENTARIO_METRICAS.md), [OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md](./OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md).
