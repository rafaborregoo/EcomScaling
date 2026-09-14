# **15\. Tecnología, Sistemas e Integraciones**

## **15.1 Qué es**

La **tecnología del ecommerce** es el conjunto de plataformas, sistemas, integraciones y automatizaciones que permiten ejecutar el negocio y mover información entre sus diferentes áreas.

Incluye:

* ecommerce platform;  
* CRM;  
* ERP;  
* email marketing;  
* paid media;  
* analytics;  
* data warehouse;  
* APIs;  
* webhooks;  
* automatizaciones;  
* sistemas de inventario;  
* pagos;  
* logística;  
* soporte;  
* IA.

La pregunta central es:

> **¿Los sistemas del negocio están conectados de forma fiable, segura y suficientemente flexible para operar y escalar?**

---

# **15.2 Tecnología no significa tener muchas herramientas**

Más herramientas no significa:

* más madurez;  
* más automatización;  
* mejores datos.

Puede significar:

* duplicidad;  
* costes;  
* errores;  
* complejidad.

Una buena arquitectura tecnológica busca:

> **el menor número de sistemas necesarios para conseguir fiabilidad, visibilidad y capacidad de crecimiento.**

---

# **15.3 Tech Stack**

**Tech Stack**

Conjunto de tecnologías utilizadas.

Ejemplo:

* Shopify;  
* Meta Ads;  
* Klaviyo;  
* ERP;  
* WMS;  
* Stripe;  
* helpdesk;  
* data warehouse;  
* consultor IA.

---

# **15.4 Core Systems**

Sistemas centrales sin los que el negocio no puede funcionar correctamente.

Ejemplo:

* Shopify;  
* pagos;  
* inventario.

---

# **15.5 Supporting Systems**

Sistemas que complementan al núcleo.

Ejemplos:

* reviews;  
* loyalty;  
* heatmaps;  
* attribution tools.

---

# **15.6 System of Record**

Sistema considerado registro oficial para un determinado tipo de información.

Ejemplo:

Pedidos:

Shopify.

Contabilidad:

ERP o software contable.

---

# **15.7 System of Engagement**

Sistema utilizado principalmente para interactuar con clientes.

Ejemplos:

* Klaviyo;  
* CRM;  
* helpdesk.

---

# **15.8 System of Intelligence**

Sistema que utiliza los datos existentes para:

* analizar;  
* predecir;  
* recomendar.

Aquí encaja vuestro consultor IA.

---

# **15.9 Shopify**

Shopify puede funcionar como núcleo comercial del ecommerce.

Puede gestionar:

* productos;  
* variantes;  
* pedidos;  
* clientes;  
* descuentos;  
* inventario;  
* checkout;  
* payments, según configuración.

Pero:

> **Shopify no necesariamente debe convertirse en la base de datos maestra de todo el negocio.**

---

# **15.10 Meta Ads**

Sistema de adquisición.

Aporta:

* campañas;  
* anuncios;  
* gasto;  
* audiencias;  
* creatividades;  
* métricas.

Debe integrarse con datos transaccionales para evaluar:

* CAC;  
* contribution;  
* LTV.

---

# **15.11 Klaviyo**

Sistema especializado en:

* email;  
* SMS;  
* perfiles;  
* segmentación;  
* campañas;  
* flows.

Puede funcionar como una pieza central del lifecycle marketing.

---

# **15.12 ERP**

**Enterprise Resource Planning**

Sistema que puede gestionar:

* compras;  
* proveedores;  
* inventario;  
* contabilidad;  
* finanzas;  
* operaciones.

A medida que una empresa crece, suele adquirir mayor importancia.

---

# **15.13 CRM**

**Customer Relationship Management**

Sistema para gestionar relaciones con clientes.

En ecommerce B2C puede existir solapamiento entre:

* Shopify;  
* Klaviyo;  
* helpdesk;  
* CDP.

La arquitectura debe evitar duplicaciones innecesarias.

---

# **15.14 WMS**

**Warehouse Management System**

Gestiona operaciones de almacén.

Ejemplos:

* ubicaciones;  
* picking;  
* stock;  
* packing.

---

# **15.15 OMS**

**Order Management System**

Gestiona pedidos desde múltiples canales.

Puede ser especialmente importante cuando existen:

* Shopify;  
* Amazon;  
* retail;  
* marketplaces.

---

# **15.16 PIM**

**Product Information Management**

Sistema dedicado a gestionar información de producto.

Puede contener:

* nombres;  
* descripciones;  
* atributos;  
* imágenes;  
* traducciones.

Muy útil en catálogos grandes.

---

# **15.17 DAM**

**Digital Asset Management**

Sistema utilizado para gestionar:

* fotografías;  
* vídeos;  
* creatividades;  
* activos de marca.

---

# **15.18 Helpdesk**

Sistema para atención al cliente.

Puede incluir:

* tickets;  
* email;  
* chat;  
* WhatsApp.

Ejemplos conceptuales:

Gorgias, Zendesk u otros.

---

# **15.19 PSP**

**Payment Service Provider**

Sistema de procesamiento de pagos.

Ejemplos:

* Shopify Payments;  
* Stripe;  
* PayPal.

---

# **15.20 Logistics Platform**

