# EcomScaling IA

## Briefing Técnico de Producto
### Documento para desarrollador
Julio 2026 · Confidencial

# 1. Contexto del Producto
### Qué es EcomScaling
EcomScaling es una consultoría especializada en eCommerce B2C con producto físico. El fundador, Ricardo Morales, trabaja con tiendas que facturan entre 4.000€ y 30.000€/mes ayudándolas a escalar su beneficio neto — no solo su facturación.

El servicio actual consiste en: plan estratégico personalizado, llamada mensual 1:1, acceso a un grupo de WhatsApp para dudas, y auditorías periódicas en Loom donde Ricardo entra directamente en las herramientas del cliente (Ads Manager, Klaviyo) y graba feedback específico.

### Qué problema resuelve EcomScaling IA
El mayor problema de una consultoría de este tipo es lo que pasa entre llamadas. El cliente recibe un plan estratégico en la llamada inicial y una revisión mensual, pero en los 29 días restantes:

- No sabe qué priorizar
- No detecta problemas hasta que ya son grandes (stock agotado, ROAS caído, campaña no planificada)
- Escribe al consultor por WhatsApp con preguntas que se repiten constantemente
- No tiene visibilidad sobre su negocio en tiempo real — trabaja con sensaciones, no con datos

> **EcomScaling IA es la capa tecnológica que trabaja entre llamadas.**
>
> → Monitoriza el negocio del cliente 24/7, detecta problemas y oportunidades, genera tareas accionables, y responde las dudas frecuentes con el criterio del consultor.
>
> → No sustituye al consultor. Lo potencia. Las llamadas mensuales pasan de "¿qué está pasando?" a "aquí están los datos, decidamos qué hacer."

### A quién va dirigido
Clientes activos de EcomScaling — los que ya están dentro del programa (Growth o Scale). El acceso a EcomScaling IA es exclusivo: solo pueden entrar si tienen una suscripción activa. No es un producto público ni se vende por separado.

### Glosario de términos de eCommerce (para desarrollador sin contexto del sector)
Este documento usa terminología específica de eCommerce. Aquí están los términos que aparecerán en las especificaciones:

| **Término**               | **Qué significa en este contexto**                                                                                              |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| AOV (Average Order Value) | Ticket medio — cuánto gasta de media un cliente por pedido                                                                      |
| ROAS                      | Return on Ad Spend — por cada €1 invertido en publicidad, cuántos € de ventas genera. Ej: ROAS 3x = 1€ invertido → 3€ de ventas |
| ROAS de break-even        | El ROAS mínimo para no perder dinero. Depende del margen de cada tienda. Lo calcula el consultor por cliente                    |
| CAC                       | Coste de adquisición de cliente — cuánto cuesta en publicidad conseguir un cliente nuevo                                        |
| Recurrencia               | % de clientes que vuelven a comprar en los últimos 90 días. Indicador clave de salud de la marca                                |
| Flujo / Flow de email     | Secuencia automática de emails que se dispara por un comportamiento del cliente (carrito abandonado, primera compra, etc.)      |
| Campaña de email          | Email puntual enviado a toda la lista o un segmento con un motivo concreto (Día de la Madre, aniversario de marca, etc.)        |
| Lead time                 | Tiempo que tarda un proveedor en reponer stock desde que se hace el pedido. Clave para planificación                            |
| Hook rate                 | En anuncios de vídeo: % de personas que ven los primeros 3 segundos. Mide si el inicio del anuncio engancha                     |
| Hold rate                 | En anuncios de vídeo: % de personas que ven el vídeo completo (o más de 15 segundos). Mide si el contenido retiene              |
| Klaviyo                   | Plataforma de email marketing especializada en eCommerce. Es donde el cliente gestiona sus emails automáticos y campañas        |
| Meta Ads / Ads Manager    | Sistema de publicidad de Meta (Facebook e Instagram). El "Ads Manager" es el panel donde se gestionan los anuncios              |
| Shopify                   | Plataforma de tienda online. Contiene todos los datos de pedidos, clientes, productos y stock                                   |
| Beneficio neto            | Ventas − coste de producto − envíos − publicidad − gastos fijos. Lo que realmente queda en el bolsillo del fundador             |
| Margen bruto              | Precio de venta − coste del producto (sin contar publicidad ni gastos fijos). Se expresa en % sobre el precio de venta          |
| Pop-up                    | Ventana emergente en la tienda online, normalmente para captar el email del visitante a cambio de un descuento o regalo         |

