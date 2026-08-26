# EcomScaling IA

## Documento Maestro de Agentes y Automatizaciones

Arquitectura, contexto empresarial, conexión con Supabase, guardrails y evolución por fases

VERSIÓN 0.2 · 14 JULIO 2026 · DOCUMENTO VIVO

_Propósito: diseñar, probar, conectar y optimizar cada agente antes de su despliegue en producción._

# Control del documento

| **Versión** | **Fecha**  | **Estado**                     | **Cambios principales**                                                                                               |
| ----------- | ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0.1         | 14/07/2026 | Base inicial                   | Catálogo de agentes, fases, runtime común, contexto, herramientas, conexión con base de datos y criterios de calidad. |
| 0.2         | 14/07/2026 | Revisión alineada con briefing | Contexto adaptativo y amplio, SQL analítico de solo lectura, monitorización 24/7 y política de generación de tareas.  |

Este archivo será la referencia funcional y técnica de los agentes de EcomScaling IA. No se considera un documento cerrado: cada fase debe actualizar prompts, herramientas, permisos, esquemas de salida, pruebas y métricas de calidad.

# Índice

**1.** 1. Objetivo y principios de arquitectura

**2.** 2. Entorno visual de demostración

**3.** 3. Arquitectura común del runtime

4. Contexto adaptativo, acceso SQL y aislamiento por empresa

**5.** 5. Catálogo general de agentes y servicios

**6.** 6. Roadmap por fases

**7.** 7. Fichas maestras de agentes

**8.** 8. Modelo de datos del runtime de agentes

**9.** 9. Calidad, seguridad y evaluación

**10.** 10. Plantilla para nuevas versiones

# 1. Objetivo y principios de arquitectura

El objetivo de este documento es impedir que la inteligencia artificial se construya como un conjunto de prompts aislados. Cada agente debe tener una función empresarial concreta, un contexto mínimo, herramientas controladas, permisos explícitos, salidas estructuradas, trazabilidad y pruebas reproducibles.

## 1.1 Principios no negociables

- Una organización nunca comparte contexto con otra. El backend resuelve organization_id antes de ejecutar el agente.

- Los agentes disponen de acceso analítico amplio y dinámico a los datos autorizados de su organización mediante una capa SQL de solo lectura. Pueden generar consultas SELECT, cruzar tablas y ampliar el análisis, pero nunca reciben credenciales, acceso al schema private, DDL/DML ni capacidad de saltarse organization_id o RLS.

- El contexto es adaptativo, no artificialmente mínimo: empieza con identidad y objetivo, y se amplía hasta el histórico completo de la empresa cuando la pregunta, el riesgo o el análisis lo exigen.

- Las escrituras se realizan mediante herramientas de negocio controladas. Los agentes pueden crear tareas, alertas inteligentes o borradores según la política de cada agente; nunca ejecutan SQL de escritura generado libremente.

- Los cálculos de ventas, ROAS, CAC, beneficio, recurrencia, stock o forecasts se realizan en motores deterministas; la IA interpreta resultados.

- Las credenciales y datos personales innecesarios nunca forman parte del prompt.

- Toda escritura de impacto empresarial empieza en modo propuesta y requiere aprobación humana hasta superar las pruebas definidas.

- Cada respuesta debe indicar qué datos, periodo y fuentes ha utilizado.

- Prompts, herramientas y esquemas de salida se versionan. No se modifica producción sin registrar una nueva versión.

- El coste, latencia, errores y calidad de cada ejecución quedan auditados.

## 1.2 Agentes frente a automatizaciones deterministas

| **Componente**                         | **Clasificación**         | **Motivo**                                                    |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| Sincronización Shopify, Meta y Klaviyo | Worker determinista       | Debe ser repetible, idempotente y no necesita razonamiento.   |
| Cálculo de métricas financieras        | Motor determinista        | Las fórmulas deben ser exactas y versionadas.                 |
| Evaluación de umbrales y reglas        | Motor de reglas           | La misma entrada debe producir siempre el mismo resultado.    |
| Resumen de llamadas                    | Agente con revisión       | Interpreta lenguaje natural y propone tareas.                 |
| Diagnóstico empresarial                | Agente                    | Combina señales y prioriza problemas.                         |
| Consultor conversacional               | Orquestador/agente        | Selecciona herramientas y construye una respuesta contextual. |
| Planificación de stock                 | Motor + agente explicador | El motor calcula; el agente explica y recomienda.             |
| Ideas creativas y campañas             | Agente                    | Requiere interpretación, generación e hipótesis.              |

# 2. Entorno visual de demostración

Para enseñar al cliente un prototipo sencillo, el entorno más práctico es Langflow: permite construir flujos arrastrando nodos, conectar un modelo, añadir herramientas y ejecutar el flujo desde una interfaz visual. Dify es una alternativa adecuada cuando se quiere enseñar un chat, un flujo RAG y una aplicación funcional con menos código. LangSmith Studio se reservará para la implementación técnica y depuración del runtime de producción.

| **Herramienta**  | **Uso recomendado en EcomScaling**                                            | **Decisión**                                                       |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Langflow         | Demo visual de agentes, RAG y herramientas. Útil en reuniones con el cliente. | Recomendada para prototipo visual.                                 |
| Dify             | Prototipo de chat y workflows publicables con rapidez.                        | Alternativa si se prioriza una demo funcional inmediata.           |
| LangSmith Studio | Visualización, trazas y debugging de agentes implementados con LangGraph.     | Recomendada más adelante para desarrollo.                          |
| n8n              | Webhooks, notificaciones y procesos externos.                                 | Solo para automatizaciones concretas, no como núcleo del producto. |

Regla: el prototipo visual sirve para validar la experiencia y explicar el flujo, pero no sustituye el runtime seguro conectado a Supabase.

## 2.1 Decisión del runtime real: SDK directo, RAG y fine-tuning

El núcleo de ejecución de modelos sigue usando los SDK directos de Anthropic y OpenAI detrás de
contratos propios de prompts, tools, salidas, presupuestos, fallback y auditoría. LangChain y
LangGraph ya están incorporados mediante adaptadores aislados para el piloto de orquestación; no
reemplazan esos contratos ni la autoridad del backend.
El RAG se ejecuta mediante la capa de conocimiento multi-tenant sobre Supabase/Postgres/pgvector;
las tools consultan datos vivos y no se confunden con conocimiento recuperado.