Sistema que gestiona:

* etiquetas;  
* carriers;  
* tracking;  
* shipping.

---

# **15.21 Review Platform**

Sistema para:

* capturar;  
* gestionar;  
* mostrar reviews.

---

# **15.22 Loyalty Platform**

Sistema para gestionar:

* puntos;  
* tiers;  
* rewards;  
* referrals.

---

# **15.23 Subscription Platform**

Sistema especializado en:

* suscripciones;  
* renovaciones;  
* pagos;  
* churn.

---

# **15.24 CDP**

**Customer Data Platform**

Sistema que unifica información de clientes procedente de diferentes fuentes.

Puede crear una vista más completa de:

* comportamiento;  
* pedidos;  
* canales;  
* perfiles.

No todos los ecommerce necesitan una CDP.

---

# **15.25 Data Warehouse**

Almacén analítico centralizado.

Ejemplos conceptuales:

* BigQuery;  
* Snowflake;  
* Redshift;  
* PostgreSQL analítico.

Puede almacenar información histórica procedente de múltiples sistemas.

---

# **15.26 Operational Database**

Base de datos utilizada para operaciones de la aplicación.

No tiene el mismo propósito que un data warehouse.

---

# **15.27 OLTP**

**Online Transaction Processing**

Sistemas optimizados para transacciones.

Ejemplo:

crear un pedido.

---

# **15.28 OLAP**

**Online Analytical Processing**

Sistemas optimizados para:

* análisis;  
* agregaciones;  
* grandes históricos.

---

# **15.29 Data Lake**

Almacenamiento de grandes cantidades de datos, a menudo más crudos y menos estructurados.

No siempre es necesario en ecommerce pequeño o medio.

---

# **15.30 ETL**

**Extract, Transform, Load**

Proceso:

1. extraer;  
2. transformar;  
3. cargar.

Ejemplo:

Meta → transformación → warehouse.

---

# **15.31 ELT**

**Extract, Load, Transform**

Primero se cargan los datos y después se transforman.

Muy habitual en arquitecturas modernas.

---

# **15.32 Data Pipeline**

Flujo automatizado de datos.

Ejemplo:

Shopify  
→ ingestion  
→ database  
→ metrics  
→ IA.

---

# **15.33 API**

**Application Programming Interface**

Interfaz que permite que dos sistemas se comuniquen mediante software.

Ejemplo:

Nuestro sistema solicita a Shopify:

> “Dame los pedidos.”

Shopify devuelve información estructurada.

---

# **15.34 REST API**

API basada normalmente en:

* endpoints;  
* HTTP;  
* recursos.

---

# **15.35 GraphQL**

Lenguaje y arquitectura de consulta donde el cliente solicita específicamente los campos que necesita.

Puede reducir:

* datos innecesarios;  
* múltiples requests.

---

# **15.36 Endpoint**

Dirección específica de una API utilizada para una operación.

---

# **15.37 Request**

Petición enviada a una API.

---

# **15.38 Response**

Respuesta devuelta.

---

# **15.39 Payload**

Información contenida en una petición o respuesta.

---

# **15.40 Authentication**

Proceso mediante el que un sistema demuestra quién es.

Ejemplos:

* API key;  
* OAuth;  
* token.

---

# **15.41 Authorization**

Define qué puede hacer un usuario o aplicación.

No es lo mismo que autenticación.

---

# **15.42 OAuth**

Protocolo utilizado para conceder acceso a una aplicación sin compartir directamente contraseña.

Ejemplo:

Una tienda autoriza a vuestro software a leer datos de Shopify.

---

# **15.43 Access Token**

Token utilizado para acceder a una API.

Debe protegerse.

---

# **15.44 Refresh Token**

Permite obtener nuevos access tokens en determinados sistemas.

---

# **15.45 API Key**

Clave utilizada para autenticar solicitudes.

Debe tratarse como secreto.

---

# **15.46 Secret**

Credencial sensible.

Nunca debería:

* exponerse en frontend;  
* guardarse en repositorio público.

---

# **15.47 Scope**

Permiso específico concedido a una integración.

Ejemplo:

* leer pedidos;  
* leer clientes.

Debe aplicarse:

> principio de mínimo privilegio.

---

# **15.48 Principle of Least Privilege**

Una integración solo debería recibir los permisos que necesita.

Ejemplo:

Si solo necesitamos analizar pedidos:

no pedir permiso para eliminarlos.

---

# **15.49 Webhook**

Notificación enviada automáticamente cuando ocurre un evento.

Ejemplo:

Shopify:

> “Se ha creado un pedido.”

En vez de preguntar constantemente:

> “¿Hay pedidos nuevos?”

---

# **15.50 Polling**

El sistema consulta periódicamente si existen cambios.

Ejemplo:

cada 15 minutos.

Puede ser útil cuando:

* no existen webhooks;  
* queremos reconciliación.

---

# **15.51 Webhook vs Polling**

## **Webhook**

La fuente avisa.

## **Polling**

Nuestro sistema pregunta.

Una arquitectura robusta puede utilizar ambos:

* webhook para rapidez;  
* polling para reconciliación.

---

# **15.52 Event-Driven Architecture**

Arquitectura donde los sistemas reaccionan a eventos.