# 2. Arquitectura General de la Aplicación
## Dos vistas principales
La aplicación tiene dos tipos de usuario con vistas completamente distintas:

| **Vista**           | **Usuario**                                        | **Qué ve y hace**                                                                                                                                                                                |
|---------------------|----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Portal del Cliente  | Fundador de la tienda (cliente de EcomScaling)     | Su dashboard de métricas, sus tareas pendientes, su plan estratégico, sus llamadas grabadas, sus alertas de stock y campañas, y el chat con el Consultor IA                                      |
| Panel del Consultor | Ricardo Morales (y futuros consultores del equipo) | Panel con todos los clientes activos, estado de tareas por cliente, alertas activas por cuenta, gestión del plan estratégico de cada cliente, y acceso a crear/editar contenido del Consultor IA |

## Módulos de la aplicación
La app se organiza en 6 módulos principales dentro del portal del cliente, más el panel del consultor:

| **#** | **Módulo**                       | **Descripción corta**                                                                 |
|--------|----------------------------------|---------------------------------------------------------------------------------------|
| 1      | Dashboard de Métricas            | KPIs del negocio en tiempo real conectados a Shopify y Meta Ads                       |
| 2      | Sistema de Alertas y Tareas      | Cola unificada de tareas generadas por alertas automáticas y llamadas                 |
| 3      | Mi Camino (Plan Estratégico)     | El plan del cliente visualizado como roadmap con progreso por fases                   |
| 4      | Mis Llamadas                     | Grabaciones, resúmenes automáticos y tareas extraídas de cada llamada                 |
| 5      | Planificación (Stock y Campañas) | Alertas de reposición de stock y recordatorios de campañas mensuales                  |
| 6      | Análisis de Contenido            | Rendimiento de posts/reels de Instagram y análisis de creativos de Meta Ads           |
| —      | Consultor IA                     | Chat transversal disponible en toda la app con la base de conocimiento de EcomScaling |
| —      | Panel del Consultor              | Vista exclusiva de Ricardo para gestionar todos los clientes                          |

## Integraciones externas necesarias
| **Plataforma**                | **Para qué se usa**                                                           | **Tipo de integración**                     |
|-------------------------------|-------------------------------------------------------------------------------|---------------------------------------------|
| Shopify                       | Datos de ventas, pedidos, clientes, productos y stock                         | API pública de Shopify (REST + GraphQL)     |
| Meta Ads (Facebook/Instagram) | Datos de campañas, inversión, ROAS, creativos activos                         | Meta Marketing API                          |
| Klaviyo                       | Datos de email: flows activos, campañas, aperturas, revenue por email         | Klaviyo REST API                            |
| Instagram Graph API           | Métricas de posts y reels (alcance, engagement, visitas al perfil)            | Instagram Graph API vía Meta for Developers |
| Claude API (Anthropic)        | Motor de IA para el Consultor IA, resúmenes de llamadas y generación de ideas | Anthropic REST API                          |
| Loom (Fase 1)                 | Grabaciones de llamadas — el consultor pega el link manualmente               | Embed via URL (sin API en Fase 1)           |
| Fathom (Fase 2+)              | Grabaciones con transcripción automática y webhook al terminar la llamada     | Webhook de Fathom → backend de la app       |

# 3. Especificación de Módulos
## Módulo 1 — Dashboard de Métricas
### Qué es
La foto en tiempo real del negocio del cliente. Conecta datos de Shopify y Meta Ads para mostrar los indicadores clave con los que EcomScaling trabaja. No son métricas genéricas — son las que determinan si el negocio es rentable o no.

