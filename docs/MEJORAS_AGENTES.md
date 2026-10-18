# Mejoras de Agentes

## A02 · Monitor del negocio

**Auditoría e implementación local:** 17 de octubre de 2026. **Estado:** mejoras aplicadas en el código local; despliegue y comprobación con datos conectados pendientes.

Revisión del código local de A02, sus rutas de lectura y ejecución, contexto, contrato de salida, caché, programación y consumidores del dashboard/panel. Carga considerada: varias organizaciones, tiendas y usuarios concurrentes. No se han medido latencias ni costes en producción.

El registro conserva los hallazgos y deja constancia del cambio realizado tras la autorización del propietario. Las prioridades reflejan el efecto posible observado en el código, no incidentes confirmados en producción. No se modificó el esquema de base de datos ni se hicieron escrituras remotas.

### Resultado de esta pasada

- **Aplicadas:** A02-001–007 y A02-009–010, A02-012–015. El endpoint manual antiguo responde `410`; se retiraron los controles de actualización de A02 de dashboards y panel. El runtime y el orquestador son ahora los únicos canales de generación de la aplicación.
- **A02-008 sustituida:** al no existir actualización manual para usuarios, deja de haber un cupo manual que reservar de forma atómica. Se conserva el endpoint de compatibilidad con respuesta `410`.
- **A02-011 aplicada con límite explícito:** el top 5 se ordena por cobertura fiable dentro de la muestra de hasta 30 productos que entrega la RPC compartida con A06. No se alteró esa RPC ni se afirma que detecte productos que quedaron fuera de su muestra.
- **Sin cambios remotos:** no se desplegó ni aplicó ninguna migración. La compilación local y las pruebas indicadas al final son la verificación de esta pasada.

**Estado por identificador:** implementadas localmente A02-001–007 y A02-009–010, A02-012–015; A02-008 sustituida por la retirada del flujo manual; A02-011 aplicada sobre las filas devueltas por la RPC, manteniendo explícito el límite de esa muestra.

### Orden propuesto

P1: corregir primero por exactitud, controles de ejecución o persistencia. P2: mejorar robustez, rendimiento y calidad. P3: evolución funcional o mantenimiento documental.

| ID | Prioridad | Mejora | Tipo | Riesgo de implementación estimado |
|---|---|---|---|---|
| A02-001 | P1 | Evitar ampliar el alcance cuando falla la tienda seleccionada | Exactitud | Medio: resolver compartido |
| A02-002 | P1 | Alinear el refresco del panel con las horas reales del cron | Programación | Bajo, acotado al panel |
| A02-003 | P1 | Aplicar los controles de programación también al panel | Control de gasto | Bajo/medio: política compartida |
| A02-004 | P1 | Unificar la frescura de la respuesta y su envelope | Exactitud | Bajo/medio: envelope compartido |
| A02-005 | P1 | Comprobar la persistencia del contexto y el cierre de ejecución | Recuperación | Medio: runner compartido |
| A02-006 | P2 | Buscar la caché por vista antes de limitar resultados | Disponibilidad | Bajo; medio si requiere columna |
| A02-007 | P2 | Reintentar solo las vistas pendientes tras un fallo parcial | Robustez y coste | Medio: orquestador |
| A02-008 | P2 | Retirar el cupo junto con la actualización manual | Alcance | Sustituida: endpoint manual devuelve 410 |
| A02-009 | P2 | Consultar solo los datos necesarios y reutilizar la cobertura de moneda | Rendimiento | Bajo/medio: construcción de contexto |
| A02-010 | P2 | Seleccionar las alertas por relevancia antes del límite | Calidad | Bajo |
| A02-011 | P2 | Priorizar cobertura fiable dentro de la muestra | Calidad | Aplicada en A02; RPC compartida limitada a 30 filas |
| A02-012 | P2 | Separar fecha del análisis y frescura de sus fuentes | Fiabilidad | Medio: metadatos de contexto |
| A02-013 | P2 | Validar que las secciones correspondan a la vista solicitada | Contrato | Bajo/medio: validación de salida |
| A02-014 | P3 | Añadir comparaciones verificables a la visión global | Evolución funcional | Medio: más datos y contexto |
| A02-015 | P3 | Actualizar la ficha de A02 y enlazar el registro de mejoras | Documentación | Bajo |

### A02-001 · No convertir una tienda inválida en «todas las tiendas»

- **Evidencia:** `apps/api/src/ai-runtime.ts:6050–6076`, utilizado por `runMonitorAgent:6849–6854` y `getMonitorDiagnostic:7150–7156`. `resolveStoreScope` ignora el error de consulta, no exige `is_active` y devuelve `storeId: null` cuando no encuentra la conexión explícita.
- **Caso concreto:** una conexión eliminada, ajena a esa organización o una consulta fallida puede terminar leyendo/generando el agregado de la organización bajo una selección de tienda. No demuestra acceso a otra organización; sí una ampliación silenciosa del alcance dentro de la organización autorizada.
- **Mejora mínima:** conservar el agregado únicamente cuando no se envía `connectionId`; ante una conexión explícita inexistente/inactiva devolver un error de alcance y ante fallo de consulta un error temporal. Ya existe un patrón más estricto en `resolveMarketingDiagnosticStoreScope` (`6087–6096`).
- **Compatibilidad y aceptación:** comprobar dos tiendas, conexión de otra organización, conexión inactiva, fallo de consulta y selección sin conexión. Revisar todos los consumidores del resolver compartido antes de cambiarlo; si sus reglas difieren, acotar la solución a A02.

### A02-002 · Ajustar el refresco del panel al cron real

- **Evidencia:** `PANEL_MIN_RUN_AGE_MS` en `apps/api/src/ai-runtime.ts:6633`; `panelReadingDue:14984–14989`; programación en `apps/worker/src/repeatable-jobs.ts:19–20`: **06:00 y 15:00, Europe/Madrid**.
- **Caso concreto reproducido:** el panel exige 10 horas entre lecturas, pero de 06:00 a 15:00 pasan 9. Tras una lectura matinal, una pasada de tarde puntual se omite; al día siguiente vuelve a vencer por la mañana. El comportamiento no asegura las dos lecturas diarias que describe el código.
- **Mejora mínima:** adaptar exclusivamente la regla del panel a esas dos franjas, con margen para la duración del run. Mantener el cron global de los demás agentes.
- **Compatibilidad y aceptación:** probar una secuencia de varios días a las 06:00/15:00, runs que terminan con retraso y cambio de hora. El test actual comprueba 3 y 11 horas, pero no el intervalo real de 9 horas.

### A02-003 · Respetar los controles de ejecución automática en el panel

- **Evidencia:** `apps/api/src/ai-runtime.ts:15434–15465` filtra grupos desactivados y `platformRunsPerDay === 0` en la pasada general. `runPanelReadingsPass:15000–15097`, invocado en `15901–15910`, no recibe ni comprueba esos controles. El runner sí comprueba activación de catálogo y presupuestos, pero son controles diferentes.
- **Caso concreto:** con A02 a cero ejecuciones automáticas en plataforma, una organización con consultor y lectura vencida todavía puede entrar en la pasada independiente del panel. Lo mismo ocurre con el grupo `lectura` apagado, cuyo mapeo está en `apps/api/src/ai-agent-groups.ts`.
- **Mejora mínima:** aplicar los filtros antes de programar el panel y registrar el motivo de omisión. Si el panel debe tener una política distinta del dashboard del cliente, hacer explícita esa distinción en configuración y documentación.
- **Compatibilidad y aceptación:** comprobar apagado de plataforma, apagado del grupo, activación del catálogo y presupuestos por separado. Conservar la actualización manual según la política ya establecida.

### A02-004 · Dar una única respuesta sobre la frescura

- **Evidencia:** `getCachedDiagnostic` calcula `stale` en `apps/api/src/ai-runtime.ts:6488–6501`, pero `buildAgentOutputEnvelope:6762–6783` fija siempre `freshness.status: "fresh"` y una vigencia de 24 horas. La caché de A02 usa 24/56/168 horas según ventana y no distingue la cadencia propia del panel.
- **Caso concreto reproducido:** una lectura del 1 de octubre consultada el día 17 devuelve `stale: true` y un envelope con `status: "fresh"`. Además, para 90 días el envelope vence a las 24 horas mientras el lector usa siete días.
- **Mejora mínima:** calcular una sola política de frescura por agente, vista y ventana, y pasar su resultado al envelope. Para el panel, reflejar su cadencia específica.
- **Compatibilidad y aceptación:** mantener los campos existentes y hacerlos coherentes; probar lectura reciente/vencida en 7/30/90 días y panel. No regenerar por GET como efecto de este ajuste.

### A02-005 · No declarar éxito si falla el cierre persistente

- **Evidencia:** `apps/api/src/ai-runtime.ts:5812–5817` inserta `agent_context_snapshots` sin comprobar la respuesta. En `5989–5995` actualiza `agent_runs` sin comprobar el error y después registra éxito. La escritura de `agent_outputs`, en cambio, sí comprueba su resultado.
- **Caso concreto:** puede guardarse una salida y fallar la actualización de la ejecución. El POST devuelve éxito, pero el GET busca únicamente runs `succeeded` (`6437`) y puede seguir mostrando la lectura anterior. Un snapshot fallido también deja una salida sin el contexto necesario para reconstruirla.
- **Mejora mínima:** comprobar ambos resultados y establecer una recuperación explícita del cierre. Exigir el snapshot si es necesario para trazabilidad/juez, o registrar claramente su ausencia; no ocultarla como ejecución completamente documentada.
- **Compatibilidad y aceptación:** simular fallo de snapshot y de actualización final, con salida ya guardada. Recuperar el cierre sin repetir la llamada al modelo. El runner es compartido: verificar otro diagnóstico además de A02.

### A02-006 · Filtrar la vista antes de aplicar el límite de caché

- **Evidencia:** `apps/api/src/ai-runtime.ts:6430–6466` obtiene los últimos 25 runs de la tienda y ventana y después busca la etiqueta de vista en memoria. El orquestador repite ese patrón en `15555–15598`.
- **Caso concreto:** si los 25 runs más recientes pertenecen a otras vistas, una lectura existente de `shopify`, por ejemplo, queda fuera. El GET puede devolver «primer diagnóstico pendiente» y el cron puede tratarla como inexistente.
- **Mejora mínima:** filtrar la etiqueta de vista en la consulta antes del límite, conservando el caso histórico de `overview` sin etiqueta. Una columna de vista sería una evolución posterior si se necesita indexación; no es requisito inicial.
- **Compatibilidad y aceptación:** comprobar más de 25 runs mezclados, varias ventanas y tiendas, y overview histórico. Aplicar la misma selección en lectura y programación.

### A02-007 · Recuperar por separado cada vista tras un fallo parcial

- **Evidencia:** `apps/api/src/ai-runtime.ts:15575–15597` agrupa el vencimiento de las cuatro vistas de 30 días. En `15722–15736` ejecuta todas en secuencia y corta en el primer fallo.
- **Caso concreto:** `overview` y `shopify` terminan, pero `meta` falla. Si falta una vista o una de las restantes sigue vencida, el próximo tick vuelve a seleccionar el grupo y regenera también las vistas que ya tuvieron éxito. Si Meta falla de forma repetida, Klaviyo queda detrás del mismo corte.
- **Mejora mínima:** evaluar vencimiento y recuperación por vista, reanudando solo las pendientes. Conservar el corte global cuando se agota el presupuesto, pero distinguirlo de un fallo aislado de área.
- **Compatibilidad y aceptación:** probar éxito parcial, fallo persistente de Meta y presupuesto agotado; ajustar también el peso de candidatos y el contador de runs al trabajo realmente pendiente. No resolverlo generando las cuatro vistas simultáneamente sin control de gasto.

### A02-008 · Retirar el cupo manual al deshabilitar la actualización manual

- **Evidencia:** `assertManualRefreshQuota`, `apps/api/src/ai-runtime.ts:5246–5297`, cuenta runs y devuelve permiso. La creación del run ocurre después, en `5708–5720`, sin una reserva del cupo manual en esa comprobación. La reserva de presupuesto monetario existente es otro control.
- **Caso concreto:** con un uso registrado y límite dos, dos peticiones concurrentes pueden leer el mismo contador y ambas comenzar. El límite HTTP de la ruta no hace atómica esta secuencia por organización, vista y tienda.
- **Resolución:** el botón de actualización se retiró de las vistas A02 y el endpoint de ejecución manual responde `410 monitor_manual_refresh_disabled`. La ruta queda para que clientes antiguos reciban un error explícito. Ya no se admite ese flujo para usuarios y no se añade una reserva de cuota ni una migración solo para limitarlo.
- **Compatibilidad y aceptación:** verificar que las vistas solo consultan la lectura almacenada y que los fallos no disparan una ejecución desde GET. El cron mantiene sus controles de organización y plataforma.

### A02-009 · Evitar consultas que la vista termina descartando

- **Evidencia:** `runMonitorAgent`, `apps/api/src/ai-runtime.ts:6868–6925`, carga ventas, finanzas, stock, productos, Meta, alertas, Klaviyo y cobertura monetaria para todas las vistas. Solo después filtra bloques en `7089–7125`. El runner vuelve a consultar cobertura monetaria en `5762–5778`; cada comprobación lee seis conjuntos de datos (`apps/api/src/shopify-financial-currency.ts:48–80`).
- **Caso concreto:** una lectura exclusiva de Meta consulta stock y Klaviyo aunque no los envía al modelo. El panel descarta stock y Klaviyo después de consultarlos. Overview, Shopify y panel pueden repetir la comprobación de moneda en la misma ejecución.
- **Mejora mínima:** seleccionar los recolectores por vista antes de ejecutarlos y reutilizar la cobertura monetaria dentro del mismo run. Mantener paralelas las lecturas independientes que sí hagan falta.
- **Compatibilidad y aceptación:** comparar bloques, límites y estados de error antes/después para cada vista, incluida la cobertura de divisas y el aviso de backfill. Medir consultas y tiempo de construcción de contexto. No prometer ahorro de tokens por quitar datos que ya se descartaban, ni añadir una caché compartida entre clientes.

### A02-010 · Priorizar las alertas antes del límite de 20

- **Evidencia:** `apps/api/src/ai-runtime.ts:6905–6912` consulta alertas abiertas/reconocidas con `limit(20)` sin orden explícito ni indicador de truncamiento.
- **Caso concreto:** con más de 20 alertas, una crítica puede quedar fuera del contexto mientras entran otras menos relevantes. El modelo tampoco sabe cuántas se omitieron.
- **Mejora mínima:** definir prioridad determinista por severidad y fecha, aplicar el límite después y declarar si la muestra está truncada. Si la severidad es texto, usar una prioridad explícita, no orden alfabético.
- **Compatibilidad y aceptación:** probar 25 alertas con una crítica fuera de las primeras filas originales; conservar el filtro por tienda y el tratamiento separado de error/vacío. Incluir fecha en los datos seleccionados si se usa para ordenar.

### A02-011 · Revisar qué significa «top 5 de riesgo de quiebre»

- **Evidencia:** `apps/api/src/ai-runtime.ts:6951–6961` enriquece las filas y toma las cinco primeras sin reordenar. La RPC de `supabase/migrations/20261115260000_ai_a06_stock_quality_gates.sql:91–98` ordena primero por inventario clasificado como actual y luego por cantidad vendida; el stock disponible desempata después. Limita a 30 productos.
- **Caso concreto:** cinco productos de 100 unidades vendidas y 1.000 disponibles pueden desplazar a un sexto de 90 vendidas y stock cero. El orden actual prioriza volumen antes que cobertura o rotura; el comentario de A02 afirma una selección más precisa de la que garantiza la consulta.
- **Mejora mínima:** acordar una prioridad de riesgo que utilice stock fiable, cobertura y demanda observada, y aplicarla antes del recorte. Mantener separados los problemas de calidad de inventario. Reordenar solo las 30 filas recibidas no garantiza encontrar un producto excluido antes por SQL.
- **Compatibilidad y aceptación:** probar el ejemplo anterior, inventario antiguo/no gestionado y muestra insuficiente. La RPC también alimenta A06: conservar su contrato o introducir una selección específica de A02; no inventar días de cobertura donde `enrichStockRiskEvidence` los deja nulos.

### A02-012 · Mostrar cuándo se actualizaron las fuentes del diagnóstico

- **Evidencia:** los bloques de ventas/finanzas/Meta de `apps/api/src/ai-runtime.ts:6927–6939` y `6997–7043` identifican disponibilidad y periodo, pero no incorporan una comprobación explícita de sincronización por fuente. El stock sí recibe antigüedad y salvaguardas en `apps/api/src/stock-risk-evidence.ts`. El cálculo de caché mide la edad del análisis, no la actualización de cada integración.
- **Caso concreto:** un análisis recién generado puede utilizar métricas antiguas tras varios días de sincronización fallida. La fecha reciente del análisis no prueba que la fuente esté actualizada.
- **Mejora mínima:** añadir estado y fecha de sincronización por proveedor y tienda, junto a cobertura temporal cuando esté disponible. Limitar solo las conclusiones que dependan de fuentes antiguas y expresar la incertidumbre; no descartar por ello todos los datos válidos.
- **Compatibilidad y aceptación:** probar Shopify reciente con Meta antiguo, integración desconectada con histórico y cobertura desconocida. Reutilizar metadatos existentes antes de crear consultas nuevas; combinar esta mejora con A02-009. Es una mejora del contexto explícito, no una afirmación de que las RPC carezcan de cualquier dato de cobertura.

### A02-013 · Validar las áreas de salida según la vista

- **Evidencia:** `packages/ai/src/index.ts:581–622` acepta las mismas claves para cualquier salida A02 y no exige claves de sección únicas. `apps/api/src/ai-runtime.ts:5847–5852` y `7127–7134` restringen el alcance mediante instrucciones, pero usan el mismo contrato.
- **Caso concreto:** una sección `stock` dentro de una lectura exclusiva de Meta, o dos secciones con la misma clave, puede superar el esquema de A02 aunque contradiga el alcance solicitado. Esto no demuestra que el modelo lo haga en producción.
- **Mejora mínima:** validar tras el parseo las áreas permitidas y la unicidad para la vista pedida, con una política explícita de salida inválida. Mantener el esquema general compatible con las salidas históricas.
- **Compatibilidad y aceptación:** comprobar sección de otra área, clave repetida, lista vacía válida y recomendaciones con propietario permitido. Si se permite un reintento de corrección, debe consumir el presupuesto ya definido y tener límite; no ocultar contenido inválido como si la generación hubiese sido correcta.

### A02-014 · Dar a la visión global una base comparable

- **Evidencia:** en `apps/api/src/ai-runtime.ts:7057–7113`, la lectura del periodo financiero anterior y los objetivos se añaden exclusivamente a `panel`. Overview recibe los bloques del periodo actual; el resumen de Klaviyo sí incluye tendencia mensual y el stock usa demanda reciente.
- **Caso concreto:** overview puede explicar un margen actual, pero no tiene una comparación financiera explícita equivalente a la del panel para sostener «ha empeorado frente al periodo anterior». Que exista conocimiento de la vertical no aporta esa medición de la tienda.
- **Mejora propuesta:** incorporar comparaciones pequeñas de las métricas principales, con ventanas equivalentes y advertencia de cobertura insuficiente. Incluir objetivos solo donde sean aplicables a esa audiencia y alcance.
- **Compatibilidad y aceptación:** conservar omisión de áreas sin datos y contexto acotado; probar ausencia de histórico, objetivos inexistentes, periodos incompletos y monedas incompatibles. Medir el coste adicional antes de ampliar las consultas. Es evolución funcional, no fallo de ejecución confirmado.

### A02-015 · Sustituir afirmaciones históricas por referencias vigentes

- **Evidencia:** la ficha `roadmap/roadmaps/05-agentes-ia/fases/AI-02-a02-monitor-negocio.md` conservaba afirmaciones históricas sobre generación al abrir, ausencia de cron y falta de contexto precalculado. El código actual tiene GET de lectura, orquestador y versiones posteriores con `search_knowledge`.
- **Aplicación:** la ficha ahora identifica su estado como histórico y enlaza a este registro. No se reescribieron migraciones ni se declaró como activa ninguna versión remota.
- **Compatibilidad y aceptación:** cambio documental local aplicado; el despliegue y el estado de test/producción no se comprobaron.

### Evidencia de implementación y límites de validación

- **Compilación API:** completada tras los últimos cambios.
- **Web:** TypeScript compiló; `next build` no completó el prerender porque este entorno no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para las páginas de onboarding y nueva contraseña.
- **Pruebas A02 relacionadas:** 38/38 aprobadas en `ai-a02-panel-scope.test.ts`, `ai-diagnostic-activity-gate.test.ts` y `ai-runtime-envelope.test.ts`.
- **Límite de stock:** el orden por cobertura solo prioriza productos incluidos en la muestra de hasta 30 filas de la RPC compartida; modificar la consulta SQL común afectaría A06 y se dejó fuera de alcance.
- **Límite de validación:** no se comprobaron migraciones/prompts activos en bases remotas, RLS real, datos de clientes, UI en navegador, salida de un modelo real ni rendimiento en producción. No se ejecutó `eval-a02-monitor.ts`, porque llama a servicios conectados.

## A04 · Generador de tareas / Plan diario

**Auditoría:** 17 de octubre de 2026. **Estado:** propuestas implementadas en el código local y migraciones aplicadas en Supabase test y producción.

A04 propone trabajo ejecutable hoy a partir de tareas, alertas, ventas, stock, Camino y diagnósticos previos. Comparte motor con A17/A18 y materializa tareas tras una decisión humana. Carga considerada: varias organizaciones y tiendas, con usuarios aprobando o regenerando propuestas al mismo tiempo. Los casos siguientes proceden del código local; no son incidentes confirmados en producción.

Se revisaron generación, lectura de caché, programación, contexto, contrato de salida, aprobación, creación de tareas, enlace a hitos y consumidores web. Ya existen autorización previa al resolver tiendas, resolución estricta de tienda activa, reserva de presupuesto, distinción error/vacío en varios bloques y comprobaciones de persistencia del runner compartido. Esas protecciones no se vuelven a proponer como trabajo pendiente.

### Prioridades de A04

P1: alcance, decisiones humanas, materialización y datos que cambian la decisión del agente. P2: robustez, frescura, coste y selección de evidencia. El riesgo indica el alcance del cambio propuesto, no una garantía de ausencia de regresiones.