Ejemplo:

Purchase  
→ actualizar cliente  
→ actualizar métricas  
→ ejecutar flow  
→ analizar IA.

---

# **15.53 Event Bus**

Infraestructura utilizada para distribuir eventos entre sistemas.

---

# **15.54 Message Queue**

Cola que almacena tareas o mensajes para procesarlos.

Ayuda a:

* absorber picos;  
* reintentar;  
* desacoplar sistemas.

---

# **15.55 Queue**

Ejemplo:

Black Friday genera:

10.000 webhooks.

En lugar de procesarlos todos simultáneamente:

se colocan en una cola.

---

# **15.56 Worker**

Proceso que consume tareas de una cola.

---

# **15.57 Asynchronous Processing**

Procesamiento que no necesita completarse inmediatamente durante la petición inicial.

Ejemplo:

generar análisis pesado.

---

# **15.58 Synchronous Processing**

El sistema espera la respuesta antes de continuar.

Adecuado para operaciones rápidas y críticas.

---

# **15.59 Retry**

Reintentar una operación que falló.

Ejemplo:

API temporalmente caída.

---

# **15.60 Retry Policy**

Reglas para:

* número de intentos;  
* intervalo;  
* estrategia.

---

# **15.61 Exponential Backoff**

Aumentar progresivamente el tiempo entre reintentos.

Evita saturar un servicio con fallos.

---

# **15.62 Dead Letter Queue — DLQ**

Cola donde terminan mensajes que no pudieron procesarse después de varios intentos.

Permite investigar errores.

---

# **15.63 Idempotency**

Capacidad de ejecutar una operación varias veces sin duplicar el resultado.

Ejemplo:

El mismo webhook llega dos veces.

No deberíamos crear dos pedidos internos.

---

# **15.64 Idempotency Key**

Identificador utilizado para evitar duplicados.

---

# **15.65 Deduplication**

Eliminar eventos repetidos.

Muy importante con:

* webhooks;  
* conversions;  
* orders.

---

# **15.66 Rate Limit**

Límite impuesto por una API al número de solicitudes.

---

# **15.67 Throttling**

Reducir ritmo de peticiones para respetar límites.

---

# **15.68 API Quota**

Cantidad máxima permitida durante determinado periodo.

---

# **15.69 Pagination**

Cuando una API divide resultados en páginas.

Ejemplo:

10.000 pedidos no se devuelven en una sola respuesta.

---

# **15.70 Cursor Pagination**

Sistema de paginación basado en cursor.

Suele ser más fiable para grandes datasets.

---

# **15.71 Incremental Sync**

Sincronizar únicamente los datos nuevos o modificados.

Más eficiente que descargar todo cada vez.

---

# **15.72 Full Sync**

Volver a sincronizar todo.

Puede ser útil para:

* inicialización;  
* reparación;  
* auditoría.

---

# **15.73 Backfill**

Importar histórico anterior.

Ejemplo:

Conectamos hoy Shopify.

Importamos:

últimos 24 meses.

---

# **15.74 Historical Sync**

Sincronización del histórico disponible.

Es fundamental para que la IA tenga contexto desde el primer día.

---

# **15.75 Sync State**

Estado de una sincronización.

Ejemplo:

* pending;  
* running;  
* completed;  
* failed.

---

# **15.76 Sync Cursor**

Marca desde dónde continuar una sincronización incremental.

---

# **15.77 Sync Lag**

Retraso de información.

Debe ser visible.

---

# **15.78 API Failure**

Fallo de comunicación.

Puede venir de:

* timeout;  
* rate limit;  
* credenciales;  
* servicio externo.

---

# **15.79 Timeout**

Tiempo máximo de espera antes de considerar que una operación ha fallado.

---

# **15.80 Circuit Breaker**

Patrón que evita seguir realizando llamadas a un servicio que está fallando repetidamente.

---

# **15.81 Graceful Degradation**

El sistema sigue funcionando parcialmente cuando un componente falla.

Ejemplo:

Meta está caída.

El consultor puede seguir mostrando Shopify, pero debe indicar que el análisis publicitario está incompleto.

---

# **15.82 Fault Tolerance**

Capacidad de soportar fallos sin detener completamente el sistema.

---

# **15.83 High Availability**

Diseño para minimizar tiempos de indisponibilidad.

---

# **15.84 Uptime**

Porcentaje de tiempo disponible.

---

# **15.85 Downtime**

Tiempo durante el que un servicio no está disponible.

---

# **15.86 SLA**

Compromiso de disponibilidad o servicio.

---

# **15.87 SLO**

**Service Level Objective**

Objetivo interno de fiabilidad.

Ejemplo:

99,9 % disponibilidad.

---

# **15.88 SLI**

**Service Level Indicator**

Métrica utilizada para medir cumplimiento de SLO.

---

# **15.89 Error Rate**

Porcentaje de operaciones fallidas.

---

# **15.90 Latency**

Tiempo necesario para completar una operación.

---

# **15.91 P95 Latency**

Tiempo por debajo del cual termina aproximadamente el 95 % de solicitudes.

Más útil que promedio en muchos sistemas.

---

# **15.92 Monitoring**

Supervisar sistemas mediante:

* métricas;  
* logs;  
* alertas.