### Datos que muestra (y de dónde vienen)
| **KPI**                              | **Qué mide**                                                      | **Fuente de datos**                                 |
|--------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------|
| Facturación últimos 30 días          | Ventas totales del mes en curso                                   | Shopify Orders API                                  |
| Ticket medio (AOV)                   | Gasto medio por pedido en los últimos 30/90 días                  | Shopify Orders API                                  |
| Recurrencia 90 días                  | % de clientes que han comprado más de una vez en 90 días          | Shopify Customers API                               |
| Total clientes histórico             | Clientes únicos con al menos una compra                           | Shopify Customers API                               |
| Beneficio neto estimado por pedido   | AOV − coste de producto − coste neto de envío − CAC               | Shopify + datos manuales del cliente                |
| Inversión Meta Ads (últimos 30 días) | Total gastado en publicidad                                       | Meta Marketing API                                  |
| ROAS actual (últimos 30/7 días)      | Ventas atribuidas a Meta / inversión en Meta                      | Meta Marketing API                                  |
| ROAS de break-even                   | El ROAS mínimo para no perder dinero en este cliente concreto     | Calculado por el consultor, introducido manualmente |
| % facturación por email              | Qué porcentaje de las ventas viene de Klaviyo                     | Klaviyo API                                         |
| Stock bajo crítico                   | Productos con stock por debajo del mínimo definido por el cliente | Shopify Inventory API                               |

### Datos que introduce el cliente manualmente (una sola vez)
- Coste de producto por referencia (o margen bruto % si prefiere)
- Tarifa de envío por destino (península, islas, Portugal, Europa)
- Gastos fijos mensuales (almacén, herramientas, sueldos, etc.)
- Lead time de cada proveedor principal
- Stock mínimo de seguridad por producto

> **NOTA PARA EL DESARROLLADOR: El beneficio neto estimado por pedido es el KPI más importante de toda la app.**
>
> Fórmula: AOV − coste de producto − coste neto de envío (lo que paga el cliente menos lo que cobra al comprador) − CAC de Meta − gastos fijos por pedido.
>
> El consultor introduce el ROAS de break-even de cada cliente en el panel del consultor. Es un cálculo personalizado que varía por cliente.

## Módulo 2 — Sistema de Alertas y Tareas
### Qué es
El núcleo operativo de la app. Un sistema que monitoriza los datos del cliente y genera automáticamente tareas accionables cuando detecta un problema o una oportunidad. El cliente tiene una cola de tareas priorizada — no un informe que leer, sino acciones concretas que ejecutar.

### Fuentes de tareas
Las tareas entran en la cola desde tres orígenes:

- Alertas automáticas del sistema (reglas que disparan cuando un KPI cruza un umbral)
- Llamadas con el consultor (el resumen de cada llamada genera tareas automáticamente)
- El consultor añade tareas manuales desde su panel

### Ejemplos de alertas automáticas
| **Trigger (condición)**                                 | **Alerta que genera**                                                                                                             | **Prioridad** |
|---------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------------|
| ROAS actual < ROAS break-even durante 7 días           | "Tu ROAS está por debajo de tu punto de rentabilidad desde hace 7 días. Tarea: revisar creativos activos en Meta Ads."            | Alta          |
| Pop-up convirtiendo < 2% en últimos 7 días             | "Tu pop-up está convirtiendo al X% esta semana. Por debajo del 2% mínimo. Tarea: revisar copy y oferta del pop-up."               | Media         |
| Flujo de email sin envíos en 7 días                     | "El flujo de [nombre del flujo] lleva 7 días sin enviar emails. Posible problema de configuración en Klaviyo."                  | Alta          |
| Recurrencia 90 días cae > 20% respecto al mes anterior | "Tu recurrencia bajó de X% a Y% en los últimos 30 días. Tarea: revisar flujo post-compra y última campaña de email."              | Alta          |
| Stock de un producto = 0 con visitas activas            | "La referencia [producto] lleva X días sin stock. Ha recibido Y visitas en los últimos 7 días. Estás perdiendo ventas activas." | Alta          |
| Día 1 del mes sin campaña planificada                   | "Este mes no tienes campaña de email registrada. ¿Cuál es el motivo, la oferta y la fecha? Regístrala en tu panel de campañas."   | Media         |
| Más de 21 días desde la última campaña de email         | "Llevas X días sin campaña de email. Tu último envío tuvo Y% de apertura. Tarea: planificar campaña del mes."                     | Media         |
| Inversión Meta sube > 30% sin cambio en ROAS           | "Tu inversión subió un X% pero el ROAS no ha mejorado. Tarea: revisar qué creativos están recibiendo el presupuesto extra."       | Media         |