La estrategia de calidad es prompts estructurados en nueve secciones, RAG gobernado, evaluaciones y
feedback humano. El fine-tuning queda para una fase posterior y solo se aprobará con dataset
versionado, privacidad revisada, baseline reproducible y mejora medida. No se usará fine-tuning para
datos cambiantes, autorización o aislamiento entre organizaciones.

La decisión técnica completa y sus condiciones de reapertura están en
`roadmap/roadmaps/05-agentes-ia/ADR_PROVEEDORES_ORQUESTACION_RAG_Y_FINE_TUNING.md`.

La adopción ya está preparada de forma incremental: `@langchain/core` y `@langchain/langgraph`
implementan el adaptador del primer grafo de diagnóstico no mutante en `@ecomscaling/ai`, mientras
`langsmith` aporta tracing opt-in con redacción y sin payloads por defecto. El runtime propio,
Supabase/RAG y los gates de seguridad siguen siendo la autoridad.

# 3. Arquitectura común del runtime

<img src="media/image1.png" style="width:6.69291in;height:3.80541in" />

Figura 1. Arquitectura común con contexto adaptativo, SQL analítico de solo lectura y herramientas de escritura controladas.

## 3.1 Flujo estándar de ejecución

**1.** Identificar usuario, rol y organización activa.

**2.** Validar que el usuario puede ejecutar el agente solicitado.

**3.** Clasificar la intención y seleccionar agente o herramienta.

4. Construir un contexto base y ampliarlo de forma adaptativa según la intención, complejidad, riesgo, periodo histórico y datos faltantes.

5. Ejecutar consultas SQL analíticas de solo lectura, herramientas deterministas y recuperación RAG; iterar hasta disponer de evidencia suficiente.

**6.** Generar una salida estructurada y verificable.

**7.** Validar formato, fuentes, permisos y límites.

**8.** Solicitar aprobación cuando exista escritura o publicación.

**9.** Persistir ejecución, pasos, tokens, coste, resultado y feedback.

## 3.2 Contrato común de entrada

| **Campo**          | **Obligatorio** | **Descripción**                                                      |
| ------------------ | --------------- | -------------------------------------------------------------------- |
| run_id             | Sí              | Identificador único de ejecución.                                    |
| agent_id / version | Sí              | Agente y versión concreta.                                           |
| organization_id    | Sí              | Tenant resuelto por backend; nunca elegido libremente por el modelo. |
| actor_user_id      | Sí              | Usuario que inicia o aprueba.                                        |
| trigger_type       | Sí              | Chat, llamada, cron, alerta, webhook o acción manual.                |
| objective          | Sí              | Objetivo concreto de la ejecución.                                   |
| time_range         | Según agente    | Periodo de análisis explícito.                                       |
| entity_ids         | Según agente    | Campañas, productos, llamadas o tareas afectadas.                    |
| allowed_tools      | Sí              | Lista cerrada de herramientas disponibles.                           |
| approval_mode      | Sí              | none, required_before_write o required_before_publish.               |

## 3.3 Contrato común de salida

- answer: explicación autosuficiente para el usuario.

- findings: hallazgos estructurados con severidad y evidencia.

- recommendations: acciones propuestas, prioridad, impacto y responsable.

- sources: tablas, documentos, tools, periodos y entidades utilizadas.

- proposed_writes: cambios sugeridos que aún no han sido ejecutados.

- approval_required: indica si se necesita revisión humana.

- confidence: confianza técnica limitada y justificada, no una cifra decorativa.

- warnings: datos faltantes, permisos insuficientes o limitaciones de API.

# 4. Contexto adaptativo, acceso SQL y aislamiento por empresa

## 4.1 Contexto base y contexto ampliable

| **Capa**       | **Contenido**                                           | **Origen**                                                                  |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Identidad      | Usuario, rol, organización y permisos.                  | profiles, organization_members, consultant_assignments                      |
| Negocio        | Moneda, timezone, configuración financiera y objetivos. | organizations, organization_financial_settings, organization_metric_targets |
| Operación      | Tareas, alertas, plan y campañas.                       | tasks, alerts, strategic_plans, marketing_campaigns                         |
| Datos externos | Métricas agregadas y entidades necesarias.              | Shopify, Meta, Klaviyo e Instagram normalizados                             |
| Llamadas       | Transcripción o resumen autorizado.                     | consulting_calls, call_transcripts, call_ai_summaries                       |
| Conocimiento   | Fragmentos RAG globales o de la organización.           | knowledge_documents, knowledge_chunks                                       |

## 4.2 Límites y datos excluidos

- Tokens OAuth, API keys, client secrets y payloads privados completos.

- Emails, teléfonos, direcciones o identidad de compradores salvo necesidad jurídica y autorización expresa.

- Información de otra organización, aunque el usuario sea consultor de varias cuentas.

- Volúmenes de filas que no aporten valor. El agente puede consultarlas mediante SQL cuando sean necesarias, pero no debe volcar datos masivos sin filtrar dentro del prompt.

- Datos sin fecha, fuente o versión de cálculo.

## 4.3 Contexto multiempresa del consultor

El Copiloto del Consultor puede comparar varias organizaciones únicamente cuando el usuario tiene asignación activa sobre todas ellas. La herramienta recibe una lista de organization_id autorizados calculada por el backend; el modelo no puede ampliar esa lista.

## 4.4 Niveles de contexto adaptativo

El objetivo no es limitar al agente a un contexto pequeño, sino darle el contexto suficiente y ampliarlo de forma controlada. La expansión puede ocurrir en varias rondas de consulta antes de generar la respuesta.