---

# **15.93 Observability**

Permite comprender por qué el sistema está comportándose de determinada manera.

Incluye normalmente:

* logs;  
* metrics;  
* traces.

---

# **15.94 Logs**

Registros de eventos técnicos.

Ejemplo:

`shopify_sync_failed`.

---

# **15.95 Structured Logging**

Logs estructurados con campos.

Ejemplo:

* shop\_id;  
* integration;  
* error\_code;  
* timestamp.

Mucho más útiles para análisis.

---

# **15.96 Metrics**

Valores numéricos de sistema.

Ejemplos:

* sync duration;  
* error rate;  
* API calls.

---

# **15.97 Traces**

Permiten seguir una operación a través de varios servicios.

Ejemplo:

Shopify webhook  
→ API  
→ queue  
→ worker  
→ DB  
→ analytics.

---

# **15.98 Correlation ID**

Identificador común utilizado para seguir la misma operación entre sistemas.

---

# **15.99 Integration Health**

Estado de una integración.

Podría clasificarse:

* healthy;  
* warning;  
* degraded;  
* failed.

---

# **15.100 Last Successful Sync**

Última sincronización correcta.

---

# **15.101 Data Completeness per Integration**

Porcentaje de información importada correctamente.

---

# **15.102 Integration Error Rate**

Porcentaje de operaciones fallidas.

---

# **15.103 Integration Dashboard**

Panel para administradores donde ver:

* conexión;  
* permisos;  
* errores;  
* última sincronización;  
* volumen.

Para vuestro software es muy importante.

---

# **15.104 Connector**

Componente que encapsula la conexión con un servicio externo.

Ejemplo:

`ShopifyConnector`

`MetaConnector`

`KlaviyoConnector`

---

# **15.105 Adapter**

Capa que transforma la forma específica de un proveedor al modelo interno.

Ejemplo:

Meta llama a una métrica de una manera.

Vuestro sistema la convierte a un formato canónico.

---

# **15.106 Canonical Data Model**

Modelo interno común.

Ejemplo:

Todos los sistemas terminan representando:

Customer  
Order  
Product  
Campaign  
Event

de forma consistente.

---

# **15.107 Integration Abstraction**

Evitar que toda la aplicación dependa directamente de la estructura concreta de Shopify o Meta.

Esto reduce:

* acoplamiento;  
* dificultad de mantenimiento.

---

# **15.108 Loose Coupling**

Los sistemas dependen lo mínimo posible unos de otros.

Si Meta cambia:

no debería romper toda la aplicación.

---

# **15.109 Tight Coupling**

Demasiada dependencia directa.

Es más rápido inicialmente, pero más frágil.

---

# **15.110 Schema**

Estructura de datos.

Ejemplo:

tabla `orders`.

---

# **15.111 Schema Evolution**

Cambios en el modelo de datos con el tiempo.

Debe gestionarse sin romper histórico.

---

# **15.112 Migration**

Cambio controlado de estructura.

---

# **15.113 Backward Compatibility**

Cambios nuevos continúan funcionando con versiones anteriores cuando sea necesario.

---

# **15.114 Versioning**

Versiones de:

* API;  
* schema;  
* métricas;  
* prompts;  
* modelos.

Para IA es especialmente importante.

---

# **15.115 API Versioning**

Las APIs externas cambian.

Debe existir estrategia para:

* actualización;  
* deprecaciones;  
* pruebas.

---

# **15.116 Deprecation**

Una función deja de ser recomendada y será retirada.

Debe detectarse antes de que rompa producción.

---

# **15.117 Integration Testing**

Tests que comprueban que varios componentes funcionan juntos.

---

# **15.118 Contract Testing**

Comprueba que la integración cumple el contrato esperado.

---

# **15.119 End-to-End Testing**

Prueba del flujo completo.

Ejemplo:

conectar Shopify  
→ importar pedido  
→ calcular métrica  
→ mostrar análisis.

---

# **15.120 Regression Testing**

Comprueba que un cambio nuevo no rompe funcionalidades anteriores.

---

# **15.121 Sandbox**

Entorno de pruebas aislado.

Útil para integraciones externas cuando está disponible.

---

# **15.122 Development Environment**

Entorno de desarrollo.

---

# **15.123 Staging**

Entorno similar a producción utilizado para validar cambios.

---

# **15.124 Production**

Entorno real utilizado por clientes.

---

# **15.125 Configuration**

Valores que modifican comportamiento sin cambiar código.

Ejemplos:

* moneda;  
* timezone;  
* integración activa.

---

# **15.126 Feature Flag**

Permite activar o desactivar una funcionalidad.

Útil para:

* despliegues progresivos;  
* clientes específicos.

---

# **15.127 Multi-Tenant**

Arquitectura donde múltiples empresas utilizan la misma plataforma manteniendo sus datos separados.

Para vuestro consultor es fundamental.

---

# **15.128 Tenant**

Cada empresa o cliente de vuestra plataforma.

Ejemplo:

Tienda A.

Tienda B.

Nunca deben mezclarse sus datos.

---

# **15.129 Tenant Isolation**

Garantía de separación entre tenants.

Es un requisito crítico de seguridad.

---

# **15.130 Tenant Configuration**