| ID | Prioridad | Mejora | Riesgo estimado |
|---|---|---|---|
| A04-001 | P1 | Generar automáticamente las mismas cachés por tienda que solicita la UI | Medio: programación y presupuestos |
| A04-002 | P1 | Hacer atómica e idempotente la aprobación y creación de tareas | Alto: escritura compartida y concurrencia |
| A04-003 | P1 | Bloquear la aprobación si no se puede recuperar el alcance del run | Bajo/medio: ruta compartida |
| A04-004 | P1 | Persistir decisiones y ediciones por propuesta | Medio: historial, reintentos y contexto |
| A04-005 | P1 | Respetar un hito nulo y validar la vigencia del hito propuesto | Medio: Camino y creación de tareas |
| A04-006 | P1 | Alinear el contrato reducido con la explicación y límites de A04 | Medio: contrato, prompt y UI |
| A04-007 | P1 | Conservar la meta estructurada y los estados reales de Camino | Bajo/medio: contexto de tres horizontes |
| A04-008 | P1 | Elegir el A02 correcto por vista, ventana y cadencia | Medio: coordinación entre agentes |
| A04-009 | P2 | Unificar la frescura de caché y envelope de A04 | Bajo/medio: respuesta compartida |
| A04-010 | P2 | Priorizar backlog y alertas antes de limitar la muestra | Medio: selección de contexto |
| A04-011 | P2 | Filtrar el historial por tienda antes del límite y declarar errores | Bajo/medio: memoria compartida |
| A04-012 | P2 | Conservar evidencia estructurada de los horizontes hermanos | Bajo: serialización de contexto |
| A04-013 | P2 | Distinguir métricas consultables de fuentes sincronizadas recientemente | Medio: contexto y reglas de confianza |
| A04-014 | P2 | Guardar el digest de actividad con una regla que tenga en cuenta el reloj | Medio: control de coste y calendario |
| A04-015 | P2 | Construir el calendario con el mercado y vertical reales de la tienda | Medio: contexto comercial |
| A04-016 | P2 | Reservar de forma atómica el cupo manual de A04 | Medio: coordinación persistente |
| A04-017 | P2 | Evitar cargar F9/F11 para descartarlos después | Bajo/medio: cargador compartido |

### A04-001 · Programar las lecturas que realmente solicita la interfaz

- **Evidencia:** `orchestratorScopesForAgent`, `apps/api/src/ai-runtime.ts:15067`, devuelve solo el agregado para A04. La rama de ejecución de A04 en `15902` pasa `connectionId: null`. `getPlanDiagnostic:11629` lee una caché exacta por tienda y ventana; `apps/web/src/app/dashboard/client-pulse.tsx:1114` y `apps/web/src/components/ai-diagnostic-section.tsx:700` incorporan la tienda seleccionada a la consulta.
- **Caso concreto:** el cron termina un A04 con `store_id: null`, pero el usuario abre la tienda A. El GET busca `store_id=A` y no encuentra ese resultado. Reproducido localmente: incluso recibiendo una tienda activa, `orchestratorScopesForAgent('a04_generador_tareas', stores)` devuelve únicamente el agregado. Las ventanas distintas de la predeterminada tampoco se programan actualmente.
- **Mejora mínima:** definir los scopes y ventanas automáticos que necesita A04 y pasar su `connectionId` a la ejecución. Contabilizar cada run en los cupos; conservar cachés independientes para agregado y tienda.
- **Aceptación y compatibilidad:** dos tiendas reciben sus lecturas mediante cron sin intervención manual. Una lectura agregada no sustituye silenciosamente una específica. Verificar también A17/A18, que comparten este patrón, y limitar el reparto por tick para conservar presupuesto para otros agentes.

### A04-002 · Aprobar y materializar con una sola operación protegida

- **Evidencia:** `decideAgentOutput`, `apps/api/src/ai-runtime.ts:21835`, lee primero la salida pendiente, consulta títulos abiertos en `21940` y crea tareas en `22231`. El recibo se guarda en `22395` y el cambio condicional de estado llega en `22422`, después de los efectos. En las migraciones locales no hay una clave única de tarea por salida/propuesta; `agent_output_id` se guarda dentro de `metadata`.
- **Caso concreto:** dos aprobaciones concurrentes leen la misma salida pendiente y el mismo backlog antes de insertar. Ambas pueden crear la misma tarea; el filtro final de estado evita un segundo cierre, pero llega después de las inserciones. Una aprobación y un rechazo concurrentes también pueden dejar tareas creadas para una salida que terminó rechazada.
- **Mejora mínima:** reclamar la salida de forma atómica y usar una identidad persistente por propuesta para crear tareas una sola vez. Coordinar recibo, estado y escrituras en una transacción o un flujo recuperable con garantías equivalentes.
- **Aceptación y compatibilidad:** probar aprobación/aprobación, aprobación/rechazo, reenvío de la misma petición y caída entre escrituras. Debe haber una decisión coherente y como máximo una tarea por propuesta. El deduplicado por título puede mantenerse como regla adicional; no sustituye la idempotencia.

### A04-003 · Conservar el alcance cuando falla la lectura del run durante la aprobación

- **Evidencia:** `apps/api/src/ai-runtime.ts:21913` consulta `agent_runs.store_id` sin comprobar `error`; en `21919`, cualquier ausencia de fila se convierte en `taskStoreId: null`. Ese valor se usa para deduplicar, insertar tareas y buscar un hito.
- **Caso concreto:** la salida pertenece a la tienda A, pero falla temporalmente la consulta de su run. La aprobación continúa y puede crear una tarea organizativa sin tienda. El enlace posterior a un hito no garantiza recuperar siempre el alcance original.
- **Mejora mínima:** exigir una fila válida del run y distinguir un `store_id` legítimamente nulo de una consulta fallida o una fila ausente. Ante fallo, devolver un error recuperable antes de escribir tareas.
- **Aceptación y compatibilidad:** simular error y fila ausente para una propuesta de tienda; no debe insertarse ninguna tarea. Una propuesta agregada válida debe seguir funcionando con `store_id: null`.

### A04-004 · Guardar qué propuesta aprobó, editó o descartó la persona

- **Evidencia:** las ediciones de `decideAgentOutput:21877` modifican un array en memoria. La salida original no se actualiza con una versión revisada ni se registra una decisión por índice. El recibo de `agent_approvals:22395` guarda decisión global y contador; `loadPriorProposalHistory:5047` y `summarizeSiblingPlanRuns`, en `apps/api/src/plan-horizon-context.ts:485`, vuelven a leer propuestas originales.
- **Caso concreto:** el consultor descarta una propuesta y aprueba otra. La salida completa queda aprobada y el próximo plan puede interpretar ambas propuestas originales como aprobadas. Si una creación parcial se reintenta con ediciones distintas, el deduplicado por título tampoco identifica de forma estable la propuesta ya materializada.
- **Mejora mínima:** conservar el original y registrar por propuesta su identidad, decisión, texto revisado, tarea creada y motivo cuando proceda. Construir historial, memoria y contexto hermano desde ese resultado humano efectivo.
- **Aceptación y compatibilidad:** probar aprobación parcial, todas descartadas, cambio de título y reintento tras fallo parcial. Los contadores deben acumular lo realmente materializado y los agentes posteriores deben distinguir lo aprobado de lo omitido.

### A04-005 · Respetar que una tarea no pertenece a ningún hito

- **Evidencia:** el prompt A04 v13, `supabase/migrations/20261225110000_a04_v13_fechas_comerciales.sql`, exige `milestone_id: null` si no encaja un hito. Sin embargo, `shouldFallbackToCurrentMilestone`, en `apps/api/src/agent-task-delivery.ts:64`, permite fallback para A04; `decideAgentOutput:22293` lo aplica. Los triggers locales comprueban organización/tienda, pero no exigen que el plan y el hito propuestos sigan vigentes al aprobar.
- **Caso concreto:** A04 propone una incidencia independiente con hito nulo; al aprobar, se enlaza al primer hito abierto que devuelve `findCurrentMilestoneId`, aunque no tenga relación con la tarea. También puede aprobarse días después un UUID de un plan que ya cambió de estado.
- **Mejora mínima:** respetar el nulo explícito de A04 y validar en servidor que un UUID propuesto pertenece al Camino y al alcance vigentes. Hacer visible un enlace fallido cuando el vínculo formaba parte de la propuesta aprobada.
- **Aceptación y compatibilidad:** una incidencia independiente sigue sin hito; una propuesta válida se enlaza al indicado; un hito obsoleto o de otra tienda no recibe la tarea. Mantener una política explícita para salidas históricas sin ese campo y para otros agentes.

### A04-006 · Hacer compatible la salida reducida con el comportamiento prometido

- **Evidencia:** `LEAN_OUTPUT_BY_AGENT`, `apps/api/src/ai-runtime.ts:5450`, elimina `answer` de A04. `buildLeanOutputContract`, en `packages/ai/src/index.ts:3352`, lo repone con una frase genérica. El prompt v13 exige explicar fuentes, tareas que cubren los riesgos y qué avanzar hoy cuando no hay nuevas propuestas. La UI de tareas oculta `answer` en `apps/web/src/components/ai-diagnostic-section.tsx:1321` y muestra un mensaje fijo en `1363`. El array compartido de propuestas en `packages/ai/src/index.ts:343` tampoco impone el máximo de cinco del prompt.
- **Caso concreto reproducido:** con cero propuestas, el resultado queda como «Sin trabajo nuevo que proponer en este ciclo», sin la explicación exigida. El esquema reducido también acepta seis tareas, aunque A04 promete como máximo cinco.
- **Mejora mínima:** mantener un resumen breve de decisión o abstención propio de A04 y mostrarlo cuando aporte una explicación necesaria. Añadir al contrato específico los límites operativos que actualmente solo viven en el prompt.
- **Aceptación y compatibilidad:** distinguir todo cubierto, falta de datos, ausencia de riesgo y fallo de herramientas. Validar cero, una y seis propuestas, conservando el ahorro de salida y la lectura de resultados históricos. La política de A17/A18 debe revisarse por separado antes de cambiar su contrato compartido.

### A04-007 · Transportar fielmente la meta y los estados de Mi Camino

- **Evidencia:** `strategic_plans.goal` es `jsonb` desde `supabase/migrations/20261115160000_ai_a19_measurable_goal.sql:3`. `summarizeActiveCaminoForPlan`, en `apps/api/src/plan-horizon-context.ts:309`, lo pasa a un helper que solo acepta texto. En `313` filtra fases por `pending/in_progress`, mientras el enum real usa `locked/pending/active/completed` (`20260717190000_db_07_alertas_tareas_plan.sql:13`). La prueba actual usa una meta de texto y una fase `in_progress` que no representan ese contrato de DB.
- **Caso concreto reproducido:** una meta con métrica, baseline y target llega como `goal: null`; una fase con estado real `active` desaparece de `phases`. Los hitos pueden seguir presentes, pero se pierde parte del objetivo padre que debía orientar a A04.
- **Mejora mínima:** resumir campos concretos de la meta estructurada y alinear los estados con los contratos reales. Mantener compatibilidad con metas históricas de texto y ordenar fases/hitos por su posición antes del recorte.
- **Aceptación y compatibilidad:** usar fixtures derivados de las formas reales de DB: meta estructurada, fase activa, meta antigua y ausencia de Camino. Verificar los tres horizontes y evitar convertir un dato desconocido en cero.

### A04-008 · Seleccionar un A02 que represente la visión requerida

- **Evidencia:** `runPlanAgent`, `apps/api/src/ai-runtime.ts:7494`, toma el último A02 exitoso del scope y solo excluye `panel`; no filtra vista ni `lookback_days`. `summarizeMonitorForPlan:7364` aplica siete días de vigencia a todos. Las cachés A02 tienen vistas y cadencias independientes.
- **Caso concreto:** si Klaviyo o Meta fue el último A02 que acabó, A04 recibe ese análisis de área como su diagnóstico de negocio y puede dejar fuera el hallazgo de stock o finanzas de Overview. Reproducido además: un A02 de 30 días con tres días de antigüedad sigue marcado como no vencido por este resumen, aunque supera su cadencia de 56 horas.
- **Mejora mínima:** elegir explícitamente la vista y ventana adecuadas para A04 —normalmente Overview—, con compatibilidad para Overview histórico sin etiqueta. Transportar `run_id/output_id`, vista, periodo y frescura calculada con la política de A02.
- **Aceptación y compatibilidad:** mezclar runs de las cuatro vistas y ventanas y comprobar cuál recibe A04; probar fechas justo antes/después del vencimiento. Mantener el filtro exacto de tienda y la exclusión del panel del consultor.

### A04-009 · Evitar dos indicadores de frescura contradictorios

- **Evidencia:** `getCachedDiagnostic`, `apps/api/src/ai-runtime.ts:6528`, calcula antigüedad para todos, pero solo pasa una frescura explícita al envelope de A02. El valor por defecto de `buildAgentOutputEnvelope:6807` sigue siendo `fresh` para A04.
- **Caso concreto reproducido:** una lectura A04 del 1 de octubre consultada el 17 devuelve `stale: true`, mientras su envelope declara `status: fresh` con una fecha de vigencia ya pasada.
- **Mejora mínima:** obtener una única decisión de frescura de A04 y usarla en ambos campos. Definir explícitamente cómo se relacionan las 20 horas de su programación con las 24 horas actuales de su caché.
- **Aceptación y compatibilidad:** probar lecturas recientes, vencidas y con digest sin cambios, y conservar los campos de respuesta existentes. GET debe seguir siendo de lectura.

### A04-010 · Priorizar y declarar las muestras de tareas y alertas

- **Evidencia:** `runPlanAgent:7546` limita a 200 tareas ordenadas solo por prioridad y `7570` limita a 30 alertas sin orden. `summarizeOpenTasksForPlan`, en `apps/api/src/plan-horizon-context.ts:167`, ordena por fecha y conserva 25 cercanas; no conoce cuántas tareas quedaron fuera de la consulta SQL.
- **Caso concreto:** una alerta crítica puede quedar fuera de las primeras 30. Un backlog superior a 200 puede ocultar la tarea que ya cubre un riesgo. Reproducido en el resumen: 25 pendientes con fecha próxima desplazan una tarea `in_progress` sin fecha, aunque el prompt utiliza el trabajo en curso para decidir si el riesgo ya está cubierto.
- **Mejora mínima:** definir relevancia antes del recorte: alertas por severidad/fecha y tareas por estado, urgencia y vencimiento. Exponer recuentos y truncamiento reales y conservar identificadores de las tareas mostradas para poder citarlas.
- **Aceptación y compatibilidad:** probar más de 30 alertas, más de 200 tareas y trabajo en curso sin fecha. Las muestras deben conservar su scope; mantener contexto acotado y no paginar sin límite hacia el modelo.

### A04-011 · Recuperar el historial de la tienda antes de limitarlo

- **Evidencia:** `loadPriorProposalHistory`, `apps/api/src/ai-runtime.ts:5018`, lee las últimas ocho salidas de A04 para toda la organización y filtra `store_id` después en `5030`. Ignora el error de esa consulta.
- **Caso concreto:** ocho runs recientes de la tienda B ocultan todo el historial previo de A, aunque exista. Una caída de la consulta produce igualmente un historial vacío, sin advertir que no se pudo comprobar lo ya propuesto o rechazado.
- **Mejora mínima:** aplicar el filtro exacto por tienda al consultar, antes de `limit`. Diferenciar error, vacío e historial disponible y añadir la procedencia mínima necesaria para seguimiento.
- **Aceptación y compatibilidad:** probar más de ocho runs intercalados de dos tiendas y un error de consulta. No mezclar el historial agregado con el de una tienda y verificar los demás agentes que usan el helper.

### A04-012 · Conservar las cifras de las propuestas hermanas

- **Evidencia:** el contrato de propuestas representa `evidence` como array de objetos (`packages/ai/src/index.ts:334`). `summarizeSiblingPlanRuns`, en `apps/api/src/plan-horizon-context.ts:559`, intenta convertir ese array a texto mediante `text`, que solo admite cadenas.
- **Caso concreto reproducido:** una propuesta semanal con evidencia `[{label: 'Cobertura', value: '2 días', ...}]` llega a A04 con `evidence: null`. El título y parte de la justificación siguen, pero falta el dato concreto para distinguir una prioridad fundada de una sugerencia general.
- **Mejora mínima:** resumir un número acotado de objetos de evidencia con etiqueta, valor, periodo y fuente. Preservar también los identificadores de salida/run y la decisión humana efectiva cuando esté disponible.
- **Aceptación y compatibilidad:** probar arrays actuales, cadenas históricas, evidencia vacía y elementos inválidos. Mantener límites de tamaño y el estado de aprobación de cada horizonte.

### A04-013 · Dar a las ventas un estado explícito de actualización

- **Evidencia:** los bloques de ventas de `runPlanAgent:7572` y `7649` distinguen error y datos, pero no incorporan un estado de sincronización por tienda. La RPC `shopify_sales_summary` devuelve totales, sin `last_sync_at` (`supabase/migrations/20260716113848_db_05g_shopify_metrics_store_scope.sql:13`). El prompt v13 exige reducir confianza si ventas o A02 están vencidos.
- **Caso concreto:** la consulta puede funcionar y devolver ventas históricas tras varios días sin sincronización. El bloque aparece disponible, pero el agente no recibe una comprobación determinista que le permita aplicar la regla de datos vencidos a esas ventas. La frescura de inventario ya tiene salvaguardas independientes.
- **Mejora mínima:** incluir última sincronización correcta, estado y cobertura conocida de la fuente del scope. Diferenciar disponibilidad de la consulta, actualización de la integración y antigüedad del diagnóstico.
- **Aceptación y compatibilidad:** Shopify reciente, sincronización fallida con histórico, conexión sin primera carga y agregado con tiendas de distinta frescura. Limitar las conclusiones afectadas sin invalidar automáticamente las fuentes que sí sean utilizables.

### A04-014 · Hacer efectivo el control de actividad sin olvidar el paso del tiempo

- **Evidencia:** el orquestador calcula el digest en `apps/api/src/ai-runtime.ts:15589` y lo escribe en el log de decisión, pero el insert de `agent_runs:5709` y su cierre no lo persisten. En el código y migraciones locales no aparece un trigger que lo complete; el script de demo sí lo rellena expresamente. `decideOrchestratorAction:15273` trata un digest nulo como actividad cambiada y uno igual como motivo de omisión indefinida.
- **Caso concreto:** los runs normales pueden volver a ejecutarse al vencer las 20 horas aunque nada haya cambiado, porque no conservan su huella previa. Guardarla sin más introduciría el problema inverso: un vencimiento o una nueva ventana de preparación comercial puede necesitar trabajo aunque no haya habido escrituras en la organización.
- **Mejora mínima:** persistir la huella con el run y definir para A04 una invalidación temporal acotada, ligada al día o a la próxima transición relevante. Capturar una instantánea coherente antes de construir el contexto.
- **Aceptación y compatibilidad:** comprobar ahorro sin actividad y ejecución cuando cruza un vencimiento/ventana comercial. Probar el caso de una sincronización que termina durante el run; no trasladar sin revisión esta política a todos los agentes.

### A04-015 · Usar el mercado real para el calendario comercial

- **Evidencia:** `runPlanAgent:7619` pasa `storeLabel` como descripción a `buildCaminoCalendarPack:9414`. Ese label solo contiene el nombre de la tienda o el agregado. `commercialCalendar`, en `apps/api/src/commercial-calendar.ts:209`, detecta mercado y categorías buscando palabras en ese texto; `detectMarkets:204` usa España cuando no encuentra ninguna.
- **Caso concreto reproducido:** el nombre «Atelier Nord» produce mercado `ES`. Una tienda francesa con ese nombre, o una marca cuyo nombre no describe su producto, puede recibir un calendario que omite sus fechas o temporadas relevantes.
- **Mejora mínima:** construir el contexto desde país/mercados y vertical declarados de la tienda. Separar datos confirmados de inferencias y hacer explícita la cobertura cuando falten esos campos.
- **Aceptación y compatibilidad:** nombres de marca neutros, tienda francesa, tienda española, varias tiendas de países diferentes y vertical desconocida. Conservar las ventanas de preparación existentes y la distinción entre evento estándar y campaña confirmada.

### A04-016 · Reservar el cupo manual en la misma operación que lo consume

- **Evidencia:** `assertManualRefreshQuota`, `apps/api/src/ai-runtime.ts:5196`, cuenta runs y concede permiso; el run se inserta después en `5709`. A04 mantiene rutas manuales (`apps/api/src/server.ts:9154` y `/ai/plan/:horizon/run`). La reserva monetaria es otro control y no reserva este contador.
- **Caso concreto:** configurado un límite de un uso restante, dos usuarios pueden leer el mismo contador antes de que se cree cualquiera de los runs. Si el presupuesto monetario admite ambos, los dos comienzan y exceden el cupo.
- **Mejora mínima:** reservar persistentemente cupo y run mediante una operación atómica, con una identidad para reenvíos de la misma petición. Definir qué intentos fallidos consumen el uso y cuándo se libera una reserva.
- **Aceptación y compatibilidad:** dos solicitudes concurrentes para el último uso: una admitida. Mantener el reparto por organización/agente y el día UTC ya utilizado, y cubrir también el acceso alternativo `/ai/plan/day/run`.

### A04-017 · Seleccionar recolectores antes de consultar F9 y F11

- **Evidencia:** `runGenericDiagnosticAgent`, `apps/api/src/ai-runtime.ts:5794`, espera a `loadDecisionPlaybookContextBlocks` y después elimina los bloques F9/F11 para A04. El cargador ejecuta sus consultas en `apps/api/src/decision-playbook-chat-context.ts:941` y añade F11 en `1316`. A04 ya obtiene por separado su D14 con scope de tienda en `runPlanAgent:7622`.
- **Caso concreto:** un run A04 hace lecturas de aprendizaje y diagnóstico ejecutivo completo para construir bloques que se descartan. El ensamblado ejecutivo se puede consultar otra vez sin el scope de tienda desde ese cargador. Es coste de construcción de contexto aunque esos bloques no lleguen al modelo.
- **Mejora mínima:** permitir que el cargador reciba un perfil de fuentes necesarias y omita consultas de F9/F11 desde el principio. Reutilizar el resultado ejecutivo ya obtenido dentro del mismo run cuando haga falta.
- **Aceptación y compatibilidad:** comparar bloques enviados al modelo y contabilizar consultas antes/después con un cliente de DB simulado. Preservar el perfil completo del copiloto y A17/A18. El ahorro propuesto es de consultas y latencia; no se atribuye un ahorro de tokens a bloques que ya se eliminaban.

### Verificación de esta auditoría de A04

- **70/70 pruebas locales existentes aprobadas:** `plan-horizon-context.test.ts`, `ai-runtime-plan-auth.test.ts`, `ai-agent-approval-guards.test.ts`, `agent-task-delivery.test.ts`, `task-outcome.test.ts`, `ai-diagnostic-activity-gate.test.ts` y `ai-runtime-envelope.test.ts`. No equivalen a 70 escenarios completos de A04 y no cubren las carreras de escritura descritas.
- **Reproducciones locales adicionales:** meta estructurada convertida en nulo; fase `active` omitida; evidencia hermana convertida en nulo; explicación vacía sustituida por texto genérico; seis tareas aceptadas por el contrato; cron de A04 exclusivamente agregado; cache vencida con envelope fresco; A02 de 30 días/3 días de antigüedad marcado como vigente; tarea en curso sin fecha omitida del resumen; mercado español inferido de un nombre neutro.
- **Inspección, sin provocar el fallo:** concurrencia de aprobación y cupo, fallo de scope durante aprobación, pérdida de decisiones por propuesta, selección del último A02, filtros antes/después de los límites y consultas que se descartan.
- **Alcance de herramientas:** se utilizó el grafo para localizar funciones y relaciones. Sus snippets tenían offsets antiguos; se contrastó el contenido en los archivos actuales antes de registrar evidencia.
- **Sin cambios de ejecución ni escrituras remotas:** no se modificaron código, prompts ni migraciones durante esta auditoría. No se ejecutaron tests remotos que crean/borran organizaciones, turnos con proveedor ni evaluadores conectados.
- **Pendiente de verificar al implementar:** transacciones y RLS reales, versión de A04 activa, despliegue, navegabilidad con dos tiendas/roles y tiempos/costes en producción. Las referencias de línea corresponden al worktree auditado y pueden moverse con futuros cambios.