| **Nivel**                          | **Cuándo se usa**                                  | **Datos disponibles**                                                                  | **Ejemplo**                                              |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| C0 — Seguridad e identidad         | Siempre                                            | Usuario, rol, organization_id, permisos y suscripción                                  | Validar que la consulta pertenece a la empresa correcta. |
| C1 — Módulo actual                 | Pregunta acotada                                   | Datos del módulo, periodo y entidades implicadas                                       | Analizar el ROAS de los últimos 7 días.                  |
| C2 — Contexto cruzado              | La respuesta depende de varias áreas               | Shopify + Meta + Klaviyo + tareas + plan                                               | Decidir si subir inversión sin ignorar margen o stock.   |
| C3 — Contexto empresarial profundo | Diagnóstico estratégico, anomalías o planificación | Histórico completo autorizado, llamadas, campañas, productos, objetivos y conocimiento | Preparar una revisión mensual completa.                  |
| C4 — Portafolio del consultor      | Solo consultores autorizados                       | Resumen comparable de organizaciones asignadas, nunca datos de cuentas no asignadas    | Priorizar qué clientes necesitan atención esta semana.   |

## 4.5 Acceso SQL analítico de los agentes

Los agentes pueden formular consultas SQL dinámicas para analizar todos los datos relevantes de la organización. Este acceso debe sentirse libre desde el punto de vista analítico, pero estar técnicamente gobernado por un SQL Gateway de solo lectura.

El modelo puede utilizar SELECT y WITH sobre tablas y vistas autorizadas. El backend fuerza organization_id, aplica RLS, bloquea schemas privados, limita tiempo y filas, valida el AST SQL y registra cada consulta, duración, volumen y fuente.

No se permite SQL libre de escritura: INSERT, UPDATE, DELETE, ALTER, DROP, funciones peligrosas ni acceso a tokens. Para crear una tarea, campaña borrador o aprobación se invoca una herramienta de negocio con parámetros validados.

## 4.6 Política de generación de tareas

La aplicación debe generar tareas accionables, tal como exige el briefing. La autonomía depende del origen y del riesgo:

| **Origen**            | **Puede crear tarea**                  | **Aprobación**                         | **Regla**                                                             |
| --------------------- | -------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Regla determinista    | Sí, automática                         | No, si la regla está aprobada          | ROAS bajo, stock 0, campaña ausente, flow sin envíos.                 |
| Analista de llamadas  | Sí, como propuesta                     | Sí, consultor obligatorio              | El briefing exige revisión antes de publicar resumen y tareas.        |
| Monitor IA            | Sí, pendiente o visible según política | Según severidad y madurez              | Debe deduplicar, citar evidencia y evitar spam.                       |
| Chat Consultor IA     | Sí, tras confirmación del usuario      | Confirmación o aprobación según acción | Puede convertir una recomendación aceptada en tarea.                  |
| Agentes especialistas | Sí, como borrador o propuesta          | Configurable                           | No ejecutan acciones externas como pausar anuncios o enviar campañas. |

# 5. Catálogo general de agentes y servicios

| **ID** | **Agente**                             | **Fase** | **Estado**  | **Usuario**         | **Función**                                                                       |
| ------ | -------------------------------------- | -------- | ----------- | ------------------- | --------------------------------------------------------------------------------- |
| A00    | Orquestador / Consultor EcomScaling IA | Fase 3   | Definido    | Cliente y consultor | Responde con contexto empresarial adaptativo, consulta datos y coordina acciones. |
| A01    | Analista de llamadas                   | Fase 1   | Prioridad 1 | Consultor           | Resumen, decisiones y tareas en borrador.                                         |
| A02    | Monitor y diagnóstico del negocio      | Fase 1   | Definido    | Cliente y consultor | Monitoriza 24/7, detecta riesgos/oportunidades y genera tareas accionables.       |
| A03    | Analista de Meta Ads                   | Fase 1/3 | Definido    | Cliente y consultor | Diagnóstico de inversión, ROAS y creatividades.                                   |
| A04    | Generador y priorizador de tareas      | Fase 1/2 | Definido    | Cliente y consultor | Convierte hallazgos en acciones y ordena la cola por impacto y urgencia.          |
| A05    | Estratega de campañas                  | Fase 2   | Definido    | Cliente y consultor | Propone motivo, oferta, fecha y producto.                                         |
| A06    | Planificador inteligente de stock      | Fase 2   | Definido    | Cliente y consultor | Explica forecasts y riesgos de reposición.                                        |
| A07    | Analista de Instagram                  | Fase 3   | Definido    | Cliente y consultor | Detecta patrones de contenido.                                                    |
| A08    | Gestor de conocimiento                 | Fase 3   | Definido    | Consultor/admin     | Procesa y gobierna documentos RAG.                                                |
| A09    | Copiloto del consultor                 | Fase 2/3 | Definido    | Consultor           | Prioriza clientes y prepara llamadas.                                             |

## 5.1 Servicios no agentes que alimentan el sistema

| **ID** | **Servicio**          | **Responsabilidad**                                               |
| ------ | --------------------- | ----------------------------------------------------------------- |
| S01    | Shopify Sync Worker   | Productos, variantes, pedidos, reembolsos, inventario y métricas. |
| S02    | Meta Sync Worker      | Activos publicitarios, creatividades e Insights.                  |
| S03    | Klaviyo Sync Worker   | Flows, campañas, formularios, audiencias y reporting.             |
| S04    | Instagram Sync Worker | Cuentas, medios e insights orgánicos.                             |
| S05    | Motor financiero      | Beneficio, coste por pedido, break-even y márgenes.               |
| S06    | Motor de alertas      | Evalúa reglas y crea incidencias reproducibles.                   |
| S07    | Motor de stock        | Forecast, fecha de rotura y pedido recomendado.                   |
| S08    | Context Builder       | Construye datasets mínimos y seguros para cada ejecución.         |
| S09    | Approval Service      | Controla propuestas, revisión y publicación.                      |
| S10    | Evaluation Service    | Ejecuta datasets de prueba y registra feedback.                   |

# 6. Roadmap por fases

| **Fase**                           | **Objetivo**                                                                | **Agentes**                              | **Criterio de salida**                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Fase 0 — Fundaciones               | Runtime, auditoría, tools, contexto y pruebas.                              | Ningún agente en producción.             | RLS validada, tablas de runs creadas y herramientas seguras disponibles.                                                         |
| Fase 1 — MVP                       | Valor inmediato con llamadas, monitorización, alertas y tareas accionables. | A01, A02, versión limitada de A03 y A04. | Shadow mode inicial; tareas automáticas solo para reglas aprobadas y tareas IA con evidencia, deduplicación y control de riesgo. |
| Fase 2 — Retención y planificación | Campañas, stock y cockpit del consultor.                                    | A05, A06, A09.                           | Propuestas útiles, forecasts contrastados y creación controlada de borradores/tareas.                                            |
| Fase 3 — IA transversal            | Chat orquestado, RAG, Instagram y creatividades.                            | A00, A03 completo, A07, A08.             | Evaluaciones por intención, routing fiable y contexto multiempresa seguro.                                                       |
| Fase 4 — Optimización              | Mejoras basadas en feedback, coste y resultados.                            | Todos.                                   | Versionado continuo, A/B tests, métricas de negocio y rollback.                                                                  |