Cada empresa puede necesitar configuración propia.

Ejemplos:

* moneda;  
* timezone;  
* métricas;  
* márgenes;  
* objetivos.

---

# **15.131 Role-Based Access Control — RBAC**

Permisos según rol.

Ejemplos:

* owner;  
* consultant;  
* analyst;  
* admin.

---

# **15.132 Permission**

Acción específica permitida.

Ejemplo:

* view\_financials;  
* connect\_meta;  
* manage\_users.

---

# **15.133 Authentication**

Inicio de sesión seguro.

---

# **15.134 MFA**

**Multi-Factor Authentication**

Añade un segundo factor de seguridad.

Especialmente importante para administradores.

---

# **15.135 Session Management**

Gestión segura de sesiones.

---

# **15.136 Secrets Management**

Gestión segura de:

* API keys;  
* tokens;  
* credentials.

Nunca deberían almacenarse:

* en texto plano;  
* en frontend;  
* en logs.

---

# **15.137 Encryption at Rest**

Cifrado de datos almacenados.

---

# **15.138 Encryption in Transit**

Cifrado durante comunicación.

Normalmente mediante TLS/HTTPS.

---

# **15.139 PII Protection**

Protección de datos personales.

---

# **15.140 Data Isolation**

Separación lógica y técnica entre clientes.

---

# **15.141 Audit Log**

Registro de acciones sensibles.

Ejemplo:

* usuario conectó Meta;  
* administrador cambió COGS;  
* IA ejecutó determinada acción.

---

# **15.142 Admin Auditability**

Desde vuestro panel de administración deberíais poder ver:

* qué integración falló;  
* qué datos utilizó la IA;  
* qué recomendó;  
* qué usuario actuó;  
* qué cambió después.

---

# **15.143 Backup**

Copia de seguridad.

---

# **15.144 Restore**

Proceso para recuperar información.

Un backup que nunca se ha probado restaurar no es una garantía suficiente.

---

# **15.145 Disaster Recovery**

Plan para restaurar servicio después de un incidente grave.

---

# **15.146 RPO**

**Recovery Point Objective**

Cuántos datos estamos dispuestos a perder como máximo.

---

# **15.147 RTO**

**Recovery Time Objective**

Cuánto tiempo máximo aceptamos estar sin servicio.

---

# **15.148 Automation**

Ejecución automática de una tarea basada en:

* evento;  
* regla;  
* horario.

---

# **15.149 Rule-Based Automation**

Ejemplo:

Si stock \< 10:

crear alerta.

---

# **15.150 AI-Based Automation**

La IA analiza contexto y decide una recomendación o acción.

Debe tener controles más estrictos.

---

# **15.151 Human-in-the-Loop**

Una persona aprueba antes de ejecutar una acción.

Ejemplo:

IA propone:

> “Reducir campaña 20 %.”

Consultor:

aprueba.

---

# **15.152 Human-on-the-Loop**

La IA puede actuar dentro de límites, mientras una persona supervisa.

---

# **15.153 Fully Autonomous Action**

La IA actúa sin aprobación inmediata.

Debe reservarse para:

* acciones seguras;  
* reversibles;  
* límites definidos.

---

# **15.154 Guardrail**

Regla que limita lo que puede hacer la IA.

Ejemplo:

> Nunca aumentar presupuesto más de 15 % automáticamente.

---

# **15.155 Approval Workflow**

Flujo de aprobación.

Ejemplo:

Recomendación  
→ consultor  
→ aprobación  
→ ejecución.

---

# **15.156 Action Log**

Registro de todas las acciones ejecutadas.

Debe incluir:

* actor;  
* fecha;  
* motivo;  
* estado;  
* resultado.

---

# **15.157 Rollback**

Capacidad de revertir una acción.

Especialmente importante en automatización.

---

# **15.158 Reversible Action**

Acción que puede deshacerse fácilmente.

Ejemplo:

pausar una campaña.

---

# **15.159 Irreversible Action**

Difícil o imposible de revertir.

Ejemplo:

eliminar permanentemente datos.

Debe requerir más protección.

---

# **15.160 AI Context**

Información que recibe la IA para razonar.

Puede incluir:

* métricas;  
* históricos;  
* documentación;  
* configuración;  
* objetivos;  
* restricciones.

---

# **15.161 Context Window**

Cantidad de información que un modelo puede procesar en una interacción.

Por eso no conviene enviar:

> todo el negocio entero en cada petición.

Debe existir selección inteligente.

---

# **15.162 Retrieval**

Recuperar únicamente información relevante para una consulta.

---

# **15.163 RAG**

**Retrieval-Augmented Generation**

La IA recupera información externa antes de responder.

En vuestro caso:

* documentación;  
* políticas;  
* estrategias;  
* datos de negocio.

---

# **15.164 Knowledge Base**

Repositorio de documentación que la IA puede consultar.

Puede contener:

* procesos;  
* playbooks;  
* términos;  
* estrategias;  
* benchmarks internos.

---

# **15.165 Structured Context**

Información estructurada.

Ejemplo:

CAC: 28 €  
Break-even CAC: 35 €  
Stock days: 14

Suele ser más fiable para cálculos que texto libre.

---

# **15.166 Unstructured Context**