### Estados de una tarea
- Pendiente — recién generada, el cliente no la ha visto o no la ha iniciado
- En curso — el cliente la ha marcado como en progreso
- Hecha — el cliente la ha completado
- Ignorada — el cliente la ha descartado (con campo opcional de motivo)

> **VISTA DEL CONSULTOR: Ricardo ve el estado de todas las tareas de todos sus clientes desde su panel.**
>
> Esto le permite saber, antes de cada llamada mensual, qué ha ejecutado el cliente y qué lleva semanas sin moverse — sin tener que preguntarle.
>
> Una tarea "pendiente" durante más de 14 días genera una alerta interna para el consultor.

## Módulo 3 — Mi Camino (Plan Estratégico Vivo)
### Qué es
El plan estratégico que el consultor crea para cada cliente no es un PDF que se manda y se olvida. En la app, ese plan vive como un roadmap visual donde el cliente puede ver en todo momento dónde está en su proceso de crecimiento.

### Estructura del plan en la app
El plan tiene fases. Cada fase tiene hitos. Cada hito tiene tareas asociadas. El consultor controla desde su panel qué está completado — no el cliente.

- Fase 1 — Base: análisis inicial, optimización web, configuración de flujos de email
- Fase 2 — Retención: campañas mensuales, sistema de retención, WhatsApp marketing
- Fase 3 — Adquisición: Meta Ads con criterio, sistema de creativos
- Fase 4 — Escala: equipo, logística, financiación del crecimiento

### Lo que ve el cliente
- Barra de progreso general (% del plan completado)
- Fase actual resaltada
- Hitos completados (con fecha de completado)
- Hito actual en curso
- Próximos hitos (visibles pero bloqueados hasta que el consultor los activa)
- KPIs de partida vs KPIs actuales — para que el cliente vea cuánto ha avanzado desde que empezó

### Lo que controla el consultor
- Crear y editar el plan de cada cliente
- Marcar hitos como completados
- Activar la siguiente fase cuando el cliente está listo
- Añadir notas internas por hito (visibles solo para el consultor)

## Módulo 4 — Mis Llamadas
### Qué es
El historial completo de todas las llamadas entre el cliente y el consultor. Cada llamada tiene su grabación, su resumen generado por IA, y las tareas que se extrajeron automáticamente de esa llamada.

### Flujo de una llamada (Fase 1 — con Loom)
1. La llamada se hace por Zoom u otra herramienta. El consultor graba con Loom.

2. Al terminar la llamada, el consultor entra en el panel y añade el link de Loom + la transcripción (puede pegarla manualmente o el sistema la extrae del vídeo de Loom si se integra con Whisper o similar).

3. La app envía la transcripción a Claude API con un prompt estructurado que genera: (a) resumen en formato "QUÉ HEMOS VISTO" y (b) lista de tareas extraídas.

4. El consultor revisa y aprueba el resumen y las tareas antes de que sean visibles para el cliente.

5. Las tareas aprobadas se añaden automáticamente a la cola de tareas del cliente (Módulo 2).

### Flujo de una llamada (Fase 2 — con Fathom)
1. La llamada termina en Fathom.