# 7. Fichas maestras de agentes

Las siguientes fichas constituyen la línea base. Cada agente se actualizará dentro de esta misma sección al avanzar de fase, conservando versión, decisiones y resultados de evaluación.

## A01 — Analista de llamadas

| **Fase**              | Fase 1 — Primer agente                                              |
| --------------------- | ------------------------------------------------------------------- |
| **Estado actual**     | Definido; pendiente de prompt, esquema JSON y dataset de evaluación |
| **Usuario principal** | Consultor y platform_admin                                          |
| **Tipo**              | Agente especializado con human-in-the-loop                          |
| **Riesgo**            | Medio: puede proponer tareas, pero no publicarlas sin revisión      |

### Objetivo de negocio

Transformar una transcripción en un resumen estructurado, decisiones, riesgos y tareas accionables, reduciendo el trabajo administrativo posterior a cada llamada.

### Disparadores

- Transcripción añadida manualmente.

- Webhook de Fathom en fase posterior.

- Regeneración solicitada por un consultor.

### Contexto empresarial disponible y expansión adaptativa

- Organización y consultor de la llamada.

- Transcripción concreta y versión.

- Plan estratégico activo.

- Tareas abiertas relacionadas.

- Formato y metodología de resúmenes de EcomScaling.

### Tablas de lectura