### Implementación de A04 (17 de octubre de 2026)

Se implementaron las 17 mejoras A04 en el runtime, el contexto compartido de Camino y calendario, el cargador de contexto del playbook y el componente web. Los cambios aíslan scopes de tienda, fijan frescura y selección de evidencia, conservan decisiones/editados por propuesta y hacen recuperable la materialización de tareas ante reintentos. La reserva del cupo manual y los bloqueos de decisión usan RPC y tablas nuevas; la identidad única por propuesta evita duplicados.

- **Migración local:** `supabase/migrations/20261227100000_a04_atomic_approval_and_quota.sql`. Añade claves idempotentes, claims de decisión, reservas manuales y campos de país, mercados y vertical para `shopify_stores`. El calendario trata mercados vacíos como desconocidos y no inventa España.
- **Configuración de mercado:** el runtime ya consume esos campos; quedan vacíos por defecto para no alterar datos existentes. Hasta que la tienda tenga país/mercados/vertical configurados, el calendario comercial no puede inferir la cobertura real. No se añadió un formulario de administración en esta pasada.
- **Idempotencia de petición:** las rutas A04 admiten `Idempotency-Key` opcional (máximo 128 caracteres). La reserva diaria sigue siendo atómica aunque el cliente no envíe esa clave; las repeticiones exactas solo se detectan cuando el cliente la conserva.
- **Verificación local:** 76/76 pruebas focalizadas aprobadas; `npm run typecheck` aprobado en `apps/api` y `apps/web`.
- **Despliegue de esquema:** migraciones aplicadas en `TEST ES IA` (refs `kopcblejsxpkxoykldyh`) y `E-NORA` producción (`cthjwpeygpzwdmjkxeqa`). El historial confirma `a04_atomic_approval_and_quota` y `a04_decision_claim_org_index` en ambos proyectos; columnas, RPC e índices esperados verificados. La segunda migración añade el índice que señaló el asesor de rendimiento.
- **Asesores Supabase:** no aparecieron hallazgos nuevos de seguridad o rendimiento aparte de las tablas con RLS sin políticas (informativo e intencional: acceso exclusivo por `service_role`) y el índice recién creado que todavía figura como no usado. El resto de hallazgos son preexistentes del proyecto.
- **Fuera de esta verificación:** no se probaron carreras con PostgreSQL real, comportamiento de RLS efectivo en sesión de usuario, datos reales, navegador ni despliegue de la aplicación. Las reservas consumen el cupo del día incluso si la ejecución falla; así se evita superar el límite por reintentos concurrentes.

## A05 · Estrategia de campañas

**Auditoría:** 17 de octubre de 2026. **Estado:** implementación local realizada; ver el resultado y las mejoras parciales al final de la sección. La migración SQL aún no se ha aplicado en test ni producción.

A05 prepara iniciativas y acciones fechadas de Klaviyo y Meta para una tienda, usando conocimiento, ventas, margen, inventario, historial y Camino. Se asumieron varias organizaciones y tiendas, campañas que abarcan varios meses y usuarios guardando, aprobando o rechazando simultáneamente. Se revisaron generación, contrato, lectura, materialización en calendario, enlace a tareas/hitos y consumidor web. Los casos descritos son riesgos del código local; no son incidentes confirmados en producción.

Ya existen autorización de organización previa a resolver tiendas, selección estricta de tienda activa, comprobaciones de calendario/tienda, reserva del presupuesto del runner, evidencia obligatoria en iniciativas, jerarquías de canal y un índice único por salida/acción en calendario. Ese índice evita dos filas con la misma identidad A05; las mejoras de concurrencia siguientes no presuponen que falte. La generación manual de A05 y la separación entre planificación y envío/publicación se conservan.

### Prioridades de A05

P1: selección humana, permisos, decisiones y escrituras coherentes, fechas solicitadas y datos que condicionan la estrategia. P2: recuperación, contexto, coste y compatibilidad. El riesgo corresponde al cambio propuesto; no garantiza ausencia de regresiones.

| ID | Prioridad | Mejora | Riesgo estimado |
|---|---|---|---|
| A05-001 | P1 | Respetar la selección al guardar acciones como borradores | Bajo/medio: ruta y validación |
| A05-002 | P1 | Comprobar permisos antes de aprobar acciones ya existentes | Medio: autorización y flujo cliente/consultor |
| A05-003 | P1 | Separar acciones en calendario de acciones aprobadas | Medio/alto: estados y decisiones por acción |
| A05-004 | P1 | Serializar aprobación, rechazo y materialización | Alto: escrituras y concurrencia |
| A05-005 | P1 | Recuperar tareas y enlaces incompletos al reintentar/aprobar | Medio/alto: calendario, tareas y Camino |
| A05-006 | P1 | Comprobar la persistencia del estado y recibo final | Medio: cierre y respuesta del servicio |
| A05-007 | P1 | Vincular la salida del modelo a la ventana solicitada | Medio: contrato y parámetros del run |
| A05-008 | P1 | Validar fechas reales, zona horaria y horas locales inexistentes | Medio: contrato y conversión temporal |
| A05-009 | P1 | Aplicar a A05 la comprobación de compatibilidad de divisas | Medio: contexto monetario |
| A05-010 | P1 | Consultar campañas que solapan la ventana y excluir archivadas | Bajo/medio: contexto del calendario |
| A05-011 | P1 | Vincular únicamente hitos vigentes del Camino correcto | Medio: selección del plan y enlaces |
| A05-012 | P2 | Distinguir fuentes fallidas, vacías y desactualizadas | Medio: estados de contexto y confianza |
| A05-013 | P2 | Recuperar el RAG después de comprobar habilitación y presupuesto | Bajo/medio: orden de ejecución y trazabilidad |
| A05-014 | P2 | Reservar de forma atómica el cupo manual de A05 | Medio: control persistente de ejecuciones |
| A05-015 | P2 | Calcular eventos desde mercado, vertical y ventana reales | Medio: contexto comercial |
| A05-016 | P2 | Priorizar y declarar la cobertura de inventarios limitados | Bajo/medio: selección de contexto |
| A05-017 | P2 | Reintentar solo efectos pendientes y tratar filas archivadas explícitamente | Medio: progreso e idempotencia |
| A05-018 | P2 | Elegir calendario por año de las acciones | Medio: contenedores y consultas por año |
| A05-019 | P2 | Conservar la duración de las campañas legadas | Bajo/medio: compatibilidad temporal |

### A05-001 · Conservar los índices elegidos al guardar borradores

- **Evidencia:** `apps/web/src/components/campaign-plan-proposal.tsx:475` envía `selected_indexes` a `/from-proposal/drafts`. El handler en `apps/api/src/server.ts:9683` solo declara y pasa `output_id`, `calendar_id` y `mode: "draft"`. `createCampaignItemsFromProposal`, `apps/api/src/campaign-planning.ts:1767`, interpreta índices ausentes como todas las acciones.
- **Caso concreto:** tras un guardado parcial quedan tres acciones pendientes. La persona marca una y pulsa «Añadir 1»; el servidor recibe la petición pero materializa también las dos descartadas.
- **Mejora mínima:** admitir, validar y pasar `selected_indexes` también en la ruta de borradores. Diferenciar selección ausente, selección vacía y selección inválida; mantener el guardado automático completo cuando no se envía selección.
- **Aceptación y compatibilidad:** probar la petición HTTP con `[1]`, `[]`, duplicados e índices fuera de rango. Solo debe guardarse lo indicado, conservando los índices originales de las jerarquías nuevas y del contrato legado.

### A05-002 · Autorizar la decisión aunque no se creen filas nuevas

- **Evidencia:** `createCampaignItemsFromProposal:1610` solo comprueba membresía. `requireAgendaWriter:68` no se llama en este flujo. Si el calendario ya existe y cada acción tiene fila, el bucle `1863` continúa sin invocar `createCampaignCalendarItem`, donde se comprueban restricciones adicionales. Después se actualiza la salida en `1914`.
- **Caso concreto reproducido con transporte simulado:** un miembro cliente, con acciones A05 ya existentes, obtiene `ok: true`, `complete: true`, `status: "approved"`; se ejecutan el PATCH de la salida y el POST del recibo sin consultar quién gestiona la agenda. La regla `agendaWriteDecision(false, true)` deniega esa capacidad a un cliente con consultor.
- **Mejora mínima:** resolver al principio la capacidad de decisión según consultor asignado, rol y modo. Aplicarla antes de reutilizar calendarios o acciones, manteniendo la capacidad del cliente para crear sus propias propuestas en revisión.
- **Aceptación y compatibilidad:** un cliente con consultor no aprueba el plan ajeno ni uno completo previamente guardado como borrador. El consultor conserva la decisión y el cliente sin consultor conserva su autonomía. Probar el servicio completo, además de la función booleana de permisos.

### A05-003 · No confundir presencia en calendario con aprobación humana

- **Evidencia:** el frontend guarda todas las acciones automáticamente después de generar (`campaign-plan-proposal.tsx:353`). En `createCampaignItemsFromProposal:1911`, el cierre cuenta todas las filas no archivadas de la salida; no distingue guardados con `mode: "draft"` de selecciones aceptadas. La salida se publica si el número alcanza `allItems.length`.
- **Caso concreto:** una propuesta tiene cinco acciones auto guardadas como borradores. Una aprobación posterior selecciona una sola; las otras cuatro también cuentan como aplicadas y el plan completo pasa a publicado. No hay registro por acción que conserve qué aceptó realmente la persona.
- **Mejora mínima:** persistir por acción su estado de planificación y su decisión humana, incluyendo quién y cuándo decide. Calcular el cierre desde decisiones efectivas y definir cómo termina una aceptación parcial con acciones descartadas.
- **Aceptación y compatibilidad:** guardar cinco borradores no aprueba ninguno. Aprobar uno no avala los otros cuatro ni los presenta como dirección aprobada a otros agentes. Conservar la posibilidad de revisar y completar el resto sin duplicar acciones.

### A05-004 · Coordinar rechazo y aprobación en un flujo protegido

- **Evidencia:** `rejectCampaignPlanProposal:1495` y `createCampaignItemsFromProposal:1629` leen el estado por separado. Creación, archivo, borrado de tareas, estado y recibo se escriben en llamadas distintas. Las actualizaciones finales (`1580` y `1914`) no condicionan el estado leído ni usan el claim de decisiones incorporado para A04. El índice único de calendario no serializa esas decisiones.
- **Caso concreto:** una aprobación lee una salida pendiente; un rechazo la cierra sin acciones todavía; la primera petición continúa, crea acciones y la publica. También puede cambiar una tarea a en curso entre la comprobación del rechazo y su borrado condicional, quedando el plan rechazado con trabajo vivo.
- **Mejora mínima:** coordinar los tres modos sobre la misma salida mediante una transacción o un flujo recuperable con exclusión de decisiones incompatibles, condiciones de estado y comprobación de las filas afectadas. Mantener la clave única de acción existente.
- **Aceptación y compatibilidad:** probar aprobar/rechazar, guardar/rechazar, doble aprobación y caída entre efectos contra PostgreSQL. El estado final, el recibo, el calendario y las tareas deben expresar una decisión compatible. No borrar trabajo iniciado o compartido por una lectura anterior.

### A05-005 · Completar los efectos de una acción que ya existe

- **Evidencia:** `createCampaignCalendarItem:615` inserta primero el calendario; después crea la tarea y actualiza su enlace (`668`–`715`). `createCampaignItemsFromProposal:1863` interpreta cualquier fila encontrada como terminada y la omite. Los borradores no preparan hitos (`1826`), pero tampoco se completan al aprobarse si ya tienen fila.
- **Caso concreto:** falla crear la tarea después de insertar una campaña; el reintento encuentra esa campaña y responde `already_created` sin reparar la tarea. El mismo salto impide añadir tarea/hito al aprobar una acción previamente auto guardada como borrador.
- **Mejora mínima:** distinguir existencia de fila de materialización completa. Reutilizar la identidad de acción para completar de forma idempotente tarea, enlace al hito y visibilidad acordada, conservando correcciones humanas de la campaña.
- **Aceptación y compatibilidad:** inyectar fallos al crear tarea, enlazar hito y actualizar calendario; el reintento completa lo pendiente sin tareas huérfanas ni duplicadas. Probar también borrador seguido de aprobación con un Camino activo.

### A05-006 · No responder éxito si falla el cierre de la decisión

- **Evidencia:** `campaign-planning.ts:1914` espera el PATCH y el INSERT de aprobación pero ignora sus errores; `1584` también ignora el error del recibo de rechazo. La respuesta de `1937` informa `approved` según el modo solicitado, aunque la persistencia falle.
- **Caso concreto reproducido:** con el transporte devolviendo errores en el PATCH de `agent_outputs` y el POST de `agent_approvals`, el servicio devuelve `ok: true`, `complete: true`, `failed: []`, `status: "approved"`.
- **Mejora mínima:** comprobar errores y filas afectadas, hacer duradero el recibo y devolver el estado efectivamente persistido. Un cierre incompleto debe poder recuperarse sin repetir efectos ya terminados.
- **Aceptación y compatibilidad:** los fallos de escritura no producen un mensaje de aprobación completa. Probar rechazo con recibo fallido, cierre concurrente y reintento; cada respuesta debe coincidir con el estado y la trazabilidad de la base.

### A05-007 · Fijar la ventana de entrada como autoridad

- **Evidencia:** `runCampaignStrategist`, `ai-runtime.ts:11167`, resuelve una ventana válida y la envía como texto/contexto. El contrato pasado en `11684` no compara la salida con `startDate`, `endDate` o `timezone`. El guardado (`campaign-planning.ts:1784`) valida contra `planning_window` devuelta por el propio modelo, no contra parámetros inmutables del run.
- **Caso concreto:** se solicita noviembre de 2026 y el modelo devuelve una ventana coherente en noviembre de 2030; el contrato actual acepta esa salida. Si sus acciones cumplen esa ventana auto declarada, el guardado no detecta la sustitución del intervalo solicitado.
- **Mejora mínima:** persistir los parámetros de planificación y validar la salida contra la ventana y zona resueltas por el servidor. Usar esa misma autoridad al leer y materializar; el modelo no debe redefinirla.
- **Aceptación y compatibilidad:** rechazar o corregir explícitamente una salida que cambie fechas o zona. Probar ventanas equivalentes entre varias tiendas y la lectura de propuestas legadas sin parámetros persistidos.

### A05-008 · Validar calendario y reloj además del formato de fecha

- **Evidencia:** `packages/ai/src/index.ts:1303` y los esquemas de mensajes/iniciativas validan fechas con regex y zona como cadena; las comprobaciones posteriores comparan cadenas. `localCampaignDateTimeToUtc`, `campaign-plan-window.ts:154`, ajusta un instante tres veces sin comprobar que vuelve a la hora local pedida.
- **Casos reproducidos:** el contrato acepta `2030-02-30` y después la conversión lanza `invalid_campaign_plan_date`; también acepta `Invalid/Zone`. En Madrid, `2027-03-28 02:30` no existe y el conversor devuelve silenciosamente un instante que se representa como `01:30` local.
- **Mejora mínima:** reutilizar la validación de días reales y zonas IANA en la salida; verificar la conversión de vuelta de cada hora local. Definir una política explícita para horas inexistentes o duplicadas por cambio horario y responder un error manejable.
- **Aceptación y compatibilidad:** cubrir febrero, años bisiestos, zona inválida, salto y repetición de hora. Una acción inválida no debe provocar un error sin tratar al convertir toda la propuesta antes de aplicar la selección.

### A05-009 · Incluir a A05 en las protecciones de moneda

- **Evidencia:** A05 carga `shopify_financial_summary`, `klaviyo_email_report` y `meta_spend_summary` (`ai-runtime.ts:11256` en adelante). No pertenece a `SHOPIFY_FINANCIAL_AGENT_CODES:554` ni tiene categoría Shopify, por lo que el runner no carga para él la cobertura y guía monetaria de `5810`. Los bloques Email/Meta se describen como EUR aunque la tienda pueda operar en otra moneda.
- **Caso concreto:** una tienda Shopify en USD con gasto Meta o ingresos Klaviyo en otra moneda llega al planificador sin la comprobación compartida que limita el uso de rentabilidad incompatible/desconocida. Esos importes pueden condicionar ofertas y presupuesto; la atribución separada por canal no resuelve la diferencia de moneda.
- **Mejora mínima:** aplicar a A05 la cobertura existente de Shopify/Meta/Klaviyo, etiquetar la moneda de cada fuente y suprimir las métricas derivadas no comparables antes de construir el contexto. Conservar los indicadores no monetarios.
- **Aceptación y compatibilidad:** con monedas incompatibles o desconocidas no se usa un margen/ROAS derivado como base para escalar o descontar. Probar una tienda EUR compatible y otra USD con fuente incompleta sin cambiar los demás agentes.

### A05-010 · Mostrar ocupación real del calendario dentro de la ventana

- **Evidencia:** la consulta `planned`, `ai-runtime.ts:11317`, filtra únicamente `starts_at` entre límites UTC construidos desde días locales, omite `deleted_at` y limita a 60 filas. Ese bloque se presenta al modelo como las campañas ya planificadas que no debe duplicar.
- **Caso concreto:** una campaña Meta empieza antes del intervalo y sigue activa dentro de él: no aparece. Una acción archivada sí puede aparecer si conserva estado distinto de cancelled. En una tienda americana o asiática, los límites UTC también excluyen/incluyen horas del día local equivocado.
- **Mejora mínima:** usar límites de la zona de tienda y solapamiento de intervalos; excluir archivadas y declarar cuánta muestra se omitió. Tratar explícitamente acciones sin fin y respetar los tipos de acción que ya representan una preparación o creativo.
- **Aceptación y compatibilidad:** cubrir campaña anterior aún activa, acción archivada y ambos extremos del intervalo en varias zonas. El planificador recibe ocupación real sin sugerir duplicados por ausencia artificial del contexto.

### A05-011 · Seleccionar Camino e hitos vigentes

- **Evidencia:** el contexto de generación busca Camino activo (`ai-runtime.ts:11311`), pero la materialización selecciona la versión más reciente entre draft/active (`campaign-planning.ts:1826`). Recupera hitos sin sus estados ni los de la fase; `pickMilestoneForDate`, `camino-campaign-link.ts:14`, elige por fecha o el primer elemento recibido.
- **Caso concreto:** existe un Camino activo y otro borrador más reciente; las campañas razonadas sobre el activo se enlazan al borrador. Un hito completado con fecha adecuada también puede recibir trabajo nuevo; sin fechas, el orden recibido decide el enlace.
- **Mejora mínima:** fijar el plan objetivo y validar su vigencia al guardar; filtrar estados de fases/hitos, ordenar por posición y conservar la posibilidad de no enlazar si no hay un hito apropiado. No reabrir ni usar un borrador de forma implícita.
- **Aceptación y compatibilidad:** probar activo junto a borrador nuevo, hitos completados, fase bloqueada y lista desordenada. La selección por fecha existente se mantiene dentro del conjunto de hitos realmente elegibles.

### A05-012 · Declarar fallos y frescura de las fuentes

- **Evidencia:** ventas, comparativa, finanzas y stock usan `data ?? "sin_datos"` (`ai-runtime.ts:11595`); Camino usa `sin_plan_activo` y calendario `[]` aunque sus consultas fallen. `loadCampaignMethodologyBlock:9843` no comprueba `result.error` de `executeKnowledgeSearch`. No se carga una comprobación de última sincronización correcta para las métricas Shopify/Email/Meta; Meta selecciona `last_synced_at` de cuenta pero no lo incorpora a su resumen.
- **Caso concreto:** falla la lectura del calendario y A05 recibe «ninguna campaña»; falla RAG y se informa búsqueda vacía. Una sincronización fallida durante días deja métricas consultables que aparentan estar listas para decidir sobre stock, frecuencia o inversión.
- **Mejora mínima:** separar available/empty/unavailable y registrar errores parciales del RAG; incluir última sincronización correcta y fallo reciente por tienda/conexión. Reducir confianza y alcance de la propuesta cuando la fuente crítica falte o esté antigua, conservando lo que sí se verificó.
- **Aceptación y compatibilidad:** simular consulta fallida, cero filas y datos antiguos con sync fallida. Ninguno debe convertirse en ausencia confirmada de campañas, plan o demanda. Las búsquedas de conocimiento parcialmente correctas deben conservar fragmentos junto a su cobertura real.

### A05-013 · Aplicar los controles antes de pagar la recuperación de conocimiento

- **Evidencia:** `runCampaignStrategist:11206` ejecuta `loadCampaignMethodologyBlock` antes de entrar al runner (`11223`). El cargador puede hacer hasta ocho embeddings y búsquedas/rerank en serie. Los controles de agente habilitado, proveedor, presupuestos y cupo manual están dentro de `runGenericDiagnosticAgent:5530`, y el run/snapshot se crea después.
- **Caso concreto:** un cliente con A05 deshabilitado o cupo ya agotado todavía provoca recuperación pagada y latencia antes de recibir el rechazo. Ese trabajo previo queda fuera del paso de construcción de contexto y del run de A05.
- **Mejora mínima:** ejecutar la recuperación inicial dentro de la construcción de contexto, después de los controles y la reserva. Mantener su prioridad estratégica para el modelo y registrar duración, estado y alcance recuperado; no eliminar el RAG ni aumentar su paralelismo sin medir.
- **Aceptación y compatibilidad:** agente deshabilitado, presupuesto/cupo agotado y proveedor ausente no disparan embeddings. Un run admitido conserva el conocimiento previsto y su trazabilidad; comparar peticiones y tiempos con transporte simulado.

### A05-014 · Reservar el cupo manual y reconocer reintentos

- **Evidencia:** `assertManualRefreshQuota`, `ai-runtime.ts:5210`, solo usa la reserva atómica para A04; A05 sigue contando runs antes de insertar el suyo. La ruta A05 (`server.ts:9618`) no transmite una clave de petición idempotente. El rate limit HTTP y la reserva de presupuesto total no garantizan el límite diario por agente.
- **Caso concreto:** con una ejecución restante, dos peticiones de A05 leen el mismo contador y ambas comienzan. Reenviar una generación por una respuesta perdida también produce trabajo nuevo en lugar de reconocer la petición original.
- **Mejora mínima:** extender la reserva persistente existente a A05, con identidad de petición y reglas explícitas para fallo/reintento. Coordinarla con la comprobación previa al RAG de A05-013.
- **Aceptación y compatibilidad:** dos peticiones concurrentes con una plaza admiten solo una. La misma clave no ejecuta dos modelos; el comportamiento diario de A04 y los presupuestos globales se conserva.