Información no estructurada.

Ejemplo:

* documentos;  
* PDFs;  
* notas.

También es valiosa para razonamiento.

---

# **15.167 Context Prioritization**

La IA debe recibir primero:

1. datos actuales;  
2. contexto histórico;  
3. reglas del negocio;  
4. documentación;  
5. conocimiento general.

---

# **15.168 Prompt**

Instrucción enviada al modelo.

---

# **15.169 System Prompt**

Instrucciones base que definen comportamiento del agente.

---

# **15.170 Agent**

Sistema de IA capaz de:

* analizar;  
* usar herramientas;  
* ejecutar pasos;  
* tomar decisiones limitadas.

---

# **15.171 Tool**

Capacidad externa disponible para el agente.

Ejemplo:

* consultar Shopify;  
* leer Meta;  
* calcular métricas.

---

# **15.172 Agent Tool Calling**

La IA decide qué herramienta necesita.

Ejemplo:

Pregunta:

> “¿Por qué cae el CAC?”

La IA consulta:

* Meta;  
* Shopify;  
* histórico.

---

# **15.173 Orchestration**

Sistema que coordina:

* agentes;  
* herramientas;  
* procesos.

---

# **15.174 Multi-Agent System**

Varios agentes especializados.

Ejemplo:

* Acquisition Agent;  
* CRO Agent;  
* Finance Agent;  
* Operations Agent.

Un agente coordinador puede consolidar conclusiones.

---

# **15.175 Agent Specialization**

Cada agente domina un área.

Puede mejorar:

* claridad;  
* prompts;  
* contexto;  
* evaluación.

---

# **15.176 Agent Conflict**

Dos agentes pueden recomendar acciones contradictorias.

Ejemplo:

Marketing:

> escalar.

Operaciones:

> falta stock.

El sistema superior debe resolver el conflicto.

---

# **15.177 Decision Orchestrator**

Capa que prioriza recomendaciones globales.

Podría decidir:

> No escalar todavía porque el riesgo operativo supera la oportunidad publicitaria.

---

# **15.178 Global Business Context**

Contexto compartido por todos los agentes.

Debe incluir:

* objetivos;  
* etapa;  
* restricciones;  
* economía;  
* datos.

---

# **15.179 Memory**

Información histórica utilizada por la IA.

Puede contener:

* decisiones anteriores;  
* preferencias;  
* resultados.

---

# **15.180 Short-Term Memory**

Contexto reciente.

---

# **15.181 Long-Term Memory**

Información persistente relevante.

Ejemplo:

> La empresa no quiere superar 30 días de payback.

---

# **15.182 Decision Memory**

Historial de:

* recomendaciones;  
* acciones;  
* resultados.

Es particularmente útil para aprendizaje.

---

# **15.183 Recommendation Feedback**

El usuario puede indicar:

* útil;  
* incorrecta;  
* aplicada;  
* descartada.

---

# **15.184 Outcome Tracking**

Registrar qué ocurrió después de una recomendación.

Sin esto:

la IA recomienda, pero no aprende si funcionó.

---

# **15.185 Closed-Loop System**

Ciclo completo:

Data  
→ Diagnosis  
→ Recommendation  
→ Action  
→ Measurement  
→ Learning.

Ese debería ser el objetivo final del consultor.

---

# **15.186 AI Hallucination**

Cuando el modelo genera información no respaldada por datos o contexto.

En vuestro sistema es crítico reducirlo mediante:

* fuentes;  
* herramientas;  
* validación;  
* confianza;  
* restricciones.

---

# **15.187 Grounded Answer**

Respuesta basada en información disponible y verificable.

---

# **15.188 Evidence-Based Recommendation**

Recomendación respaldada por datos concretos.

---

# **15.189 Confidence Score**

Valor que indica qué tan sólida es una recomendación.

Puede incorporar:

* cobertura;  
* calidad;  
* volumen;  
* coherencia.

---

# **15.190 Unknown State**

El sistema debe poder decir:

> “No lo sé.”

o:

> “No hay suficiente información.”

Esto es mejor que inventar.

---

# **15.191 Safe Failure**

Cuando un sistema falla:

debe fallar de manera controlada.

Ejemplo:

No hay datos de COGS.

La IA no calcula margen ficticio.

---

# **15.192 Fail Open**

El sistema continúa aunque falte un control.

Puede ser peligroso en acciones críticas.

---

# **15.193 Fail Closed**

Ante incertidumbre:

la acción no se ejecuta.

Más apropiado para:

* dinero;  
* permisos;  
* acciones irreversibles.

---

# **15.194 Cost of Technology**

Cada sistema tiene coste:

* licencia;  
* integración;  
* mantenimiento;  
* complejidad.

Debe justificar su ROI.

---

# **15.195 SaaS Sprawl**

Exceso de herramientas SaaS.

Puede generar:

* costes;  
* datos fragmentados;  
* complejidad.

---

# **15.196 Vendor Lock-In**

Dependencia excesiva de un proveedor.

Ejemplo:

toda la lógica está construida alrededor de una plataforma difícil de sustituir.

---

# **15.197 Build vs Buy**

Decisión entre:

* desarrollar internamente;  
* comprar solución existente.

Debe considerar:

* coste;  
* diferenciación;  
* velocidad;  
* mantenimiento.

---

# **15.198 Technical Debt**

Atajos técnicos que generan coste futuro.

Ejemplo:

integración rápida pero frágil.

Con el tiempo:

* errores;  
* mantenimiento;  
* lentitud.

---

# **15.199 Scalability Técnica**

Capacidad del sistema de soportar más:

* usuarios;  
* tiendas;  
* eventos;  
* datos;  
* agentes.

Sin degradarse de forma inaceptable.

---

# **15.200 Horizontal Scaling**

Añadir más instancias o servidores.

---

# **15.201 Vertical Scaling**

Aumentar capacidad de una máquina.

---

# **15.202 Database Scaling**

Gestionar crecimiento de:

* tablas;  
* queries;  
* conexiones.

---

# **15.203 Query Performance**

Tiempo y recursos necesarios para obtener datos.

---

# **15.204 Index**

Estructura que acelera búsquedas en base de datos.

---

# **15.205 Cache**

Guardar temporalmente resultados frecuentes.

Reduce:

* latencia;  
* carga;  
* costes.

---

# **15.206 Cache Invalidation**

Decidir cuándo un dato cacheado deja de ser válido.

Uno de los problemas clásicos de sistemas.

---

# **15.207 Cost Scalability**

El coste tecnológico también debe escalar de forma razonable.

Ejemplo:

Una arquitectura que cuesta:

100 € con una tienda

y

100.000 € con 100 tiendas

puede ser inviable.

---

# **15.208 Unit Cost of AI**

Coste de IA por:

* consulta;  
* tienda;  
* análisis;  
* agente.

Debe monitorizarse.

---

# **15.209 Token Cost**

Coste asociado al procesamiento de texto por modelos.

---

# **15.210 Model Routing**

Utilizar modelos diferentes según dificultad.

Ejemplo:

* tarea simple → modelo económico;  
* análisis complejo → modelo avanzado.

Puede reducir costes.

---

# **15.211 Context Optimization**

Enviar solo contexto necesario.

Reduce:

* coste;  
* latencia;  
* ruido.

---

# **15.212 AI Latency**

Tiempo que tarda en responder el consultor.

Debe equilibrarse con:

* profundidad;  
* coste.

---

# **15.213 AI Availability**

Si el proveedor IA falla:

el producto debería degradarse de forma controlada.

---

# **15.214 Multi-Provider Strategy**

Usar varios proveedores puede reducir dependencia.

Pero añade:

* complejidad;  
* diferencias;  
* mantenimiento.

---

# **15.215 Model Versioning**

Registrar qué versión/modelo generó cada recomendación.

Esto es fundamental para:

* auditoría;  
* evaluación;  
* reproducibilidad.

---

# **15.216 Prompt Versioning**

Registrar versión de instrucciones utilizadas.

---

# **15.217 Evaluation Framework**

Sistema para medir calidad del consultor.

Puede incluir:

* precisión;  
* utilidad;  
* seguridad;  
* impacto.

---

# **15.218 Offline Evaluation**

Pruebas con casos históricos.

Ejemplo:

¿Habría detectado la IA una caída de margen ocurrida hace seis meses?

---

# **15.219 Online Evaluation**

Evaluar comportamiento en producción.

---

# **15.220 Golden Dataset**

Conjunto de casos conocidos con respuesta esperada.

Muy útil para pruebas de agentes.

---

# **15.221 Regression Evaluation**

Comprobar que una nueva versión de IA no empeora casos anteriores.

---

# **15.222 Human Evaluation**

Expertos evalúan recomendaciones.

Especialmente importante durante desarrollo inicial.

---

# **15.223 Recommendation Quality**

Puede medirse según:

* exactitud;  
* relevancia;  
* accionabilidad;  
* impacto;  
* riesgo.

---

# **15.224 Señales de buena salud tecnológica**

* integraciones estables;  
* datos sincronizados;  
* pocos fallos silenciosos;  
* permisos mínimos;  
* buena observabilidad;  
* arquitectura desacoplada;  
* automatizaciones trazables;  
* seguridad adecuada;  
* costes tecnológicos controlados;  
* capacidad de escalar;  
* IA basada en datos reales.

---

# **15.225 Señales de mala salud**

* datos duplicados;  
* APIs que fallan sin alerta;  
* credenciales expuestas;  
* demasiadas herramientas;  
* lógica repartida sin control;  
* ausencia de source of truth;  
* agentes contradictorios;  
* IA sin trazabilidad;  
* acciones automáticas sin límites;  
* costes de infraestructura creciendo demasiado rápido.

---

# **15.226 Problemas habituales**

## **Integraciones frágiles**

Se rompen cuando cambia una API.

---

## **Data Silos**

Cada aplicación tiene sus propios datos.

---

## **Credential Expiration**

Tokens caducan.

La integración deja de funcionar.

---

## **Rate Limits**

El sistema supera límites de API.

---

## **Sync Lag**

Datos demasiado antiguos.

---

## **Duplicate Processing**

Un webhook se procesa dos veces.

---

## **Vendor Lock-In**

Difícil sustituir proveedor.

---

## **SaaS Sprawl**

Demasiadas herramientas.

---

## **AI Context Overload**