2. Fathom dispara un webhook al backend de la app con la transcripción completa.

3. El backend envía la transcripción a Claude API → genera resumen + tareas.

4. El consultor recibe notificación para revisar y aprobar.

5. Una vez aprobado, aparece automáticamente en el portal del cliente.

### Formato del resumen generado por IA
> El resumen sigue siempre el mismo formato (definido en el prompt de Claude API):
>
> QUÉ HEMOS VISTO — Sección narrativa: los principales temas tratados en la llamada, problemas identificados y decisiones tomadas.
>
> TAREAS — Lista numerada de acciones concretas con responsable (cliente o consultor) y fecha límite si se mencionó.
>
> NOTA: El prompt de Claude API se le proporcionará al desarrollador en documento separado una vez acordada la arquitectura.

## Módulo 5 — Planificación (Stock y Campañas)
### Parte A — Planificación de Stock
Uno de los problemas más costosos en eCommerce pequeño y mediano: perder ventas por no tener stock cuando la demanda llega. Este módulo convierte la planificación de stock — que ahora depende de que el fundador se acuerde — en un sistema de alertas automáticas.

### Configuración inicial por producto (el cliente rellena una vez)
- Lead time del proveedor (tiempo de reposición desde que se hace el pedido)
- Stock mínimo de seguridad (cuántas unidades quiere tener siempre disponibles)
- Temporada principal del producto (verano, Navidad, todo el año, etc.) — campo opcional

### Lógica de alertas de stock
El sistema cruza el historial de ventas de Shopify (mismo período del año anterior) con el lead time introducido por el cliente y calcula cuándo hay que hacer el pedido de reposición para tener stock a tiempo.

> **Ejemplo de alerta generada:**
>
> → "El verano pasado (junio-agosto) vendiste 340 unidades de la Maleta Atacama. Tu proveedor tarda 10 semanas. Para tener stock el 1 de junio necesitas hacer el pedido antes del 22 de marzo."
>
> → "La camiseta blanca lleva 3 días con stock 0. Ha recibido 47 visitas a su página de producto en los últimos 7 días. Estás perdiendo ventas activas."

### Parte B — Planificación de Campañas
Dentro de EcomScaling, todos los clientes tienen que lanzar una campaña de email al mes. Este módulo asegura que eso ocurra y que esté planificado con suficiente antelación.

### Panel de campañas
- Historial de campañas pasadas: fecha, motivo, oferta, resultado (revenue generado si el cliente lo introduce)
- Campaña del mes activa: motivo, oferta, fecha de envío, estado (planificada / enviada / pendiente de planificar)
- Próximas campañas: las que el cliente ya tiene registradas para meses futuros

### Alertas automáticas de campañas
- Día 1 de cada mes: si no hay campaña registrada para ese mes, salta alerta — "¿Cuál es tu campaña de este mes? Registra el motivo, la oferta y la fecha."
- Alertas de repetición: si el año pasado hubo una campaña en una fecha concreta con buen resultado, el sistema avisa con 6 semanas de antelación para que la planifique este año
- Cruce con stock: si la campaña tiene un producto protagonista, el sistema verifica que hay stock suficiente para la fecha planificada

## Módulo 6 — Análisis de Contenido
### Parte A — Instagram (métricas de posts y reels)
> **⚠ LIMITACIÓN TÉCNICA IMPORTANTE — LEER ANTES DE DESARROLLAR**
>
> Instagram NO expone por API pública la métrica "seguidores ganados por post". Solo está disponible dentro de la app nativa de Instagram.
>
> Lo que SÍ permite la Instagram Graph API (con cuenta de empresa o creador y permisos explícitos del cliente):
>
> → Alcance e impresiones por post/reel
>
> → Engagement (likes + comentarios + guardados)
>
> → Visitas al perfil generadas por cada post
>
> → Clicks al enlace en bio
>
> SOLUCIÓN ADOPTADA PARA FASE 1:
>
> → La app conecta la cuenta de Instagram del cliente vía Meta Graph API y muestra el ranking de posts por alcance y engagement.
>
> → El cliente introduce manualmente, una vez al mes, los 3-5 reels que más seguidores le trajeron (dato que ve en sus Insights nativos de Instagram).
>
> → En fases posteriores, evaluar integración con Metricool o Iconosquare para acceder a más métricas.