### A05-015 · Derivar el calendario comercial del perfil y periodo efectivos

- **Evidencia:** la UI inicializa `market` con España (`campaign-plan-proposal.tsx:228`). `runCampaignStrategist:11177` solo carga eventos si el texto coincide con España; el resolver de tienda no lee país, mercados o vertical. El alcance comercial se calcula desde hoy con un máximo de 366 días (`11191`), aunque una ventana custom futura más lejana sea válida.
- **Caso concreto:** una tienda francesa recibe España por defecto si nadie corrige el formulario; escribir Francia vacía todo el calendario aunque el helper ya soporte ese mercado. Una ventana válida de Black Friday de 2028, pedida en 2026, también queda sin eventos porque se generan desde hoy hasta un año.
- **Mejora mínima:** usar los campos de mercado/vertical ya disponibles, permitir una anulación explícita y conservar desconocido cuando falten datos. Calcular eventos para la ventana solicitada y su preparación, con fechas de la tienda, evitando la dependencia implícita del nombre o del país del formulario.
- **Aceptación y compatibilidad:** Francia, España y mercado desconocido producen coberturas distintas y declaradas. Probar ventana futura lejana y cambio de año; un festivo no se convierte por sí mismo en campaña confirmada o demanda prevista.

### A05-016 · Priorizar inventarios y declarar sus recortes

- **Evidencia:** el inventario de A05 consulta hasta 200 campañas Meta y 200 flows sin ordenar por vigencia; luego aplica límites compartidos de 500 conjuntos, 1000 anuncios y 1200 acciones/mensajes (`ai-runtime.ts:11430`–`11483`). Los contadores y `available` describen las filas cargadas, sin una cobertura completa por padre ni una señal consistente de truncado en Meta.
- **Caso concreto:** una cuenta con más de 200 campañas puede devolver la muestra llena de campañas antiguas y dejar fuera la actual; un flow grande puede consumir la muestra de acciones y dejar otros sin pasos. A05 interpreta un inventario parcial como la estructura disponible y puede proponer trabajo ya existente.
- **Mejora mínima:** priorizar activo/reciente y periodo relevante antes del límite, conservar una muestra por padre cuando corresponda y declarar totales/omitidos/cobertura. Recortar el contexto enviado a lo necesario para detectar duplicados y orientar la estrategia.
- **Aceptación y compatibilidad:** probar una cuenta con 201 campañas y la activa fuera de la muestra inicial, y dos flows con distribución desigual de pasos. La ausencia en una muestra no debe presentarse como inexistencia. Medir consultas y tamaño de contexto antes de atribuir un ahorro de coste.

### A05-017 · Recuperar progreso sin bloquearse por acciones antiguas o archivadas

- **Evidencia:** la búsqueda de acción existente en `campaign-planning.ts:1847` incluye filas archivadas y las cuenta como `alreadyCreated`; el cómputo final (`1902`) solo cuenta filas no archivadas. La validación temporal (`1799`) ocurre antes de distinguir efectos completados; el reintento web de borrador (`campaign-plan-proposal.tsx:412`) vuelve a solicitar el conjunto completo.
- **Casos concretos:** una acción archivada impide volver a materializar esa identidad, pero tampoco cuenta para completar: reproducido `already_created: 1`, `complete: false`, sin escrituras reparadoras. Si un plan se guardó parcialmente y una acción ya existente queda en el pasado, reintentar todas puede rechazar las pendientes futuras antes de revisar progreso.
- **Mejora mínima:** definir si una acción archivada queda retirada o puede restaurarse con decisión explícita. Contabilizar identidades/decisiones, validar fechas solo para nuevos efectos elegidos y reintentar únicamente operaciones pendientes.
- **Aceptación y compatibilidad:** probar guardado parcial que cruza medianoche, acción retirada y posterior reintento. No resucitar acciones que la persona archivó ni dejar el plan en un bucle de falsa existencia e incompletitud.

### A05-018 · Asignar el contenedor de calendario por año

- **Evidencia:** `ensureStoreCalendar`, `campaign-planning.ts:1428`, reutiliza el calendario no archivado con el año más alto sin filtrar el año requerido. Si no existe, usa el año UTC actual (`1446`), no el de las acciones. La agenda se consulta y filtra por año (`listCampaignPlanning:226`).
- **Caso concreto:** un plan para enero del próximo año se guarda dentro del calendario del año actual; o la existencia de un calendario futuro hace que acciones de este año vayan a ese contenedor. Al consultar por año, las acciones pueden quedar fuera del conjunto mostrado aunque sus fechas sean correctas.
- **Mejora mínima:** resolver el contenedor para el año local de cada acción, o definir explícitamente cómo admite el producto calendarios de varios años y alinear la consulta con ello. Coordinar la creación concurrente del mismo contenedor.
- **Aceptación y compatibilidad:** probar diciembre/enero, calendario actual junto a uno futuro y plan que cruza de año. Cada acción debe aparecer en la agenda temporal que le corresponde sin duplicar calendarios.

### A05-019 · Preservar la duración del formato legado

- **Evidencia:** `flattenCampaignPlanActions`, `packages/ai/src/index.ts:1484`, normaliza campañas legadas sin transportar `duration_days`. `campaignPlanToCalendarItems`, `campaign-planning.ts:1405`, calcula siempre el final como el día local siguiente.
- **Caso concreto reproducido:** una campaña legada válida con `duration_days: 14` se convierte en un elemento de calendario con duración de un día. El contrato todavía admite estas salidas; la compatibilidad de lectura no conserva su periodo.
- **Mejora mínima:** transportar y respetar la duración del formato legado al convertirlo; mantener la duración actual de acciones nuevas que representan envíos, preparaciones y creativos individuales.
- **Aceptación y compatibilidad:** cubrir campañas legadas de 1, 14 y 30 días, con y sin fecha absoluta y atravesando cambio horario. Las acciones jerárquicas nuevas conservan su interpretación actual.

### Implementación de las mejoras de A05

Implementación local finalizada el 17 de octubre de 2026. La migración `20261017124448_a05_atomic_campaign_decisions.sql` se generó con Supabase CLI y queda local; no se aplicó en test ni producción.

| ID | Estado | Resultado |
|---|---|---|
| A05-001 | Implementada | La ruta de borradores recibe y respeta `selected_indexes`; el componente lo conserva también en guardados y reintentos. |
| A05-002 | Implementada | Aprobar acciones existentes requiere permiso de escritura de agenda. |
| A05-003 | Implementada | El calendario registra cada acción como pendiente o aprobada, con autor y fecha; guardar borradores ya no completa ni publica el plan. |
| A05-004 | Implementada | RPC y claim persistente serializan aprobar/rechazar; los efectos de calendario conservan su clave única existente. |
| A05-005 | Implementada | Las tareas se identifican por salida/acción en el índice A04, se recuperan y enlazan al reintentar; se elimina la tarea si falla el enlace al calendario. |
| A05-006 | Implementada | El cierre de salida y recibo se realiza en una función SQL atómica y su resultado se comprueba. |
| A05-007 | Implementada | El run persiste la ventana solicitada en su objetivo y se rechaza una salida con fechas o zona distintas. |
| A05-008 | Implementada | El contrato valida días reales y zonas IANA; las horas locales inexistentes se devuelven como error recuperable. |
| A05-009 | Implementada | A05 usa la cobertura común de divisa y sus etiquetas ya no fuerzan EUR en Klaviyo o Meta. |
| A05-010 | Implementada | El contexto busca solapamientos por zona horaria, descarta archivados y declara recortes. |
| A05-011 | Implementada | Solo se seleccionan planes activos, fases activas e hitos pendientes/activos ordenados. |
| A05-012 | Implementada | Las fuentes distinguen error, vacío y disponibilidad; Shopify, Klaviyo y Meta señalan conexión, última sincronización y antigüedad superior a 48 horas. |
| A05-013 | Implementada | La recuperación RAG se ejecuta al construir contexto, después de controles de agente, cuota y presupuesto; los errores del RPC ya no parecen un resultado vacío. |
| A05-014 | Implementada | A05 reserva cuota atómica y acepta `Idempotency-Key`; una repetición devuelve la propuesta ya generada y una clave reutilizada para otra tienda/ventana se rechaza. |
| A05-015 | Implementada | Los mercados y el vertical proceden del perfil de tienda; la ventana futura alimenta el cálculo comercial completo. |
| A05-016 | Implementada | Los inventarios se priorizan por fecha y exponen totales y recortes de campañas, conjuntos, anuncios, flows, acciones y mensajes, incluidos los límites anidados. |
| A05-017 | Implementada | Las acciones archivadas producen un conflicto visible; reintentos ignoran fechas pasadas de acciones ya existentes y solo bloquean acciones nuevas caducadas. |
| A05-018 | Implementada | Sin calendario elegido, cada acción se guarda en el contenedor de su año local. |
| A05-019 | Implementada | Las salidas legadas conservan su duración al convertirse; las acciones nuevas mantienen un día. |

**Validación estática:** `npm run typecheck` aprobado en `apps/api` y `apps/web`. No se ejecutaron pruebas automatizadas ni se modificó test/producción. La migración SQL debe aplicarse antes de usar los nuevos RPC en cualquier base.

### Verificación de la auditoría inicial de A05 (antes de implementar)

- **38/38 pruebas locales existentes aprobadas:** `ai-23-campaign-plan.test.ts`, `campaign-plan-window.test.ts`, `campaign-agenda-writer.test.ts`, `camino-campaign-link.test.ts`, `campaign-outcome.test.ts`, `marketing-peer-history.test.ts`, `commercial-calendar.test.ts` y `campaign-review.test.ts`. No equivalen a 38 pruebas completas de generación o concurrencia de A05.
- **Reproducciones adicionales sin servicios externos:** cliente cerrando como aprobado un plan con acción existente; éxito pese a fallos del PATCH de estado y del INSERT del recibo; bloqueo por acción archivada; fecha imposible aceptada por Zod y rechazada después; zona inválida aceptada; contrato sin vínculo con ventana de entrada; hora inexistente convertida a otra hora local; duración legada de 14 días reducida a uno. El transporte de Supabase se sustituyó por respuestas simuladas y el script temporal se retiró.
- **Inspección, sin provocar el fallo:** selección perdida por la ruta HTTP, aprobación inferida de borradores, carreras aprobar/rechazar, tareas/enlaces incompletos, divisas, consulta de solapamientos, vigencia de Camino, errores/frescura, coste del RAG anterior a controles, cupo manual, mercados, límites de inventario y contenedores por año.
- **Herramientas y alcance:** se usó el grafo para localizar símbolos y relaciones y se contrastaron snippets con los archivos actuales. Se revisaron el runner compartido y sus controles, las migraciones A05 de contrato/evidencia/clave única, y las rutas/componentes que consumen la propuesta. No se auditó todo el editor de campañas, todo A11/A27 ni la sincronización completa de Klaviyo/Meta.
- **Sin cambios de ejecución ni escrituras remotas:** esta auditoría solo añade esta sección al MD. No se modificaron código de aplicación, prompts, migraciones, proyectos test/producción ni datos de clientes; no se llamó a un modelo o proveedor de embeddings.
- **Pendiente de verificar al implementar:** estados/RLS efectivos y versión activa de A05 en cada base, pruebas de carreras contra PostgreSQL, flujo navegador con dos tiendas y roles, comportamiento tras desconexión y cifras de coste/latencia. Las referencias de línea describen este worktree y pueden moverse con futuras modificaciones.

## A06 · Planificador inteligente de stock

**Auditoría:** 17 de octubre de 2026. **Estado:** mejoras identificadas y pendientes de implementación. Esta pasada documenta el código local actual; no verifica la versión desplegada ni el esquema efectivo de test/producción.

Alcance: `runStockPlannerAgent`, consulta del diagnóstico, programación automática, RPC de riesgo de stock y serie semanal, cálculo determinista, contexto de campañas/Camino/tareas, aprobación y presentación en el dashboard Shopify. Se contrastaron las referencias del grafo con los archivos actuales porque algunos snippets tenían líneas desactualizadas. La previsión determinista móvil se revisó como consumidor relacionado, sin extender la auditoría a toda la app móvil ni a toda la sincronización de Shopify.

### Mejoras priorizadas

Se registran **21 mejoras: 8 P1, 12 P2 y 1 P3**. P1 reúne correcciones de alcance, cobertura del dato o materialización de tareas; P2 mejora precisión, recuperación, coste y presentación; P3 amplía la capacidad del producto. Los casos reproducidos son locales o usan transporte simulado: no demuestran incidentes en producción.

| ID | Prioridad | Mejora | Riesgo estimado al implementar |
|---|---|---|---|
| A06-001 | P1 | Autorizar la organización antes de resolver la tienda | Bajo; acotable a A06 |
| A06-002 | P1 | Generar automáticamente los diagnósticos por tienda que consume la UI | Medio; orquestación y presupuesto |
| A06-003 | P1 | Comprobar cobertura y frescura de todo el inventario agregado | Medio/alto; RPC compartida |
| A06-004 | P2 | Detectar roturas por variante/SKU y ubicación | Medio/alto; granularidad adicional |
| A06-005 | P1 | Seleccionar productos activos por riesgo antes de limitar la muestra | Medio; consulta compartida con otros agentes |
| A06-006 | P1 | Distinguir semanas sin ventas de semanas sin cobertura histórica | Medio; evidencia de sincronización |
| A06-007 | P2 | Hacer visibles los fallos y límites de la previsión semanal | Bajo/medio |
| A06-008 | P1 | Preparar un contexto de productos completo dentro del presupuesto de tamaño | Medio; construcción del contexto |
| A06-009 | P1 | Validar producto, tienda y vigencia del riesgo antes de crear tareas | Medio; generación y aprobación |
| A06-010 | P1 | Deduplicar reposiciones de forma atómica entre salidas distintas | Medio; persistencia y concurrencia |
| A06-011 | P2 | Registrar qué ocurrió con cada propuesta omitida o recuperada | Medio; aprobación compartida |
| A06-012 | P2 | Dar a A06 un backlog específico de stock con identidad y cobertura | Bajo/medio |
| A06-013 | P2 | Consultar campañas vigentes y solapadas con límites explícitos | Bajo/medio |
| A06-014 | P2 | Usar mercados y fechas comparables calculadas en cada ejecución | Bajo/medio; revisar prompt candidato |
| A06-015 | P2 | Unificar la frescura del diagnóstico y su envelope | Bajo; consumidor compartido |
| A06-016 | P2 | Mostrar el estado real de las propuestas de reposición en la UI | Bajo |
| A06-017 | P2 | Reservar el cupo manual y evitar generaciones repetidas al reintentar | Medio; aprovechar mecanismo existente |
| A06-018 | P2 | Conservar precisión y rechazar fechas de sincronización futuras | Bajo; helper compartido |
| A06-019 | P2 | Evitar cargar datos y bloques que A06 descarta o no utiliza | Bajo/medio; runner compartido |
| A06-020 | P2 | Validar el hito propuesto y evitar enlaces automáticos sin relación probada | Medio; aprobación compartida |
| A06-021 | P3 | Incorporar aprovisionamiento real y medir el error de la previsión | Alto; evolución funcional separada |

### A06-001 · Autorizar antes de resolver la tienda

- **Evidencia:** `apps/api/src/ai-runtime.ts:12007–12029` y `12241–12265`. Tanto generación como lectura crean el cliente de servicio y resuelven `connectionId` antes de llegar al control de membresía del runner o caché. A04 ya realiza ese control antes de resolver el alcance.
- **Caso reproducido:** con un contexto sin acceso y transporte simulado, una conexión encontrada devuelve `403 organization_access_denied`; una inexistente devuelve `404 plan_store_not_found`. Se hicieron dos consultas privilegiadas antes de denegar el acceso. Esto distingue la existencia de una conexión; no se reprodujo lectura de datos de stock ajenos.
- **Mejora y aceptación:** comprobar acceso y estado operativo de la organización al entrar en ambas funciones, antes de crear clientes/resolver conexiones. Cubrir organización ajena, suspendida y cuenta limitada a tienda; una denegación debe evitar toda consulta de alcance.

### A06-002 · Cubrir automáticamente los alcances que pide el dashboard

- **Evidencia:** `orchestratorScopesForAgent` en `ai-runtime.ts:15388–15444` devuelve solo el agregado para A06. La ejecución de A06 en `16349–16357` pasa `connectionId: null`. El dashboard pide caché de A06 con la conexión seleccionada (`apps/web/src/app/dashboard/client-shopify.tsx:171`) y `getCachedDiagnostic` exige coincidencia exacta de tienda.
- **Caso reproducido:** con dos tiendas, el planificador de alcances devuelve únicamente `{ storeId: null, connectionId: null }`. Una selección de tienda puede carecer de lectura automática aunque exista una lectura agregada reciente.
- **Mejora y aceptación:** programar A06 para tiendas activas y conservar el agregado si tiene consumidor; pasar la conexión del candidato al ejecutar. Añadir reparto justo, prioridad por antigüedad y límites para que el aumento de alcances no consuma todo el presupuesto. Verificar primera generación, dos tiendas y recuperación de una tienda que falló.

### A06-003 · No certificar como fresco un inventario parcialmente conocido

- **Evidencia:** `supabase/migrations/20261115260000_ai_a06_stock_quality_gates.sql:43–74`: la clasificación compara inventarios rastreados con inventarios sincronizados, pero no exige que cada variante activa tenga un mapeo conocido. `latest_sync` usa `max(s.updated_at)`; `stock-risk-evidence.ts:62–69` aplica la frescura a esa única fecha.
- **Caso por inspección SQL:** dos variantes activas, una con inventario rastreado/sincronizado y otra sin mapeo pueden acabar como `tracked_current`. Si dos inventarios tienen lecturas de hoy y de hace diez días, la fecha máxima representa hoy y permite utilizar la suma como reciente. Contar inventarios con alguna fila tampoco demuestra cobertura de todas sus ubicaciones.
- **Mejora y aceptación:** declarar cobertura por variante y, cuando se conozca el universo esperado, por ubicación; separar rastreado, no gestionado, sin mapear y parcial. Calcular la frescura sobre todas las cantidades incluidas, conservando fecha más antigua y más reciente. Probar mapeo parcial, mezcla de variantes gestionadas/no gestionadas y ubicaciones con lecturas de distinta antigüedad. Mantener la firma/semántica de los consumidores existentes o crear una RPC específica de A06 antes de sustituir la compartida.

### A06-004 · Conservar el riesgo por variante y ubicación

- **Evidencia:** la RPC anterior agrupa ventas e inventario por `product_id`; el contexto de A06 y la previsión comparten esa granularidad. El contrato permite enlazar un producto, pero no identifica la variante que origina la reposición.
- **Caso concreto:** una talla agotada y con ventas puede quedar compensada por existencias de otra talla. El stock total del producto no demuestra disponibilidad de la variante que se demanda. Tampoco permite distinguir stock disponible en una ubicación que no abastece el canal.
- **Mejora y aceptación:** entregar detalle de variantes/SKU y ubicaciones relevantes, con resumen por producto para contener tamaño. No inferir el reparto desde el total. Cubrir una variante agotada con producto cubierto, ubicaciones con distintas reglas y datos sin SKU; conservar el producto como vínculo compatible de las tareas.

### A06-005 · Priorizar el riesgo real antes de cortar productos

- **Evidencia:** `20261115260000_ai_a06_stock_quality_gates.sql:89–98` ordena primero por inventario conocido y unidades vendidas y termina en `limit 30`. No filtra el estado activo del producto ni une tiendas activas para el alcance agregado. A06 utiliza esas filas directamente; el consumidor determinista móvil sí filtra productos `ACTIVE` después de recibir la misma muestra.
- **Caso concreto:** treinta productos con muchas ventas y stock abundante pueden desplazar a un producto menos vendido que está agotado. Un archivado con ventas históricas puede ocupar una plaza. La lista no incluye total ni indicador de muestra recortada.
- **Mejora y aceptación:** seleccionar productos activos de tiendas vigentes y ordenar por cobertura/riesgo, con calidad explícita, antes del límite. Mantener incidencias de inventario en una categoría visible. Exponer totales, criterio de orden y recortes. Probar más de treinta productos, uno agotado fuera del top de ventas y tiendas/productos desactivados. Revisar A02/A05 y el consumidor móvil antes de alterar la RPC compartida.

### A06-006 · Separar ausencia de ventas y ausencia de historia

- **Evidencia:** `ai-runtime.ts:12092–12122` crea 52 ceros para cada producto y sobreescribe solo semanas devueltas. `shopify_catalog_product_weekly`, declarada en `20261120000000_shopify_catalog_product_metrics.sql`, devuelve semanas con pedidos y no incluye cobertura de ingestión. `packages/contracts/src/stock-demand-forecast.ts:23–34` calcula calidad a partir de la longitud y semanas con venta.
- **Caso reproducido:** un histórico observado de solo seis semanas con diez unidades semanales, rellenado por delante hasta 52 posiciones como hace el runner, produce `weeks: 12`, `quality: strong` y riesgo alto con dos unidades disponibles. El cálculo no puede reconocer que las otras semanas no estaban observadas. La misma serie puede atribuir ceros a periodos anteriores al alta del producto o a una sincronización incompleta.
- **Mejora y aceptación:** incluir rango de cobertura por tienda/producto, completitud de pedidos y fecha de alta disponible. Rellenar cero solo dentro de periodos observados; representar el resto como desconocido y ajustar calidad/abstención. Diferenciar demanda observada de demanda potencial censurada por roturas, sin inventar ventas perdidas. Cubrir tienda recién conectada, backfill parcial, producto nuevo y una semana observada sin ventas.

### A06-007 · Informar del fallo específico de la serie semanal

- **Evidencia:** en `ai-runtime.ts:12094–12123`, el error al cargar tiendas activas se pierde al leer solo `.data`; un error de `shopify_catalog_product_weekly` deja vacío el mapa y no añade motivo de indisponibilidad. El bloque de productos puede seguir con `status: available` y `demand_forecast: null`.
- **Mejora y aceptación:** modelar la serie semanal como disponible, vacía, parcial o fallida; incluir motivo, semanas observadas y límites de filas del transporte. Conservar el diagnóstico descriptivo de stock si es válido, indicando que la previsión falló. Probar error de tiendas, error RPC, cero ventas y respuesta recortada; deben producir metadatos distintos.

### A06-008 · Enviar un contexto estructurado que quepa completo