Se envía demasiada información al modelo.

---

## **Lack of Guardrails**

La IA tiene demasiada capacidad sin controles.

---

# **15.227 Relaciones con otros sistemas**

## **Tecnología → Datos**

Sin buena arquitectura no existe dato fiable.

---

## **Tecnología → Operaciones**

ERP, WMS y automatizaciones permiten escalar.

---

## **Tecnología → Adquisición**

Tracking e integraciones afectan medición.

---

## **Tecnología → Retención**

CRM y Klaviyo dependen de eventos correctos.

---

## **Tecnología → Finanzas**

Integraciones permiten calcular rentabilidad.

---

## **Tecnología → IA**

El consultor depende completamente de:

* herramientas;  
* datos;  
* contexto.

---

# **15.228 Qué debería conocer el consultor IA sobre su propia infraestructura**

El consultor no solo debería conocer el negocio.

También debería conocer:

* qué integraciones están activas;  
* qué permisos tiene;  
* qué datos faltan;  
* última sincronización;  
* calidad del dato;  
* errores;  
* limitaciones.

Ejemplo:

> “No puedo evaluar el margen por SKU con alta confianza porque Shopify está conectado, pero el ERP de costes no lo está.”

---

# **15.229 Qué debería detectar el consultor IA**

### **Caso 1**

> La integración de Shopify funciona correctamente, pero Meta no sincroniza desde hace 7 horas. Las recomendaciones de adquisición deben quedar temporalmente degradadas.

### **Caso 2**

> El webhook de pedidos se está procesando dos veces. Existe riesgo de duplicación de revenue en el modelo interno.

### **Caso 3**

> La tienda tiene nueve herramientas que contienen datos de cliente, pero no existe un identificador canónico común. La vista Customer 360 tiene baja fiabilidad.

### **Caso 4**

> El coste mensual del stack ha crecido un 46 %, mientras tres herramientas presentan funcionalidades parcialmente solapadas.

### **Caso 5**

> El consultor está utilizando COGS actualizados semanalmente para decisiones de campañas que se actualizan en tiempo real. Debe aumentar la frecuencia o reducir el nivel de confianza del análisis.

### **Caso 6**

> El token de Klaviyo expira pronto o ha perdido permisos necesarios. Existe riesgo de interrupción del pipeline.

### **Caso 7**

> El volumen de webhooks aumentó cinco veces durante una promoción y el procesamiento está acumulando retraso. Se necesita mayor capacidad de cola/worker.

### **Caso 8**

> La IA recomienda escalar Meta, pero el agente de operaciones detecta stock crítico. La recomendación global debería bloquear el escalado.

### **Caso 9**

> Existe un cambio en el schema externo que ha dejado un campo crítico sin mapear. Las métricas afectadas deben marcarse como incompletas.

### **Caso 10**

> Las recomendaciones de la nueva versión del agente presentan peor precisión en determinados casos históricos. No debería desplegarse completamente hasta resolver la regresión.

---

# **15.230 Qué NO debería hacer la IA**

No debería:

> actuar como si todas las integraciones estuvieran funcionando.

Debe comprobar su estado.

Tampoco:

> ejecutar acciones críticas sin guardrails.

Ni:

> mezclar datos entre tenants.

Ni:

> utilizar información desactualizada sin advertirlo.

Ni:

> asumir que una herramienta externa es infalible.

---

# **15.231 Arquitectura conceptual del consultor**

Una estructura simplificada podría ser:

### **Capa 1 — Fuentes**

* Shopify  
* Meta  
* Klaviyo  
* ERP  
* otras

### **Capa 2 — Integración**

* APIs  
* webhooks  
* polling  
* queues

### **Capa 3 — Datos**

* raw  
* canonical model  
* historical data

### **Capa 4 — Métricas**

* CAC  
* LTV  
* Margin  
* Inventory  
* Funnel

### **Capa 5 — Agentes especialistas**

* Acquisition  
* CRO  
* Retention  
* Finance  
* Operations

### **Capa 6 — Orquestador**

Prioriza conflictos y oportunidades.

### **Capa 7 — Usuario**

* diagnóstico;  
* recomendación;  
* evidencia;  
* acción.

---

# **15.232 Orden correcto de diagnóstico técnico**

Cuando existe un problema:

### **1\. ¿La fuente funciona?**

### **2\. ¿La autenticación funciona?**

### **3\. ¿Los datos están llegando?**

### **4\. ¿Están completos?**

### **5\. ¿Se transforman correctamente?**

### **6\. ¿Se calculan bien las métricas?**

### **7\. ¿La IA recibe el contexto correcto?**

### **8\. ¿La recomendación respeta guardrails?**

---

# **15.233 Regla fundamental**

La tecnología no es el objetivo.

Es la infraestructura que permite:

> **capturar la realidad del negocio, moverla de forma fiable entre sistemas y convertirla en decisiones ejecutables.**

La pregunta incorrecta es:

> “¿Cuántas integraciones tenemos?”

La pregunta correcta es:

> **“¿Nuestra arquitectura tecnológica permite que los datos correctos lleguen al lugar correcto, en el momento correcto, con suficiente seguridad y fiabilidad para que humanos y agentes puedan tomar decisiones mejores?”**