### Lo que muestra la app de Instagram
- Ranking de posts/reels por alcance (últimos 30/90 días)
- Ranking por engagement rate
- Top posts por visitas al perfil generadas
- Los "ganadores de seguidores" que el cliente introduce manualmente
- Patrones detectados por IA: qué formatos, temas o estructuras aparecen en los posts con mejor rendimiento

### Parte B — Meta Ads (análisis de creativos)
Conecta con el Ads Manager del cliente vía Meta Marketing API. Usa la nomenclatura de nombres de anuncios que EcomScaling estandariza para todos sus clientes — eso permite identificar automáticamente el ángulo, formato y tipo de cada creativo sin análisis manual.

### Lo que muestra
- Ranking de creativos activos por ROAS (últimos 7/14/30 días)
- Hook rate y hold rate por creativo (disponibles en Meta API)
- Ángulos ganadores identificados por la nomenclatura
- Creativos que llevan más de 7 días sin gastar — señal de que Meta los ha descartado
- Ideas de nuevos creativos generadas por IA basadas en los ángulos ganadores de esa cuenta

> **NOTA: La nomenclatura de anuncios que usa EcomScaling sigue un formato estructurado que permite identificar el ángulo y formato de cada creativo desde el nombre.**
>
> El desarrollador recibirá el formato de nomenclatura exacto para que el parser lo implemente correctamente.

## Módulo Transversal — Consultor EcomScaling IA
### Qué es
Un chat disponible en cualquier sección de la app que responde las dudas del cliente usando la metodología y el criterio de EcomScaling — y con acceso al contexto real de esa tienda concreta (sus métricas, su plan, su historial de llamadas).

No es un chatbot genérico de eCommerce. Conoce el Método Protocolo de EcomScaling, los criterios de decisión de Ricardo, los casos reales de clientes, y los datos actuales de la tienda del cliente que está preguntando.

### Cómo funciona técnicamente
Se construye sobre Claude API (Anthropic) usando una arquitectura RAG (Retrieval-Augmented Generation):

- Base de conocimiento indexada: documentos de metodología de EcomScaling, criterios de decisión, respuestas frecuentes, casos de clientes (anonimizados)
- Contexto de la cuenta: en cada consulta, el sistema incluye automáticamente los datos actuales de esa tienda (KPIs, plan activo, tareas pendientes, historial de llamadas)
- El LLM (Claude) combina la base de conocimiento con el contexto de la cuenta para dar una respuesta personalizada, no genérica

### Ejemplos de preguntas que responde
| **Pregunta del cliente**                                                      | **Cómo responde el Consultor IA**                                                                                                                                                                                                                            |
|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ¿Debería subir el presupuesto de Meta esta semana?                            | Consulta el ROAS de los últimos 7 días de esa cuenta, lo compara con su ROAS de break-even, y responde con criterio: "Tu ROAS actual es 2.1x y tu break-even es 2.8x. No es el momento de subir presupuesto. Primero hay que mejorar los creativos activos." |
| No sé qué motivo usar para la campaña de email de agosto                      | Consulta el historial de campañas de esa cuenta, el calendario estacional, y la metodología de EcomScaling para sugerir 3 opciones con motivo + tipo de oferta recomendada                                                                                   |
| ¿Cuándo tengo que hacer el pedido a mi proveedor para tener stock en Navidad? | Consulta el lead time del proveedor introducido por el cliente, el historial de ventas de Navidad del año anterior, y calcula la fecha límite de pedido                                                                                                      |
| Mi hook rate está al 18%, ¿es bueno o malo?                                   | Responde con los benchmarks del sector y con la situación concreta de esa cuenta: "Para vídeos de más de 15 segundos, 18% está por debajo del 25% que buscamos. Pero es mejor que tu media de los últimos 30 días (14%). Va mejorando."                      |