- **Evidencia:** A06 envía hasta treinta productos con previsión y 52 unidades semanales en un único bloque (`ai-runtime.ts:12134–12173`). `packages/ai/src/untrusted-context.ts:2–3,59–62` limita cada bloque a 12.000 caracteres y corta por posición de texto. El serializador registra el truncamiento, pero no vuelve a seleccionar productos ni garantiza que el JSON quede completo.
- **Caso reproducido:** treinta productos sintéticos con los campos actuales producen 45.711 caracteres de datos; tras serializar solo aparecen ocho claves de producto, con posible corte del último registro. La muestra viene ordenada principalmente por ventas, por lo que el recorte puede eliminar riesgos más relevantes.
- **Mejora y aceptación:** elegir y resumir productos por riesgo antes de serializar; conservar objetos completos, recuentos y motivos de exclusión. Entregar la línea base compacta para el conjunto priorizado y reservar historia detallada para comparables necesarios. Probar treinta productos con nombres largos y verificar que el producto de mayor riesgo y las limitaciones siguen presentes sin ampliar globalmente los límites de todos los agentes.

### A06-009 · Validar la identidad y volver a comprobar el riesgo al aprobar

- **Evidencia:** el contrato genérico valida forma, no pertenencia de producto ni elegibilidad de la reposición; en `ai-runtime.ts:22613–22644`, la aprobación de A06 comprueba que `related_product_id` parezca UUID y no esté en el backlog, pero no consulta ese producto ni el inventario vigente. La RPC de riesgo tampoco devuelve `store_id`, que el contexto agregado no conserva por producto.
- **Caso reproducido:** con todas las respuestas de Supabase simuladas, un UUID sin producto respaldado llega al intento de insertar tarea para `store-a`, sin ninguna consulta a `shopify_products`. La escritura se detuvo con un error simulado. Una propuesta antigua también puede aprobarse tras una reposición o el archivo del producto porque no se revalida su riesgo.
- **Mejora y aceptación:** validar las propuestas contra los productos y evidencias autorizados de la ejecución; al aprobar, resolver organización/tienda real y revalidar actividad, inventario, cobertura y vigencia de la necesidad. En propuestas agregadas, atribuir la tarea a la tienda del producto. Devolver conflicto recuperable cuando la evidencia cambió. No materializar cantidades de compra sin parámetros de aprovisionamiento verificados. Probar UUID inventado, producto ajeno a la tienda, producto archivado y stock repuesto desde la generación.

### A06-010 · Deduplicar el producto entre ejecuciones concurrentes

- **Evidencia:** `decideAgentOutput` adquiere un claim por salida (`ai-runtime.ts:22192–22227`), lee tareas abiertas y después escribe. El índice utilizado por el `upsert` identifica salida/posición (`22692–22733`), no necesidad de stock. La lectura de tareas abiertas (`22368–22379`) no pagina ni consulta solo los productos propuestos.
- **Caso por inspección:** dos salidas distintas del mismo producto pueden obtener sus respectivos claims, leer ambas un backlog sin esa tarea y crear dos tareas. El límite de filas de la Data API también puede ocultar una tarea existente en backlogs grandes. El claim por salida y el índice por propuesta ya protegen otros reintentos y deben conservarse.
- **Mejora y aceptación:** comprobar y materializar la necesidad por organización, tienda y producto dentro de una transacción/bloqueo común, o con una restricción adecuada para necesidades abiertas. Consultar los productos exactos propuestos en vez de depender de una muestra general. Probar aprobaciones simultáneas de dos salidas, reintento de la misma salida, tarea cerrada y backlog superior al límite de filas. La carrera requiere prueba contra PostgreSQL; no se ejecutó en esta auditoría.

### A06-011 · Explicar las propuestas que no crean trabajo

- **Evidencia:** en `ai-runtime.ts:22621–22649`, falta de ID, producto con tarea abierta y título duplicado provocan `continue` sin un resultado específico por propuesta. `proposalDecisions` se inicializa con decisión aprobada pero sin estado de materialización. La recuperación de una tarea por salida/posición se realiza después de esas exclusiones.
- **Caso por inspección:** una propuesta general con `related_product_id: null`, permitida por el prompt, se omite. En un reintento, una tarea ya creada puede provocar exclusión por producto/título antes de recuperar su ID. El lote puede cerrarse con cero tareas nuevas sin explicar si eran duplicados, propuestas inválidas o tareas recuperadas.
- **Mejora y aceptación:** recuperar primero materializaciones previas y registrar `created`, recuperada, duplicada, omitida o inválida con su motivo e ID cuando exista. Definir si A06 admite tareas generales de calidad de datos; si se admiten, deduplicarlas por una clave distinta. Probar cada motivo, aprobación parcial y reintento, conservando un recibo comprensible por propuesta.

### A06-012 · Dar identidad y cobertura al backlog de stock

- **Evidencia:** `ai-runtime.ts:12078–12084` limita a 200 tareas abiertas y 60 cerradas de cualquier categoría, sin recuento total; no selecciona `id` ni metadata de producto. `summarizeOpenTasksForPlan` (`plan-horizon-context.ts:133–189`) puede aceptar `totalCount`, pero A06 no lo aporta; el resumen conserva título/descripcion y no la identidad del producto. Los resultados cerrados también pierden ese vínculo.
- **Caso concreto:** el stock puede quedar fuera de la muestra frente a tareas de otros módulos. El modelo debe inferir coincidencias por nombres aunque la aprobación usa UUID. Al no aportar total, el resumen no detecta el recorte previo de la consulta y presenta el tamaño observado como total.
- **Mejora y aceptación:** cargar primero tareas relacionadas con los productos de riesgo, conservando ID, producto, tienda, motivo y fechas; añadir un resumen organizativo acotado cuando aporte contexto. Declarar recuentos y muestras, y distinguir una tarea existente que cubre la necesidad de una tarea lejana que no la resuelve. Probar más de 200 tareas, productos homónimos, tarea global y tarea de otra tienda.

### A06-013 · Priorizar campañas vigentes y solapadas

- **Evidencia:** `ai-runtime.ts:12039–12050` busca campañas por fecha de inicio entre hace 400 días y dentro de 365, ordena ascendente y limita a cien. No filtra `deleted_at` ni informa del total; una campaña iniciada antes del límite pero aún vigente no se selecciona.
- **Caso concreto:** un historial de cien acciones puede desplazar campañas futuras del contexto. Una acción archivada puede seguir influyendo si conserva un estado incluido. Las acciones de A05 pueden multiplicar rápidamente el número de filas de un calendario.
- **Mejora y aceptación:** separar historia comparable y futuro, filtrar archivadas/canceladas y usar solapamiento de intervalos. Priorizar campañas próximas con vínculo verificable al producto, conservar la zona horaria de tienda y declarar recortes. Cubrir más de cien acciones, campaña archivada y campaña que atraviesa el inicio de la ventana.

### A06-014 · Resolver mercados y comparables desde datos actuales

- **Evidencia:** `ai-runtime.ts:12201–12203` llama `commercialCalendar(now, 365, storeLabel)` y retiene solo Black Friday, Cyber Monday y temporada de nieve, sin pasar la configuración comercial de la tienda que ya usa A05. El prompt candidato v10 de `20261225120000_a06_v11_v12_modelo_real_y_contexto.sql:47–54` contiene posiciones fijas de Black Friday para una serie que empieza el 13 de octubre de 2025; el archivo declara las versiones candidatas inactivas.
- **Mejora y aceptación:** reutilizar mercados/vertical configurados, calcular semanas comparables a partir de fechas reales y separar siempre evento de referencia y campaña confirmada. Quitar fechas/índices de ejemplo fijos antes de activar el candidato. Probar ejecución en otro mes/año, otro mercado y tienda sin temporada de nieve. No se verificó qué versión está activa remotamente.

### A06-015 · Unificar la frescura de caché y envelope

- **Evidencia:** `getCachedDiagnostic` calcula `cacheDecision` para A06, pero solo pasa su frescura al envelope para A02/A04 (`ai-runtime.ts:6656–6672`). `buildAgentOutputEnvelope` usa `status: fresh` por defecto (`6903–6910`). El dashboard Shopify consume los datos de A06 sin mostrar su fecha ni `stale`.
- **Caso reproducido:** una lectura A06 generada el 1 de octubre, evaluada el 17, resulta obsoleta en `diagnosticCacheFreshness`, mientras el envelope declara `fresh` con vencimiento el 2 de octubre.
- **Mejora y aceptación:** usar la misma decisión de frescura en ambos formatos y mostrar la antigüedad relevante en el consumidor. Distinguir edad del análisis y edad del inventario; un análisis nuevo no vuelve reciente una fuente antigua. Cubrir caché vencida, digest desconocido y stock sincronizado después de la generación.

### A06-016 · Mostrar la decisión real de cada reposición

- **Evidencia:** `client-shopify.tsx:315–324` construye la lista a partir de todo `proposed_writes`, sin filtrar por decisión efectiva, y `732` imprime siempre «pendiente de aprobación». El GET conserva la salida más reciente aunque haya sido aprobada o rechazada.
- **Mejora y aceptación:** derivar las tarjetas del estado de salida y `proposal_decisions`: pendientes reales, aprobadas con enlace a tarea, descartadas o fallidas con su explicación. Mostrar error y resultado obsoleto cuando corresponda; la ausencia de propuestas no debe presentarse como prueba de ausencia de riesgos si la evidencia falló o se recortó. Probar aprobación, rechazo, edición individual, duplicado y fallo parcial.

### A06-017 · Reservar el cupo y hacer idempotentes los reintentos

- **Evidencia:** `assertManualRefreshQuota` (`ai-runtime.ts:5211–5330`) utiliza reserva atómica solo para A04/A05. A06 cuenta ejecuciones y después inserta el run. La ruta `server.ts:9777–9800` no pasa una clave de idempotencia; hay controles manuales de A06 en el dashboard.
- **Caso por inspección:** dos peticiones simultáneas pueden ver el mismo cupo disponible; un reintento tras perder la respuesta puede generar de nuevo. Los límites de frecuencia y el presupuesto existentes reducen gasto, pero no hacen atómico el cupo del agente ni identifican una misma petición.
- **Mejora y aceptación:** reutilizar la reserva existente y admitir clave ligada a organización, agente, tienda y periodo, recuperando la ejecución previa. Verificar concurrencia en el último cupo y reintento con respuesta perdida. Esta mejora conserva el flujo manual actual de A06; la retirada manual autorizada anteriormente correspondía a A02 y no se extiende aquí sin una decisión de producto.

### A06-018 · Mantener precisión y validar las fechas

- **Evidencia:** `stock-risk-evidence.ts:62–77` convierte cualquier timestamp futuro en edad cero y calcula cobertura usando una media diaria ya redondeada a dos decimales.
- **Casos reproducidos:** cinco unidades vendidas en noventa días y una disponible producen 16,7 días de cobertura; sin redondeo intermedio son 18 días. Una sincronización fechada diez días en el futuro obtiene edad cero y permite calcular cobertura.
- **Mejora y aceptación:** usar precisión completa en cálculos y redondear solo al presentar; marcar timestamps futuros fuera de tolerancia como dato inconsistente. Definir tratamiento de inventario negativo como déficit observado, separado de días restantes, y no confundirlo con lectura desconocida. Cubrir demanda baja, límites de cobertura y fechas inválidas/futuras. Revisar los consumidores A02/A04/móvil del helper compartido.

### A06-019 · Evitar consultas que no contribuyen al análisis

- **Evidencia:** `runGenericDiagnosticAgent` (`ai-runtime.ts:5811–5874`) activa cobertura financiera/divisas para A06 por su categoría Shopify, aunque los bloques específicos son unidades, tareas y calendario. También carga el playbook completo antes de filtrar F9/F11 para A06. A04 ya pasa opciones para evitar cargarlos. El contexto semanal obtiene 52 semanas de todos los productos seleccionados, aunque el cálculo base usa hasta doce.
- **Mejora y aceptación:** pedir únicamente los bloques necesarios desde el loader; cargar divisas cuando exista un dato monetario que analizar y reservar la historia anual detallada a comparables pertinentes. Mantener doce semanas para la línea base y no perder historia que sí respalde una campaña. Medir número de consultas, bytes y latencia antes/después; la auditoría no midió ahorro en producción.

### A06-020 · Vincular tareas solo a hitos válidos y relacionados

- **Evidencia:** `ai-runtime.ts:22661–22687` verifica plan/fase/hito activo y alcance solo para A04. A06 acepta un `milestone_id` del modelo y además entra en `shouldFallbackToCurrentMilestone` (`apps/api/src/agent-task-delivery.ts:64–66`) cuando falta. El contexto de Camino resume la tienda seleccionada, pero eso no valida por sí solo el identificador devuelto ni la relación con el producto.
- **Mejora y aceptación:** validar para A06 pertenencia a organización/tienda, vigencia del plan/fase/hito y relación de la reposición con ese compromiso antes de enlazar o reabrirlo. Sin relación acreditada, conservar la tarea de stock independiente y explicar el enlace omitido. Cubrir hito de otra tienda, plan archivado, hito completado y ausencia de relación con el producto.

### A06-021 · Ampliar aprovisionamiento y evaluar la previsión

- **Evidencia:** `stock-risk-evidence.ts:95–96` fija `lead_time_days` y `reorder_quantity` a `null`; el objetivo de A06 prohíbe cantidades por falta de plazos y stock de seguridad. La ficha maestra todavía describe un motor pendiente, aunque ya existe una línea base determinista. La evaluación remota de A06 (`eval-a06-stock-planner.ts`) cubre principalmente ausencia de datos, stock roto y stock sano con varias comprobaciones textuales; no mide error temporal de forecast.
- **Mejora propuesta:** incorporar fuentes reales para plazo de proveedor, variabilidad, MOQ/múltiplos, pedidos en tránsito, reservas y stock de seguridad; calcular escenarios deterministas y dejar incertidumbre/abstención visibles. Registrar pronósticos fechados y compararlos con demanda posterior sin usar datos futuros; medir error, sesgo y falsos avisos por producto/temporada, separando periodos censurados por rotura.
- **Aceptación y compatibilidad:** tratarlo como evolución separada de las correcciones P1/P2, con modo descriptivo mientras falten parámetros. Mantener aprobación humana y ausencia de compras automáticas. Actualizar la ficha y el catálogo solo con capacidades realmente verificadas; no presentar la línea base actual como previsión estacional validada.

### Verificación y límites de esta auditoría de A06

- **25/25 pruebas locales existentes aprobadas:** `stock-risk-evidence.test.ts`, `stock-forecast.test.ts` y `plan-horizon-context.test.ts`, ejecutadas con `npx tsx --test --test-force-exit` en `apps/api`. Cubren helpers y consumidores relacionados; no equivalen a una generación completa de A06 ni a una prueba de concurrencia PostgreSQL.
- **Reproducciones adicionales en memoria, sin archivos persistentes:** respuesta distinta antes de autorizar según exista la conexión; alcance agregado único del cron; seis semanas observadas rellenadas hasta 52 con calidad `strong`; recorte de treinta productos a ocho identificadores visibles; envelope fresco frente a diagnóstico obsoleto; redondeo de cobertura y timestamp futuro. Se invocaron funciones actuales; los datos eran sintéticos.
- **Aprobación con transporte simulado:** UUID de producto no verificado llega al intento de insertar una tarea sin consultar productos; se devolvió un error deliberado antes de materializar. Toda petición se interceptó y solo se permitió el host ficticio `audit.invalid`. No se contactó con una base real.
- **Inspección pendiente de prueba de integración:** clasificación SQL de inventario parcial, selección de más de treinta productos, carreras entre dos salidas, deduplicación con límites de filas y vinculación a hitos. No se ejecutó SQL contra test/producción ni un modelo/proveedor de embeddings; no se midieron coste, latencia o precisión con datos conectados.
- **Único cambio persistente de esta pasada:** esta sección del MD. No se implementaron las mejoras, no se crearon migraciones y no se modificaron datos ni despliegues. Si al implementarlas se necesita una migración, se aplicará primero en test y después en producción con verificación, conforme a la instrucción permanente del propietario.

## Implementación de mejoras de A06 — 18 de octubre de 2026