\`consulting_calls\`, \`call_transcripts\`, \`strategic_plans\`, \`strategic_plan_phases\`, \`strategic_plan_milestones\`, \`tasks\`, \`knowledge_chunks\`  
Pregunta: ¿No leemos los datos y métricas para conseguir mas context en la llamada y el agente sea mas inteligente?

### Tablas de escritura

\`call_ai_summaries\`, \`agent_runs\`, \`agent_outputs\`, \`agent_approvals\`, \`call_task_links (después de aprobación)\`, \`tasks (después de aprobación)\`

### Herramientas y servicios

- get_call_transcript(call_id, transcript_id)

- get_active_plan(organization_id)

- get_open_tasks(organization_id)

- retrieve_knowledge(query, organization_id)

- propose_call_tasks(...)

### Salida estructurada mínima

- Resumen “QUÉ HEMOS VISTO”.

- Decisiones tomadas.

- Lista de tareas con responsable y fecha límite cuando exista evidencia.

- Preguntas o ambigüedades para revisión.

- Citas a fragmentos de transcripción.

### Aprobación humana y límites

- No inventar fechas o responsables.

- No publicar al cliente automáticamente.

- No crear tareas hasta aprobación del consultor.

- Cada tarea debe enlazar con evidencia de la transcripción.

### Indicadores de calidad

- Precisión de tareas extraídas.

- Porcentaje de tareas aceptadas sin edición.

- Tiempo ahorrado por llamada.

- Número de omisiones críticas.

- Coste y latencia por transcripción.

### Decisiones pendientes

- Definir JSON Schema final.

- Crear 20-30 transcripciones de prueba.

- Definir taxonomía de tipos de tarea.

- Decidir tratamiento de transcripciones muy largas.

## A02 — Monitor y diagnóstico del negocio

| **Fase**              | Fase 1                                                      |
| --------------------- | ----------------------------------------------------------- |
| **Estado actual**     | Definido; pendiente de fórmulas canónicas y tool contracts  |
| **Usuario principal** | Cliente, consultor y platform_admin                         |
| **Tipo**              | Agente analista de solo lectura                             |
| **Riesgo**            | Medio: recomendaciones empresariales; sin escritura directa |

### Objetivo de negocio

Monitorizar la tienda de forma periódica, explicar su salud, detectar problemas y oportunidades y generar tareas accionables basadas en métricas trazables.

### Disparadores

- Ejecución programada cada X horas o diaria para monitorización 24/7.

- Apertura del dashboard.

- Pregunta del usuario.

- Preparación de llamada.

- Informe semanal opcional.

### Contexto empresarial disponible y expansión adaptativa

- Periodo solicitado.

- KPIs Shopify, Meta y Klaviyo.

- Break-even y configuración financiera.

- Alertas y tareas activas.

- Plan estratégico.

### Tablas de lectura

\`shopify_daily_store_metrics\`, \`shopify_daily_product_metrics\`, \`meta_insight_rows_daily\`, \`meta_insight_action_metrics\`, \`meta_calculated_metrics_daily\`, \`klaviyo_daily_account_metrics\`, \`organization_financial_settings\`, \`alerts\`, \`tasks\`, \`strategic_plans\`, \`consulting_calls\` y cualquier vista autorizada necesaria mediante SQL read-only.

### Tablas de escritura

\`agent_outputs\`, \`alerts\` y \`tasks\`. Puede crear tareas automáticas de bajo riesgo si la política está habilitada; el resto se guarda como propuesta pendiente.

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- get_business_health_snapshot(organization_id, range)

- get_financial_settings(organization_id)

- get_active_alerts(organization_id)

- get_plan_progress(organization_id)

### Salida estructurada mínima

- Estado general: verde, amarillo o rojo con criterios.

- Top 3 problemas y oportunidades.

- Evidencia cuantitativa y periodo.

- Acciones recomendadas ordenadas.

- Datos faltantes o no fiables.

### Aprobación humana y límites

- No recalcular cifras dentro del LLM.

- No inferir causalidad sin evidencia.

- Diferenciar dato, hipótesis y recomendación.

- No comparar empresas sin autorización.

### Indicadores de calidad

- Coincidencia con evaluación del consultor.

- Utilidad de recomendaciones.

- Tasa de respuestas con evidencia completa.

- Reducción de preguntas repetitivas.

### Decisiones pendientes

- Definir score de salud determinista.

- Cerrar fórmula de beneficio neto.

- Definir periodos por defecto.

- Diseñar dataset de casos buenos, ambiguos y críticos.

## A03 — Analista de Meta Ads y creatividades

| **Fase**              | Fase 1 limitada / Fase 3 completa                                |
| --------------------- | ---------------------------------------------------------------- |
| **Estado actual**     | Definido; pendiente de nomenclatura oficial y métricas canónicas |
| **Usuario principal** | Cliente y consultor                                              |
| **Tipo**              | Agente analista especializado                                    |
| **Riesgo**            | Medio-alto: decisiones de inversión; solo recomendaciones        |

### Objetivo de negocio

Analizar inversión, ROAS, CAC, frecuencia, retención de vídeo, creatividades y nomenclatura para detectar deterioro, ganadores e hipótesis de nuevos anuncios.

### Disparadores

- Pregunta sobre rendimiento.

- ROAS por debajo del break-even.

- Revisión semanal.

- Preparación de nuevas creatividades.

### Contexto empresarial disponible y expansión adaptativa

- Cuenta publicitaria y periodo.

- Campañas, ad sets, ads y creatividades.

- Insights y acciones por atribución.

- Métricas calculadas y break-even.

- Nomenclatura EcomScaling.

### Tablas de lectura

\`meta_ad_accounts\`, \`meta_campaigns\`, \`meta_ad_sets\`, \`meta_ads\`, \`meta_creatives\`, \`meta_creative_assets\`, \`meta_insight_rows_daily\`, \`meta_insight_action_metrics\`, \`meta_calculated_metrics_daily\`, \`organization_financial_settings\`

### Tablas de escritura

Ninguna escritura directa. Solo respuesta o propuesta.  
Pregunta: al recibir dicha respuesta el consultor podrá crear tareas con la información extraída, y que los datos apra crear estas tareas a lo mejor si puede ser que los escribamos en una table auxiliar para la posterior creación de dichas tareas?

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- get_meta_performance_snapshot(...)

- get_creative_rankings(...)

- get_attribution_config(...)

- get_break_even_roas(...)

### Salida estructurada mínima

- Resumen de inversión y rentabilidad.

- Creatividades ganadoras y deterioradas.

- Hipótesis por ángulo, formato y hook.

- Anuncios sin gasto o con fatiga.

- Recomendaciones con evidencia y cautelas.

### Aprobación humana y límites

- No recomendar subir presupuesto si los datos no superan el mínimo definido.

- Citar ventana de atribución y periodo.

- No presentar hook_rate o hold_rate como métricas nativas si son calculadas.

- No pausar ni modificar campañas.

### Indicadores de calidad

- Concordancia con análisis manual.

- Precisión al identificar ganadores.

- Tasa de recomendaciones accionables.

- Impacto posterior medido en tests controlados.

### Decisiones pendientes

- Recibir nomenclatura exacta.

- Seleccionar action_type oficial de compra.

- Definir fórmulas de hook, hold y fatiga.

- Definir mínimos de gasto/conversión para concluir.

## A04 — Generador y priorizador de tareas

| **Fase**              | Fase 1/2                                    |
| --------------------- | ------------------------------------------- |
| **Estado actual**     | Definido; pendiente de scoring determinista |
| **Usuario principal** | Cliente y consultor                         |
| **Tipo**              | Motor de scoring + agente explicador        |
| **Riesgo**            | Bajo-medio                                  |

### Objetivo de negocio

Convertir alertas y hallazgos de agentes en tareas concretas, deduplicarlas y ordenar la cola según impacto, urgencia, dependencia, antigüedad y fase del plan.

### Disparadores

- Apertura de la cola.

- Nueva alerta o tarea.

- Inicio de semana.

- Preparación de llamada.

### Contexto empresarial disponible y expansión adaptativa

- Tareas abiertas.

- Alertas activas.

- Fechas límite.

- Fase actual del plan.

- Métricas relacionadas.

- Capacidad o restricciones conocidas.

### Tablas de lectura

\`tasks\`, \`task_status_history\`, \`alerts\`, \`strategic_plan_milestones\`, \`milestone_task_links\`, \`shopify_daily_store_metrics\`, \`meta_calculated_metrics_daily\`

### Tablas de escritura

\`tasks\`, \`task_status_history\` y metadatos de priorización mediante write tools. La autonomía depende de la madurez y política de la organización.

### Herramientas y servicios

- score_tasks(organization_id)

- get_task_dependencies(...)

- get_related_metrics(...)

### Salida estructurada mínima

- Ranking priorizado.

- Motivo de cada posición.

- Bloqueos y dependencias.

- Tareas que deberían posponerse.

### Aprobación humana y límites

- El score base debe ser determinista.

- La IA explica y resuelve empates.

- No cambia estados ni fechas automáticamente.

### Indicadores de calidad

- Tasa de aceptación del ranking.

- Tiempo hasta completar tareas críticas.

- Reducción de tareas vencidas.

### Decisiones pendientes

- Definir pesos del scoring.

- Definir capacidad semanal.

- Incorporar dificultad estimada.

## A05 — Estratega de campañas

| **Fase**              | Fase 2                                       |
| --------------------- | -------------------------------------------- |
| **Estado actual**     | Definido; pendiente de calendario y playbook |
| **Usuario principal** | Cliente y consultor                          |
| **Tipo**              | Agente generador con contexto                |
| **Riesgo**            | Medio: crea borradores, nunca envía campañas |

### Objetivo de negocio

Proponer campañas coherentes con el histórico, margen, stock, estacionalidad y metodología de EcomScaling.

### Disparadores

- Mes sin campaña planificada.

- Pregunta del cliente.

- Campaña estacional próxima.

- Buen resultado histórico repetible.

### Contexto empresarial disponible y expansión adaptativa

- Campañas planificadas e históricas.

- Reporting de Klaviyo.

- Productos, stock y margen.

- Calendario comercial.

- Plan estratégico y metodología.

### Tablas de lectura

\`marketing_campaigns\`, \`marketing_campaign_products\`, \`klaviyo_campaigns\`, \`klaviyo_campaign_messages\`, \`klaviyo_report_values\`, \`shopify_products\`, \`shopify_daily_product_metrics\`, \`shopify_inventory_level_snapshots\`, \`product_costs\`, \`knowledge_chunks\`

### Tablas de escritura

\`marketing_campaigns en estado draft, previa confirmación\`, \`marketing_campaign_products en borrador\`

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- get_campaign_history(...)

- get_available_stock(...)

- get_product_margin(...)

- retrieve_campaign_playbook(...)

- create_campaign_draft(...)

### Salida estructurada mínima

- 3 propuestas de campaña.

- Motivo, oferta, segmento y fecha.

- Producto protagonista y riesgo de stock.

- Objetivo y métrica de éxito.

### Aprobación humana y límites

- No enviar campañas ni modificar Klaviyo.

- No proponer descuentos que ignoren margen.

- Indicar incertidumbre de atribución.

### Indicadores de calidad

- Borradores aceptados.

- Campañas ejecutadas.

- Revenue y margen posteriores.

- Tiempo de planificación ahorrado.

### Decisiones pendientes

- Crear calendario comercial.

- Definir límites de descuento.

- Definir segmentos recomendados.

- Mapear campañas planificadas con Klaviyo.

## A06 — Planificador inteligente de stock

| **Fase**              | Fase 2                                                         |
| --------------------- | -------------------------------------------------------------- |
| **Estado actual**     | Definido; motor matemático pendiente                           |
| **Usuario principal** | Cliente y consultor                                            |
| **Tipo**              | Motor determinista + agente explicador                         |
| **Riesgo**            | Alto si se interpreta como orden de compra; solo recomendación |

### Objetivo de negocio

Explicar cuándo y cuánto pedir, anticipar roturas y relacionar el riesgo de stock con campañas y estacionalidad.

### Disparadores

- Forecast actualizado.

- Rotura proyectada.

- Campaña planificada.

- Pregunta del cliente.

### Contexto empresarial disponible y expansión adaptativa

- Stock por ubicación.

- Ventas históricas.

- Lead time, safety stock y MOQ.

- Campañas futuras.

- Forecast calculado.

### Tablas de lectura

\`shopify_inventory_level_snapshots\`, \`shopify_daily_product_metrics\`, \`product_supply_settings\`, \`suppliers\`, \`stock_forecasts\`, \`marketing_campaign_products\`

### Tablas de escritura

Ninguna escritura directa. Solo respuesta o propuesta.

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- calculate_stock_forecast(...)

- get_stock_by_location(...)

- get_campaign_demand(...)

### Salida estructurada mínima

- Fecha probable de rotura.

- Fecha límite de pedido.

- Cantidad recomendada.

- Supuestos y escenarios.

- Riesgos de campaña.

### Aprobación humana y límites

- La IA no calcula el forecast.

- No emitir una orden de compra.

- Mostrar supuestos y calidad de datos.

- No recomendar si falta lead time crítico.

### Indicadores de calidad

- Error de forecast.

- Roturas evitadas.

- Exceso de stock.

- Recomendaciones aceptadas.

### Decisiones pendientes

- Elegir modelo inicial de forecasting.

- Definir estacionalidad.

- Tratar lanzamientos sin histórico.

- Definir stock por ubicación relevante.

## A07 — Analista de Instagram

| **Fase**              | Fase 3                              |
| --------------------- | ----------------------------------- |
| **Estado actual**     | Definido; pendiente de datos reales |
| **Usuario principal** | Cliente y consultor                 |
| **Tipo**              | Agente analista de contenido        |
| **Riesgo**            | Bajo-medio                          |

### Objetivo de negocio

Detectar patrones de alcance, interacción, retención y visitas al perfil, combinando métricas API con ganadores de seguidores introducidos manualmente.

### Disparadores

- Revisión mensual.

- Pregunta sobre contenido.

- Solicitud de ideas.

### Contexto empresarial disponible y expansión adaptativa

- Medios publicados.

- Insights por medio.

- Snapshots de cuenta.

- Ganadores manuales.

- Histórico y metodología de contenido.

### Tablas de lectura

\`instagram_accounts\`, \`instagram_account_snapshots\`, \`instagram_account_insight_values\`, \`instagram_media\`, \`instagram_media_insight_values\`, \`instagram_follower_winners\`, \`knowledge_chunks\`

### Tablas de escritura

Ninguna escritura directa. Solo respuesta o propuesta.

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- get_instagram_rankings(...)

- get_content_patterns(...)

- retrieve_content_playbook(...)

### Salida estructurada mínima

- Ranking de contenidos.

- Patrones por formato, tema y hook.

- Hipótesis separadas de hechos.

- Ideas de próximos contenidos.

### Aprobación humana y límites

- No atribuir ventas sin datos.

- No afirmar seguidores por publicación salvo dato manual/API disponible.

- Comparar contenidos con periodos homogéneos.

### Indicadores de calidad

- Calidad percibida de patrones.

- Ideas utilizadas.

- Mejora posterior de métricas.

### Decisiones pendientes

- Definir taxonomía de contenido.

- Definir métricas por tipo de medio.

- Establecer mínimo de publicaciones para analizar.

## A08 — Gestor de conocimiento

| **Fase**              | Fase 3                                               |
| --------------------- | ---------------------------------------------------- |
| **Estado actual**     | Definido; pendiente de pipeline RAG                  |
| **Usuario principal** | Consultor y platform_admin                           |
| **Tipo**              | Agente de ingestión y gobernanza                     |
| **Riesgo**            | Medio: afecta a la fuente de verdad del Consultor IA |

### Objetivo de negocio

Clasificar, dividir, versionar y preparar documentos para RAG sin mezclar conocimiento global con información privada de una organización.

### Disparadores

- Documento subido.

- Nueva versión.

- Reindexación.

- Detección de duplicado o conflicto.

### Contexto empresarial disponible y expansión adaptativa

- Documento.

- Metadatos.

- Catálogo de conocimiento.

- Taxonomía.

- Visibilidad global o por organización.

### Tablas de lectura

\`knowledge_documents\`, \`knowledge_chunks\`, \`organizations\`

### Tablas de escritura

\`knowledge_documents\`, \`knowledge_chunks\`, \`agent_runs\`, \`agent_outputs\`, \`agent_approvals\`

### Herramientas y servicios

- extract_document(...)

- classify_document(...)

- chunk_document(...)

- generate_embeddings(...)

- detect_duplicates(...)

### Salida estructurada mínima

- Clasificación.

- Estructura y chunks.

- Metadatos y etiquetas.

- Conflictos o duplicados.

- Propuesta de publicación.

### Aprobación humana y límites

- No publicar contenido conflictivo sin revisión.

- Mantener lineage y checksum.

- No convertir automáticamente casos privados en conocimiento global.

### Indicadores de calidad

- Precisión de recuperación RAG.

- Duplicados detectados.

- Respuestas con fuente correcta.

- Tiempo de ingestión.

### Decisiones pendientes

- Definir taxonomía.

- Elegir embeddings y dimensión.

- Definir política de versiones.

- Crear tests de retrieval.

## A09 — Copiloto del consultor

| **Fase**              | Fase 2/3                                                |
| --------------------- | ------------------------------------------------------- |
| **Estado actual**     | Definido; pendiente de cockpit y políticas multiempresa |
| **Usuario principal** | Consultor y platform_admin                              |
| **Tipo**              | Agente multiempresa de solo lectura y preparación       |
| **Riesgo**            | Alto por acceso transversal; controles estrictos        |

### Objetivo de negocio

Ayudar al consultor a priorizar clientes, preparar llamadas y localizar cuentas con problemas sin revisar manualmente cada dashboard.

### Disparadores

- Inicio del día o semana.

- Preparación de llamada.

- Pregunta del consultor.

- Alerta interna de tarea vencida.

### Contexto empresarial disponible y expansión adaptativa

- Solo organizaciones asignadas.

- Semáforo de salud.

- Alertas, tareas y llamadas.

- Métricas resumidas.

- Calendario del consultor en fase posterior.

### Tablas de lectura

\`consultant_assignments\`, \`organizations\`, \`alerts\`, \`tasks\`, \`consulting_calls\`, \`call_ai_summaries\`, \`shopify_daily_store_metrics\`, \`meta_calculated_metrics_daily\`, \`klaviyo_daily_account_metrics\`

### Tablas de escritura

Ninguna escritura directa. Solo respuesta o propuesta.

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- get_consultant_portfolio(user_id)

- get_client_health_summary(authorized_org_ids)

- get_upcoming_calls(...)

- get_overdue_tasks(...)

### Salida estructurada mínima

- Clientes prioritarios.

- Motivo y evidencia.

- Checklist de próxima llamada.

- Pendientes de revisión.

### Aprobación humana y límites

- Lista de organizaciones resuelta por backend.

- No mostrar datos de cliente no asignado.

- No comparar benchmarks privados sin autorización.

### Indicadores de calidad

- Tiempo de preparación de llamadas.

- Incidencias detectadas antes de la llamada.

- Utilidad del ranking de clientes.

### Decisiones pendientes

- Definir semáforo global.

- Definir resumen mínimo por cliente.

- Integrar calendario si se aprueba.

## A00 — Orquestador / Consultor EcomScaling IA

| **Fase**              | Fase 3                                                        |
| --------------------- | ------------------------------------------------------------- |
| **Estado actual**     | Definido a alto nivel; se implementa después de especialistas |
| **Usuario principal** | Cliente, consultor y platform_admin                           |
| **Tipo**              | Orquestador conversacional con tools y subagentes             |
| **Riesgo**            | Alto: acceso amplio; escritura solo mediante aprobación       |

### Objetivo de negocio

Responder preguntas transversales seleccionando herramientas y agentes especializados, manteniendo contexto empresarial seguro y explicaciones basadas en datos.

### Disparadores

- Mensaje en el chat.

- Acción contextual desde cualquier módulo.

### Contexto empresarial disponible y expansión adaptativa

- Identidad y permisos.

- Intención.

- Contexto de la pantalla actual.

- Datos mínimos recuperados por tools.

- Conocimiento RAG relevante.

### Tablas de lectura

\`ai_conversations\`, \`ai_messages\` y todas las tablas/vistas autorizadas mediante SQL Gateway de solo lectura y herramientas especializadas, con contexto adaptativo.

### Tablas de escritura

\`ai_conversations\`, \`ai_messages\`, \`agent_runs\`, \`agent_run_steps\`, \`agent_tool_calls\`, \`agent_outputs\`, \`agent_approvals\`

### Herramientas y servicios

- run_authorized_sql_readonly(question, organization_id, context_scope)

- route_intent(...)

- delegate_to_agent(...)

- safe business tools

- retrieve_knowledge(...)

- request_approval(...)

### Salida estructurada mínima

- Respuesta autosuficiente.

- Datos y fuentes.

- Acciones recomendadas.

- Propuestas pendientes de aprobación.

- Limitaciones.

### Aprobación humana y límites

- No usar un agente cuando una consulta determinista sea suficiente.

- No encadenar agentes sin límite.

- No escribir mediante tool sin aprobación.

- No mantener memoria empresarial fuera de Supabase.

### Indicadores de calidad

- Precisión del routing.

- Resolución sin escalado.

- Calidad de respuestas.

- Coste por intención.

- Errores de permiso: objetivo cero.

### Decisiones pendientes

- Definir taxonomía de intenciones.

- Definir subgrafos.

- Definir presupuesto máximo por ejecución.

- Diseñar memoria conversacional.

# 8. Modelo de datos del runtime de agentes

La base actual dispone de conversaciones y mensajes, pero para operar agentes de forma profesional deben añadirse tablas de ejecución y trazabilidad una vez cerrados los contratos de las fichas anteriores.

| **Tabla propuesta**     | **Función**                            | **Relaciones principales**                                                                |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| agent_definitions       | Catálogo estable de agentes.           | ID lógico, fase, propietario y estado.                                                    |
| agent_versions          | Versiones del agente y configuración.  | agent_definition_id, prompt_version_id, model y output_schema.                            |
| prompt_versions         | Prompts versionados y checksum.        | Tipo de prompt, contenido, autor y vigencia.                                              |
| agent_runs              | Cabecera de cada ejecución.            | organization_id, actor_user_id, agent_version_id, estado, coste y latencia.               |
| agent_run_steps         | Pasos o nodos ejecutados.              | run_id, step_type, estado, input/output resumido.                                         |
| agent_tool_calls        | Invocaciones de herramientas.          | run_id, tool_name, parámetros filtrados, resultado y error.                               |
| agent_context_snapshots | Contexto exacto utilizado.             | run_id, fuentes, periodos, hashes y snapshot no sensible.                                 |
| agent_outputs           | Salidas estructuradas.                 | run_id, output_type, payload y validación.                                                |
| agent_approvals         | Revisión humana.                       | run_id, proposed_action, reviewer, decisión y cambios.                                    |
| agent_evaluations       | Resultados de tests y feedback.        | run_id o version_id, criterio, score y comentario.                                        |
| agent_query_runs        | Auditoría de consultas SQL analíticas. | run_id, organization_id, SQL normalizado/hash, tablas, duración, filas, estado y rechazo. |

## 8.1 Flujo con la base de datos

**1.** El backend crea agent_runs con organization_id y actor_user_id.

2. El motor de contexto puede ejecutar SQL analítico de solo lectura sobre tablas/vistas autorizadas, ampliando el contexto según la situación y manteniendo organization_id forzado por backend.

3. Cada consulta SQL y llamada a herramienta se registra con fuente, SQL normalizado, duración, filas y resultado filtrado.

**4.** La respuesta se valida contra un JSON Schema y se guarda en agent_outputs.

**5.** Si existe una escritura propuesta, se crea agent_approvals.

**6.** Tras aprobación, una RPC segura realiza el cambio de negocio y lo registra en audit_logs.

**7.** El feedback del usuario o consultor alimenta agent_evaluations.

## 8.2 Escrituras permitidas por madurez

| **Nivel**                | **Comportamiento**                          | **Escritura**                       |
| ------------------------ | ------------------------------------------- | ----------------------------------- |
| L0 — Definido            | Solo documentación.                         | Ninguna.                            |
| L1 — Prototipo           | Datos ficticios o sandbox.                  | Ninguna en producción.              |
| L2 — Shadow mode         | Ejecuta con datos reales, resultado oculto. | Solo auditoría.                     |
| L3 — Human review        | Propone acciones al consultor.              | Tras aprobación explícita.          |
| L4 — Producción limitada | Automatiza acciones de bajo riesgo.         | RPCs preautorizadas y reversibles.  |
| L5 — Optimizado          | Versiones evaluadas y monitorizadas.        | Según política y límites aprobados. |

# 9. Calidad, seguridad y evaluación

## 9.1 Quality gates por versión

- Contrato de entrada y salida validado.

- Herramientas permitidas y permisos revisados.

- Dataset de evaluación representativo.

- Tests de aislamiento entre organizaciones.

- Tests de prompt injection y datos maliciosos.

- Pruebas de falta de datos y APIs incompletas.

- Coste y latencia dentro del presupuesto.

- Revisión humana con criterios de aceptación.

- Plan de rollback a la versión anterior.

## 9.2 Métricas comunes

| **Categoría** | **Métricas**                                                                        |
| ------------- | ----------------------------------------------------------------------------------- |
| Calidad       | Exactitud, completitud, groundedness, aceptación sin edición y tasa de alucinación. |
| Negocio       | Tiempo ahorrado, tareas ejecutadas, alertas resueltas y mejora posterior del KPI.   |
| Seguridad     | Errores de permiso, intentos bloqueados, PII expuesta y escrituras no autorizadas.  |
| Operación     | Latencia, tokens, coste, errores de tools, reintentos y disponibilidad.             |
| Experiencia   | Satisfacción, reformulaciones, escalados y abandono.                                |

## 9.3 Registro de decisiones

| **ID**     | **Fecha**  | **Decisión**                                            | **Motivo**                                                                                            | **Impacto**                                                               |
| ---------- | ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ADR-AI-001 | 14/07/2026 | Separar agentes de motores deterministas.               | Exactitud, coste y auditabilidad.                                                                     | Los agentes interpretan; los motores calculan.                            |
| ADR-AI-002 | 14/07/2026 | Comenzar por A01 Analista de llamadas.                  | Entrada y salida acotadas, valor inmediato y revisión humana.                                         | Primer agente del MVP.                                                    |
| ADR-AI-003 | 14/07/2026 | Usar prototipo visual separado del runtime.             | Facilitar demostración sin comprometer seguridad.                                                     | Langflow/Dify para demo; backend propio para producción.                  |
| ADR-AI-004 | 14/07/2026 | Usar contexto adaptativo y ampliable.                   | El briefing exige respuestas con métricas, plan, tareas e historial real de cada tienda.              | El contexto crece según la situación y puede abarcar la empresa completa. |
| ADR-AI-005 | 14/07/2026 | Permitir SQL dinámico de solo lectura mediante gateway. | Los agentes deben investigar métricas y relaciones no previstas sin crear una tool por cada pregunta. | Libertad analítica con RLS, tenant forzado, límites y auditoría.          |
| ADR-AI-006 | 14/07/2026 | Permitir generación controlada de tareas por IA.        | El producto debe monitorizar, detectar y convertir hallazgos en acciones.                             | Tareas automáticas o propuestas según origen, severidad y madurez.        |

# 10. Plantilla para nuevas versiones

Duplicar esta ficha cuando se cree un agente nuevo o se publique una versión mayor de uno existente.

| **Agent ID y nombre**     |     |
| ------------------------- | --- |
| **Versión**               |     |
| **Fase y madurez**        |     |
| **Responsable**           |     |
| **Objetivo de negocio**   |     |
| **Usuarios autorizados**  |     |
| **Trigger**               |     |
| **Contexto mínimo**       |     |
| **Tablas de lectura**     |     |
| **Tablas de escritura**   |     |
| **Herramientas**          |     |
| **Prompt version**        |     |
| **Modelo**                |     |
| **JSON Schema de salida** |     |
| **Aprobación humana**     |     |
| **Guardrails**            |     |
| **Dataset de evaluación** |     |
| **KPIs**                  |     |
| **Coste máximo**          |     |
| **Decisiones pendientes** |     |

# Próximo trabajo recomendado

La siguiente iteración debe cerrar dos piezas en paralelo: (1) el contrato común del SQL Gateway y del contexto adaptativo, y (2) A01 — Analista de llamadas. Después se potenciará A02 — Monitor y diagnóstico del negocio, porque es el agente que materializa la promesa central del briefing: monitorizar 24/7, detectar problemas y oportunidades y generar tareas accionables.