> **ARQUITECTURA RECOMENDADA: El sistema RAG se construye con embeddings de los documentos de metodología almacenados en una base de datos vectorial (Pinecone, Weaviate o similar).**
>
> En cada consulta: (1) se vectoriza la pregunta, (2) se recuperan los fragmentos más relevantes de la base de conocimiento, (3) se construye el prompt con esos fragmentos + el contexto de la cuenta + la pregunta, (4) Claude genera la respuesta.
>
> Ricardo podrá añadir y actualizar documentos en la base de conocimiento desde el panel del consultor sin intervención técnica.

# 4. Panel del Consultor
Vista exclusiva para Ricardo (y futuros consultores del equipo). Desde aquí gestiona todos los clientes activos.

### Funcionalidades del panel
- Lista de todos los clientes activos con estado de salud rápido (semáforo: verde/amarillo/rojo según alertas activas y tareas vencidas)
- Acceso al portal de cada cliente en modo "vista consultor" — ver exactamente lo que ve el cliente más notas internas
- Gestión del plan estratégico: crear, editar y avanzar fases del plan de cada cliente
- Añadir tareas manuales a cualquier cliente
- Aprobar resúmenes de llamadas y tareas antes de que sean visibles para el cliente
- Subir grabaciones de Loom + transcripciones (Fase 1)
- Introducir el ROAS de break-even de cada cliente
- Gestionar la base de conocimiento del Consultor IA: añadir y actualizar documentos de metodología
- Ver historial completo de alertas por cliente
# 5. Fases de Desarrollo Recomendadas
> **PRINCIPIO DE DESARROLLO: No construir todo a la vez. Cada fase tiene que generar valor real para los clientes antes de pasar a la siguiente.**
>
> El objetivo de Fase 1 es tener algo funcionando con clientes reales en el menor tiempo posible para validar que el producto tiene sentido.

## Fase 1 — MVP (Prioridad máxima)
Lo mínimo que ya aporta valor diferencial:

- Autenticación: login seguro para clientes de EcomScaling (acceso solo si están activos)
- Conexión Shopify: dashboard con KPIs básicos (facturación, pedidos, ticket medio, recurrencia, stock)
- Conexión Meta Ads: inversión, ROAS actual vs ROAS break-even
- Sistema de alertas básico: 5-6 reglas fijas (ROAS bajo, pop-up bajo, stock 0, sin campaña del mes)
- Cola de tareas: las tareas se generan por alertas o las añade el consultor manualmente
- Mis Llamadas: el consultor sube link de Loom + transcripción manualmente, la IA genera el resumen y las tareas
- Mi Camino: plan estratégico estático que el consultor crea y edita desde su panel
- Panel del consultor básico: lista de clientes, acceso a cada cuenta, gestión de planes y tareas

## Fase 2 — Retención y Planificación
- Módulo de planificación de stock (alertas de reposición anticipadas)
- Panel de campañas (registro, historial, alerta día 1 del mes)
- Conexión Klaviyo (análisis de flows y campañas)
- Integración con Fathom para automatizar el flujo de llamadas (webhook → resumen automático)

## Fase 3 — Contenido e IA avanzada
- Consultor EcomScaling IA (RAG sobre base de conocimiento de metodología)
- Conexión Instagram Graph API (métricas de posts y reels)
- Análisis de creativos Meta Ads por nomenclatura
- Generación de ideas de contenido y creativos basadas en ganadores
# 6. Stack Tecnológico Orientativo
Esta sección es una recomendación, no una especificación cerrada. El desarrollador puede proponer alternativas si tiene más experiencia con otras tecnologías que logren el mismo resultado.