Se aplicaron cambios locales en el runner, la autorización, el cron, la aprobación de tareas, el cálculo de cobertura y la tarjeta Shopify. Las migraciones `20261228100000_a06_risk_sample_and_atomic_restock.sql` y `20261228110000_a06_oldest_inventory_freshness.sql` se aplicaron y verificaron en test (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`). La tabla de claims tiene RLS activo; las RPC de claim solo las puede ejecutar `service_role`.

### Implementado

- A06 verifica la membresía antes de resolver una conexión; el cron genera una salida por tienda activa y el GET expone el estado de frescura en el envelope.
- Una RPC exclusiva de A06 selecciona hasta 100 productos activos por cobertura estimada, devuelve SKU, variantes cubiertas y total elegible, sin alterar la RPC compartida por A02 y móvil. El contexto prioriza doce productos completos y resume tareas abiertas por producto con recuento exacto.
- El histórico semanal no rellena semanas ausentes con cero. Solo calcula la previsión cuando las doce semanas recientes están observadas; los fallos e históricos incompletos se señalan y la interfaz no presenta propuestas anteriores como pendientes actuales.
- Antes de materializar una reposición se comprueba que el producto siga activo, pertenezca a la tienda correcta, conserve inventario fiable y mantenga una necesidad medible. Se recupera primero la tarea de la misma salida y cada propuesta registra si se creó, se omitió o falló. Una reserva por organización/tienda/producto evita aprobaciones concurrentes duplicadas durante diez minutos.
- El calendario usa mercados y vertical de la tienda, excluye campañas archivadas, considera solapamientos y prioriza fechas recientes/futuras. A06 obtiene cupo manual atómico, acepta `Idempotency-Key`, evita redondear la media antes de calcular cobertura y rechaza timestamps de sincronización futuros fuera de tolerancia.
- Se validan los hitos explícitos antes de enlazar y se desactiva el fallback automático a un hito para A06. La tarjeta Shopify muestra frescura, estado real de cada propuesta y límites de cobertura.

### Límites que siguen abiertos

- **A06-003/A06-004, parcial:** se exige cobertura de cada variante activa y se incluye SKU, pero no existe aún evidencia suficiente por ubicación ni se expone la edad más antigua de todas las lecturas. La edad reportada usa la lectura más antigua incluida para fallar de forma conservadora; todavía no se exponen por separado las fechas más antigua y más reciente ni el universo esperado de ubicaciones. La señal sigue siendo agregada por producto y no identifica una talla/variante concreta en riesgo.
- **A06-006, parcial deliberadamente conservadora:** no hay una marca fiable de cobertura histórica por tienda/producto. Por eso una semana sin fila no se interpreta como cero, y la previsión se omite salvo que las doce semanas tengan datos observados. Para distinguir ceros reales se necesita cobertura de ingesta persistida.
- **A06-010, protección de concurrencia con reserva temporal:** la reserva se confirma antes de la inserción de tarea y caduca en diez minutos; no es una transacción única que abarque ambos pasos. Si el servidor se interrumpe en ese intervalo, se puede reintentar tras caducar.
- **A06-013, parcial:** se filtran archivadas y se prioriza el tramo reciente/futuro, pero todavía no hay recuento del calendario ni dos muestras independientes para historia comparable y campañas próximas.
- **A06-021:** se mantiene el modo descriptivo. No hay datos configurados de proveedor, plazo, MOQ, pedidos en tránsito o stock de seguridad, ni una serie persistida para medir error del forecast; por ello no se generan cantidades de compra ni se presenta la previsión como estacional validada.

### Verificación de la implementación

- `npm run typecheck --workspace=@e-nora/api` y `npm run typecheck --workspace=web`: correctos.
- Test y producción: existen las tres RPC de A06, RLS está activo en la tabla de reservas, `authenticated` no puede reclamar y `service_role` sí.
- No se ejecutaron pruebas automatizadas ni una aprobación concurrente con datos reales.

## A08 · Gestor de conocimiento

**Auditoría:** 18 de octubre de 2026. **Implementación local:** aplicada; migración aplicada y comprobada en test y producción.

**Cambios locales aplicados:** autorización interna de A08 para consultores/platform admins; catálogo, cobertura y parejas limitados a `client_visible`; salida de solo lectura y bloqueo de aprobaciones antiguas como tareas; ejecución programada para organizaciones con conocimiento aunque no tengan Shopify; muestra y candidatos reducidos, evidencia por ID exacto y procedencia; digest específico para invalidar caché; límites de muestra de telemetría visibles; reserva manual atómica con `Idempotency-Key`; reindexación transaccional con control optimista de versión; prioridad de señales ajustada por rechazos y actualidad; ficha maestra alineada.

**Pendiente de completar:** medición `EXPLAIN (ANALYZE, BUFFERS)` con corpus representativo antes de optimizar más SQL; rotación persistente de muestras por encima del límite de 1.000 documentos; cierre editorial de señales tras verificar recuperación; cálculo servidor de `dataCompleteness` y validación de referencias contra evidencia; suite específica de regresión. No se afirma validación con corpus ni ejecución real del modelo. La migración A08 se aplicó en TEST ES IA y E-NORA; las seis RPC nuevas y sus permisos se comprobaron en ambos.

Alcance: generación y lectura de A08, catálogo e indexación, candidatos semánticos, señales de búsquedas y rechazos, programación, caché, contexto enviado al modelo, aprobación de propuestas y pantalla de conocimiento. Se contrastaron el grafo y los archivos actuales: los snippets de `ai-runtime.ts` tenían posiciones antiguas. Las migraciones se revisaron como código; esta auditoría no verifica el esquema ni la versión desplegada en test/producción.

### Mejoras priorizadas

Se registran **18 mejoras: 5 P1, 12 P2 y 1 P3**. P1 corresponde a exposición de información interna, disponibilidad automática, pérdida de contexto o consistencia de indexación. Los escenarios reproducidos usan datos locales y transporte simulado; no son incidentes confirmados en producción. Las optimizaciones SQL requieren medición antes de atribuirles una ganancia.

| ID | Prioridad | Mejora | Riesgo estimado al implementar |
|---|---|---|---|
| A08-001 | P1 | Aplicar audiencia y destinatario también al catálogo, candidatos y caché | Medio; autorización y compatibilidad de salidas existentes |
| A08-002 | P1 | Incorporar una generación automática real, independiente de Shopify | Medio; programación, presupuesto y selección de organizaciones |
| A08-003 | P1 | Ajustar la muestra al contexto efectivamente enviado al modelo | Medio; construcción y serialización del contexto |
| A08-004 | P2 | Unificar la frescura de caché y envelope | Bajo; reutilizar el cálculo existente |
| A08-005 | P2 | Invalidar la lectura por cambios en conocimiento e indexación | Medio; huella específica y programación |
| A08-006 | P1 | Separar las propuestas editoriales internas de las tareas del cliente | Medio; contrato, aprobación y destino de propuestas |
| A08-007 | P2 | Conservar tienda, versión y procedencia de los documentos | Bajo/medio; metadatos y RPC propias de A08 |
| A08-008 | P2 | Recorrer el catálogo progresivamente y rotar la muestra semántica | Medio; cursores, estado y reparto por segmentos |
| A08-009 | P2 | Medir y acotar el trabajo real de las consultas de cobertura y similitud | Medio; SQL e índices según el plan observado |
| A08-010 | P2 | Contrastar cada pareja con fragmentos de sus documentos exactos | Medio; recuperación autorizada por ID |
| A08-011 | P1 | Publicar contenido y chunks de una misma versión de forma atómica | Medio/alto; ingesta compartida y migración transaccional |
| A08-012 | P2 | Distinguir cobertura de telemetría, muestras y señales observables | Medio; agregación y selección de evidencia |
| A08-013 | P2 | Priorizar por impacto, actualidad y demanda independiente | Bajo/medio; clasificación y ciclo de revisión |
| A08-014 | P2 | Cargar solo el contexto útil para gobernar conocimiento | Bajo/medio; opciones del runner compartido |
| A08-015 | P2 | Validar un contrato de auditoría y calidad basado en evidencia del servidor | Medio; salida, envelope y UI |
| A08-016 | P2 | Reservar el cupo manual atómicamente y deduplicar reintentos | Medio; reutilizar reservas existentes |
| A08-017 | P2 | Ampliar la regresión específica de A08 e incluir sus señales en la suite habitual | Bajo/medio; pruebas y fixtures de dominio |
| A08-018 | P3 | Alinear la ficha maestra y los estados con el comportamiento real | Bajo; documentación |

### A08-001 · Proteger también los metadatos internos y las salidas cacheadas

- **Evidencia:** `apps/api/src/ai-runtime.ts:12357–12574` consulta el catálogo con cliente de servicio y filtra organización/estado, pero no audiencia. Incluye títulos y descripciones `consultant_only`; las RPC de cobertura y candidatos tampoco reciben una audiencia permitida. `getKnowledgeManagerDiagnostic:12578–12590` delega en una caché que exige membresía operativa, sin autorización específica para A08 (`6542–6557`). La pantalla monta el diagnóstico para la organización activa (`apps/web/src/app/conocimiento/page.tsx:544–552`).
- **Caso reproducido:** con un propietario cliente autorizado y una respuesta simulada de `agent_runs`, el GET devolvió una salida A08 con un marcador interno, incluso en `pending_approval`. Esto demuestra que no existe una barrera de destinatario en esa ruta; la posible exposición de títulos/descripciones internos por el modelo se deduce del contexto cargado, no de una ejecución real. La protección de `search_knowledge` sí descarta notas privadas internas para agentes automáticos, pero no protege estas consultas directas.
- **Mejora y aceptación:** definir un destinatario explícito para cada salida. Filtrar catálogo, contadores, candidatos y señales con la misma política; si se ofrece una auditoría interna, autorizarla y separarla de la salida del cliente, incluida la caché histórica. Conservar la excepción existente que permite consultar metodología global a los agentes; proteger específicamente las notas privadas de organización. No basta con una instrucción al modelo. Cubrir cliente, consultor, administrador, organización ajena y lectura de una salida antigua con material interno.

### A08-002 · Hacer efectiva la generación automática que anuncia la pantalla

- **Evidencia:** A08 no está en `ORCHESTRATED_DIAGNOSTIC_AGENT_CODES` (`ai-runtime.ts:15438–15469`) ni tiene rama de ejecución en el despachador. Sus llamadores encontrados son la ruta POST y el eval. GET no genera (`6638–6639`) y la pantalla anuncia que el primer análisis llegará en el próximo ciclo automático (`ai-diagnostic-section.tsx:871–874`). Además, la selección general del cron exige Shopify sincronizado (`ai-runtime.ts:15939–15950`), aunque A08 puede trabajar con un catálogo sin conectores.
- **Efecto:** una organización sin salida previa puede permanecer pendiente hasta una ejecución manual; añadir únicamente el código a la lista tampoco cubriría organizaciones con conocimiento y sin Shopify. El fallback actual del despachador ejecuta A06 (`16449–16456`), por lo que A08 necesita una rama propia.
- **Mejora y aceptación:** programar A08 con cadencia y elegibilidad específicas, organización operativa, agente habilitado, presupuesto, exclusión de ejecuciones simultáneas y recuperación de errores. Debe ejecutar con `trigger: cron` y sin cupo manual. Cubrir organización sin Shopify, catálogo vacío, primera lectura y catálogo modificado. Conservar el flujo manual actual de A08; la retirada manual autorizada previamente correspondía a A02.

### A08-003 · Declarar lo que el modelo recibe después de serializar

- **Evidencia:** `knowledge-catalog.ts:1–3, 27–83` selecciona hasta 80 documentos y declara `included_documents` antes del envío. A08 coloca contadores, hasta 30 parejas semánticas, telemetría y documentos dentro de un único bloque (`ai-runtime.ts:12514–12570`). El serializador corta cada bloque a 12.000 caracteres y el conjunto a 48.000 (`packages/ai/src/untrusted-context.ts:2–3, 37–69`).
- **Casos reproducidos:** una muestra sintética válida de 80 documentos, con títulos de 180 y descripciones de 240 caracteres, produjo un bloque de 55.459 caracteres; se enviaron 12.000 y solo quedaron 18 IDs de documento, aunque `included_documents` seguía indicando 80. En otro escenario con 30 parejas semánticas, el corte eliminó por completo `knowledge_gap_signal_status` y la lista de documentos. El comentario de que los contadores preceden a la muestra no garantiza que la telemetría sobreviva a los candidatos.
- **Mejora y aceptación:** presupuestar por caracteres/tokens reales, repartir bloques compactos por función y seleccionar documentos/parejas completos. Registrar por separado lo cargado, lo seleccionado y lo finalmente enviado; conservar siempre cobertura, errores y telemetría esencial. Cubrir 80 metadatos largos y 30 candidatos sin JSON cortado ni recuentos de inspección superiores a lo visible.

### A08-004 · Dar una única respuesta sobre la frescura

- **Evidencia:** la caché calcula `stale`, pero solo pasa ese resultado al envelope de A02/A04/A06 (`ai-runtime.ts:6630–6681`). A08 usa el valor por defecto de `buildAgentOutputEnvelope:6911–6917`, que fija `fresh` y vigencia de 24 horas.
- **Caso reproducido:** una lectura A08 del 1 de octubre consultada el 18 de octubre devolvió simultáneamente `stale: true` y `envelope.freshness.status: fresh`. La UI puede mostrar ambos estados según el consumidor.
- **Mejora y aceptación:** pasar a A08 la frescura ya calculada y su misma vigencia. Separar antigüedad del análisis de fecha/calidad de sus fuentes. Verificar lectura vigente, vencida, fallo al consultar la huella y ausencia de lectura previa.

### A08-005 · Detectar cambios del corpus y del índice

- **Evidencia:** la caché consulta `organization_activity_digest` (`ai-runtime.ts:6606–6615`), cuya definición local más reciente combina sincronizaciones, tareas, alertas y actividad (`supabase/migrations/20261113100000_ai_feed_actividad_compartida.sql:354–384`). No incorpora directamente revisiones del catálogo global, documentos o chunks. A08 tampoco persiste una huella específica del conocimiento; la escritura de `activity_digest` en el runner está acotada a A04 (`ai-runtime.ts:5788–5790`).
- **Efecto:** corregir una guía global, archivar un documento o completar una indexación no aporta una señal propia que marque el diagnóstico A08 como superado; se depende de edad y actualización manual. A la vez, actividad comercial ajena al catálogo sería una señal poco útil para decidir repetir esta auditoría.
- **Mejora y aceptación:** guardar y comparar una huella del corpus permitido, sus versiones/estados de índice y el avance de la telemetría editorial. Incorporar cambios globales y privados sin consultar texto completo. Un cambio debe marcar la lectura anterior como superada; sin cambios debe evitar llamadas equivalentes al modelo. Probar altas, ediciones, archivados y reindexación.

### A08-006 · Evitar que el trabajo editorial interno llegue al backlog del cliente

- **Evidencia:** el prompt vigente en las migraciones exige que las tareas editoriales sean del responsable interno E-NORA (`20261115280002_ai_a08_knowledge_gap_prioritization.sql:8–30`). Sin embargo, A08 utiliza el contrato genérico y la UI etiqueta sus propuestas como «tarea de redacción» (`conocimiento/page.tsx:551`). La aprobación materializa cualquier `kind: task` en `tasks` de la organización, asigna desde sus candidatos y permite el fallback a un hito del Camino (`ai-runtime.ts:22520–22524, 22902–22988`; `agent-task-delivery.ts:64–66`), sin tratamiento editorial de A08.
- **Efecto por inspección:** una propuesta editorial generada puede terminar como tarea del cliente y enlazada/reabriendo un hito comercial, pese a que el prompt ordene otro destino. No se creó ninguna tarea para reproducirlo.
- **Mejora y aceptación:** dar a los hallazgos editoriales un destino interno y un estado de revisión explícito. Validar responsable, audiencia y documento objetivo antes de materializar; evitar asignación automática al cliente y enlaces al Camino sin relación acreditada. Mantener las tareas comerciales actuales de los demás agentes. Cubrir propuesta global, privada, interna, rechazada y reintento de aprobación.

### A08-007 · Conservar la identidad y el ámbito de lo auditado

- **Evidencia:** el catálogo de A08 omite `store_id`, `version` y `checksum` (`ai-runtime.ts:12405–12413`; `knowledge-catalog.ts:5–14`). La RPC semántica conserva visibilidad/audiencia, pero no devuelve ni compara tienda o versión (`20261115280001_ai_a08_semantic_duplicate_candidates.sql:13–103`). La ingesta sí admite documentos de tienda (`knowledge.ts:295–321`).
- **Efecto:** dos políticas parecidas de tiendas diferentes de una misma organización pueden aparecer como candidatas sin que el modelo o el revisor sepan ese ámbito. Un enlace por ID tampoco prueba que el documento siga en la versión inspeccionada.
- **Mejora y aceptación:** propagar tienda/organización, versión, checksum, origen y fecha a muestras, candidatos y hallazgos, con la audiencia autorizada. Distinguir redundancia dentro del mismo ámbito de coincidencia entre políticas de tiendas distintas; revalidar la versión al revisar. No convertir la auditoría agregada de organización en una mezcla de ámbitos sin etiqueta.

### A08-008 · Dar progreso y representación al muestreo

- **Evidencia:** `loadKnowledgeCatalogPages` empieza en cursor nulo en cada ejecución y se detiene en 1.000 documentos (`knowledge-catalog.ts:86–156`); A08 no guarda un cursor de continuación. Su muestra se estratifica después de ese recorte. La RPC semántica elige los 12 documentos más recientes y los tres primeros chunks de cada uno (`ai-runtime.ts:12425–12428`; migración semántica:37–58).
- **Efecto:** con más de 1.000 documentos se relee siempre el mismo prefijo ordenado por UUID. Documentos antiguos pueden quedar permanentemente fuera de la comprobación semántica si hay cambios frecuentes; cambios o contradicciones al final de documentos largos tampoco están representados por sus tres primeros chunks. Los límites ya se declaran: la mejora pendiente es ampliar cobertura útil con progreso real.
- **Mejora y aceptación:** mantener cursores y fecha de última revisión por alcance; combinar novedades con una rotación estable del fondo histórico, respetando audiencia y tienda. Separar cobertura del inventario de cobertura semántica. Verificar avance entre ejecuciones, altas/archivados durante el recorrido y representación de documentos largos sin aumentar indiscriminadamente el coste de un turno.

### A08-009 · Acotar coste de consulta, además del tamaño de respuesta

- **Evidencia:** la RPC de cobertura agrega chunks de todos los documentos activos del alcance (`20261115270000_ai_a08_knowledge_coverage.sql:24–52`). La RPC semántica puede lanzar hasta 36 búsquedas laterales en el uso actual, con join al catálogo materializado y orden por distancia e ID (`20261115280001_ai_a08_semantic_duplicate_candidates.sql:30–103`). Hay un índice HNSW en la migración inicial; la existencia de un índice y un `limit` final no prueban qué trabajo ejecuta este plan concreto.
- **Mejora y aceptación:** medir `EXPLAIN (ANALYZE, BUFFERS)` con corpus representativo y varias organizaciones antes de modificar SQL. Según el resultado, favorecer el acceso vectorial indexado, limitar candidatos examinados y reutilizar agregados que no cambiaron, conservando aislamiento y estados de cobertura. Medir p95, filas/buffers y paralelismo. No se afirma un cuello de botella ni un ahorro ya medido.

### A08-010 · Poder verificar las parejas concretas que se recomiendan revisar

- **Evidencia:** la RPC devuelve metadatos y score, sin fragmentos (`20261115280001_ai_a08_semantic_duplicate_candidates.sql:13–27`). La única herramienta de A08 es `search_knowledge`; su entrada contiene solo `query` y devuelve un máximo de ocho resultados (`ai-runtime.ts:4306–4338`). No permite fijar los dos IDs de la pareja. Las notas privadas `consultant_only` se filtran para ejecuciones automáticas aunque sus metadatos entren hoy en el catálogo.
- **Efecto:** una búsqueda por tema puede recuperar otros documentos y no alcanzar ambos candidatos. Se puede comunicar un candidato honestamente, pero no garantizar una comparación de contenido/versión solo con esa búsqueda.
- **Mejora y aceptación:** incorporar una lectura acotada por IDs verificados en el servidor y audiencia permitida, con fragmentos y versión/chunk identificables. No ampliar por defecto el acceso de agentes automáticos a notas internas. Mantener `candidate_only` cuando falte cualquiera de los dos textos, haya cambio de versión o no exista evidencia suficiente para consolidar.

### A08-011 · No certificar una indexación de otra revisión del contenido

- **Evidencia:** la cobertura considera indexado un documento con al menos un chunk y sin embeddings nulos; no comprueba correspondencia con checksum/versión (`20261115270000_ai_a08_knowledge_coverage.sql:28–47`). `updateKnowledgeDocument` actualiza primero contenido/versión, luego elimina los chunks anteriores y después inserta los nuevos, mediante peticiones independientes (`knowledge.ts:472–529`). Crear documento y chunks también son operaciones separadas (`317–353`).
- **Caso por inspección:** entre actualizar el documento y sustituir sus chunks, A08 puede contar un documento como indexado mientras el retrieval conserva texto anterior. Si falla la eliminación, la función retorna con documento nuevo y chunks antiguos; el control de cobertura actual no detecta esa divergencia. Dos ediciones concurrentes también necesitan protección de versión. No se provocó una avería en datos reales.
- **Mejora y aceptación:** generar embeddings antes de publicar y confirmar documento/chunks de una revisión en una transacción, con control optimista de versión. Conservar la revisión anterior válida si falla la nueva; verificar modelo/checksum o estado de índice en cobertura. Aplicar una migración versionada y probar fallos intermedios, dos ediciones y lectura concurrente; es un cambio compartido que requiere comprobar ingesta humana y consumidores RAG.

### A08-012 · Mostrar qué telemetría se pudo observar realmente

- **Evidencia:** A08 carga las últimas 500 llamadas exitosas de búsqueda y los últimos 500 rechazos en muestras independientes (`ai-runtime.ts:12430–12453`). El filtro de búsquedas vacías, exclusión de A08 y clasificación temática ocurren después en memoria (`knowledge-gap-signals.ts:101–139`). El estado se deriva de error y longitud de la muestra (`ai-runtime.ts:12545–12559`), sin totales de llamadas con `match_count`, desconocidas, clasificadas, errores o vínculos excluidos por el límite.
- **Efecto:** 500 búsquedas recientes con resultados pueden desplazar búsquedas vacías recurrentes dentro de los mismos 30 días. Un rechazo de la muestra puede perder su búsqueda correspondiente por el otro límite. Una consulta de telemetría que responde correctamente, incluso sin filas útiles, no demuestra cobertura suficiente para descartar demanda no resuelta. La nota sobre telemetría antigua es útil, pero no cuantifica estas exclusiones.
- **Mejora y aceptación:** agregar por run/ámbito antes de limitar; informar universo, filas útiles, desconocidas, errores, ventana efectiva y truncamiento por fuente. Recuperar rechazos por los runs seleccionados cuando corresponda, manteniendo consultas y motivos originales fuera del contexto del modelo. Cubrir más de 500 llamadas, todas sin count, errores de proveedor y rechazos fuera de la otra muestra.

### A08-013 · Priorizar el impacto y revisar si la señal sigue abierta

- **Evidencia:** `summarizeKnowledgeGapSignals` agrupa palabras de una taxonomía amplia por tienda/audiencia y cuenta runs distintos; descarta búsquedas con resultados antes de agrupar (`knowledge-gap-signals.ts:66–139`). Ordena solo por número de runs vacíos y tema, antes de quedarse con doce (`208–211`), aunque ya conoce rechazos explícitos vinculados. No incorpora identidad de conversación ni un estado editorial que cierre una señal.
- **Caso reproducido:** dos búsquedas vacías de email seguidas de una búsqueda con ocho resultados mantienen la misma señal y fecha propuesta de revisión. La búsqueda posterior no demuestra por sí sola que se resolviera la necesidad, pero el resumen tampoco permite verificarlo. Varios turnos de una sola conversación pueden sumar runs distintos; frecuencia no equivale a demanda independiente ni a impacto.
- **Mejora y aceptación:** conservar número de conversaciones/orígenes independientes, fecha real de cada episodio y rechazos acreditados; priorizar impacto y actualidad con criterios visibles. Comprobar recuperación posterior o revisión humana antes de cerrar, reducir o repetir la prioridad, sin asumir que cualquier resultado resuelve todo el tema. Cubrir un rechazo explícito frente a muchas búsquedas sin rechazo, varias preguntas de un hilo y una revisión ya resuelta.

### A08-014 · Reducir contexto ajeno a la función editorial

- **Evidencia:** el runner añade a A08 restricciones, historial de propuestas, actividad compartida y todos los bloques del playbook (`ai-runtime.ts:5803–5881`). Solo A04 recibe opciones que omiten aprendizaje y diagnóstico ejecutivo; A04/A06 tienen además un filtro F9/F11. A08 no dispone de selección propia, pese a tener un presupuesto total de contexto limitado.
- **Mejora y aceptación:** pasar un perfil específico de A08 que conserve restricciones de audiencia, procedencia y señales útiles, y omita snapshots comerciales o de aprendizaje que no contribuyan a la auditoría. Reutilizar resultados globales invariantes sin compartir datos privados entre organizaciones. Comparar consultas, caracteres/tokens y latencia del contexto con los mismos hallazgos esperados, sin modificar el contexto de otros agentes.

### A08-015 · Hacer verificable el resultado de la auditoría

- **Evidencia:** A08 usa la salida genérica, sin contrato específico de cobertura/candidatos/prioridades (`ai-runtime.ts:5492–5514, 5922–5926`). La incompletitud de datos se traduce en el envelope según las advertencias redactadas por el modelo (`6902–6939`). Las fuentes se construyen desde referencias de texto sin comprobar que identifiquen un documento/versión realmente inspeccionado (`6844–6857`).
- **Efecto:** los controles del contexto dependen de que el modelo los refleje correctamente; una respuesta sin warnings puede aparecer con `dataCompleteness: complete` aunque falle la RPC o se haya truncado la evidencia. Un texto que menciona una fuente no acredita por sí solo haber comparado los dos documentos.
- **Mejora y aceptación:** definir una salida A08 con cobertura, alcance inspeccionado, estado de índice, parejas candidatas, prioridades y referencias verificadas. Derivar en el servidor avisos y completitud de los resultados reales; rechazar afirmaciones/propuestas incompatibles con la evidencia. Migrar de forma aditiva o adaptar salidas históricas para conservar la lectura de la UI. Cubrir RPC fallida, catálogo parcial y fuente inexistente.

### A08-016 · Evitar doble gasto manual por concurrencia o reintento

- **Evidencia:** A08 utiliza las opciones manuales por defecto (`ai-runtime.ts:5169–5175, 12362–12374`). La reserva atómica se aplica únicamente a A04/A05/A06; A08 sigue con recuento de runs seguido de inserción (`5258–5339`). La ruta POST A08 no recibe `Idempotency-Key` (`server.ts:9832–9852`). El rate limit y la reserva económica por organización no equivalen a deduplicación de una misma petición.
- **Mejora y aceptación:** si se conserva su actualización manual actual, reutilizar la reserva atómica por organización/agente y una clave de petición, recuperando o señalando la ejecución previa. Cubrir dos solicitudes en el último cupo, doble clic y respuesta perdida. Mantener los presupuestos y no modificar automáticamente la política de actualización manual de los demás agentes.

### A08-017 · Probar las garantías específicas de A08 de forma habitual

- **Evidencia:** los tests de catálogo, señales y retrieval cubren helpers, pero no una generación/lectura A08 completa por audiencia. El eval remoto específico mantiene dos escenarios principales y varias comprobaciones de palabras en texto libre (`eval-a08-knowledge-manager.ts:162–238`). El dataset común asigna a A08 un fixture genérico de ventas Shopify en vez de hechos de catálogo/índice (`packages/ai/src/agent-eval-dataset.ts:27–60`). `test:unit` incluye catálogo y búsqueda, pero no `knowledge-gap-signals.test.ts`.
- **Mejora y aceptación:** incluir la suite de señales en el comando habitual y añadir regresiones para audiencia/caché, entrada por cron, tamaño final del prompt, fuentes exactas, ámbito de tienda, catálogo grande, reindexación y concurrencia. Usar fixtures de documentos/chunks/telemetría y comprobar IDs/estados, además del texto. Evaluar precisión de candidatos y cobertura con corpus etiquetado; no atribuir esas métricas a las pruebas de helpers ni ejecutar un eval con proveedor en cada prueba local.

### A08-018 · Actualizar la descripción del agente y su cierre

- **Evidencia:** la ficha maestra sigue indicando «Definido; pendiente de pipeline RAG» y presenta A08 como agente de ingesta con herramientas de clasificación/chunking/publicación (`Agentes IA/EcomScaling_IA_Documento_Maestro_Agentes_v0_2.md:937–1020`). El runtime actual es una auditoría de catálogo con `search_knowledge`; la ingesta ocurre en `knowledge.ts`. `docs/REVISION_AGENTES.md:275–287` declara cerrado el alcance local de la revisión anterior.
- **Mejora y aceptación:** documentar destinatario, disparadores efectivos, lectura automática/manual, contrato real, límites de muestra y separación de la ingesta. Enlazar esta nueva pasada y distinguir cierre anterior de mejoras pendientes actuales; conservar el historial y no afirmar despliegue o comprobaciones remotas que esta auditoría no realizó.

### Verificación y límites de esta auditoría de A08

- **20/20 pruebas locales aprobadas:** `knowledge-catalog.test.ts`, `knowledge-gap-signals.test.ts`, `knowledge-search-rpc.test.ts` y `knowledge-methodology-access.test.ts`, con `npx tsx --test --test-force-exit` desde `apps/api`.
- **Reproducciones locales adicionales, sin persistencia:** truncamiento de 80 metadatos a 12.000 caracteres; pérdida de telemetría detrás de 30 parejas; señal que no considera una búsqueda posterior con resultados; lectura A08 por un propietario cliente y discrepancia `stale`/`freshness` con transporte simulado. Los resultados se describen en A08-001/003/004/013.
- **Sin mediciones ni cambios remotos:** no se ejecutó A08 contra un modelo, no se consultaron datos de clientes ni se midió precisión/carga en producción. No se crearon tareas, migraciones o cambios de código de aplicación; esta pasada añade únicamente el registro de mejoras. Las referencias SQL describen el repositorio, no certifican la base desplegada.

## A09 · Copiloto del consultor

**Auditoría:** 18 de octubre de 2026. **Estado:** mejoras registradas, pendientes de implementación. Esta pasada modifica únicamente este documento.

Revisión orientada a convertir A09 en una puerta de trabajo completa para el software: consultar, investigar, preparar, ejecutar las operaciones permitidas y comprobar su resultado. Incluye runtime, herramientas, permisos, contexto, especialistas, propuestas, informes, recuperación, web y móvil. Se conservan las garantías existentes de pertenencia, autoría de conversaciones y selección validada de tienda.

**Conclusión:** A09 dispone de una base útil de análisis y propuestas, pero su capacidad operativa está por debajo de lo que ya permite la aplicación. La expansión debe conectar los servicios de negocio existentes y devolver resultados verificables por entidad. Hay además correcciones de visibilidad, alcance y recuperación que deben preceder a esa expansión. Dar de alta nombres en `allowed_tools` no implementa una operación ni autoriza a cada usuario a ejecutarla.

### Configuración y capacidad comprobadas

- **Lectura remota de configuración, sin cambios:** test (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`) tienen A09 v15, prompt v9, definición activa y `approval_mode: required_before_publish`. Ambas versiones declaran las mismas **24 herramientas**. Esto verifica configuración de base de datos; no acredita qué revisión de API/web está desplegada.
- **Construcción local de herramientas:** con todos los conectores y la dependencia de búsqueda disponibles, el constructor ofrece esas 24 en ámbito de organización y 23 con tienda seleccionada: `sql_select` se retira deliberadamente en ámbito de tienda. No se propone reactivarlo sin aislamiento equivalente.
- **Inventario compartido:** el registro marca **45 herramientas** como `implemented_partial`. Hay 21 nombres de ese conjunto fuera de la lista activa de A09. Ese estado no equivale a integración completa, adecuación para todos los roles ni disponibilidad sin conector/credencial.
- **Escrituras actuales de A09:** guarda conversaciones y ejecuciones, genera artefactos PDF y prepara propuestas. El contrato de propuestas admite `task` y `note`; el materializador genérico recorre las tareas. No ofrece al modelo un conjunto operativo de comandos para actualizar tareas, fases, campañas o conectores. Las herramientas de escritura declaradas en el registro siguen con estado `planned`.

| Área | A09 hoy | Capacidad localizada en el software | Mejora que falta |
|---|---|---|---|
| Negocio y métricas | Cobertura, SQL de organización y herramientas Shopify/Meta/Klaviyo | Lecturas más detalladas de producto, recompra, entregas, creatividades y email | Activación contextual, periodos elegibles, comparación y evidencias |
| Tareas | Lista, historial de filas y propuestas de alta | Crear, asignar y cambiar estado mediante servicios existentes | Detalle por ID y comandos completos con recibo |
| Mi Camino | Lectura del plan y del hito; tareas propuestas | Crear planes, modificar hitos y enlazar trabajo | Propuestas de cambios nativos, revisión y aplicación por versión |
| Campañas | Consulta de métricas y apertura de insights | Calendario, elementos de campaña y creación desde propuestas | Leer/editar el calendario y materializar campañas desde el chat |
| Marketing | Consulta parcial de contenidos y métricas | Studio, especialistas creativos y adaptadores de Klaviyo | Encargar borradores, revisar, iterar y publicar según permisos |
| Informes | Preview y generación PDF de siete plantillas | Programación, enlaces y envío de informes | Flujo completo, deduplicación y estado de entrega |
| Consultoría | Conversación sobre una organización | Workbench, vistas de cartera, llamadas y notas | Priorización autorizada de clientes y preparación de reuniones |
| Seguimiento | Respuesta y propuesta pendiente | Tareas, decisiones, ejecuciones y memoria indexada | Retomar operaciones, verificar efectos y medir resultados |

### Orden propuesto para A09

P1: corregir garantías de lectura, persistencia y autorización de efectos. P2: ampliar capacidad útil y robustez. P3: mantener documentación y catálogo. Las ampliaciones se distinguen de los defectos reproducidos; no se presentan como funciones ya operativas.

| ID | Prioridad | Mejora | Naturaleza |
|---|---|---|---|
| A09-001 | P1 | Filtrar datos internos según el usuario antes de enviarlos al modelo | Corrección de visibilidad |
| A09-002 | P1 | Propagar la tienda a todas las consultas y al contexto | Corrección de alcance |
| A09-003 | P1 | Recuperar cada turno por identidad y estado persistente | Corrección de reintentos |
| A09-004 | P1 | Confirmar respuesta, propuestas y cierre de forma coherente | Corrección de persistencia |
| A09-005 | P1 | No aprobar tipos de propuesta que no se materializan | Corrección de contrato |
| A09-006 | P1 | Autorizar cada operación con rol, alcance y aprobación verificable | Base para ampliar acciones |
| A09-007 | P2 | Exponer las lecturas existentes que A09 aún no aprovecha | Ampliación sobre herramientas existentes |
| A09-008 | P2 | Consultar periodos concretos y corregir el contrato de gasto Meta | Corrección y análisis temporal |
| A09-009 | P2 | Declarar cobertura, frescura y límites efectivos por resultado | Calidad de datos |
| A09-010 | P2 | Leer entidades concretas, historial útil y el plan realmente activo | Ampliación de lectura |
| A09-011 | P2 | Seleccionar y presupuestar contexto sin perder información esencial | Rendimiento y calidad |
| A09-012 | P2 | Vincular afirmaciones y cifras a evidencias comprobadas | Fiabilidad |
| A09-013 | P2 | Conservar decisiones y continuidad en conversaciones largas | Memoria y recuperación |
| A09-014 | P2 | Aprovechar especialistas por necesidad y vigencia | Coordinación |
| A09-015 | P2 | Gestionar el ciclo completo de las tareas desde el chat | Integración de servicios existentes |
| A09-016 | P2 | Preparar y aplicar cambios nativos de Mi Camino | Integración de servicios existentes |
| A09-017 | P2 | Trabajar sobre campañas y calendario comercial | Integración de servicios existentes |
| A09-018 | P2 | Encargar y revisar contenido mediante los especialistas | Ampliación de orquestación |
| A09-019 | P2 | Integrar acciones externas con adaptadores y resultados verificables | Integración y desarrollo adicional |
| A09-020 | P2 | Completar informes: reutilización, programación y entrega | Integración de servicios existentes |
| A09-021 | P2 | Convertir bloqueos y escalados en trabajo persistente | Ampliación operativa |
| A09-022 | P2 | Atender cartera y comparativas multitienda con alcance explícito | Ampliación de consulta |
| A09-023 | P2 | Navegar y continuar sobre entidades reales desde la respuesta | Experiencia web |
| A09-024 | P2 | Dar a móvil alcance, recuperación y resultados compatibles | Paridad de canales |
| A09-025 | P2 | Ejecutar trabajos largos con progreso y recuperación por paso | Robustez y automatización |
| A09-026 | P2 | Unificar activación, presupuestos y validación de entrada | Controles de ejecución |
| A09-027 | P2 | Evaluar operaciones completas y sus efectos | Verificación |
| A09-028 | P3 | Actualizar la ficha y publicar un catálogo real de capacidades | Documentación |

### A09-001 · Filtrar la información interna antes de enviarla al modelo

- **Evidencia:** `runConsultantChatTurn` acepta usuarios con pertenencia a la organización (`apps/api/src/ai-runtime.ts:20997`). La audiencia de conocimiento sí se calcula por rol (`21381`), pero `list_open_tasks`, `get_task_history` y `get_call_history` usan el cliente de servicio y solo filtran organización/estado (`4062–4144`). Seleccionan `is_visible_to_client` sin aplicar esa restricción a la consulta. El contexto de herramientas no incluye una política de visibilidad por entidad (`1893–1899`).
- **Reproducción local:** ejecutadas las tres herramientas con audiencia `client_visible` y un transporte simulado, devolvieron una fila marcada `is_visible_to_client: false`. Se capturaron los filtros: ninguna añadió la condición de visibilidad. No se leyeron filas privadas reales ni se afirma un incidente de producción.
- **Mejora y aceptación:** resolver en el servidor rol, asignación y política de visibilidad; aplicarlos antes de consultar y serializar. Revisar también notas, resúmenes de llamadas, planes y contexto agregado al ampliar herramientas. Probar cliente, consultor asignado, consultor ajeno, administrador, cambio de rol y documentos internos. Una instrucción al modelo de no divulgar datos no sustituye este filtro.

### A09-002 · Hacer que todas las lecturas respeten la tienda de la conversación

- **Evidencia:** la conversación y `agent_runs` sí conservan el ámbito validado. Sin embargo, `list_open_tasks` y `get_task_history` no filtran ni devuelven `store_id` (`ai-runtime.ts:4062–4080, 4106–4124`); `get_current_milestone` invoca `findCurrentMilestoneId` sin el tercer argumento de tienda (`4046–4059`), aunque el helper lo admite. Además, A09 carga `loadDecisionPlaybookContextBlocks(supabase, organizationId)` sin tienda (`21513`); su consulta de casos selecciona `store_id` pero filtra únicamente organización (`decision-playbook-chat-context.ts:937–969`).
- **Reproducción y efecto:** las dos herramientas de tareas devolvieron una fila sintética de otra tienda al ejecutarlas con una tienda seleccionada. Por inspección, el hito y los casos pueden introducir evidencia de otra tienda de la misma organización, o no resolver el hito ante varios planes. Esto no demuestra acceso a otra organización.
- **Mejora y aceptación:** compartir un alcance validado entre todas las herramientas, loaders y recibos. Definir expresamente cómo participan los datos globales de organización y etiquetarlos. Pasar la tienda al resolver de hito y a los snapshots; conservar el bloqueo actual de SQL por tienda hasta disponer de aislamiento equivalente. Probar dos tiendas, plan global, datos globales permitidos y móvil sin selección; ningún filtro puede depender de un ID elegido libremente por el modelo.

### A09-003 · Recuperar el turno exacto y permitir continuar un turno incompleto

- **Evidencia:** la deduplicación de `client_turn_id` existe, pero la recuperación busca el primer mensaje posterior por `created_at`, sin enlace explícito al turno (`ai-runtime.ts:21245–21318`). No exige que la ejecución recuperada haya finalizado correctamente. Un turno incompleto devuelve `409` y pide recargar, sin un mecanismo de reanudación. El mensaje del usuario se guarda antes de cargar saldo y crear la ejecución; esas operaciones pueden fallar antes del `try` (`21339–21492`).
- **Efecto por inspección:** mensajes intercalados pueden impedir o confundir la recuperación; un fallo previo a crear el run deja un mensaje que bloquea la misma clave. Reutilizar la clave con otro contenido tampoco compara una huella de la petición.
- **Mejora y aceptación:** persistir una identidad de turno con usuario, conversación, tienda, huella de entrada, estado y run asociado; enlazar la respuesta a ese turno. Ofrecer consulta/reanudación o fallo recuperable, sin repetir efectos ni gasto ya confirmado. Verificar dos solicitudes concurrentes, misma clave con texto distinto, saldo no disponible, fallo de inserción del run y respuesta perdida.

### A09-004 · No recuperar una respuesta como exitosa si sus propuestas no quedaron guardadas

- **Evidencia:** A09 guarda primero el mensaje del asistente, después `agent_outputs` si hay propuestas y finalmente cierra `agent_runs` (`ai-runtime.ts:21616–21686`). Si falla guardar la propuesta, el mensaje ya contiene `copilot_output`. El reintento puede devolverlo con `approval_required: false` y `output_id: null` porque la recuperación no comprueba el estado del run (`21277–21318`).
- **Mejora y aceptación:** confirmar conjuntamente el resultado visible, sus propuestas y el estado final, o utilizar una fase de preparación con publicación final recuperable. La recarga debe distinguir respuesta, propuesta pendiente, ejecución fallida y efecto aplicado. Probar fallos en cada escritura, recuperación después de generar un PDF y cierre fallido; nunca mostrar una propuesta como resuelta o inexistente por faltar su fila.

### A09-005 · Materializar las notas o impedir que se ofrezcan como una acción aprobable

- **Evidencia:** `agentProposedWriteSchema` permite `kind: task` y `kind: note` (`packages/ai/src/index.ts:264–268`); A09 reutiliza ese contrato (`2018`). El bucle de aprobación omite cualquier elemento distinto de tarea (`ai-runtime.ts:22643–22647`), mientras el cierre puede marcar la salida como aprobada (`23215–23245`). No hay un destino de nota materializado en ese recorrido.
- **Mejora y aceptación:** definir destinatario, entidad, audiencia y resultado de una nota; materializarla mediante el servicio correspondiente. Hasta disponer de ese ejecutor, rechazar ese tipo como operación aplicable y comunicar el límite. Cada propuesta debe terminar en creada/aplicada, rechazada, fallida o no soportada con motivo. Probar lote mixto, solo nota y reintento: aprobar no puede equivaler a omitir en silencio.

### A09-006 · Usar permisos operativos por acción y una aprobación vinculada al cambio real

- **Evidencia:** el registro ya comprueba herramienta, conector, lista permitida y nivel de permiso. Sin embargo, `ToolContext` no transporta rol ni capacidades sobre la entidad (`tool-layer.ts:108`); `authorizeTool` comprueba para la aprobación que `approval_mode` no sea `none`, sin recibo de una acción concreta aprobada (`929–1006`). Hoy las escrituras externas están `planned`, por lo que esto es una condición para implementarlas, no una escritura externa indebidamente ejecutada observada.
- **Mejora y aceptación:** adaptar cada herramienta al servicio de negocio existente y al usuario autenticado. Resolver organización/tienda, permisos y conectores en el servidor; separar consultar, preparar borrador y aplicar. Las acciones que requieran aprobación deben vincularla a un cambio inmutable con entidad, versión, alcance, actor y caducidad; revalidar antes de ejecutar. Devolver estado real, ID de entidad y recibo deduplicado. Probar aprobación caducada, cambio posterior del objeto, pérdida de permisos y doble ejecución.
- **Alcance funcional:** habilitar las operaciones internas y reversibles conforme a los permisos ya concedidos en el producto. Las publicaciones, envíos o cambios externos deben usar sus controles concretos. La autorización de esta auditoría no habilita envíos reales ni campañas.

### A09-007 · Incorporar las lecturas ya disponibles que resuelven preguntas concretas

- **Evidencia:** la comparación del registro local con las listas activas de ambas bases deja fuera `get_brand_profile`, `get_shopify_product_catalog`, `shopify_product_repurchase_health`, `shopify_delivery_diagnostics`, `shopify_open_delivery_exceptions`, `shopify_return_delay_comparison`, `meta_creative_diagnostics`, `klaviyo_performance_summary`, `klaviyo_entity_performance` y `klaviyo_deliverability_health`, entre otras. Sus ejecutores están presentes en `buildAgentTools` (`ai-runtime.ts:1838–4843`).
- **Mejora y aceptación:** seleccionar herramientas por intención, rol, tienda, conector y cobertura: producto/stock, recompra, incidencia logística, creatividad, email o marca. Mantener descubrible el catálogo completo permitido sin cargarlo entero en cada pregunta. No habilitar indiscriminadamente las 21 ausentes: los playbooks internos, Instagram o herramientas dependientes de proveedores tienen condiciones propias. Probar preguntas de cada dominio, ausencia de conector y usuario cliente con contenido interno restringido.

### A09-008 · Permitir periodos y comparaciones expresables por el modelo

- **Evidencia:** numerosas herramientas Shopify fijan 90 días y las de Meta 30 (`ai-runtime.ts:578–581, 2647–2657, 2951–3025`). `meta_spend_detail` acepta fechas en su contrato Zod (`tool-layer.ts:744`) y las usa en el ejecutor, pero el JSON Schema anunciado por `registerScopedReadTool` queda vacío. La reproducción local confirmó `properties: {}` y `additionalProperties: false`: el modelo no puede enviar esas fechas de forma válida. `/comparar` solo expande un texto en el cliente.
- **Mejora y aceptación:** generar el esquema anunciado desde un contrato único y admitir rangos acotados, zona horaria y ventanas comparables donde las fuentes lo soporten. Devolver fechas realmente consultadas, granularidad y cobertura. Añadir comparaciones interanuales o de periodo anterior con criterios explícitos; informar cuando no exista histórico. Cubrir «esta semana», «septiembre», dos periodos equivalentes, rango parcial, máximo permitido y gasto atribuido Meta sin confundirlo con facturación Shopify.

### A09-009 · Mostrar la cobertura real de cada respuesta y evitar resultados ilimitados

- **Evidencia:** los resultados de herramientas incorporan procedencia, pero varios usan la hora actual de consulta y `freshness_seconds: null` (`ai-runtime.ts:2081–2264`); muchos contratos aceptan `data: z.unknown()`. La serialización de resultados de herramientas neutraliza contenido, pero no aplica un límite de tamaño equivalente al contexto (`packages/ai/src/untrusted-context.ts:83`). Listados usan paginación por offset y orden sin desempate por ID; el plan devuelve un árbol anidado y las lecturas de email pueden contener cuerpos amplios.
- **Mejora y aceptación:** declarar por fuente organización/tienda, periodo, última sincronización correcta, error vigente, moneda, filas incluidas y exclusiones. Usar respuestas tipadas, resúmenes y lectura de detalle; cursores estables y un presupuesto por resultado. Distinguir vacío, desconocido, truncado y fallo. Medir p95 y tokens con planes grandes, correos largos, varias páginas y sincronización antigua antes de atribuir un ahorro.

### A09-010 · Consultar entidades concretas y recuperar el contexto operativo útil

- **Evidencia:** `get_task_history` devuelve filas actuales ordenadas por actualización, sin eventos de una tarea concreta; `get_call_history` devuelve metadatos, sin acuerdos ni resumen (`ai-runtime.ts:4106–4144`). `get_strategic_plan` elige la versión más alta no archivada (`4027–4043`), de modo que un borrador posterior puede desplazar al plan activo. La búsqueda de conocimiento admite consulta semántica, sin lectura exacta de documento por ID (`4280–4411`).
- **Mejora y aceptación:** herramientas de búsqueda y detalle por ID autorizado para tareas, llamadas, documentos, planes, campañas y borradores. Separar plan activo, borrador e historial; recuperar acuerdos, responsables y vencimientos con la audiencia permitida. Preguntas como «qué acordamos en la última llamada», «qué falta en esta tarea» o «cita esta política» deben conducir a la entidad exacta. Probar IDs ajenos, versión cambiada y nota privada.

### A09-011 · Reservar contexto para lo esencial y cargar el resto según la pregunta

- **Evidencia:** cada turno carga en paralelo numerosas familias del playbook (`decision-playbook-chat-context.ts:937–1330`) y coloca esos bloques antes de especialistas, asignación de consultor y moneda (`ai-runtime.ts:21505–21534`). El serializador limita a 12.000 caracteres por bloque y 48.000 totales (`untrusted-context.ts:2–3`). El snapshot se guarda antes del recorte efectivo (`21536`).
- **Reproducción local:** con 28 bloques sintéticos de playbook de unos 2.000 caracteres, desaparecieron los últimos bloques y los de especialistas/asignación. Es una prueba del límite y del orden, no una medición de frecuencia real en producción.
- **Mejora y aceptación:** reservar espacio a alcance, restricciones, asignación y moneda; elegir contexto por intención y permitir ampliar evidencia bajo demanda. Reutilizar snapshots por organización/tienda/revisión con invalidación. Registrar lo cargado y lo realmente enviado, con motivo de exclusión. Verificar preguntas simples, plan semanal y contexto extenso sin cortar entidades a mitad ni perder reglas de aprobación; medir consultas, latencia y tokens.

### A09-012 · Validar las fuentes y cifras de la respuesta en el servidor

- **Evidencia:** A09 dispone de resolución de evidencia de gráficos y recibos de herramientas, pero `sources` admite referencias de texto y las cifras finales las redacta el modelo (`packages/ai/src/index.ts:1945–2033`). Tras el turno se sanea `ui_actions`; no se observa una vinculación obligatoria de cada cifra/cita a un resultado autorizado (`ai-runtime.ts:21594–21597`). El envelope de respuesta se construye sin pasar la tienda, aunque el run sí la conserva (`21740–21749`).
- **Mejora y aceptación:** conservar un registro de evidencias por turno con fuente, entidad/revisión, alcance, periodo y dato usado. Resolver las referencias estructuradas contra ese registro; derivar cobertura y avisos de las consultas reales. Propagar tienda al envelope y a recuperaciones. Probar fuente inexistente, cifra de otro periodo, moneda incompatible, evidencia recortada y afirmación de acción sin recibo. Mantener las advertencias de atribución de cada proveedor.

### A09-013 · Dar continuidad a decisiones y operaciones en conversaciones largas

- **Evidencia:** A09 conserva diez mensajes recientes y transforma el historial a `role/content` (`ai-runtime.ts:17446, 21321–21337`). Se pierden en ese contexto los resultados estructurados de herramientas, identidades de propuestas y estados posteriores de aprobación. Hay ingesta de memoria para decisiones aprobadas/rechazadas (`23278–23320`), pero no sustituye un estado conversacional actualizado de trabajo pendiente.
- **Mejora y aceptación:** resumir objetivos, restricciones, decisiones y preguntas abiertas con referencias a entidades y turnos; recuperar el detalle original cuando sea necesario. Conservar IDs y actualizar el estado real de acciones. Separar memoria de conversación y conocimiento empresarial, respetando audiencia, tienda y rectificaciones humanas. Verificar seguimiento tras más de diez mensajes, reapertura, cambio de estado fuera del chat y ausencia de propagación automática a otra tienda.

### A09-014 · Consultar especialistas con cobertura, vigencia y posibilidad de profundizar

- **Evidencia:** `loadRecentSpecialistOutputBlock` toma una muestra conjunta de hasta 120 ejecuciones de los últimos 45 días y selecciona salidas aprobadas/publicadas del ámbito exacto (`ai-runtime.ts:20913–20974`). La vigencia depende del especialista; la muestra global puede dejar fuera a uno menos frecuente. El contexto no ofrece al modelo una herramienta para recuperar por ID el análisis completo ni consultar su estado actualizado.
- **Mejora y aceptación:** obtener el último resultado útil por especialista y alcance, con estado, antigüedad y causas de exclusión. Separar hechos de un análisis pendiente de revisión de las acciones no aprobadas; no convertir pendientes en permiso de ejecución. Permitir profundizar y, si hace falta una actualización, solicitar una ejecución deduplicada y presupuestada con progreso. Evitar lanzar todos los agentes en cada mensaje. Probar especialista ausente, muestra monopolizada, análisis vencido y plan activo que limite una recomendación.