| **Capa**                                    | **Tecnología sugerida**                           | **Alternativas posibles**                  |
|---------------------------------------------|---------------------------------------------------|--------------------------------------------|
| Frontend (interfaz de usuario)              | Next.js (React)                                   | Nuxt.js, SvelteKit                         |
| Backend / API                               | Node.js con Express o Fastify                     | Python (FastAPI), Ruby on Rails            |
| Base de datos principal                     | PostgreSQL                                        | MySQL, Supabase                            |
| Base de datos vectorial (para Consultor IA) | Pinecone o Weaviate                               | Chroma, pgvector (extensión de PostgreSQL) |
| Autenticación                               | Auth0 o Supabase Auth                             | NextAuth, Clerk                            |
| Jobs / tareas en background                 | Bull (Node.js) o similar                          | Celery (Python), Sidekiq (Ruby)            |
| Motor de IA                                 | Claude API (Anthropic) — modelo claude-sonnet-4-6 | No sustituible — es parte del producto     |
| Hosting                                     | Vercel (frontend) + Railway o Render (backend)    | AWS, DigitalOcean, Hetzner                 |
| Almacenamiento de archivos                  | AWS S3 o Cloudflare R2                            | Supabase Storage                           |

# 7. Consideraciones Importantes
## Seguridad y acceso a datos
- Cada cliente solo puede ver sus propios datos. El aislamiento de datos entre cuentas es crítico.
- Las credenciales de Shopify, Meta y Klaviyo de cada cliente se almacenan cifradas. Nunca en texto plano.
- El acceso a la app se controla desde el panel del consultor: Ricardo activa y desactiva cuentas.
- Los tokens de Meta API expiran — el sistema debe gestionar el refresco automático.

## Privacidad de datos de clientes del cliente
- Los datos de Shopify contienen información personal de los compradores de la tienda (emails, direcciones). El sistema no debe almacenar más datos de los estrictamente necesarios para calcular los KPIs.
- Cumplimiento con GDPR (los clientes de EcomScaling son principalmente empresas europeas).

## Limitaciones conocidas documentadas
| **Limitación**                                                     | **Impacto**                                                                     | **Solución adoptada**                                                                                      |
|--------------------------------------------------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Instagram no expone "seguidores ganados por post" en su API        | No se puede automatizar el dato más útil para el cliente                        | Introducción manual mensual por el cliente + métricas automáticas disponibles (alcance, engagement)        |
| Meta API tiene límites de llamadas por hora                        | No se puede refrescar datos en tiempo real para muchos clientes simultáneamente | Actualización programada cada X horas (no en tiempo real). Indicar la última actualización en el dashboard |
| Shopify API tiene límites de rate según el plan del comerciante    | Clientes con plan básico de Shopify tienen límites más estrictos                | Implementar gestión de rate limiting y cola de peticiones                                                  |
| Loom no tiene webhook nativo para automatizar el flujo de llamadas | El consultor tiene que subir la grabación manualmente en Fase 1                 | Automatización completa disponible en Fase 2 con Fathom                                                    |

# 8. Preguntas Abiertas para el Desarrollador
Antes de estimar tiempos y costes, el desarrollador debería responder o tener en cuenta estas preguntas:

- ¿Prefieres un monorepo (frontend + backend en el mismo repositorio) o repos separados?
- ¿Tienes experiencia previa con las APIs de Shopify y Meta? Eso afecta significativamente al tiempo estimado de Fase 1.
- ¿Propones construir el backend como API REST o GraphQL? Ambas son válidas — afecta a cómo se conecta el frontend.
- Para el Consultor IA: ¿tienes experiencia con arquitecturas RAG o sería la primera vez? Eso determina si va en Fase 2 o Fase 3.
- ¿Qué herramienta propones para los jobs en background (alertas automáticas que se ejecutan periódicamente)?
- ¿Propones construir la autenticación desde cero o usar un servicio como Auth0 / Supabase?

---

*EcomScaling IA · Briefing Técnico · Julio 2026 · Ricardo Morales · ecomscaling.es*