### A09-015 · Gestionar tareas completas, con estado comprobable

- **Evidencia:** el software ya contiene `createTask`, `updateTaskAssignment` y `updateTaskStatus` (`apps/api/src/operations.ts:921, 1121, 1160`), pero A09 no las expone como operaciones de negocio. Sus propuestas actuales cubren principalmente altas y pasan por el materializador genérico.
- **Mejora y aceptación:** permitir crear, consultar, reasignar, actualizar prioridad/fecha y cambiar estado cuando los servicios y el rol lo permitan. Reutilizar validaciones de asignación, visibilidad, tienda, enlaces y notificaciones; añadir adaptadores donde falte una operación. Resolver referencias ambiguas antes de modificar. Devolver enlaces y valores finales; evitar duplicados por reintento. Cubrir «aplaza esta tarea», «asígnala al responsable» y «marca completadas estas dos» con conflicto de versión y permisos distintos.

### A09-016 · Trabajar sobre Mi Camino mediante cambios estructurados

- **Evidencia:** `strategic-plans.ts` contiene creación desde propuesta (`3265`), gestión de hitos y enlaces a tareas; A09 solo dispone de lectura de plan/hito y del contrato genérico tarea/nota. Ese contrato no representa añadir una fase, revisar una meta o cambiar una fecha de hito.
- **Mejora y aceptación:** herramientas para preparar un plan, proponer cambios de fase/hito y enlazar trabajo existente. Mostrar el cambio sobre la versión vigente, sus dependencias e impacto; usar los servicios del Camino tras la aprobación correspondiente. Mantener historia y límites por tienda. Cubrir creación, modificación, cambio concurrente y propuesta rechazada. No sustituir una petición de modificar el plan por una tarea de «modificar el plan» cuando exista el adaptador real.

### A09-017 · Crear y mantener campañas dentro del calendario del producto

- **Evidencia:** `campaign-planning.ts` ya gestiona calendarios y elementos y expone `createCampaignItemsFromProposal` (`1626`), con integración de tareas. No hay herramientas A09 equivalentes para leer el calendario, localizar una campaña, preparar el lote y aplicarlo.
- **Mejora y aceptación:** consultar campañas y huecos, crear borradores/calendarios, mover fechas, enlazar hitos/tareas y revisar un lote por campaña. Reutilizar sus reglas de estado, fechas, ámbito y deduplicación. Diferenciar planificar una campaña de publicarla en el proveedor. Cubrir planificación mensual, reprogramación de un elemento existente, campaña de otra tienda y reintento sin duplicar calendario ni tareas.

### A09-018 · Encargar contenido y recuperar el artefacto de los especialistas

- **Evidencia:** existen Studio (`marketing-studio.ts:139`), generación de contenido, análisis y preparación visual, email y diseño de flujos en los especialistas. A09 no dispone de herramientas de encargo/seguimiento que conecten una petición conversacional con esos borradores y su revisión.
- **Mejora y aceptación:** convertir un objetivo en un brief nativo con marca, producto, público, canal y restricciones verificadas; dirigirlo al especialista adecuado y devolver el borrador real con su ID. Permitir iteraciones sobre la misma revisión y estado visible de generación. Reutilizar activos autorizados y contratos de A11/A15/A16/A26/A28 según la tarea; desarrollar el adaptador cuando no exista. Probar brief incompleto, fallo del especialista y revisión de un borrador existente sin volver a crearlo ni publicar como efecto de generar.

### A09-019 · Extender acciones de conectores según su madurez real

- **Evidencia:** hay adaptadores nativos como `pushDraftToKlaviyoTemplate` (`klaviyo.ts:1616`), `pushFlowDesign` (`marketing-flows.ts:523`) y `scheduleMarketingKlaviyoCampaign` (`marketing-klaviyo.ts:586`). El plan de creación Meta declara explícitamente `executionReady: false` (`meta-ad-write-plan.ts:69–118`). Las escrituras de Shopify/Meta/Klaviyo/Instagram del registro compartido siguen `planned`; su nombre no acredita operación disponible en A09.
- **Mejora y aceptación:** integrar primero los adaptadores existentes, con permisos y ámbitos reales del proveedor. Para actualizar productos/inventario, pausar anuncios, cambiar presupuesto o programar publicaciones, completar cada ejecutor y su comprobación de resultado antes de habilitarlo. Mantener planificación/simulación cuando el proveedor no permita ejecutar. Verificar precondiciones, límites económicos, aprobación cuando corresponda, deduplicación, ID externo y estado posterior. Cubrir timeout tras una escritura aceptada y permiso OAuth insuficiente sin repetir envíos.

### A09-020 · Completar el ciclo de informes y evitar artefactos duplicados

- **Evidencia:** `generate_report` ya exige preview antes de generar, admite siete plantillas y un máximo de 92 días (`ai-runtime.ts:2354–2482`; `tool-layer.ts:539–579`). El conjunto que registra previews vive en memoria del turno; no equivale a una identidad persistente del artefacto final. Programación y entrega existen fuera de las herramientas A09: `upsertReportSchedule` (`reports-api.ts:99`), `createCopilotReportShareLink` y `emailCopilotReport` (`copilot-report-sharing.ts:68, 96`).
- **Mejora y aceptación:** crear/reutilizar el artefacto por petición, plantilla, alcance, periodo y revisión de datos; enlazar el preview con el contenido finalmente generado. Añadir consulta de informes, programación, modificación/cancelación y preparación de entrega mediante servicios existentes. Todo envío debe usar destinatario y autorización explícitos, con estado y recibo. Probar repetición de llamada final, recuperación tras desconexión, tienda incorrecta, fallo de render y petición de informe recurrente.

### A09-021 · Persistir solicitudes de datos, incidencias y escalados

- **Evidencia:** `request_missing_data`, `escalate_to_human`, `flag_data_quality_issue` y `report_confidence` no están en la lista activa de A09. Sus ejecutores estructurados producen objetos y recibos de herramienta, pero no crean por sí mismos un caso operativo ni notifican al responsable (`ai-runtime.ts:4654–4780`). `dry_run_write` refleja operación/objetivo/cambios sin simular las validaciones de una operación real (`4602`).
- **Mejora y aceptación:** dar a cada bloqueo un registro con organización/tienda, causa, evidencia, responsable y estado. Reutilizar tareas/alertas u otro destino nativo adecuado; desarrollar el destino si no existe. Mostrar si se ha solicitado, quién debe resolverlo y cuándo se retoma. La simulación debe validar entidad, permisos, versiones y efectos previstos del ejecutor real. Probar solicitud repetida, dato ya corregido, responsable desconocido y escalado sin envío autorizado.

### A09-022 · Añadir una vista de cartera y comparaciones autorizadas

- **Evidencia:** la ficha maestra prevé priorizar clientes y preparar llamadas en varias organizaciones (`Agentes IA/EcomScaling_IA_Documento_Maestro_Agentes_v0_2.md:1013–1104`). El turno actual exige una sola organización. Existen vistas de consultoría y `getDailyWorkbench` (`consultant-workbench-api.ts:111`), que A09 no expone como herramientas de cartera.
- **Mejora y aceptación:** permitir «qué clientes requieren atención hoy» y «prepara mis próximas llamadas» sobre asignaciones activas resueltas en el servidor. Añadir comparativa explícita de tiendas con métricas homologables, monedas/periodos identificados y fuentes separadas. Para operaciones, elegir después una organización y tienda concretas. Probar revocación de asignación, cliente sin acceso de cartera y cuentas con monedas distintas; no habilitar SQL multiempresa libre ni deducir permisos de la lista enviada por el modelo.

### A09-023 · Enlazar tareas, planes, campañas y borradores desde la respuesta

- **Evidencia:** las acciones estructuradas de UI se limitan a `open_insight`, con un máximo de tres y catálogo cerrado (`copilot-ui-actions.ts`; `packages/contracts/src/copilot-navigation.ts`). Es una base saneada, pero no permite continuar sobre una tarea creada, un hito, una campaña, un borrador o una revisión pendiente.
- **Mejora y aceptación:** ampliar destinos tipados por entidad, con ID y ámbito validados por el backend. Mostrar «abrir», «revisar cambio», «continuar borrador» o «consultar estado» según el resultado real. Presentar diferencias y consecuencias antes de aplicar cuando proceda. Mantener streaming y accesibilidad; los controles deben utilizar las mismas APIs y permisos que el resto del producto. Probar ID inexistente/ajeno y recarga de una respuesta histórica cuyo objeto cambió.

### A09-024 · Alinear móvil con las capacidades reales del backend

- **Evidencia:** `apps/mobile/components/copiloto.tsx:53` envía mensaje, conversación, modelo y un nuevo ID de turno, pero no `view_context`, selección de tienda ni referencia de evidencia. El componente consume respuesta/cifras/avisos/siguiente acción, sin presentar todos los informes, propuestas y acciones que el backend puede devolver. El comentario de «solo consulta» no restringe esas capacidades en el servidor.
- **Mejora y aceptación:** llevar el alcance seleccionado al chat móvil y permitir seleccionar explícitamente organización/global cuando corresponda. Implementar recuperación de turnos, historial y representación de propuestas/artefactos, o negociar un perfil de capacidades que impida generar resultados inaccesibles desde ese canal. Compartir contratos con web. Probar cambio de tienda, desconexión, propuesta pendiente e informe generado; el usuario debe poder encontrar el resultado por el que se consumió presupuesto.

### A09-025 · Ejecutar trabajos largos con progreso persistente y continuación

- **Evidencia:** el endpoint de streaming tiene latidos y señal de aborto (`server.ts:11171–11235`), pero el trabajo se concentra en un turno HTTP y los ejecutores no reciben uniformemente esa señal. Encadenar investigación, especialistas, PDF y publicación requiere más estado que la respuesta final o el progreso efímero del stream.
- **Mejora y aceptación:** representar cada operación compuesta como pasos persistidos: consultar, preparar, esperar revisión, ejecutar y verificar. Reanudar desde el último paso confirmado, con límite de tiempo/coste y recibo por efecto. Permitir cancelar lo pendiente y consultar lo que ya se completó; notificar dentro del producto según sus reglas. Probar cierre de pestaña, caída del worker/proveedor, resultado parcial y autorización que expire durante la espera. Priorizar la infraestructura de trabajos ya existente antes de introducir otro motor.

### A09-026 · Aplicar controles consistentes de activación, gasto y entrada

- **Evidencia:** A09 comprueba presupuesto diario de organización y circuito de proveedor, y usa reserva económica por organización (`ai-runtime.ts:21075–21094, 21448`). No recorre el control de activación por organización del runner genérico ni su llamada a `checkPlatformDailyBudget` (`5585–5640`). La RPC local de reserva contabiliza únicamente la organización (`20261222200000_agent_daily_budget_reservations.sql:25–98`). Las rutas de chat usan tipos TypeScript para el cuerpo sin un esquema completo de validación en esos handlers (`server.ts:11128–11235`).
- **Mejora y aceptación:** declarar y aplicar la política específica de A09 para activación de catálogo/organización/plataforma y límite económico global; conservar la elección de modelo por plan sin asumir que debe seguir la del diagnóstico automático. Validar mensaje, tamaños y campos de contexto antes de reservar o persistir, y representar claramente saldo/modelo efectivo. Si el cupo mensual requiere un límite estricto concurrente, reservarlo también. Probar agente desactivado, límite global, dos turnos simultáneos, cuerpo inválido y saldo agotado. No retirar el chat manual: la retirada anterior se autorizó para A02.

### A09-027 · Evaluar objetivos completos y comprobar efectos reales

- **Evidencia:** pasaron las 55 pruebas focalizadas indicadas abajo, incluidas aislamiento de conversaciones y selección de especialistas. Eso no cubre todos los filtros de cada ejecutor. `scoreCopilotAnswer` usa coincidencias de texto/citas para sus hechos etiquetados (`copilot-quality-evals.ts:25–60`), útiles como señal parcial, insuficientes para certificar una operación de negocio.
- **Mejora y aceptación:** regresiones de herramientas con consultas simuladas que fallen si falta organización, tienda o visibilidad; esquemas anunciados comparados con contratos; fallos intermedios y concurrencia de turnos/efectos. Añadir recorridos por rol de «consulta → propuesta/borrador → revisión → aplicación → comprobación», con IDs, estados y número de efectos esperados. Evaluar preguntas de catálogo, margen, campañas, llamadas y seguimiento con hechos etiquetados. Medir éxito de tarea, afirmaciones sin evidencia, duplicados, latencia y coste; separar pruebas locales de evaluación semántica con proveedor y E2E desplegado.

### A09-028 · Documentar lo que A09 puede hacer y lo que sigue pendiente

- **Evidencia:** la ficha maestra mantiene «Definido; pendiente de cockpit y políticas multiempresa» y herramientas que no corresponden al inventario actual (`1013–1104`). `docs/REVISION_AGENTES.md:299–308` da por acotadas todas las herramientas a tienda y cerrado el alcance local anterior; esta pasada reproduce excepciones concretas. La configuración remota actual ya es v15/prompt v9, por encima de algunas notas históricas.
- **Mejora y aceptación:** publicar un catálogo por dominio, rol y canal con las operaciones de consulta, preparación y ejecución efectivas, requisitos, límites y destino. Enlazar esta auditoría conservando el historial y distinguir configuración de base, implementación local, despliegue y verificación con datos. Documentar el papel de A09 frente al orquestador conceptual A00 para evitar duplicar motores o atribuir a A09 capacidades solo planeadas.

### Implementación de A09 · 18 de octubre de 2026

La auditoría anterior conserva el estado observado en su fecha. Esta implementación está **en curso**; el alta de una herramienta en la versión remota solo la hace elegible cuando la API que contiene su ejecutor esté desplegada. No se ha verificado ese despliegue ni una ejecución con proveedores reales.

| Mejora | Estado | Resultado comprobado / trabajo pendiente |
|---|---|---|
| A09-001 | Parcial | Tareas y llamadas filtran visibilidad; el detalle de resumen publicado recorta campos internos. La API y RLS ocultan notas de salidas pendientes al cliente. Falta revisar todas las fuentes de contexto y roles. |
| A09-002 | Parcial | Tareas, hito y casos F3 respetan la tienda; móvil transmite la tienda seleccionada. Las llamadas sin tienda exigen vista de organización. Falta auditoría exhaustiva de fuentes globales. |
| A09-003 | Parcial | El reintento busca la respuesta por `client_turn_id` y estado exitoso; se valida el texto repetido y móvil ofrece recuperación. Falta reanudar ejecuciones interrumpidas y probar concurrencia real. |
| A09-004 | Implementado localmente | La RPC `finalize_copilot_chat_turn` confirma respuesta, propuesta y cierre en una transacción. Pendiente prueba de fallos integrada contra base. |
| A09-005 | Implementado localmente | Las notas propuestas se materializan de forma deduplicada en `agent_output_notes`; los tipos no soportados fallan explícitamente. Pendiente recorrido E2E de aprobación. |
| A09-006 | Pendiente | Autorización por cambio inmutable, revisión de versión y recibos operativos antes de ampliar escrituras. |
| A09-007 | Parcial | A09 v16 habilitó diez lecturas existentes; v17 añadió detalle de tarea/llamada y calendario. Faltan selección dinámica por intención y cobertura restante. |
| A09-008 | Parcial | `meta_spend_detail` anuncia sus fechas al modelo. Faltan periodos y comparaciones homogéneos para los demás dominios. |
| A09-009 | Pendiente | Contratos tipados, frescura de fuente, cursores estables y límite uniforme por resultado. |
| A09-010 | Parcial | Plan activo y detalle autorizado de tarea y llamada. Faltan documentos, planes históricos, campañas y borradores por ID. |
| A09-011 | Parcial | El contexto esencial precede a los playbooks y la tienda solo carga casos F3 pertinentes. Falta presupuesto adaptativo completo y medición. |
| A09-012–014 | Pendiente | Validación servidor de citas/cifras, memoria de conversación y consulta bajo demanda de especialistas. |
| A09-015–016 | Pendiente | Ciclo completo de tareas y cambios nativos de Mi Camino mediante propuestas/versiones. |
| A09-017 | Parcial | Lectura autorizada del calendario anual; faltan creación, reprogramación y aplicación deduplicada. |
| A09-018–019 | Pendiente | Encargo a especialistas y adaptadores de escritura externa con verificación de efecto. |
| A09-020 | Parcial | Se evita duplicar `generate_report` dentro del turno; faltan identidad persistente, programación y entrega. |
| A09-021 | Pendiente | Escalados persistentes con responsable y estado. |
| A09-022 | Parcial | Lectura de mesa diaria con cartera autorizada al consultor; faltan comparativas multitienda homogéneas. |
| A09-023 | Pendiente | Navegación tipada a entidades desde la respuesta. |
| A09-024 | Parcial | Móvil pasa ámbito, recupera el turno y muestra informes/propuestas con revisión. Faltan historial persistente y acciones de entidad. |
| A09-025 | Pendiente | Pasos duraderos y continuación de trabajos largos. |
| A09-026 | Parcial | Chat comprueba activación de A09, presupuesto global y longitud de mensaje; falta esquema completo y cuota concurrente. |
| A09-027 | Parcial | Pruebas de alcance, visibilidad y esquema añadidas; faltan recorridos E2E y fallos transaccionales. |
| A09-028 | Parcial | El catálogo siguiente distingue rol, canal y requisitos; falta comprobar despliegue y actualizar la ficha maestra. |

**Catálogo efectivo declarado por A09 v18 (38 nombres).** Todas las lecturas requieren pertenencia autorizada a la organización. La API filtra además la lista activa por estado de implementación y conector; una herramienta configurada en base no se ofrece si falta alguno. Web y móvil usan el mismo endpoint de chat; móvil muestra informes y propuestas, aunque su historial sigue local a la pantalla.

| Dominio | Herramientas | Condiciones y límite operativo |
|---|---|---|
| Organización y marca | `get_organization_profile`, `get_brand_profile`, `get_financial_settings` | Lectura del ámbito validado; la guía interna de la plataforma no forma parte de la guía de marca del cliente. |
| Mi Camino y trabajo | `get_strategic_plan`, `get_current_milestone`, `list_open_tasks`, `get_task_history`, `get_task_detail`, `list_open_alerts` | Plan activo; tareas/alertas visibles según audiencia y tienda. No modifica entidades. |
| Llamadas y campañas | `get_call_history`, `get_call_detail`, `get_campaign_calendar` | Las llamadas requieren vista de organización; el detalle del cliente solo incluye resumen publicado y campos permitidos. El calendario aplica visibilidad y tienda mediante el servicio existente. |
| Cartera de consultoría | `get_consultant_workbench` | Solo consultor o administrador con token válido; las asignaciones se resuelven en el servidor. Lectura de prioridades y próximas llamadas, con límites de salida. |
| Shopify | `shopify_customer_health`, `shopify_product_repurchase_health`, `shopify_demand_sources`, `shopify_fulfillment_health`, `shopify_delivery_diagnostics`, `shopify_open_delivery_exceptions`, `shopify_return_delay_comparison`, `shopify_funnel_health`, `shopify_margin_health`, `get_shopify_product_catalog` | Requiere conector y cobertura sincronizada; no son lecturas en tiempo real del proveedor. |
| Meta | `meta_change_log`, `meta_creative_diagnostics`, `meta_creative_health`, `meta_delivery_health`, `meta_spend_detail` | Requiere conector; los importes y compras atribuidos por Meta conservan su moneda y atribución. |
| Klaviyo | `klaviyo_email_content`, `klaviyo_measurement_health`, `klaviyo_performance_summary`, `klaviyo_entity_performance`, `klaviyo_deliverability_health` | Requiere conector; contenido y métricas proceden de sincronizaciones autorizadas. |
| Datos y conocimiento | `data_coverage`, `describe_schema`, `search_knowledge`, `sql_select` | `sql_select` se retira cuando hay una tienda seleccionada. La búsqueda de conocimiento usa audiencia por rol. |
| Informes | `generate_report` | Preview antes de PDF; el resultado es un artefacto interno. La programación y entrega siguen fuera de A09. |

En el chat, la propuesta `task` o `note` exige revisión conforme al estado de la salida; ninguna de las 38 herramientas es un ejecutor de publicación, envío o cambio externo. Las acciones nativas de tareas, Camino, campañas y conectores enumeradas como pendientes arriba no deben atribuirse a A09 por estar presentes en otro módulo.

Migraciones aplicadas y verificadas tanto en **test** (`kopcblejsxpkxoykldyh`) como en **producción** (`cthjwpeygpzwdmjkxeqa`): `20261230100000_a09_atomic_chat_and_tools.sql`, `20261230110000_a09_richer_read_tools.sql`, `20261230120000_a09_proposal_notes.sql`, `20261230130000_a09_entity_and_calendar_reads.sql`, `20261230140000_a09_consultant_workbench.sql` y `20261230150000_a09_output_note_visibility.sql`. Ambas bases tienen A09 **v18, 38 herramientas permitidas** y la política de notas restringida. Esto comprueba la configuración de base, no la versión de API desplegada.

Verificación local: typecheck de `@e-nora/ai`, API y móvil; **42/42** pruebas focalizadas en `npm run test:a09-copilot` y **6/6** del registro de herramientas. La suite completa de `packages/ai` conserva un fallo ajeno a A09: la prueba de A08 espera `KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT = 80` y el árbol de trabajo actual fija `16`. No se han ejecutado envíos externos ni campañas.

### Verificación y límites de esta auditoría de A09

- **55/55 pruebas locales aprobadas**, mediante `npx tsx --test --test-force-exit` desde `apps/api`: `consultant-chat-store-scope.test.ts`, `consultant-specialist-context.test.ts`, `copilot-evidence.test.ts`, `copilot-ui-actions.test.ts`, `copilot-answer-stream.test.ts`, `decision-playbook-chat-context.test.ts`, `copilot-tokens.test.ts`, `copilot-quality-evals.test.ts` y `packages/ai/src/tool-layer.test.ts`.
- **Reproducciones adicionales sin persistencia:** inventario efectivo de 24/23 herramientas; discrepancia entre JSON Schema y contrato de fechas de `meta_spend_detail`; devolución de filas sintéticas privadas en tres herramientas y de otra tienda en las dos de tareas; pérdida de bloques esenciales por presupuesto de contexto. No se ejecutaron herramientas sobre datos de clientes.
- **Comprobación remota limitada a configuración:** se consultaron las versiones activas de A09 en test y producción. No se modificaron esas bases, no se llamó al modelo ni se enviaron mensajes, campañas o informes. No se crearon migraciones ni cambios de aplicación. No se han medido calidad semántica, latencia/coste bajo carga ni madurez de cada adaptador contra proveedores reales.
- **Orden de ejecución recomendado:** corregir A09-001–006 y las garantías transversales de contexto/entrada; conectar después lecturas y operaciones nativas; ampliar por último las acciones externas y trabajos compuestos conforme se verifiquen sus adaptadores. La potencia se comprobará por tareas completadas con resultado recuperable y permisos correctos.
