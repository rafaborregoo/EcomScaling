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

### A11 - Cierre de mejoras restantes (2026-10-19)

| ID | Cambio implementado | Estado y limite conocido |
|---|---|---|
| A11-016 | Resolver por ID los productos ya insertados en el email, limitado a la organizacion y tienda activas; conserva precio, imagen y URL reales. | Parcial: vision de imagen presupuestada y seleccion de variante aun pendientes. |
| A11-018 | Persistir la etapa de contexto/modelo/validacion/guardado y estado terminal de la generacion; el estudio muestra el estado y reanuda con la misma clave idempotente. | Implementado localmente y migraciones aplicadas en test y produccion. |
| A11-019 | Endpoint de biblioteca con filtro de tienda antes del limite, cursor estable y DTO resumido sin HTML ni bloques; la lectura del documento sigue en el endpoint existente. | Parcial: el listado principal aun usa la respuesta completa y no carga el detalle bajo demanda. |
| A11-022 | Cache de perfiles de marca aislada por organizacion/tienda y de corta duracion, ademas del contexto de catalogo e imagenes bajo demanda. | Parcial: falta invalidacion estricta por version y medicion de latencia/tokens/coste. |
| A11-023 | Guardar recibo de operaciones de IA al persistir el cambio, con autor, request, version base/final y operaciones aceptadas/rechazadas; una respuesta sin cambios verificados no afirma que se aplicaron. | Parcial: eventos manuales, undo y redo aun no tienen categorias y recibos propios. |
| A11-024 | Prueba de recorrido local de producto verificado -> operacion del editor -> HTML exportable. | Parcial: falta integrar generacion/campana/aprobacion/Klaviyo y validacion visual en clientes reales. |

**Verificacion:** typecheck de API y web; pruebas focales API (8/8) y editor/render HTML (13/13). Migraciones `20261231230700_a11_remaining_integrity.sql` y `20261231230800_a11_terminal_generation_progress.sql` aplicadas correctamente en test (`kopcblejsxpkxoykldyh`) y produccion (`cthjwpeygpzwdmjkxeqa`). La auditoria A11 sigue abierta en los limites indicados; no se declara terminado lo que no se ha verificado.

## A12 · Analista de email marketing

**Auditoría: 19 de octubre de 2026. Estado de implementación: cambios principales aplicados; integración completa aún abierta.** Esta revisión contrastó el árbol de trabajo, las consultas y la configuración remota. El cierre histórico de A12 en `REVISION_AGENTES.md:350–368` no cubría las incidencias reproducidas aquí. Se han implementado cambios locales en API, UI web/móvil y dos migraciones aplicadas a test y producción; no se ha desplegado código ni se ha ejecutado A12 contra datos de clientes.

#### Estado de implementación de A12

| Estado | Mejoras | Resultado |
|---|---|---|
| Implementadas | A12-001, 003, 004, 009, 010, 014, 017, 029 | Alcance Klaviyo por tienda en el cron y en el contexto; origen cron/manual y cuota manual separados; digest propio por tienda/cuenta/periodos/sync/reportes; comparación de meses completos no solapados; RPC con identidad y seguridad de cuenta, valores de ingresos nulos cuando falta moneda o se mezclan monedas; catálogo no se declara completo sin sync válido; muestra de campañas/flows que considera riesgo; contexto transversal con filtro de tienda y autorización previa. |
| Parciales | A12-002, 005, 007, 008, 011–013, 015–016, 018–020, 022, 024, 026, 028 | Elegibilidad y estados UI mejorados; reserva manual atómica y clave idempotente; nulos/errores/cobertura más explícitos; bloques de evidencia prioritarios; A26/A28 y backlog mejor seleccionados; pantallas web/móvil con periodo y tienda; ficha de esta auditoría actualizada. Falta aún cerrar recuperación durable de ejecuciones, latido/motivo de cada tick, contrato único de datos, validación de evidencia, historial/revalidación de propuestas y despliegue observable. |
| Pendientes de integración funcional | A12-006, 021, 023, 025, 027 | Buzón durable de propuestas que sobreviva a nuevos outputs; validación server-side de cada afirmación contra evidencia; handoff tipado con A11/A27 y medición posterior; permisos/estado recuperable por propuesta con revalidación de datos obsoletos; pruebas específicas del runner/UI y recorridos E2E por rol. |

**Migraciones aplicadas:** `20270101110000_a12_email_analyst_integrity.sql` y `20270101120000_a12_email_activity_digest.sql`, en test (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`). La aplicación remota de SQL está verificada; el código de aplicación sigue pendiente de despliegue.

### Qué hace y cómo se dispara actualmente

A12 interpreta rendimiento atribuido por Klaviyo: campañas y flows, ingresos/conversiones, aperturas/clics y señales de entregabilidad. Prepara contexto, puede profundizar con herramientas de lectura y guarda un diagnóstico con recomendaciones y propuestas. La aprobación materializa trabajo interno; A12 no envía emails ni activa flows en Klaviyo. A26 analiza contenido; A27 planifica mailing; A11 redacta/diseña; A28 propone arquitectura de flows.

| Entrada | Comportamiento comprobado | Límite que debe explicarse o corregirse |
|---|---|---|
| Worker automático | BullMQ registra `0 6,15 * * *`, zona `Europe/Madrid`: 06:00 y 15:00. Llama a `POST /v1/internal/ai/diagnostics/tick` con secreto interno. | Es el horario del evaluador, no una garantía de dos análisis diarios. Depende de worker/API activos, autorun, elegibilidad, controles y cupos. |
| Selección en el tick | A12 está en `ORCHESTRATED_DIAGNOSTIC_AGENT_CODES`. La configuración de diseño indica una ejecución diaria si cambia la actividad; el mínimo base entre reconsideraciones es 20 horas, ajustable desde plataforma. | Solo entra por organizaciones con Shopify conectado/sincronizando y alguna sincronización previa. No comprueba primero que haya Klaviyo listo. |
| Alcance automático | `orchestratorScopesForAgent` devuelve para A12 únicamente `{storeId:null, connectionId:null}`. El tick llama al runner sin conexión. | Genera el agregado de organización, mientras los GET de tienda exigen coincidencia exacta de `store_id`. |
| Controles automáticos | Activación por organización/plataforma, presupuestos, circuito de proveedor, cupo general por organización —12 runs/día por defecto— y por tick —15 por defecto—. Decide según último éxito, digest, antigüedad y salida pendiente de revisión durante tres días. | Los cupos se comparten con otros agentes. Una salida pendiente puede retrasar una lectura nueva. A12 no transmite opciones de cron y acaba usando los valores manuales del runner. |
| `GET /ai/email-analyst` | Lee el último éxito de A12 con ventana de 30 días y alcance exacto. Devuelve el histórico aunque sea antiguo; abrir una página no lanza el modelo. | Si falta resultado, distingue genéricamente entre falta de datos y primer diagnóstico pendiente; no explica la situación real de Klaviyo/A12. |
| `POST /ai/email-analyst-run` | Ejecución síncrona manual. Acepta `connectionId`; resuelve estrictamente una tienda activa o un agregado intencional. | No acepta una identidad de petición recuperable ni periodo explícito; `days` que envían varias pantallas se ignora. |
| Sincronización Klaviyo | Tiene su reconciliación independiente: `43 */6 * * *`, UTC, que refresca inventario/reportes. | Sincronizar no invoca inmediatamente A12. No confundir «datos sincronizados», «análisis generado» y «propuesta aprobada». |

Referencias: `apps/worker/src/repeatable-jobs.ts:7–20`, `apps/worker/src/worker.ts:152,308`, `apps/api/src/server.ts:9965,9992,12220`, `apps/api/src/ai-runtime.ts:13283,15951,16001,16214,16467,16581,16913`, `apps/api/src/agent-schedule.ts:28`.

### Dónde aparece y por qué resulta poco claro

| Superficie | Uso de A12 observado | Mejora necesaria |
|---|---|---|
| `/klaviyo` | Sección «Análisis de email», después de A26, con GET y «Actualizar ahora». | Explicar cometido, alcance, periodo real, fuente, actualización automática, estado y responsable de revisar. |
| Dashboard de Klaviyo | La lectura ejecutiva visible corresponde a A02. A12 se consulta, pero solo aparece una nota de propuestas para clientes sin consultor. | Dar a A12 un diagnóstico localizable y distinguirlo claramente de A02/A26. |
| Pulso / Prioridades | Consume propuestas A12; el cliente con consultor no recibe las pendientes por esa vía. | Mostrar dónde está el análisis y quién revisa sus propuestas, evitando promesas de trabajo automático. |
| Mesa del consultor | Lista «Email» con edad/propuestas o «Sin ejecutar», y botones «Lanzar/Actualizar». | Diferenciar carga, error, bloqueo, falta de conexión y ausencia real de ejecuciones. |
| Móvil / Todo | Lee A12 global con `days=30`, sin transportar la tienda usada por las métricas vecinas. | Unificar alcance y presentar el estado, procedencia y destino del análisis. |

Referencias: `apps/web/src/app/klaviyo/page.tsx:76`, `apps/web/src/components/ai-diagnostic-section.tsx:699–780,829–875`, `apps/web/src/app/dashboard/client-klaviyo.tsx:161,342,727`, `apps/web/src/app/dashboard/client-pulse.tsx:1249`, `apps/web/src/app/dashboard/consultant-desk.tsx:1061,1085,1278`, `apps/mobile/components/views.tsx:177–180`.

### Configuración remota comprobada, solo lectura

Comprobación realizada el **19 de octubre de 2026 a las 09:15–09:16 UTC**, sin leer cuerpos de emails ni salidas de clientes:

| Comprobación | Test · `kopcblejsxpkxoykldyh` | Producción · `cthjwpeygpzwdmjkxeqa` |
|---|---|---|
| Versión activa de A12 | Agente v4 / prompt v4 | Agente v4 / prompt v4 |
| Herramientas declaradas | `search_knowledge`, `klaviyo_performance_summary`, `klaviyo_entity_performance`, `klaviyo_deliverability_health` | Las mismas cuatro |
| Modelo de la versión / aprobación | `claude-sonnet-5` / `required_before_publish` | Los mismos; el modelo efectivo puede cambiar por configuración de cliente/plataforma y routing |
| Override de cadencia en `platform_ai_agent_settings` | Sin fila para A12; aplica diseño | Sin fila para A12; aplica diseño |
| Runs A12 en los últimos 30 días | 7: 3 éxitos y 4 fallos; todos etiquetados `manual`. Los dos éxitos por tienda no tienen digest. | Ninguno |
| Última ejecución A12 registrada | 13 de octubre de 2026 | 8 de septiembre de 2026 |
| Gate logs A12 en los últimos siete días | Ninguno | Ninguno |
| Último gate log de cualquier agente | 25 de septiembre de 2026 | 22 de septiembre de 2026 |
| Conexiones relevantes | Hay Shopify y Klaviyo conectados con sincronización previa; también existen conexiones en otros estados. | No hay conexiones Klaviyo registradas. La única Shopify figura en error. |
| Función `klaviyo_email_report(uuid,date,date,uuid)` | Definición con hash MD5 `207b818ee846a129bf523d58e362fa07` | Misma definición; contrastada con la última migración local de corrección del informe |

**Interpretación:** la configuración de A12 sí está cargada. Esto no certifica el worker ni la versión de API desplegada. La ausencia de logs no demuestra por sí sola una caída: autorun desactivado, cero candidatos y salidas tempranas también pueden no generar filas. En producción faltan actualmente los requisitos de conexión; no se puede prometer un primer análisis en el próximo ciclo. En test hay datos de elegibilidad, pero hace falta verificar el servicio desplegado y sus controles para explicar la ausencia reciente de decisiones.

### Registro de mejoras

Todas las entradas siguientes son propuestas de mejora; ninguna se marca implementada por esta auditoría. Las incidencias demostradas se distinguen de ampliaciones funcionales y verificaciones de integración.

### A12-001 · Generar automáticamente el mismo alcance que consume la UI

- **Evidencia:** `orchestratorScopesForAgent` devuelve solo el agregado para A12 y el tick no le pasa `connectionId` (`ai-runtime.ts:16001–16055,16913`). El GET filtra exactamente por tienda o `NULL` (`6919–6931`). Reproducción con dos tiendas: A12 recibe únicamente el alcance global.
- **Mejora:** programar las tiendas activas con cuentas Klaviyo pertinentes y el agregado solo donde exista una vista que lo necesite. Mantener identidad estable de organización/tienda/periodo y reparto del cupo entre tiendas.
- **Aceptación:** dos tiendas con datos distintos reciben sus propios resultados sin ejecución manual; el agregado no sustituye silenciosamente a ninguna. Probar conexión inactiva y cambio de tienda.

### A12-002 · Comprobar los requisitos de Klaviyo antes de programar o cobrar un análisis

- **Evidencia:** los candidatos generales del tick dependen de Shopify; A12 no verifica primero cuenta Klaviyo, sincronización/reportes o métrica de conversión. El estado sin caché usa cualquier integración sincronizada (`ai-runtime.ts:16467–16500,7043–7072`). Producción no tiene Klaviyo registrado.
- **Mejora:** definir elegibilidad específica de A12: integración habilitada, conexión/cuenta del alcance, sincronización y disponibilidad/capacidad del informe. Permitir una revisión limitada de medición si existe inventario pero falta rendimiento, declarándolo; no fabricar un informe vacío.
- **Aceptación:** distinguir en API/UI «conecta Klaviyo», «esperando sincronización», «falta configurar medición», «datos parciales» y «listo». Tener Shopify por sí solo no autoriza gasto de A12. Definir expresamente si Klaviyo sin Shopify admite análisis agregado.

### A12-003 · Registrar el origen automático y separar los límites manuales

- **Evidencia:** `runEmailAnalystAgent` no admite opciones de ejecución. El cron lo llama sin ellas; el runner usa `trigger:manual` y `enforceManualRefreshCap:true` por defecto (`ai-runtime.ts:5480–5501,5889,6004,13283,16913`).
- **Mejora:** propagar `trigger:cron`, digest e identidad de programación; aplicar cuota manual solo al POST manual. Mantener presupuestos y circuito de proveedor en ambos caminos.
- **Aceptación:** un tick queda etiquetado `cron`, no consume refrescos manuales y conserva correlación con su decisión. Agotar la cuota manual no bloquea el automático; un presupuesto agotado sí lo hace y se explica.

### A12-004 · Guardar una señal de actividad pertinente y contemplar el paso del tiempo

- **Evidencia:** A12 participa en la comparación de `organization_activity_digest`, pero el runner solo persiste explícitamente ese snapshot para A04 y uno específico para A08 (`ai-runtime.ts:6118,6157,6230,16734`). En test los dos éxitos recientes por tienda tienen digest nulo. El digest general incluye actividad de otros dominios (`20261113100000_ai_feed_actividad_compartida.sql:354`).
- **Mejora:** persistir una huella del contexto efectivamente leído: cuenta/tienda, reportes y su revisión, métrica de conversión, cobertura y ventana. Un cambio ajeno a email no debe obligar a recalcular. La rotación de periodo o caducidad debe poder justificar una revisión aunque no cambie el dato bruto.
- **Aceptación:** mismos datos/periodo reutilizan resultado; nuevo reporte, cambio de medición o ventana vencida se reconsideran. Un fallo al leer la huella se declara como desconocido y no como «sin actividad».

### A12-005 · Hacer verificable la cadencia y evitar que A12 quede siempre fuera del cupo

- **Evidencia:** 06:00/15:00 son pasadas compartidas; A12 tiene base de 20 horas, tope global de 15 runs y de 12 por organización por defecto (`repeatable-jobs.ts:19`, `ai-runtime.ts:15951–15956,16581–16830`). La prioridad usa alertas y orden de candidatos; no representa explícitamente el tiempo que A12 lleva esperando. No hay gate logs recientes en ninguno de los entornos.
- **Mejora:** exponer vencimiento, elegibilidad y causa de aplazamiento; añadir prioridad por espera/cobertura pendiente y recuperación del primer análisis después de sincronizar. Verificar registro real de BullMQ, cola/worker/API, secretos y flags sin inferir una caída a partir del silencio.
- **Aceptación:** carga alta y varias tiendas no posponen indefinidamente A12. La próxima revisión es una estimación condicionada, con motivo del último aplazamiento. Un tick sin candidatos o con autorun apagado deja un latido operativo consultable.

### A12-006 · Mantener el diagnóstico actualizado aunque haya propuestas sin revisar

- **Evidencia:** una salida `pending_approval` de menos de tres días frena una ejecución nueva (`ai-runtime.ts:15960,16214,16755`). `shouldRequireHumanApproval` exige aprobación para el modo configurado incluso con cero propuestas (`:789`), por lo que «pendiente» no equivale necesariamente a trabajo pendiente. GET solo devuelve el último éxito.
- **Mejora:** separar lectura del canal y ciclo de propuestas. El diagnóstico puede actualizarse conservando un buzón durable de propuestas pendientes, sus decisiones y su procedencia. No ocultar pendientes antiguas al llegar otro análisis.
- **Aceptación:** una incidencia nueva de email se refleja aunque quede una propuesta anterior por revisar; una salida sin escrituras no bloquea la cadencia. No se duplican propuestas ni se pierde su revisión.

### A12-007 · Explicar en la UI el funcionamiento y el estado real de A12

- **Evidencia:** la sección genérica promete «Aparecerá en el próximo ciclo automático», ofrece «Actualizar ahora» y solo informa de fecha/periodo aproximados; la mesa reduce la ausencia de resultado a «Sin ejecutar» (`ai-diagnostic-section.tsx:829–875`, `consultant-desk.tsx:1278`). El dashboard de Klaviyo muestra la lectura de A02 y usa A12 principalmente como aviso de propuestas (`client-klaviyo.tsx:342,727`).
- **Mejora:** una ficha breve «Analista de email»: qué revisa, tienda/cuenta, periodo efectivo, fecha del análisis y de las fuentes, automático/manual, último resultado, ejecución en curso, siguiente revisión estimada y motivo de bloqueo. Dar acceso al informe completo y a sus propuestas desde todas las superficies. Identificar A02, A12, A26 y A28 por función comprensible. Cancelar o descartar respuestas de GET/POST cuyo alcance haya cambiado: la sección genérica no protege actualmente esos setters frente a una respuesta anterior tardía.
- **Aceptación:** estados visibles y accesibles para desconectado, sincronizando, pendiente, en curso, actualizado, antiguo, parcial, error y pausado. No confundir un error de GET con «nunca ejecutado». Actualizar estado al finalizar el trabajo de fondo, sin tener que abandonar la página. Una respuesta lenta de la tienda anterior no sobrescribe el análisis de la nueva ni habilita su revisión bajo otro alcance.

### A12-008 · Deduplicar ejecuciones y recuperar el resultado tras una desconexión

- **Evidencia:** el POST es síncrono; A12 crea un UUID nuevo por llamada y no expone una clave de petición (`server.ts:9992`, `ai-runtime.ts:6002–6024,6100`). Existe reserva de presupuesto, pero su cuota manual sigue la rama de contar runs y comprobar el límite; la reserva atómica de refrescos solo incluye A04/A05/A06/A08 (`ai-runtime.ts:5594–5650`). Dos pantallas pueden superar concurrentemente la comprobación y lanzar trabajo equivalente.
- **Mejora:** reutilizar el mecanismo durable del proyecto para una ejecución por organización/tienda/ventana/revisión, con clave idempotente, estado y resultado consultables. Reservar atómicamente el cupo de A12. Aplicar exclusión también entre cron y manual; permitir reintentar o recuperar sin pagar otra generación ya completada.
- **Aceptación:** doble clic, dos usuarios, reintento HTTP, cierre de pestaña y solapamiento con tick no duplican generación ni propuestas; dos peticiones por el último cupo disponible no lo consumen ambas. Probar recuperación tras fallo entre guardado del output y cierre del run. Mostrar progreso real sin inventar porcentajes.

### A12-009 · Unificar las fechas del análisis, las tools y las pantallas

- **Evidencia:** A12 resta 30 días al instante actual y convierte ambas fronteras a fechas. El SQL incluye el día final; el periodo anterior termina en la misma fecha donde empieza el actual (`ai-runtime.ts:13297–13328`). Esto produce 31 fechas inclusivas y un día compartido. Las tools usan otro helper que sí deriva un anterior sin solapamiento. Las rutas A12 no leen `days`, aunque varias vistas lo envían.
- **Mejora:** un contrato canónico de ventana, zona horaria y corte de datos. O mantener A12 fijo y mostrar claramente su periodo independiente, o admitir las ventanas permitidas de UI con claves de caché explícitas. Usar la misma función para contexto, tools y API de métricas.
- **Aceptación:** exactamente el número anunciado de días, periodos disjuntos y equivalentes, cobertura de hoy declarada y casos de cambio de mes/año y horario. Cambiar un selector no debe presentar un diagnóstico de 30 días como si perteneciera a otro periodo.

### A12-010 · Comparar intervalos realmente cubiertos por los reportes

- **Evidencia:** la RPC vigente selecciona filas por `rv.period_start`, agrupa por mes y elige el intervalo más ancho sin exigir que su final pertenezca a la ventana (`20261115860000_klaviyo_email_report_fix.sql:46–97`; misma definición en ambas bases). Puede excluir un mes solapado, escoger un reporte que excede el periodo anterior y descartar ventanas rodantes útiles. Un agregado mensual no permite reconstruir días arbitrarios.
- **Mejora:** decidir la granularidad que el producto garantiza. Con la captura actual, comparar periodos mensuales compatibles y declarar cobertura real; si se necesitan 7/30/90 días exactos, capturar y conservar ese detalle antes de prometerlo. Conservar identificadores de reportes, intervalos y fecha de observación; no prorratear ingresos ni únicos suponiendo distribución uniforme.
- **Aceptación:** fixtures con mes completo, rodante de siete días, backfill, huecos y revisiones no suman dos veces ni comparan coberturas distintas. Una reproducción SQL sintética del selector actual eligió para «anterior hasta 19/09» un reporte que terminaba el 30/09; el caso debe quedar cubierto.

### A12-011 · Preservar cuenta, métrica, canal e identidad de mensaje al agregar

- **Evidencia:** `picked` distingue mes/tipo/ID externo/mensaje, pero no cuenta ni `metric_id`; los joins finales resuelven campañas/flows por organización e ID externo, eligiendo la fila más reciente (`20261115860000_klaviyo_email_report_fix.sql:46–168`). No hay filtro explícito de canal en la función. El sync sí conserva cuenta en el report run y métrica en cada valor (`klaviyo-sync.ts:1600–1636`).
- **Mejora:** particionar por la identidad completa de origen, filtrar cuentas/conexiones elegibles y métrica de conversión vigente o versión histórica explícita. Resolver metadatos en la misma cuenta. Garantizar canal email antes de atribuirle datos; mantener el tratamiento de variantes A/B separado del total.
- **Aceptación:** cuentas con IDs externos repetidos, reconexión, cambio de métrica, email/SMS y variantes no se mezclan ni sustituyen entre sí. Un filtro por tienda no permite adjuntar el nombre/asunto de una entidad de otra tienda de la misma organización. Verificar RLS con dos organizaciones.

### A12-012 · No sumar ni comparar ingresos de monedas desconocidas o incompatibles

- **Evidencia:** los valores sincronizados conservan `currency_code`, pero el RPC de informe no lo devuelve y el resumidor suma revenue. A12 y sus tools no pasan por `redactKlaviyoRevenue`, que sí existe para otras lecturas (`klaviyo-sync.ts:1623`, `klaviyo.ts:919–944`, `ai-runtime.ts:13167,13352,3179`).
- **Mejora:** transportar moneda/cobertura por cuenta y periodo. Solo agregar ingresos compatibles; omitir importes o separar monedas cuando falte verificación. Mantener las métricas no monetarias, evitando ordenar por ingresos incompatibles.
- **Aceptación:** EUR+USD, moneda ausente y cambio de moneda no producen un total monetario aparente ni rankings engañosos. API, diagnóstico y gráficos usan las mismas unidades. No copiar el gate Shopify como sustituto de comprobar Klaviyo.

### A12-013 · Conservar la diferencia entre cero, desconocido y dato no soportado

- **Evidencia:** la RPC hace `coalesce(...,0)`; `num`/`addRow` vuelven a convertir nulos en cero (`klaviyo.ts:906–921`). Cuando la métrica elegida no soporta valores económicos, el sync elimina estadísticas de conversión/valor y registra un reporte `partial` (`klaviyo-sync.ts:1580–1647`), estado que A12 no incorpora al resumen. Reproducción: 100 entregados con clics e ingresos nulos produce clic 0, ingresos 0 y conversión 0.
- **Mejora:** DTO con disponibilidad por métrica y fuente: observado, cero confirmado, ausente, parcial o no soportado. Separar ausencia de filas de ausencia de actividad. Agregar solo métricas con cobertura conocida, explicando denominadores incompletos.
- **Aceptación:** reporte parcial, métrica sin valor, periodo vacío y cero real generan estados distintos. No proponer «arreglar una conversión del 0 %» por estadísticas que nunca se obtuvieron.

### A12-014 · No certificar el catálogo por la ausencia de un mensaje de error

- **Evidencia:** `loadKlaviyoCoverage` ignora el error RPC y concluye «El catálogo está al día: si un email no aparece, es que no existe» cuando `recursos_no_traidos` es falsy, aunque no haya sync, esté viejo o fallido (`ai-runtime.ts:15694–15717`). El helper solo proyecta una parte de la salud disponible; en agregado el RPC de salud selecciona el último sync, no la cobertura de cada cuenta.
- **Mejora:** evaluar cuenta/conexión, última sincronización completa, edad, recursos esperados y fallos. Separar cobertura de inventario, contenido y reportes. Un éxito reciente de una cuenta no valida otra. La ausencia de una entidad solo justifica una hipótesis hasta verificar el inventario completo.
- **Aceptación:** sin sync, timeout, sync en curso/fallido, parcial sin texto de error y varias cuentas con edades distintas no se etiquetan como catálogo completo. No recomendar crear un flow supuestamente inexistente con cobertura desconocida.

### A12-015 · Propagar fallos de fuentes sin convertirlos en un diagnóstico normal

- **Evidencia:** si falla el informe actual, el constructor devuelve solo un bloque `sin_datos` y aun así continúa el runner; se pierden los bloques ya recuperados de cobertura y A26. El fallo del anterior se convierte en ausencia genérica y el de tracking global se omite (`ai-runtime.ts:13343–13401`).
- **Mejora:** un resultado tipado por fuente con estado, periodo, fecha, cobertura y código de fallo sanitizado. Interrumpir o producir diagnóstico limitado explícito según una política de suficiencia. Conservar las fuentes sanas y sus límites, sin tratar un timeout como cuenta sin actividad.
- **Aceptación:** fallos independientes de actual, anterior, salud, tracking y especialista permiten identificar qué conclusiones están autorizadas. No hay propuestas estructurales apoyadas en fuentes fallidas ni mensajes internos de infraestructura en el texto del cliente.

### A12-016 · Dar una única respuesta sobre la frescura del análisis y de sus datos

- **Evidencia:** GET calcula `stale`, pero solo pasa ese resultado al envelope para A02/A04/A06/A08. A12 recibe el valor por defecto `fresh`, incluso con fecha de validez vencida (`ai-runtime.ts:6970–7030,7258`). La sección UI consulta el envelope. Reproducción con fecha 01/09: `status:fresh` y `validUntil:02/09`.
- **Mejora:** una política compartida para caché, envelope y UI, alineada con la cadencia efectiva. Separar edad del análisis y de cada fuente; una generación de hoy sobre reportes antiguos no tiene datos frescos. Incorporar cambios relevantes posteriores a la generación.
- **Aceptación:** ninguna vista anuncia fresco y antiguo a la vez. Probar cadencia configurada, fecha inválida, resultado viejo sin actividad, nuevo reporte y fuente antigua en run reciente. Mantener visible el histórico útil con su advertencia.

### A12-017 · Seleccionar casos importantes además de los que más facturan

- **Evidencia:** el resumen compartido ordena por revenue y A12 recibe las primeras 15 campañas y 25 flows (`klaviyo.ts:1021–1042`, `ai-runtime.ts:13148`). Los contadores de truncamiento existen, pero una campaña con quejas elevadas o un flow sin medición puede quedar fuera.
- **Mejora:** muestra estratificada por ingresos compatibles, deterioro, entregabilidad, volumen suficiente y lagunas de medición, con identidad y motivo de selección. Comparar entidades presentes en ambos periodos y recuperar detalles bajo demanda.
- **Aceptación:** una entidad de ingresos bajos con riesgo relevante aparece junto a los mejores resultados. La IA conoce total elegible, muestra, cobertura y lo no revisado; nunca afirma haber auditado todo el inventario a partir del top.

### A12-018 · Presupuestar el contexto para que lleguen completas las evidencias esenciales

- **Evidencia:** el bloque actual serializa todos los campos de las 15 campañas/25 flows y coloca límites/granularidad después de los arrays. El serializador limita a 12.000 caracteres por bloque y 48.000 en total (`untrusted-context.ts:2–3,39–66`). El runner también carga actividad, restricciones y playbooks F3–F11 (`ai-runtime.ts:6197–6227`). Reproducción sintética: bloque de 28.268 caracteres truncado antes de `flows_total` y `granularity`.
- **Mejora:** proyección compacta con contrato de unidades/periodo/cobertura primero, particiones estructuradas acotadas y un presupuesto global específico de A12. Cargar solo contexto operativo útil para email; evitar consultar F9/F11 para después perderlos. Medir tokens/coste/latencia y cachear lecturas por revisión.
- **Aceptación:** las restricciones, límites, fuente y fechas sobreviven a cardinalidad alta. No cortar JSON a mitad de una entidad como contexto normal. Las consultas bajo demanda amplían evidencia sin duplicar el bloque inicial.

### A12-019 · Compartir una capa de lectura completa y acotada entre UI, contexto y tools

- **Evidencia:** se reutiliza el resumidor, pero contexto A12, tools y `getKlaviyoEmailReport` mantienen consultas/ventanas y estados distintos. La tool de una entidad primero lee todo el informe, luego filtra en Node y corta a 12 filas (`ai-runtime.ts:3231–3285`). A12 consulta tracking global incluso para una tienda aunque luego lo descarte (`13330,13374`).
- **Mejora:** servicio canónico de lectura con fechas, scope, identidad, cobertura, moneda y errores compartidos. Filtrar entidad/tipo/cuenta en la consulta y devolver orden/paginación/cobertura explícitos. No consultar tracking global si el alcance no permite usarlo. Reutilizar dentro del run resultados equivalentes.
- **Aceptación:** paridad de cifras y estados entre API/UI/A12; pruebas que detecten falta de filtros y llamadas redundantes. El coste de profundizar en una campaña no crece con todo el catálogo. Límites se aplican en la base y se declaran.

### A12-020 · Hacer que la herramienta de entregabilidad mida el periodo solicitado

- **Evidencia:** `klaviyo_deliverability_health` devuelve salud de configuración/inventario y tracking; no calcula en esa llamada rebotes, bajas o spam del periodo (`ai-runtime.ts:3290–3341`). Además consulta dos veces salud, directamente y a través de `loadKlaviyoCoverage`.
- **Mejora:** mantener herramientas pequeñas, pero hacer explícito si responden sobre configuración o resultados de entrega. Incorporar numeradores, denominadores, periodo y cobertura para entregabilidad, reutilizando el informe y una sola consulta de salud.
- **Aceptación:** un catálogo bien configurado con rebotes altos no se diagnostica como entregabilidad sana. El tracking web no se presenta como prueba de llegada a bandeja. Si no hay métricas de entrega disponibles, la respuesta lo declara.

### A12-021 · Vincular las conclusiones a evidencia verificable y muestras suficientes

- **Evidencia:** A12 usa el contrato genérico de hallazgos/recomendaciones. El contexto lleva cifras e IDs de entidad, pero no una cadena obligatoria de referencias a reporte/métrica/versión/periodo; no existe un gate específico de A12 que valide cada afirmación numérica. El prompt base contiene benchmarks generales y propone interpretar asuntos/aperturas (`20260829140000_ai_a12_analista_email.sql:39`).
- **Mejora:** hallazgos tipados con entidad, fuente, periodo, valor, unidad, denominador, comparación y confianza. Validar citas/cifras en servidor; separar hechos de hipótesis. Tratar porcentajes como ratios con escala explícita, y destinatarios/únicos agregados como mediciones por mensaje/periodo, sin afirmar personas distintas de toda la cuenta. Referencias metodológicas deben tener procedencia y alcance; aperturas/CTOR y cambios de asunto no prueban causalidad ni ventas incrementales.
- **Aceptación:** muestra pequeña, cero denominador, conversión sin valor, cambio de audiencia y benchmarks no aplicables no producen certezas ni tareas injustificadas. El usuario puede abrir la entidad y la evidencia que respaldan cada conclusión.

### A12-022 · Seleccionar el A26 pertinente y vigente, conservando sus límites

- **Evidencia:** A12 pide hasta siete resúmenes entre varios agentes y después busca A26. La llamada no fija `maxAgeDaysByCode` ni restringe de antemano a A26 (`ai-runtime.ts:10821–10876,13340,13400`). Puede quedar fuera por otros especialistas recientes o entrar un resumen antiguo. La proyección compacta no enlaza necesariamente cada hallazgo de contenido al mensaje que explica el rendimiento.
- **Mejora:** recuperar directamente A26 aprobado/publicado del mismo alcance, con caducidad y referencias de mensaje/plantilla/versión/fecha. Una revisión obsoleta puede servir de historial, identificada como tal. La ausencia o error de A26 no debe convertirse en ausencia de problemas de copy.
- **Aceptación:** A26 aparece aunque haya siete especialistas más recientes; se descarta o etiqueta cuando está vencido o el email cambió. No convertir una observación visual en explicación causal del resultado agregado.

### A12-023 · Conectar una mejora de rendimiento con el trabajo editorial y su seguimiento

- **Evidencia:** A11/A27/A09 ya pueden consumir resúmenes de especialistas; A11 limita antigüedad de A12 a 60 días y A09 a 30, pero el resumen compartido es principalmente texto (`ai-runtime.ts:10821,11221,19171`, `consultant-specialist-context.ts:6`, `marketing-peer-history.ts`). No demuestra qué recomendación concreta originó una variante ni qué se midió después.
- **Mejora funcional:** «Revisar con el copiloto», «Preparar variante en el Estudio» y «Llevar al plan de mailing» con contexto tipado de entidad, hipótesis, KPI, evidencia, tienda y versión. A11 diseña, A27 decide secuencia y A28 arquitectura; A12 conserva evaluación/medición. Vincular borrador aprobado, envío sincronizado y resultado posterior cuando exista evidencia suficiente.
- **Aceptación:** una mejora llega al especialista con el alcance y datos correctos, sin volver a ejecutar agentes por abrirla. No se publica ni envía nada por el handoff. El seguimiento diferencia variante creada, aplicada, enviada y resultado observado, sin atribuir mejora causal sin experimento.

### A12-024 · Evitar propuestas duplicadas y respetar la responsabilidad de A28

- **Evidencia:** el prompt original permite proponer crear flows y pide no duplicar backlog; el constructor A12 no carga un inventario específico de flows/tareas abiertas del canal. El histórico común recoge principalmente propuestas previas del propio agente; la materialización deduplica por título exacto normalizado y por identidad dentro del mismo output (`ai-runtime.ts:loadPriorProposalHistory,23382–23429,23850`). Esto no identifica la misma necesidad expresada por A26/A28 con otro título.
- **Mejora:** recuperar backlog y arquitectura aprobada del alcance antes de proponer. Clave de oportunidad por cuenta/entidad/tipo de intervención, conservando propuesta/tarea existente y resolución. A12 documenta el problema y deriva a A28 el diseño de automatización; no crea un segundo plan contradictorio.
- **Aceptación:** la misma incidencia detectada por A12/A26/A28 no genera tres tareas, tampoco con aprobaciones concurrentes de outputs distintos. Tareas cerradas o descartadas requieren evidencia nueva y una razón antes de reaparecer. No afirmar ausencia de flow sin inventario fiable.

### A12-025 · Hacer coherente y recuperable la revisión de propuestas

- **Evidencia:** la sección genérica presenta controles de decisión sin conocer por sí misma el rol; el backend limita la aprobación según rol y asignación de consultor. Algunas vistas ocultan propuestas al cliente con consultor y otras montan la sección completa (`ai-diagnostic-section.tsx:786,928`, `client-pulse.tsx:1249`, `ai-runtime.ts:approvalCandidate,decideAgentOutput`). La materialización conserva claims, índices y recibos, pero una propuesta de A12 antigua no revalida sus métricas antes de aprobar.
- **Mejora:** la API debe exponer quién puede revisar y la UI consumirlo. Mostrar por propuesta aprobada/rechazada/ya existente, tarea o handoff resultante y explicación de decisiones sin efecto. Revalidar evidencia/entidad cuando haya caducado o cambiado y permitir revisión explícita del cambio.
- **Aceptación:** cliente con/sin consultor, colaborador y consultor asignado ven controles coherentes con backend. Un fallo parcial se recupera sin duplicar; nunca se anuncia «tarea creada» si solo se encontró una existente. Se puede abrir el resultado exacto desde el diagnóstico.

### A12-026 · Alinear móvil con la tienda y las capacidades de web

- **Evidencia:** `TodoView` aplica `withStore` a métricas de Shopify/Klaviyo, pero A12 usa la URL global sin tienda (`apps/mobile/components/views.tsx:163–180`). Muestra propuestas con un diagnóstico de alcance distinto al de las métricas del mismo panel.
- **Mejora:** transportar organización/tienda al GET y a toda revisión/handoff. Compartir el contrato de estado y evidencia; ofrecer acceso al informe o una representación resumida con destino claro. Si se quiere una vista de organización, debe elegirse y etiquetarse explícitamente.
- **Aceptación:** cambio entre dos tiendas no mezcla propuestas globales con KPIs locales; recarga, desconexión y posterior aprobación mantienen identidad y estado. Web y móvil explican el mismo análisis y responsable.

### A12-027 · Añadir regresiones específicas de A12 y evaluar recorridos completos

- **Evidencia:** pasan las 45 pruebas focalizadas indicadas abajo. Las de ventanas cubren el helper de tools; no ejercitan la ventana inicial del runner, SQL real, trigger cron, cron por tienda, errores de fuentes ni estados de UI. Las reproducciones de esta auditoría detectaron huecos pese al verde.
- **Mejora:** integrar pruebas de runner/ruta con clientes simulados que fallen si faltan organización/tienda/cuenta, además de fixtures SQL y aislamiento RLS en test. E2E por rol/canal: sincronización → elegibilidad → cron → diagnóstico → revisión → tarea/brief → medición posterior. Evaluaciones de calidad con hechos etiquetados y abstención ante evidencia insuficiente.
- **Aceptación:** cubrir las 29 mejoras, especialmente ventanas, nulabilidad, multicuentas/divisas, partial sync, cupos, concurrencia y caducidad. Medir afirmaciones soportadas, duplicados, cobertura, latencia y coste. No presentar una prueba de esquema o una suite local como calidad semántica o E2E desplegado.

### A12-028 · Actualizar catálogo y observabilidad con evidencias de despliegue

- **Evidencia:** `REVISION_AGENTES.md:350–368` declara cierre local y deja migración v4 como externa; esta pasada confirma v4 en ambas bases y nuevas incidencias. El horario/cadencia se describe en código, pero el usuario no tiene una explicación del último aplazamiento. Los últimos gate logs son antiguos y el código permite salidas tempranas sin filas por agente.
- **Mejora:** actualizar la ficha maestra y una única política operativa que reutilicen UI/admin/documentación: finalidad, disparadores, requisitos, alcance, periodo, herramientas efectivas, modelo real, controles y destinos. Separar configuración DB, código local, versión API/web/worker desplegada y validación con datos. Guardar latido de cada tick, causas de bloqueo y vínculo tick/run/output sin contenido sensible.
- **Aceptación:** un operador puede explicar por qué una tienda no tiene A12 y qué acción corresponde, sin consultar código ni prometer un cron inexistente. Todo cierre enumera evidencias verificadas y límites concretos; el hecho de tener v4 en DB no certifica el despliegue.

### A12-029 · Aplicar el alcance de tienda también al contexto transversal

- **Evidencia:** el runner entrega `storeId` a las fuentes directas, restricciones y actividad, pero llama a `loadDecisionPlaybookContextBlocks` sin `storeId` para A12 (`ai-runtime.ts:6210–6221`). El loader sí dispone de filtrado específico cuando recibe `options.storeId`; sin él puede cargar casos/resultados de otras tiendas de la organización (`decision-playbook-chat-context.ts:937–983,1176,1361`).
- **Mejora:** transmitir el alcance en toda fuente transversal y seleccionar únicamente contexto global aplicable o de la tienda actual, con su procedencia. Autorizar pertenencia a la organización antes de resolver la tienda mediante service role; actualmente A12 resuelve primero y el runner/GET común comprueba membresía después (`ai-runtime.ts:13289,13419,5895,6900`).
- **Aceptación:** las métricas de la tienda A no reciben casos F3/F9/F11 o recomendaciones de la B como si fueran locales. Organización ajena, conexión ajena/inactiva y fallos de resolución no devuelven metadatos ni amplían el ámbito. Probar el snapshot completo, además de los parámetros de las tools.

### Verificación y límites de esta auditoría de A12

- **45/45 pruebas locales aprobadas:** desde `apps/api`, `npx tsx --test --test-force-exit src/klaviyo-performance-tools.test.ts src/klaviyo-email-report-summary.test.ts src/marketing-peer-history.test.ts src/marketing-store-scope.test.ts src/ai-diagnostic-activity-gate.test.ts src/ai-runtime-envelope.test.ts`.
- **Reproducciones adicionales, con datos sintéticos:** alcance automático global con dos tiendas; envelope antiguo marcado `fresh`; nulos convertidos en ceros y ausencia de filas convertida en totales cero; truncamiento de un bloque de 28.268 caracteres antes de sus contadores de cobertura/granularidad. No se llamó al modelo ni se persistieron resultados de agente.
- **SQL sintético de solo lectura en test:** CTE `VALUES`, sin tablas de clientes ni escrituras, reprodujo el selector mensual de la función vigente. Para ventanas «19/09–19/10» y «20/08–19/09» obtuvo 31 días inclusivos en ambas y un reporte anterior hasta 30/09, fuera de la ventana solicitada. Esto demuestra el defecto de selección, no cuantifica su impacto en datos reales.
- **Consultas remotas de solo lectura en ambos entornos:** versiones/herramientas, override de cadencia, conteos/fechas/estados de runs y gates, conteos de conexiones y definición SQL del informe. Se verificó que la corrección local vigente del informe coincide en ambas bases; no se inspeccionaron contenidos de emails, respuestas de clientes ni credenciales.
- **Revisión estática de UI web/móvil:** rutas, componentes, botones, estados, alcance y consumidores. No se realizó un recorrido visual autenticado, una ejecución real del worker, pruebas con proveedor, carga, concurrencia Postgres ni E2E de aprobaciones; esos puntos tienen aceptación explícita en el registro.
- **Alcance de implementación:** código local en `apps/api/src/ai-runtime.ts`, `apps/api/src/server.ts`, las superficies web/móvil relacionadas y los tipos DB; migraciones A12 aplicadas en test y producción. No se desplegó API/web/worker ni se ejecutó A12 con datos reales. Los estados parciales/pendientes de la tabla anterior requieren integración funcional antes de cerrar la auditoría.

## A13 · Operativa Shopify orientada a Mi Camino

**Auditoría: 19 de octubre de 2026. Estado: implementación principal completada; migraciones A13 aplicadas en test y producción.** Se ha seguido el recorrido API → contexto → modelo/contrato → caché → UI → aprobación → tarea/hito, además del orquestador y los lectores de A19. Los cierres de scheduler, buzón histórico y observabilidad de despliegue quedan indicados en la validación; esta pasada no desplegó API/web/worker.

### Función que debe cumplir y relación con los demás agentes

**Criterio solicitado por el propietario:** A13 analiza el estado de la tienda y prioriza trabajo operativo que contribuya al objetivo vigente de Mi Camino. Debe conocer meta, unidad, fecha, progreso verificable, hitos, restricciones y trabajo ya comprometido. Cada propuesta debe explicar el problema observado, su relación con la meta y cómo comprobar después si se ejecutó y qué ocurrió. Completar una tarea no demuestra por sí solo impacto causal.

La fuente de la meta debe seguir siendo `strategic_plans.goal`; los objetivos por métrica/hito ya existen en `organization_metric_targets`. La medición determinista de progreso ya tiene un helper en `camino-goal-progress.ts` y A19 lo utiliza. A13 debe reutilizar esas fuentes, conservando tienda, moneda, periodo y versión; no crear otra pantalla de objetivos ni permitir al modelo inventar o modificar la meta. Sin Camino aprobado puede señalar mantenimiento operativo justificado, declarando que no puede vincularlo a una meta aprobada.

| Agente / módulo | Responsabilidad que debe conservarse | Relación de A13 |
|---|---|---|
| A02 · Monitor | Lectura amplia del negocio y señales por área. | A13 concreta problemas operativos de Shopify con evidencia suficiente. |
| A13 · Operativa Shopify | Diagnóstico operativo y propuestas de trabajo alineadas con la meta de la tienda. | Explica contribución, prioridad, entrega y siguiente comprobación. |
| A19 / Mi Camino | Plan aprobado, objetivos, hitos, seguimiento y propuestas de revisión estratégica. | A13 lee ese plan; deriva contradicciones o cambios estratégicos a su revisión. |
| A04 / A17 / A18 | Selección diaria, planificación semanal e iniciativas mensuales. | A13 aporta oportunidades verificadas y respeta capacidad, dependencias y backlog. |
| A06 | Riesgo de stock y reposición con sus controles específicos. | A13 reutiliza sus señales; evita abrir otra reposición para el mismo producto. |
| A20 / A21 / A22 | Retención, adquisición/conversión y postventa. | A13 coordina el trabajo operativo sin sustituir sus análisis ni repetir sus propuestas. |

**Situación actual:** A13 carga directamente ventas actuales/anteriores, finanzas actuales, stock, hasta cinco productos de una muestra de riesgo, tareas abiertas, nombres/estados de fases y alertas. No carga directamente `goal`, objetivos vigentes, hitos, fechas de hitos ni progreso calculado. El contexto transversal puede contener una declaración de objetivo de otros motores, pero no sustituye la lectura versionada del Camino de la tienda; además llega sin el filtro de tienda específico de A13. A19 sí puede recuperar un resumen aprobado de A13, pero el resumen pierde precisamente las propuestas que constituyen su salida principal.

### Disparadores y superficies comprobados

| Entrada | Comportamiento actual | Límite observado |
|---|---|---|
| Worker | BullMQ registra `0 6,15 * * *`, `Europe/Madrid`; llama al tick interno autenticado. | Son dos oportunidades de evaluación, no dos ejecuciones garantizadas de A13. No se comprobó un worker desplegado en ejecución. |
| Selección automática | A13 considera agregado y tiendas activas con conexión Shopify `connected`/`syncing` y `last_sync_at`; mínimo base de 20 h, escalable desde plataforma. | Cupos compartidos de 12 runs/org/día y 15 por tick por defecto; no hay prioridad específica por espera o riesgo para la meta de A13. |
| Ejecución desde tick | Pasa `trigger:cron`, `enforceManualRefreshCap:false` y `connectionId`. | No pasa a A13 el digest calculado por el tick; el runner tampoco calcula uno específico. |
| GET `/ai/operativa-shopify` | Lee último éxito de ventana fija de 30 días y scope exacto; no llama al modelo. | No distingue todos los estados de conexión, fuentes, pausa, ejecución y bloqueo; la frescura del envelope puede contradecir el campo `stale`. |
| POST `/ai/operativa-shopify-run` | Ejecución síncrona manual; acepta `connectionId`. | `days` se ignora. El frontend envía `Idempotency-Key`, pero esta ruta no lo transmite al runner. |
| Dashboard / módulo Shopify | `ClientShopify` consulta A13 solo si `asConsultant`; presenta sus propuestas en la cola de trabajo. | No muestra un diagnóstico A13 completo. La lectura de operaciones vecina sigue siendo organizativa. |
| Cliente sin consultor | La API común permite decisiones de owner/manager según su política vigente. | La UI Shopify no consulta A13 para ese cliente, aunque el cron puede seguir gastando en el agente. |
| Aprobación | Materializa tareas internas y puede enlazarlas a un hito; no modifica productos, precios, descuentos o configuración de Shopify. | El vínculo estratégico se resuelve con datos insuficientes y un fallback al hito actual. |

Referencias: `apps/worker/src/repeatable-jobs.ts:17`, `apps/worker/src/worker.ts:161,351`, `apps/api/src/server.ts:10069–10252`, `apps/api/src/ai-runtime.ts:14098–14246,16165–16289,16840–17126,17209`, `apps/api/src/agent-schedule.ts:29`, `apps/web/src/app/dashboard/client-shopify.tsx:174,229,529–553`.

### Configuración y estado remoto, solo lectura

Consultas realizadas el **19 de octubre de 2026, entre 10:55 y 11:01 UTC**. No se leyeron cuerpos de pedidos, notas privadas, salidas de agentes ni contenido de clientes; se consultaron metadatos, configuración y definiciones de funciones/triggers. La consulta del prompt corresponde a configuración del agente.

| Comprobación | Test · `kopcblejsxpkxoykldyh` | Producción · `cthjwpeygpzwdmjkxeqa` |
|---|---|---|
| Definición / versión activa | Activa; agente v2 / prompt v2 | Igual |
| Modelo de la versión | `claude-sonnet-5` | Igual; no certifica el modelo efectivo de cada run |
| Herramientas declaradas | Solo `search_knowledge` | Igual |
| Aprobación | `required_before_publish` | Igual |
| Override de cadencia A13 | Sin fila en `platform_ai_agent_settings` | Igual |
| Runs A13 últimos 30 días | 4 éxitos manuales y 1 fallo cron; un éxito con scope de tienda | 7 fallos cron, todos agregados; ningún éxito en la ventana |
| Último run A13 | 12/10/2026 | 22/09/2026 |
| Digest nulo en runs de la ventana | 3 de los 4 éxitos y el fallo | Los 7 fallos |
| Truncamiento de contexto | 3 de los 4 éxitos lo registran | Sin éxitos recientes que evaluar |
| Identidad de despliegue en éxitos recientes | Ninguno de los cuatro tiene `deployment_version` | Sin éxitos recientes |
| Gates A13 últimos siete días | 0 | 0 |
| Último gate de cualquier agente | 25/09/2026 | 22/09/2026 |
| Conexiones Shopify | Una conectada con sincronización previa; dos pendientes de eliminación | Una en error, con sincronización histórica |
| Migraciones A13 en el historial | `20260901230000_ai_a13_operativa_shopify`, `20261115450000_ai_a13_store_scoped_operational_context` | Ambas registradas también |
| `alerts.store_id` y objetivos por hito | Existen | Existen |
| Triggers del enlace tarea/hito | Comprobaciones de misma organización y compatibilidad de tienda | Mismas definiciones |

Las RPC consultadas tienen las mismas definiciones en ambos proyectos: `shopify_sales_summary` de cuatro argumentos, MD5 `08639d55b75cd0382cf7014ea0b3d771`; `shopify_financial_summary`, `62f44515dd1ee277944a0e2ae006b666`; `shopify_stock_risk_products`, `56adda2a1d1a81560b9b5591c75ff9f9`; `shopify_stock_summary` de tres argumentos, `316905a473c7d36be589dfb5857f2df4`. Se contrastaron mediante `pg_get_functiondef`; no se infirió el estado remoto a partir del nombre de los ficheros locales.

**Interpretación operativa:** A13 está configurado, pero no se ha certificado un recorrido automático actual. La ausencia de gates no prueba por sí sola una caída: autorun apagado, cero candidatos y salidas tempranas también pueden no persistir decisiones. En producción el estado actual de Shopify impide prometer un próximo análisis automático. Los cuatro éxitos históricos de test incluyen metadatos de tokens/latencia nulos o cero en alguna fila; esa muestra no permite afirmar un coste ni una latencia representativos.

### Registro de mejoras de A13

Todas las entradas son mejoras propuestas a partir de esta auditoría. Ninguna se marca implementada aquí. Las garantías ya comprobadas —GET de lectura, scope estricto cuando se proporciona conexión, separación de tareas sin tienda, presupuestos, trazas y triggers de organización/tienda— deben conservarse al abordarlas.

### A13-001 · Leer el objetivo y el Camino vigente mediante un contexto canónico

- **Evidencia:** `loadPlanPhasesBlock` selecciona solo `id, version` y nombres/estados/posición de fases; mezcla `draft`/`active` y escoge la versión mayor. Un borrador nuevo puede desplazar al plan aprobado. A13 no lee `goal`, `organization_metric_targets` ni los hitos (`ai-runtime.ts:13928–13970,14206`). A19 ya carga esas fuentes y calcula progreso (`9690–9794`).
- **Mejora:** un loader de la misma organización/tienda con plan activo aprobado, ID/versión, meta/unidad/moneda/plazo, objetivos vigentes, hito actual, próximos hitos, criterios de éxito y progreso calculado. Distinguir plan activo, borrador, finalizado y ausencia de plan; conservar un borrador solo como propuesta identificada. Reutilizar las reglas de medición vigentes.
- **Aceptación:** dos tiendas y un borrador posterior no cambian la meta de referencia equivocadamente. A13 identifica la versión leída, la brecha verificable y lo desconocido; sin plan aprobado declara mantenimiento operativo sin inventar un objetivo.

### A13-002 · Priorizar el trabajo por su contribución al objetivo y su factibilidad

- **Evidencia:** el encargo actual pide revisar los últimos 30 días y proponer tareas; no exige justificar contribución a meta/hito, dependencias o capacidad (`ai-runtime.ts:14124`). El prompt permite propuestas amplias de mejora de Shopify sin un contrato estratégico medible.
- **Mejora:** distinguir mantenimiento urgente, eliminación de un bloqueo y avance hacia un objetivo; explicar la relación con la meta y priorizar evidencia, urgencia, dependencia, esfuerzo y capacidad conocida. Contrastar señales de A02 y los especialistas sin repetir su trabajo. Los cambios de objetivo o ruta se proponen para revisión de A19/Mi Camino, con la evidencia que los motiva.
- **Aceptación:** ante metas de beneficio, crecimiento o disponibilidad distintas, las prioridades se ajustan cuando los datos lo justifican. No perseguir facturación sacrificando una restricción de margen ni dejar un incidente urgente sin tratar porque no encaje en el hito. No cuantificar impacto sin soporte.

### A13-003 · Conservar la identidad de fase/hito y eliminar enlaces estratégicos por defecto

- **Evidencia:** el prompt v2 exige `phase`, pero `agentProposedWriteSchema` y su JSON Schema no incluyen ese campo; el parseo lo elimina (`packages/ai/src/index.ts:264–335`). A13 solo recibe nombres de fases y no IDs de hito. `shouldFallbackToCurrentMilestone(A13)` devuelve `true`, y la aprobación enlaza al hito actual si falta uno explícito (`agent-task-delivery.ts:64`, `ai-runtime.ts:24198`). Reproducción sintética confirmada.
- **Mejora:** propuesta tipada con referencia a plan/versión, hito o tarea libre y una justificación de alineación. Resolver IDs server-side contra el contexto autorizado y conservarlos en la propuesta y tarea. `null` debe representar una tarea libre real; no sustituirlo silenciosamente por el hito actual.
- **Aceptación:** una tarea libre sigue libre; una propuesta para otro hito conserva ese hito; nombres de fase repetidos no crean ambigüedad. El vínculo visible en Mi Camino corresponde a la intención revisada, sin asignaciones inferidas por mera cercanía.

### A13-004 · Entregar a A19 un resumen útil y recibir su seguimiento vigente

- **Evidencia:** A19 incluye especialistas de la misma tienda, entre ellos A13, pero el resumidor genérico solo conserva `answer/findings/recommendations/sources/warnings`; omite las propuestas (`consultant-specialist-context.ts:169–240`, `ai-runtime.ts:9670,9874`). A13 usa contrato lean: `answer` puede ser solo «1 propuesta(s) de trabajo para este ciclo» y las otras dos listas quedan vacías. Reproducción confirmada con un output aprobado.
- **Mejora:** un resumen operativo de A13 con conclusión fundamentada, oportunidad, entidad, meta/hito, evidencia, estado de propuesta/tarea y condiciones de revisión. A13 debe recibir la revisión vigente del Camino y su decisión efectiva, con scope y frescura. Mantener análisis e instrucciones separados y no ejecutar agentes al abrir un resumen.
- **Aceptación:** A19 puede explicar qué bloqueo detectó A13 y qué trabajo se aceptó, sin leer un mero contador ni volver a proponerlo. A13 respeta una revisión humana posterior y no usa un plan histórico como si fuese el vigente.

### A13-005 · Revalidar y completar atómicamente la tarea y su vínculo con Mi Camino

- **Evidencia:** la revalidación explícita de hito activo/tienda en el materializador solo incluye A04/A06 (`ai-runtime.ts:24099`). Los triggers remotos sí protegen organización y compatibilidad de tienda; no prueban versión, estado aprobado ni alineación. Tarea y enlace se escriben en pasos separados (`24126–24220`); un reintento A13 puede encontrar el título ya abierto y saltar antes de recuperar un enlace fallido (`24083`).
- **Mejora:** validar plan/versión/hito/evidencia en la aprobación y materializar tarea, enlace y recibo de forma recuperable. Rechazar o pedir revisión explícita ante un hito cerrado, un plan reemplazado o un cambio de meta. No permitir que un output agregado se atribuya a una tienda al enlazarlo sin una decisión de alcance.
- **Aceptación:** fallo tras crear tarea y antes del enlace se recupera sin duplicados ni aprobación incompleta. Los triggers existentes se conservan; una tarea no queda enlazada a un plan obsoleto o a un hito sin relación con su objetivo.

### A13-006 · Etiquetar las tareas de A13 como Shopify

- **Evidencia:** `AGENT_TASK_CATEGORY` no contiene A13; el materializador aplica el fallback `general` (`ai-runtime.ts:543–560,23630–23634`). El contrato tampoco recoge una lista `categories` para que el modelo lo compense. El agente se presenta como operativa Shopify.
- **Mejora:** fijar la categoría base Shopify en el backend, conservar la procedencia A13 y revisar las tareas históricas por su agente de origen antes de proponer un backfill. No inferir categoría a partir del título.
- **Aceptación:** una tarea aprobada de A13 aparece en los filtros y contadores de Shopify, mantiene tienda/hito y no altera categorías de otros agentes. Cualquier corrección histórica es idempotente y acotada a procedencia verificable.

### A13-007 · Conservar diagnóstico y avisos en un contrato que coincida con el prompt y la UI

- **Evidencia:** `LEAN_OUTPUT_BY_AGENT` elimina de A13 `answer`, `findings` y `recommendations` (`ai-runtime.ts:5836–5841`), pero el prompt pide un diagnóstico breve y envía avisos de poco esfuerzo a `recommendations`. El parser rellena una frase de contador y listas vacías (`packages/ai/src/index.ts:3348–3387`). La ausencia de tareas deja sin explicación operativa al usuario.
- **Mejora:** contrato específico y breve que preserve conclusión, relación con el objetivo, limitaciones esenciales y avisos sin entregable, además de tareas. Alinear prompt, esquema, resumen para otros agentes y superficies reales; mantener compatibilidad con outputs antiguos sin rellenar conclusiones inexistentes.
- **Aceptación:** «no hay trabajo nuevo», «falta evidencia», «fuente fallida» y «solo hay un aviso» producen resultados distintos y visibles. Un aviso útil no desaparece ni se transforma en una tarea para sobrevivir al contrato.

### A13-008 · Comprobar elegibilidad y cobertura Shopify antes de gastar o presentar un primer análisis

- **Evidencia:** el cron exige una sincronización histórica en alguna conexión Shopify, pero no cobertura/frescura de cada bloque. El POST A13 puede continuar con una tienda activa sin comprobar estado de conexión ni sincronización. El GET sin caché usa `organizationHasIngestedData` sobre cualquier proveedor, sin scope Shopify/tienda (`ai-runtime.ts:7080–7147,14098,16703`).
- **Mejora:** política específica de conexión, permisos, tienda, bloques sincronizados y cobertura temporal. Admitir análisis limitado explícito cuando haya evidencia suficiente; distinguir desconectado, sincronizando, permisos pendientes, datos parciales y listo. No cobrar una lectura vacía como diagnóstico normal.
- **Aceptación:** Klaviyo sincronizado no habilita un A13 sin Shopify. Un sync reciente de otra tienda no valida la actual; una conexión en error conserva el histórico con su aviso y no se anuncia lista para el próximo cron.

### A13-009 · Autorizar antes de resolver scope y exponer capacidades coherentes

- **Evidencia:** GET y runner A13 llaman a `resolveStrictStoreScope` mediante service role antes de la comprobación de membresía del helper común (`ai-runtime.ts:14098,14225,7858,5920,6918`). Las rutas no aplican una guarda específica de consultor, mientras la UI marca A13 `consultantOnly`. La política actual de decisiones permite owner/manager; ocultar un botón no define esa autorización (`server.ts:10069–10252`, `dashboard-ai-agents.ts:88–99`, `ai-runtime.ts:23336`).
- **Mejora:** membresía/organización operativa antes de lecturas privilegiadas; validar UUID y vínculo conexión/tienda. Definir `can_read`, `can_run`, `can_review` por rol y asignación, conforme a la política de producto vigente, y consumirlas en la UI. No usar `consultantOnly` como control de seguridad.
- **Aceptación:** organización ajena o conexión ajena/inactiva no revelan existencia ni amplían el ámbito. Cliente autorizado, colaborador y consultor asignado ven capacidades que el backend respeta. Referencia: [autorización y RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

### A13-010 · Aplicar tienda y procedencia a todo el contexto transversal

- **Evidencia:** las métricas directas reciben `storeId`, pero la llamada común a `loadDecisionPlaybookContextBlocks` solo pasa opciones de tienda para A04/A12, no A13 (`ai-runtime.ts:6227–6241`). El loader sin opciones lee contexto/resultados organizativos F3–F9/F11; su rama con `storeId` sí acota casos relacionados (`decision-playbook-chat-context.ts:937–985,1176`).
- **Mejora:** propagar la tienda a todas las lecturas y seleccionar contexto global aplicable o de la tienda, con procedencia y vigencia. El agregado debe identificarse como agregado y no adjuntar fases/objetivos locales como si fueran un plan único.
- **Aceptación:** métricas de A no reciben casos, recomendaciones o restricciones operativas de B como evidencia local. Validar el snapshot completo y lo efectivamente serializado, además de los argumentos de las RPC.

### A13-011 · Aprovechar la atribución de tienda que ya existe en las alertas

- **Evidencia:** A13 consulta alertas por organización sin seleccionar/filtrar `store_id` y las etiqueta todas como no atribuidas (`ai-runtime.ts:14164–14172,14209`, `shopify-operational-context.ts:38`). En ambos esquemas remotos `alerts.store_id` ya existe; `listOperations` también la selecciona.
- **Mejora:** cargar alertas de la tienda y separar las realmente organizativas, con ID, métrica, periodo, estado y última observación. Respetar desconocidos sin perder señales locales válidas. Retirar la suposición obsoleta de que la tabla carece de tienda.
- **Aceptación:** la alerta de stock de A puede fundamentar una revisión de A; una de B queda fuera; una global se conserva solo con sus límites. El comentario, el DTO y las dos superficies describen el mismo alcance.

### A13-012 · Condicionar los veredictos financieros a cobertura y comparabilidad reales

- **Evidencia:** A13 incorpora el guard de moneda, pero entrega el resumen financiero bruto con beneficio/margen aunque existan `has_settings=false` o costes de producto ausentes. No carga un periodo financiero anterior ni toda la cobertura de líneas netas que usa la UI (`ai-runtime.ts:14143–14150,14187`, `shopify-metrics.ts:742–1001`). La RPC devuelve cifras derivadas aun con componentes incompletos.
- **Mejora:** DTO financiero con cobertura de ajustes, costes, líneas netas, IVA, reembolsos y ads; declarar estimado/parcial/no disponible por métrica. Reutilizar la política de fiabilidad del producto y obtener comparables previos solo cuando se vayan a interpretar tendencias. Una instrucción al modelo no sustituye ese contrato.
- **Aceptación:** costes o ajustes ausentes no producen beneficio aparentemente firme ni una tendencia inventada. Un margen actual no se compara con ventas anteriores como si fuera el margen anterior. Moneda verificada y cobertura económica se comprueban por separado.

### A13-013 · Separar costes organizativos, economía de tienda y monedas

- **Evidencia:** la RPC desplegada `shopify_financial_summary` filtra pedidos por tienda, pero usa ajustes, reglas de envío y gastos fijos por organización. Su CTE de fijos no reparte esos gastos entre tiendas. El agregado puede sumar ventas de varias tiendas; el guard monetario común informa al modelo, pero no transforma estos datos en una economía de tienda atribuida.
- **Mejora:** identificar costes propios, compartidos, asignados y sin asignar; aplicar una regla explícita de reparto cuando exista o declarar que no hay beneficio neto atribuible a la tienda. No sumar monedas desconocidas/incompatibles ni fijar umbrales comerciales con esos derivados. Conservar métricas no monetarias.
- **Aceptación:** el mismo gasto fijo no se presenta como coste exclusivo completo de cada tienda. EUR/USD y gastos de moneda desconocida no generan un total aparente; API/UI/A13 coinciden en unidad, scope y cobertura.

### A13-014 · Respaldar cada intervención con evidencia suficiente y lecturas bajo demanda

- **Evidencia:** el prompt permite rehacer fichas que convierten mal, bundles y umbrales de envío gratis, pero el contexto base no contiene embudo por producto, contenido/precios del catálogo, configuración completa de promociones ni economía específica de esas decisiones. La versión efectiva solo permite `search_knowledge`; existen lectores reutilizables como `get_shopify_product_catalog` y `shopify_funnel_health` fuera de su allowlist (`tool-layer.ts:275,281`, `ai-runtime.ts:2938,3416`).
- **Mejora:** matriz de capacidad/evidencia por intervención; incluir contexto determinista indispensable y habilitar solo lecturas acotadas que permitan profundizar cuando haga falta. Vincular entidad, fuente, periodo, valor, unidad, denominador y confianza; validar referencias/cifras server-side. Coordinar conversión/stock/postventa con sus especialistas.
- **Aceptación:** sin sesiones atribuibles no afirmar que una ficha convierte mal; sin costes/reglas suficientes no fijar un umbral rentable; sin compra conjunta observada no afirmar que un bundle aumentará el ticket. La ausencia de datos puede originar una propuesta de verificación, identificada como tal.

### A13-015 · Unificar ventanas, cortes y etiquetas de periodo

- **Evidencia:** A13 usa 30×24 h desde el instante actual; el anterior termina exactamente donde empieza el actual. Las RPC de ventas aceptan ambas fronteras inclusivas. Un fixture SQL de solo lectura confirmó que un pedido en ese instante entra en ambos intervalos. Las rutas ignoran `days`, aunque la UI lo envía y los gráficos vecinos cambian de periodo (`ai-runtime.ts:14111–14144`, `client-shopify.tsx:167–174,211`).
- **Mejora:** contrato canónico con cortes disjuntos, zona/cobertura declaradas y semántica compartida por fuentes. Mantener A13 fijo y etiquetarlo claramente o admitir ventanas explícitas con caché propia; no relacionarlo visualmente con otro selector sin aclaración.
- **Aceptación:** el pedido del corte se cuenta una vez; se prueban cambio de mes/año, horario y día parcial. Un gráfico de siete días no presenta el A13 de 30 como diagnóstico de esos siete días.

### A13-016 · Seleccionar productos por riesgo y declarar la cobertura de la muestra

- **Evidencia:** la RPC desplegada devuelve como máximo 30 productos, prioriza estado seguido de unidades vendidas, y A13 enriquece pero corta los primeros cinco sin reordenar por cobertura (`ai-runtime.ts:14190–14203`). Una reproducción con seis productos dejó fuera al sexto agotado y mostró cinco con miles de días de cobertura.
- **Mejora:** selección estratificada por rotura/cobertura, impacto, muestra suficiente y huecos de medición; preservar identidad, motivo, universo elegible y truncamiento antes de limitar. Reutilizar el criterio de riesgo de A06 y recuperar detalle bajo demanda, sin prometer auditar todo el inventario.
- **Aceptación:** un producto de menos ventas agotado aparece frente a otro abundante cuando el riesgo lo justifica. Estado desconocido no equivale a seguro y no desaparece por el ranking. Los límites SQL y de contexto se declaran.

### A13-017 · Distinguir stock desconocido, no gestionado y cero confirmado

- **Evidencia:** `shopify_stock_summary` desplegada cuenta `coalesce(available_quantity,0)<=0` como agotado y no exige `inventory_items.tracked`. En el fixture `NULL,3,0` devuelve dos agotados aunque solo haya un cero confirmado. `tracked_items` cuenta filas de estado de inventario, lo que puede representar ubicaciones, no productos o variantes únicos.
- **Mejora:** estados separados para cantidad conocida, sin sync, parcial, no gestionado y agotado confirmado; definir y conservar el grano por producto/variante/ubicación. Alinear resumen y lector de riesgo; no recomendar compra por una cantidad ausente.
- **Aceptación:** `NULL` no dispara una reposición; dos ubicaciones no se anuncian como dos productos distintos. Resumen UI, A06 y A13 muestran contadores equivalentes y cobertura explícita.

### A13-018 · Medir la frescura del conjunto de inventario que respalda el riesgo

- **Evidencia:** la definición remota de `shopify_stock_risk_products` usa `max(s.updated_at)` para el producto; el enriquecedor evalúa ese único valor contra 48 h (`stock-risk-evidence.ts:73–111`). Dos filas, una del 1/10 y otra del 19/10, producen como fecha de referencia 19/10; una fila reciente puede ocultar otra antigua.
- **Mejora:** cobertura por variante/ubicación y edad de la parte más antigua pertinente, junto con sync completo/parcial y expectativa de recursos. Mantener el umbral como política compartida; no confundir fecha de modificación de una fila con una reconciliación integral correcta.
- **Aceptación:** una variante o ubicación antigua impide cuantificar cobertura precisa del conjunto hasta validarla. Una fila nueva no certifica todo el producto; se mantienen las abstenciones sobre compra, lead time y cantidad.

### A13-019 · Aplicar suficiencia de datos y estados por fuente sin ocultar fallos

- **Evidencia:** `operationalMetricValue` diferencia error de lista vacía, pero las RPC agregadas suelen devolver una fila de ceros aun sin observaciones. Riesgo vacío se etiqueta `no_sales_in_period`, y `loadSharedActivityBlocks` omite errores como si no hubiera feed (`ai-runtime.ts:5449–5460,14189–14195`). El prompt manda muchas limitaciones a `warnings`, que la cola no presenta.
- **Mejora:** resultado tipado por fuente con observaciones/cobertura, fechas, scope y error sanitizado; política que aborte o limite conclusiones según evidencia mínima. Conservar fuentes sanas y comunicar las limitaciones relevantes donde se toma la decisión.
- **Aceptación:** caída RPC, permisos faltantes, sync parcial, periodo vacío y cero real son distintos. Fallar el feed no autoriza afirmar ausencia de trabajo previo; un fallo actual no se transforma en una tarea comercial basada en ceros.

### A13-020 · Persistir un digest pertinente a la tienda, la ventana y el objetivo

- **Evidencia:** el tick calcula `organization_activity_digest`, pero la llamada cron A13 no pasa `activityDigest` y el runner no guarda otro para A13 (`ai-runtime.ts:6135,6250,17209–17216`). El digest general mezcla sincronizaciones/tareas/alertas/eventos de toda la organización y no versiona directamente el Camino. Los runs remotos recientes muestran huecos de digest.
- **Mejora:** huella de fuentes efectivamente usadas, tienda, revisiones, cobertura, ventana, plan/objetivos e hitos vigentes; guardar el mismo snapshot que emplean caché y scheduler. Diferenciar lectura de digest fallida de ausencia de cambio y contemplar caducidad temporal aunque no cambien filas.
- **Aceptación:** no se regenera A por actividad ajena de B; un cambio de meta/hito o un nuevo dato pertinente provoca reconsideración conforme a la cadencia. Dos lecturas del mismo contexto reproducen la misma huella.

### A13-021 · Hacer verificable la programación y repartir el cupo entre tiendas

- **Evidencia:** A13 se planifica después de varios agentes y del gate Meta; recorre agregado y tiendas sin un límite/reparto equivalente al especial de A02/A12. Comparte cupos y prioridad organizativa sin antigüedad de espera específica (`ai-runtime.ts:16173–16288,16808–17126`). No hay gates A13 de los últimos siete días en ninguno de los proyectos.
- **Mejora:** elegibilidad por scope, prioridad por espera y riesgo relevante para la meta, recuperación del primer análisis y reparto justo entre tiendas. Hacer observables cola/worker/tick, activación, cupos, circuito y motivo del aplazamiento; verificar la ejecución desplegada sin interpretar el silencio como prueba de caída.
- **Aceptación:** una tienda pequeña no queda indefinidamente detrás de tiendas/agentes previos; no se promete un análisis a las 06:00/15:00 si los controles lo impiden. Autorun apagado o tick sin candidatos deja un estado operativo explicable.

### A13-022 · Alinear frescura de caché, envelope, fuentes y cadencia efectiva

- **Evidencia:** el GET calcula `stale` para A13, pero solo sobrescribe la frescura del envelope para A02/A04/A06/A08/A12; A13 conserva el default `fresh` (`ai-runtime.ts:6998–7067,7326`). Reproducción: caché del 1/10 consultada el 19/10 da `stale:true` y envelope `fresh` válido hasta el 2/10. Tampoco aplica la cadencia escalada de plataforma a esta presentación.
- **Mejora:** política única por agente/scope que separe edad del análisis y de cada fuente, considere revisión de objetivos/evidencia y exponga `fresh/stale/partial/unavailable` coherentes. Conservar histórico útil con advertencia; una nueva generación no rejuvenece fuentes antiguas.
- **Aceptación:** ninguna superficie presenta simultáneamente fresco y vencido. Un cambio pertinente puede invalidar evidencia antes del TTL; se prueban fecha inválida, override de cadencia y desconexión posterior al run.

### A13-023 · Deduplicar ejecuciones, reservar cupo manual atómicamente y recuperar resultados

- **Evidencia:** la UI envía `Idempotency-Key` en cada POST, pero la ruta A13 no lo lee ni lo propaga. La reserva atómica de refrescos incluye A04/A05/A06/A08/A12 y excluye A13; A13 cuenta runs y comprueba cupo en pasos separados (`client-shopify.tsx:211–224`, `server.ts:10244`, `ai-runtime.ts:5599–5657`). El POST es síncrono y genera un UUID nuevo por petición.
- **Mejora:** identidad durable por organización/tienda/ventana/revisión, exclusión de trabajo equivalente entre cron y manual, reserva manual atómica y consulta de estado/resultado. Reutilizar una clave estable en reintentos y recuperar una generación completada después de una desconexión.
- **Aceptación:** doble clic, dos usuarios, dos pantallas y solapamiento con el tick no pagan dos generaciones equivalentes. Dos llamadas concurrentes por el último cupo no lo consumen ambas; fallo entre guardar output y cerrar run se recupera con resultado verificable.

### A13-024 · Separar actualización del diagnóstico y buzón durable de propuestas

- **Evidencia:** una salida pendiente de menos de tres días puede frenar un nuevo run; `shouldRequireHumanApproval(required_before_publish, {proposed_writes:[]})` también devuelve `true`. GET recupera solo el último éxito, por lo que una nueva salida puede desplazar propuestas previas aún sin decidir (`ai-runtime.ts:16445–16480,17020–17045,6931`).
- **Mejora:** separar diagnóstico vigente y ciclo de propuesta; buzón durable por oportunidad, con autoría, evidencia, decisiones y tareas resultantes. Una salida sin escrituras no debe fingir trabajo pendiente; una señal nueva debe poder analizarse preservando revisión previa.
- **Aceptación:** aparece una incidencia nueva aunque quede otra por revisar; las propuestas anteriores siguen accesibles y no se duplican. Cero tareas no congela el análisis ni se interpreta como aprobación pendiente de una acción inexistente.

### A13-025 · Evitar duplicados entre A13, otros agentes y trabajo ya resuelto

- **Evidencia:** el contexto A13 recibe hasta 100 tareas con título/estado/categorías y sin ID/hito/entidad ni contador de truncamiento. El materializador deduplica títulos normalizados; la exclusión específica de reposición por producto solo se aplica a A06 (`ai-runtime.ts:14064–14095,23654–23707,24083`). Un nombre distinto de la misma necesidad escapa a la comparación.
- **Mejora:** identidad de oportunidad por tienda/entidad/tipo de intervención, enlace a propuesta/tarea existente y deduplicación atómica entre outputs/agentes. Incorporar backlog pertinente, tareas pendientes de aceptación y resoluciones recientes con su razón. No repetir una tarea rechazada o cerrada sin evidencia nueva explícita.
- **Aceptación:** A06 y A13 no crean dos reposiciones del mismo producto, ni A04/A17/A13 tres versiones de una corrección. Cambiar el título no elude la deduplicación; los recortes de backlog se declaran y no autorizan asumir que no hay trabajo previo.

### A13-026 · Entregar tareas ejecutables, con responsable y criterio de medición

- **Evidencia:** el prompt A13 pide título/descripción/prioridad/rationale, sin contrato obligatorio de propietario, esfuerzo, dependencias, criterio de cierre o métrica. La cola infiere de `owner_role` quién debería actuar, pero A13 no lo exige; la asignación final usa candidatos de carga común (`client-pulse.tsx:690`, `ai-runtime.ts:23704,24126–24177`).
- **Mejora:** propuesta con propietario verificable, entrega concreta, criterio de aceptación, entidad, restricción/dependencia y métrica/ventana de seguimiento cuando pueda medirse. Explicar contribución al hito y estimar esfuerzo solo con evidencia; mantener plazos orientativos separados de fechas comprometidas.
- **Aceptación:** el usuario sabe quién hace qué y cuándo puede considerarse terminado. La cola no atribuye por defecto al cliente el trabajo del consultor; aprobar no inventa una fecha límite, horas disponibles o una mejora económica garantizada.

### A13-027 · Revalidar la evidencia al aprobar y mostrar el resultado exacto de cada decisión

- **Evidencia:** A13 no revalida stock, costes, entidad ni objetivo antes de materializar propuestas antiguas. Un título ya existente se salta sin un recibo `existing` explícito; la cola anuncia tantas tareas creadas como propuestas aprobadas, sin usar el conteo devuelto (`ai-runtime.ts:24083,24413`, `client-pulse.tsx:790–808`). Hay claim por output y upsert por índice, pero no cubren todos los efectos posteriores.
- **Mejora:** decisiones por propuesta con `created/existing/rejected/skipped/failed`, enlace al resultado y explicación; revalidar evidencia/versiones caducadas y recuperar escrituras parciales. Mantener permisos y condiciones de revisión expuestos por API, sin traducir un éxito HTTP en una creación que no ocurrió.
- **Aceptación:** stock repuesto o meta cambiada desde el diagnóstico requieren revisar la propuesta; no se anuncia creación si solo había una tarea existente. Tras un fallo de enlace, reintentar completa el efecto pendiente y conserva el recibo exacto.

### A13-028 · Dar a A13 una presentación visible de función, objetivo y estado

- **Evidencia:** el frontend Shopify consulta A13 únicamente como consultor y utiliza propuestas; el botón solo aparece si no hay `data`. No presenta su conclusión, periodo real, objetivo/hito, fuentes, bloqueo o error de forma propia. Además omite todas las propuestas A13 cuando la cobertura monetaria no es compatible, incluidas las no financieras (`client-shopify.tsx:174,232–234,529–553`).
- **Mejora:** ficha breve de operativa con meta/hito de referencia, periodo, última generación/sync, estado, siguiente revisión estimada y propuestas. Acceso según capacidades, también para cliente autorizado sin consultor; conservar avisos no monetarios cuando fallen divisas y explicar qué análisis queda limitado.
- **Aceptación:** el usuario entiende para qué existe A13 frente a A02/A06 y dónde revisar su trabajo. Error de GET no se presenta como «nunca ejecutado»; resultado antiguo, agente pausado o falta de conexión son estados distintos. El histórico se puede consultar y refrescar cuando corresponda.

### A13-029 · Mantener el scope de tienda y las decisiones recuperables en la cola de trabajo

- **Evidencia:** `ClientShopify` pasa scope a A13, pero consulta `${base}/operations` sin tienda; `listOperations` devuelve tareas/alertas organizativas y `WorkQueue` no las filtra por tienda. La cola no transporta al ítem de propuesta su periodo, frescura, evidencia estructurada o hito; varias aceptaciones quedan en estado local hasta decidir el lote (`client-shopify.tsx:175,539`, `operations.ts:733–843`, `client-pulse.tsx:651–808`).
- **Mejora:** scope consistente en cola/operaciones/propuestas, con atribución visible para trabajo global. Conservar evidencia, meta/hito, estado por propuesta y recibos durables; recuperar decisiones parciales tras recargar. Revisar también las superficies de tareas/móvil que consumen las tareas resultantes, respetando el alcance reducido del móvil.
- **Aceptación:** al cambiar A→B no se aprueba ni presenta trabajo de A como de B. Recargar no pierde una decisión anunciada como guardada; el usuario puede abrir el diagnóstico y el hito de origen. La caché por URL existente no se confunde con un filtro de las operaciones organizativas.

### A13-030 · Presupuestar contexto y reutilizar una capa de lectura consistente

- **Evidencia:** A13 carga métricas directas, historial, feed, restricciones y decenas de lecturas transversales; F9/F11 no se excluyen para A13. El serializador limita a 12.000 caracteres/bloque y 48.000 totales y corta cadenas JSON (`ai-runtime.ts:6151–6244`, `untrusted-context.ts:2–3,39–66`). Tres de cuatro éxitos de test registran contexto truncado. A02/A06/A13 leen por separado parte de las mismas fuentes.
- **Mejora:** DTO compacto con meta/cobertura/limitaciones primero, particiones estructuradas acotadas, presupuesto explícito A13 y consultas bajo demanda. Compartir cálculos y cobertura con API/UI/especialistas; reutilizar lecturas equivalentes por revisión y paralelizar solo fuentes independientes. Medir coste/latencia/tokens de esa composición.
- **Aceptación:** objetivo, restricciones y límites sobreviven a cardinalidad alta, sin JSON cortado como representación normal. Menos consultas o tokens conservan el mismo diagnóstico verificable; no se cachean datos entre organizaciones/tiendas ni por una clave que omita la versión del objetivo.

### A13-031 · Distinguir herramientas declaradas, herramientas disponibles y metodología aplicable

- **Evidencia:** la DB declara `search_knowledge`, pero su construcción requiere `VOYAGE_API_KEY`; sin ella la herramienta no se incorpora (`ai-runtime.ts:4590–4595`). El prompt A13 no establece una búsqueda metodológica dirigida ni cómo tratar benchmarks/capacidades ausentes. El RAG actual sí fija organización/tienda/audiencias en servidor y neutraliza instrucciones recuperadas; debe preservarse.
- **Mejora:** manifest de capacidades efectivas y razón de indisponibilidad, recuperación metodológica pertinente a la intervención y fuentes con procedencia/alcance. Reutilizar lectores concretos cuando sean necesarios, con límites y cobertura; no habilitar herramientas externas de escritura por el mero deseo de ampliar potencia.
- **Aceptación:** embeddings ausentes no se presentan como ausencia de conocimiento del cliente. Benchmarks de otra vertical/país/muestra no se convierten en objetivos de la tienda. Ningún documento recuperado cambia el tenant, el rol o los controles de aprobación.

### A13-032 · Cerrar el seguimiento entre oportunidad, tarea, objetivo y resultado observado

- **Evidencia:** hay historial de propuestas propias y feed general, y las tareas pueden guardar resultados; A13 no carga una cadena tipada oportunidad→decisión→tarea/hito→medición posterior. El resumen para A19 pierde sus propuestas y la lectura base no calcula la brecha del objetivo.
- **Mejora:** conservar esa cadena con IDs y versiones, separar ejecución/completitud/resultado y programar una revisión cuando exista evidencia comparable. Aprovechar resultados declarados sin convertirlos en hechos independientes; compartir con A19 cambios verificados y limitaciones, incluidos intentos descartados y sus razones.
- **Aceptación:** una tarea completada no vuelve como nueva por falta de seguimiento. A13 puede explicar qué se hizo, qué cambió y qué sigue desconocido; no atribuye una subida de ventas a la tarea sin evidencia causal adecuada.

### A13-033 · Unificar política operativa, observabilidad y prueba de despliegue

- **Evidencia:** el catálogo/documentación histórica declara cierres locales; la cadencia de diseño y los límites efectivos viven en capas distintas. El tick puede salir por autorun/presupuesto sin persistir gates y `loadDisabledAgents` ignora errores (`ai-runtime.ts:16619–16678`, `ai-agent-groups.ts:24–40`). No hay gates recientes y los éxitos auditados carecen de `deployment_version`.
- **Mejora:** ficha operativa reutilizable con propósito, disparadores, requisitos, capacidades, scope, periodo y destinatario; registro durable de tick/decision/run/output y versión API/web/worker. Tratar una lectura fallida de preferencias como estado desconocido que no habilite gasto contrario a una desactivación. Comprobar migraciones por historial y definición real, siguiendo el flujo del repositorio.
- **Aceptación:** un operador explica por qué no hay A13 de una tienda y qué debe ocurrir para generarlo. Se distingue código local, configuración DB, despliegue y recorrido probado; un error al leer preferencias no reactiva silenciosamente un agente apagado.

### A13-034 · Añadir regresiones de A13 y verificar el recorrido completo por rol y tienda

- **Evidencia:** las 73 pruebas focalizadas existentes pasan, pero se reprodujeron pérdida de `phase`, resumen A19 sin diagnóstico, fallback de hito, frescura contradictoria y selección que omite stock agotado. Las tres pruebas específicas de `shopify-operational-context.test.ts` cubren helpers, no el runner completo ni la aprobación real.
- **Mejora:** regresiones de loader/contrato/ruta/runner con clientes simulados, fixtures SQL y pruebas de organización/tienda/plan/hito. Recorridos aislados sincronización→cron→diagnóstico alineado→decisión→tarea/hito→seguimiento, con roles y fallos parciales; evaluaciones de hechos/abstención y cargas acotadas, sin ejecutar acciones comerciales reales para auditar.
- **Aceptación:** se verifican objetivos/versiones, borrador versus activo, nulos, divisas, cobertura, caducidad, cuotas/concurrencia y recuperación. Las afirmaciones soportadas y los duplicados se evalúan separadamente de un esquema válido o una suite local en verde.

### Verificación y límites de esta auditoría de A13

- **Implementado:** lectura del Camino aprobado y sus métricas por tienda; progreso calculado con periodos no solapados; contrato de propuesta con fase, versión, evidencia, responsable y criterio de éxito; contexto de A02/A06/A19/A20/A21/A22; resumen útil de A13 para A19; filtrado de alertas/tareas por tienda; selección priorizada de riesgo; estados de frescura/cobertura en API y UI; comprobación de membresía y sincronización; recuperación de reintentos y reserva manual por tienda; clasificación Shopify; revalidación del plan y materialización atómica de tarea+hito. A13 también recibe tareas cerradas de su tienda/plan y resultados declarados como no verificados para evitar repetir trabajo sin atribuir causalidad.
- **Migraciones aplicadas:** `20270102100000_a13_scoped_manual_refresh.sql` y `20270102110000_a13_atomic_task_materialization.sql`, primero en test y luego en producción mediante `npm run db:push` con `--only` para no incluir migraciones ajenas.
- **Validación local:** `npm run typecheck -w @e-nora/api` y 28 pruebas focalizadas aprobadas (`agent-task-delivery`, `consultant-specialist-context`, `shopify-operational-context`, `ai-runtime-envelope`, `ai-runtime-plan-auth`). `git diff --check` no encontró errores. Las cuatro previsualizaciones de migración confirmaron que únicamente se aplicarían las dos migraciones A13.
- **Limitaciones de esta pasada:** no se ejecutó una sesión autenticada de UI, cron/worker, llamada al proveedor, prueba de carga ni carrera concurrente de aprobaciones. No se desplegó API/web/worker. Permanecen por cerrar el reparto justo/prioridad del scheduler entre tiendas, un buzón de propuestas visible que conserve varias decisiones pendientes a la vez y la trazabilidad durable de gates/versiones desplegadas. La cadena oportunidad→tarea→resultado ya conserva la identidad Camino y añade resultados declarados al contexto, pero aún necesita E2E autenticado y comparación posterior de métricas para demostrar el recorrido completo.
- **Typecheck web:** sigue bloqueado por un error preexistente ajeno a A13 en `apps/web/src/app/marketing/studio/content-studio.tsx:883` (`string | null` asignado a `string`).

## A14 · Operativa Meta Ads y sostenibilidad de la inversión

**Auditoría: 19 de octubre de 2026. Estado: las 32 mejoras se han implementado en el código local y en la migración A14; la migración y A14 v3 están verificadas en test y producción.** Revisión original de código local, grafo MCP, configuración y definiciones SQL de ambos entornos. Las referencias de la auditoría corresponden al árbol de trabajo de esa revisión; no identifican por sí solas el código desplegado.

### Función y límites que debe conservar

A14 debe explicar si la inversión Meta de una tienda es sostenible, qué evidencia permite esa conclusión y qué trabajo conviene ejecutar para contribuir al objetivo aprobado de Mi Camino. El resultado debe conectar gasto, atribución, costes, cobertura, restricciones, capacidad y seguimiento. Una compra atribuida por Meta no acredita un cliente nuevo ni una venta incremental.

| Agente o módulo | Responsabilidad | Relación de A14 |
|---|---|---|
| A02 | Lectura general del negocio. | A14 concreta el diagnóstico económico de Meta y evita repetir trabajo. |
| A13 | Operativa Shopify y relación con el Camino. | Comparte señales de oferta, conversión, margen y disponibilidad que condicionan la inversión. |
| A14 | Sostenibilidad económica de adquisición Meta y propuestas operativas. | Prioriza problemas e hipótesis verificables, con límites y criterio de revisión. |
| A24 | Fiabilidad y cobertura de la medición. | Condiciona qué conclusiones puede extraer A14 de compras, CPA y ROAS. |
| A23 / A25 | Creatividad y subasta / cambios y comparación temporal. | Aportan evidencia específica; A14 no deduce sus diagnósticos desde un agregado de gasto. |
| A19 / Mi Camino | Meta aprobada, hitos y revisión estratégica. | A14 conserva la identidad del plan y deriva cambios de estrategia a revisión humana. |
| A04 / A17 / A18 | Trabajo diario, semanal y mensual. | Reciben oportunidades y decisiones de A14 con procedencia y estado. |

La aprobación de A14 crea tareas internas; el recorrido auditado no pausa anuncios, cambia presupuestos ni publica en Meta. Las mejoras deben mantener esa frontera. Las acciones económicas sugeridas necesitan la misma calidad de evidencia aunque aparezcan como recomendaciones de texto.

### Disparadores, datos y superficies observados

| Entrada | Comportamiento local | Límite que debe corregirse |
|---|---|---|
| Worker | Tick BullMQ `0 6,15 * * *`, `Europe/Madrid`. | Son oportunidades de evaluación, no dos generaciones garantizadas de A14. |
| Orquestador | A14 detrás de planes y A24; cadencia base 20 h; agregado organizativo y tiendas Shopify elegibles. | No exige conexión/cobertura Meta de esa tienda; el agregado no tiene un gate A24 por tienda. |
| GET `/ai/operativa-meta` | Lee el último éxito de 30 días y scope exacto; no llama al modelo. | No aplica a A14 la cobertura por fuente ni la misma presentación de frescura/cadencia que a otros agentes. |
| POST `/ai/operativa-meta-run` | Generación manual síncrona con `connectionId`. | `days` no modifica los 30 días; la ruta valida una clave de idempotencia y luego no la pasa al runner A14. |
| Contexto específico | Meta actual/anterior, finanzas Shopify actuales, cuentas Meta no asignadas, tareas abiertas, Camino, alertas y gate A24. | No ofrece investigación económica por campaña, periodo financiero anterior ni estados completos de cobertura/divisa. |
| Contexto compartido | Restricciones, historial propio, actividad y motores de decisión. | A14 no pasa el filtro de tienda al playbook ni excluye los grandes bloques F9/F11. |
| UI `ClientMeta` | Consulta A14 solo con `asConsultant`; muestra propuestas en `WorkQueue`. | No presenta una ficha completa del diagnóstico A14 y las operaciones vecinas se consultan sin `connectionId`. |
| Aprobación | Materializa tareas; conserva rationale/evidence genéricos y puede enlazar hitos. | A14 conserva el fallback al hito actual y no usa la revalidación/operación atómica específica de A13. |

Referencias: `apps/worker/src/repeatable-jobs.ts:19`, `apps/api/src/server.ts:10070–10300`, `apps/api/src/ai-runtime.ts:14858–15017,16452–16545,16966,17490`, `apps/web/src/app/dashboard/client-meta.tsx:230–260,513–541`, `apps/web/src/lib/dashboard-ai-agents.ts:102`.

### Estado remoto comprobado, solo lectura

Consultas realizadas el **19/10/2026; corte de referencia 15:25 UTC**. Se leyeron configuración del agente, definiciones SQL, índices y agregados de estado/estructura. No se inspeccionaron textos de anuncios, cuerpos de pedidos, credenciales ni contenidos narrativos de salidas de clientes.

| Comprobación | Test · `kopcblejsxpkxoykldyh` | Producción · `cthjwpeygpzwdmjkxeqa` |
|---|---|---|
| Agente / prompt activo | A14 v2 / prompt v2 | Igual |
| Modelo configurado | `claude-sonnet-5` | Igual; no certifica el modelo efectivo de cada ejecución |
| Tools declaradas | `search_knowledge` | Igual |
| Modo de aprobación | `required_before_publish` | Igual |
| Migraciones base y alcance | `20260901240000`, `20261115460000` registradas | Igual |
| Override de plataforma A14 | Sin fila | Sin fila |
| Runs A14 registrados | 3 éxitos manuales, último 12/10 | 28 fallos cron, entre 08/09 y 22/09; sin éxitos registrados |
| Metadatos de esos runs | 2/3 con contexto truncado; 2/3 sin digest; 3/3 sin versión de despliegue | 28/28 sin digest; 2/28 sin versión de despliegue |
| Gates A14 últimos siete días | 0 | 0 |
| Cache A24 | 1 fila, ninguna vigente al consultar | 0 filas |
| Cuentas Meta activas / sin tienda | 1 / 0 | 2 / 1 |
| Divisas observadas de cuentas | EUR | EUR |
| Conexiones Meta | 1 `connected`, con sincronización previa | 2 `error`, con sincronización previa |
| Variantes duplicadas por cuenta/anuncio/día sin breakdown | 0 grupos observados | 0 grupos observados |

Los 28 fallos históricos de producción corresponden a saldo insuficiente del proveedor Anthropic; no prueban el saldo actual ni que el worker esté detenido. En test, dos éxitos registran OpenAI/`gpt-6-luna` efectivo, con 13.065–64.319 tokens de entrada; el tercer éxito declara cero tokens/coste/latencia y no debe usarse como prueba de una generación real. Las tres salidas están pendientes de aprobación; dos no contienen tareas y aun así requieren aprobación. Las salidas históricas sí incluyen `answer`; esto no demuestra que el contrato local actual lo solicite.

`meta_spend_summary` y `shopify_financial_summary` coinciden en ambos entornos por firma y hash de definición (`8bbf423fa534a2a05c4202224fc0d81f` y `62f44515dd1ee277944a0e2ae006b666`, respectivamente). Son funciones `STABLE` sin `SECURITY DEFINER`; esa propiedad no sustituye una prueba de aislamiento con roles/tenants.

### A14-001 · Calcular y explicar el equilibrio económico con una base comparable

- **Evidencia:** el prompt activo propone aproximadamente `1 / margen bruto`, mientras `shopify_financial_summary` calcula `breakeven_roas` descontando producto, comisiones, envío y fijos. Meta aporta valor de compra atribuido y la referencia financiera usa ingresos sin impuestos. Un fixture con ingreso 100, producto 40, comisiones 3, envío 7 y fijos 10 produce 1,67 con la aproximación y 2,50 con la fórmula completa. No cuantifica impacto real en clientes.
- **Mejora:** regla determinista y versionada que declare qué costes incluye cada umbral, base fiscal, descuentos/devoluciones, grano y limitaciones de aplicar la economía media de tienda al canal. No comparar automáticamente valor Meta bruto con una referencia calculada sobre ingreso neto.
- **Aceptación:** A14 usa el umbral sustentado o se abstiene; margen nulo/negativo, costes ausentes o bases incompatibles no generan un ROAS objetivo inventado ni una recomendación de escalar.

### A14-002 · Aplicar cobertura de moneda a todas las decisiones económicas

- **Evidencia:** A14 no figura en `SHOPIFY_FINANCIAL_AGENT_CODES` ni en el mapa Shopify (`ai-runtime.ts:545–575,6186`). Por tanto, no recibe por esa vía la cobertura ni las instrucciones de divisas. `meta_spend_summary` suma importes y devuelve ROAS/CPA sin moneda; admite varias cuentas. Actualmente las monedas observadas son EUR, no se demostró una mezcla real.
- **Mejora:** validar moneda por cuenta y fuente financiera; separar importes incompatibles o convertir componentes con tipo/fecha/procedencia antes de calcular derivados. Moneda desconocida no equivale a EUR ni queda resuelta rotulando el total después de sumarlo.
- **Aceptación:** EUR/USD o moneda ausente impiden conclusiones monetarias mezcladas, conservando métricas no monetarias útiles. UI, contexto y tarea aprobada mantienen la misma cobertura.

### A14-003 · Separar CPA atribuido, CAC de adquisición y CAC blended

- **Evidencia:** `metaSpendForAgent` renombra correctamente `cac` a `cpa_atribuido_meta`, pero el prompt sigue describiendo CAC y su sostenibilidad. La RPC divide gasto entre compras atribuidas; no identifica clientes nuevos de Meta. `cac_blended` financiero usa todos los anuncios y nuevos clientes Shopify. Con gasto 200, diez compras atribuidas y cuatro nuevos clientes, los cocientes son 20 y 50 y responden a preguntas diferentes.
- **Mejora:** tipar definición, denominador, canal y atribución en cada métrica; conservar nombres claros en prompt, tools, UI, evidencia y juez. Derivar CAC de canal solo cuando exista una fuente que identifique adquisición elegible de ese canal.
- **Aceptación:** ninguna propuesta presenta CPA de repetición como coste de adquirir un cliente nuevo ni adjudica el CAC blended exclusivamente a Meta.

### A14-004 · Unificar ventanas, zona horaria y días completos

- **Evidencia:** A14 convierte timestamps a fecha UTC y consulta límites inclusivos `>=`/`<=`; el periodo anterior acaba en el mismo día en que empieza el actual (`ai-runtime.ts:14872–14909`). El fixture 19/09–19/10 y 20/08–19/09 contiene 31 días por ventana y comparte el 19/09. Finanzas usa timestamps parciales, Meta usa días.
- **Mejora:** una política temporal compartida por cuenta/tienda para dos ventanas no solapadas y comparables; declarar fecha de corte, día parcial, timezone y fecha de extracción. Definir en la API si el periodo es fijo o parametrizable y reflejarlo en pantalla.
- **Aceptación:** se prueban cambio de mes, horario de verano y cuentas con distinto timezone; ningún dato del día límite participa en ambas ventanas y no se compara un día parcial como completo.

### A14-005 · Canonizar las filas Meta antes de sumar gasto y conversiones

- **Evidencia:** la clave única admite variantes por `attribution_hash` y `action_report_time`. `meta_spend_summary` filtra nivel anuncio/sin breakdown pero no elige una única variante por cuenta/anuncio/día. Dos filas sintéticas de gasto 100 devuelven suma 200 frente a 100 canónico. No se observaron grupos duplicados en los datos remotos consultados.
- **Mejora:** seleccionar una fila canónica determinista antes de agregar, coherente con la política de importación y las demás RPC del módulo; publicar versión, cobertura y variantes descartadas. No resolverlo con un `DISTINCT` sobre importes iguales de anuncios distintos.
- **Aceptación:** reimportación, cambio de ventana o `action_report_time` no duplican gasto; dos anuncios legítimos de igual importe siguen contando por separado.

### A14-006 · Conservar ventana y definición de conversión en cada comparación

- **Evidencia:** la RPC devuelve `purchase_action_types` pero no la ventana elegida ni `action_report_time`. Selecciona acciones y valores por `metric_name` de forma independiente con `meta_attribution_window_rank`; si la disponibilidad difiere pueden proceder de ventanas distintas. Usa la selección canónica actual de cada cuenta para leer el histórico.
- **Mejora:** identidad de evento, ventana, modo de reporte y versión de selección, con cobertura de compras/valor por separado. Comparar ventanas equivalentes y señalar cuándo una nueva selección modifica la interpretación histórica.
- **Aceptación:** cambiar evento/ventana no se presenta como mejora de rendimiento; ROAS y CPA usan numeradores/denominadores compatibles y no suman atribución de plataformas como ventas adicionales.

### A14-007 · Distinguir cobertura financiera completa de una cifra disponible

- **Evidencia:** A14 recibe la fila financiera sin un dictamen específico de suficiencia. La función devuelve `has_settings`, `items_without_cost` y cifras derivadas, pero su firma no incluye todos los contadores de cobertura neta que usa la UI Shopify. Ajustes o costes ausentes pueden caer en valores cero; solo se carga el periodo financiero actual.
- **Mejora:** un resultado financiero tipado con observaciones, costes conocidos/estimados/desconocidos, cobertura de líneas, devoluciones, sincronización y comparabilidad temporal. Reutilizar la política determinista de disponibilidad de rentabilidad y aportar el periodo anterior cuando se juzgue evolución económica.
- **Aceptación:** ajustes inexistentes, coste cero confirmado, coste desconocido y cobertura parcial son estados distintos. A14 no declara rentable una adquisición cuyo coste todavía no conoce.

### A14-008 · Separar costes organizativos y economía atribuible a la tienda

- **Evidencia:** `shopify_financial_summary` limita pedidos por tienda, pero ajustes, reglas y gastos fijos se leen por organización; el cálculo de fijos no incorpora `target_store_id`. Usar toda la estructura de costes en cada tienda puede repetirla en las referencias de equilibrio.
- **Mejora:** política explícita de costes propios, compartidos y no asignados; presentar sensibilidad o abstención cuando no exista reparto defendible. Mantener separados equilibrio de tienda, contribución marginal del canal y objetivo comercial aprobado.
- **Aceptación:** dos tiendas no absorben cada una el 100 % de los mismos fijos sin advertencia. Una caída de gasto/ingreso no prueba por sí sola que el negocio haya ganado o perdido rentabilidad.

### A14-009 · Hacer efectivo el control A24 sobre las recomendaciones de gasto

- **Evidencia:** A14 adjunta el veredicto A24, con `unknown` cuando falta tienda/cache vigente, pero conserva el contrato genérico. La restricción estructurada de acciones según ese estado está implementada específicamente para A23 (`ai-runtime.ts:5870`), no para A14. El prompt A14 v2 no incorpora una política equivalente. Al consultar, no había veredictos vigentes en ninguno de los entornos.
- **Mejora:** control A14 propio, con estado A24 fijado por el servidor y acciones permitidas por calidad de evidencia. Con medición desconocida/restrictiva puede describir gasto o pedir investigación, pero no justificar recorte/escalado por compras/ROAS no fiables. Revalidar al aprobar.
- **Aceptación:** ausencia, expiración, fallo RPC o gate restrictivo impiden una decisión económica dependiente de conversiones, aunque el modelo la ponga en `recommendations` en vez de `proposed_writes`.

### A14-010 · Comprobar elegibilidad Meta por tienda antes de gastar

- **Evidencia:** `runOperativaMetaAgent` resuelve la tienda y llama al runner sin comprobar previamente conexión Meta, cuenta asignada/seleccionada, sync de recursos ni observaciones del periodo. El orquestador general parte de conexiones Shopify/Klaviyo; no selecciona A14 a partir de la cobertura Meta. La existencia de pedidos Shopify no demuestra que Meta sea analizable.
- **Mejora:** capacidades por scope: conexión, estado de cuenta, asignación, recursos importados, fechas y permisos; admitir lectura histórica advertida cuando proceda y explicar qué falta para el primer análisis. No lanzar el modelo solo para comunicar un requisito conocido por el backend.
- **Aceptación:** tienda sin Meta, sincronización inicial o conexión en error no consume una generación de rendimiento actual; un fallo de lectura de elegibilidad no se interpreta como conexión válida.

### A14-011 · Exigir selección de tienda coherente con los especialistas Meta

- **Evidencia:** A14 usa `resolveStrictStoreScope`, que sin `connectionId` permite agregado. A23/A24/A25 usan otro resolver que exige selección cuando hay varias tiendas. El cron encola agregado A14 además de tiendas (`ai-runtime.ts:16492–16545`); en agregado, el gate A24 devuelve `store_scope_missing`.
- **Mejora:** política común de scope para Meta: tienda explícita o selección automática si solo hay una; si se conserva agregado, tratarlo como cartera, con moneda/cuentas separadas y sin proponer tareas estratégicas de una tienda implícita. Cuentas no asignadas se gestionan como cobertura pendiente.
- **Aceptación:** dos tiendas/cuentas no se mezclan silenciosamente. La selección del header, API, tools, cache, cola y aprobación identifica el mismo scope.

### A14-012 · Autorizar antes de resolver el alcance con service role

- **Evidencia:** los wrappers A14 de GET y POST llaman al resolver de `shopify_stores` mediante service role antes de `requireMembership`, que llega después en el runner/cache compartido. No se demostró acceso al resultado de otro tenant, pero el orden permite trabajar sobre un scope antes de autorizarlo y distinguir errores previos.
- **Mejora:** comprobar organización/capacidad antes de toda resolución privilegiada; unificar quién puede consultar, ejecutar y decidir, según rol y activación del agente. Mantener respuestas de scope sanitizadas y autorización equivalente en GET/POST/aprobación.
- **Aceptación:** un usuario ajeno no provoca lecturas privilegiadas de otra organización; los recorridos de cliente con/sin consultor, consultor y administrador siguen la política prevista.

### A14-013 · Comunicar estados de cada fuente y suficiencia de observaciones

- **Evidencia:** A14 diferencia errores RPC de ausencia de fila, pero los agregados de acciones usan `coalesce(sum(...),0)` sin cobertura de medición equivalente. Un periodo con gasto y evento/valor sin importar puede parecer cero compras. El aviso de backfill solo aparece en estado `running`; que desaparezca no demuestra integridad de todos los recursos.
- **Mejora:** por fuente, observaciones elegibles/esperadas, filas importadas, eventos disponibles, fechas, backfill completo/parcial/fallido, consulta fallida y nulos. Conservar fuentes sanas y limitar conclusiones según evidencia mínima.
- **Aceptación:** cero real, evento no observado, evento no importado, permisos insuficientes y fallo de consulta no generan la misma tarea. Un aviso de backfill de otra cuenta no certifica la tienda seleccionada.

### A14-014 · Restituir diagnóstico y avisos en el contrato visible

- **Evidencia:** `LEAN_OUTPUT_BY_AGENT.a14_operativa_meta` elimina `answer`, `findings` y `recommendations` (`ai-runtime.ts:5856`). El prompt exige explicación y manda a recomendaciones avisos como revisar un CPM o proponer una pausa. La reproducción del contrato confirma esos tres campos ausentes. Las salidas históricas con answer no permiten atribuirles el contrato local actual.
- **Mejora:** contrato A14 que conserve conclusión, evidencia, avisos, límites y propuestas sin contradicciones entre prompt/schema/parser. Conclusión económica y acciones sugeridas deben permanecer visibles aunque no haya tareas.
- **Aceptación:** A14 puede decir «seguir observando» o «faltan datos» de forma útil, sin inventar una tarea para hacerse visible. Las recomendaciones económicas mantienen gates y necesidad de revisión humana.

### A14-015 · Conectar las prioridades con el objetivo vigente de Mi Camino

- **Evidencia:** el cargador compartido actual, mejorado en A13, ya ofrece a A14 plan aprobado, `goal`, objetivos e hitos de la tienda (`ai-runtime.ts:13977`). A14 no calcula progreso/brecha ni explica sistemáticamente contribución y factibilidad frente a esa meta; su encargo sigue centrado en equilibrio económico agregado.
- **Mejora:** reutilizar progreso determinista y objetivos vigentes, con fecha, unidad, restricciones, capacidad y dependencias. Distinguir mantenimiento del canal de avance estratégico y derivar contradicciones de meta/presupuesto a A19.
- **Aceptación:** una acción puede ser sostenible pero no prioritaria para el objetivo; A14 lo explica. Sin plan aprobado solo propone mantenimiento sustentado, sin crear una meta paralela.

### A14-016 · Conservar identidad de plan/fase/hito y eliminar el fallback

- **Evidencia:** el prompt pide `phase` y `categories`, pero el JSON Schema genérico no los admite; la reproducción confirma también ausencia de `plan_id`. Aunque Zod ahora permite `phase` para A13, el contrato enviado a A14 no la declara. `shouldFallbackToCurrentMilestone` continúa devolviendo `true` para A14 (`agent-task-delivery.ts:86`).
- **Mejora:** contrato propio con plan/version, fase exacta, hito y razón de alineación; `null` real para tarea libre. Vincular únicamente el hito revisado y no elegir el actual por defecto.
- **Aceptación:** tarea libre permanece libre; nombres repetidos no sustituyen UUID/versiones y aprobar no mueve la tarea a una rama que el revisor nunca vio.

### A14-017 · Materializar atómicamente y revalidar la propuesta al aprobar

- **Evidencia:** la revalidación de identidad/estado Camino y la RPC atómica recién incorporadas se aplican a A13. A14 sigue por la creación genérica de tarea y posterior vínculo, y no revalida A24, economía o cuenta objetivo al decidir (`ai-runtime.ts:24390–24570`). Los triggers existentes no equivalen a comprobar la versión analizada.
- **Mejora:** transacción idempotente tarea+vínculo+decisión, verificando organización, tienda, plan aprobado/versionado, hito activo y vigencia material de la evidencia. Si cambió, informar la causa y permitir reanalizar, sin transformar silenciosamente la propuesta.
- **Aceptación:** fallo de enlace no deja una tarea estratégica huérfana; reintentos no duplican. Una aprobación antigua no se fundamenta en un gate A24 expirado o un plan sustituido.

### A14-018 · Etiquetar las tareas como Meta de forma determinista

- **Evidencia:** A14 falta en `AGENT_TASK_CATEGORY`; el fallback es `general` (`ai-runtime.ts:545,23905`). Pedir `categories:[meta]` en el prompt no lo resuelve cuando el JSON Schema genérico excluye ese campo.
- **Mejora:** asignar la categoría base `meta` por código de agente y conservar categorías adicionales solo mediante contrato validado. Comprobar filtros y contadores de todos los consumidores.
- **Aceptación:** tarea A14 aprobada aparece en Meta y en el backlog correcto; no depende de que el modelo consiga devolver una propiedad no declarada.

### A14-019 · Dar herramientas de investigación suficientes y acotadas

- **Evidencia:** ambos entornos solo declaran `search_knowledge`. El contexto A14 contiene gasto agregado, sin desglose de campaña/ad set/anuncio, clientes de canal ni prueba directa de falta de CAPI o fatiga. El prompt sugiere reestructurar, separar públicos, renovar piezas y consolidar conjuntos, decisiones que esos agregados no justifican por sí solos.
- **Mejora:** reutilizar lecturas de campaña/cuenta y evidencia de especialistas bajo demanda, acotadas por tienda, periodo, moneda, paginación, calidad y presupuesto. Vincular cada afirmación a la entidad y al recibo de herramienta; recuperar metodología aplicable cuando se calcule o recomiende una intervención.
- **Aceptación:** puede investigar dónde se concentra el problema sin leer toda la base ni proponer nombres/importes inventados. No se habilitan tools de mutación de Meta para ampliar su capacidad analítica.

### A14-020 · Coordinar A24/A23/A25/A13 y entregar oportunidades útiles a A19

- **Evidencia:** A14 carga el gate A24, pero no consulta explícitamente un resumen fresco de A23/A25/A13/A19 como hace A13 con sus especialistas. El resumen genérico de `consultant-specialist-context.ts` no conserva las propuestas A14; su rama específica de propuestas solo contempla A13. Una salida lean puede perder precisamente el contenido útil para A19 y los planificadores.
- **Mejora:** intercambio acotado y fresco por tienda con run/output/periodo/estado, propuesta, decisión y tarea resultante. La aprobación de una tarea no convierte las hipótesis económicas del análisis en hechos verificados.
- **Aceptación:** A19 y A17 conocen la oportunidad económica y si ya tiene trabajo asignado; A14 no prescribe otra investigación de tracking o creatividad ya abierta y no recibe análisis de otra tienda.

### A14-021 · Aplicar tienda y procedencia al contexto compartido y las alertas

- **Evidencia:** A14 no pasa `storeId` al playbook compartido (`ai-runtime.ts:6250`), aunque el cargador lo soporta. La consulta de alertas omite `store_id` y su helper afirma que la atribución no existe (`shopify-operational-context.ts:43`), cuando esa columna ya existe y A13 la usa. Se pierde evidencia válida y se arrastra contexto no atribuible.
- **Mejora:** filtrar todos los bloques por tienda/entidad y separar explícitamente contexto organizativo sin atribución. Usar alertas de la tienda como evidencia elegible y las legacy solo como contexto; limitar muestras por pertinencia y declarar truncamiento.
- **Aceptación:** una alerta o decisión de B no justifica intervenir en A; la ausencia de alertas de A en una muestra organizativa no se anuncia como tienda sin incidencias.

### A14-022 · Evitar trabajo repetido y conservar el seguimiento posterior

- **Evidencia:** A14 recibe títulos de tareas abiertas y su historial propio, pero no una cadena estructurada oportunidad→decisión→tarea/entidad→resultado por plan. La consulta de tareas tiene límite 100 y ordena prioridad textual. La deduplicación por título no cubre reformulaciones, diferentes agentes ni tareas completadas/ignoradas con el mismo problema.
- **Mejora:** identidad de oportunidad por tienda/cuenta/entidad/métrica/ventana; reutilizar trabajo existente, resultados declarados y razones de descarte. Prioridad semántica explícita y cobertura del backlog. Revisar posteriormente métricas comparables sin atribuir causalidad solo porque una tarea se cerró.
- **Aceptación:** A14 no vuelve a proponer lo ejecutado o rechazado sin evidencia nueva; explica qué cambió y qué sigue sin comprobar, conservando enlaces auditables.

### A14-023 · Conservar responsable, criterio de cierre y revisión de la tarea

- **Evidencia:** el esquema genérico permite owner, criterio de cierre y métrica, pero la descripción/metadata de entrega se enriquecen específicamente para A13/A17/A18; A14 no usa esos contratos (`agent-task-delivery.ts:100`, `ai-runtime.ts:24430`). La misión del prompt es «trabajo del consultor», sin un contrato de entrega equivalente.
- **Mejora:** persistir responsable adecuado, entidad afectada, evidencia de partida, entrega comprobable, criterio de medición, dependencia A24/A19 y revisión relativa. No convertir una sugerencia temporal en fecha dura inventada ni repartir automáticamente presupuesto entre campañas.
- **Aceptación:** la tarea es ejecutable sin reabrir el análisis para reconstruir su razón, y completar una configuración no acredita haber mejorado el ROAS.

### A14-024 · Hacer visible la función, el diagnóstico y el scope en la UI

- **Evidencia:** `consultantOnly:true`, GET condicionado por `asConsultant` y `WorkQueue` sustituyen una ficha de diagnóstico. Si hay output, no aparece el botón local de lanzamiento, reservado a ausencia de resultado. La cola usa `/operations` sin conexión y el texto promete propuestas sobre «esta cuenta» aunque el scope puede ser agregado.
- **Mejora:** presentación por capacidades reales: función, objetivo/tienda/cuentas, periodo, fecha del análisis y de fuentes, gate A24, cobertura, conclusión, avisos, actualización y motivo de bloqueo. Definir visibilidad y decisión para cliente con/sin consultor; pasar scope a operaciones y contexto del copiloto.
- **Aceptación:** el usuario distingue diagnóstico de propuesta y tarea materializada, sabe cómo/cuándo se ejecuta A14 y ve únicamente trabajo del alcance presentado. No se oculta un análisis útil solo por carecer de consultor.

### A14-025 · Separar diagnóstico actualizado y buzón durable de propuestas

- **Evidencia:** `shouldRequireHumanApproval` devuelve true con `required_before_publish` incluso con cero propuestas (`ai-runtime.ts:791`). En test hay dos salidas A14 sin tareas pendientes de aprobación. El gate compartido puede frenar nuevos análisis durante tres días y el GET solo recupera el último éxito.
- **Mejora:** cero escrituras no equivale a acciones pendientes; mantener diagnóstico vigente y todas las propuestas sin resolver en un buzón durable, con sus decisiones/tareas, sin que unas bloqueen la observación de una señal nueva.
- **Aceptación:** una incidencia nueva puede analizarse mientras queda otra propuesta por revisar; refrescar no oculta propuestas antiguas y una salida sin tareas no congela A14.

### A14-026 · Deduplicar ejecuciones y reservar cuota manual por tienda

- **Evidencia:** la ruta valida `Idempotency-Key` pero pasa `undefined` a las opciones A14 (`server.ts:10259`); `ClientMeta` ni siquiera envía esa cabecera. A14 no participa en la reserva atómica incorporada a otros agentes (`ai-runtime.ts:5606`) y su cuota se comprueba contando runs antes de crear otro.
- **Mejora:** clave durable de petición y trabajo equivalente por organización/tienda/ventana/revisión, reserva atómica, exclusión cron/manual y recuperación verificable de run/output tras desconexión. El cliente debe conservar la clave al reintentar la misma operación.
- **Aceptación:** doble clic, dos pantallas/usuarios o solapamiento cron/manual no pagan generaciones equivalentes; el último cupo no se concede dos veces y una respuesta perdida permite recuperar el resultado.

### A14-027 · Repartir la programación por elegibilidad, espera y relevancia

- **Evidencia:** A14 comparte cupos y prioridad organizativa, detrás de agentes previos, sin reparto específico entre tiendas; prioriza agregado antes de tiendas. La cadencia declarada de dos runs no garantiza ejecuciones por scope y puede convivir con conexiones Meta indisponibles. No hay gates A14 de los últimos siete días en los entornos consultados.
- **Mejora:** candidatos desde cobertura Meta por tienda, primer diagnóstico recuperable y prioridad por antigüedad de espera/riesgo económico para la meta; evitar que el agregado o una tienda agote los cupos. Hacer explícita la dependencia A24 y el motivo de aplazamiento.
- **Aceptación:** una tienda pequeña no queda indefinidamente pospuesta; los horarios UI se describen como evaluaciones y el operador puede distinguir pausa, cuota, espera, error de datos y falta de worker.

### A14-028 · Persistir un digest del contexto económico realmente utilizado

- **Evidencia:** el cron calcula un digest organizativo pero no lo pasa al runner A14 (`ai-runtime.ts:17490`); A14 tampoco calcula uno propio. En test faltan 2/3 y en producción 28/28. Un digest organizativo mezcla tiendas y no identifica directamente revisiones de objetivo, coste, atribución o A24.
- **Mejora:** huella determinista de scope, fuentes/versiones, ventana, costes, evento/atribución, sync, objetivos/hitos y gate A24 efectivamente usados. Guardarla junto al snapshot y usarla en cache/scheduler; distinguir fallo al calcularla de ausencia de cambios.
- **Aceptación:** actividad ajena de B no regenera A; cambios relevantes de A reconsideran el análisis conforme a la cadencia. La caducidad temporal de la evidencia sigue funcionando aunque no se modifique ninguna fila.

### A14-029 · Alinear frescura de cache, envelope y fuentes

- **Evidencia:** A14 no entra en la lista que adapta TTL a cadencia efectiva ni en la que sobrescribe la frescura del envelope (`ai-runtime.ts:7023,7097`). Tampoco consulta cobertura Meta/financiera/A24 al servir su cache. Puede conservar un último éxito tras desconexión o cambio material de evidencia.
- **Mejora:** política única por scope con edad del análisis, fuente, gate, objetivo y cadencia configurada. Mantener histórico útil advertido y separar `fresh`, `stale`, `partial` y `unavailable` sin rejuvenecer datos antiguos por una generación reciente.
- **Aceptación:** `stale:true` no coexiste con envelope fresco; fecha inválida, fuentes antiguas, conexión en error y A24 vencido producen un estado coherente en todas las superficies.

### A14-030 · Reducir contexto y medir el coste de investigación útil

- **Evidencia:** A14 mantiene F9/F11 completos y playbook sin scope mientras A13 ya los filtra. Dos de los tres runs de test tienen `context_truncated`; los dos éxitos medidos OpenAI usan hasta 64.319 tokens de entrada. El dato no permite atribuir todo el coste a esos bloques, pero justifica revisar qué se pierde al truncar.
- **Mejora:** presupuesto por bloque, prioridad para evidencia económica/gates/objetivo y resúmenes de historial acotados; detalle bajo demanda con recibos. Conservar cobertura, fechas y advertencias antes de truncar; registrar tamaños enviados y modelo/proveedor efectivo.
- **Aceptación:** una organización con mucho historial no pierde los límites financieros relevantes. Medir tokens/latencia/calidad de la tarea antes y después; optimizar contexto sin quitar evidencia necesaria.

### A14-031 · Unificar observabilidad, preferencias y configuración versionada

- **Evidencia:** los errores de `loadDisabledAgents` se convierten en mapa vacío (`ai-agent-groups.ts:24`); algunas salidas tempranas del tick no persisten gates. Los éxitos de test carecen de `deployment_version`, mientras la configuración histórica documentada como «cerrada» no acredita el recorrido actual. Los checksums de prompts A14 se generan desde etiquetas literales, no desde el contenido completo.
- **Mejora:** ficha operativa con activación, capacidades y dependencias; tick/gate/run/output/decisión enlazados y versión efectiva de API/worker/UI/prompt/schema/tools. Fallo de lectura de preferencias debe impedir habilitar gasto por omisión. Versionar cambios canónicos en repositorio/migraciones y comprobar historial+definición real en ambos entornos.
- **Aceptación:** se explica por qué una tienda no tiene A14 y qué debe ocurrir para generarlo; se distingue modelo configurado/efectivo y código local/desplegado. No se necesita una edición manual de prompt que otro proceso pueda sobrescribir.

### A14-032 · Probar el recorrido propio de A14 y evaluar sus afirmaciones

- **Evidencia:** pasan 88 pruebas focalizadas y un contrato estático A14 v2, pero la prueba A14 busca patrones de texto y no ejecuta el runner/aprobación. La suite A24 comprueba la presencia del loader y su `unknown`, lo que no demuestra que A14 bloquee una recomendación de inversión. El catálogo eval declara que las tareas llevan fase, aunque el JSON Schema A14 no la ofrece.
- **Mejora:** regresiones del contrato real, autorización/scope, loader, SQL y materialización con fixtures; casos de moneda/nulos/costes/ventanas/atribución/A24, idempotencia/concurrencia/fallos parciales y roles. Evaluar por separado exactitud de afirmaciones, abstención, duplicados, proporcionalidad de acción y alineación con Camino, enlazando snapshot y recibos exactos.
- **Aceptación:** recorrido aislado sync→tick→diagnóstico→decisión→tarea/hito→seguimiento, sin acciones comerciales reales; cero escalados por datos no comparables y cero enlaces a plan distinto del revisado. Una suite verde o un éxito sin tokens no acredita calidad semántica ni un E2E desplegado.

### Verificación y límites de esta auditoría A14

- **89/89 pruebas aprobadas:** 88 desde `apps/api` con `npx tsx --test --test-force-exit src/marketing-store-scope.test.ts src/shopify-operational-context.test.ts src/meta-measurement-verdict.test.ts src/meta-diagnostic-evidence.test.ts src/meta-cost-rates.test.ts src/meta-purchase-action-type.test.ts src/meta-insight-numbers.test.ts src/a24-meta-scope.test.ts src/agent-task-delivery.test.ts src/consultant-specialist-context.test.ts src/ai-runtime-envelope.test.ts src/agent-schedule.test.ts src/ai-diagnostic-activity-gate.test.ts`; y una prueba desde `packages/ai` con `npx tsx --test --test-name-pattern='A14 v2' src/agent-canonical-prompts.test.ts`.
- **Reproducción local del contrato efectivo:** `buildLeanOutputContract` con los campos omitidos de A14 confirma ausencia de answer/findings/recommendations y de phase/categories/plan_id en las propuestas; milestone_id sí existe. No se llamó al modelo.
- **Fixtures sintéticos, sin persistir:** SQL `VALUES` reproduce 31 días inclusivos y un día compartido, y suma de gasto 200 frente a 100 al existir dos variantes de atribución. Ejemplo aritmético local diferencia aproximación de equilibrio y fórmula con costes, además de CPA/CAC. Los duplicados de gasto no se observaron en los datos remotos y los ejemplos no cuantifican perjuicio real.
- **Lecturas remotas:** agente/prompt/tools, overrides, historial de las dos migraciones A14, hashes/definiciones de RPC, índices, agregados de runs/gates, estados de conexiones/cuentas/cache A24 y contadores estructurales de output. Los fallos de proveedor leídos son históricos; no se consultaron claves, se generaron salidas ni se aprobaron tareas.
- **Grafo MCP:** utilizado para descubrir runner, scope, herramientas y lectores; los snippets de `ai-runtime.ts` tenían offsets antiguos y se contrastaron con el archivo actual. No se reconstruyó el grafo.
- **Límites:** no se hizo sesión autenticada de navegador, llamada real al LLM/Meta, ejecución del worker, carga, carrera Postgres ni prueba RLS con tenants impersonados. Las pruebas actuales no sustituyen esos recorridos y la auditoría no afirma que la build local esté desplegada.
- **Implementación posterior:** cambios A14 en `ai-runtime.ts`, contratos de `packages/ai`, UI Meta, worker y materialización de tareas; migración `20270102120000_a14_operational_integrity.sql` registrada en test y producción. En ambos entornos se confirmó A14 v3 activo, checksum idéntico, reserva manual por tienda, materialización atómica y deduplicación canónica de gasto Meta.
- **Verificación de implementación:** TypeScript sin emisión pasa en `packages/ai`, `apps/api` y `apps/web`; el build de `@e-nora/ai` pasó. No se ejecutó una generación real del modelo, un tick de worker ni un recorrido autenticado en navegador; esos límites siguen aplicando a la validación del comportamiento desplegado.

## A15 · Análisis visual y mejora de creativos de Instagram y Meta Ads

**Auditoría: 19 de octubre de 2026. Estado: 34 mejoras registradas, pendientes de implementación. Esta pasada solo modifica documentación.** Incluye código local, descubrimiento y trazado con el grafo MCP, definiciones y metadatos de test y producción, pruebas existentes y una reproducción sintética sin persistencia. Los hallazgos de código describen el worktree; no certifican qué build de API, worker o web está desplegada.

El alcance solicitado cubre **Instagram y Meta Ads**, con la misma importancia o mayor para los creativos publicitarios. A15 ya se llama «Analista visual multicanal» en las dos bases. El nombre antiguo de Instagram permanece en contratos, rutas y UI; cambiar etiquetas no basta para completar el soporte de Meta.

La capacidad debe separar tres resultados: **observaciones de la pieza**, **diagnóstico de diseño aplicado a un brief** e **hipótesis apoyadas en resultados del canal**. A15 puede describir y detectar problemas visuales; A16/A11 materializan texto y borradores; A23 aporta la lectura de rendimiento pagado y A24 su fiabilidad. Ninguno puede deducir ventas, causalidad o una creatividad «ganadora» solo mirando píxeles. Esta separación permite ampliar A15 sin duplicar agentes ni convertir cada análisis de una imagen en una llamada con herramientas innecesarias.

### Recorrido observado y puntos de integración

| Entrada o consumidor | Comportamiento comprobado | Mejora que debe cubrir |
|---|---|---|
| Subida manual | POST de imagen base64; deduplicación por organización/checksum; fuente `instagram/manual_upload`; almacenamiento público. | Elegir destino y tienda, originales privados, validación de imagen completa y atribución correcta de procedencia. |
| Importación Meta | Lista hasta 100 activos `image/video` con URL; copia imágenes o miniaturas a un bucket privado; guarda enlace al activo. | Medio recuperable en creatividades simples, identidad estable entre sincronizaciones, alcance de cuenta/tienda y conservación del tipo de representación. |
| Worker | Evalúa la cola cada minuto; reclama hasta tres filas globales y procesa en serie. | Lease recuperable, reparto entre organizaciones, pausas explícitas y confirmación de persistencia. El tick no garantiza una ficha en un minuto. |
| Runner A15 | Lee prompt v2, adjunta una imagen, devuelve descripción/composición/OCR/colores/uso/inferencias/alt text/confianza; sin tools. | Contrato creativo más útil, evidencia reproducible, tipo de medio y políticas de coste efectivas. |
| RAG | Convierte la ficha a markdown, genera embeddings y crea un documento `visual_asset`. | Confianza y procedencia completas, revisión humana real, scope y reemplazo recuperable. |
| A16 y A11 | El editor usa imagen y markdown; el caption se genera como `instagram_organic`. | Handoff con IDs/revisiones, brief de canal y producto, incluyendo el recorrido específico de Meta. |
| A23 | Busca vínculos Meta en el banco y adjunta bytes privados directamente. | Reutilizar atributos A15 con versión y conservar la relación muchos-a-muchos anuncio/creativo/activo/periodo. Hoy adjuntar la imagen a A23 no equivale a reutilizar la ficha A15. |
| Copiloto del estudio | Busca fichas de imágenes analizadas del bucket público por organización. | Acceso autorizado a referencias privadas y tienda seleccionada; una URL firmada temporal no debe guardarse como URL pública de una pieza. |
| Biblioteca web | Filtros locales sobre 300 imágenes, importador Meta, ficha y edición markdown; polling mientras hay trabajo. | Paginación, contexto de tienda, confianza, recuperación de previews y estados de A15 correctamente nombrados. |

Referencias principales: `apps/api/src/meta-sync.ts:995,1050,1411`; `apps/api/src/instagram-image-bank.ts:70,154,283,348,526,702,775,841,888,938,1090,1229,1450,1560`; `apps/api/src/ai-runtime.ts:15324,15474,21114`; `apps/api/src/studio-ai-chat.ts:348`; `packages/ai/src/index.ts:2637`; `apps/web/src/app/marketing/imagenes/page.tsx:145`; `apps/worker/src/repeatable-jobs.ts:25`; `apps/api/src/server.ts:10876,12218`.

### Estado remoto leído en esta auditoría

Se consultaron configuración, estructura, restricciones, políticas, estados y agregados. No se leyeron imágenes de clientes, OCR, textos narrativos de fichas, anuncios ni credenciales; no se generaron análisis ni se modificaron datos.

| Comprobación | Test · `kopcblejsxpkxoykldyh` | Producción · `cthjwpeygpzwdmjkxeqa` |
|---|---|---|
| Nombre / agente / prompt activos | Analista visual multicanal / v2 / v2 | Igual |
| Modelo declarado / tools / aprobación | `claude-sonnet-5` / `[]` / `none` | Igual |
| Checksum del prompt igual al hash de su contenido | No | No |
| Migración de procedencias `20261115470000` | Registrada | Registrada |
| Banco visual | Una imagen analizada, pública, con RAG y fingerprint | Cero filas |
| Procedencias | Una subida manual Instagram; ninguna Meta | Cero filas |
| Activos `image/video` en `meta_creative_assets` | Cero | Cero |
| Runs A15 | Siete éxitos OpenAI/`gpt-6-luna` entre 09/10 y 12/10; otro éxito histórico con cero tokens/coste | Ninguno registrado |
| Metadatos de runs | Los ocho carecen de tienda y versión de despliegue; siete tienen hash de prompt | Sin runs que comprobar |
| Origen del documento visual | `human_approved_ai` | Sin documentos visuales |
| Buckets | `marketing-assets` público; `marketing-source-assets` privado; 5 MiB | Igual |
| RLS de banco/procedencias | SELECT por acceso a organización; no filtro de tienda en esas políticas | Igual |
| FK procedencia → activo Meta | `ON DELETE CASCADE` | Igual, comprobada por definición remota |

Los siete runs de test con consumo suman 11.383 tokens de entrada, 1.987 de salida y 0,002131 USD **registrados**. No son un benchmark de calidad/coste de Meta ni explican por sí solos por qué se generaron siete veces. El éxito sin consumo no demuestra una llamada real. La ausencia de activos/runs en producción tampoco demuestra que el worker esté caído: solo limita lo que puede certificarse con esos registros.

### A15-001 · Conservar la identidad de los activos Meta entre sincronizaciones

- **Evidencia:** `syncAdAccountStructure` borra todas las filas de `meta_creative_assets` de cada creativo y vuelve a insertarlas (`meta-sync.ts:1050–1078`). La FK desde `marketing_visual_asset_sources` tiene `ON DELETE CASCADE`, confirmado en producción. Por tanto, ese recorrido elimina los enlaces de procedencia antes de recrear activos con nuevos IDs; la copia del banco puede sobrevivir sin vínculo Meta.
- **Mejora y aceptación:** definir una identidad natural estable por creativo/tipo/referencia/posición cuando corresponda; actualizar in-place y reconciliar bajas sin destruir procedencias históricas. Ejecutar dos sincronizaciones del mismo creativo y comprobar que conserva IDs, vínculos, análisis y evidencia de A23; una variante retirada queda distinguible de una vigente. No limitar la corrección a quitar el cascade ni usar el texto o la posición como única identidad universal.

### A15-002 · Hacer importables las creatividades simples de Meta

- **Evidencia:** `buildMetaCreativeAssetRows` crea la fila `image` solo con hash o `video` solo con ID, y guarda `creative.thumbnail_url` en otra fila `thumbnail`. El listado/importador acepta `image/video` con URL, pero no relaciona esa miniatura separada. Con fixtures de creatividad simple imagen+miniatura y vídeo+miniatura, el pipeline actual produce respectivamente `[image,thumbnail]` y `[video,thumbnail]`, con **cero representaciones importables en ambos casos**.
- **Mejora y aceptación:** resolver el medio de la creatividad fija con referencias fiables y permisos actuales, asociar la miniatura al activo correcto y distinguir original de preview. Si solo hay hash/ID, recuperar la representación por el adaptador Meta autorizado o declarar su indisponibilidad. Pruebas desde normalización/sync hasta candidato/importación para imagen fija, vídeo con miniatura, feed dinámico y creativo sin medio; el enlace no debe depender de que una variante traiga casualmente `entry.url`.

### A15-003 · Aplicar scope de tienda y cuenta a toda la biblioteca

- **Evidencia:** banco y procedencias no tienen `store_id`; las consultas del importador/listado y los consumidores filtran organización, no tienda. `requireBankAccess` comprueba organización/rol y las políticas remotas son organizativas. La UI dice «El banco de imágenes es de cada tienda» sin seleccionar ese scope. No se ha demostrado una fuga real entre clientes; sí falta una frontera explícita entre tiendas de una misma organización.
- **Mejora y aceptación:** asociaciones de activo a tienda/cuenta y compartición organizativa explícita; comprobar permisos al listar, importar, firmar, editar, borrar y utilizar en agentes/RAG. Resolver cuenta Meta → tienda desde servidor. Un usuario restringido a A no ve ni utiliza B; un recurso compartido aparece como tal y no hereda silenciosamente otro producto, marca u objetivo. Mantener deduplicación física sin deduplicar permisos.

### A15-004 · Separar procedencia, representación y destino de uso

- **Evidencia:** toda subida manual se registra como `instagram/manual_upload`, aunque pueda destinarse a Meta. La importación guarda `asset_type` e `imported_representation` en `source_metadata`, pero `attachVisualAssetSources` solo devuelve canal/tipo de fuente y el runner recibe únicamente `sourceChannels`. Añadir Meta a una imagen ya analizada no modifica el fingerprint ni asegura un análisis actualizado de esa procedencia.
- **Mejora y aceptación:** DTO común con fuente verificada, destinos autorizados, tienda/cuenta, versión del activo y `static_image/video_thumbnail/frame/...`; separar percepción reutilizable de contexto de uso. Una subida destinada a ambos canales no se presenta como publicación real de Instagram; una miniatura sigue identificada como miniatura en input, análisis, markdown, UI y handoffs, incluso tras deduplicación o sincronización.

### A15-005 · Explicar A15 y ambos canales en las superficies del producto

- **Evidencia:** la UI muestra «A11 la está describiendo» en estados, detalle y vacío (`imagenes/page.tsx:141,766,1079`), aunque el procesador llama a A15. No presenta una ficha de capacidad/estado que explique qué analiza, cuándo se dispara y qué significa estar en cola. La confianza está en el tipo recibido pero no se muestra en el detalle leído.
- **Mejora y aceptación:** nombrar A15 y cubrir Instagram/Meta en biblioteca, importador, ficha y accesos desde campañas; distinguir describir, revisar diseño y generar una variante. Mostrar estado, fecha, revisión, confianza y límites del medio; explicar «en espera por cuota/configuración» y worker sin actividad frente a «analizando». No prometer análisis de vídeo completo desde una miniatura.

### A15-006 · Incorporar un diagnóstico creativo estructurado y accionable

- **Evidencia:** el contrato actual ofrece descripción, objetos, colores, estilo, composición, proporción estimada, OCR, uso, inferencias, alt text y confianza. No identifica de forma estructurada producto protagonista, mensaje visible, oferta, CTA, jerarquía, legibilidad, demostración, prueba social o problemas concretos de diseño. `suggested_use` es texto libre.
- **Mejora y aceptación:** mantener observaciones neutrales y añadir una evaluación aplicada opcional: elemento observado, ubicación, problema, evidencia, gravedad de diseño, cambio sugerido e incertidumbre. Clasificar recursos creativos solo cuando sean visibles; separar ausencia, ilegibilidad y desconocido. Una recomendación debe permitir crear un brief concreto de variante; no producir notas arbitrarias de «potencial de ventas» ni declarar autenticidad de testimonios o claims a partir de la imagen.

### A15-007 · Medir formato y calidad técnica antes de pedir inferencias al modelo

- **Evidencia:** se guarda MIME/tamaño en bytes y el modelo estima `aspect_ratio_estimate`; el banco no conserva dimensiones, orientación, resolución útil o geometría de recorte. El editor usa ratios solicitados sin que A15 disponga del recorte final ni del placement real.
- **Mejora y aceptación:** calcular dimensiones, orientación y ratio real mediante decodificación controlada; evaluar recorte, nitidez/tamaño útil y zonas de texto sobre la composición renderizada. Reglas de placement documentadas y versionadas por adaptador, sin fijar especificaciones externas no comprobadas. Una estimación visual no contradice la medida física; los avisos diferencian original, recorte y export final y permiten ver qué quedaría cortado.

### A15-008 · Conservar OCR, evidencia y confianza por hallazgo

- **Evidencia:** OCR es una cadena única y confianza un enum global. No se localizan fragmentos ilegibles ni se asocia incertidumbre a un objeto, producto o claim. El markdown exportado omite `confidence`; una extracción dudosa puede llegar a otro agente sin esa advertencia.
- **Mejora y aceptación:** OCR por fragmentos/regiones con texto literal, ubicación y legibilidad; observaciones e inferencias diferenciadas y confianza/advertencia por hallazgo. Conservar también la confianza global en DTO, UI, markdown y contexto reducido. Precio parcialmente visible, texto pequeño, multilingüe y claims ambiguos no se completan ni convierten en hechos de catálogo; OCR vacío no equivale automáticamente a ausencia de texto.

### A15-009 · Ampliar el soporte de vídeo con un contrato temporal propio

- **Evidencia:** la implementación de vídeo solo utiliza `thumbnail_url`; no descarga ni analiza secuencias, audio o montaje. Es una limitación explícita, no soporte de vídeo completo. Para creativos publicitarios esta representación no permite analizar hook, demostración, ritmo o cierre.
- **Mejora y aceptación:** flujo asíncrono y acotado de vídeo autorizado: duración/tamaño, fotogramas o escenas con timestamps, OCR temporal y transcripción cuando esté disponible, advertencias y presupuesto previo. Describir únicamente segmentos observados; un muestreo no se presenta como cobertura integral. Permitir miniatura como modo económico separado. Probar fallo parcial, vídeo sin audio, escenas repetidas, duración excesiva y permisos; no introducir publicación ni cambios de gasto como efecto de analizar.

### A15-010 · Representar carruseles y creatividades dinámicas como conjuntos

- **Evidencia:** A15 recibe una sola imagen por run; los activos del feed se analizan de forma independiente y el banco no representa el orden/historia del carrusel ni combinaciones realmente servidas. El editor sí admite varias diapositivas, por lo que existe un consumidor que necesita continuidad entre piezas.
- **Mejora y aceptación:** entidad de conjunto con orden, portada, variantes, textos y reglas conocidas; análisis individual reutilizable más síntesis de secuencia. Diferenciar combinaciones posibles de piezas entregadas por el proveedor. Revisar continuidad, repetición, progresión y CTA sin atribuir el resultado del anuncio a cada componente; reordenar un carrusel invalida la síntesis y conserva los análisis individuales válidos.

### A15-011 · Aplicar marca, producto y objetivo sin contaminar la observación

- **Evidencia:** el runner visual solo recibe metadatos de archivo/canales y asignación de consultor; no carga marca, producto, brief, público o finalidad. La descripción neutral es apropiada, pero no puede resolver por sí sola coherencia con una campaña ni veracidad de un precio o atributo.
- **Mejora y aceptación:** dos niveles explícitos: extracción visual del activo y revisión de su adecuación a un brief autorizado de la misma tienda. Resolver producto/variante y claims desde fuentes reales, con IDs y fecha; objetivo/público como contexto declarado, no como hechos percibidos. Cambiar el objetivo no debe pagar otra extracción idéntica, pero sí reconsiderar el diagnóstico aplicado. Si falta contexto, solicitarlo en el flujo y conservar el análisis visual útil.

### A15-012 · Hacer reutilizable la biblioteca mediante búsqueda autorizada

- **Evidencia:** A15 no necesita tools para ver la imagen ya adjunta; esa decisión sigue siendo válida. Sin embargo, la búsqueda de biblioteca es local y el estudio usa una consulta propia sobre fichas públicas. No hay un contrato común de descubrimiento por producto, atributos, medio, tienda, revisión y disponibilidad que puedan reutilizar los agentes consumidores.
- **Mejora y aceptación:** servicio de búsqueda y resolución de activos con filtros y paginación; exponer herramientas de lectura pequeñas a los consumidores que deban buscar referencias, con IDs/recibos, cobertura y autorización. El modelo no recibe URLs arbitrarias ni un catálogo completo. Encontrar una pieza privada no la publica: su uso en una exportación requiere una referencia válida y una decisión explícita del flujo de publicación.

### A15-013 · Conectar atributos A15 con A23 sin perder relaciones ni periodos

- **Evidencia:** A23 adjunta imágenes desde las procedencias Meta, pero no consulta el análisis/fingerprint A15 en ese recorrido. `assetIdToAd` es un `Map<assetId,adId>`: si varios anuncios usan el mismo activo, la asignación posterior pisa la anterior. El loader limita además a una imagen por anuncio; no demuestra que un atributo concreto explique el rendimiento de un conjunto dinámico.
- **Mejora y aceptación:** referencias muchos-a-muchos entre anuncio, creativo, activo, análisis y periodo de asignación; reutilizar atributos A15 compatibles y mantener bytes como evidencia cuando corresponda. Declarar si representan todo el periodo o solo un snapshot. A23/A24 conservan métricas, muestra y atribución; comparación de estilos como hipótesis contrastable, con confusores visibles. Dos anuncios que comparten imagen mantienen ambos vínculos y sus resultados separados.

### A15-014 · Materializar mejoras como briefs y variantes de Instagram o Meta

- **Evidencia:** la integración directa lleva al editor A16 y al caption A11 con `channel: instagram_organic`. No se encuentra en ese recorrido un handoff equivalente de la ficha A15 a una variante Meta con campaña/producto/revisión identificados.
- **Mejora y aceptación:** acción desde un hallazgo que construya un brief revisable con activo base, objetivo, destino/placement, restricciones y cambios exactos; enviarlo a A16/A11 o al generador adecuado. Devolver borrador/editor real e IDs, con idempotencia y revisión esperada. El brief no cuenta como variante terminada; generar no publica anuncios, no sobrescribe el original y no cambia presupuesto.

### A15-015 · Cerrar el ciclo entre original, edición, export y aprendizaje

- **Evidencia:** el banco conserva una ficha actual y los overlays tienen sus propios datos; A15 no identifica en su contrato qué cambios se aplicaron ni qué export final terminó usándose. Una ficha del original no prueba cómo queda el texto sobreimpreso o el recorte final.
- **Mejora y aceptación:** linaje de variantes con revisión del brief, activo origen, render/export y vínculo al borrador/publicación/anuncio si existe; volver a comprobar la pieza final y registrar qué hallazgos se resolvieron. Incorporar aprobación/corrección humana y resultados por canal con ventana/muestra sin autovalidar inferencias. Poder comparar original y variante y recuperar la evidencia exacta que sustenta una conclusión.

### A15-016 · Validar imágenes completas y acotar recursos de ingestión

- **Evidencia:** subida manual y descarga Meta verifican cabeceras de bytes/MIME y hasta 5 MiB, pero no decodifican para verificar integridad, número de fotogramas o tamaño descomprimido. La subida admite GIF; Meta usa solo PNG/JPEG/WebP. `Buffer.from(...,'base64')` es tolerante y el `try/catch` no garantiza una validación estricta del contenido.
- **Mejora y aceptación:** validación de base64 y decodificación segura con límites de píxeles, frames, memoria y tiempo; identificar animaciones y normalizar una representación compatible cuando sea necesario. Conservar hash del original y de la representación; eliminar metadatos no necesarios de la copia de trabajo sin alterar el significado visual. Archivos truncados, falsos positivos de magic bytes y animaciones no se envían como imágenes estáticas completas ni provocan consumo ilimitado.

### A15-017 · Separar originales privados de assets publicados

- **Evidencia:** las subidas manuales se guardan en el bucket público `marketing-assets`; las copias de Meta en uno privado. Si una imagen pública ya existe por checksum, importarla desde Meta reutiliza esa fila. A23 exige metadatos de almacenamiento privado y puede rechazar esa misma imagen pese a tener procedencia Meta; el estudio, en sentido inverso, solo busca el bucket público.
- **Mejora y aceptación:** originales y análisis privados por defecto, con un resolver común; publicar/copiar derivados durables solo en el paso autorizado que los necesita. Migrar referencias sin romper emails o piezas ya publicadas. Probar subir primero/importar después y el orden inverso: misma evidencia visual, permisos correctos y reutilización equivalente en A16/A23/estudio. Una URL conocida de original privado no da acceso público. La diferencia entre buckets y acceso por URL está documentada por [Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

### A15-018 · Resolver disponibilidad y renovación del medio Meta

- **Evidencia:** `available` solo indica que existe una cadena de URL; la importación intenta la URL persistida y, si falla, devuelve 502 con invitación a sincronizar. No recupera una representación actual por referencia. La descarga ya protege hosts HTTPS, DNS fijado a IP pública, redirecciones y bytes; conviene conservar esas barreras.
- **Mejora y aceptación:** estados de disponibilidad con fecha/cobertura; refresco autorizado por ID/hash ante URL vencida, fallback de preview identificado y fallo tipado cuando no sea recuperable. Deadline global del download con límites agregados de redirección y reintentos, sin exponer tokens de URL. Una conexión inactiva o un permiso revocado no se describe como «sin creatividades»; renovar el medio no debe perder la procedencia ni duplicar análisis iguales.

### A15-019 · Recuperar trabajos reclamados sin duplicar gasto

- **Evidencia:** la cola pasa hasta tres filas de `queued` a `analyzing` y procesa en serie. No hay lease, heartbeat, identificador de reclamación ni recuperación de `analyzing` abandonados. Una caída del proceso o excepción antes de terminar deja filas que el selector y el botón de retry no recuperan.
- **Mejora y aceptación:** claim atómico con propietario, vencimiento y límite de concurrencia; renovación durante operaciones largas y recuperación segura. Finalizar solo con el token vigente, comprobando borrado/cancelación y revisión del activo. Simular caída antes/durante/después de la llamada y dos workers: recuperar trabajo, reutilizar un resultado ya persistido y evitar que una respuesta tardía sobrescriba otra revisión.

### A15-020 · Repartir la cola y programar esperas entre organizaciones

- **Evidencia:** se eligen las tres imágenes globalmente más antiguas. Si su organización está sin presupuesto o con circuito abierto, vuelven a `queued` sin cambiar orden ni fecha de próximo intento; pueden ocupar siempre el lote y posponer trabajo elegible de otros clientes.
- **Mejora y aceptación:** `next_attempt_at`, razones de bloqueo persistidas, selección justa por organización y límites por tick/cliente; excluir temporalmente trabajo inelegible. Una organización con tres trabajos antiguos bloqueados no impide que otra procese su imagen. Medir edad de espera y distinguir cola, cuota, pausa, fallo de proveedor y ausencia de worker; evitar reconsultas costosas cada minuto para la misma pausa.

### A15-021 · Clasificar reintentos, pausas y reparación de indexación

- **Evidencia:** el runner convierte cualquier excepción en `retriable:true`; la cola corta a tres intentos. Fallos permanentes de imagen, salida inválida, agente desactivado o fallo transitorio pueden consumir la misma política. El retry de una imagen ya analizada vuelve a generar visión aunque el problema sea únicamente RAG.
- **Mejora y aceptación:** errores tipados con backoff/jitter y estados distintos para permanente, transitorio, cuota/configuración y cancelación. Indexar/reparar RAG y refrescar preview sin volver a pagar análisis; una reextracción voluntaria tiene clave propia y limitación de frecuencia. Agente desactivado queda pausado, archivo corrupto falla de forma explicable y timeout transitorio conserva sus intentos y programación recuperables.

### A15-022 · Confirmar persistencia antes de anunciar éxito

- **Evidencia:** el error del `update` que reclama trabajo se ignora; varios updates de cola y el guardado final no comprueban `error` ni filas afectadas, pero se incrementa `processed`. El runner marca el run como completado antes de que la ficha se guarde en el banco. Un fallo de DB puede devolver «procesado» sin un artefacto utilizable.
- **Mejora y aceptación:** distinguir generación del modelo y materialización del análisis; almacenar el resultado recuperable y finalizar banco/run mediante operación idempotente con revisión/claim. Confirmar errores y filas afectadas en cada transición. Inyectar fallo tras la llamada y recuperar el resultado sin volver a generarlo; no emitir éxito de materialización ni contadores falsos cuando la fila ya no existe o el write falla.

### A15-023 · Hacer importación y deduplicación idempotentes por origen

- **Evidencia:** se descarga Meta antes de comprobar si esa referencia ya fue importada; la deduplicación opera por checksum. `ensureMetaImageSource` usa `ignoreDuplicates:true`: si el mismo origen entrega bytes distintos, el vínculo único puede seguir apuntando a la imagen anterior y la importación nueva devolver éxito. Subida/copia, fila y procedencia se guardan en operaciones separadas; no todos los fallos de inserción limpian storage.
- **Mejora y aceptación:** identidad/versionado de origen más checksum, idempotencia por solicitud y reconciliación transaccional de filas, con compensación/reparación del objeto de storage. Detectar origen sin cambios antes de descargar cuando la referencia fiable lo permita. Probar importaciones simultáneas, un origen cuyo contenido cambia y error en cada etapa: una vinculación correcta por revisión, sin huérfanos ni éxito que conserve silenciosamente bytes antiguos.

### A15-024 · Invalidar análisis por su contrato y configuración efectiva

- **Evidencia:** el fingerprint contiene versión de agente, modelo declarado y referencias de prompt; no incluye hash del contenido, schema, representación ni configuración/modelo efectivo del wrapper. Remotamente ambos prompts v2 tienen un checksum que no corresponde al contenido; test ejecutó `gpt-6-luna` aunque el modelo declarado es `claude-sonnet-5`. La revisión de stale solo se activa al volver a subir/importar el checksum.
- **Mejora y aceptación:** fingerprint canónico de bytes/representación y contrato de extracción, hash real del prompt/schema y política de modelo solicitada/efectiva con su recibo; separar la revisión aplicada al brief. Detectar automáticamente cambios relevantes y programar actualización acotada, conservando versión válida anterior y evitando bucles por fallback. Cambiar una etiqueta de origen no exige pagar otra percepción; cambiar contenido del prompt o representación sí se reconsidera. Nuevas versiones mediante repositorio/migración y promoción canónica, sin ediciones manuales que otro proceso sobrescriba.

### A15-025 · Preservar revisiones y correcciones humanas

- **Evidencia:** hay una sola columna `analysis/markdown`; el retry la puede sobrescribir. `queueImageIfAnalysisIsStale` borra documento RAG y limpia la ficha antes de tener reemplazo. La edición markdown no verifica revisión esperada ni bloquea un análisis concurrente; usa `created_by` de la subida, sin separar autor de la corrección.
- **Mejora y aceptación:** historial de análisis y correcciones con actor, motivo y revisión; comparar-and-swap en editar/reanalizar y referencia explícita a la versión vigente. Mantener disponible la última ficha válida durante regeneración y conservar correcciones humanas sin mezclarlas con observaciones nuevas. Prueba de edición mientras llega un resultado y fallo de reanálisis: conflicto visible, sin pérdida silenciosa ni atribución al usuario equivocado.

### A15-026 · Reparar RAG sin destruir la versión utilizable

- **Evidencia:** `reindexImageMarkdown` elimina el documento anterior antes de verificar proveedor, generar embeddings o insertar el nuevo. La cola captura errores de indexación y guarda `knowledge_document_id:null`; no existe una cola de reparación independiente en ese flujo. La UI detecta «sin indexar», pero volver a analizar puede repetir visión.
- **Mejora y aceptación:** crear/indexar la nueva revisión, comprobar chunks y publicar el puntero solo cuando esté lista; retirar la anterior después. Estado y reintentos independientes de indexación con outbox/idempotencia. Si embeddings no están disponibles, el análisis sigue consultable y el índice anterior no desaparece prematuramente; recuperar el servicio indexa exactamente esa revisión sin una nueva llamada visual.

### A15-027 · Preservar la autoridad real y los límites de la ficha en RAG

- **Evidencia:** el documento automático se guarda como `origin: human_approved_ai` y `status:active` sin aprobación humana en ese recorrido. Carece de tienda, identidad de imagen/run/revisión como fuente y no guarda el contenido completo en el insert de documento. El markdown omite confianza; el caption recorta cada ficha a 1.800 caracteres, pudiendo perder las advertencias posteriores.
- **Mejora y aceptación:** origen real de extracción automática y aprobación solo al existir decisión; fuente exacta imagen/representación/análisis/run y scope; conservar contenido/revisión verificables. Resumen de contexto que priorice incertidumbre, restricciones y procedencia antes de truncar, con enlace al detalle. Fichas con baja confianza o corregidas no se convierten en conocimiento confirmado por cambiar de consumidor. Tratar nombre de archivo, OCR y notas como datos no fiables, también ante instrucciones embebidas en una imagen.

### A15-028 · Borrar con consistencia y respetar piezas dependientes

- **Evidencia:** el borrado elimina primero storage y documento, sin comprobar sus errores, y después la fila del banco. Puede dejar una fila rota si falla el último paso o un objeto/documento huérfano si falla uno previo. No se cancela la tarea de análisis ya reclamada ni se coordina con overlays, exports o borradores que usan la imagen.
- **Mejora y aceptación:** marcar/cancelar con revisión, resolver referencias y ejecutar una limpieza idempotente/reintentable; definir qué se conserva en piezas ya publicadas frente a originales retirados. Invalidar cachés firmadas y evitar que un job tardío recree RAG. Probar borrado durante análisis, fallo de storage/DB y activo usado por una pieza: resultado coherente y dependencias visibles, sin prometer que una URL ya distribuida se revoca instantáneamente.

### A15-029 · Aislar el estado de UI al cambiar organización o tienda

- **Evidencia:** `ImageBankContent` mantiene imágenes, candidatos Meta, detalle, edición y operaciones en estado React. `base` cambia con organización, pero los fetch no se cancelan ni validan su scope al resolver y los candidatos previos no se reinician explícitamente. Una respuesta tardía puede repoblar el estado del contexto anterior.
- **Mejora y aceptación:** reinicio de estado ligado a scope, abort/generation guard para lecturas y escrituras, y protección de selección/edición pendiente. Cambiar A→B durante listado, importación o subida no presenta datos de A en B ni dispara una operación con IDs conservados de otro contexto. El mismo criterio debe cubrir el selector de tienda que se incorpore.

### A15-030 · Renovar previews firmadas y aislar fallos por activo

- **Evidencia:** las URLs privadas duran cinco minutos y la caché cuatro; la biblioteca solo refresca periódicamente si hay trabajos pendientes. Una sesión estable con imágenes ya analizadas puede conservar URLs vencidas; el listado falla completo si una firma/metadato no es válido. No hay recuperación `onError` del preview en la vista leída.
- **Mejora y aceptación:** renovar al vencer, al volver a foco o por error acotado del medio, con resolver autorizado común para biblioteca y editor; no persistir URLs firmadas como identidad. Informar fallo por activo y permitir ver el resto de la biblioteca. Una ficha abierta más de cinco minutos recupera el preview sin reanalizar y sin bucle; un objeto perdido no inutiliza todas las fichas.

### A15-031 · Paginar y buscar sobre el catálogo completo

- **Evidencia:** biblioteca limitada a 300 filas y candidatos Meta a 100, sin cursor; los filtros/búsqueda de biblioteca se aplican a ese subconjunto. El estudio mantiene una búsqueda diferente de hasta 40 filas públicas. No se informa claramente qué parte queda fuera.
- **Mejora y aceptación:** paginación estable y búsqueda/filtros en servidor con scope, atributos/medio/producto, estado, revisión y origen; totales/cobertura y consulta específica por ID. Evitar generar y transferir cientos de previews firmadas cuando solo se muestran unas pocas. Un activo antiguo fuera de las primeras 300 filas y uno Meta fuera de las primeras 100 siguen localizables y reutilizables, sin duplicarlos al importar de nuevo.

### A15-032 · Resolver cuotas y configuración antes de consumir un intento

- **Evidencia:** A15 usa `resolveAgentBudget` sin la política de plan que reciben otros runners y reserva contra el límite diario por defecto. El wrapper compartido sí comprueba activación/modelo de cliente y plataforma; no debe afirmarse que A15 los ignore. Sin embargo, esas decisiones pueden ocurrir después de reclamar la imagen, reservar presupuesto y crear el run; el catch genérico las trata como reintentables. El retry manual de una ficha analizada no tiene en este recorrido una reserva/idempotencia específica por solicitud.
- **Mejora y aceptación:** preflight común de entitlement, activación, capacidades visuales del modelo efectivo, cuota/plan y presupuesto, con razones de pausa. Reserva concurrente e idempotente por trabajo/revisión; conocer el coste registrado de extracción, indexación y revisión aplicada. Cambiar de modelo global no evade límites ni deja un fingerprint engañoso; una pausa de configuración no consume los tres intentos ni bloquea a otras organizaciones.

### A15-033 · Unir tick, activo, análisis y consumo mediante recibos verificables

- **Evidencia:** A15 usa `trigger_type:cron` incluso cuando el origen es una subida/importación manual; no guarda tienda ni `entity_ids` del activo en el run. El snapshot solo congela evidencia visual si el juez está habilitado y no añade sistemáticamente checksum/representación del input. Los ocho runs leídos de test carecen de deployment; el endpoint interno devuelve HTTP 200 también cuando el procesador devuelve `status:error` y el worker comprueba principalmente HTTP.
- **Mejora y aceptación:** diferenciar origen y transporte del disparo; enlazar job/claim, solicitud, activo/revisión, scope, run, bytes exactos, prompt/schema/modelo efectivos, persistencia e indexación. No guardar secretos de URLs. Heartbeat/resultado de tick y fallo semántico propagado a worker; métricas de espera, repetición, coste y fallos con motivo. Poder explicar qué falta cuando no existe una ficha y reproducir la evidencia sin depender de que el juez estuviera activado.

### A15-034 · Probar los recorridos de ambos canales y la calidad visual real

- **Evidencia:** pasan las pruebas focalizadas de URL/MIME, fingerprint, representación, migración, schema/markdown y normalización de creativos, pero no ejecutan sync→importación→cola→persistencia→consumo. El catálogo offline tiene un caso A15 que declara separar hipótesis y rendimiento; su existencia no acredita OCR, composición, aislamiento, recuperación ni calidad del modelo con imágenes reales. No hay activos ni runs A15 en producción con los que certificar ese recorrido.
- **Mejora y aceptación:** regresiones de comportamiento para creatividades simples, resync sin pérdida de vínculos, origen mutable, dos tiendas/organizaciones/roles, deduplicación en ambos órdenes, lease/concurrencia, fallos parciales y reparación RAG sin regenerar. Dataset visual autorizado de Instagram y Meta con OCR literal/ilegible, productos ambiguos, claims, instrucciones dentro de imágenes, recortes, miniatura frente a vídeo, carruseles y exports. Evaluar observaciones, abstención, utilidad del cambio sugerido y handoff por separado, sobre el modelo efectivo. E2E aislado de biblioteca→análisis→edición→variante→consulta A23, sin publicaciones o gasto publicitario reales; registrar lo que solo puede validarse después del despliegue.

### Verificación y límites de la auditoría A15

- **14 pruebas focalizadas aprobadas:** diez con `npx tsx --test --test-force-exit src/visual-asset-sources.test.ts src/meta-static-image.test.ts src/meta-visual-asset.test.ts src/a15-migration-contract.test.ts` desde `apps/api`; tres con `--test-name-pattern="creatividad|variantes dinamicas" src/meta-sync-blocks.test.ts`; una con `npx tsx --test --test-reporter=dot --test-name-pattern="extracción de imagen de Instagram" src/index.test.ts` desde `packages/ai`. No se amplió a suites ajenas ni se añadieron tests de implementación.
- **Reproducción sintética sin persistir:** invocadas las funciones reales `buildMetaCreativeAssetRows` y `resolveMetaVisualRepresentation` con una creatividad fija imagen+miniatura y otra vídeo+miniatura. Ambas producen cero activos importables en ese recorrido. No se llamó a Meta, a un modelo ni a embeddings.
- **Lecturas remotas:** agente/prompt/configuración, comprobación del hash de contenido, historial de migración, columnas, políticas, FK, buckets y agregados de banco/procedencias/activos/runs/documentos. Test y producción coinciden en estructura/configuración inspeccionada; no se certifica equivalencia de sus builds desplegadas.
- **Grafo:** utilizado para descubrir runner, procesador, importador, normalización Meta y relaciones. El snippet de `analyzeInstagramImage` tenía offsets desactualizados y devolvía código de A01; se contrastaron todos los hallazgos con los archivos actuales. No se reconstruyó el grafo.
- **Documentación de proveedor:** contrastados [modelo de acceso de buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) y [acceso con RLS/service key](https://supabase.com/docs/guides/storage/security/access-control). El changelog de Supabase se leyó como contexto; no se diagnosticó ningún hallazgo A15 como efecto de un cambio del proveedor.
- **Límites:** sin sesión de navegador, nueva llamada real de visión, importación desde Meta, ejecución del worker desplegado, prueba de carrera Postgres, prueba RLS con usuarios impersonados ni medición de calidad/coste con dataset visual. No se descargaron medios de clientes ni se alteraron datos para fabricar cobertura. Las extensiones de vídeo, revisión aplicada y aprendizaje son oportunidades de capacidad, diferenciadas de fallos del recorrido ya existente.
- **Alcance de la auditoría original:** esa pasada solo añadió esta auditoría. La implementación posterior queda registrada a continuación.

### Implementación A15 · 20 de octubre de 2026

Se amplió A15 para el banco compartido de Instagram y Meta Ads. La versión de análisis separa observaciones visuales de rendimiento, describe texto visible por región, conserva evidencia/confianza y etiqueta explícitamente las miniaturas de vídeo. Meta conserva identidad de activos en sincronizaciones, deja importables imágenes fijas y miniaturas, y ya no borra las filas anteriores que sirven de procedencia. Se añadieron scope por tienda, fuentes multicanal, subidas privadas y soporte de overlays/copies para ambos canales.

La sincronización también desglosa las tarjetas `object_story_spec.link_data.child_attachments` como activos ordenados de Meta, manteniendo su procedencia y posición al importar. En el banco se pueden seleccionar de 2 a 10 imágenes analizadas para crear un carrusel ordenado y elegir Instagram o Meta Ads; el brief admite objetivo y contexto de campaña para abrirlo como borrador en el editor. Esto prepara la pieza para edición, pero no afirma que el modelo haya evaluado la secuencia ni genera automáticamente el diseño.

Para vídeos Meta con `source` accesible, la API extrae con FFmpeg hasta ocho fotogramas repartidos durante el vídeo (máximo 180 segundos y 100 MiB), conserva el tiempo aproximado de cada fotograma en la procedencia y elimina el temporal local al terminar. Los fotogramas entran en la cola A15 existente; el original no se persiste de nuevo. Meta puede denegar el archivo fuente aunque haya miniatura, en cuyo caso la UI indica que use esa alternativa. La imagen Docker de API instala FFmpeg; la prueba real con permisos/datos de una cuenta Meta sigue pendiente.

**Verificación de la extracción:** typecheck de API y web aprobado. No se pudo construir/ejecutar la imagen Docker para el smoke test porque Docker Desktop no tenía activo su motor Linux en este entorno. No se llamó a Meta ni se probó la extracción con un vídeo real.

La cola usa leases con fencing token, heartbeat, reintentos diferidos, recuperación de reclamaciones caducadas, reparto entre organizaciones y propagación de fallos al worker. El análisis conserva el checksum, representación, tienda, run y trigger en el snapshot; la persistencia final precede al éxito. La indexación RAG tiene estado propio y botón de reparación sin repetir visión. Ediciones con revisión esperada dejan historial de IA/corrección y no sustituyen la ficha vigente hasta completar la nueva indexación. Previews firmadas se renuevan bajo demanda; los fallos se aíslan por imagen. La búsqueda del banco incluye nombre y ficha, y ambos catálogos usan cursores. El copiloto del estudio puede resolver imágenes privadas dentro del scope de tienda, incluso cuando la procedencia Meta asocia la imagen a esa tienda.

| Mejoras | Estado de implementación |
|---|---|
| A15-001 a A15-006 | Implementadas para identidad/sync Meta, importación de piezas fijas, scope, procedencia multicanal, UI de ambos canales y diagnóstico accionable. |
| A15-007 y A15-008 | Parciales: se registran dimensiones y OCR/evidencia/confianza; la lectura de dimensiones no cubre todos los perfiles de WebP ni sustituye a un decodificador completo. |
| A15-009 | Parcial: para vídeos Meta cuyo token permite descargar el archivo, A15 extrae hasta 8 fotogramas uniformes (vídeos de hasta 180 s y archivos de hasta 100 MiB), los guarda privados y los analiza en la cola visual. Si Meta no entrega `source`, queda disponible la miniatura. Falta OCR/transcripción temporal consolidada y análisis de secuencia como una sola unidad. |
| A15-010 | Parcial: Meta sincroniza tarjetas de `child_attachments` con posición/metadatos y permite importarlas; el banco permite seleccionar 2–10 imágenes analizadas en orden y crear un carrusel con destino y brief de campaña. Aún falta la entidad de conjunto sincronizada con síntesis de secuencia y distinguir el conjunto realmente servido de sus combinaciones posibles. |
| A15-011 | Parcial: editor y carrusel aceptan un brief explícito de objetivo, producto, audiencia, placement y límites; se mantiene separado de la observación A15. Falta resolver marca/producto desde datos autorizados de la tienda y recalcular la adecuación cuando cambie el brief. |
| A15-012 y A15-013 | Parciales: biblioteca paginada/buscable y relación A15→A23 conservada para varios anuncios por activo; faltan filtros/totales y cobertura completa por periodo/representación. |
| A15-014 | Parcial ampliada: hallazgos y selecciones múltiples llevan a un borrador revisable con canal y brief de campaña; todavía no se genera automáticamente una variante gráfica ni se enlaza con campaña/producto/placement de origen. |
| A15-015 | Pendiente: se conserva historial, pero no existe ciclo de revisión/aprobación de variantes ni aprendizaje basado en resultados medidos. |
| A15-016 a A15-018 | Parciales: MIME, bytes, checksum, dimensiones y descarga Meta validada con límites; no hay decodificador completo ni renovación/recuperación del origen remoto cuando Meta invalida su URL. |
| A15-019 a A15-024 | Implementadas en recuperación/fencing, reparto, espera/reparación RAG, persistencia antes de éxito, procedencia idempotente y fingerprint de prompt/schema/contenido/representación. |
| A15-025 a A15-027 | Implementadas en revisión CAS, historial de análisis/corrección, reemplazo RAG seguro y origen/contexto automático con scope verificable. |
| A15-028 a A15-030 | Parciales: el tombstone bloquea jobs tardíos y permite reintentar limpieza; las referencias a overlays se ponen a null por FK. Falta una vista de dependencias y una garantía de revocación de URLs ya distribuidas. UI reinicia scope y previews se renuevan por error; faltan abortar/invalidar todas las mutaciones en vuelo. |
| A15-031 | Parcial: banco y recursos Meta tienen cursores estables y búsqueda del banco; faltan filtros avanzados y agregados de cobertura del catálogo. |
| A15-032 y A15-033 | Parciales: A15 respeta la configuración de presupuesto por plan, presupuesto diario de organización, activación por organización, run/snapshot y errores del tick; no reserva cuota por plan concurrente ni ofrece recibo único de extremo a extremo. |
| A15-034 | Pendiente de verificación con regresiones de flujo, Postgres concurrente, usuarios impersonados y dataset visual autorizado; no se ejecutó la suite de tests en esta implementación. |

**Migración:** `20270103100000_a15_multichannel_creative_integrity.sql` aplicada y registrada en desarrollo/test y producción mediante `npm run db:push` y `npm run db:push:prod`, limitada a esa versión. El push completo mostraba además 17 migraciones anteriores de A09–A12 y no se ejecutó para evitar subir cambios ajenos al alcance.

**Verificación de esta implementación:** `npm run typecheck` completo, más typecheck independiente de API y web tras los últimos cambios. Ambos entornos registran la migración; no se desplegó el código de aplicación ni se certificó Meta, el worker remoto o la calidad con medios reales.

## A16 · Texto sobre imágenes y composición de creativos de Instagram y Meta Ads

Auditoría del 20 de octubre de 2026. Las **26 mejoras A16-001 a A16-026 quedan pendientes de implementación**. El cierre histórico de septiembre en `REVISION_AGENTES.md` no acredita el recorrido actual, ampliado a Meta y a los activos privados de A15.

Alcance comprobado: código de la copia de trabajo sobre `main` (`b7cb281`, posterior al despliegue `1273726`), rutas, contrato de salida, permisos, esquema y configuración en test/producción, editor autenticado y descarga PNG de una pieza existente. A16 se dispara manualmente mediante «Borrador de texto», «Borrador de este slide» o «Borrador de toda la pieza»: UI → `POST .../instagram/overlays/:overlayId/ai-draft` → `draftInstagramOverlayText` → `draftInstagramOverlay`. No se encontró otro llamador de ese runner en el grafo; «Generar caption/texto de anuncio» invoca A11, no A16. La acción para toda la pieza hace varias llamadas individuales desde el navegador.

### A16-001 · Generar sobre la revisión exacta que el usuario está editando

- **Evidencia:** el editor envía solo `slide_index` y `objective` al pedir A16, y solo objetivo/idempotencia al pedir A11 (`[overlayId]/page.tsx:411`, `:503`). Los dos endpoints vuelven a leer imágenes, orden, formato y canal guardados (`instagram-image-bank.ts:2075`, `:2165`). Añadir/reordenar imágenes o cambiar formato sin guardar puede generar para una imagen/posición distinta de la visible. El PNG, en cambio, usa el estado local.
- **Mejora:** usar una revisión explícita compartida por editor, A16, A11 y exportación. Guardar y confirmar el snapshot antes de generar, o generar desde un snapshot validado por servidor con revisión esperada. No mezclar el objetivo nuevo con el resto de la pieza antigua.
- **Aceptación y compatibilidad:** reordenar dos imágenes, añadir una tercera, cambiar a Story y generar sin pulsar Guardar debe usar exactamente esos datos o pedir resolver el guardado; caption y PNG deben corresponder a la misma revisión. Conservar acceso a piezas históricas.

### A16-002 · Aplicar el alcance por tienda a todas las operaciones de piezas

- **Evidencia:** las piezas solo tienen `organization_id`; listado, creación, edición, borrado y generación usan `requireBankAccess` y no `storeAccess`. `assertImagesInOrg` comprueba organización, pero no la tienda accesible (`instagram-image-bank.ts:1787–2037`). La política SELECT real en ambas DB usa `private.accessible_org_ids()` y no un alcance de tienda. El banco de A15 sí filtra por tiendas. No se ha ejecutado una explotación con usuarios impersonados.
- **Mejora:** persistir la tienda y comprobarla en cada operación, en las imágenes de todos los slides y en el acceso de lectura SQL/RLS. Definir expresamente los activos compartidos entre tiendas; una coincidencia de organización no basta para autorizar su uso. Reforzar coherencia organización/imagen en DB y revisar los grants sobrantes: ambas DB muestran privilegios amplios para `anon`/`authenticated`, aunque la RLS actual no contiene políticas de escritura que los habiliten.
- **Aceptación y compatibilidad:** un manager limitado a tienda A no puede listar, abrir, editar, borrar, exportar ni generar con una pieza/imagen de B de la misma organización. Probar también otra organización y consultor asignado. Migrar las piezas antiguas sin asignarles una tienda por conjetura.

### A16-003 · Validar el documento de diseño con un contrato compartido

- **Evidencia:** PATCH acepta arrays de bloques de tipo `unknown[]`, limitando número y tamaño JSON, pero no sus campos (`instagram-image-bank.ts:1936`). El editor presupone `text`, coordenadas y estilos válidos. El render normaliza/trunca por su cuenta (`render/route.tsx:38`). Cambiar solo `ratio` puede dejar una Story con proporción incoherente. El esquema de A16 acepta `blocks: []`, reproducido durante esta auditoría, sin estado explícito de abstención.
- **Mejora:** validar en API, lectura y exportación un mismo esquema versionado de pieza/slide/bloque: IDs, texto, números finitos, rangos, colores, tipos y límites. Validar las invariantes formato/ratio/número de imágenes. Diferenciar propuesta válida, ausencia justificada de overlay y salida inválida; no convertir un vacío en un toast de éxito.
- **Aceptación y compatibilidad:** bloques nulos, texto no string, coordenadas fuera de rango, estilos malformados y formatos inconsistentes deben devolver errores accionables sin romper el editor. Normalizar documentos históricos mediante una adaptación explícita, no recortar silenciosamente el diseño exportado.

### A16-004 · Evitar sobrescrituras y recuperar revisiones del diseño

- **Evidencia:** PATCH sobrescribe por ID y organización sin revisión esperada (`instagram-image-bank.ts:1994`); el documento no tiene revisión/historial. Generar reemplaza los bloques existentes y cambiar de carrusel a imagen única descarta slides localmente. El aviso `beforeunload` no cubre todas las transiciones internas del portal.
- **Mejora:** añadir concurrencia optimista, historial de revisiones y deshacer/restaurar en el editor. Guardar la procedencia de una propuesta aceptada y distinguir cambios humanos. Ofrecer reemplazo revisable al regenerar o reducir el formato.
- **Aceptación y compatibilidad:** dos pestañas editando la misma revisión no se pisan; la segunda recibe conflicto y conserva su trabajo. Regenerar y volver de imagen única a carrusel debe permitir recuperar texto y slides. Una navegación interna con cambios debe ofrecer una salida segura.

### A16-005 · Aislar respuestas tardías y cambios de contexto en la UI

- **Evidencia:** `load`, `save`, `aiDraft` y `aiDraftAll` no cancelan ni invalidan respuestas por organización, pieza o revisión. Los campos y controles de slides siguen editables durante operaciones; los callbacks posteriores usan snapshots de estado anteriores (`[overlayId]/page.tsx:196`, `:437–531`, `:757–850`, `:935`). `notFound` tampoco se reinicia al comenzar una nueva carga.
- **Mejora:** asociar cada petición al contexto y revisión de origen; invalidar su aplicación cuando cambien. Usar actualizaciones de estado que respeten cambios posteriores y mantener su estado de guardado. Reiniciar errores, selección y datos al cambiar de pieza/organización/tienda.
- **Aceptación y compatibilidad:** cambiar de cliente o slide, editar durante el guardado y recibir una generación antigua no debe introducir datos en la nueva pantalla, borrar correcciones ni marcar como guardado un cambio posterior al request.

### A16-006 · Recuperar piezas e imágenes por identidad, con paginación real

- **Evidencia:** el editor busca la pieza dentro de un listado de las últimas 200 y carga solo la primera página de 50 imágenes (`instagram-image-bank.ts:1805`, `:1085`; `[overlayId]/page.tsx:200`). Una pieza válida antigua puede parecer inexistente y una imagen fuera de esa página no tiene preview/exportación. El filtro de piezas por imagen usa únicamente `image_id`, que representa la primera diapositiva.
- **Mejora:** cargar el detalle autorizado de la pieza por ID y obtener todas sus imágenes por IDs, independientemente del catálogo. Paginar/buscar el selector; encontrar también carruseles que contengan una imagen en posiciones secundarias. Evitar trasladar markdown y análisis completos de todo el catálogo cuando solo se necesitan previews.
- **Aceptación y compatibilidad:** abrir la pieza 201 y una pieza con imagen 51, localizarla desde su segundo slide y buscar activos adicionales sin cargar toda la biblioteca ni anunciar falsos 404.

### A16-007 · Exportar los activos privados introducidos por A15

- **Evidencia:** el banco devuelve URLs firmadas para `marketing-source-assets`, pero el exportador solo permite el prefijo público `.../object/public/marketing-assets/` (`render/route.tsx:85`). Invocar el handler con una URL privada del mismo origen produjo **400 `invalid_src`**. La pieza pública existente sí descargó correctamente.
- **Mejora:** exportar mediante identidad del activo y revisión de layout autorizadas; resolver el objeto privado en servidor. Conservar la protección de origen/ruta, límites de bytes/tiempo/píxeles y ausencia de caché pública. No resolverlo haciendo público el bucket ni aceptando cualquier URL aportada por cliente.
- **Aceptación y compatibilidad:** los creativos subidos e importados de Meta, incluidos fotogramas, deben exportar PNG con el mismo control de tienda/organización; una URL ajena debe seguir rechazada. Verificar el recorrido privado real, además del caso público heredado.

### A16-008 · Renovar previews caducadas y gestionar activos no disponibles

- **Evidencia:** las URLs privadas duran cinco minutos; el editor las carga una vez y las reutiliza en lienzo, miniaturas y enlaces sin renovación por error (`instagram-image-bank.ts:56`; `[overlayId]/page.tsx:200`, `:532`, `:656`). La renovación incorporada a la biblioteca de A15 no cubre este editor.
- **Mejora:** usar un resolver común de preview por ID con expiración, renovación controlada y estado visible de error. Renovar al exportar sin sustituir la referencia persistida por un token temporal. Tratar de forma explícita imagen eliminada, acceso retirado o fallo de Storage.
- **Aceptación y compatibilidad:** dejar el editor abierto más de cinco minutos y descargar después debe funcionar sin recargar ni perder cambios. Un fallo persistente no debe crear un bucle de reintentos ni un lienzo vacío sin explicación.

### A16-009 · Hacer que el PNG coincida con la previsualización

- **Evidencia:** el editor hereda la fuente del portal (IBM Plex Sans) y el exportador `ImageResponse` no carga esa fuente ni sus pesos. En la pieza existente, el lienzo mostraba «Nueva colección» en negrita y el PNG descargado lo mostró con otra apariencia y peso. `layout.tsx` carga pesos 400–700, mientras A16 asigna 800 al titular. UI y exportador duplican estilos y normalización.
- **Mejora:** compartir fuentes disponibles, pesos, métricas, ajuste de líneas, padding, recorte y especificación de render entre preview y exportación. Revisar el crop que verá el usuario: A16 recibe el original, mientras el lienzo lo adapta con `object-cover`; pasar el recorte efectivo o su representación al análisis de composición.
- **Aceptación y compatibilidad:** comparar PNG y preview a la misma escala con texto largo, acentos, símbolos, saltos de línea y los pesos ofrecidos. No dar por demostrada la paridad con un test del JSON. Versionar el render para conservar la reproducibilidad de revisiones anteriores.

### A16-010 · Convertir la intención de composición en posiciones seguras

- **Evidencia:** `mapDraftBlocks` usa siempre top=7%, center=40%, bottom=74% y suma 13% por bloque (`[overlayId]/page.tsx:106`, `:385`). Las zonas seguras de la revisión Story son 16–72%; el lienzo dibuja guías del 14% y el prompt usa otro criterio. La prueba directa con top=7 y bottom=74 produjo `unsafe_position` en ambos casos.
- **Mejora:** centralizar áreas seguras por canal/formato/placement y calcular posiciones según altura real de cada bloque. Evitar offsets fijos que amontonan o recortan texto. Ofrecer menos bloques o una alternativa explícita cuando no quepan; alinear guías, generador, revisor y exportador.
- **Aceptación y compatibilidad:** un borrador Story normal no debe nacer sistemáticamente fuera de las guías. Probar titulares de varias líneas, cinco bloques y CTA inferior sin solapamientos ni cambio oculto del mensaje.

### A16-011 · Medir legibilidad y contraste donde sí hay evidencia

- **Evidencia:** `getOverlayReviewWarnings` estima altura por número de caracteres, no conoce las cajas renderizadas y deja de advertir contraste si hay cualquier `bgColor`. No recibe el color del texto, de modo que blanco sobre blanco con pastilla no se detecta. La pastilla sugerida por el prompt solo se aplica al rol CTA (`page.tsx:403`); no protege titulares aunque el fondo sea complejo. La detección OCR solo comprueba un string global.
- **Mejora:** medir overflow y cajas reales tras cargar fuentes, verificar contraste texto/fondo sólido y permitir fondo por bloque. Usar las regiones OCR/protegidas cuando estén disponibles; mantener explícitamente sin evaluar los solapamientos con sujetos/logos sin geometría fiable. Añadir vista reducida de móvil.
- **Aceptación y compatibilidad:** detectar texto cortado, pastilla del mismo color y bloques que se pisan; no afirmar legibilidad por la mera existencia de un fondo. Las advertencias deben identificar el bloque y permitir corregirlo sin alterar automáticamente el original.

### A16-012 · Verificar vigencia, representación y dependencias de A15

- **Evidencia:** el endpoint lee URL y markdown de la imagen, pero no estado, revisión, checksum, representación ni procedencia (`instagram-image-bank.ts:2105`). Puede usar una ficha antigua o un activo en eliminación/reanálisis. `slides` guarda IDs dentro de JSON: la FK de `image_id` solo protege la primera referencia y no repara las referencias internas al borrar una imagen.
- **Mejora:** vincular el borrador a imagen/revisión/checksum y a la versión de la ficha usada. Identificar miniatura, fotograma y slide de carrusel, sin atribuirles evidencia de todo el vídeo/conjunto. Resolver las dependencias al eliminar o actualizar el activo y avisar cuando una pieza necesite revisión. Permitir trabajar con imagen sin ficha solo con ese límite explícito.
- **Aceptación y compatibilidad:** reanalizar o borrar una imagen durante la generación no debe dejar una propuesta aplicada sobre otra revisión ni un carrusel con referencias silenciosamente rotas. No volver a invocar A15 si ya existe un análisis vigente utilizable.

### A16-013 · Construir contexto comercial verificable sin cargar datos innecesarios

- **Evidencia:** el runner recibe imagen, markdown, objetivo y formato, más asignación de consultor; no recibe una guía de marca, producto, oferta ni restricciones resueltas por identidad (`ai-runtime.ts:21676`). Un brief libre o texto visible puede contener un precio/descuento antiguo; no acredita que sea una oferta vigente de la tienda.
- **Mejora:** resolver en servidor, con alcance autorizado, un brief acotado de marca, producto, objetivo de campaña, audiencia, idioma, tono, CTA y afirmaciones permitidas. Separar hechos comprobados, instrucciones editoriales y supuestos. Reutilizar el contexto ya preparado por campaña/copiloto; mantener `allowed_tools: []` en la llamada visual cuando esa entrada sea suficiente.
- **Aceptación y compatibilidad:** generar con y sin guía de marca, producto ausente y descuento caducado sin inventar datos comerciales. Un activo de otra tienda o una instrucción incrustada en OCR/markdown no debe ampliar acceso ni cambiar las reglas del agente.

### A16-014 · Definir contratos efectivos de Instagram y Meta por placement

- **Evidencia:** el canal llega al modelo como prefijo del objetivo; no existe campo tipado de canal/placement/destino. El prompt activo v2 sigue ejemplificando CTA de «link en bio o DM» para piezas sociales. La caja UI admite 800 caracteres, A16 corta el objetivo a 500, A11 a 800 y DB admite 2.000 (`page.tsx:985`; `instagram-image-bank.ts:2124`, `:2216`). Puede perderse una restricción colocada al final.
- **Mejora:** explicitar canal, ubicación, formato, mecanismo de CTA/destino y límites editoriales en un contrato común. Diferenciar el texto de la imagen del botón/copy del anuncio y del sticker de Story. Unificar límites o advertir truncamiento, conservando siempre las restricciones obligatorias.
- **Aceptación y compatibilidad:** mismo activo para Instagram y Meta debe producir CTA coherente con cada brief, sin trasladar «link en bio» a un anuncio de destino web por defecto. Probar restricciones al final del brief y preservar piezas sociales existentes. Revisar especificaciones oficiales del placement al implementar; no fijar límites publicitarios por memoria.

### A16-015 · Diseñar el carrusel como secuencia, no como llamadas aisladas

- **Evidencia:** «Borrador de toda la pieza» recorre slides y hace una petición por imagen (`page.tsx:455`). Cada turno recibe su posición/total, pero no las imágenes, fichas ni titulares vecinos. El juez también declara no evaluable la coherencia porque no conserva esos slides (`agent-judge-runtime.ts:432`). La posición por sí sola no evita titulares repetidos o CTA contradictorios.
- **Mejora:** preparar un plan compartido de secuencia con función de cada slide, mensaje, progresión y CTA final; usarlo en propuestas individuales y en A11. Reutilizar contexto acotado y conservar el orden aprobado. No convertir combinaciones potenciales de un creativo dinámico en una secuencia realmente publicada.
- **Aceptación y compatibilidad:** carrusel de 2–10 imágenes con gancho, desarrollo y cierre coherentes; reordenar o regenerar un slide debe conservar los mensajes aceptados y detectar duplicados. Diferenciar carrusel de una secuencia de historias.

### A16-016 · Permitir iteraciones y variantes sin perder el diseño humano

- **Evidencia:** A16 no recibe los bloques actuales ni qué debe cambiar. La acción IA sustituye todo el contenido del slide (`page.tsx:445`) y no expone aceptación, comparación o edición selectiva de la propuesta.
- **Mejora:** ofrecer regeneración de un bloque, ajuste de longitud/tono/CTA y variantes explícitas sobre una revisión, preservando textos/estilos bloqueados. Mostrar comparación antes de aplicar y registrar la variante elegida. Separar una nueva intención creativa de un simple reintento técnico.
- **Aceptación y compatibilidad:** pedir «acorta solo el titular» debe conservar subtítulo, CTA y correcciones humanas. Rechazar una variante no debe modificar la pieza ni obligar a otra llamada para recuperar la versión anterior.

### A16-017 · Reanudar lotes e impedir cobros duplicados por reintento

- **Evidencia:** si el slide N falla, `aiDraftAll` retorna antes de aplicar los N−1 resultados; ya se habrán ejecutado esos turnos. El endpoint A16 no tiene clave de idempotencia ni vínculo persistido de lote/slide (`page.tsx:467`; `instagram-image-bank.ts:2064`). A11 sí dispone de una reserva de generación propia.
- **Mejora:** identificar intención de generación, revisión y slide; persistir progreso y resultados parciales. Reanudar solo los pendientes/fallidos y devolver el resultado existente ante el mismo intento. Mostrar progreso, coste consumido y qué slides siguen sin generar; una variante intencional debe tener identidad distinta.
- **Aceptación y compatibilidad:** fallar en el slide 4 de 5 y reintentar no vuelve a facturar ni perder los tres primeros. Dos peticiones simultáneas o un timeout del navegador no deben generar dos trabajos equivalentes.

### A16-018 · Hacer recuperable el ciclo de ejecución y sus errores de red

- **Evidencia:** generación individual/lote, guardado y caption usan `try/finally` sin `catch` de errores de transporte; los timeouts pueden dejar únicamente una promesa rechazada sin mensaje útil (`page.tsx:437–531`). A16 trabaja ligado al request HTTP y no conserva una propuesta recuperable para consultar después del cierre del navegador.
- **Mejora:** capturar y clasificar errores de red, abortos y fallos de servicio; añadir recuperación por ID de trabajo/run. Para lotes, reutilizar la infraestructura de trabajos existente con lease, estado y cancelación de pendientes, manteniendo una respuesta síncrona compatible cuando proceda. Resolver ejecuciones huérfanas sin declarar cancelada una llamada ya facturada.
- **Aceptación y compatibilidad:** simular conexión perdida, cierre de pestaña, reinicio de API y respuesta tardía; al volver deben verse el resultado o estado real y una acción de recuperación. No dejar indefinidamente un run en curso ni reintentar ciegamente.

### A16-019 · Reservar presupuesto y aplicar políticas de ejecución antes de generar

- **Evidencia:** A16 comprueba el gasto ya registrado y calcula un presupuesto por turno; no llama a `reserveOrganizationDailyBudget` ni a `checkOrganizationProviderCircuit`, aunque al finalizar intenta liquidar una reserva (`ai-runtime.ts:21617–21744`). No incorpora una política de presupuesto por plan al resolver su límite. El wrapper común sí comprueba activación/modelo del cliente; esa protección existe y debe preservarse.
- **Mejora:** reservar de forma atómica el coste máximo admitido por turno/lote y aplicar límites efectivos de plan/organización y el circuito del proveedor antes de pagar visión. Limitar concurrencia y tamaño del lote; devolver la causa y el momento de reintento sin consumir intentos útiles. Incorporar al recibo el coste de evaluación cuando corresponda.
- **Aceptación y compatibilidad:** con saldo para un solo turno, dos peticiones concurrentes no pueden arrancar ambas. Probar circuito abierto, plan limitado, agente inactivo y diez slides; la UI debe conocer la parte que puede completar sin prometer un lote que no cabe en presupuesto.

### A16-020 · Persistir la propuesta y comprobar las escrituras antes del éxito

- **Evidencia:** el runner devuelve el JSON, pero no lo inserta como salida del agente ni lo vincula a una revisión. El snapshot y la actualización final de `agent_runs` no verifican sus errores (`ai-runtime.ts:21697`, `:21734`). En test hay cuatro runs `succeeded` y uno `rejected_output`, todos v2, sin filas asociadas en `agent_outputs`; uno de los exitosos no tiene snapshot. La cola del juez puede conservar otra evidencia cuando está habilitada, pero no sustituye un artefacto de producto recuperable con el juez apagado.
- **Mejora:** persistir snapshot identificable, propuesta, revisión/slide de origen y estado de aceptación antes de responder éxito; comprobar cada escritura relevante. Incluir hashes de contenido/prompt/schema/render y modelo real. Poder recuperar el resultado por identidad sin depender de la evaluación opcional.
- **Aceptación y compatibilidad:** provocar fallo al guardar snapshot/salida/cierre no debe producir un éxito sin artefacto. Con juez apagado y navegador cerrado, el resultado pagado debe seguir disponible y ser aplicable solo a su revisión válida.

### A16-021 · Evaluar la composición final y conservar evidencia visual suficiente

- **Evidencia:** el juez actual recibe original y JSON, pero declara no evaluables legibilidad renderizada y coherencia de carrusel por falta de PNG/slides vecinos (`agent-judge-runtime.ts:432`; `packages/ai/src/agent-judge.ts:85`). La evidencia visual congelada se carga condicionada a que esté activo el juez. La discrepancia tipográfica observada confirma que el JSON no demuestra cómo queda la pieza.
- **Mejora:** generar una representación de revisión con el mismo motor del PNG, congelar sus bytes/hash junto a originales y slides ordenados y evaluar sobre ella. Invalidar la valoración si cambia el diseño; distinguir revisión del copy, revisión del render y aprobación humana. La evaluación no debe publicar ni sustituir silenciosamente una edición.
- **Aceptación y compatibilidad:** un titular que desborda, una marca tapada y un carrusel repetitivo deben ser evaluables cuando exista evidencia; si falta, mostrar la limitación en lugar de una puntuación de legibilidad inventada. Acotar tamaño/coste y acceso privado de las capturas.

### A16-022 · Mostrar qué hizo A16 y qué revisión sigue pendiente

- **Evidencia:** la respuesta incluye `run_id`, `rationale` dentro de la propuesta y opcionalmente `judgment`, pero `fetchDraft` solo conserva bloques y paleta (`page.tsx:426`). La UI no expone la razón del diseño, coste, versión, resultado del juez ni enlace al run. En la sesión autenticada los botones tampoco explican la diferencia entre A16 y el generador A11.
- **Mejora:** presentar un recibo breve con alcance, revisión/imagen, explicación, límites, evaluación disponible y vínculo al resultado. Explicar que A16 propone texto del lienzo y A11 crea el caption/copy del anuncio. Mostrar estado por slide, no solo «Pensando», y una acción clara para revisar/aplicar/descartar.
- **Aceptación y compatibilidad:** una persona debe poder saber qué se analizó, si su texto quedó guardado, dónde está el borrador de A11 y qué no se pudo comprobar. No mostrar una propuesta como publicación aprobada ni convertir una evaluación fallida en silencio.

### A16-023 · Entregar a A11, campañas y copiloto un artefacto enlazado

- **Evidencia:** el handoff a A11 concatena fichas/textos y llama al generador sin tienda, campaña, ID/revisión de overlay ni imagen final (`instagram-image-bank.ts:2237–2251`). Con varias tiendas A11 puede mantener contexto agregado al no recibir selección (`ai-runtime.ts:19954`). El cliente muestra un toast genérico y no abre el borrador devuelto. El grafo solo encuentra la ruta HTTP como entrada del runner A16.
- **Mejora:** enlazar pieza, revisión, activos/rendiciones y borrador A11 con tienda/campaña/producto autorizados; devolver enlaces concretos y conservar la identidad durante iteraciones. Dar al copiloto una acción acotada para preparar/abrir o solicitar ese trabajo mediante los mismos servicios y controles. Reutilizar el borrador cuando se esté revisando, sin crear uno nuevo por cada navegación.
- **Aceptación y compatibilidad:** desde un hallazgo A15, campaña o petición al copiloto, llegar al editor correcto y volver al borrador con su creativo. Probar Instagram/Meta, dos tiendas, error parcial e idempotencia. Crear/redactar no debe enviar campañas, publicar anuncios ni modificar presupuestos.

### A16-024 · Versionar prompts de forma inmutable y comprobar su contenido real

- **Evidencia:** `20260901290000_ai_instagram_publication_format.sql` y `20261115480000_a16_overlay_creative_brief.sql` escriben dos cuerpos distintos sobre el mismo prompt v2 con `ON CONFLICT ... UPDATE`. Ambas calculan checksum a partir del nombre/version literal, no del contenido. La segunda activa directamente la versión. Test y producción tienen v2 activo y el mismo cuerpo actual de 1.855 caracteres; no prueba qué cuerpo se utilizó en todos los runs previos.
- **Mejora:** crear una nueva versión para los cambios de contrato/canales, conservar los cuerpos anteriores, calcular checksum real del contenido y usar la promoción/evaluaciones del repositorio. Guardar referencias suficientes para reproducir la entrada efectiva y detectar divergencias entre código, prompt y schema.
- **Aceptación y compatibilidad:** una actualización no modifica una versión histórica ni comparte checksum con otro contenido. Comparar versión, herramientas vacías, contrato y hashes en test/producción; probar lectura de propuestas anteriores antes de promover.

### A16-025 · Reducir lecturas repetidas y acotar el contexto de cada lote

- **Evidencia:** cada slide vuelve a cargar overlay, URL, versión, prompt, asignación y comprobaciones de ejecución; el lote actual repite ese recorrido completo. A16 pasa el markdown sin una selección semántica explícita y A11 recorta cada ficha a 1.800 caracteres. Más datos no garantizan que restricciones y OCR relevantes sobrevivan al contexto.
- **Mejora:** resolver un snapshot común del lote una vez, reutilizar configuración inmutable y contexto autorizado, y extraer de A15 campos estructurados necesarios para composición/OCR. Acotar input por tipo de dato, conservar restricciones obligatorias y registrar truncamiento. Deduplicar reintentos por identidad/revisión; no reutilizar una variante antigua cuando el usuario pidió otra intención creativa.
- **Aceptación y compatibilidad:** medir consultas, latencia y tokens con 1 y 10 slides y comparar calidad/contexto efectivo. Cambiar marca, ficha, imagen, prompt o revisión invalida lo que corresponda; ningún caché mezcla organizaciones ni elude una autorización actual.

### A16-026 · Cerrar con pruebas de flujo, calidad visual y seguimiento de uso

- **Evidencia:** pasan las dos pruebas textuales de contrato/handoff de la versión publicada y las tres de advertencias. No ejercitan edición sin guardar, Storage privado, concurrencia, RLS por tienda, recuperación de lote ni paridad PNG. El catálogo offline declara un caso específico de A16 sobre activo autorizado; su existencia no acredita calidad real del modelo. Producción no tiene piezas ni runs A16; test solo tiene una pieza pública de una imagen.
- **Mejora:** añadir regresiones de los fallos anteriores, una matriz visual autorizada y recorridos completos cliente/consultor con dos tiendas/organizaciones. Medir aceptación, correcciones, duplicaciones evitadas, fallos de exportación y coste por pieza/slide. Mantener por separado señales de resultados de canal (A23 y su calidad de medición) y preferencias editoriales; una imagen bonita no demuestra conversión.
- **Aceptación y compatibilidad:** verificar carga → generación → revisión → guardado → reapertura → exportación → handoff A11/campaña/copiloto, incluyendo private assets, formatos, errores y permisos. Registrar qué versión/entorno se probó y los límites pendientes; no volver a cerrar por pruebas de regex o por disponer de un `run` exitoso.

### Verificación y límites de la auditoría A16

- **DB en solo lectura:** consultas de esquema, políticas, configuración y conteos en test `kopcblejsxpkxoykldyh` y producción `cthjwpeygpzwdmjkxeqa`. A16 v2 está activo, sin herramientas, en ambos. Test: una pieza, cinco runs (cuatro exitosos y uno rechazado), ninguno con `agent_outputs`; producción: cero piezas/runs. La muestra no certifica aislamiento ni calidad a escala.
- **Pruebas ejecutadas:** contrato/handoff **2/2** en el worktree del commit publicado `1273726` (la copia principal conserva una aserción local antigua); revisión de legibilidad **3/3** en la copia actual. Comprobaciones directas adicionales: handler privado **400 `invalid_src`**, `unsafe_position` para posiciones Story 7%/74%, y contrato Zod que admite bloques vacíos. No se añadieron ni modificaron tests en esta auditoría.
- **Comprobación visual:** se abrió el editor autenticado de la pieza pública existente y se descargó su PNG de 1080×1350; la fuente/peso difieren de lo mostrado en el lienzo. No se cambiaron los bloques ni se ejecutaron A16/A11, nuevas llamadas de pago, publicaciones o envíos.
- **Fuentes de proveedor:** contrastados el [modelo público/privado de Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals) y las [URLs firmadas](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl). Se consultó el changelog y los avisos de [TLS](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) y [Postgres](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes); no se atribuye ninguno de estos hallazgos a un cambio del proveedor.
- **Método y alcance:** el MCP de grafo se usó primero para localizar funciones y entradas. Sus rangos de snippets estaban desactualizados y devolvían cuerpos de otras funciones; las evidencias se verificaron contra los archivos actuales. No se modificó software, configuración, esquema ni datos de negocio. Las pruebas adversariales con usuarios reales, medios privados y salidas nuevas de modelo quedan descritas como aceptación de las mejoras, no como verificaciones ya realizadas.

## A17 · Plan semanal de tareas y coordinación con Mi Camino

**Auditoría del 20 de octubre de 2026. Estado: 20 mejoras A17-001 a A17-020 registradas, pendientes de implementación.** Esta pasada añade documentación; no aplica cambios de software, migraciones ni configuración. El cierre histórico de septiembre en `REVISION_AGENTES.md` no verifica el recorrido actual. Se revisa la copia local sobre `04c26ec`, con cambios previos de otras tareas, y se contrasta por separado la configuración efectiva de las dos bases de datos.

A17 convierte la dirección vigente de Mi Camino y las iniciativas mensuales aprobadas en entregables semanales. Debe coordinarse con A18, A04, campañas y especialistas sin duplicar trabajo ni convertir hipótesis en compromisos. Carga considerada: varias organizaciones, dos o más tiendas por organización, aprobaciones simultáneas y reintentos del worker/navegador.

**Entradas comprobadas:** `GET /v1/organizations/:organizationId/ai/plan/week` consulta caché; `POST .../ai/plan/week/run` genera mediante `runPlanAgent(..., "week")`; el worker llama al orquestador a las **06:00 y 15:00, Europe/Madrid**, pero A17 tiene una antigüedad mínima de **seis días**, modificable mediante ajustes de plataforma. Abrir una pantalla no genera. El cron aplica habilitación, actividad, presupuestos y cupos. En la UI local actual, el detalle del consultor consulta el plan semanal y lo incorpora a la cola de propuestas. La existencia del endpoint manual no demuestra que haya un botón de A17 montado en la UI actual.

### A17-001 · Generar automáticamente el plan de cada tienda y usar la misma identidad en la UI

- **Evidencia:** `orchestratorScopesForAgent` cae para A17 en el único scope `{storeId:null, connectionId:null}` (`ai-runtime.ts:16947`); la rama de ejecución pasa además `null` como conexión (`:17871`). El detalle del consultor consulta A17 con la conexión seleccionada (`consultant-desk.tsx:935`), y la caché exige coincidencia exacta de tienda (`ai-runtime.ts:7054`). La reproducción con dos tiendas devuelve únicamente el agregado. La planificación automática no alimenta esas dos cachés.
- **Mejora:** programar A17 por tienda autorizada, transmitir `item.connectionId` y conservar identidad de scope, ventana y digest en cada run. Definir expresamente si sigue existiendo un plan organizativo separado. Repartir tiendas y organizaciones entre ticks para que el cupo no deje siempre fuera las mismas; el agregado no sustituye a una tienda.
- **Aceptación y compatibilidad:** dos tiendas reciben sus planes automáticos y cada pantalla recupera el suyo; una petición sin tienda sigue una política explícita. Verificar agente apagado, ausencia de sincronización, presupuesto insuficiente y varias tiendas con el cupo diario limitado. GET continúa siendo de lectura y se conservan los planes históricos sin reasignar su tienda por inferencia.

### A17-002 · Evitar que el timeout del worker duplique una generación todavía en curso

- **Evidencia:** `runAiDiagnosticsTick` usa `fetchWorkerWithResilience` sin opciones (`worker.ts:156`). Su timeout por defecto es **10 segundos** y admite **dos reintentos** (`worker-http.ts:1`, `:29`). El endpoint espera sincrónicamente a una pasada que ejecuta hasta quince runs en serie (`server.ts:12388`; `ai-runtime.ts:17827`). Cada nueva petición crea otro `tickId`; la selección mira runs exitosos y no reserva atómicamente el trabajo que ya está ejecutándose. El mismo tick lógico puede volver a arrancar mientras la API sigue trabajando tras el aborto HTTP.
- **Mejora:** identificar el tick/trabajo de forma estable y reservar por organización, tienda, agente y ventana antes de llamar al proveedor. Usar un trabajo durable con consulta de estado, lease y recuperación, o un protocolo síncrono cuyo timeout y reintentos sean compatibles con la duración y la idempotencia. Reutilizar BullMQ y la persistencia existentes.
- **Aceptación y compatibilidad:** con un proveedor simulado que tarda más de diez segundos, reinicio del worker y respuesta perdida, cada intención produce un único run y una única generación facturable. Recuperar estados interrumpidos y resultados ya persistidos; no declarar cancelado un trabajo solo porque el cliente HTTP dejó de esperar. Mantener reservas presupuestarias y circuito del proveedor.

### A17-003 · Alinear permisos de tienda entre API, tareas y lectura directa de Supabase

- **Evidencia:** las rutas de A17 usan `requireOperationalOrganization`, que rechaza las membresías limitadas a tienda incluso si se pide su conexión autorizada (`auth-context.ts:155`, `:576`). En ambas DB, `agent_runs`, `agent_outputs`, `tasks` y `milestone_task_links` tienen RLS y SELECT para `authenticated`, pero las políticas verifican organización, visibilidad/rol y no la tienda. `private.accessible_org_ids()` incorpora miembros activos sin filtrar `access_scope`/`store_ids`. Actualmente no hay membresías activas limitadas a tienda; no se ha ejecutado una explotación con usuarios reales.
- **Mejora:** ofrecer a una membresía de tienda solo las operaciones y salidas de sus tiendas, y aplicar el mismo alcance en RLS, incluyendo la tienda del run para `agent_outputs` y la del plan/tarea para los enlaces. Tratar explícitamente las filas organizativas sin tienda. Evitar ampliar globalmente `accessible_org_ids()` para resolver una ruta concreta.
- **Aceptación y compatibilidad:** manager de A puede leer el plan de A y decidir solo si su rol lo permite; no puede consultar por API ni Data API el plan o tareas de B. Probar owner organizativo, consultor asignado, admin, otra organización y filas heredadas sin tienda. Las denegaciones de API no deben ser la única barrera ante una consulta SQL/REST directa.

### A17-004 · No introducir decisiones y aprendizaje de otras tiendas en un plan específico

- **Evidencia:** el runner común pasa `{storeId}` al contexto de playbooks para A04/A12/A13/A14, pero A17 cae en `undefined` (`ai-runtime.ts:6324`). `loadDecisionPlaybookContextBlocks` usa entonces el contexto completo de la organización e incorpora F9 y F11 sin scope de tienda (`decision-playbook-chat-context.ts:937`, `:1361`). Los dos snapshots A17 v7 de test son de tienda y contienen esos bloques organizativos. Esto demuestra composición de contexto sin alcance; no demuestra que una salida concreta haya divulgado información.
- **Mejora:** pasar la tienda resuelta a todos los adaptadores que alimentan A17. Separar metodología compartida de hechos, decisiones y aprendizaje de una tienda; incluir únicamente registros compartidos que tengan esa condición de forma explícita. Mantener organización y tienda también en las claves de cualquier reutilización.
- **Aceptación y compatibilidad:** un diagnóstico o aprendizaje de B no aparece en el contexto de A. El contexto común permitido sigue disponible sin presentarlo como un hecho observado de A. Ante fallo del adaptador se declara indisponibilidad; no se recurre silenciosamente al agregado.

### A17-005 · Validar el hito y la versión de Mi Camino al aprobar; eliminar el enlace por defecto

- **Evidencia:** `shouldFallbackToCurrentMilestone("a17_plan_semanal")` devuelve `true` (`agent-task-delivery.ts:86`): un `milestone_id:null` puede acabar asociado al primer hito actual (`ai-runtime.ts:25078`). A17 tampoco está en la lista que revalida hito, estado, plan y scope antes de materializar (`:24863`, `:24883`). Los triggers de DB verifican organización y compatibilidad de tiendas, pero no vigencia del plan/hito. Después del enlace se invoca `reopenCaminoMilestoneForWork`, que puede reabrir un hito, fase o plan completado; su error solo se registra. La tarea y su enlace se escriben en operaciones separadas.
- **Mejora:** conservar `plan_id`, versión, hito e iniciativa padre revisados y revalidarlos al aceptar, dentro de una operación atómica de materialización. `null` debe conservar el significado «sin relación demostrada». Un cambio de Camino debe requerir revisar la propuesta; reabrir trabajo completado debe ser una consecuencia explícita y revisable.
- **Aceptación y compatibilidad:** propuesta independiente no se enlaza por posición; un UUID inventado, de otra tienda, de un plan sustituido o de un hito terminado no provoca un vínculo o reapertura silenciosos. Si falla el enlace, la respuesta no declara una entrega completa. Leer salidas antiguas sigue siendo posible sin crearles relaciones nuevas por conjetura.

### A17-006 · Hacer obligatorio y verificable el contrato semanal de salida

- **Evidencia:** el prompt v7 exige de cero a cuatro tareas con rol, criterio de cierre, métrica y plazo, pero el esquema común permite campos nulos/ausentes, títulos/descripciones vacíos y un número no acotado de propuestas (`packages/ai/src/index.ts:273`, `:354`). El runner solo refuerza el límite de A04 (`ai-runtime.ts:5954`, `:6384`); A17 usa el contrato lean genérico. Reproducción: cinco tareas vacías con los cuatro campos de entrega a `null` pasan el parser usado por ese contrato.
- **Mejora:** definir un contrato efectivo de A17, aplicado tanto al JSON Schema del proveedor como al parser: cero a cuatro entregables, textos útiles, campos de entrega completos y tipos de propuesta admitidos. Validar coherencia del plazo y del vínculo padre, además de la forma del JSON. Mantener un adaptador de lectura para salidas históricas.
- **Aceptación y compatibilidad:** cinco tareas, títulos vacíos, roles inválidos o entregables sin criterio de cierre se rechazan antes de responder éxito. Una semana sin trabajo nuevo es válida y explica su motivo. Probar el contrato real del runner y la aprobación, no únicamente la presencia de frases en una migración.

### A17-007 · Aplicar idempotencia y cupo manual atómicos también a A17

- **Evidencia:** `POST .../plan/:horizon/run` acepta `Idempotency-Key` y lo transmite al runner (`server.ts:9426`). A17 no está en la lista de agentes que reservan cupo mediante RPC (`ai-runtime.ts:5668`): cae en contar runs y después insertar. El `runId` es aleatorio en cada petición y esa rama no usa la clave. Dos peticiones con la misma clave pueden pasar el recuento, generar dos salidas y pagar dos turnos. La reserva monetaria por run existente limita gasto, pero no deduplica intenciones diferentes con el mismo contenido.
- **Mejora:** reservar intención y cupo por agente, organización, tienda y ventana antes de generar. Vincular la clave a un fingerprint del input y devolver el estado/resultado del run existente al reintentar; una nueva variante debe usar una identidad nueva. Definir si el límite se aplica por tienda o por organización y mostrarlo coherentemente.
- **Aceptación y compatibilidad:** misma clave y mismo payload, incluso con peticiones simultáneas o respuesta perdida, producen una llamada al proveedor; misma clave y distinto scope/payload devuelven conflicto. Con un solo intento disponible no arrancan dos. Conservar la ruta actual y la lectura de resultados anteriores.

### A17-008 · Conservar las iniciativas A18 aprobadas aunque exista un borrador posterior

- **Evidencia:** el contexto consulta solo el último run exitoso de cada horizonte hermano, sin seleccionar por aprobación (`ai-runtime.ts:8207`). `summarizeSiblingPlanRuns` conserva el primero de cada agente (`plan-horizon-context.ts:510`). La reproducción con un A18 nuevo pendiente y uno anterior aprobado solo entrega el pendiente. La lista de iniciativas mensuales abiertas se añade exclusivamente al horizonte mensual (`ai-runtime.ts:8475`); A17 no la recibe como autoridad separada. Además, el resumen de Mi Camino conserva versión pero no su ID de plan.
- **Mejora:** dar a A17 las iniciativas materializadas y vigentes de A18/Mi Camino por identidad, estado y medición, separadas de las propuestas pendientes. Preservar el plan y versión padre y las relaciones de sustitución/retirada. Un borrador más nuevo no debe borrar un compromiso aceptado del contexto.
- **Aceptación y compatibilidad:** A18 aprobado → nuevo borrador rechazado/pendiente no cambia la dirección semanal; A18 sustituido o retirado deja de generar entregables nuevos. El desglose conserva la medición y el hito exactos y no duplica la iniciativa mensual como tarea semanal.

### A17-009 · Gestionar propuestas pendientes, resultados parciales y supersesión sin perder trabajo revisable

- **Evidencia:** el orquestador solo frena pendientes durante tres días y A17 tiene una cadencia de seis (`ai-runtime.ts:16852`, `:17707`). Puede crear una salida nueva sin cerrar o enlazar las anteriores. La caché de A17 recupera únicamente el último run exitoso (`:7059`); la colección de pendientes históricos solo está implementada para A14. En ambas DB siguen existiendo salidas A17 antiguas pendientes y no hay aprobaciones registradas.
- **Mejora:** definir el ciclo por propuesta: pendiente, aceptada, rechazada, materializada, fallida, sustituida o vencida. Recuperar todas las pendientes pertinentes de la ventana y distinguir una revisión que sustituye trabajo de una propuesta adicional. Conservar progreso de decisiones parciales y el enlace con la tarea creada; un refresco no debe esconder lo que aún se puede revisar.
- **Aceptación y compatibilidad:** regenerar con dos propuestas anteriores sin decidir conserva una cola comprensible, sin duplicados invisibles ni pérdida del trabajo del consultor. Dos revisores no pisan decisiones. Un fallo parcial permite completar solo lo pendiente y el cierre conserva un recibo exacto de lo creado, descartado y sustituido.

### A17-010 · Unificar frescura, ausencia de trabajo y errores de ejecución

- **Evidencia:** A17 queda fuera de los agentes con TTL específico en `getCachedDiagnostic`; usa **24 horas** mientras el cron aplica **seis días** (`ai-runtime.ts:6940`, `:7119`). La consulta solo considera runs exitosos, por lo que no informa del último fallo si hay una salida anterior. El contrato lean elimina `answer`, `findings` y `recommendations` de A17 (`:5924`). Los dos runs v7 de test tienen cero propuestas y siguen `pending_approval`: ese estado no explica si todo está cubierto, faltan datos o la salida no fue útil.
- **Mejora:** separar vigencia del plan, frescura de cada fuente, estado del último intento y motivo de abstención. Usar una política semanal única para cron, caché, envelope y UI. Una salida sin escrituras debe poder terminar como revisión informativa con motivo estructurado y siguiente condición de evaluación, sin quedar como un lote vacío que aprobar.
- **Aceptación y compatibilidad:** un plan de dos días se presenta según su vigencia semanal; una fuente fallida se advierte aunque el run anterior exista. Distinguir backlog cubierto, falta de señal, fallo de consulta, agente deshabilitado y generación en curso. Una salida vacía histórica se muestra con su limitación sin inventarle una explicación retrospectiva.

### A17-011 · Anclar los siete días y ajustar la carga a compromisos observables

- **Evidencia:** el objetivo semanal se expresa en texto, sin un periodo de ejecución tipado ni zona horaria del negocio (`ai-runtime.ts:8153`). `due_hint` se conserva como texto relativo y no se convierte en `due_at`, por diseño (`agent-task-delivery.ts:98`); la cola muestra ese texto sin anclarlo a la generación (`client-pulse.tsx:771`). «En siete días» puede seguir apareciendo igual dos semanas después. El backlog común resume como cercano lo que vence en catorce días, y el bloque de capacidad está reservado a A18 (`plan-horizon-context.ts:144`; `ai-runtime.ts:8475`).
- **Mejora:** persistir inicio/fin de la ventana, referencia temporal y zona horaria del plan. Mostrar los plazos relativos contra esa referencia y permitir confirmar fechas al aprobar. Incorporar compromisos semanales, vencidos, bloqueos, dependencias y carga observable por rol; si no hay capacidad configurada, declararla desconocida y no inventar horas ni disponibilidad.
- **Aceptación y compatibilidad:** plan generado a final de semana, cambio horario y propuesta aprobada diez días tarde muestran su ventana original y piden revisión cuando proceda. No desplazar un plazo cada vez que se abre la pantalla. Mantener el texto heredado y no convertir automáticamente una sugerencia relativa en una fecha inventada.

### A17-012 · Dar evidencia reciente y comparable para decidir qué toca esta semana

- **Evidencia:** A17 recibe por defecto un agregado Shopify de treinta días. La consulta del periodo anterior se omite expresamente para `week` (`ai-runtime.ts:8323`, `:8586`), y no hay una comparación directa de siete días. El resto de canales llega principalmente mediante resúmenes previos/herramientas. La información de sincronización conserva último intento/éxito, pero no basta por sí sola para demostrar cobertura de todas las métricas y tiendas del periodo agregado.
- **Mejora:** preparar señales de la última semana y una ventana comparable, conservando el contexto de treinta días para evitar sobrerreaccionar. Resumir Shopify, Meta y email solo cuando sean pertinentes y con muestra, frescura, moneda y límites de atribución explícitos. Resolver cálculos repetibles en servicios existentes; usar SQL acotado para profundizar, sin delegar al cliente cálculos disponibles ni reconstruir todo el negocio con consultas abiertas.
- **Aceptación y compatibilidad:** una caída reciente oculta por el agregado mensual, una promoción, integración incompleta y tienda sin ventas se distinguen correctamente. No sumar ingresos atribuidos por canales como si fueran ventas incrementales, no convertir ausencia en cero y no inferir causalidad desde dos periodos.

### A17-013 · Leer campañas, calendario y preparación comercial antes de añadir trabajo

- **Evidencia:** el calendario comercial, campañas previstas y propuestas aprobadas se construyen solo para el horizonte diario (`ai-runtime.ts:8375`, `:8567`), aunque el prompt semanal prohíbe duplicar campañas planificadas. A17 recibe actividad reciente general, que no equivale al inventario autorizado de campañas/envíos futuros, fechas límite y preparación que exige una entrega de varios días.
- **Mejora:** aportar a A17 un calendario acotado a su ventana y dependencias de preparación, con identidad/estado de campañas A05, mailings A27 y tareas existentes. Distinguir preparar una campaña ya creada de proponer otra; relacionar el entregable con el trabajo existente y mantener el enlace hacia marketing/copiloto.
- **Aceptación y compatibilidad:** una newsletter ya calendarizada y una campaña aprobada para una fecha comercial generan solo el trabajo de preparación que falte. Cambio de fecha, envío cancelado, transportista sin cutoff y evento de otra tienda no crean duplicados ni plazos inventados. Planificar no programa envíos ni publica anuncios.

### A17-014 · Deduplicar trabajo entre agentes y aprobaciones simultáneas con evidencia suficiente

- **Evidencia:** la aprobación general consulta tareas abiertas y deduplica por título exacto normalizado (`ai-runtime.ts:24405`, `:24811`). La identidad única `(agent_output_id,agent_proposal_index)` protege el reintento de una misma propuesta, pero dos outputs distintos pueden leer el mismo backlog antes de que cualquiera inserte. Un cambio de título también evita la deduplicación. La lectura general no pagina ni cuenta explícitamente todo el resultado; un backlog superior al límite REST puede quedar incompleto sin aviso.
- **Mejora:** comprobar equivalencia con identidad estable de trabajo: tienda, entidad, acción, objetivo/hito y ventana/cadencia, sin confundir dos entregables legítimos del mismo hito. Materializar mediante una guarda atómica compartida entre A04/A13/A17/A18 y campañas cuando corresponda. Paginar o consultar candidatos suficientes y fallar explícitamente si no se pudo comprobar la cobertura.
- **Aceptación y compatibilidad:** dos aprobaciones concurrentes de la misma acción crean una tarea; un título reformulado no genera otra; dos entregables distintos de una iniciativa siguen permitidos. Probar tareas compartidas sin tienda, backlog superior a mil, tareas completadas y reintentos parciales, conservando la procedencia de todas las propuestas relacionadas.

### A17-015 · Unificar el valor de los análisis especialistas pendientes de revisión

- **Evidencia:** A17 pide `includePendingAnalysis:true` y etiqueta los pendientes como indicios (`ai-runtime.ts:8361`). El prompt activo v7 describe resúmenes aprobados/publicados, mientras la interpretación devuelta por `loadRecentSpecialistOutputBlock` sigue afirmando que son evaluaciones previas aprobadas/publicadas incluso con esa opción (`:22642`). Los tests actuales admiten expresamente análisis pendientes; falta una política uniforme entre prompt, metadatos y uso posterior.
- **Mejora:** conservar la utilidad de un análisis pendiente como indicio, con estado, fecha y fuente explícitos, separado de tareas o decisiones aceptadas. Unificar las instrucciones y exigir contraste con hechos actuales antes de convertirlo en prioridad semanal. Una salida rechazada o caducada no puede convertirse en una autorización indirecta por atravesar otro agente.
- **Aceptación y compatibilidad:** especialista pendiente, aprobado, rechazado, antiguo y fallido producen contextos distinguibles. A17 puede proponer investigar una señal válida sin afirmar que el consultor ya la confirmó ni que sus tareas se aceptaron. Mantener el scope exacto y la prohibición de relanzar especialistas por disponer de su resumen.

### A17-016 · Reducir contexto y lecturas sin recortar la evidencia decisiva

- **Evidencia:** los dos snapshots v7 de test incluyen **41 y 42 bloques**. F9 tiene **32.636 caracteres**; el serializador limita cada bloque a **12.000** y el total a **48.000** (`untrusted-context.ts:2`). La reproducción confirma el corte de F9 a 12.000. El runner común consulta todo el contexto decisional antes de esa poda; guarda el snapshot previo al recorte, y el backlog/historial también se reducen con límites fijos. Un snapshot persistido no prueba por sí solo que todo su contenido llegó al modelo.
- **Mejora:** construir un perfil semanal con los compromisos, objetivo, restricciones y evidencia pertinentes primero. Resumir aprendizaje por decisiones aplicables y procedencia, consultar solo bloques necesarios y conservar un manifiesto del input efectivo con cortes/cobertura. Reutilizar configuración inmutable y trabajo de consulta común dentro de un lote autorizado; no reutilizar hechos entre tiendas ni saltarse comprobaciones actuales.
- **Aceptación y compatibilidad:** medir consultas, latencia, caracteres/tokens y campos retenidos con una y diez tiendas. Una restricción crítica, un veto o una iniciativa aprobada no desaparecen por crecer el historial. La interfaz identifica cobertura parcial; reducir contexto no aumenta falsos «todo cubierto» ni elimina evidencia que cambia la decisión.

### A17-017 · Hacer visible un plan semanal revisable y su relación con el trabajo real

- **Evidencia:** la configuración `DECISION_AI_AGENTS` todavía declara rutas de generación y presentación de A17, pero en el árbol local actual solo la usan sus tests; el uso efectivo de A17 está en la consulta del detalle del consultor (`dashboard-ai-agents.ts:13`; `consultant-desk.tsx:935`). `ClientPulse` recibe A17 mediante `extraProposals` en ese detalle; la vista cliente no lo consulta directamente. `WorkQueue` conserva título, descripción, prioridad, rol relativo y plazo, pero no representa como campos propios evidencia, criterio de cierre, métrica y hito (`client-pulse.tsx:750`). No se ha certificado el montaje del build desplegado.
- **Mejora:** definir y conectar el acceso al plan semanal para los roles previstos, reutilizando los endpoints existentes. Mostrar ventana, tienda, estado, fuente, entregables, criterio de cierre, medición e iniciativa/hito padre antes de decidir; después, enlazar a la tarea concreta. Aclarar cuándo se revisará automáticamente y qué acción autorizada existe ante un fallo o un cambio de contexto; retirar o conectar la configuración huérfana.
- **Aceptación y compatibilidad:** consultor y cliente autorizado entienden qué deben revisar, de qué semana es y dónde quedó cada tarea. Una semana sin propuestas muestra un motivo; un fallo o scope sin plan no se presenta como ausencia de trabajo. Abrir y navegar no genera llamadas pagadas y se conserva la cola actual de tareas/alertas.

### A17-018 · Conservar las razones humanas para no volver a proponer lo ya descartado

- **Evidencia:** el historial propio selecciona estado/output, pero no el recibo con `agent_approvals.reason`/`reason_category` (`ai-runtime.ts:5425`). La cola actual descarta propuestas individuales mandando índice y `skip`, sin motivo (`client-pulse.tsx:829`). Los resultados recientes de tareas sí pueden incluir `ignored_reason` y métricas declaradas, pero no sustituyen la razón de rechazar una propuesta que nunca se convirtió en tarea. El prompt exige resolver esa objeción con evidencia nueva.
- **Mejora:** registrar opcionalmente una razón útil al descartar o ajustar una propuesta y trasladarla, acotada y tratada como dato no confiable, al próximo plan de la misma tienda. Conservar ID original, edición humana, decisión y tarea materializada. Vincular la medición posterior al entregable y su ventana, separando entrega declarada de impacto observado.
- **Aceptación y compatibilidad:** «sin stock hasta noviembre», «ya cubierto por campaña» o «no hay capacidad» sobreviven a la siguiente semana y evitan insistencia sin evidencia nueva. Rechazar sigue siendo rápido y no obliga a inventar un motivo. Un texto de feedback no puede cambiar instrucciones del agente ni convertir una variación posterior en causalidad probada.

### A17-019 · Versionar la política efectiva y respetar los interruptores antes de gastar

- **Evidencia:** ambas DB tienen A17/prompt v7, checksum real coincidente, `search_knowledge` y `sql_select`, con `required_before_publish`. La migración `20270104120000_sql_select_a13_a17_a18_detallador.sql:18` añade SQL a la versión activa en sitio; una misma etiqueta v7 puede representar políticas distintas a lo largo del tiempo. El prompt conserva máximos contradictorios de cinco y cuatro tareas y una sección de tools que solo nombra búsqueda. Modelo de cliente/plataforma puede sustituir al declarado. Ante error al leer grupos deshabilitados, solo se cierran los agentes del grupo `canales`, no `planes` (`ai-agent-groups.ts:36`); los ajustes de plataforma también vuelven al diseño si su lectura falla (`agent-schedule.ts:104`).
- **Mejora:** promover una versión nueva y coherente de prompt, schema, herramientas y política, conservando hashes de cada uno y modelo/proveedor efectivos por run. Respetar una desactivación o restricción de coste cuando no pueda verificarse su estado: no interpretar un fallo de lectura como permiso nuevo para generar. Conservar SQL de solo lectura y búsqueda autorizada, con límites y recibos; ampliar herramientas solo ante una necesidad demostrada del plan.
- **Aceptación y compatibilidad:** ejecutar con política fijada y probar fallos de lectura, grupo `planes` apagado, modelo override, SQL denegado y presupuesto agotado. La misma versión no cambia silenciosamente de herramientas. No reescribir v7 ni sus salidas históricas y no añadir acciones de escritura/publicación para solucionar una necesidad de consulta.

### A17-020 · Cerrar con pruebas del flujo real y métricas de utilidad semanal

- **Evidencia:** pasan las pruebas de helpers, conservación de campos y contratos textuales, pero las reproducciones anteriores siguen detectando scope agregado, fallback de hito y aceptación de cinco tareas incompletas. Test tiene trece runs A17; producción ocho. No hay aprobaciones ni tareas materializadas de A17 registradas en ninguna base. Los dos v7 de test tienen cero propuestas; producción no tiene runs v7. Ese histórico no demuestra aprobación, aislamiento ni utilidad del flujo actual. La suite remota de deduplicación crea usuarios/filas y no se ejecutó durante esta auditoría.
- **Mejora:** añadir pruebas de comportamiento del runner y materializador con proveedor/DB controlados, y recorridos autorizados en un entorno aislado: cron → plan por tienda → revisión → aprobación parcial → tareas → Camino → cierre/medición → siguiente semana. Incluir fallos de red/DB, dos tiendas/organizaciones, roles, reintentos y edición concurrente. Evaluar con el modelo y política candidatos antes de promover. Medir aceptación, correcciones, duplicados evitados, entregas completadas, errores y coste por entregable útil.
- **Aceptación y compatibilidad:** cada hallazgo anterior tiene una regresión que falla antes del arreglo. Registrar build, entorno, política y límites de cada prueba; una aserción de regex o un run `succeeded` no cierra el flujo. Mantener separadas las métricas editoriales/operativas y el impacto de negocio, cuya atribución necesita evidencia independiente.

### Verificación y límites de la auditoría A17

- **Descubrimiento:** grafo MCP primero para entradas, funciones y llamadas; sus rangos de código estaban desactualizados y se contrastaron con los archivos locales actuales. Se revisaron runner compartido, contexto de horizontes/especialistas, herramientas, caché, aprobación/materialización, permisos, worker HTTP, cron, consumidores UI y pruebas. No se auditó todo el repositorio ni se certificó qué código de API/web/worker está desplegado.
- **DB en solo lectura:** test `kopcblejsxpkxoykldyh` y producción `cthjwpeygpzwdmjkxeqa`. A17 v7 activo en ambos, prompt de **8.844 caracteres**, SHA-256 `27f038d46edff46e8349a38c1d7d990017b35c6a1c021eca9c699365515c157f` calculado correctamente sobre el contenido, herramientas declaradas de búsqueda y SQL y aprobación previa a publicación. El modelo declarado de versión no acredita el modelo efectivo de cada run. No hay override específico de cadencia/modelo de A17 en la tabla de plataforma; ausencia de configuración explícita de organización no equivale a agente deshabilitado, porque existe selección por defecto.
- **Muestra histórica:** test **13 runs** (5 fallidos de cron y 8 exitosos manuales); producción **8** (7 fallidos y 1 exitoso, todos de cron). Los fallos consultados son históricos de saldo del proveedor; no prueban una incidencia de saldo actual. En ambos: **0 aprobaciones y 0 tareas A17 materializadas**. Las seis salidas v1 manuales de test sin snapshot no acreditan una ejecución completa del modelo; los dos v7 de test sí tienen snapshot, cero propuestas y estado pendiente. No se infiere calidad ni causalidad desde estos conteos.
- **Permisos efectivos:** las cuatro tablas consultadas tienen RLS y SELECT para `authenticated`; sus políticas son idénticas entre test/producción y no expresan alcance por tienda. El helper de acceso organizativo tampoco discrimina `access_scope`. No existen membresías activas limitadas a tienda en la muestra; no se crearon usuarios ni se impersonaron sesiones para comprobar explotación.
- **Pruebas locales:** **66/66** en `plan-horizon-context`, `agent-task-delivery`, `ai-agent-approval-guards`, `consultant-specialist-context` y `decision-playbook-chat-context`; **8/8** en HTTP/repetibles del worker. La pasada ampliada que incluye `ai-diagnostic-activity-gate` terminó **94/95**: falla la expectativa existente de agregado de A14 en `ai-diagnostic-activity-gate.test.ts:88`, no una regresión introducida por esta auditoría. Se conserva el fallo documentado; no se cambió código para hacerlo pasar.
- **Reproducciones sin persistencia:** con dos tiendas, A17 devuelve solo scope agregado; cadencia base de seis días; el contrato lean acepta cinco tareas vacías sin los cuatro campos de entrega; `null` permite fallback al hito actual; un A18 pendiente más nuevo oculta el aprobado anterior; un bloque de aprendizaje de 32.636 caracteres se corta a 12.000. Se usó un script temporal fuera del repositorio y no se invocó al proveedor de IA.
- **Referencias:** se contrastó la documentación oficial de [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), incluidos grants y bypass de `service_role`, y el changelog actual. Los avisos de TLS/Postgres consultados no explican estos hallazgos de lógica. No se hicieron migraciones, ejecuciones del cron, generaciones pagadas, envíos, despliegues ni modificaciones de datos de negocio; el recorrido autenticado y los escenarios adversariales de DB quedan como aceptación a verificar al implementar.


## A18 · Plan mensual conectado con Mi Camino

**Auditoría: 20 de octubre de 2026. Estado: 20 mejoras propuestas; esta pasada no las implementa.** Se revisó el código del directorio principal sobre `04c26ec`, incluidos sus cambios locales, y se contrastaron los cambios compartidos del worktree de A17. No se certificó qué revisión de API, web o worker está desplegada.

A18 sí consulta Mi Camino: `runPlanAgent(month)` lee el plan activo y envía su meta, fases e hitos al modelo. Su función útil es decidir qué iniciativas estructurales del mes hacen avanzar esa dirección aprobada; A17 las convierte en entregables semanales y A04 en pasos diarios. Mi Camino/A19 conserva la autoridad sobre la ruta y los objetivos. A18 debe poder recomendar una revisión de esa ruta con evidencia nueva, sin generar otra estrategia paralela ni reabrir sus hitos silenciosamente.

Ejemplo de relación que hay que completar: un hito de mejorar el margen puede dar lugar a una iniciativa A18 de revisar la política de descuentos, entregables A17 para comprobar y preparar el cambio, y acciones A04 para ejecutarlo tras la aprobación correspondiente. Sin Camino activo, la interfaz y las propuestas deben declarar la ausencia de dirección aprobada y distinguir una iniciativa independiente de un compromiso del plan.

Carga considerada: varias organizaciones, dos o más tiendas por organización, generación automática y manual, decisiones simultáneas, cambios humanos de objetivos y reintentos tras resultados parciales.

### A18-001 · Generar y recuperar el mismo plan mensual por tienda y ventana

- **Evidencia:** `orchestratorScopesForAgent` (`apps/api/src/ai-runtime.ts:16897`) devuelve solo el agregado para A18; la llamada del cron (`:17881`) pasa `connectionId=null`. El horizonte mensual usa 90 días por defecto (`:8050`), mientras la mesa del consultor pide `/ai/plan/month?days=30` con su tienda (`apps/web/src/app/dashboard/consultant-desk.tsx:936`). El GET filtra exactamente tienda y lookback. Con dos tiendas se reprodujo un único scope agregado; en test los dos Caminos activos pertenecen a tiendas y no hay plan agregado que esa ejecución pueda leer.
- **Mejora:** ejecutar A18 por tienda autorizada y acordar una identidad común de plan, periodo de análisis y periodo de ejecución entre cron, lectura y generación manual. Mantener cualquier vista agregada como producto explícito, con sus propias fuentes y límites, sin sustituir planes de tienda.
- **Aceptación:** dos tiendas con metas distintas reciben iniciativas separadas; abrir la mesa recupera el resultado automático sin gastar otra generación. Verificar 30/90 días, tienda inactiva, conexión ausente y ausencia de Camino. La ampliación por tienda hecha para A17 no incluye todavía A18.

### A18-002 · Leer los objetivos vigentes y el progreso mensual real de Mi Camino

- **Evidencia:** el contexto mensual consulta `strategic_plans.goal` y un resumen de hitos (`ai-runtime.ts:8233`; `plan-horizon-context.ts:283`). No consulta en ese recorrido los objetivos vigentes de `organization_metric_targets`, los cambios humanos de `camino_objective_changes` ni el progreso determinista que ya calcula la revisión A19. El resumen elimina `goal.monthly_targets`; se reprodujo que un checkpoint mensual presente en la entrada desaparece de la salida. Los hitos se recortan a doce por posición, sin seleccionar los del mes ni exponer cobertura.
- **Mejora:** incluir objetivos vigentes de tienda/hito con su procedencia, plan/versión, mes del Camino, checkpoint aplicable, fecha y progreso calculado con ventanas equivalentes. Priorizar hitos pertinentes al mes y señalar los omitidos. Reutilizar el cálculo de A19 y la fuente única de objetivos; A18 no debe escribir otra meta competidora.
- **Aceptación:** cambiar una meta en Mi Camino cambia el contexto de A18; un objetivo retirado deja de ser autoridad. Cubrir hitos después del duodécimo, primer/último mes parcial, objetivos de otra tienda, meta desconocida y checkpoint sin datos. El ID de plan incorporado en la rama A17 es una parte reutilizable, no resuelve por sí solo esta lectura.

### A18-003 · Revalidar Camino y materializar iniciativa/enlace sin reabrir el plan

- **Evidencia:** las guardas de plan/versión/fase/hito en `decideAgentOutput` excluyen A18 (`ai-runtime.ts:24861–24912`). Una simulación con el agente correctamente resuelto a A18 creó la tarea, intentó enlazarla y llegó a intentar reabrir un hito completado; no hubo consulta de validación de hito antes del insert. `reopenCaminoMilestoneForWork` puede reabrir también fase y plan (`strategic-plans.ts:1487`). El trigger remoto impide el cruce entre dos tiendas explícitas, pero no comprueba aprobación, versión ni vigencia; un task sin tienda puede adquirir la del hito.
- **Mejora:** exigir la identidad exacta del Camino usado al generar y revalidarla bajo transacción al crear o sustituir una iniciativa. Crear tarea y enlace de forma atómica; ante cambio, dejar una decisión recuperable y explicable. Conservar `milestone_id=null` como tarea independiente; el fallback ya está desactivado para A18 y debe seguir así.
- **Aceptación:** plan archivado/cambiado, hito completado o tienda distinta no generan enlaces nuevos ni reaperturas. Preparar trabajo de una fase bloqueada exige una relación aprobada y no activa esa fase automáticamente. Una intención de modificar la estrategia debe llegar a revisión de Camino, con su aprobación propia. Los nuevos controles de A17 no incluyen A18.

### A18-004 · Exigir un contrato mensual completo y una abstención explicada

- **Evidencia:** A18 usa el contrato genérico lean (`ai-runtime.ts:5925`; `packages/ai/src/index.ts:3519`). Owner, criterio de cierre y medición siguen siendo opcionales/nulos; no hay máximo mensual de propuestas en ese contrato. La reproducción aceptó cinco tareas sin esos campos. Además se elimina `answer`, aunque el prompt pide explicar por qué no hay iniciativas: con cero tareas el parseo repone «Sin trabajo nuevo que proponer en este ciclo», incluso sin evidencia para distinguir esa conclusión.
- **Mejora:** dar a A18 una validación propia: cero a tres iniciativas completas, criterio de entrega, responsable, evidencia/limitación y medición con baseline/target desconocidos permitidos como null. Conservar una explicación obligatoria para ausencia de trabajo, datos insuficientes, dirección no aprobada o bloqueo. Modelar retirada/sustitución como acciones explícitas, con requisitos adecuados a cada una.
- **Aceptación:** rechazar salidas incompletas antes de persistirlas como válidas, sin invalidar históricos. Probar cero, una, tres y cuatro iniciativas; una retirada no necesita aparentar una tarea nueva y un dato desconocido no equivale a cero.

### A18-005 · Conservar la medición, el responsable y el criterio de entrega al materializar

- **Evidencia:** la creación guarda los campos de medición directamente dentro de `metadata.ai_monthly_initiative` (`ai-runtime.ts:24968`), pero `summarizeActiveMonthlyInitiatives` busca un objeto anidado `initiative.initiative_measurement` (`plan-horizon-context.ts:276`). El round trip real del helper devolvió null pese a haber baseline 1, target 2 y ventana de 30 días. La metadata A18 tampoco conserva owner/criterio, y el reparto usa consultores de la organización sin atender `owner_role` (`task-assignment.ts:77`). Sin medición, una iniciativa nueva puede ni siquiera recibir el marcador mensual.
- **Mejora:** unificar el contrato durable y leer de forma compatible los formatos históricos. Guardar siempre identidad mensual, medición, responsable, criterio, periodo y relación Camino; respetar el rol de ejecución al asignar, o dejar explícita la asignación pendiente. No convertir una iniciativa incompleta en una tarea ordinaria por perder su marcador.
- **Aceptación:** generación → aprobación → recarga → siguiente A18/A17 conserva exactamente métrica, valores, ventana y responsable. Una tarea del cliente no se asigna silenciosamente a un consultor y una tarea del consultor no aparece como libre de responsable.

### A18-006 · Enlazar las iniciativas con sus entregables A17/A04 y mostrar avance

- **Evidencia:** A18 se materializa como task con un hito opcional, pero los contratos y metadata de A17/A04 no guardan un ID/versión padre de iniciativa mensual. Los resúmenes transmiten contenido, no una relación durable de desglose. La búsqueda en código, contratos y migraciones no encontró campos de parentaje de iniciativa. Retirar/sustituir la iniciativa no permite identificar de forma fiable los entregables que dependían de ella.
- **Mejora:** añadir un vínculo explícito y validado iniciativa mensual → entregables semanales → acciones diarias, con tienda, versión y medición padre. Agregar estado de entrega y bloqueos sin contar una misma tarea varias veces. Ante sustitución, presentar qué trabajo descendiente queda afectado y requiere revisión, conservando el historial.
- **Aceptación:** desde Mi Camino se puede abrir una iniciativa, sus entregables y sus resultados; desde una tarea se puede volver a la dirección que la justifica. Compartir hito no basta para declarar parentesco. Retirar un padre no cancela automáticamente trabajo independiente ni borra tareas ya completadas.

### A18-007 · Recuperar sustituciones y retiradas después de un fallo parcial

- **Evidencia:** la RPC `approve_a18_monthly_initiative_change` bloquea la fila y versiona la sustitución, pero no recibe output/índice/clave de intención ni devuelve un recibo recuperable por esa identidad (`20261115795000_a18_versioned_replanning.sql:3`). El API no registra un estado final por propuesta tras el cambio y enlaza el nuevo hito fuera de la RPC (`ai-runtime.ts:24641–24707`). Se simuló retirada exitosa + fallo de otra tarea: primer intento 503; al reintentar, la retirada aplicada se interpreta como objetivo no disponible y vuelve a 503.
- **Mejora:** persistir en la misma transacción un recibo por salida/propuesta, operación, objetivo y versión esperada. Recuperarlo en reintentos y reflejar `retired/replaced`, nueva tarea y enlace en `proposal_decisions`. Revalidar dentro del lock la identidad que se mostró al revisor, además del estado, y resolver explícitamente fallos de enlace.
- **Aceptación:** fallo al crear otra tarea, guardar recibo, cerrar output o perder la respuesta permite completar solo lo pendiente. Dos aprobaciones concurrentes no sustituyen dos veces; una edición humana del objetivo entre lectura y lock no se cancela sin detectar el cambio.

### A18-008 · Mostrar al revisor cuándo va a retirar o sustituir trabajo

- **Evidencia:** la mesa del consultor manda A18 a `WorkQueue`, cuya fila solo conserva título/descripción/prioridad/due/owner (`client-pulse.tsx:695–775`). Descarta `initiative_change`, medición y vínculo Camino, y la acción accesible se llama «Crear tarea» (`:1042`) incluso si la aprobación retira una iniciativa. El componente genérico `ai-diagnostic-section.tsx:1002` sí tiene una advertencia de sustitución, pero ese detalle no se conserva en esta cola.
- **Mejora:** presentar el mes, objetivo/hito, medición, iniciativa anterior y alcance del cambio antes de aprobar. Usar acciones claras de crear/sustituir/retirar y enseñar el recibo de cada una, incluidos resultados parciales. Conservar revisión individual y edición humana sin anunciar que se creó una tarea cuando se canceló otra.
- **Aceptación:** una persona entiende qué seguirá activo y qué quedará retirado. Una retirada pura muestra la decisión real; una sustitución permite abrir ambas versiones. Probar lector de pantalla, recarga después de aprobación parcial y edición concurrente.

### A18-009 · Acotar decisiones y aprendizaje a la tienda del plan mensual

- **Evidencia:** el runner pasa `storeId` al loader del playbook para A12/A13/A14, pero no para A18 (`ai-runtime.ts:6324–6334`). `loadDecisionPlaybookContextBlocks` sin scope carga decisiones, experiencias y diagnóstico ejecutivo de toda la organización (`decision-playbook-chat-context.ts:937`). Seleccionar una tienda en el plan mensual no acota esos bloques; la rama A17 añade el scope solo para A17.
- **Mejora:** filtrar evidencia y aprendizaje operativo por tienda/caso/experiencia con procedencia explícita. Separar metodología compartida de resultados concretos de otras tiendas y conservar la evidencia mensual útil sin cargar por defecto todo F3–F11.
- **Aceptación:** con tienda A en crecimiento y tienda B bloqueada, A18 de A solo atribuye datos/decisiones de A. Probar experiencias sin tienda, aprendizaje global metodológico y fallos de consulta. La muestra remota no demostró una contaminación real entre tiendas; el hallazgo procede del alcance del loader.

### A18-010 · Hacer atómico el cupo manual y reconocer los reintentos del mismo plan

- **Evidencia:** A18 queda fuera de la reserva atómica de `assertManualRefreshQuota` (`ai-runtime.ts:5673`) y usa contar-antes-de-insertar. La ruta valida `Idempotency-Key`, pero solo la transmite para horizonte diario (`server.ts:9439`). Dos solicitudes de A18 pueden superar el último cupo o repetir una generación al perderse la respuesta.
- **Mejora:** reservar por organización/agente/tienda y distinguir periodo mensual, intención nueva y reintento técnico. Propagar la clave desde los consumidores y recuperar run/resultado previo; mantener los límites económicos ya existentes.
- **Aceptación:** dos peticiones simultáneas con el último cupo no arrancan ambas; la misma clave devuelve el mismo trabajo. Otra tienda o una nueva intención no reutiliza una iniciativa ajena. El límite manual no debe confundirse con la frecuencia del cron.

### A18-011 · Dar a la ejecución automática exclusión, recuperación y señales de cambio de Camino

- **Evidencia:** A18 solo busca runs exitosos al decidir cuándo repetir (`ai-runtime.ts:17672`), no tiene lease por scope y su llamada no persiste el digest de la candidatura (`:17881`). El mínimo es 27 días y el freno de pendientes solo tres. Un fallo sin éxito previo vuelve a ser candidato en la siguiente pasada; un cambio de objetivo dentro de la cadencia no tiene tratamiento mensual específico. Las nuevas leases/backoff de A17 solo se aplican a A17.
- **Mejora:** reutilizar la exclusión durable por tienda/periodo, registrar intentos fallidos/en curso y programar recuperación según causa. Guardar una huella de objetivos/plan/backlog relevante y reabrir la revisión mensual cuando cambie la dirección aprobada o una dependencia decisiva, sin regenerar por cada navegación o edición menor.
- **Aceptación:** dos ticks, timeout y reinicio no duplican el trabajo. Un fallo del proveedor respeta circuito y backoff; un cambio de objetivo deja el plan anterior superado y ofrece revisión trazable. Integrar la corrección compartida del timeout del worker de la rama A17, sin dar por resuelta con ella la concurrencia de A18.

### A18-012 · Alimentar decisiones estructurales con evidencia comparable de los canales

- **Evidencia:** el pack mensual trae ventas Shopify actuales/previas y A02, pero excluye especialistas (`horizon !== month`, `ai-runtime.ts:8355`). A02 se busca con el mismo lookback; A18 usa 90 por defecto, mientras el cron A02 por tienda solo genera la ventana de 30 (`:17556`). La frescura Shopify se resume desde cualquier sync de la conexión, sin preservar en el resumen el `sync_scope` ni `records_failed`: un sync de otro dominio puede aparentar frescura de ventas. SQL está disponible, pero la migración del gateway documenta que no aporta vistas Klaviyo.
- **Mejora:** componer un pack mensual compacto con A02 compatible y especialistas de la tienda, cobertura de pedidos/costes, retención, email y calidad de medición Meta. Reutilizar cálculos del servidor y herramientas de lectura autorizadas cuando falte una cifra; distinguir hipótesis de investigación de iniciativas de inversión o margen que exigen evidencia suficiente.
- **Aceptación:** costes incompletos, Meta no fiable, Klaviyo desconectado o sync parcial impiden afirmar viabilidad/rentabilidad con cifras inventadas. Una sincronización de productos no rejuvenece ventas. La ausencia de un A02 de 90 días no debe borrar otro diagnóstico pertinente ni atribuirle esa ventana.

### A18-013 · Planificar el mes con campañas y preparación comercial confirmadas

- **Evidencia:** `buildCaminoCalendarPack` solo se llama para el horizonte diario en main (`ai-runtime.ts:8371`); la rama A17 lo amplía a diario/semanal, no a mensual. A18 puede proponer reorganizar campañas o calendario sin recibir como pack explícito las campañas A05/A27 confirmadas, sus entregables y plazos de preparación.
- **Mejora:** incorporar el calendario de los mercados/vertical de la tienda y un horizonte de preparación suficiente para el mes, con campañas y mailings confirmados separados de eventos de referencia. Priorizar dependencias estructurales y coordinar con A05/A27, preservando la autoridad del calendario y los borradores existentes.
- **Aceptación:** una campaña ya aprobada no se vuelve a diseñar como iniciativa nueva. Un evento próximo con preparación larga entra a tiempo; un evento no aplicable a ese mercado no crea trabajo. No se programan envíos, anuncios ni cambios de presupuesto desde A18.

### A18-014 · Comprobar duplicados y compromisos con cobertura suficiente

- **Evidencia:** la deduplicación de aprobación A18 usa títulos normalizados de una lectura sin paginación/recuento (`ai-runtime.ts:24380–24432, 24817`). La unicidad por output/índice protege el reintento de una propuesta, no dos salidas distintas. La lista mensual se extrae de hasta 500 tareas generales y se recorta a 30 sin declarar omisiones (`plan-horizon-context.ts:251–279`); una iniciativa puede quedar fuera detrás de tareas diarias. La identidad atómica añadida en A17 no se guarda en las tareas A18.
- **Mejora:** consultar iniciativas aprobadas por su identidad y ciclo de vida, con cobertura/continuación explícita, y deduplicar operaciones equivalentes entre salidas bajo una guarda compartida cuando corresponda. Distinguir una iniciativa padre de su desglose semanal legítimo; no comparar solo títulos ni confundir un borrador con trabajo aceptado.
- **Aceptación:** más de 500 tareas, más de 30 iniciativas, títulos reformulados y aprobaciones simultáneas no duplican compromisos ni pierden sustituciones válidas. Fallar la lectura de candidatos mantiene la propuesta recuperable. Reutilizar el resumen de capacidad con totalCount de la rama A17 donde aplique.

### A18-015 · Conservar pendientes y unificar frescura, vacío y fallo

- **Evidencia:** el GET de A18 recupera un único éxito (`ai-runtime.ts:7065`); la recuperación de pendientes múltiples está limitada a A14 y, en la rama nueva, A17. A18 no entra en la cadencia específica ni en el override de frescura del envelope (`:7119, 7230`). Se reprodujo caché stale y envelope fresh para la misma fecha. Un resultado nuevo con cero tareas puede esconder otro pendiente del mismo scope, y el último intento fallido no sustituye ni acompaña al éxito anterior.
- **Mejora:** exponer resultados pendientes revisables, decisiones por propuesta, última ejecución/último intento y vigencia mensual coherente en API/UI. Resolver supersesión con identidad/periodo y revisión, conservando decisiones previas. Mostrar por separado falta de ejecución, falta de datos, ausencia de iniciativas y fallo reciente.
- **Aceptación:** generar cero iniciativas no borra trabajo pendiente. A18 no aparece obsoleto al día siguiente solo porque comparte el TTL diario, ni fresco en otro formato cuando ya venció. Probar múltiples pendientes, fallo después de éxito y salida rechazada/aprobada.

### A18-016 · Anclar el mes de ejecución y la medición a una zona horaria

- **Evidencia:** `runPlanAgent` guarda como `time_range` la ventana histórica de 90/30 días, pero el mes futuro se expresa solo en el objetivo; `initiative_measurement.evaluation_window` es texto libre (`agent-task-delivery.ts:132`). No se conserva una ventana tipada de ejecución/evaluación ni el mes ordinal de Camino. «En 30 días» sigue sin ancla al reabrir la tarea más tarde.
- **Mejora:** separar periodo analizado, periodo mensual de ejecución y ventana de medición, con as_of, zona del negocio e identidad del checkpoint. Calcular fechas desde datos estructurados y permitir desconocido cuando no se haya acordado un plazo; conservar la intención original de los textos históricos.
- **Aceptación:** fin de mes, febrero, cambios de hora y aprobación tardía no desplazan silenciosamente la meta. No comparar un mes parcial con uno completo ni convertir un objetivo aspiracional en forecast. La UI explica a qué mes pertenece cada iniciativa.

### A18-017 · Autorizar de forma coherente las cuentas limitadas a una tienda

- **Evidencia:** generación, GET mensual y decisión comienzan con `requireMembership` organizativo (`ai-runtime.ts:8153, 12758, 24035`); `requireOperationalOrganization` devuelve `store_scope_required` si solo hay membresía de tienda. Elegir una conexión permitida no alcanza la validación específica. En ambas DB ya existen las cuatro políticas restrictivas de lectura aplicadas con A17; no se vuelve a registrar como pendiente aquel problema de SELECT organizativo amplio.
- **Mejora:** verificar acceso al scope explícito en todos los wrappers, runner compartido y aprobación antes de usar service_role, sin ampliar a organización. Conservar permisos actuales de consultor asignado/admin y las reglas de quién puede decidir.
- **Aceptación:** el usuario de tienda A puede usar el flujo autorizado de A, pero no leer/crear/retirar trabajo de B ni una salida agregada. Probar rutas API y acceso directo a Supabase por rol. La mejora de entrada de A17 debe revisarse de extremo a extremo; no basta con cambiar solo un wrapper.

### A18-018 · Reducir lecturas/contexto y registrar la entrada efectiva

- **Evidencia:** el único run v7 de test guarda 55.509 caracteres JSON de bloques, con F9 de 32.757 y `context_truncated=true`. El serializador corta cada bloque a 12.000 y el conjunto a 48.000 (`packages/ai/src/untrusted-context.ts:2, 37`), por fragmentos de texto. A18 carga el pack general antes de seleccionar y su snapshot conserva los bloques originales, no un manifiesto propio del material efectivamente enviado. El hash/manifiesto nuevo de A17 se activa solo para A17; ya existen flag global y eventos de truncamiento y deben conservarse.
- **Mejora:** seleccionar unidades estructuradas completas y compactas para decisiones mensuales, priorizando dirección, errores/cobertura y compromisos. Evitar consultas de fases que no contribuirán y registrar fuentes seleccionadas, límites, hashes y recortes efectivos sin aumentar indiscriminadamente el contexto.
- **Aceptación:** un historial largo no corta a mitad la evidencia clave ni oculta su calidad. Comparar consultas, bytes, tokens y latencia con el mismo caso; no atribuir ahorros no medidos. Reutilizar el mecanismo A17 para el recibo de entrada A18.

### A18-019 · Versionar una política coherente y comprobar sus restricciones antes de gastar

- **Evidencia:** test/producción tienen A18 v7 con prompt de 9.847 caracteres y checksum correcto. El prompt acumula máximos de cuatro y tres iniciativas y una sección de herramientas que nombra solo búsqueda, aunque están habilitados búsqueda y SQL. `20270104120000_sql_select_a13_a17_a18_detallador.sql:18` modifica allowed_tools en la versión activa. Ante fallo de la política de plataforma se vuelve al diseño (`agent-schedule.ts:95`); la protección nueva de A17 se solicita solo para A17.
- **Mejora:** publicar una versión nueva coherente de prompt/schema/herramientas/política mensual, preservando v7 y registrando sus huellas. Respetar las restricciones verificables de coste/modelo/cadencia y detener A18 si no se puede confirmar una política necesaria para autorizar el gasto. Conservar el registro existente de modelo/proveedor efectivos y las reservas/circuito económicos del runner.
- **Aceptación:** fallo de lectura no reactiva un cron que estaba apagado ni cambia silenciosamente su política económica. Verificar override de modelo, herramientas denegadas, presupuesto agotado y grupo planes desactivado. Integrar la corrección compartida de grupos de la rama A17 y extender solo lo que sigue faltando para A18.

### A18-020 · Verificar el flujo mensual y medir su utilidad respecto al objetivo

- **Evidencia:** las pruebas actuales cubren helpers y contratos textuales, pero no detectan el round trip de medición roto ni el bloqueo de retirada parcial reproducidos aquí. El catálogo offline declara un caso mensual específico (`agent-evals.ts:49`); no acredita la calidad del agente real. Producción no tiene salidas/aprobaciones/iniciativas A18 y test no tiene ninguna aprobación ni iniciativa materializada.
- **Mejora:** añadir regresiones de comportamiento y una matriz aislada de cron → revisión mensual → aprobación parcial/sustitución → tareas y Camino → desglose A17/A04 → entrega/medición → mes siguiente. Evaluar la política candidata con casos representativos y registrar aceptación, correcciones, duplicados evitados, cierres, bloqueos y coste por iniciativa útil. Dar seguimiento a la métrica fechada con fuentes y comparabilidad, manteniendo entrega declarada e impacto de negocio separados.
- **Aceptación:** dos organizaciones/tiendas, roles, cambios de objetivos, datos insuficientes, reintentos y fallos de DB/red tienen resultados comprobables. La revisión mensual explica qué contribuyó al objetivo, qué no es evaluable y qué requiere revisión; ni una tarea completada ni un run succeeded prueban causalidad.

### Verificación y límites de esta auditoría A18

- **Código y descubrimiento:** grafo MCP primero para runner, llamadas, resúmenes y RPC; contraste con fuente local porque el índice puede estar desactualizado. Se siguieron rutas, cron/worker, contexto, herramientas, caché, autorización, materialización/replanificación, asignación, consumidores de consultor y contratos. No se auditó todo el repositorio.
- **Bases, solo lectura:** test `kopcblejsxpkxoykldyh` y producción `cthjwpeygpzwdmjkxeqa`. En ambas A18 v7/prompt v7 activo, modelo declarado `claude-sonnet-5`, herramientas `search_knowledge/sql_select`, aprobación `required_before_publish`, SHA-256 `230dcfa8adf6fd008eca1abb85b84a9fd64348717a02fe82787d63e7e246b2a0` válido. No hay override específico A18 en la tabla de plataforma; eso no significa agente desactivado. El modelo declarado no acredita qué modelo efectivo usaría una organización.
- **Histórico observado:** test: 10 runs, tres fallidos de cron v1 y siete exitosos manuales (seis v1 y uno v7). Sus siete salidas están pendientes, con doce propuestas en total; el único v7, de 12/10/2026, es por tienda con lookback 30 y cero propuestas. Producción: 31 runs fallidos de cron v1 y ninguna salida, sin runs v7. En ambas: cero aprobaciones y cero tasks con metadata mensual. Los errores históricos consultados son de saldo del proveedor, no se verificó saldo actual.
- **Relación Camino:** test tiene dos planes activos, ambos por tienda, y seis objetivos vigentes; producción no tiene plan activo y tiene un objetivo vigente. No hay objetivos ligados a hitos en esta muestra. Se verificaron el trigger de scope y cuatro políticas restrictivas de lectura ya aplicadas en A17; no se crearon membresías ni se impersonaron sesiones.
- **Pruebas existentes:** selección de seis suites locales con `tsx --test --test-force-exit`: 95 pruebas, 94 aprobadas y un fallo preexistente en `ai-diagnostic-activity-gate.test.ts:88`, que aún espera un agregado A14. No se cambió código para corregir esa expectativa y no se presenta la suite como completamente verde.
- **Reproducciones aisladas:** scopes A18 agregado con dos tiendas; incompatibilidad 90/30; aceptación contractual de cinco iniciativas incompletas; respuesta genérica sin tareas; checkpoint mensual descartado; métrica guardada que vuelve como null; caché stale frente a envelope fresh. Dos escenarios invocaron el materializador del API con fetch interceptado y host ficticio obligatorio: hito completado que llega a reapertura y retirada aplicada que bloquea el reintento de un lote parcial. Todo el estado de esas escrituras fue simulado en memoria; no prueba concurrencia real de PostgreSQL.
- **Fuentes y alcance pendiente:** contrastadas las reglas de grants/RLS/service_role con la [documentación oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y revisado su [changelog](https://supabase.com/changelog). Los avisos de proveedor no explican los fallos de lógica registrados. No hubo generación pagada, aprobación real, migración, envío, despliegue ni cambio de datos de negocio. Falta el recorrido autenticado y adversarial completo con DB/proveedor controlados.
- **Único cambio persistente en el repositorio:** se añade esta auditoría al MD. Las correcciones compartidas que aún viven en la rama A17 son dependencias de integración, no se confunden con código publicado ni se cuentan como nuevas implementaciones de A18.

## A19 · Arquitectura, ejecución y seguimiento de Mi Camino

**Auditoría: 20 de octubre de 2026. Estado: 20 mejoras A19-001 a A19-020 registradas, pendientes de implementación.** Se revisó el directorio principal sobre `04c26ec`, incluidos sus cambios locales. La implementación A17/A18 del worktree `codex/a17-full-improvements` sigue siendo una dependencia de integración; sus cambios locales no acreditan el código desplegado. Esta pasada solo añade la auditoría al MD.

A19 reúne tres trabajos: el arquitecto propone dirección, objetivo, fases e hitos; el detallador amplía las tareas de cada hito; el revisor contrasta el Camino aceptado con datos actuales y propone ajustes. Mi Camino conserva la dirección aprobada; A18 debe desarrollar iniciativas mensuales, A17 entregables semanales y A04 acciones diarias compatibles con sus compromisos. Carga considerada: varias organizaciones y tiendas, decisiones simultáneas y reinicios durante generaciones largas. El Compose inspeccionado declara una API y un worker; varios procesos de API se consideran una ampliación que debe soportarse antes de escalar, no una topología de producción comprobada.

**Activaciones comprobadas:** el arquitecto se pide mediante `POST .../ai/camino-proposal/run`; `?async=1` devuelve 202 y la pantalla consulta progreso. Después se ejecuta el detallador. Los GET de propuesta/plan no generan un Camino; el GET de progreso sí puede marcar fallida una ejecución que interpreta como interrumpida. El revisor entra por el orquestador del worker, con cadencia de diseño de tres días y primera revisión tres días después de activar el plan. Cambiar un objetivo programa otra revisión tras dos minutos de espera; existe reintento explícito para la revisión periódica fallida o caducada del ciclo actual. Los nombres `weekly` son históricos: no describen la cadencia actual.

### A19-001 · Unificar autorización por tienda en API y RLS de todo el Camino

- **Evidencia y caso:** `assertCanManagePlan`, los GET de Camino y el inicio del arquitecto exigen acceso organizativo antes de resolver la tienda (`strategic-plans.ts:154`, `ai-runtime.ts:10465`). Un miembro limitado a una tienda queda bloqueado incluso eligiendo su conexión. En ambas DB hay SELECT para `authenticated` y políticas de planes, fases, hitos, revisiones, propuestas/eventos y cambios de objetivos basadas en acceso organizativo; los helpers inspeccionados no discriminan `access_scope`. La protección A17 del enlace hito-tarea no cubre por sí sola todo ese árbol.
- **Mejora:** resolver y autorizar la tienda concreta antes de usar `service_role`, y extender la misma regla a las políticas de las tablas relacionadas. Derivar el alcance de revisiones/eventos de su plan y conservar acceso explícito de consultor asignado y administrador.
- **Aceptación:** una cuenta de tienda A puede completar su flujo autorizado y no leer el plan, revisiones o decisiones de B mediante API ni Data API. Probar borrador/activo, agregado, suscripción y roles. No reasignar registros históricos sin tienda por inferencia. No se observó una filtración: actualmente hay cero miembros de tienda en las dos muestras y no se impersonaron usuarios.

### A19-002 · Conservar la unidad temporal real de la línea base

- **Evidencia y caso:** el arquitecto recibe `run_rate_3m`, una media mensual de tres meses completos, y la instrucción de usarla como `goal.baseline` (`ai-runtime.ts:8999`, `camino-seasonality.ts:69`). `caminoProposalToPlanInput` añade como `baseline_window_days` el lookback del run (`strategic-plans.ts:3308`); después `calculateCaminoGoalProgress` vuelve a normalizarlo. Reproducción con los helpers reales: una base mensual de 10.000 y lookback de 180 días termina como **1.691,11**, alterando el ritmo y la barra de avance.
- **Mejora:** tipar si la base es total de una ventana, media mensual o fotografía, con fechas, moneda y procedencia. Normalizar exactamente una vez y mantener separadas la ventana histórica consultada y la base empleada en la meta.
- **Aceptación:** el valor mensual de 10.000 sigue siendo 10.000 tras generar, aceptar, revisar y renderizar. Cubrir ventas, pedidos y beneficio, versiones antiguas y base desconocida; la UI debe usar la base comparable de la medición, no mezclarla con el valor bruto del objetivo.

### A19-003 · Separar cadencia de revisión y ventana de medición de cada métrica

- **Evidencia y caso:** el revisor consulta tres días de Meta y de métricas móviles (`ai-runtime.ts:9591`, `:9770`), pero `camino-goal-progress.ts:34` conserva siete días y exige cinco días Meta cubiertos. Tres fechas distintas nunca satisfacen ese mínimo. La reproducción devuelve `insufficient_data` con «3 de los 7 días» aunque la consulta de tres días sea completa. Además, la ventana Shopify actual va desde medianoche de anteayer hasta la hora presente, mientras la anterior dura tres días completos.
- **Mejora:** mantener la cadencia de tres días si es la política deseada y pasar ventanas de medición explícitas por métrica. Consultar siete días si la regla de evidencia exige siete, o definir otro mínimo justificable para tres; comparar intervalos de igual duración y cobertura. Distinguir mes hasta la fecha de mes anterior completo.
- **Aceptación:** una fuente Meta con cobertura suficiente puede evaluarse; una insuficiente sigue declarando el límite. Verificar horas de ejecución, fin de mes, febrero y zonas horarias. Las fechas del RPC, la explicación, el schema y la UI deben coincidir; un mes parcial no se etiqueta como comparable con uno completo.

### A19-004 · Calcular porcentajes y ratios sin prorratearlos como ingresos

- **Evidencia y caso:** `CALENDAR_MONTH_METRICS` incluye `net_margin_pct`, y el objetivo mensual se multiplica por la fracción de días transcurridos (`camino-goal-progress.ts:38`, `:286`). En una reproducción al 10 de octubre, margen observado de **12 %** frente a checkpoint mensual de **20 %** aparece `on_track`: el código reduce la referencia a **6,45 %**. Un porcentaje de margen no se acumula por días como una cifra de ventas.
- **Mejora:** definir reglas según la naturaleza de la métrica: flujos acumulables, tasas ponderadas, ratios y fotografías. Aplicar interpolación solo cuando tenga sentido y declarar la incertidumbre de la muestra; respetar también las métricas donde bajar es mejorar.
- **Aceptación:** el margen del 12 % no cumple una referencia del 20 % por estar a principios de mes. Probar margen, AOV, ROAS, CAC, cantidades y stock con denominadores válidos, cero real y muestra insuficiente. La referencia temporal debe seguir siendo explicativa, sin presentarse como previsión.

### A19-005 · Exigir cobertura histórica, monetaria y de sincronización antes de fijar progreso

- **Evidencia y caso:** la cobertura monetaria se consulta en el runner, pero los builders A19 no la pasan al cálculo determinista; este comprueba frescura de la conexión y algunos campos de coste, no comparabilidad monetaria (`ai-runtime.ts:6269`, `:9940`, `camino-goal-progress.ts:149`). `caminoSeasonality` trata meses ausentes dentro del intervalo como cero y los considera completos por su fecha: julio=900, agosto ausente y septiembre=900 producen una media de 600 sin prueba de cobertura. Sus notas también añaden `€` sin recibir moneda. Una sincronización reciente de otro dominio no demuestra importación completa de pedidos o publicidad.
- **Mejora:** pasar al cálculo cobertura de pedidos/costes/inversión, moneda verificada y periodos históricos completos. Conservar los huecos como desconocidos y distinguir disponibilidad de datos de disponibilidad de conexión. Bloquear solo las conclusiones monetarias no evaluables y mantener señales no monetarias útiles.
- **Aceptación:** importación parcial, moneda desconocida/distinta, costes incompletos o error posterior al último sync no producen objetivo logrado ni baseline ficticio. Un mes realmente sin ventas conserva su cero cuando la cobertura esté probada; una tienda en otra divisa no recibe notas en euros por defecto.

### A19-006 · Mantener las fechas de calendario al aceptar y activar tarde

- **Evidencia y caso:** la estrategia se calcula con la fecha de generación, pero todos los offsets se anclan de nuevo al aceptar (`strategic-plans.ts:3315`), y `starts_on` se fija al activar (`:935`). La reproducción del calendario real del código da Black Friday el 27/11/2026; aceptar el 01/11 una propuesta generada el 20/10 desplaza ese hito al **09/12**. El normalizador también puede mover un evento del día 20 al 81 para imponer fases consecutivas (`packages/ai/src/index.ts:958`).
- **Mejora:** tipar fechas absolutas comerciales y plazos relativos operativos, conservar la referencia original y revalidar el plan al aceptarlo/activarlo tarde. Ante un plazo imposible, proponer un ajuste visible; no desplazar silenciosamente un evento para ordenar fases. Preservar checkpoints y periodos parciales.
- **Aceptación:** generación, aceptación y activación en días/meses distintos mantienen las fechas comerciales. Verificar fases de preparación que se solapan, plazos vencidos y cambio de horizonte; cualquier replanificación de compromisos exige revisión humana y conserva el antecedente.

### A19-007 · Replanificar de forma atómica conservando los compromisos abiertos

- **Evidencia y caso:** al aceptar con `replacePlanId`, se archiva el plan anterior antes de crear el nuevo y se intenta restaurar su estado si falla (`strategic-plans.ts:3560`). Aunque `create_strategic_plan_tree` crea el árbol en una transacción, el reemplazo completo queda fuera de ella. Una caída entre ambas operaciones deja la tienda sin Camino vigente. Archivar solo cambia el estado del plan (`:1101`); sus tareas abiertas permanecen y el nuevo árbol puede crear de nuevo el mismo trabajo.
- **Mejora:** realizar reemplazo, publicación/aprobación y transferencia explícita de trabajo en una transacción por tienda y revisión esperada. Presentar qué tareas se reutilizan, mantienen, sustituyen o retiran, preservando enlaces de A18/A17/A04, campañas e historial.
- **Aceptación:** error o reinicio en cualquier paso conserva un plan válido; dos aceptaciones simultáneas no dejan dos rutas ni restauran un estado obsoleto. El backlog no se duplica y una tarea completada no se reabre. Reintentar la misma intención devuelve el resultado ya creado.

### A19-008 · Activar plan, fases e hitos en una única transición recuperable

- **Evidencia y caso:** `activateStrategicPlan` cambia primero el plan a activo y luego carga/actualiza fases e hitos con varias escrituras (`strategic-plans.ts:916`). Un error al cargar fases deja el plan activo; los errores de las actualizaciones del bucle no se comprueban. La respuesta puede indicar éxito con la primera fase sin activar o con bloqueos incoherentes.
- **Mejora:** reutilizar el patrón transaccional ya empleado para crear el árbol, incluyendo estado esperado, actor, fechas y recibo de activación. Acordar qué ocurre con vencimientos fijados antes de la activación y verificar la visibilidad del trabajo mientras el plan siga en borrador.
- **Aceptación:** fallos inyectados en plan, fase o hito no dejan una activación parcial. Doble clic y respuesta perdida son idempotentes; una activación tardía muestra los plazos que necesitan revisión. La UI solo presenta el Camino en marcha cuando la transición completa está confirmada.

### A19-009 · Versionar la propuesta final entre estrategia, detallado, juicio y aprobación

- **Evidencia y caso:** el runner guarda y evalúa la propuesta antes del detallador (`ai-runtime.ts:6488`). Este modifica después el mismo `agent_outputs.output` por ID, sin exigir estado pendiente ni revisión esperada (`:9462`). Otro usuario puede convertir/rechazar la propuesta durante el detalle y recibir una versión distinta a la juzgada o aceptada. El endpoint de conversión solo veta `published`, no `rejected`; el RPC inspeccionado tampoco condiciona la publicación al estado pendiente.
- **Mejora:** conservar estrategia y detalle como versiones/etapas identificables, publicar un artefacto final estable y aprobar exactamente su checksum/revisión. Validar el estado en la transacción de conversión y ejecutar o vincular el juicio al contenido final. Una corrección tardía debe crear otra versión revisable.
- **Aceptación:** aprobación o rechazo simultáneo con el detallado no cambia el contenido de una salida publicada/rechazada. El plan, el juicio y la aprobación apuntan al mismo artefacto. Un POST directo no convierte una salida rechazada ni una propuesta todavía incompleta.

### A19-010 · Hacer durable e idempotente la generación completa

- **Evidencia y caso:** `startCaminoProposalRun` lanza una promesa en el proceso y usa un `Map` por organización/tienda (`ai-runtime.ts:10465`, `camino-run-tracker.ts:24`). La ruta síncrona no comparte esa guarda. A19 tampoco entra en la reserva manual atómica usada por otros agentes: cuenta runs antes de crearlos. Dos peticiones simultáneas pueden pagar el mismo trabajo; un reinicio durante el detalle obliga a recuperar manualmente o repetir etapas. El GET de progreso decide que un run murió comparándolo con el inicio de su proceso (`ai-runtime.ts:10560`).
- **Mejora:** dar una identidad durable a la intención y a cada etapa/hito, compartida por ambos endpoints. Reutilizar BullMQ/DB para reclamar, informar progreso, recuperar parciales y reanudar con lease y heartbeat; reservar el cupo de forma atómica por alcance.
- **Aceptación:** doble petición síncrona/asíncrona, cambio de pestaña, timeout, reinicio y segunda instancia recuperan el mismo trabajo. No volver a facturar hitos ya terminados ni marcar fallida desde un GET una ejecución que otro proceso mantiene viva. Conservar el motivo de los fallos tempranos.

### A19-011 · Controlar y registrar el coste de estrategia y detallado como un solo trabajo

- **Evidencia y caso:** la reserva diaria del arquitecto se liquida antes de entrar en el detallador (`ai-runtime.ts:6558`, `:9166`). El detallador abre su propio run y varias llamadas por hitos/eventos, con hasta tres hitos en paralelo, sin reserva diaria conjunta ni política presupuestaria transmitida por el arquitecto. Sus acumuladores convierten consumo/coste desconocido a cero (`:9271`). El prompt del detalle se elige aparte por orden textual de versión y sus herramientas están en código, sin versión propia.
- **Mejora:** congelar y registrar política, prompts, schemas, modelo/proveedor y herramientas de todas las etapas; reservar y liquidar el coste total por lotes recuperables. Mantener desconocido como `null`, contabilizar fallos/fallbacks y detener gasto nuevo si no se verifica una restricción de plataforma. A19 debe reutilizar los controles compartidos sin recortar arbitrariamente la estrategia o el número de tareas para ocultar coste.
- **Aceptación:** un Camino con muchos hitos respeta el presupuesto global y conserva un estado parcial comprensible. Probar fallo de política, proveedor, tarifa desconocida y reinicio entre hitos; el recibo total coincide con el consumo observado y no declara ahorro no medido.

### A19-012 · Vincular cada revisión al plan y a la revisión exacta que observó

- **Evidencia y caso:** el revisor lee el plan antes del turno y no lo revalida al finalizar (`ai-runtime.ts:9560`, `:10144`). Cambiar una meta no incrementa su versión (`strategic-plans.ts:2672`). La revisión anterior se busca como último run A19 de la tienda, no mediante el mismo `plan_id` (`ai-runtime.ts:9803`). El schema permite una versión positiva y `target_id` libre; una reproducción acepta versión 999, periodo de 2099 y un hito ajeno, y el wrapper no contrasta esos campos con la captura del servidor.
- **Mejora:** capturar ID, revisión/hash, meta, árbol y periodos autoritativos; validar las referencias de cambios contra ese mismo plan. Rellenar identidad/fechas desde el servidor y cargar continuidad por `plan_id`. Marcar como histórica u obsoleta una revisión cuyo plan cambió durante el turno.
- **Aceptación:** cambio de meta, retirada de hito, archivo o reemplazo durante una revisión no publica una conclusión antigua como salud actual. La UI compara cifras con el objetivo observado entonces y declara cualquier diferencia con el vigente. Una referencia ajena no se vuelve propuesta aprobable.

### A19-013 · Finalizar la revisión y sus propuestas de forma atómica

- **Evidencia y caso:** el claim tiene caducidad de 30 minutos y recuperación, pero no token de intento ni heartbeat. La salida, su progreso determinista, las propuestas y el estado final se guardan por separado (`ai-runtime.ts:9607`, `:10144`). Si se insertan propuestas y falla el cierre, el reintento genera otra salida y reutiliza `(weekly_review_id, proposal_index)` con `ignoreDuplicates:true`: puede conservar propuestas de la salida anterior junto al resultado nuevo. Un intento antiguo tampoco queda impedido de finalizar después de ser recuperado.
- **Mejora:** finalizar en una transacción condicionada al intento vigente, con propuestas referidas a la salida y revisión exactas. Recuperar una salida completa ya persistida antes de repetir el modelo; conservar intentos anteriores como historial separado.
- **Aceptación:** inyectar fallos después de guardar salida, progreso, propuestas y cierre. Un reintento mantiene coherencia entre resumen y cambios, no duplica gasto innecesario ni permite sobrescrituras de un lease vencido; los avisos se emiten una sola vez tras confirmar persistencia.

### A19-014 · Resolver decisiones concurrentes y enlazar su aplicación real

- **Evidencia y caso:** `recordCaminoChangeProposalAction` compara `expected_last_event_id` después de una lectura y luego inserta el evento sin condición transaccional (`strategic-plans.ts:454`). Dos peticiones que leen el mismo antecedente pueden registrar aceptar y rechazar simultáneamente; en las dos DB no hay trigger de transición en esa tabla. La UI distingue correctamente «aceptada · falta aplicarla», pero marcar aplicada solo exige un motivo; no conserva una mutación concreta que pruebe qué cambió.
- **Mejora:** validar antecedente y transición bajo bloqueo/CAS en DB, con identidad idempotente de petición. Ofrecer aplicación revisable mediante los servicios existentes para cambios soportados, o enlazar la edición manual exacta antes de marcarlos aplicados; guardar estado anterior/posterior y actor.
- **Aceptación:** dos decisiones incompatibles producen un único resultado válido y un conflicto recuperable. Un evento completado tiene evidencia del cambio de meta/fase/hito correspondiente. La aceptación humana sigue siendo obligatoria y el modelo no recibe escritura libre sobre el árbol.

### A19-015 · Procesar cambios de objetivos sin pérdida ni contaminación entre planes

- **Evidencia y caso:** el revisor consulta los primeros 60 cambios de los últimos 30 días en orden ascendente y luego filtra por tienda/última revisión (`ai-runtime.ts:9680`); con más de 60 puede dejar fuera precisamente los recientes. Los objetivos vigentes también se limitan antes de filtrar scope. No se selecciona `plan_id` en el bloque de cambios. La espera de dos minutos vive en memoria y el cupo de tres revisiones se cuenta antes de generarlas; un error de conteo equivale a cero (`:10232`, `camino-objective-changes.ts:190`).
- **Mejora:** registrar objetivo y evento de forma coherente y despachar un trabajo durable que agrupe cambios por plan/tienda. Filtrar alcance y cursor de cambios antes del límite, distinguir objetivo organizativo de meta de otro plan y reservar el cupo bajo concurrencia. No usar el momento de lectura como prueba de procesamiento.
- **Aceptación:** más de 60 cambios, varias tiendas, reinicio durante la espera y fallos de DB no pierden el último objetivo ni multiplican revisiones. El evento conserva periodo, fechas de vigencia y motivo; una meta de otro plan no se aplica como objetivo global por falta de identidad.

### A19-016 · Seleccionar contexto completo útil y dar recibo de lo realmente enviado

- **Evidencia y caso:** los snapshots recientes A19 v17 de test alcanzan **118.570 caracteres y 64 bloques**, con `context_truncated=true`. Metodología ocupa 29.191 caracteres y F9 32.757 en la muestra, frente a límites predeterminados de 12.000 por bloque y 48.000 totales (`untrusted-context.ts:2`). Los avisos monetarios se añaden tarde y el snapshot conserva los bloques originales. A04/A17/A18 comparten un LIMIT 30 que puede ocultar al menos frecuente. La ficha usa etiquetas textuales: busca «FECHAS CLAVE OBLIGATORIAS» cuando el builder entrega «CANDIDATAS»; `{availability:'query_error'}` se reproduce como estado `ok`.
- **Mejora:** priorizar meta/árbol, cobertura y errores, compromisos materializados y evidencia por unidades estructuradas. Leer los horizontes por identidad y vigencia, usar resúmenes acotados y ampliar evidencia puntual solo cuando haga falta. Registrar IDs estables de bloques, fuentes, recortes y huellas efectivas; corregir la clasificación de errores y evitar lecturas cuyo resultado se descartará.
- **Aceptación:** un plan grande mantiene dirección y límites críticos sin cortar JSON por la mitad. La ficha refleja qué vio el modelo y qué faltó. Medir consultas, bytes, tokens y latencia con el mismo caso; conservar las fronteras de datos no confiables y no atribuir ahorro por estimación.

### A19-017 · Guardar conocimiento estacional y aprendizajes con procedencia verificable

- **Evidencia y caso:** `saveCaminoSeasonalKnowledge` acepta cualquier URL `http(s)` de `output.sources` como fuente investigada y guarda el informe automáticamente antes de la aprobación del Camino (`camino-intake.ts:127`, `ai-runtime.ts:6531`). El arquitecto OpenAI recibe una instrucción explícita de que no tiene búsqueda web conectada (`ai-runtime.ts:1310`). Una URL citada no demuestra una consulta real; un borrador rechazado puede alimentar futuras estrategias. Los aprendizajes aprobados tienen `source_key`, pero se añaden a un documento mediante leer/modificar/escribir, lo que puede perder una aprobación simultánea (`camino-intake.ts:415`).
- **Mejora:** diferenciar investigación recuperada, inferencia y propuesta; exigir recibo/fuente consultada para declarar investigación actual. Guardar candidatos por run y promocionarlos tras la revisión humana adecuada, con vigencia y estado de la propuesta original. Persistir aprobaciones de aprendizaje de manera atómica por referencia única, evitando acumulación de afirmaciones circulares.
- **Aceptación:** una URL inventada o una salida rechazada no se convierten en conocimiento validado. Dos aprendizajes aprobados a la vez se conservan; reintentar uno no lo duplica. La reutilización conserva fecha, tienda, fuente, confianza y evidencia, sin convertir aceptación humana en causalidad probada.

### A19-018 · Respetar mercado, capacidad y exclusiones al preparar eventos

- **Evidencia y caso:** `buildCaminoCalendarPack` admite configuración real de mercados, pero el arquitecto y el detallador lo llaman sin activarla (`ai-runtime.ts:8947`, `:9299`, `:10372`). El calendario puede volver a inferir España desde la descripción. `uncoveredEvents` exige cobertura por nombre/fecha para eventos clave; no recibe una decisión de aplicabilidad. La reproducción sigue marcando Black Friday como ausente aunque el diagnóstico haya explicado que no se participará por margen insuficiente, y el detallador intenta añadir su preparación.
- **Mejora:** compartir el perfil de mercados/vertical configurado y una decisión estructurada de participar, excluir o pendiente de evidencia por evento. El detallador debe completar solo eventos aprobados como pertinentes, respetando presupuesto, capacidad y campañas confirmadas de A05/A27.
- **Aceptación:** un evento excluido con razón no reaparece por una regla de cobertura. Probar tienda fuera de España, varios mercados, sector sin promoción y capacidad limitada; falta de configuración permanece desconocida. Los eventos relevantes conservan preparación inversa y fechas de entrega verificables.

### A19-019 · Preservar la identidad y las dependencias de cada compromiso al detallar

- **Evidencia y caso:** `keepsDraftCommitments` compara cantidades de tareas de temporada, crecimiento y rutinas (`camino-task-detailer.ts:71`). La reproducción sustituye «Preparar oferta Black Friday» por «Cambiar tipografía» con la misma etiqueta y pasa. `mergeDetailedTasks` reemplaza la lista completa; no hay identidad tipada que demuestre que se conservó el entregable. El orden de tareas expresa dependencias en texto, sin validarlas.
- **Mejora:** dar identidad estable a los compromisos y exigir que cada detalle declare qué tarea desarrolla, fusiona o sustituye. Validar entregable, rol, fecha, criterio, esfuerzo y dependencias reales; una divergencia debe conservar el borrador o convertirse en una propuesta explícita. Reutilizar tareas existentes del Camino y del resto de horizontes cuando sean el mismo trabajo.
- **Aceptación:** no se pierde una obligación por igualar un contador. Probar sustitución ajena, duplicados, fusiones legítimas, ciclos y prerequisitos posteriores a su tarea dependiente. Mantener amplitud estratégica sin crear trabajo duplicado ni ocultar fallos del detallador.

### A19-020 · Mantener visible y accionable el seguimiento pendiente completo

- **Evidencia y caso:** el GET devuelve ocho revisiones; el contador de cambios pendientes solo toma la última con output, y la mesa muestra hasta cuatro (`strategic-plans.ts:351`, `page.tsx:2606`, `:2943`). Una propuesta todavía pendiente desaparece de ese seguimiento al acumular revisiones. El mapa mezcla la meta actual con cifras de la revisión sin comprobar su antigüedad o revisión de objetivo (`camino-map.tsx:439`). Los cambios aceptados requieren buscar manualmente el editor; no hay vínculo de aplicación verificable.
- **Mejora:** separar estado actual del plan, revisión vigente, historial paginado y bandeja durable de decisiones abiertas de todas las revisiones. Mostrar fecha/ventana, causa del disparo, fallo/último intento y qué objetivo se midió; llevar cada cambio al elemento afectado y explicar qué falta para aplicarlo. Mantener diferenciados avance de tareas, avance económico e incertidumbre.
- **Aceptación:** pendientes de hace más de ocho ciclos siguen accesibles y contados. Una revisión antigua no aparenta medir una meta recién cambiada. Recorrer crear → detallar → revisar → aceptar → activar → seguimiento → cambio aprobado/aplicado → A18/A17/A04 → cierre/medición con dos tiendas y roles, incluyendo fallos, reintentos y datos insuficientes; medir aceptación/corrección, duplicados, entregas y coste por resultado útil.

### Verificación y límites de esta auditoría A19

- **Código:** descubrimiento y trazas con el grafo MCP; contraste con fuentes actuales porque el índice contiene rangos anteriores. Se siguieron arquitecto, detallador, revisor, cuotas/presupuestos, cron/worker, contexto/RAG, contratos, conversión/reemplazo/activación, decisiones, objetivos/aprendizaje y consumidores web. No se auditó todo el repositorio ni se certificó la revisión desplegada; móvil y un recorrido autenticado de navegador quedan fuera de esta pasada.
- **Configuración remota, solo lectura:** ambas bases tienen arquitecto **v17**, prompt v17 de **15.608 caracteres**, aprobación previa y nueve herramientas de lectura (`data_coverage`, `describe_schema`, `sql_select`, `search_knowledge`, perfil, ajustes financieros, plan, alertas y tareas). El revisor está en **v5**, prompt de **7.295 caracteres**, sin tools y con publicación de observaciones sin aprobación; sus cambios requieren decisión humana. SHA-256 correctos: arquitecto `06aeba8a7ff42eabc1d4b23d58253f2a1b3fe80ad59996d04cf9cf60a3df9964`, revisor `8c53c0a1bebc3622eef4b7c0dfea71d93c453d1eea4d77844e0415159ba3b780`. Modelo declarado del arquitecto `gpt-6-sol`, del revisor `claude-opus-4-8`; el routing y los overrides pueden modificar el modelo efectivo. Detallador: prompts hasta v7; no tiene definición de agente independiente. No hay ajuste de plataforma A19 en la muestra.
- **Muestra:** test tiene 32 runs del arquitecto (21 `succeeded`, 8 `failed`, 2 `rejected_output`, 1 `timeout`) y 17 salidas; algunos runs sin salida son etapas del detallador y no se cuentan como planes entregados. De v17 hay 14 runs y tres outputs. Hay dos runs del revisor v4 (uno fallido y uno exitoso), una revisión persistida y dos planes activos por tienda. Producción tiene un run fallido del arquitecto v1, un plan completado sin tienda y ninguna revisión. En ambas DB hay cero propuestas de cambio y cero eventos de decisión. No se atribuyen esos resultados históricos al código actual ni se infiere utilidad por un estado `succeeded`.
- **Permisos:** RLS y SELECT `authenticated` comprobados para las siete tablas propias inspeccionadas; políticas organizativas equivalentes en los dos entornos. Se revisó también el helper restrictivo A17 del enlace hito-tarea y la función transaccional `create_strategic_plan_tree`. No se ejecutó explotación, suplantación ni prueba de carrera real en Postgres.
- **Pruebas:** **70/70** existentes aprobadas: 43 de API (13 suites de progreso, calendario, decisiones, tracker, detalle, contexto, objetivos, escalado, estacionalidad, propuesta, ajuste y moneda), nueve de contratos/calendario de `@e-nora/ai` y 18 de helpers web de ruta mensual, comparación, readiness, carga y siguiente paso. Son pruebas focalizadas; no equivalen a E2E y no cubren los fallos de integración reproducidos.
- **Reproducciones adicionales:** script temporal fuera del repositorio invocando helpers reales, sin red de negocio ni modelo: doble normalización 10.000 → 1.691,11; Meta 3/7; margen 12 % frente a 20 % marcado en curso; fecha comercial 27/11 → 09/12 al aceptar tarde; normalizador día 20 → 81; mes ausente convertido en cero; evento excluido que vuelve como obligatorio; cambio de tarea ajeno admitido por contadores; error de fuente clasificado como `ok`; etiqueta de fuente no reconocida; contrato de revisión que admite identidad/periodo ajenos. Son casos sintéticos, no cambios ni incidentes confirmados sobre datos de clientes.
- **Fuentes y alcance:** contrastadas las reglas de RLS/grants y bypass de service_role con la [documentación oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y consultado el [changelog](https://supabase.com/changelog). Los avisos recientes de proveedor no explican estos fallos de lógica. No hubo generación pagada, escritura de datos de negocio, aprobación real, migración, envío ni despliegue. Cada mejora requiere una regresión que falle con el caso anterior y validación del flujo completo antes de considerarse cerrada.

## A20 · Retención de clientes: auditoría de valor, datos y ejecución

**Auditoría: 20 de octubre de 2026. Estado: 20 mejoras A20-001 a A20-020 registradas; esta pasada no las implementa.** Se inspeccionó el directorio principal sobre `04c26ec`, con sus modificaciones locales, y se contrastó la configuración de test y producción mediante consultas de solo lectura. Los cambios A17/A18/A19 del worktree `codex/a17-full-improvements` son dependencias de integración; no se consideran desplegados. Se conserva la documentación previa: `REVISION_AGENTES.md` daba A20 por cerrado localmente, mientras `AUDITORIA_JUEZ_AGENTES.md` ya advertía del allowlist incompleto. Esta auditoría confirma que ese bloqueo sigue presente y añade revisión de métricas, acciones y utilidad.

**Resultado:** la estructura existe, pero no hay evidencia suficiente para dar A20 por operativo y valioso en producción. Debe convertirse en un detector de oportunidades de recompra rentable: explicar qué grupo necesita atención, cuántas personas son elegibles cuando se conozca, qué comportamiento se observó, qué intervención conviene probar, quién la ejecuta y cómo se medirá. Una tasa de pedidos de compradores recurrentes no equivale a la probabilidad de que un cliente vuelva; más mensajes o ingresos atribuidos tampoco acreditan una mejora de retención.

**Activación comprobada:** GET `/ai/retencion-clientes` consulta la caché y POST `/ai/retencion-clientes-run` permite regenerar. El worker entra por `runDiagnosticOrchestratorTickInner`; la antigüedad mínima general es 20 horas, y el orquestador contempla un agregado organizativo más ejecuciones por tienda. El calendario humano dice «1 al día para el cliente + 1 por tienda», pero la sección web genérica habla de dos veces al día. En Shopify la sección A20 está dentro de un desplegable visible para consultores. La salida propone tareas sujetas a aprobación; no envía campañas ni configura flows por sí misma.

### A20-001 · Corregir la puesta en servicio y la divergencia entre migración y versión efectiva

- **Evidencia:** test tiene v3 activa con solo `search_knowledge` y `shopify_product_repurchase_health`; faltan `shopify_customer_health` y `klaviyo_measurement_health`. Producción conserva v1/v2/v3 inactivas. El v3 remoto tiene 5.250 caracteres y hereda reglas antiguas: ejemplo de segunda compra a 21 días, afirmación genérica sobre coste de captar y `rationale` de 22 palabras. La migración local v2 contiene otro contrato, pero utiliza `ON CONFLICT DO NOTHING`; v3 concatena el v2 persistido. Un checksum correcto del texto antiguo no verifica que sea el texto deseado.
- **Mejora:** publicar una versión nueva, completa e inmutable con prompt, schema, tools y configuración coherentes. Comprobar las dependencias efectivas del runner antes de habilitar A20 en cada entorno; actualizar el estado documental según la versión servida, no según el archivo SQL.
- **Aceptación:** manifiesto de versión/hash/build verificable, principal tool autorizada y ejecutable, CRM condicional disponible, y prueba de abstención/datos positivos antes de activar producción. No reescribir prompts históricos vinculados a runs.

### A20-002 · Exigir evidencia principal en ejecución, no solo mediante instrucciones

- **Evidencia:** `runRetencionClientesAgent` pide consultar la herramienta principal, pero `runGenericDiagnosticAgent` persiste el resultado sin comprobar ese recibo. Los tres runs exitosos observados en test tienen output y cero llamadas a `shopify_customer_health`; dos son v3. El allowlist solo añade `propose_capability` automáticamente, así que registrar el executor no habilita la herramienta ausente.
- **Mejora:** precargar un snapshot cuantitativo validado o exigir una llamada principal exitosa y su recibo. Ante herramienta ausente, fallo o evidencia insuficiente, devolver un estado específico y evitar conclusiones/tareas de negocio no sustentadas.
- **Aceptación:** fixtures con tool omitida, denegada, fallida y vacía no producen un veredicto normal; datos parciales permiten únicamente las conclusiones respaldadas por las fuentes válidas. Que el run tenga estado `succeeded` no basta para certificar utilidad.

### A20-003 · Unificar autorización por tienda en API, RPC y materialización

- **Evidencia:** runner, caché y aprobación usan `requireMembership`, que delega en `requireOperationalOrganization` y rechaza miembros limitados a tienda. En test las políticas SELECT de pedidos, líneas y productos se basan en `accessible_org_ids()`, cuyo código no comprueba `access_scope/store_ids`. Las RPC agregadas son invoker y aceptan `target_store_id`; esa combinación no demuestra aislamiento entre tiendas para el acceso directo. Los guards de `agent_runs/agent_outputs` sí añaden alcance de tienda.
- **Mejora:** resolver la tienda antes de autorizar, comprobar membresía exacta en lectura/generación/aprobación y proteger también las fuentes que consumen las RPC. Acotar el agregado a roles con acceso organizativo y retirar EXECUTE anónimo cuando no tenga una función de producto.
- **Aceptación:** JWT de tienda A no puede consultar B ni el agregado por REST/RPC, ni aprobar sus propuestas; consultor asignado y administrador conservan su acceso previsto. Se revisaron políticas y definición, sin ejecutar una explotación con identidades reales.

### A20-004 · Medir frescura e integridad del historial de clientes

- **Evidencia:** `shopify_customer_health` consulta cinco RPC sin la barrera de sincronización que sí aplica la herramienta de producto. La provenance común informa hora de consulta y `freshness_seconds: null`; estar conectado no acredita backfill completo, continuidad del histórico, cobertura de identidad o enlace de líneas. La primera compra disponible puede ser solamente la primera sincronizada.
- **Mejora:** adjuntar cobertura por métrica: conexión, última sincronización correcta, error posterior, importación pendiente, intervalos disponibles, pedidos identificados/clasificados, invitados y datos enlazados. Mantener separados «consulta correcta», «datos recientes» e «historial suficiente».
- **Aceptación:** un backfill parcial o una sincronización reciente con huecos impide presentar una caída como definitiva; errores y ceros conocidos conservan estados distintos. No recomendar resincronizar indefinidamente cuando el origen no proporciona identidad histórica.

### A20-005 · Calcular segunda compra y cohortes comparables con definiciones explícitas

- **Evidencia:** `shopify_customer_recurrence` calcula proporción de pedidos recurrentes entre pedidos clasificados; `shopify_cohorts` devuelve clientes que compran en cada mes calendario, incluido el mes inicial. No devuelve clientes únicos que hayan realizado segunda compra acumulada a 30/60/90 días. El gate cuenta cohortes maduras y tamaño, pero permite `comparison_ready=true` con dos cohortes que solo tienen offset 0. La reproducción con cohortes de marzo/abril lo confirma para edades 1 y 3.
- **Mejora:** calcular determinísticamente primera→segunda compra, tercera compra y recompra acumulada a edades iguales, con numerador, denominador, seguimiento completo y definición. Separar esa medición de frecuencia de pedidos, retención por mes calendario y composición de ventas.
- **Aceptación:** no se suman repetidores de offsets distintos como si fueran personas distintas; una fila de primera compra no habilita una comparación de retención. Ventana incompleta o ausencia de cobertura permanece desconocida. Usar intervalos de incertidumbre cuando la muestra lo permita; no presentar el mínimo de 30 como garantía estadística.

### A20-006 · Normalizar resultados de RPC sin perder filas ni ocultar fallos parciales

- **Evidencia:** `combineMetricRpcs` convierte un array de una fila en objeto; el gate de cohortes solo procesa arrays. Una cohorte válida de 100 clientes enviada como objeto desaparece de `cohorts`. El combinador sustituye fallos por `no_disponible` y anula el error global si cualquier otra parte parece útil; el consumidor necesita conocer el estado de cada métrica, no un éxito agregado ambiguo.
- **Mejora:** contratos explícitos y estables por fuente, sin aplanado por cardinalidad; conservar arrays de cohortes/LTV, códigos de error, cobertura y validación de números/fechas. Congelar un único `as_of` y sus ventanas para runner, tools y snapshots; cohortes/valor histórico no deben incluir datos posteriores a ese corte.
- **Aceptación:** cero/una/muchas filas, fallo parcial/total y tipos inválidos tienen resultados definidos. Un replay del mismo corte temporal reproduce los mismos hechos, sin depender de `now()` dentro de cada RPC.

### A20-007 · Proteger contribución, CAC, LTV y payback antes de priorizar dinero

- **Evidencia:** la RPC remota `shopify_customer_lifetime` usa gastos de pago/envío cero si no hay ajustes, coste actual como respaldo histórico y CAC cuando `ads_spend_summary.days_with_data>0`. No demuestra cobertura completa del gasto ni que todo sea adquisición. Cada hito usa una cohorte de entrada diferente. `parseLifetimeRows` elimina fechas de cohorte y gasto observado; un fixture con CAC 1 y sin prueba de cobertura/ajustes puede producir `PAID_BACK` a 30 días.
- **Mejora:** gates financieros por tienda/moneda y fecha, cobertura del gasto, costes y net revenue, estimaciones etiquetadas y cohortes idénticas cuando se presente una curva. Diferenciar valor histórico observado, contribución y proyección; abstenerse del payback si faltan requisitos.
- **Aceptación:** un solo día de anuncios en una ventana larga no acredita CAC comparable; costes desconocidos no son cero; no sumar monedas ni comparar puntos de cohortes distintas como trayectoria de los mismos clientes. Márgenes observados con devolución posterior explicitan su fecha de corte.

### A20-008 · Ajustar la elegibilidad de recompra de producto a cohortes realmente observables

- **Evidencia:** `shopify_product_repurchase_summary` exige 455 días desde el pedido identificado más antiguo para devolver productos, aunque la cohorte seleccionada entra entre 365 y 90 días antes del corte. En la tienda activa de test devuelve `insufficient_observed_history` con 381 días. Una venta aislada antigua tampoco demuestra continuidad suficiente. Los intervalos solo usan quienes repitieron dentro de 90 días.
- **Mejora:** definir inicio de importación fiable y seguimiento individual completo; admitir cohortes recientes maduras cuando sean válidas, sin exigir 15 meses a todas las tiendas. Exponer censura, muestra de repetidores, historial limitado y tasas de enlace de productos/devoluciones.
- **Aceptación:** tienda con 120–180 días completos puede obtener señales descriptivas elegibles si tiene seguimiento y muestra; un pedido de hace dos años con meses ausentes no acredita cobertura. Mediana entre repetidores no se interpreta como día óptimo para contactar a todos.

### A20-009 · Identificar productos, categorías y venta cruzada que puedan trabajarse

- **Evidencia:** el SQL agrupa por `product_id`, pero su proyección devuelve título/tipo y omite el ID seguro del producto. Solo analiza recompra del mismo producto y devuelve los 12 grupos con más repetidores; no cubre compras complementarias ni distingue títulos duplicados. Por ello una buena recomendación puede no tener destino inequívoco o ignorar oportunidades de categorías relacionadas.
- **Mejora:** devolver identificadores de producto/categoría con scope, disponibilidad y contexto de margen cuando se conozca; añadir análisis agregado de siguiente producto/categoría y composición de cesta únicamente cuando sustente una decisión. Separar consumibles, recambios, complemento y compra duradera usando evidencia del catálogo.
- **Aceptación:** títulos iguales no mezclan productos; una compra única puede conducir a un complemento relevante, sin inventar una necesidad recurrente. Toda asociación lleva muestra/base y se plantea como hipótesis comercial, no causalidad.

### A20-010 · Distinguir inactividad de pérdida según ciclo de compra

- **Evidencia:** `shopify_customer_churn` define técnicamente 180 días sin comprar, con una base entre 545 y 180 días anteriores. El prompt local advierte del ciclo, pero la herramienta principal no aporta una distribución por categoría/segmento ni cobertura suficiente para adaptar esa señal; el v3 remoto conserva un enfoque antiguo de «retiene o solo capta».
- **Mejora:** separar cliente activo, candidato a segunda compra, inactivo y posible recuperación según historia/ciclo observado; gestionar compras estacionales, regalos y productos duraderos. No etiquetar «perdido» como hecho irreversible. Suscripciones solo se analizan si se dispone de su fuente autorizada.
- **Aceptación:** una tienda de compra anual no dispara un win-back masivo a 180 días; la estacionalidad y el historial insuficiente cambian la confianza y la intervención. No inferir cancelaciones de suscripción desde ausencia de pedidos.

### A20-011 · Crear un contrato de oportunidad con prioridad económica defendible

- **Evidencia:** A20 usa el output genérico de hallazgos y tareas; no exige segmento reproducible, volumen elegible, comportamiento objetivo, métrica, coste/esfuerzo, restricción de margen o horizonte de seguimiento. El texto puede justificar una tarea sin permitir decidir si merece la pena ejecutarla.
- **Mejora:** por oportunidad, conservar definición agregada del segmento, evidencia/cobertura, comportamiento que se busca, intervención propuesta, responsable, esfuerzo, medición y motivo de prioridad. Cubrir segunda compra, recuperación, VIP, reposición y venta cruzada cuando los datos lo respalden. Estimar rangos de impacto solo con supuestos visibles y datos suficientes; permitir impacto desconocido.
- **Aceptación:** el usuario puede comparar oportunidades por alcance, confianza, esfuerzo y contribución potencial sin cifras inventadas. La salida puede abstenerse o proponer una sola acción; cuatro tareas no deben convertirse en un objetivo de producción.

### A20-012 · Coordinar las oportunidades con Mi Camino y los horizontes de ejecución

- **Evidencia:** `loadPlanPhasesBlock` ya carga plan activo aprobado, meta y objetivos por tienda: A20 sí tiene relación con Mi Camino. Sin embargo, su callback específico solo añade esa lectura y tareas abiertas; no carga progreso determinista ni compromisos A18/A17/A04. El contexto genérico de playbooks se llama sin `{storeId}` para A20. El fallback de materialización aún permite asociar A20 al hito actual sin una relación estratégica explícita.
- **Mejora:** transmitir plan/version/revisión, meta vigente, progreso y compromisos recientes de los otros horizontes con scope/frescura. Explicar cómo cada oportunidad ayuda al objetivo, qué trade-off tiene y qué entregable mensual/semanal/diario corresponde; marcar mantenimiento cuando no haya alineación aprobada.
- **Aceptación:** una tienda orientada a margen no recibe descuentos generales por subir recompra. Cambio de meta revalida propuestas pendientes; no se enlaza por defecto una tarea al hito actual ni se utiliza un playbook agregado como hecho de esa tienda.

### A20-013 · Entregar a marketing un brief preciso y contrastar lo ya activo

- **Evidencia:** el prompt local prevé `klaviyo_measurement_health` condicional y delimita A12/A28, pero esa tool falta en el v3 remoto. La coordinación depende de texto libre y del backlog acotado. No se encontró en el runner A20 un handoff tipado de oportunidad→segmento→flow con evidencia y destino, ni inventario CRM específico precargado.
- **Mejora:** comprobar inventario/estado/frescura de flows, rendimiento relevante de A12 y diseños A28 del mismo scope antes de recomendar; entregar un brief con objetivo, segmento, exclusiones, métrica, dependencia y decisión humana. A28 diseña el flow, A27 puede planificar una campaña puntual y A11 producir contenido según el flujo vigente del producto. Validar alcance contactable y consentimiento en el sistema de ejecución, sin PII en el diagnóstico.
- **Aceptación:** flow existente pero pausado produce una recomendación de revisión, no otro flow idéntico. Fuente sin sincronizar no significa inexistencia; una intervención no envía nada ni crea segmentos externos sin el paso autorizado correspondiente.

### A20-014 · Deduplicar por oportunidad y materializar tarea/enlace de forma atómica

- **Evidencia:** el backlog de contexto aporta hasta 100 títulos y carece de IDs; no basta para detectar equivalencia semántica o trabajo ya aprobado por otro agente. A20 usa la rama genérica de materialización, con creación de tarea y enlace al hito separados. La validación exacta de snapshot de Camino del código inspeccionado se aplica específicamente a A13/A14.
- **Mejora:** identidad determinista de oportunidad por tienda, segmento, conducta, intervención y periodo; revalidar plan/versión y evidencia en aprobación. Materializar tarea, metadatos, enlace y recibo en una transacción idempotente; resolver un duplicado enlazando el trabajo existente, sin reabrir entregas cerradas.
- **Aceptación:** dos aprobaciones/runs concurrentes producen una sola tarea por oportunidad; un fallo del enlace no deja tareas huérfanas ni un output falsamente aprobado. Títulos diferentes para la misma intervención no eluden la deduplicación.

### A20-015 · Dejar una medición operativa después de aprobar y completar

- **Evidencia:** el output no requiere un protocolo de medición por oportunidad. La tarea completada y los ingresos atribuidos al email pueden dar una apariencia de éxito sin demostrar más segunda compra o más contribución.
- **Mejora:** guardar baseline de segmento y ventana, numerador/denominador, fecha de inicio, propietario, objetivo e incertidumbre, plazo de maduración y guardarraíles de margen, devoluciones y fatiga. Ofrecer comparación o holdout cuando sea viable; distinguir observación antes/después de efecto incremental.
- **Aceptación:** completar el diseño de un flow no marca alcanzado el objetivo económico. Una revisión posterior informa «pendiente de maduración», «no medible», «mejoró», «sin cambio» o «empeoró» con evidencia; nunca atribuye causalidad por coincidencia temporal.

### A20-016 · Alinear cron, cambios de datos, cuotas y reintentos

- **Evidencia:** la cadencia automática general es 20 horas; la UI dice dos veces al día y permite «Actualizar ahora». El server obtiene una clave de idempotencia, pero para A20 pasa `runOptions: undefined`; las reservas atómicas manuales contemplan otros agentes, no A20. El cron genera agregado más tiendas aunque las oportunidades necesitan scope concreto y puede repetir datos prácticamente idénticos.
- **Mejora:** declarar una política A20 única: reevaluar cuando cambien suficientes datos/cohortes/objetivos, con cadencia máxima explícita, digest por tienda, reserva idempotente y lease. Separar resumen organizativo de diagnósticos por tienda. Si se mantiene refresco manual, mostrar cuota/motivo; si el producto lo elimina, retirarlo coherentemente de UI y API.
- **Aceptación:** doble clic, retry del proxy y coincidencia con cron no duplican coste ni propuestas; otra tienda conserva su caché y capacidad. La UI explica el disparador y próxima evaluación reales. GET no inicia una generación.

### A20-017 · Reducir consultas históricas y conservar contexto útil y auditable

- **Evidencia:** la salud de cliente lanza cinco RPC, varias recorren histórico completo; la de producto vuelve a recorrer pedidos/líneas. En test un run v3 exitoso registra 15 llamadas a herramientas. Las tools pueden repetirse dentro del turno y la provenance común no acredita frescura; el contexto genérico añade playbooks/actividad cuyo volumen puede desplazar la evidencia principal.
- **Mejora:** snapshot agregado por tienda/corte/versionado de datos, memoización por turno, consultas condicionales de producto/CRM y presupuestos de tamaño/tiempo. Priorizar objetivo, evidencia cuantitativa y backlog relevante, conservar manifest/hash y señalar recortes. Medir planes de consulta con volumen representativo antes de añadir índices o tablas resumen.
- **Aceptación:** repeticiones idénticas reutilizan el snapshot; no se recorta silenciosamente el denominador de una cohorte. Medir latencia DB/modelo, tokens, coste por oportunidad aceptada y regresión con muchas tiendas; una consulta no disponible no desencadena una cadena indefinida de reintentos.

### A20-018 · Mostrar disponibilidad y oportunidades donde se toman decisiones

- **Evidencia:** A20 se presenta en Shopify, dentro de «Análisis de los especialistas IA» y solo para consultores. Usa el componente genérico con actualización manual y texto de cadencia común; el mapa de áreas expone clientes/medición pero no una navegación específica a cohortes u oportunidad/flow. Producción sin versión activa necesita un estado diferente de «no hay datos».
- **Mejora:** mostrar fuente/tienda, última medición, cobertura, causa de abstención, disparador y estado de aprobación. Presentar pocas oportunidades comparables, con motivo, siguiente paso y destino exacto a Mi Camino/CRM/tarea. Dar al cliente autorizado un resumen comprensible si encaja con su rol; mantener los diagnósticos internos donde corresponda.
- **Aceptación:** se distingue agente deshabilitado de sincronización pendiente, muestra insuficiente y oportunidad descartada. Cambiar de tienda invalida la vista anterior. Una recomendación tiene un camino visible hasta decidirla y ejecutarla.

### A20-019 · Aprender de decisiones y resultados sin repetir consejos ni filtrar datos

- **Evidencia:** el contexto específico recoge tareas abiertas, pero no un registro tipado de oportunidad→decisión→entrega→resultado medido. La actividad compartida genérica no garantiza conservar rechazo, fecha de reevaluación o experimento previo del mismo segmento. El acceso protegido se registra de forma best-effort y el output de producto omite identidades, lo cual conviene preservar.
- **Mejora:** conservar decisiones, motivo, responsable y vencimiento por oportunidad; reutilizar resultados observados del mismo scope y versión. Separar feedback humano declarado de medición verificada y texto externo de instrucciones. Mantener agregación, umbrales de muestra, auditoría de acceso y retención de snapshots, sin volcar clientes o destinatarios al modelo.
- **Aceptación:** una oportunidad rechazada no vuelve sin cambio justificable; una acción en medición no genera otra igual. Datos de otra tienda, feedback no verificado o instrucciones insertadas en títulos/documentos no cambian el diagnóstico autorizado.

### A20-020 · Verificar valor y contrato efectivo antes de dar el agente por terminado

- **Evidencia:** las seis pruebas propias de A20 y el test canónico pasan aunque la versión remota omita la herramienta principal. Los tests de producto verifican cadenas SQL/código; no ejecutan cohortes en Postgres ni acreditan un resultado positivo. La matriz de evaluaciones de agentes declara expectativas, pero no sustituye la prueba de entrega.
- **Mejora:** fixtures de cohortes y producto con resultados esperados; pruebas de tool realmente expuesta/ejecutada, snapshot, RLS entre tiendas, coste, aprobación concurrente, tarea y handoff. Incluir recompra real, cero conocido, cohortes pequeñas/inmaduras, singleton, backfill incompleto, costes/moneda desconocidos, flow existente y ciclo anual. Hacer preflight contra la versión/hash/build efectivos y verificar el recorrido servido.
- **Aceptación:** evaluar precisión de oportunidades, correcciones humanas, aceptación útil, duplicados y medición posterior. Publicación sin datos suficientes se abstiene correctamente; ninguna etiqueta documental «cerrado» depende solo de regex o de un run exitoso.

### Verificación, muestra y límites de la auditoría A20

- **Descubrimiento:** grafo MCP para runner, callers y funciones de contexto; contraste con las fuentes actuales porque el índice tiene rangos históricos. Lectura de registro/tools, contrato, caché, worker, cuotas, aprobación, consumidores web, SQL y notas anteriores. No se auditó todo el software.
- **Bases remotas, solo lectura:** test `kopcblejsxpkxoykldyh` y producción `cthjwpeygpzwdmjkxeqa` comparten v3/prompt de 5.250 caracteres, SHA-256 `80a7b039e92806dc52f34c8410cf63084fc9e39539453715b856c19926b08eef`, modelo declarado `claude-sonnet-5`, aprobación previa y allowlist de dos tools. Solo test tiene v3 activa. Modelo efectivo sujeto a routing/overrides; no se hizo una llamada nueva al proveedor.
- **Muestra:** test tiene seis runs A20: tres fallidos y tres exitosos, estos últimos con un output cada uno y cero llamadas a la herramienta principal. Dos outputs exitosos son agregados y uno tiene tienda; no se afirma su impacto de negocio. Producción tiene cinco runs fallidos y ninguna versión activa. En la tabla de pedidos válida inspeccionada hay 10.348 pedidos identificados/clasificados en test y cero en producción; esas cifras describen la tabla/entornos observados y no certifican clientes reales ni toda la historia del negocio. La tienda activa de test tiene 381 días observados y la RPC de producto devuelve `insufficient_observed_history`.
- **Pruebas:** 21/21 de contratos A20, gate, tools y helpers LTV; 1/1 canónica específica A20. La ejecución más amplia de canónicos también mostró fallos ajenos de A12/A13/A14 en el árbol ya modificado; no se modificaron ni se presentan esas suites como verdes. No se ejecutó build/typecheck porque esta pasada solo añade documentación.
- **Reproducciones locales con helpers reales:** dos cohortes con solo offset 0 habilitan comparación a edades 1/3; una cohorte singleton se pierde; curva con métricas netas y CAC sin acreditación de cobertura/ajustes permite `PAID_BACK`. Son fixtures sintéticos, sin generar actividad ni modificar datos de negocio.
- **Permisos y fuentes:** se contrastaron definiciones y políticas de las fuentes principales en test; no se suplantaron usuarios ni se hicieron pruebas de explotación. Referencia de seguridad: [RLS y grants de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), que distingue los permisos de tabla de las políticas y el bypass de service role. Se consultó también el índice actual de changelog; no se atribuyen los fallos de negocio al proveedor.
- **Entrega de esta pasada:** solo esta entrada en `docs/MEJORAS_AGENTES.md`. No hay implementación A20, activación remota, migración, envío de marketing, aprobación real, despliegue ni generación pagada. Cada mejora incluye su prueba/criterio para una implementación posterior verificable.

### A20 · Requisito explícito de coordinación del ecosistema

**Ampliación solicitada por el usuario (20-oct-2026):** A20 debe coordinar sus oportunidades con Mi Camino, los planes mensuales/semanales/diarios, el calendario de marketing y la creación de emails/ads. Es un requisito de implementación de A20-011 a A20-019, no una capacidad ya verificada como operativa.

| Participante | Responsabilidad en una oportunidad originada por A20 |
|---|---|
| A19 · Mi Camino | Mantener objetivo y dirección aprobados; recibir resultados de retención y propuestas de ajuste justificadas. |
| A20 · Retención | Detectar y definir oportunidad, segmento, evidencia, incertidumbre, comportamiento deseado y protocolo de medición. |
| A18 / A17 / A04 | Incorporar la iniciativa mensual, los entregables semanales y las acciones diarias, respetando capacidad y trabajo existente. |
| A05 · Campañas | Encajar la intervención en el calendario y estrategia comercial, con audiencia, oferta, canales y restricciones de margen. |
| A27 / A28 | A27 desarrolla el plan de mailing cuando corresponde una campaña puntual; A28 diseña el flow cuando corresponde una automatización. La oportunidad puede usar uno, ambos o ninguno según evidencia. |
| A11 y generadores del módulo de marketing | Elaborar los emails y las piezas solicitadas desde un brief aprobado, con identidad común de oportunidad/campaña y las herramientas reales del módulo. |
| A14 / A15 / A23 y generación de ads | Evaluar viabilidad, medición, inversión y dirección creativa de Meta/Instagram; encargar las piezas al generador correspondiente. Respetar tamaño y elegibilidad de audiencia, consentimiento, fatiga y exclusiones; no asumir que todo segmento de retención admite publicidad. |
| A12 y analistas del canal | Aportar rendimiento y limitaciones de atribución. A20 contrasta después recompra/contribución con su baseline y seguimiento; A19 recibe la medición resultante. |

**Contrato compartido:** `opportunity_id`, organización/tienda, versión de evidencia y fecha de corte, plan/revisión/hito, segmento y exclusiones, objetivo/métrica/base/ventana, oferta y restricciones conocidas, entregable, agente responsable, dependencias, plazo, estado, origen de aprobación y referencias a tareas/campañas/flows/piezas/resultados. Los destinatarios reciben solo los campos pertinentes y agregados; nunca una conversación libre con toda la información del negocio.

**Coordinación:** el orquestador dirige solicitudes/resultados estructurados, conserva recibos idempotentes y una fuente de verdad por dato. Los agentes pueden solicitar análisis o entregables concretos y devolver bloqueos; no se invocan todos en cadena por defecto ni se asigna a varios la misma responsabilidad. El flujo debe prevenir ciclos A20→planificador→A20 y distinguir propuesta, aprobada, planificada, en producción, entregada, en medición y evaluada. Un fallo de generación no duplica la iniciativa ni vuelve a ejecutar etapas ya completadas.

**Ejemplo de aceptación:** A20 detecta una oportunidad defendible de segunda compra en una categoría → se vincula al objetivo vigente de Mi Camino → A18/A17/A04 encajan el trabajo → A05/A27 o A28 preparan campaña/flow según el caso → A11 crea los emails y, si procede y está autorizado, el módulo de ads recibe el brief de piezas → se revisa y aprueba la ejecución → los analistas devuelven medición de canal y A20 evalúa la conducta/contribución observadas → Mi Camino muestra el resultado. Se conserva una sola oportunidad y trazabilidad completa; planificación y generación de borradores no autorizan por sí mismas publicación, envío o gasto.

**Criterio de valor:** la entrega no termina en «crear una tarea» ni en «generar un email». Debe poder recorrerse desde la oportunidad hasta la pieza/ejecución autorizada y su evaluación, o explicar de forma visible qué dato, decisión o dependencia la bloquea. Implementar y probar este recorrido como parte de las mejoras A20 antes de declarar completa la coordinación.


### Implementación A20 · entrega de código y migraciones (20-oct-2026)

El código se integra en `.worktrees/a17-implementation`, rama `codex/a17-full-improvements`, junto a las dependencias A17/A18/A19. El árbol principal conserva sus cambios. Las siete migraciones A20, desde `20270104220000` hasta `20270104230000`, están aplicadas en **test y producción**. Las correcciones se versionaron por separado después de probarlas en test; no se reescribieron migraciones ya aplicadas.

| Mejoras | Implementación y alcance |
|---|---|
| A20-001/002 | Versión v4 completa e inmutable, cuatro herramientas, precarga obligatoria de evidencia; contrato de oportunidades validado en servidor. Ambas bases sirven el checksum `db26669ff7994bfd21d0661b0b09059c488c9d5acb5c0553b7c8636048de75ed`. |
| A20-003 | Autorización exacta por tienda en generación, caché, seguimiento y aprobación. Políticas restrictivas en pedidos/líneas/productos; RPC históricas de clientes restringidas al backend. |
| A20-004/005/006 | Corte fijo, frescura de sincronización, cobertura identificada/clasificada, cohortes observadas y seguimiento individual de 30/60/90/180 días; muestra mínima 30. Normalización singleton y exclusión del offset cero como prueba de seguimiento posterior. |
| A20-007 | La oportunidad no admite CAC, payback, uplift o impacto económico numérico inventado. Baseline y denominadores proceden del servidor; moneda/costes desconocidos conservan incertidumbre. No se presentan curvas financieras como verificadas. |
| A20-008/009 | Recompra de productos con seguimiento maduro sin exigir 455 días a toda la tienda; IDs exactos, productos complementarios con muestra mínima, catálogo/categoría/estado acotados al scope. Historia vitalicia y continuidad de importación se declaran desconocidas cuando no están acreditadas. |
| A20-010 | Inactividad a 180 días es una señal de investigación; no permite por sí sola campaña o win-back. El catálogo aporta contexto de categoría y no se infieren cancelaciones de suscripciones. |
| A20-011/012/013 | Brief tipado con hipótesis, propietario, esfuerzo, exclusiones, criterio de cierre, evaluación y evidencia. Plan/revisión/hito exactos; no se adivina un hito. Rutas por intervención hacia A18/A17/A04, A05/A27/A28, A11/A12 o A14/A23/A15/A24. El canal ads comienza como viabilidad, con bloqueos explícitos y sin autorización de gasto. |
| A20-014 | Identidad estable por organización/tienda/segmento/intervención, rechazo durable, aprobación con bloqueo de fila y tarea/enlace/handoffs transaccionales. Comprobar revisión del Camino también detecta un plan aprobado después de un snapshot sin plan. |
| A20-015 | Baseline, numerador/denominador y ventana quedan guardados. Entregas aprobadas preceden a la confirmación de ejecución; la revisión espera la maduración y nunca un plazo menor al horizonte. Evaluación humana declarada con evidencia, distinguida de medición verificada y sin atribución causal. |
| A20-016/017 | Ejecución solo por tienda, cadencia visible de 20 horas, cuotas, exclusión concurrente, idempotencia y deduplicación de evidencia. Token/lease cercan la escritura atómica de output, oportunidades y finalización. Contexto acotado y con manifiesto; snapshot reutilizado por las herramientas. Cambios de CRM/catálogo/decisiones forman parte de la huella. |
| A20-018 | Panel Shopify de seguimiento por tienda: disponibilidad, estado de generación, última evaluación, propuestas, tarea, dependencias, entregas aprobadas, maduración y resultado. El cambio de tienda reinicia el componente. Se mantiene la revisión del diagnóstico y se corrige su texto de cadencia. |
| A20-019 | Historial durable de decisiones, motivos, versiones y resultados. Contexto compartido de solicitudes aprobadas; A19/A20 observan la medición. A11 recibe el brief en su runner específico y las salidas de especialistas registran recibos de etapa. Un recibo no equivale a entrega: requiere confirmación explícita sobre un output aprobado. |
| A20-020 | Pruebas unitarias del contrato y regresiones, fixtures SQL reproducibles con rollback, comprobación de configuración efectiva y permisos en las dos bases. El despliegue y la validación del recorrido servido siguen siendo pasos diferentes. |

**Validación realizada:** 39/39 pruebas focalizadas de API, 97/97 pruebas del contrato compartido de IA, y typecheck de API/web correctos. La suite completa de `@e-nora/ai` da 274/275: falla `camino-plan.test.ts`, «A19 normaliza fases y fechas antes de validar la propuesta» (esperado 51 días, obtenido 40); no se modifica ese comportamiento ajeno a A20. El comando `npm run test:a20-retention -w @e-nora/api` incluye las pruebas nuevas.

**Postgres real en test:** los fixtures `apps/api/src/fixtures/a20-retention-lifecycle.sql` y `a20-retention-atomic.sql` probaron materialización idempotente, dependencias, rechazo durable, entrega con output aprobado y recibo scoped, reintento de entrega, inicio de medición, bloqueo de evaluación prematura, deduplicación de generación, rechazo de token incorrecto y escritura atómica. Todo se revirtió mediante rollback. No se generaron emails, anuncios ni actividad comercial real.

**Comprobación remota:** ambas bases tienen v4 activa con las cuatro herramientas, 9 RPC, 5 tablas con RLS y permisos de escritura/backend cerrados a authenticated. No quedaron oportunidades de los fixtures. En test el snapshot observado devolvió 24 métricas elegibles sobre 10.348 pedidos; no se interpreta esa muestra como prueba de impacto.

**Límites de esta entrega:** API, web y worker no se han desplegado ni subido a main en esta pasada. No se ejecutó una nueva generación pagada ni una campaña real. La coordinación es una cola estructurada consumida por las ejecuciones normales de cada agente; las etapas no se invocan recursivamente. Las piezas de marketing se generan por los flujos existentes, con revisión humana. El resultado económico sigue requiriendo ejecución autorizada, maduración y evidencia; este registro no certifica uplift ni una medición automática de cohortes expuestas/holdout. No se da por validado el recorrido servido en producción hasta desplegar y comprobarlo.

## A21 · Adquisición y conversión Shopify: auditoría completa y coordinación con A20

**Auditoría: 21 de octubre de 2026. Estado: 22 mejoras registradas, A21-001 a A21-022; esta pasada no las implementa.** Se inspeccionó el árbol principal sobre `04c26ec`, con sus modificaciones locales, la implementación A17/A18/A19/A20 de `.worktrees/a17-implementation` y las configuraciones/fuentes de test y producción mediante consultas de solo lectura. La configuración de BD no demuestra qué build de API/web/worker está desplegado. Se conserva la entrega anterior de A20: sus migraciones están aplicadas, pero su nuevo runtime/UI no se dieron por desplegados.

**Función y valor esperado:** A21 debe detectar oportunidades defendibles de captación y primera conversión, localizar qué etapa o segmento merece investigación y convertirlo en trabajo medible. A20 debe contrastar qué calidad, segunda compra y contribución posterior tienen los clientes captados. Ambos comparten checkout, ofertas y CRM; necesitan una oportunidad común cuando trabajan sobre la misma intervención. Primera compra, recompra, recuperación de checkout y venta atribuida no son la misma métrica.

**Lo que ya existe y conviene conservar:** v6 activa en test y producción, prompt v5 de 5.373 caracteres, SHA-256 verificado `5c4779035d4f9208b2492ba1e77369d2b08d9994b5af177b5af6594df2286ab6`, herramientas `search_knowledge`, `shopify_funnel_health` y `shopify_margin_health`, y aprobación previa. El prompt distingue atribución de causalidad, permite abstención, advierte sobre descuentos/margen y separa frescura del conector de cobertura de métricas. Cuatro outputs v6 exitosos de test registran llamadas de embudo y margen. Estos puntos mejoran la situación observada antes en A20; no se registra como defecto una herramienta principal ausente del allowlist de A21.

**Activación comprobada en código:** GET `/ai/adquisicion-shopify` consulta caché; POST `/ai/adquisicion-shopify-run` regenera. El worker llama desde `runDiagnosticOrchestratorTickInner`. La cadencia general parte de 20 horas y puede variar por ajustes; para A21 se contemplan agregado organizativo y tiendas. La UI de Shopify lo coloca en un desplegable visible para consultores y el componente genérico anuncia dos veces al día. A21 propone tareas; no modifica la tienda, envía correos ni compra anuncios por sí mismo.

### A21-001 · Verificar la versión efectiva y separar activación de disponibilidad

- **Evidencia:** ambas bases tienen v6/prompt v5 activos y checksum correcto. Producción conserva tres runs fallidos y ningún output exitoso en la muestra; la conexión de la tienda activa figura en error, con última sincronización el 22-sep-2026. Las notas anteriores de `REVISION_AGENTES.md` todavía mencionan aplicar v6 como seguimiento.
- **Mejora:** preflight por entorno con versión/hash, build de runtime, contrato, tools ejecutables, configuración de cadencia y disponibilidad de cada fuente. Mostrar por separado agente habilitado, conexión con error, permisos pendientes, fuente vacía y resultado histórico.
- **Aceptación:** una v6 activa con Shopify sin sincronización no aparece como agente listo para decidir; un build antiguo no acredita las mejoras nuevas. Actualizar la documentación a partir del manifiesto efectivo sin reescribir prompts históricos.

### A21-002 · Cerrar el alcance por tienda en API, contexto y RLS

- **Evidencia:** `resolveStrictStoreScope` admite `connectionId` ausente y devuelve agregado; el runner genérico sigue usando `requireMembership`, que rechaza miembros limitados a tienda. En ambas bases, las políticas de sesiones, checkouts, sus líneas y aplicaciones de descuento comprobadas usan `accessible_org_ids()`, sin predicado de tienda. Las tres RPC de atribución/recuperación/descuentos tienen EXECUTE para anon y authenticated; el embudo lo tiene para authenticated. Esto no prueba por sí solo lectura anónima: las funciones son invoker y siguen dependiendo de RLS.
- **Mejora:** autorizar después de resolver la tienda exacta; proteger también las tablas y RPC auxiliares. Reservar los agregados para una función explícita y roles con acceso organizativo. Pasar `storeId` al contexto de decisión: A21 omite esa opción y carga snapshots organizativos que pueden describir otras tiendas.
- **Aceptación:** JWT limitado a tienda A puede operar A y no leer B por API, RPC ni tablas; tampoco recibe evidencia B en el prompt. Probar denegación de agregado, tienda inactiva y conexión ajena. No sustituir esa prueba por un guard de frontend.

### A21-003 · Validar un snapshot de evidencia antes del veredicto

- **Evidencia:** el contexto inicial precarga atribución, checkouts y descuentos, pero embudo/margen dependen de llamadas del modelo. A21 usa el contrato genérico: no hay validación específica de recibo, cobertura o elegibilidad de cada propuesta antes de persistirla. La muestra v6 sí hizo las llamadas; eso demuestra comportamiento observado, no una garantía del runner.
- **Mejora:** snapshot servidor con corte único, fuentes, errores, cobertura, denominadores, elegibilidad y decisiones permitidas. Validar cada oportunidad contra IDs y métricas presentes. Exigir embudo para una conclusión de conversión y suficiencia financiera para una decisión económica; las fuentes no necesarias no tienen que consultarse.
- **Aceptación:** tool omitida/denegada/fallida o cobertura insuficiente impide la conclusión afectada, sin invalidar fuentes independientes útiles. Un run exitoso y un recibo de llamada sin datos no certifican evidencia.

### A21-004 · Usar la salud de cada bloque de sincronización

- **Evidencia:** `loadShopifySyncCoverageBlock` resume conexión y última sincronización global. Los fallos opcionales de sesiones o checkouts pueden coexistir con otros bloques sincronizados. La tabla de checkouts observada está vacía en ambos entornos, mientras la RPC devuelve una fila con ceros; `agentRpcEvidence` la etiqueta como disponible.
- **Mejora:** integrar el estado ya existente de los bloques de sync y su ventana importada, permisos, errores y fecha de éxito. Distinguir ausencia confirmada con importación completa de fuente no importada, desautorizada, parcial o atrasada.
- **Aceptación:** una sincronización global reciente con fallo de `abandoned_checkouts` no acredita cero abandonos. Una limitación de permisos dirige a la acción correcta y no genera repetidamente tareas de resincronización imposibles.

### A21-005 · Conservar valores desconocidos en la ingesta del embudo

- **Evidencia reproducida:** con columnas de embudo presentes, `funnelMetric({}, metric, true)`, valor null y cadena inválida devuelven los tres **0**, porque usan `toNumber`. Los tests actuales cubren columnas ausentes y cero válido, pero no estas filas.
- **Mejora:** validar cada celda y conservar null ante dato ausente/no numérico; registrar cobertura y advertencia de calidad. Los contadores de pasos completos deben depender de valores válidos, no solo del esquema de columnas.
- **Aceptación:** cero medido sigue siendo cero; null, fila incompleta, infinito o cadena inválida no se convierten en abandono o conversión cero. Una reimportación inválida no borra silenciosamente un valor válido anterior.

### A21-006 · Fijar ventanas, zona horaria y periodos comparables

- **Evidencia:** el runner y cada tool calculan `new Date()` por separado. La ventana rolling de 90 días se trunca a fechas inclusivas en SQL y abarca 91 fechas; los outputs v6 observados hablan de 91/91. Pedidos usan timestamps mientras sesiones usan buckets diarios. No se precarga un periodo anterior equivalente; la tool no permite elegirlo.
- **Mejora:** corte único, calendario de tienda y límites explícitos, preferiblemente días completos con intervalo semiabierto. Proveer periodo actual/anterior equivalente, maduración, festivos/campañas y cobertura por ventana. Reservar intradía para comparación intradía equivalente.
- **Aceptación:** misma fecha de referencia en contexto y tools; ninguna suma duplica un día de frontera. Comparaciones respetan zona/DST, días de semana y cobertura, y explican las ventanas que realmente usan.

### A21-007 · Calcular tasas solo con numerador y denominador compatibles

- **Evidencia reproducida en SQL:** la tasa agregada suma `conversion_rate * sessions` y divide entre todas las sesiones aunque haya tasas null. Con 100 sesiones al 10 % y 900 sesiones sin tasa, informa 1 %. En agregado, dos tiendas con un día cubierto cada una pueden sumar dos fechas cubiertas de dos solicitadas aunque ninguna tenga cobertura completa.
- **Mejora:** calcular tasas sobre el mismo subconjunto válido o declararlas parciales; exponer cobertura de la tasa, no solo de pasos. La cobertura agregada necesita matriz tienda/día, no unión de fechas. Separar suma de visitantes diarios de visitantes únicos del periodo.
- **Aceptación:** el caso 100/900 no fabrica 1 % como tasa total; huecos complementarios entre tiendas no producen cobertura completa. Falta de denominador, cero conocido y desconocido tienen estados distintos.

### A21-008 · Explicitar embudo abierto/cerrado y cambios de medición

- **Evidencia:** las métricas sincronizadas son sesiones que añadieron, llegaron o completaron checkout; no se acredita un recorrido secuencial de las mismas sesiones. Shopify distingue embudos abiertos y cerrados y advierte que una sesión puede saltarse un paso. También documenta un cambio de medición de sesiones entre el 21 y el 23-sep-2026 que afecta comparaciones y filtros de bots.
- **Mejora:** versionar definición, fuente, filtros y tipo de embudo; no deducir fugas secuenciales desde contadores marginales. Señalar discontinuidades de medición y separar baseline anterior/posterior cuando no sean comparables.
- **Aceptación:** checkout directo no se interpreta automáticamente como error de carrito; sesiones que compran no se rotulan como pedidos únicos. Una variación al cruzar la actualización de Shopify no se atribuye a una campaña sin evidencia. Referencias: [embudos y sesiones de Shopify](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/behaviour-reports), [actualización de medición](https://help.shopify.com/en/manual/reports-and-analytics/discrepancies/session-measurement-update).

### A21-009 · Separar adquisición, recompra y atribución del pedido

- **Evidencia:** `shopify_attribution_by_channel` agrupa todos los pedidos por primera visita del journey y cuenta `customer_order_index = 1`, sin informar clasificación desconocida ni desglosar ingresos de nuevos/recurrentes. `ORDER_JOURNEY_QUERY` no pide `ready`. Shopify define el journey previo al pedido; la primera sesión no demuestra el origen vitalicio de adquisición del cliente.
- **Mejora:** exponer calidad/madurez de journey, clasificación nueva/recurrente/desconocida y métricas separadas. Para la conexión con A20, usar cohortes de primera compra observada o acreditada con la definición correspondiente, no el canal de un pedido repetido como origen original.
- **Aceptación:** un comprador que vuelve por email no vuelve a contarse como captado por email. Un pedido sin clasificación no se considera recurrente por descarte. No inferir conversión por canal desde pedidos sin sesiones de ese canal. Referencia: [CustomerJourneySummary](https://shopify.dev/docs/api/admin-graphql/latest/objects/CustomerJourneySummary).

### A21-010 · Añadir diagnóstico granular cuando la fuente lo permita

- **Evidencia:** A21 recibe contadores globales y atribución de pedidos. El sync de sesiones actual almacena agregados diarios; no entrega a A21 cortes de dispositivo, landing, mercado o canal de sesiones que permitan localizar una fricción concreta.
- **Mejora:** consultas acotadas y condicionales de segmentos disponibles, con cobertura, muestra, permisos y control de comparaciones múltiples. Priorizar por impacto defendible y estabilidad, solicitando investigación específica cuando falte la dimensión.
- **Aceptación:** no atribuir a móvil, velocidad, diseño, una página o método de pago un problema observado solo en el agregado. Evitar listas infinitas de variantes y presentar pocas hipótesis verificables; datos adicionales ausentes no bloquean el diagnóstico descriptivo válido.

### A21-011 · Medir recuperación con cohortes maduras y corte temporal

- **Evidencia:** `shopify_checkout_recovery` filtra creación por periodo, pero cuenta cualquier `completed_at` no nulo sin exigir que sea anterior al corte ni una ventana fija de recuperación. Incluye checkouts recién creados en el denominador y suma valor nominal. No ofrece clientes únicos, duplicados o elegibilidad de contacto.
- **Mejora:** cohortes de creación con seguimiento fijo, recuperación al corte, exposición/acción diferenciada y retraso de actualización. Distinguir checkout de persona y valor observado de ingreso incremental. Consultar consentimiento e inventario de recuperación con CRM antes de encargar envíos.
- **Aceptación:** una compra posterior al corte no modifica retrospectivamente el resultado «a esa fecha»; un checkout reciente no se compara con otro maduro. Duplicados o varios intentos de una persona no disparan secuencias superpuestas.

### A21-012 · Conservar atribución exacta de descuentos y decidir según su propósito

- **Evidencia:** la RPC actual ya separa `attributed_discount_total`, cobertura y descuento del pedido; el normalizador impide usar una asignación incompleta como importe exacto. Sin embargo, el contexto solo trae los diez códigos priorizados y no un inventario completo de sus reglas, público, objetivo y experimentos. A20 puede proponer incentivos para recompra.
- **Mejora:** preservar esos límites y añadir finalidad de la promoción, elegibilidad, combinabilidad, vigencia, margen, canibalización y trabajo existente. Rotular la lista como muestra y contrastar primero la intención compartida con A20.
- **Aceptación:** un código de fidelización sin clientes nuevos no se retira por ese motivo. Varios códigos en un pedido no duplican coste atribuido; ventas asociadas no se consideran causadas por el código. Descuento con cobertura desconocida no se presenta como cero.

### A21-013 · Exigir contribución y cobertura antes de proponer escalar

- **Evidencia:** `shopify_margin_summary` devuelve margen bruto de las líneas con coste, con contadores de estimación/ausencia; no equivale a contribución después de pagos, envío, devoluciones e inversión. Devuelve porcentajes cero cuando no existe base positiva. El control de moneda del runner es una instrucción general; A21 no tiene un contrato económico servidor comparable al gate A14.
- **Mejora:** enlazar suficiencia financiera, moneda, costes fechados, cobertura de gasto de adquisición y restricciones de capacidad. Coordinar viabilidad con A14 y calidad posterior de clientes con A20; mostrar unknown y estimaciones sin convertirlos en valores exactos.
- **Aceptación:** no recomendar presupuesto, descuentos ni CAC/payback objetivo desde margen parcial, coste actual usado como estimación o gasto incompleto. Un margen bruto positivo no acredita una captación rentable.

### A21-014 · Crear un contrato tipado de oportunidad accionable

- **Evidencia:** A21 usa `agentOutputSchema`; máximo cuatro, hipótesis y criterio son instrucciones del prompt, no un schema específico conectado a un snapshot. Título y descripción no establecen una identidad estable del problema.
- **Mejora:** contrato con oportunidad, lifecycle (primera conversión/recuperación/recompra), segmento, métrica/base/unidad/ventana, evidencia, incertidumbre, entregable, propietario, esfuerzo, exclusiones y criterio. Adjuntar cifras e identidades canónicas desde el servidor.
- **Aceptación:** segmentos inventados, denominadores no elegibles, cambios sobre el canal sin evidencia y propuestas sin entregable no se materializan. Abstenerse con cero oportunidades es válido; no fabricar cuatro para completar una cuota.

### A21-015 · Vincular al objetivo vigente de Mi Camino y sus horizontes

- **Evidencia:** A21 ya carga el Camino activo aprobado de la tienda mediante `loadPlanPhasesBlock`; es una base útil. No fija una revisión estratégica en el contrato A21 ni precarga un handoff tipado con A18/A17/A04. En agregado no tiene un Camino concreto.
- **Mejora:** oportunidad ligada a plan/revisión/hito exactos y métrica objetivo pertinente; propuesta mensual, entregables semanales y tareas diarias referencian esa misma oportunidad. Respetar capacidad y prioridades aprobadas; si faltan, dejar el bloqueo explícito.
- **Aceptación:** mejorar clics no se considera cumplir un objetivo de contribución. Una sustitución del Camino entre generación y aprobación exige revalidación. No asignar un hito corriente por conveniencia ni inventar disponibilidad del equipo.

### A21-016 · Compartir oportunidades con A20 y resolver solapamientos

- **Evidencia:** la implementación nueva de A20 tiene identidad estable, registro, estados y handoffs. Sus rutas no incluyen A21 y `retention_coordination_context` solo permite observar a A19/A20/A04 o a un agente que tenga etapa; por tanto, la llamada genérica añadida en el worktree no integra por sí sola A21. `persist_retention_opportunities` acepta como origen únicamente A20.
- **Mejora:** evolucionar ese mecanismo común con adaptadores compatibles y origen de agente explícito, sin crear un segundo backlog desconectado ni invocar una RPC A20 que rechaza A21. Definir quién lidera cada intervención: captación/primera conversión, retención o una investigación compartida.
- **Aceptación:** el mismo flow de abandono o promoción no genera tareas paralelas A20/A21 con títulos distintos. A21 no retira una oferta de retención sin revisar su propósito; A20 no reclama ventas de primera compra como recompra. Evidencia, decisiones y resultados se enlazan con IDs comunes y scope idéntico.

### A21-017 · Convertir el diagnóstico en encargos coordinados a marketing

- **Evidencia:** hoy A21 entrega tareas genéricas. Su contexto específico no incluye inventario de flows/campañas/piezas ni una ruta propia de encargos y recibos. La historia compartida es contexto, no acredita que el destinatario haya recibido y entregado el trabajo.
- **Mejora:** reutilizar la coordinación estructurada de A20: A05 encaja la campaña; A27 planifica mailing y A28 flows cuando corresponda; A11 genera piezas; A12/A26 revisan email según función; A14 valida viabilidad Meta, A23 orienta creativos, A15 analiza los activos y A24 comprueba medición. Añadir referencias exactas a los artefactos existentes.
- **Aceptación:** crear una tarea no equivale a crear un email, ejecutar un flow ni publicar ads. Cada etapa tiene responsable, dependencias, bloqueo/entrega y output aprobado. El generador recibe el brief de la oportunidad concreta sin ampliar audiencia, enviar, publicar ni gastar implícitamente.

### A21-018 · Materializar oportunidad, tarea y vínculo de manera atómica

- **Evidencia:** el flujo genérico ya dispone de reclamación de decisión y reintento por output/índice. Para A21, la deduplicación adicional usa títulos abiertos y el enlace al hito sucede después de crear la tarea; `shouldFallbackToCurrentMilestone` permite fallback A21. No existe identidad persistente A21 entre runs ni una revisión del Camino cercando su materialización.
- **Mejora:** conservar las protecciones existentes y añadir identidad semántica de intervención compartida con A20, estado/rechazo durable, bloqueo de versión y transacción de tarea/enlace/handoff. Revalidar scope y plan al aprobar.
- **Aceptación:** aprobación concurrente/reintento no duplica la oportunidad; fallo de enlace no deja una tarea huérfana presentada como entregada. Cambiar el título no elude un rechazo ni duplica un experimento en medición.

### A21-019 · Unificar cadencia, cuotas, idempotencia y coste de consultas

- **Evidencia:** cron contempla agregado más tiendas, con antigüedad base de 20 horas; calendario/UI describen otras frecuencias. El POST A21 pasa `runOptions` undefined aunque la ruta ya lee una clave idempotente. A21 no pertenece a la reserva manual atómica por tienda; las tools vuelven a consultar checkouts/descuentos ya precargados.
- **Mejora:** una política efectiva de scheduling mostrada en UI, generación por tienda, claves y cupos atómicos, exclusión concurrente/lease y caché ligada a cambios de evidencia/configuración. Reutilizar snapshot y consultas; las comprobaciones de salud no deben implicar una generación pagada.
- **Aceptación:** doble clic, reintento HTTP o dos workers generan una sola evaluación útil. Una tienda no consume el cupo de otra sin una política explícita. Un fallo recuperable no deja el estado indefinidamente en curso ni repite encargos completados.

### A21-020 · Reducir contexto y mostrar lo que realmente vio el modelo

- **Evidencia:** A21 carga snapshots organizativos del playbook sin `storeId`, historia y actividad. El serializador común limita bloques a 12.000 y contexto a 48.000 caracteres. El runner guarda bloques previos a serialización; A21 no registra el manifiesto de truncamiento de entrada efectiva que ya se trabajó para A17/A19/A20.
- **Mejora:** contexto mínimo por tienda, prioridad para objetivo/evidencia/cobertura/opciones pendientes y resumen acotado de decisiones. Registrar hash, versión y recortes de la entrada efectiva. Proteger campos externos como nombres de campañas/códigos/landings sin enviar PII ni URLs privadas de recuperación.
- **Aceptación:** un historial largo no expulsa el objetivo ni la limitación de cobertura. El snapshot auditable permite saber qué texto recibió el modelo; no se presentan todos los bloques originales como si hubieran entrado íntegros.

### A21-021 · Hacer visible la decisión y medir su resultado después

- **Evidencia:** la sección A21 está dentro del desplegable solo para consultores, usa texto genérico de cadencia y no tiene una bandeja propia de oportunidades. La UI declara destinos de embudo/carritos/promociones/medición, pero no el destino `origen` del diagnóstico. No existe para A21 un ciclo durable de ejecución→maduración→resultado de la oportunidad.
- **Mejora:** resumen permitido por rol con estado/frescura, alcance, causa de abstención, oportunidad, siguiente responsable y acceso al entregable exacto. Protocolo de medición con baseline, población, fecha de ejecución, ventana/propietario y guardarraíles; integrar la calidad/recompra posterior devuelta por A20.
- **Aceptación:** cambiar de tienda descarta la vista anterior; cada oportunidad tiene destino real. Completar la pieza o aumentar ingresos atribuidos no marca éxito económico. Mostrar pendiente de maduración, no medible u observación antes/después, y causalidad solo con un diseño que la sustente; feedback humano se etiqueta como declarado.

### A21-022 · Probar el recorrido y su valor con la configuración real

- **Evidencia:** 18/18 tests focalizados pasan, incluidos los dos de A21; estos dos inspeccionan principalmente cadenas de runtime/migración. Aun pasando, las reproducciones de null→cero, tasa parcial y cobertura agregada muestran fallos no cubiertos. Test tiene outputs; producción no acredita un recorrido exitoso.
- **Mejora:** fixtures numéricos de ingesta/SQL, pruebas de contrato, JWT/RLS entre tiendas y flujo completo oportunidad→aprobación→planificación→pieza→ejecución autorizada→resultado A21/A20. Preflight de build/prompt/tools y validación de coste/recuperación ante fallos.
- **Aceptación:** cubrir cero conocido, null/valor inválido, muestra pequeña, día actual, límites/DST, cambio de medición Shopify, journeys pendientes, nuevo/recurrente desconocido, checkout recuperado tras el corte, flow existente, código de retención, moneda/costes incompletos, reintentos y rechazo durable. Medir utilidad, duplicados, correcciones humanas y resultado posterior; no cerrar por regex o solo por `succeeded`.

### Contrato de coordinación A21 ↔ A20 ↔ Mi Camino ↔ marketing

| Participante | Responsabilidad y límite |
|---|---|
| A21 | Evidencia de captación/primera conversión, fricción observada y oportunidad; no confundir pedidos atribuidos con adquisición incremental. |
| A20 | Calidad y recompra posterior de las cohortes captadas, contexto de fidelización y restricciones de intervenciones compartidas. No sustituye el diagnóstico de primera conversión. |
| A19 / Mi Camino | Objetivo aprobado, restricciones y evaluación estratégica; recibir resultados vinculados al plan/revisión de origen. |
| A18 / A17 / A04 | Encajar la iniciativa mensual, entregables semanales y acciones diarias con una identidad común; respetar trabajo existente y capacidad. |
| A05 / A27 / A28 | Coordinar calendario, mailing o flow según evidencia e inventario. Reutilizar activos cuando corresponda, sin otra automatización duplicada. |
| A11 / A12 / A26 | Crear y revisar emails/piezas en los flujos existentes y devolver sus referencias. Rendimiento de canal no prueba incrementalidad ni retención. |
| A14 / A23 / A15 / A24 | Viabilidad/operación Meta, dirección creativa, análisis de activos y medición. La planificación no autoriza gasto ni publicación. |
| A06 / A22 cuando proceda | Contrastar disponibilidad de producto y restricciones operativas/CX. A21 no atribuye una caída a stock, envío o pago sin datos de esas fuentes. |

**Campos compartidos propuestos:** identidad de oportunidad/intervención y agente de origen; organización/tienda; snapshot/fecha de corte; plan/revisión/hito; lifecycle y población; objetivo/métrica/base/numerador/denominador/unidad/ventana; hipótesis y límites; exclusiones/consentimiento/fatiga/oferta; propietario/entregable/dependencias; estado/versión/aprobación; referencias a tarea, campaña, flow, pieza, ejecución y medición. Cifras agregadas y referencias verificadas; nunca una conversación libre entre agentes con toda la información del cliente.

**Reglas de coordinación:** una sola oportunidad puede tener entregables de varios agentes; las etapas reciben solicitudes estructuradas y devuelven recibos con referencia exacta. Un fallo no reinicia lo ya entregado. A20 y A21 no se llaman recursivamente ni generan recomendaciones enfrentadas sobre el mismo código/flow. El responsable y los bloqueos permanecen visibles; enviar, publicar o gastar conserva su autorización específica.

**Recorrido de aceptación:** A21 detecta una oportunidad de primera compra con cobertura suficiente → contrasta con A20 el segmento y la oferta → se alinea al Camino vigente → los planificadores organizan el trabajo → marketing reutiliza o genera la pieza adecuada → se revisa/autoriza la ejecución → se mide primera conversión y contribución con sus límites → A20 devuelve recompra/calidad de la cohorte cuando madure → Mi Camino muestra el resultado o la razón verificable por la que no es medible. El diseño no debe terminar en «crear una tarea».

### Evidencia, alcance y límites de esta auditoría

- **Archivos examinados:** `apps/api/src/ai-runtime.ts` (runner A21, tools, contexto, cuotas, orquestador y aprobación), `server.ts`, `shopify-sessions.ts`, `shopify-sync.ts`, `shopify-order-journey.ts`, `shopify-sync-coverage.ts`, `shopify-discount-attribution.ts`, `agent-task-delivery.ts`, `decision-playbook-chat-context.ts`, `plan-horizon-context.ts`, `auth-context.ts`; contratos/tools/juez de `packages/ai`; UI Shopify y migraciones A21. Se contrastó el registro/rutas/contexto de A20 del worktree, sin modificar esa implementación.
- **Descubrimiento:** grafo MCP para símbolos y callers; contraste con fuente real porque un snippet del índice devolvió rangos desactualizados. No se reconstruyó el grafo ni se auditó todo el repositorio.
- **Configuración remota:** v6 activa y checksum/prompt/tools coincidentes en test `kopcblejsxpkxoykldyh` y producción `cthjwpeygpzwdmjkxeqa`. También coinciden hashes de definición de las cuatro RPC de embudo/atribución/recuperación/descuentos. Las versiones históricas v1–v4 tienen checksums que no coinciden con su contenido; no se tocaron y no se confunde eso con un checksum incorrecto de la versión activa.
- **Muestra de ejecuciones:** test, seis runs A21: cinco exitosos y uno fallido; dos exitosos agregados y tres por tienda. Cuatro outputs son v6 y registran una llamada de embudo y una de margen cada uno; el v2 restante no tiene tool calls. Los cinco outputs siguen pendientes de aprobación. Producción: tres runs fallidos, agregados y sin outputs exitosos en esta muestra. No se atribuye el fallo de producción a una causa única solo por estos estados.
- **Muestra de datos al consultar:** test tiene 748 filas de sesiones en total y 382 con los tres pasos no nulos; producción, 376 y 371. Son filas históricas entre tiendas, no cobertura garantizada de una ventana. La tienda activa de test devolvió 78.646 sesiones, 2.419 sesiones con compra y cobertura 91/91; en pedidos de su ventana hay 2.390 registros válidos/clasificados y uno de primera compra. Las unidades son distintas: no se considera discrepancia por sí sola ni representa toda la captación real. Producción devuelve 9 sesiones, cobertura 61/91, fuente atrasada y sin pedidos en esa ventana. Checkouts sincronizados: cero filas en ambas bases; la RPC devuelve valores monetarios cero sin acreditar que no hubiera abandono.
- **Reproducciones sin escrituras:** helper real de ingesta con celda ausente/null/inválida devuelve cero. CTE sintético de la expresión real de tasa produce 1 % con 900/1.000 sesiones sin tasa; cobertura sintética de dos tiendas produce 2/2 fechas agregadas y solo 1/2 en cada tienda. Calendario rolling de 90 días abarca 91 fechas inclusivas.
- **Pruebas realizadas:** 18/18 en `a21-store-scope.test.ts`, `shopify-sync-coverage.test.ts`, `shopify-sessions-rows.test.ts`, `shopify-discount-allocations.test.ts` y `shopify-discount-metrics.test.ts`. No equivalen a una prueba completa con modelo, JWT entre tiendas o ejecución de marketing. No se ejecutó build/typecheck porque esta entrega solo añade documentación.
- **Fuentes primarias:** documentación oficial de Shopify citada en A21-008/009 para semántica y cambios temporales. Las conclusiones sobre este software proceden de código/SQL y reproducciones; no se extrapola un benchmark comercial ni se promete crecimiento.
- **Entrega:** únicamente esta entrada en `docs/MEJORAS_AGENTES.md`. No se cambió código de negocio, configuración de agentes, esquema, datos, permisos ni despliegues; no hubo nuevas llamadas pagadas al modelo, campañas, envíos o gasto. Las mejoras quedan pendientes de implementación y verificación en el recorrido servido.


## A22 · Postventa Shopify: entregas, incidencias y devoluciones

**Auditoría: 21 de octubre de 2026. Estado: 26 mejoras registradas, A22-001 a A22-026; pendientes de implementación.** Esta pasada documenta el árbol principal sobre 04c26ec y contrasta las dependencias A17–A21 de .worktrees/a17-implementation. Se consultaron TEST y producción en modo lectura. El código local y una versión activa en BD no certifican el build servido de API/web/worker. Esta sección se añade al MD principal y al del worktree de continuidad sin modificar sus entradas anteriores.

**Función que debe tener:** A22 convierte lo que ocurre DESPUÉS de la compra en decisiones operativas comprobables. Tiene dos trabajos relacionados: detectar envíos concretos que necesitan seguimiento y encontrar patrones recurrentes de preparación, transporte o devolución cuando haya muestra comparable. Por ejemplo, investigar una ETA vencida de un envío no exige esperar treinta casos; afirmar que una ruta empeoró sí exige denominadores, cobertura y comparación suficientes. No es hoy un agente conversacional de atención al comprador: analiza y propone trabajo; no manda mensajes, devuelve dinero ni cambia operadores por sí mismo.

**Relación con el ecosistema:** A13 organiza la respuesta operativa; A06 contrasta disponibilidad/preparación; A20 mide la recompra y calidad posterior; A21 evita recomendar captación o promesas incompatibles con la capacidad de entrega; Mi Camino fija el objetivo y recibe resultados. Los planificadores A18/A17/A04 convierten una mejora estructural en trabajo. Marketing solo participa cuando corresponde un entregable de comunicación definido, con revisión y autorización de su canal.

**Estado efectivo comprobado:** TEST y producción tienen A22 v7/prompt v7 activos, longitud 8.021 caracteres y checksum SHA-256 correcto e idéntico ac13e6077fd89cd4f79ddb5224a02dc57e5f3e51ae5f58ec8e781c3caad8a763. Allowlist: search_knowledge, shopify_delivery_diagnostics, shopify_fulfillment_health, shopify_open_delivery_exceptions y shopify_return_delay_comparison; aprobación required_before_publish. Se conserva esa base: herramientas de lectura acotadas, comparaciones no causales, muestra mínima, exclusión de datos personales de los eventos y cola persistente deduplicada ya existen.

**Bloqueos observados de utilidad:** las dos bases devuelven cero filas en fulfillments, eventos, estado de sync de eventos, incidencias y devoluciones. Esto no demuestra ausencia real de entregas o problemas. TEST registra ejecuciones de sync de eventos como succeeded aun con tablas vacías; producción no devuelve esos bloques en la muestra consultada. La validación oficial de la consulta A22Return contra 2026-07 falla por dos errores de esquema. El cron genera actualmente un scope agregado para A22 y la búsqueda de su endpoint en web/móvil solo encuentra el mapeo de etiqueta de agente, sin un panel A22. La cola de incidencias existente en Shopify sí debe conservarse.

### A22-001 · Definir una responsabilidad útil y separar casos de patrones

- **Evidencia:** el prompt habla de localizar preparación, transporte y excepciones, pero el usuario no dispone de una explicación visible del propósito/activación. El contexto inicial es una ventana más devoluciones por producto; no hay contrato de dos recorridos.
- **Mejora:** definir una cola de seguimiento de envíos y un análisis de patrones operativos, con alcance, responsable y producto de salida distintos. Priorizar por antigüedad, promesa, severidad, recurrencia e impacto observado; una estimación económica debe quedar separada de una pérdida confirmada.
- **Aceptación:** un caso concreto puede abrir una investigación con su evidencia; una comparación general no se presenta como patrón desde un caso aislado. Cero oportunidades defendibles es un resultado válido.

### A22-002 · Verificar versión, build y disponibilidad por separado

- **Evidencia:** v7 está activa y el checksum coincide en ambas bases; las notas históricas de REVISION_AGENTES.md todavía indican aplicar v7 como pendiente. Producción no muestra outputs exitosos de A22 en la muestra. Una tabla o prompt activo no acredita ingestión ni runtime desplegado.
- **Mejora:** manifiesto efectivo con build, versión/hash de prompt, contrato, tools registradas, configuración de scheduling, permisos y frescura de fuentes. Mostrar habilitado, sin datos, fuente parcial, desactualizado, fallo y resultado histórico por separado.
- **Aceptación:** un A22 habilitado con cero envíos importados no aparece listo para evaluar desempeño. Las notas de despliegue se derivan del estado verificado y conservan la historia.

### A22-003 · Cerrar el scope exacto de tienda en autorización y RLS

- **Evidencia:** resolveDeliveryStoreScope acepta falta de connectionId como agregado; el runner genérico sigue autorizando A22 con requireMembership, también en el worktree A17–A21. Las seis tablas de fulfillments/eventos/estado/excepciones/returns/líneas tienen en ambas bases políticas basadas en organización, sin predicado de tienda. Las RPC heredadas delivery_times y return_rate_by_product permiten EXECUTE a anon y authenticated, aunque son invoker y siguen dependiendo de permisos/RLS.
- **Mejora:** resolver y autorizar la tienda exacta antes de leer datos, caché, contexto o lanzar el proveedor. Restringir tablas, padres de líneas y RPC auxiliares al mismo alcance. Si se ofrece un agregado, exigir un rol autorizado y conservar la dimensión tienda.
- **Aceptación:** un JWT limitado a A puede usar A y no leer B mediante API, RPC, tabla o contexto. Probar conexión ajena, tienda inactiva, agregado sin permiso y miembro solo de tienda; no sustituirlo por filtros de frontend.

### A22-004 · Programar por tienda y separar urgencia operativa de análisis pagado

- **Evidencia:** la ejecución real de orchestratorScopesForAgent con A22 y dos tiendas devuelve únicamente storeId/connectionId null. A22 no está en las ramas que expanden por tienda. La base general de cron es 20 horas. El POST lee idempotency-key, pero pasa runOptions undefined a A22.
- **Mejora:** scheduling por tienda; actualización determinista de incidencias ante eventos/ETA y análisis de patrones con su cadencia efectiva. Reserva atómica por scope, idempotencia, lease recuperable, cuota manual por tienda y digest que incluya evidencia/configuración. Leer salud no debe pagar otro diagnóstico.
- **Aceptación:** dos workers/doble clic no duplican análisis o encargos; el cambio de ETA actualiza el caso sin esperar a una generación del modelo. UI y backend anuncian la misma política efectiva.

### A22-005 · Corregir el contrato GraphQL de ingesta de devoluciones

- **Evidencia reproducida:** la consulta A22Return extraída sin modificar de processShopifyReturn fue rechazada por el validador oficial para 2026-07: Cannot query field "nodes" on type "Fulfillment"; Cannot query field "fulfillmentLineItem" on type "ReturnLineItemType". La versión está fijada en shopify.app.toml y es el default de shopify-client.ts. Los 19 tests existentes pasan pese a estos errores.
- **Mejora:** adaptar la selección y el tipo de respuesta a la lista de fulfillments real y al fragmento del tipo concreto de línea devuelta; validar toda la operación contra la versión configurada. Manejar también los tipos de línea que no admiten el enlace esperado.
- **Aceptación:** consulta completa validada y replay de respuesta conforme al esquema; un webhook real controlado ingresa cabecera/líneas y no queda en reintento permanente por una consulta inválida. No se considera solucionado solo editando el tipo TypeScript.

### A22-006 · Acreditar ingestión y cobertura antes de interpretar ausencia

- **Evidencia:** hay cero registros logísticos/devoluciones en ambos entornos; TEST tiene 21 sync de fulfillment_events succeeded en la muestra y cero estados de eventos. El bulk de pedidos incluye fulfillments únicamente dentro de withExtras y limita la lista a diez; el fallback de extras puede quitar a la vez campos de dominios distintos. Las devoluciones se atienden por webhook, sin evidencia de backfill histórico completo.
- **Mejora:** recibo de cobertura por bloque, permiso, tienda, ventana, número de padres/hijos esperado e importado, truncamiento y última lectura completa. Recuperar histórico y conciliación incremental idempotente; una degradación de un extra no debe invisibilizar fulfillments sin avisar.
- **Aceptación:** sin filas importadas no significa cero retrasos/devoluciones. Un sync sin candidatos se distingue de una importación exhaustiva vacía; faltas de permiso o límites guían una acción de integración concreta.

### A22-007 · Completar origen y normalizar rutas sin inventar comparabilidad

- **Evidencia:** el bulk de fulfillments no selecciona ni persiste location_id en su mapeo, aunque la RPC agrupa por origen. El carrier se toma del primer trackingInfo; la normalización SQL es lower/trim. Múltiples nombres, carriers o ubicaciones desconocidas pueden acabar en grupos ambiguos.
- **Mejora:** importar el origen admitido por la API, conservar su cobertura y normalizar carrier/ruta con identidades estables y alias auditables. Distinguir varios fulfillments por pedido y múltiples referencias de tracking; origen desconocido permanece desconocido.
- **Aceptación:** no se comparan dos almacenes o servicios como si fueran una misma ruta. Un grupo unknown no permite concluir que un carrier concreto tiene peor desempeño.

### A22-008 · Preparar un snapshot autoritativo y validar las decisiones

- **Evidencia:** entregas, excepciones y comparación dependen de que el modelo invoque tools; el runner solo precarga devoluciones y contexto de Camino. A22 usa el output genérico sin una validación específica de oportunidad contra evidencia/cobertura. Un tool call correcto puede devolver cero filas.
- **Mejora:** snapshot servidor con corte único, fuentes/errores, cobertura, métricas permitidas, casos/segmentos exactos, numeradores/denominadores y decisiones elegibles. El contrato limita propuestas y adjunta cifras canónicas desde el servidor; las herramientas reutilizan ese snapshot.
- **Aceptación:** tool omitida/fallida, muestra o cobertura insuficiente bloquean la conclusión afectada. Fuentes independientes útiles siguen disponibles y el resultado no adquiere autoridad por status succeeded.

### A22-009 · Usar nombres y etapas que correspondan a la evidencia

- **Evidencia:** la tool heredada delivery_times utiliza campos como avg_hours_to_ship para un tramo basado en creación de fulfillment. En delivery_diagnostics, pickup_event_coverage se marca available si existe alguna lectura completa de eventos, aunque no se haya observado ningún CARRIER_PICKED_UP.
- **Mejora:** versionar definición/unidad de pedido, fulfillment, paquete, comprador, preparación, recogida y entrega. Exponer cobertura y tiempos reales del evento de recogida; lectura completa, eventos presentes y evento de recogida presente son indicadores distintos.
- **Aceptación:** completar una lectura vacía no acredita recogida física. No sumar conteos de envíos como pedidos ni presentar creación de etiqueta/fulfillment como salida del almacén.

### A22-010 · Medir la suficiencia del denominador que se está usando

- **Evidencia reproducida:** la fórmula de la RPC da sample_reliable=true con 30 fulfillments, aunque solo uno tenga ETA; sobre ese único caso puede devolver late_rate_pct=100. El umbral se aplica al volumen total, no a cada métrica.
- **Mejora:** gates por métrica: entregas con ETA para tardanza, cronologías válidas para percentiles, eventos completos/conocidos para motivos y población comparable para diferencias. Informar tamaño, cobertura, incertidumbre y composición; controlar múltiples cortes y sesgo del top 50.
- **Aceptación:** el caso de 30 envíos/una ETA no acredita un patrón de incumplimiento. Un dato parcial no se convierte en cero ni en una tasa definitiva; los incidentes individuales permanecen visibles.

### A22-011 · Evitar causas falsas y porcentajes de fiabilidad no calibrados

- **Evidencia reproducida con el helper real:** IN_TRANSIT + "Customs clearance completed" produce customs_hold/0.98; "No address issue reported" produce address_issue/0.95. La clasificación busca palabras sin negación o resolución y los scores son constantes. La UI los rotula como fiabilidad porcentual.
- **Mejora:** clasificador conservador con estado, negación, contexto de resolución, idioma y reglas verificables; mantener unknown cuando el mensaje no confirma una incidencia. Guardar versión/regla y nivel de evidencia; mostrar un porcentaje solo si se ha calibrado como tal.
- **Aceptación:** los dos textos anteriores no abren aduanas/dirección; textos negativos, resueltos, ambiguos y multilingües tienen fixtures. Un score heurístico no se anuncia como probabilidad medida.

### A22-012 · Conservar el historial y resolver episodios con evidencia

- **Evidencia:** refresh_shopify_delivery_exception cierra eta_overdue en el else de la comparación ETA < now(); una ETA que pasa a null entra en ese else. Un aplazamiento de ETA puede cerrar la incidencia sin conservar el compromiso anterior. Para eventos solo se inspecciona el último, por lo que una incidencia histórica seguida de tránsito genérico puede no llegar a abrirse en la primera ingestión.
- **Mejora:** reducer de eventos ordenados, episodios durables, historial de promesa/ETA, causas y resoluciones explícitas. Missing/partial/stale no resuelve. Conservar la protección actual: no borrar incidencias ya abiertas por fallos o páginas parciales.
- **Aceptación:** perder ETA no da el envío por resuelto; el cambio de promesa se audita y distingue de entrega. Los replays no duplican episodios ni pierden una incidencia relevante por el orden de ingestión.

### A22-013 · Convertir la cola en seguimiento por caso y responsable

- **Evidencia:** existe deduplicación por fulfillment/tipo y una lista máxima de 50, ordenada por apertura. La tool usa una referencia hash corta y la UI muestra pedido/acción, pero no tiene protocolo de asignación, vencimiento, acuse, escalado o resolución enlazado a un entregable A22.
- **Mejora:** identidad de episodio y referencia autorizada al envío exacto, responsable, severidad, siguiente revisión, acción, dependencias e historial. Priorizar urgencia antes que solo antigüedad; mostrar total/truncamiento y recuperar más casos de forma acotada.
- **Aceptación:** dos incidencias del mismo pedido no provocan comunicaciones incompatibles; un caso queda asignado y trazado, no solo convertido en un texto. Cerrar una tarea no prueba entregar el paquete.

### A22-014 · Definir ventanas y maduración sin mezclar estados posteriores

- **Evidencia:** el runner y las tools calculan now por separado. delivery_diagnostics selecciona cohortes por creación, usa now para pendientes vencidos y no corta eventos/entregas a period_end. El periodo anterior contiene resultados posteriores a su frontera y tiene más tiempo de seguimiento que el actual.
- **Mejora:** corte único y semántica explícita: estado a fecha de corte o cohorte de creación con seguimiento equivalente. Guardar numerador/denominador por ventana, calendario/zona y exclusiones; distinguir intradía, días completos, calendario y SLA laborable.
- **Aceptación:** repetir un informe a fecha histórica no introduce hechos futuros sin rotularlo como actualización de cohorte. Comparaciones actuales/anteriores tienen exposición comparable y no confunden fin de semana, campaña o mezcla de rutas con deterioro.

### A22-015 · Medir devoluciones según estado, unidad y elegibilidad

- **Evidencia:** return_rate_by_product suma quantity de shopify_return_line_items enlazadas a ventas, sin unir shopify_returns para filtrar estado o fecha. Solicitud, proceso cancelado/rechazado, devolución completada, cambio y reembolso son realidades distintas. La ausencia de filas de un webhook histórico incompleto produce conteos que pueden parecer cero.
- **Mejora:** métricas separadas por etapa y propósito, cohorte vendida/entregada madura, unidades elegibles y conciliación de reintentos/cambios/reembolsos. Conservar motivo enumerado y cobertura de vínculo a producto/envío; no inferir causa solo por el motivo más frecuente.
- **Aceptación:** una solicitud cancelada o rechazada no se cuenta como unidad físicamente devuelta. Una venta reciente sin seguimiento suficiente no mejora artificialmente la tasa; cualquier ratio explica su denominador y período.

### A22-016 · Hacer la ingestión de returns completa, consistente y recuperable

- **Evidencia:** el handler limita returnLineItems a 250 y falla si hay otra página; solo examina veinte fulfillments y cien líneas por fulfillment sin pageInfo para ese vínculo. Actualiza cabecera, líneas y retirada de líneas en operaciones separadas; no hay una reclamación por versión del recurso frente a dos webhooks concurrentes.
- **Mejora:** paginación/reconciliación acotada con continuación y cobertura, backfill de enlaces faltantes y estado de versión/updatedAt autoritativo. Persistir una revisión completa de forma atómica o mantener visible su parcialidad, sin retirar líneas a partir de una página incompleta.
- **Aceptación:** replays, eventos fuera de orden y un fallo entre escrituras no degradan una revisión más reciente. Un límite de consulta no deja el retorno eternamente fallido ni inventa el fulfillment de una línea.

### A22-017 · Comparar retraso y devolución con exposición adecuada

- **Evidencia:** return_delay_comparison trata como madura una creación de fulfillment de hace treinta días, aunque la entrega haya ocurrido ayer. La reproducción devuelve maduro=true con un solo día posterior a entrega. Usa returnStatus actual y agrupa carrier/origen, sin el destino de delivery_diagnostics. No es incidencia de devolución a treinta días.
- **Mejora:** para una métrica de devolución tras recibir, madurar desde entrega y usar fechas/estados históricos de retorno cuando estén disponibles; alternativamente etiquetar estrictamente la señal actual. Equiparar ruta/destino, antigüedad y cohortes; mantener la exclusión explícita de multi-fulfillment cuando no haya vínculo defendible.
- **Aceptación:** dos grupos no se comparan por tener treinta creaciones si su seguimiento real difiere. La diferencia sigue siendo asociación observada; no se atribuye culpa al operador ni causalidad sobre recompra.

### A22-018 · Registrar oportunidades tipadas con identidad compartida

- **Evidencia:** el prompt pide hasta cuatro tareas, cifras y criterio, pero el contrato genérico no fija problema, segmento, intervención, evidencia o identidad estable. A20/A21 ya disponen de un ledger común en el worktree; A22 no tiene adaptador de origen/materialización equivalente.
- **Mejora:** extender el mecanismo común con oportunidades A22 de caso o mejora estructural: tienda, episodio/cohorte, métrica/base/ventana, hipótesis, entregable, propietario, esfuerzo, exclusiones, dependencia y criterio. Mantener adaptadores compatibles para los orígenes anteriores.
- **Aceptación:** variar el título no recrea una intervención rechazada, aprobada o en medición. Un caso individual y una investigación agregada quedan vinculados cuando comparten problema sin confundir sus poblaciones.

### A22-019 · Alinear cada mejora al Mi Camino vigente

- **Evidencia:** A22 recibe Camino/tareas por tienda cuando se selecciona conexión, pero no fija revisión de plan en un contrato específico. El helper shouldFallbackToCurrentMilestone permite fallback para A22; su contexto de decisión genérico no pasa storeId a playbooks en el worktree.
- **Mejora:** plan/revisión/hito exactos, métrica objetivo pertinente y propuesta de horizonte mensual/semanal/diario con la misma identidad. Revalidar al generar y aprobar; un incidente urgente sin hito no debe asignarse artificialmente al hito corriente.
- **Aceptación:** sustituir el plan exige revalidación; completar una pieza o bajar un tiempo intermedio no acredita cumplir una meta económica o de experiencia distinta.

### A22-020 · Coordinar respuestas con responsables y recibos reales

- **Evidencia:** el prompt ordena coordinar A20/A21/A19, pero eso no constituye un encargo recibido. El contexto compartido A20/A21 del worktree solo devuelve solicitudes a A22 si existe un handoff destinado a él, y sus rutas actuales no lo incluyen.
- **Mejora:** solicitudes estructuradas y recibos de A13/A06/A20/A21/A19 y planificadores, con referencias exactas, prioridad y bloqueos. Encargar a marketing una comunicación cuando corresponda, con finalidad, destinatarios y permisos de ese flujo; un envío logístico no acredita elegibilidad para promoción. Reutilizar piezas/flows pertinentes.
- **Aceptación:** A20 no propone incentivos incompatibles con una incidencia activa sin revisar contexto; A21 no amplía una promesa no sostenible. A22 no invoca recursivamente todo el ecosistema ni declara una entrega de otro agente solo porque creó una tarea.

### A22-021 · Materializar decisión y vínculos en una transacción

- **Evidencia:** el flujo genérico conserva reclamación/reintento por output/índice, pero A22 sigue dependiendo de títulos para deduplicación y del vínculo posterior al hito. No hay identidad A22 durable que cierre el conjunto oportunidad/tarea/hito/handoff.
- **Mejora:** conservar las protecciones existentes y añadir transacción, bloqueo de revisión/scope, identidad semántica, rechazo durable y reanudación por etapa. Las autorizaciones de envío, publicación, reembolso y cambio operativo conservan su propia comprobación.
- **Aceptación:** aprobación concurrente o fallo de enlace no deja tareas duplicadas/huérfanas presentadas como trabajo entregado. Aceptar una investigación no autoriza actuar sobre Shopify o contactar al comprador.

### A22-022 · Acotar el contexto efectivo y conservar privacidad

- **Evidencia:** A22 no entra en el manifiesto de contexto acotado A17/A20/A21 del worktree. La rama genérica de playbooks omite su storeId. Las tools registran hora de consulta con freshness_seconds null; eso no es frescura de la fuente.
- **Mejora:** evidencia/objetivo/cobertura primero, historia resumida por tienda, datos externos tratados como contenido no confiable y manifiesto de texto realmente enviado: hash, versión y truncamiento. Mantener fuera del modelo mensajes originales de carrier, direcciones y tracking; usar referencias autorizadas para que el humano abra el recurso.
- **Aceptación:** un historial largo no expulsa la limitación crítica ni incluye contexto de otra tienda. Puede auditarse lo que recibió el modelo y cuándo se importó cada fuente.

### A22-023 · Hacer visible A22 y su siguiente acción en la UI

- **Evidencia:** la búsqueda del literal postventa-shopify en web/móvil solo encuentra agent-tag; no hay una sección A22 que consuma el endpoint. La cola de incidencias de Shopify sí existe y distingue error de vacío, pero no enlaza un diagnóstico A22, responsable, propuesta o resultado.
- **Mejora:** panel por tienda permitido por rol: para qué sirve, cuándo se evaluó, activación automática/manual, fuente/frescura/cobertura, bloqueo concreto, casos/oportunidades y siguiente responsable. Enlazar cola, tarea, informe y entregable exactos; mostrar estados de aprobación, ejecución y maduración separados.
- **Aceptación:** cambiar de tienda descarta datos anteriores; sin ingesta aparece la acción correcta, no “todo bien”. Un usuario entiende qué detectó A22 y qué trabajo falta sin leer el identificador técnico.

### A22-024 · Cerrar el ciclo con resultados observables

- **Evidencia:** no hay para A22 un ciclo durable propio de ejecución→seguimiento→resultado ligado a la oportunidad. Un output aprobado o tarea completada no prueba menor tardanza, devolución o pérdida de cliente.
- **Mejora:** baseline, población, evento de ejecución, propietario, ventana y criterios de éxito/abstención. Medir SLA observado, resolución, reincidencia y devolución madura; costes y contribución solo con cobertura. Devolver a A20 la cohorte y a Mi Camino el resultado o bloqueo.
- **Aceptación:** se distinguen pendiente de maduración, no medible, cambio observado y feedback humano declarado. No se atribuye causalidad o mejora de retención sin un diseño y datos que la sustenten.

### A22-025 · Reducir consultas repetidas y vigilar el trabajo pendiente

- **Evidencia:** las tools reconstruyen ventanas y reconsultan devoluciones ya precargadas; delivery_diagnostics agrega eventos de todo el scope antes de limitar a cincuenta grupos. El sync ya limita veinte fulfillments y sesenta páginas por ciclo y selecciona vencidos justamente, pero no se expone backlog/edad de cobertura al diagnóstico.
- **Mejora:** reutilizar snapshot/caché por digest, filtrar eventos al conjunto de fulfillments pertinente, evitar repetición de tools y paginar con total/truncamiento. Medir backlog, edad del caso más atrasado, tasa de errores/permiso, lag webhook, expiración de leases y coste por evaluación útil; conservar límites/backoff.
- **Aceptación:** más volumen no implica escanear historia no pertinente o pagar el mismo análisis. Un scope con backlog visible no aparece completo; cambios de índices/consultas se justifican con planes y muestras representativas, no con tablas vacías.

### A22-026 · Verificar el recorrido completo, no solo cadenas de fuente

- **Evidencia:** 19/19 tests existentes focalizados pasan; aun así, la consulta GraphQL oficial falla y el helper real produce dos causas falsas. Las reproducciones SQL muestran el gate de treinta casos con una sola ETA y madurez con un día desde entrega. Producción solo presenta runs fallidos en la muestra.
- **Mejora:** fixtures numéricos y de estados reales, validación de esquema GraphQL por versión, tests de snapshot/contrato, JWT/RLS entre dos tiendas y recorrido caso/oportunidad→aprobación→plan/tarea→entregable→ejecución autorizada→medición. Verificar gates de coste, reintentos y eventos fuera de orden sin necesitar un proveedor pagado para las pruebas deterministas.
- **Aceptación:** cubrir cero medido frente a no importado, ETA ausente/modificada, aduanas resueltas/negadas, evento tardío, lectura completa vacía, sample30/denominador1, varios fulfillments/carriers, devolución cancelada/parcial, límite de paginación, webhook concurrente, corte temporal, ruta desconocida y rechazo durable. Una generación real se evalúa después con fuentes conectadas; succeeded no certifica utilidad.

### Contrato de aceptación del valor de A22

Un evento o una cohorte revela un problema con cobertura conocida → A22 distingue caso de patrón y propone un siguiente paso específico → se contrasta capacidad/operativa con A13/A06 y calidad posterior con A20/A21 → Mi Camino aporta objetivo/revisión, cuando proceda → el responsable acepta y ejecuta el trabajo en su flujo autorizado → se registra evidencia de resultado con ventana suficiente → A22, A20 y Mi Camino comparten la misma referencia y el resultado o la razón por la que no es medible.

La comunicación entre agentes debe transmitir encargos y recibos acotados, no conversaciones abiertas con datos del comprador. Conectar esta cadena no significa que A22 pueda publicar, enviar, modificar pedidos o reembolsar sin las autorizaciones del flujo correspondiente.

### Evidencia y límites de esta pasada

- Código examinado: ai-runtime.ts (A22, tools, scope, cron, contexto, aprobación), server.ts, shopify-sync.ts (bulk, eventos, clasificación), shopify-webhook-handler.ts (returns y privacidad), shopify-insights.ts, delivery-store-scope.ts, shopify-delivery-comparison.ts, agent-task-delivery.ts, UI Shopify/cola, contratos de IA y migraciones A22. Se contrastó el mecanismo A20/A21 del worktree como dependencia aún no certificada como desplegada.
- Descubrimiento mediante search_graph, trace_path y get_code_snippet del MCP, contrastado con la fuente local. No se reconstruyó el índice ni se auditó todo el repositorio.
- Datos remotos: TEST y producción, cero fulfillments/eventos/estados de eventos/excepciones/returns/líneas devueltas en la consulta de esta pasada. TEST tiene 10.378 pedidos no test/no cancelados en la muestra global, ninguno con fulfillment_status FULFILLED/PARTIALLY_FULFILLED; no se deduce que la tienda real carezca de entregas. Producción no devuelve pedidos válidos en ese filtro. No se atribuye la ausencia a una causa única de despliegue/permiso/fallback sin comprobar Shopify.
- Ejecuciones A22: TEST, siete runs: seis exitosos (uno v2 y cinco v7) y uno fallido; cuatro v7 son de tienda y uno agregado. Producción, cinco runs fallidos agregados (uno v1 y cuatro v2), sin outputs exitosos en la muestra. TEST registra cinco llamadas no marcadas como error a cada tool de diagnóstico/excepciones/retardo-devolución, dos a fulfillment_health y cuatro a search_knowledge; eso no acredita que hubiera datos.
- Seis definiciones RPC examinadas tienen hashes idénticos entre entornos. Políticas de las seis tablas logísticas/devoluciones basadas solo en organización coinciden en ambos. Las RPC nuevas de incidencias y comparación son solo para service_role; las heredadas delivery_times/return_rate_by_product aún tienen EXECUTE anónimo, con semántica invoker. No se realizó una prueba JWT cruzada ni se afirma una extracción anónima demostrada.
- Pruebas locales: 19/19 en shopify-fulfillment-events.test.ts, shopify-return-webhook.test.ts, shopify-delivery-comparison.test.ts y delivery-store-scope.test.ts. El validador oficial de Shopify resolvió versión 2026-07 y rechazó A22Return con los dos errores detallados en A22-005. Reproducciones sin persistencia: dos falsos positivos del clasificador real; cron A22 devuelve solo agregado; CTE numérica del gate devuelve sample_reliable=true/denominador1/tasa100%; regla de madurez acepta un día desde entrega.
- Fuentes primarias: [Fulfillment y eventos de envío](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/fulfillment), [estado del proceso de devolución](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/ReturnStatus), [estado agregado de devoluciones del pedido](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/OrderReturnStatus). El esquema validado, los snippets y las reproducciones sustentan los hallazgos; no se promete un resultado comercial.
- Entrega de auditoría original: las mejoras se implementan en la pasada A22 descrita a continuación.

### Estado de implementación A22

- Implementado en el worktree A17–A22: alcance estricto por tienda para API, cron y coordinación; panel visible con selector de tienda y estado de cola truncada; contexto de Mi Camino y solicitudes de A20/A21; cobertura de sincronización; corrección de GraphQL de devoluciones con paginación acotada y cantidad procesada; clasificación de mensajes negados/resueltos como desconocidos; bloqueo de comparaciones de devoluciones sin madurez temporal; filtro de tasas tardías con mínimo de 30 entregas medibles; índices y políticas RLS de las tablas logísticas y de devoluciones.
- Migraciones A22 aplicadas en TEST y producción: evidencia/alcance y prompt v8; revocación de ejecución `PUBLIC`/`anon` de `shopify_delivery_times`, conservando `authenticated` y `service_role`; `search_path` fijado a vacío en la función.
- Verificación: esquema GraphQL Admin API 2026-07 validado; typecheck de web y API completado; `git diff --check` limpio salvo avisos normales de LF/CRLF. No se ejecutaron suites de tests ni se desplegó el código de API/web.
- Pendiente para cerrar el contrato integral de la auditoría: adaptador A22 que materialice oportunidades tipadas en el ledger compartido A20/A21 y ate aprobación, tarea, handoffs y resultado con identidad transaccional; snapshot versionado y recibo de completitud/backfill para devoluciones, ETAs y rutas; historia temporal para medir resultados al madurar la cohorte; links de acción y propiedad de cada incidencia; pruebas de recorrido con dos tiendas y JWT/RLS. El diagnóstico de comparación de resultados de devolución queda desactivado hasta que exista evidencia temporal suficiente.
- No se declara completada la auditoría hasta resolver esos pendientes; las mejoras aplicadas no se han desplegado como aplicación.

## A23 · Creatividad y subasta de Meta: diagnóstico, dirección creativa y coordinación

Auditoría del 21 de octubre de 2026. Alcance: fuente actual del repositorio principal, cambios locales presentes en las superficies examinadas y configuración/funciones/datos agregados de TEST y producción. El worktree A17–A22 se contrasta como dependencia de coordinación pendiente de desplegar; no se presume que sus cambios estén ejecutándose en producción. Esta pasada registra mejoras; no implementa cambios del agente.

A23 debe convertir evidencia de anuncios y piezas en decisiones concretas: qué observar, qué investigar y qué variante producir o probar, para qué objetivo y con qué comprobación posterior. Debe aportar dirección creativa a A15/A16 y a los planes de marketing, con la viabilidad económica de A14, la fiabilidad de A24 y los cambios operativos de A25. Mi Camino aporta la meta y el hito vigente. La métrica de un anuncio no demuestra que una imagen, un copy o una variante dinámica causara su resultado.

### Funcionamiento comprobado y límites actuales

| Superficie | Comportamiento observado |
| --- | --- |
| Activación | GET/POST de creatividad-meta; cron por tienda con cadencia declarada diaria y límites globales de ejecución. La lectura de la página consume caché. |
| UI | El módulo Meta ofrece “Creatividad y subasta” dentro de los especialistas del consultor. Existe además un catálogo de creativos local en desarrollo, cuya integración con A23 debe mantenerse explícita. |
| Fuentes principales | Rendimiento de anuncios y distribución del gasto por ranking; la herramienta de investigación añade asignaciones, copies, activos y serie diaria. |
| Evidencia visual | Hasta dos anuncios elegidos por gasto, con imágenes o miniaturas del banco privado. No inspecciona el vídeo completo ni todas las variantes. Reutiliza algunos atributos A15. |
| Seguridad existente | Tienda resuelta sin agregado implícito cuando hay varias; consultas filtradas; MIME/bytes/prefijo privado comprobados; imágenes limitadas; comparación de compras condicionada al veredicto A24; propuestas sujetas a revisión. El juez dispone de congelación de bytes y hashes visuales: no hay que sustituirla por URLs efímeras. |
| Configuración remota | A23 v9 activo en ambos entornos, mismo prompt de 12.117 caracteres y hash MD5 796edc8332e53240d6ff74a176fe622c. La versión declara search_knowledge y meta_creative_diagnostics; el registro común del runtime completa las capacidades autorizadas. |
| Resultado actual | Hay una base útil para diagnosticar anuncios, pero la identidad de la decisión, la coherencia de los informes y la transmisión del trabajo al ecosistema necesitan un contrato común. |

### A23-001 · Unificar la misión y eliminar instrucciones contradictorias del prompt

- **Evidencia:** el prompt v9 conserva en sus primeras secciones órdenes de decidir qué retirar y escalar, hablar con autoridad, atribuir causas según rankings y limitar rationale a 22 palabras. Más adelante añade cautela, prohíbe conclusiones causales y exige decisiones verificables. También pide answer/findings/recommendations aunque el contrato A23 los elimina del esquema enviado al modelo.
- **Mejora:** sustituir las capas acumuladas por una versión canónica coherente con el contrato actual: diagnóstico de anuncio, observación visual, hipótesis creativa, propuesta revisable y medición. Separar la autoridad de A14/A24 y el papel productor de A15/A16.
- **Aceptación:** ejemplos y esquema coinciden; no se ordena simultáneamente escalar y abstenerse; cada resultado explica por qué existe o por qué no hay una acción sustentada.

### A23-002 · Resolver permisos y cuentas elegibles para la tienda exacta

- **Evidencia:** el resolver exige una tienda cuando hay varias, pero el runner y la lectura genéricos usan autorización de organización. La autorización actual rechaza cuentas que solo tienen storeMemberships. Las siete políticas Meta examinadas en TEST siguen basadas en accessible_org_ids. El cron filtra elegibilidad Meta explícita para A14, pero A23 recibe las tiendas activas sin ese filtro específico.
- **Mejora:** compartir un resolver de autorización por tienda y una lista comprobada de cuentas Meta vinculadas, accesibles y sincronizables. Conservar store_id/account_id en lecturas, snapshots y decisiones, con pruebas de las políticas directas y de las rutas service_role.
- **Aceptación:** un usuario autorizado solo para una tienda puede analizarla y no puede leer otra; una tienda sin Meta aparece como pendiente de conexión/configuración y no consume una generación. No se afirma una fuga entre tiendas demostrada: falta la prueba JWT cruzada.

### A23-003 · Añadir un manifiesto verificable de cobertura y frescura de fuentes

- **Evidencia:** metaRpcEvidenceStatus distingue fallo y vacío correctamente, pero no certifica completitud, fechas importadas ni frescura. El aviso de backfill se carga por organización. TEST contiene métricas de anuncios sin creatividades, asignaciones ni fuentes visuales importadas; una consulta correcta no acredita que esas fuentes estén completas.
- **Mejora:** snapshot por tienda/cuenta con as_of, fecha de datos, informes y parámetros usados, importación completa/parcial/fallida, recuentos/totales y límites por fuente. Mantener cero medido, no aplicable, no importado y consulta fallida como estados distintos.
- **Aceptación:** un periodo vacío no se presenta como cuenta sin actividad si falta ingesta; el modelo y la UI conocen qué días, cuentas y representaciones se observaron realmente.

### A23-004 · Usar las mismas filas canónicas en agregado, ranking y serie diaria

- **Evidencia:** las funciones remotas de rendimiento y reparto suman todas las filas ad/none; la serie diaria elige una por fecha con row_number y modo de informe. Una reproducción SQL sin persistencia devuelve gasto 120 frente a 60 e impresiones 2.000 frente a 1.000 con dos informes alternativos del mismo día. TEST no tiene duplicados ad/cuenta/fecha en la muestra actual: es un fallo condicionado por la coexistencia de modos, no una duplicación real ya observada allí.
- **Mejora:** centralizar la selección canónica de informe y reutilizarla en las tres lecturas, incluyendo identidad de cuenta, anuncio, fecha, modo y versión de atribución.
- **Aceptación:** añadir un segundo informe alternativo no duplica gasto, impresiones ni compras; el total agregado reconcilia con las filas de la tendencia para el mismo contrato.

### A23-005 · Conservar disponibilidad y semántica de compras y atribución

- **Evidencia:** rendimiento y tendencia convierten acciones o valores ausentes en cero. El agregado escoge ventanas por métrica/fila y publica una sola etiqueta; la tendencia selecciona una fila y usa otra composición. No se devuelve un recibo de que todos los informes y métricas de compra de ese periodo se importaron.
- **Mejora:** fijar evento canónico, ventana y tiempo de reporte compatibles para compras, valor, CPA y ROAS; devolver cobertura de cada métrica, nulos explicados y posibles cambios de configuración.
- **Aceptación:** una compra no descargada no vale cero; no se mezclan numerador y denominador de contratos distintos ni se etiqueta todo el periodo con una ventana que solo representa parte de sus filas.

### A23-006 · Normalizar ventanas, zona horaria y madurez del resultado

- **Evidencia:** metaSpecialistWindow resta 30 días a la hora actual y envía timestamps a RPC con parámetros date y extremos inclusivos; eso puede cubrir 31 fechas naturales. La atribución visual usa instantes, mientras el drilldown comprueba días completos. La serie admite diferencia de fechas 90 y por tanto hasta 91 fechas inclusivas.
- **Mejora:** definir una única ventana por cuenta y zona horaria, con días completos/abiertos explícitos, extremo final consistente y retraso de atribución indicado. Separar señales recientes de resultados suficientemente maduros.
- **Aceptación:** UI, agregado, diario, asignaciones, caché A24 y criterio de evaluación comparten fechas equivalentes; cambios de día y horario de verano no alteran silenciosamente la comparación.

### A23-007 · Separar formato conocido, métrica de vídeo disponible y muestra útil

- **Evidencia:** has_video se deduce de video_plays no nulo. Una métrica ausente no certifica que el activo sea una imagen. El mínimo de 1.000 impresiones habilita también hold_rate, cuyo denominador real son reproducciones y puede ser muy pequeño.
- **Mejora:** obtener el formato de la identidad creativa y publicar estado de disponibilidad y denominador de cada tasa; separar reproducción iniciada, completitud y otros eventos. Mantener el umbral descriptivo separado de una decisión estadística.
- **Aceptación:** vídeo sin dato no se clasifica como imagen; mil impresiones con una reproducción no sustentan una conclusión de retención; cada porcentaje identifica su denominador.

### A23-008 · Mantener identidad de cuenta y selección compatible con divisas

- **Evidencia:** el SQL de reparto ya separa monedas y el rendimiento devuelve spend_currency. Sin embargo, selectA23VisionAdIds ordena solo el número spend y no usa la divisa. Dos cuentas de una tienda pueden quedar mezcladas en la selección visual, y las filas principales no exponen account_id.
- **Mejora:** propagar cuenta/divisa/grano y seleccionar por cuenta o por moneda; usar conversión solo con cobertura y fecha de cambio verificadas. No sumar gastos ni comparar tamaño económico con monedas desconocidas.
- **Aceptación:** un importe en una divisa no desplaza automáticamente a otro por su valor nominal; toda cifra y decisión económica conserva su cuenta y moneda.

### A23-009 · Fechar los rankings y conservar su interpretación descriptiva

- **Evidencia:** el reparto aplica el último ranking no nulo de cada anuncio al gasto de todo el periodo. El prompt posterior lo matiza, pero las primeras reglas aún equiparan rankings con causas o falta de volumen. La respuesta no identifica cuándo se observó cada veredicto.
- **Mejora:** adjuntar fecha/frescura y alcance del ranking, cobertura por dimensión y una clasificación neutral de UNKNOWN/SIN_VEREDICTO. Evitar convertir ranking de conversión en diagnóstico automático de landing/oferta o causalidad creativa.
- **Aceptación:** la UI explica que es gasto agrupado por una observación de ranking; no afirma que cada euro se entregó bajo ese juicio ni suma porcentajes entre dimensiones.

### A23-010 · Comparar anuncios en contextos de entrega compatibles, incluidos placements de Instagram

- **Evidencia:** el resumen principal carece de desglose por plataforma/placement, formato conocido y objetivo. El drilldown añade objetivo, pero la tendencia no incorpora cambios de A25. La métrica agregada de Meta no permite atribuir un resultado específicamente a Instagram, Stories o Reels.
- **Mejora:** admitir cortes disponibles y verificados por objetivo, formato, plataforma y placement, con fallback explícito cuando la API o la ingesta no los soporten. Usar A25 para señalar cambios de presupuesto, configuración o pieza que invaliden una comparación.
- **Aceptación:** comparar periodos o anuncios exige compatibilidad declarada; una señal agregada no se presenta como conclusión de Instagram ni como rendimiento orgánico. Los desgloses de activos dinámicos solo se usan con soporte real y sus límites.

### A23-011 · Diferenciar historial observado de asignaciones creativas realmente conocidas

- **Evidencia:** la primera asignación usa updated_time del anuncio, que no prueba cuándo se asignó esa creatividad. Los cambios se cierran e insertan en operaciones separadas con la hora de detección. El atribuidor puede declarar single_creative_covers_period apoyándose en esos intervalos inferidos.
- **Mejora:** distinguir observed_at/effective_at y calidad de evidencia temporal; proteger cierre/apertura frente a concurrencia y conservar snapshots de copies/activos con identidad estable. No reconstruir un historial completo desde el estado actual.
- **Aceptación:** un sync tardío o un cambio solo de nombre no prueba cobertura histórica; reintentos no dejan huecos, solapamientos o dos asignaciones abiertas; una atribución exacta requiere un intervalo acreditado.

### A23-012 · Hacer representativa y explícita la muestra visual

- **Evidencia:** se eligen como máximo dos anuncios por gasto. Asignaciones y activos se limitan a 40 y fuentes/imágenes a 16 sin un total completo por cada consulta; el adjunto acaba siendo una imagen por anuncio. El resultado no permite valorar todas las piezas de una cuenta o de un carrusel.
- **Mejora:** selección determinista por problema/hipótesis, divisa, formato y cobertura, con presupuesto configurable; añadir totales, truncamiento y motivo de exclusión. Mantener límites de bytes y Storage privado.
- **Aceptación:** A23 identifica qué anuncios y representaciones inspeccionó, cuáles quedaron fuera y por qué; el diagnóstico de dos imágenes no se convierte en auditoría visual de toda la cuenta.

### A23-013 · Reutilizar A15 vigente y ampliar vídeo/carrusel con evidencia preparada

- **Evidencia:** el cargador copia analysis y analysis_fingerprint, pero no selecciona status ni contrasta la ficha con el fingerprint A15 vigente. A23 adjunta imágenes/miniaturas fijas; no consume una secuencia temporal de fotogramas ni una ficha completa de carrusel. La congelación visual para el juez ya existe y debe preservarse.
- **Mejora:** adaptador de atributos A15 con versión, checksum, estado y representación verificados. Cuando existan fotogramas, slides u otras observaciones procesadas por A15, transmitir referencias y cobertura temporal/posicional acotadas; solicitar preparación si falta evidencia, sin repetir por defecto el análisis visual.
- **Aceptación:** una ficha antigua o pendiente de reanálisis se marca como tal; una miniatura no acredita el primer segundo, audio, ritmo ni montaje; cada observación conserva la representación y la evidencia que el juez puede reproducir.

### A23-014 · Resolver el gate A24 con procedencia, vigencia y alcance compatibles

- **Evidencia:** A23 lee una caché por tienda, versión y fechas exactas; si no existe, usa unknown de forma prudente. A24 precede a A23 en el catálogo, pero la selección global por prioridad/cupo no garantiza que produzca una caché válida antes de cada A23 manual o automático. En ambos entornos hay cero veredictos vigentes en la consulta.
- **Mejora:** resolver el gate determinista para el snapshot seleccionado, compartiendo fuentes y sin lanzar recursivamente una conversación A24. Conservar ID, evaluated_at, expires_at y alcance de cuenta/ad set; mantener unknown si no puede verificarse.
- **Aceptación:** un resultado antiguo, de otro periodo o de otro ámbito no habilita acciones; una cuenta sana no oculta otra no evaluable; la disponibilidad del gate no depende de abrir primero otra tarjeta de UI.

### A23-015 · Aportar viabilidad económica A14 antes de recomendar inversión

- **Evidencia:** el prompt exige contrastar gasto/ROAS y break-even de A14, pero runCreatividadMetaAgent no precarga un snapshot económico A14 ni un contrato específico de margen/objetivo para la oportunidad.
- **Mejora:** entregar un resumen A14 vigente, por cuenta/tienda y moneda, con objetivo, límite económico, cobertura y restricciones; si falta, orientar una investigación o prueba sin inventar un umbral rentable.
- **Aceptación:** ROAS aislado no convierte un anuncio en ganador/perdedor económico; toda recomendación que comprometa inversión identifica la fuente de su criterio y su autorización posterior.

### A23-016 · Vincular cada decisión a evidencia tipada y cerrar la vía paralela de propuestas

- **Evidencia:** creative_decisions exige señal, hipótesis y gate, pero carece de store/account/ad/creative/asset IDs y de referencias tipadas a métricas. La validación bloquea propose_pause con unknown solo dentro de esa lista. Reproducción del contrato real: unknown + creative_decisions vacío + una proposed_write de tarea “Pausar el anuncio por ROAS bajo” se acepta.
- **Mejora:** contrato único que vincule decisión, evidencia, propuesta y entidad; controlar las acciones tipadas tanto en decisiones como en tareas. Validar ventana, baseline, moneda y gasto contra el snapshot del servidor, y explicar una lista vacía.
- **Aceptación:** ningún canal de propuesta elude el gate; IDs/importe/veredicto no se inventan ni elevan. La reproducción demuestra una carencia de esquema, no una pausa real ni un salto demostrado de la aprobación humana.

### A23-017 · Alinear con el objetivo y revisión exactos de Mi Camino

- **Evidencia:** A23 carga fases y tareas, pero no fija un contrato propio de objetivo/revisión vigente. El helper genérico todavía permite el fallback al hito actual para A23, y la rama de playbooks no pasa su storeId como hace A13/A14.
- **Mejora:** transmitir objetivo, plan/version/revisión y hito elegible; justificar la contribución creativa sin forzar vínculo si no existe. Revalidar el snapshot del plan al aceptar la propuesta.
- **Aceptación:** una variante apoya una meta verificable de la tienda; ningún hito se asigna por posición, título parecido o fallback; el conocimiento/playbook de otra tienda no se mezcla.

### A23-018 · Conservar las decisiones al resumir A23 para otros agentes

- **Evidencia:** A23 usa salida lean sin answer/findings/recommendations generados. summarizeSpecialistOutput conserva en su caso genérico esos campos y omite creative_decisions y proposed_writes. La reproducción del helper real con una decisión y tarea aprobadas devuelve solo un resumen genérico, sin ambas.
- **Mejora:** adaptador de resumen A23 acotado con decisiones, identidad/evidencia, gate, estado y referencias de tareas/entregables; distinguir observación de propuesta aún no aprobada.
- **Aceptación:** A14/A19/A17 y el copiloto pueden recuperar el problema y siguiente paso exactos, con procedencia y frescura, sin tener que releer el output completo ni interpretar “una tarea propuesta”.

### A23-019 · Coordinar encargos y entregables con el ecosistema

- **Evidencia:** A23 comparte contexto general, pero no tiene un adaptador de oportunidades/handoffs como el mecanismo A20/A21 del worktree. Un texto que dice coordinar no acredita un encargo recibido ni una pieza entregada.
- **Mejora:** oportunidad creativa tipada con rutas según necesidad: A14 viabilidad, A24 medición, A25 cambios, A15 observaciones, A16/estudio productor correspondiente, A05 calendario y A18/A17/A04 planificación. Incluir campaña, brief, activo, responsables, exclusiones, bloqueos y recibos.
- **Aceptación:** el plan puede encargar una variante, recibir el borrador y someterlo a revisión sin crear trabajo duplicado; no hay recursión abierta entre agentes ni se interpreta un handoff como autorización de gasto.

### A23-020 · Materializar decisiones y tareas con identidad durable

- **Evidencia:** las creative_decisions se muestran separadas de las propuestas; no hay un decision_id que una ambas con la tarea, el brief y el resultado. La materialización genérica depende en parte de títulos y vínculos posteriores.
- **Mejora:** identidad estable por tienda/cuenta/anuncio/episodio/intervención, revisión optimista y transacción para aceptación, tarea, hito y handoffs. Registrar también rechazo, supersesión y reintento.
- **Aceptación:** dos aprobaciones o una reformulación del título no crean dos trabajos; un rechazo se conserva y una propuesta vencida se revalida antes de materializarse.

### A23-021 · Cerrar el ciclo de prueba creativa y aprendizaje

- **Evidencia:** success_criterion es texto libre; falta un ciclo propio que una variante, exposición, baseline, ejecución autorizada, ventana madura y lectura posterior. Completar una tarea no acredita una mejora de ventas ni una creatividad ganadora.
- **Mejora:** brief de experimento con hipótesis, variable, control/comparador, métrica y denominador, evaluación, límites y criterio de parada; registrar entrega y activación por su flujo autorizado. Compartir resultado observado/inconcluso con A14/A19 y los planificadores.
- **Aceptación:** el sistema sabe qué se probó y qué ocurrió sin atribuir causalidad a una comparación observacional; una muestra insuficiente termina como inconclusa, no como éxito.

### A23-022 · Unificar idempotencia, cupos y generación por tienda

- **Evidencia:** el endpoint genérico valida Idempotency-Key, pero su rama A23 pasa runOptions undefined y descarta la clave. A23 no tiene quotaScope por tienda en el runner genérico. El cron usa digest organizativo y no pasa activityDigest a esta rama, aunque decide candidatos con un digest.
- **Mejora:** reserva/lease durable por tienda, cuenta y snapshot; propagar la clave manual y el digest real, con single-flight, recuperación de fallo y cupos coherentes. Detectar cambios relevantes de datos, A15, A24 y plan sin repetir generaciones por actividad ajena.
- **Aceptación:** reintentos, dos pestañas y cron concurrente reutilizan el resultado o la misma generación; una tienda no agota el cupo de otra ni un fallo deja el agente bloqueado indefinidamente.

### A23-023 · Acotar consultas y contexto sin perder evidencia esencial

- **Evidencia:** la consulta principal devuelve todos los anuncios ordenados por gasto; el drilldown llama al rendimiento general y filtra después por anuncio en la consulta envolvente. Se encadenan backfill, lectura visual y gate. A23 no tiene el manifiesto de contexto acotado específico de los agentes ya ampliados en el worktree.
- **Mejora:** límites/paginación con totales, selección previa en SQL, filtro por anuncio/cuenta y plan de consulta medido con EXPLAIN. Paralelizar lecturas independientes y priorizar identidad, cobertura, gate y objetivo en el contexto; mantener límites de coste y resultado.
- **Aceptación:** cuentas grandes no pierden silenciosamente tiendas o evidencias al recortar contexto; el snapshot declara qué quedó fuera y las optimizaciones se verifican con consultas representativas.

### A23-024 · Hacer visible el motivo, alcance y siguiente acción en la UI

- **Evidencia:** A23 aparece en un details de especialistas solo para consultor. Las tarjetas de decisión no tienen IDs para enlazar el anuncio, pieza o propuesta exactos, ni muestran dueño o recibo del trabajo. La página Meta permite un selector temporal mientras A23 se fija en 30 días.
- **Mejora:** mostrar fecha/ventana, cuenta/tienda, cobertura y muestra visual, gate, responsable y acción pendiente; enlazar con el anuncio, catálogo/banco, brief, tarea y prueba. Explicar qué hace el cron, cuándo se actualizó y por qué no se puede decidir.
- **Aceptación:** cambiar tienda descarta la lectura anterior; el usuario distingue una propuesta de un cambio ya ejecutado, y una ventana del panel distinta de la analizada por A23. No se dispara gasto de IA por abrir una página.

### A23-025 · Verificar el comportamiento y el recorrido completo

- **Evidencia:** las seis suites focalizadas ejecutadas dieron 20 pruebas correctas y una fallida. El fallo es un assert de texto en a23-daily-trend-contract.test.ts que aún espera una implementación antigua de imported_representation tras los cambios A15. Varias comprobaciones de SQL son regex/parser, no ejecución numérica. Las reproducciones del contrato y del resumen detectaron vacíos que esas pruebas no cubren.
- **Mejora:** probar comportamiento con informes alternativos, nulos frente a ceros, monedas, días completos, asignaciones observadas, activos múltiples, gate vencido y propuestas contradictorias; JWT/RLS con dos tiendas y aceptación→brief→entrega→ejecución autorizada→medición. Añadir manifiesto de release que contraste app, esquema, contrato y prompt.
- **Aceptación:** CI comprueba resultados e invariantes y conserva pruebas de privacidad/bytes; no se declara valor comercial por status succeeded. Una ejecución real con fuentes conectadas valida después la utilidad, sin que la auditoría envíe campañas ni cambie inversión.

### Evidencia y límites de la auditoría A23

- Descubrimiento con search_graph/trace_path/get_code_snippet del MCP y contraste local. Los snippets del grafo tenían offsets desactualizados y devolvían código ajeno al símbolo; se usó la fuente actual como evidencia. No se reconstruyó el índice ni se auditó todo el repositorio.
- Código examinado: ai-runtime.ts (runner A23, herramientas, cache A24, selección visual, contexto, cron y aprobación), server.ts, meta-sync.ts, meta-creative-vision.ts, meta-diagnostic-evidence.ts, meta-measurement-verdict.ts, marketing-store-scope.ts, auth-context.ts, agent-task-delivery.ts, consultant-specialist-context.ts, contrato packages/ai y UI Meta/decisiones/catálogo.
- TEST: 14 runs exitosos, uno v2 agregado y trece v9 por tienda; los v9 observados son del 13 de octubre. Catorce outputs pending_approval, trece con creative_decisions y uno con proposed_writes. Herramienta de drilldown: seis llamadas no marcadas como error y cuatro con error; ocho búsquedas de conocimiento no marcadas como error. Esas cifras no certifican calidad o disponibilidad de todas las fuentes.
- TEST: tres anuncios, 1.149 filas diarias ad/none, cero creatividades, activos, asignaciones y enlaces visuales Meta en la consulta; métricas desde 2025-10-04 hasta 2026-10-21, un modo de atribución y uno de tiempo de reporte, ninguna fila con métrica de reproducciones. No hay duplicados ad/cuenta/fecha actualmente. No se infiere que no existan vídeos o creatividades en la cuenta real del proveedor.
- Producción: cero runs A23 y cero filas en las fuentes Meta contadas. Ambos entornos: cero veredictos A24 vigentes en la consulta. No se atribuye la ausencia a permisos, despliegue, conexión o sincronización sin comprobar cada causa.
- Las cuatro funciones remotas de rendimiento, ranking, drilldown y tendencia tienen hashes iguales en TEST/producción. Drilldown/tendencia son invoker y solo service_role; rendimiento/ranking son invoker con authenticated/service_role y sin EXECUTE anon/PUBLIC en las ACL consultadas. No se realizó prueba JWT cruzada.
- Reproducciones sin persistencia: agregado 120 frente a diario canónico 60 para dos informes alternativos de un día; contrato A23 acepta tarea genérica de pausa con gate unknown y decisiones vacías; resumen de especialista omite la decisión y la tarea A23 incluso con output aprobado. Son fallos concretos de coherencia/contrato, no acciones ejecutadas.
- Pruebas: 21 ejecutadas, 20 correctas y una fallida por assert de fuente desactualizado; no se corrigió software durante esta auditoría. No hubo generación pagada de A23, escrituras remotas, migraciones, despliegue, publicación, mensajes ni cambios de presupuesto.
- Referencia primaria consultada: [campos y desgloses en el SDK oficial de Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py). Incluye las identidades de rankings, métricas de vídeo y desgloses; su existencia en el SDK no garantiza acceso, compatibilidad entre cortes o disponibilidad en una cuenta. Las páginas directas de Insights/Breakdowns respondieron 429 y la ayuda de rankings exigió login: no se usan como evidencia de reglas del proveedor verificadas en esta pasada.

### Implementación A23 (21 de octubre de 2026)

Se implementaron las mejoras A23-001 a A23-024 en el código y se preparó la migración `20270106110000_a23_creative_full_evidence_and_coordination.sql`: prompt canónico v10, snapshot de evidencia/ledger de decisiones, consultas canónicas y ventanas de atribución compatibles, permisos por tienda, selección visual acotada por divisa, frescura A15, gate A24 y contexto A14/A25/Mi Camino, coordinación entre especialistas, resumen consultable, contrato de experimento, idempotencia/cuotas, materialización atómica de tarea e hito, y claridad de ventana/cobertura en UI.

La migración queda aplicada y verificada en TEST y producción antes de marcar este cierre. Typecheck y build de `packages/ai`, typecheck de API y web, y `git diff --check` se ejecutaron; no se ejecutaron tests ni se desplegó la aplicación. La consulta visual declara límites de muestreo; la comparación de placements sigue limitada a los desgloses que estén importados y soportados por la fuente, sin atribuir resultados a Instagram orgánico.

## A24 · Medición y entrega de Meta: fiabilidad, restricciones y coordinación

Auditoría del 21 de octubre de 2026. Alcance: fuente actual del repositorio principal, dependencias de A14/A23/A25, funciones y configuración consultadas en TEST y producción. El diagnóstico de abajo documenta el estado previo a la implementación; su estado actualizado se registra a continuación.

### Estado de implementación A24 · 21 de octubre de 2026

Las migraciones A24 de integridad (`20270107120000`), capacidades/paginación (`20270108120000`), tipos de Mi Camino/tarea (`20270108120100`, `20270108120200`) y promoción serializada (`20270108120300`) están aplicadas y verificadas en TEST y producción. A24 queda en prompt/versión v10 y evaluación `a24-measurement-v4`.

- **Implementado:** parser de estadísticas Pixel para payload agregado `{ start_time, data }`, fallo seguro al importar formas no interpretables y recibo de sincronización por Pixel; sustitución atómica de snapshots de estadísticas/incidencias; cobertura completa reciente de incidencias; comparación de entidades con gasto, continuidad del evento y elegibilidad del píxel usado; evaluación determinista accesible por GET; caché versionada con fingerprint, expiración e invalidación tras sync Meta; reserva manual con idempotencia/cuota por tienda; ventana de días completos consistente; contexto de cron; tareas sujetas a la revisión exacta de Mi Camino con materialización atómica; registro durable de incidencias; resumen compartido con estado, vigencia, limitaciones y entrega; tarjeta A24 en la interfaz y contrato v9 con herramientas de lectura.
- **Continuación implementada:** matriz explícita de capacidades Pixel/CAPI; campos no observables requieren evidencia autorizada en Events Manager; aplicabilidad para destinos APP/mensajería; contrato de cobertura Shopify reutilizado con el motor de medición, conservando calidad y causalidad desconocidas; planos de medición, entrega y aprendizaje; paginación por UUID para conjuntos/incidencias con totales, identidades y límite de trabajo explícitos; contexto compacto sin multiplicar agregados Shopify por conjunto; filas canónicas de A23; rechazo de caché anterior a un sync; cierre/reapertura de incidencias solo con una evaluación corriente, también desde GET. La prueba remota detectó y corrigió los tipos del estado de hito y prioridad del RPC A24. La promoción de versiones se reconcilió mediante `promote_agent_version`.
- **Verificación:** 31/31 pruebas focalizadas y 4/4 pruebas remotas en TEST: 201 conjuntos, paginación sin duplicados, aislamiento entre tiendas/organizaciones, dos JWT reales sin acceso a RPC/recibos privados, tarea atómica/replay, cierre/reapertura y rechazo de caché anterior al sync. Fixtures SQL revertidos por transacción y usuarios de Auth eliminados. Typechecks API/web/AI correctos; RLS coverage correcto (350/350 tablas). Guard del contrato SQL final y suite A24 añadidos al CI. `npm run verify` sigue señalando migraciones de otros agentes y tres suites ajenas fuera del manifiesto; no se declara CI completo verde. No se ejecutó la suite completa ni se desplegó la aplicación.
- **Límites de evidencia:** la matriz no afirma ingesta de deduplicación, coincidencia, valor/divisa ni aislamiento de dominio que estas fuentes no acreditan. No se enviaron eventos a Meta ni se certificó CAPI con una cuenta real. Se comprobó paginación con datos sintéticos; no se afirma mejora de latencia con volumen de producción sin medirla. Esos límites del proveedor están expresados en la evaluación, en lugar de convertirse en señales sanas inventadas.
- **Entornos:** se consultó el historial de migraciones, versión de A24, RLS/ACL y firmas de RPC en TEST y producción tras aplicar la migración. No se realizaron llamadas a cuentas Meta, generación pagada ni cambios en campañas o presupuestos.

A24 debe responder qué señales pueden utilizarse, para qué entidad y decisión, con qué cobertura y hasta cuándo. Su salida debe distinguir fiabilidad de medición, limitaciones de atribución, incidencias de entrega y aprendizaje. A14 decide viabilidad económica; A23 dirige las pruebas creativas; A25 aporta cambios. Mi Camino aporta objetivo e hitos, sin convertir una restricción técnica en autorización para invertir o publicar.

### Funcionamiento comprobado y límites

| Superficie | Evidencia actual |
| --- | --- |
| Activación | GET/POST de `/ai/medicion-meta`; cron por tienda. GET lee la salida almacenada. La generación manual y el cron pasan por el runner genérico y sus controles de proveedor, activación y presupuesto. |
| Fuentes | `meta_pixel_health`, `meta_learning_phase_status`, `meta_scoped_review_issues`, `meta_optimization_event_health`; sesiones/pedidos Shopify dentro del mapeo; tareas y Mi Camino. |
| Veredicto | `buildMetaMeasurementVerdict`, versión `a24-measurement-v2`, cuatro estados; caché privada por organización/tienda/fechas con TTL de 24 horas. A14/A23/A25 la consumen. |
| Configuración remota | A24 v8 activo en ambos entornos; mismo prompt de 10.381 caracteres y MD5 `68798a5fe4b2494cfcfbea8fd2c1038a`. Declara `search_knowledge`; el runtime añade `propose_capability`. No declara herramientas Meta de investigación. |
| TEST | Tres ejecuciones A24, dos exitosas; última ejecución el 13 de octubre. Dos outputs pendientes de aprobación. Una fila de caché, caducada. Cero píxeles, estadísticas e incidencias sincronizados; tres conjuntos. |
| Producción | Una ejecución A24, sin éxito, del 9 de septiembre. Cero filas de caché y cero filas en las fuentes Meta contadas. No se atribuye esa ausencia a una causa no comprobada. |
| Protección existente | El veredicto desconocido no se eleva automáticamente a utilizable; caché con RLS y acceso de servicio; store scope explícito en RPC/runs; gate A23 estructurado; aprobación humana de tareas. |
| Limitación principal | Hay divergencia real entre el contrato SQL desplegado y el gate; además, el código local usa claves temporales diferentes al guardar y al consumir el veredicto. Las pruebas existentes no detectan estas regresiones. |

### A24-001 · Restaurar el contrato SQL vigente de aprendizaje y protegerlo frente a migraciones posteriores

- **Evidencia:** la migración `20261115560000_a24_learning_activity_semantics.sql` define la función de cuatro argumentos con `activity_sync_state`, `account_last_synced_at`, procedencia del umbral y cobertura. `20261123000000_meta_campaign_detail.sql` la elimina y crea una firma de cinco argumentos con el último opcional que vuelve a `last_significant_change` y carece de esos campos. Esta última definición está en TEST y producción, con el mismo hash `684dfe5777d228bb81db92937378bd1f`. El gate exige los campos eliminados: la reproducción con esa forma devuelve `unknown` aunque el resto del fixture sea fresco.
- **Mejora:** una definición canónica compatible con el detalle de campaña y A24, firmas sin ambigüedad, validación de respuesta al entrar al runtime y guardias sobre el estado final de todas las migraciones. Conservar la separación entre aprendizaje oficial y actividad observada.
- **Aceptación:** la RPC desplegada devuelve la cobertura/frescura que consume el gate; un log genérico no se presenta como reinicio de aprendizaje. La migración completa desde cero y la actualización de una base existente terminan con el mismo contrato y ACL.

### A24-002 · Unificar fechas de consulta, caché, consumidores y UI

- **Evidencia:** `metaSpecialistWindow` ya construye 30 fechas completas hasta ayer. A24 sigue usando `now` como extremo del run y de `saveMetaMeasurementVerdict`, mientras sus RPC terminan en ayer. A14/A23 buscan la clave con final ayer; el A24 local guardaría final hoy. Es un fallo comprobado en la fuente local; no se afirma haberlo ejecutado en producción.
- **Mejora:** contrato único de ventana, con fechas inclusivas para RPC, extremo temporal equivalente, zona de la cuenta, día abierto/cerrado y madurez de atribución. Guardar y leer exactamente esa identidad.
- **Aceptación:** en una evaluación el 21 de octubre, los días completos consultados y la clave del gate coinciden en todos los lectores. Cruces de medianoche y horario de verano no añaden un día ni hacen desaparecer un veredicto válido.

### A24-003 · Leer el contrato real de estadísticas del píxel y hacer fallar una importación ilegible

- **Evidencia:** `parseMetaPixelStats` admite mapas `value` y filas planas, pero no el objeto `AdsPixelStatsResult` con `aggregation`, `start_time` y `data: list<AdsPixelStats>` descrito por el SDK oficial. La reproducción de esa forma con un evento devuelve `[]`. `syncAdAccountPixels` solo registra un error de forma y continúa; ya actualizó `pixel.last_synced_at`. No hay un payload real disponible en estos entornos para certificar la variante usada por sus cuentas.
- **Mejora:** normalizador versionado de las formas verificadas, validación de fecha/evento/recuento y recibo de filas recibidas/interpretadas/rechazadas. Si llegan datos no interpretables, marcar ese bloque como fallido o parcial y conservar el último dato válido con su antigüedad.
- **Aceptación:** un evento dentro de `data` llega al modelo de datos; una respuesta desconocida no se convierte en importación exitosa sin eventos ni renueva la frescura de las estadísticas anteriores.

### A24-004 · Acreditar cobertura y frescura por bloque de sincronización

- **Evidencia:** la frescura del gate usa fechas del registro de cuenta/píxel y estados de actividad/incidencias, sin un recibo de importación completa de estadísticas y del periodo exacto. El perfil del píxel se actualiza antes de consultar sus estadísticas; el perfil de cuenta se sincroniza como bloque independiente. Una lista vacía de incidencias no permite comprobar por sí sola la frescura de ese bloque.
- **Mejora:** manifiesto por cuenta, fuente, ventana y versión de informe que conserve estado, última ejecución completa, errores posteriores, cobertura temporal y recuentos. Distinguir catálogo fresco, estadísticas frescas, fuente vacía verificada, permisos insuficientes y lectura parcial.
- **Aceptación:** el éxito del catálogo no certifica eventos ni insights. Un fallo reciente o una fuente no importada impide interpretar ceros como ausencia observada y explica qué sincronización falta.

### A24-005 · Resolver eventos promocionados con nombres canónicos y aplicabilidad por destino

- **Evidencia:** el SQL compara `lower(btrim(custom_event_type))` con el nombre del evento. La reproducción SQL hace coincidir `PURCHASE`/`Purchase`, pero no `ADD_TO_CART`/`AddToCart`, `INITIATED_CHECKOUT`/`InitiateCheckout` ni `CONTENT_VIEW`/`ViewContent`. `custom_event_str` no participa; una conversión personalizada se declara no resuelta. Los conjuntos sin píxel se tratan como hueco de mapeo sin un estado explícito de no aplicable para otros destinos.
- **Mejora:** tabla/versionado de equivalencias verificadas, evento personalizado y conversión personalizada con procedencia, y aplicabilidad explícita para web, app, formularios, mensajes u otros destinos soportados. No adivinar Purchase desde el objetivo.
- **Aceptación:** eventos estándar equivalentes no producen falsos huecos; un destino que no requiere píxel no se diagnostica como píxel roto. Los vínculos no verificables permanecen desconocidos.

### A24-006 · Reconciliar todas las entidades con gasto antes de emitir un estado utilizable

- **Evidencia:** el gate filtra las filas de mapeo y comprueba que sus filas con gasto estén observadas; no contrasta sus identidades con todos los conjuntos con gasto de `learning`. La reproducción con dos conjuntos con gasto y un solo mapeo observado sigue dando `usable_with_attribution_limits`. `eligible_ad_set_count` es el total del SQL repetido por fila y se usa como si acreditara elegibilidad individual.
- **Mejora:** snapshot con cuentas/conjuntos esperados, identidades y conjuntos cubiertos/faltantes, elegibilidad individual y cobertura de gasto por moneda. La completitud debe derivarse de esos identificadores y del recibo de ingesta.
- **Aceptación:** faltar un conjunto o cuenta con gasto produce cobertura parcial y restricciones explícitas. Ningún recuento agregado sustituye una comprobación de entidades.

### A24-007 · Separar observación histórica de continuidad y salud reciente

- **Evidencia:** basta `mapped_event_observed` y una fecha reciente de sync; el gate no evalúa `matched_event_last_date`. Un evento observado al comienzo de la ventana de 30 días y ninguna observación posterior aún permite el estado utilizable en la reproducción. El píxel agregado puede además recibir eventos de varios dominios/tiendas sin que el SQL acredite el origen de la tienda elegida.
- **Mejora:** evaluar continuidad reciente, días con cobertura confirmada, última observación, cambios de configuración y actividad comparable; separar señal histórica de salud actual y declarar si el origen/dominio está aislado. Respetar baja frecuencia y retraso de reporting.
- **Aceptación:** un evento antiguo no demuestra continuidad actual; una señal de otro dominio no certifica esta tienda. La falta de compras sin tráfico o muestra útil se mantiene como no evaluable/desconocida.

### A24-008 · Separar medición, entrega y aprendizaje, con restricciones por entidad

- **Evidencia:** cualquier píxel `is_unavailable` del bloque restringe toda la tienda, aunque no esté vinculado al conjunto con gasto; esto se reproduce con un segundo píxel no utilizado. Un rechazo fresco también restringe el mismo estado de medición. Un log de actividad desconocido de una fila sin gasto puede hacer globalmente desconocido el gate.
- **Mejora:** resultados independientes de disponibilidad de señales, atribución, entrega y aprendizaje; restricciones por cuenta/conjunto/evento y agregación explícita. A14/A23 deben recibir qué métricas/acciones quedan limitadas, conservando diagnóstico descriptivo permitido.
- **Aceptación:** un anuncio rechazado no implica por sí mismo que todas las compras estén mal medidas; una entidad ajena no bloquea una cuenta verificada ni una cuenta sana oculta otra sin cobertura.

### A24-009 · Compartir filas canónicas y semántica monetaria con los demás especialistas

- **Evidencia:** el mapeo de A24 suma filas ad/none directamente; la función de aprendizaje desplegada suma también acciones/valores de las ventanas recibidas y fuerza ausencias a cero. No usa la selección canónica incorporada a A23. El resultado de aprendizaje incluye gasto/presupuesto/ROAS sin identidad de moneda en su contrato desplegado.
- **Mejora:** reutilizar selección canónica de informe, evento y ventana de atribución, con nulos y cobertura por métrica. Incluir cuenta/divisa y no sumar monedas incompatibles; no presentar CPA como CAC ni atribución como incrementalidad.
- **Aceptación:** informes alternativos no duplican gasto/conversiones; las cifras reconcilian con el mismo grano de A14/A23 y una compra no importada no se convierte en cero.

### A24-010 · Consultar las incidencias actuales con una semántica de snapshot

- **Evidencia:** `syncAdIssues` reemplaza las incidencias actuales y pone `detected_at` a la hora del sync. `meta_scoped_review_issues` filtra esa fecha por el periodo de rendimiento. Con el periodo completo terminado ayer, una incidencia sincronizada hoy queda excluida; la reproducción SQL devuelve cero filas para una incidencia actual. El reemplazo hace delete e insert separados.
- **Mejora:** distinguir estado actual y hechos históricos: evaluar el snapshot vigente para entrega, conservar primera/última observación y resolución, y reemplazar el snapshot de cada cuenta de forma atómica tras una lectura completa.
- **Aceptación:** el rechazo actual se ve aunque el rendimiento termine ayer; un fallo entre borrado e inserción no genera una cuenta falsamente libre de incidencias y una incidencia resuelta conserva su historia.

### A24-011 · Clasificar revisión con estados fuente y cobertura propia

- **Evidencia:** `review_category` se deriva por regex de `issues_info.level/error_type`. El estado efectivo y `review_feedback` no determinan la categoría; este último se sincroniza en el anuncio pero no aparece en la RPC. La frescura usa el perfil de cuenta, con corte de 24 horas, mientras otras fuentes usan 48 horas; la clasificación SQL tampoco rechaza fechas futuras del perfil.
- **Mejora:** categorías fundamentadas en estados y feedback oficiales, conservando motivo, alcance, incertidumbre y fecha de la fuente. Usar el recibo del bloque `issues` y reglas temporales consistentes; contar y paginar sin equiparar una página llena a inventario total.
- **Aceptación:** una advertencia o una frase ambigua no se transforma en rechazo. Rechazado, limitado, pendiente, resuelto y desconocido tienen acciones de comprobación distintas y reproducibles.

### A24-012 · Aplicar permisos de tienda y cuentas elegibles en todas las superficies

- **Evidencia:** runner y GET genéricos de A24 usan `requireMembership`, mientras A23 ya dispone de autorización operacional por tienda. El cron solo filtra elegibilidad Meta para A14/A23. Las RPC de A24 aceptan cuentas de la tienda sin exigir selección/actividad. En TEST las políticas examinadas son organizativas; `meta_pixel_health` y la función de aprendizaje desplegada conservan EXECUTE de PUBLIC/anon. Son invoker: esa ACL no demuestra una fuga por sí sola.
- **Mejora:** resolver único de usuario/organización/tienda, cuentas seleccionadas y conectadas, más restricciones equivalentes en RPC y RLS. Revisar grants de funciones según sus consumidores legítimos y contemplar miembros autorizados exclusivamente a una tienda.
- **Aceptación:** un usuario de tienda no lee ni acciona otra; una tienda sin Meta no consume generación. Probar JWT/RLS cruzados antes de afirmar aislamiento integral; mantener fail-closed ante errores de autorización.

### A24-013 · Versionar y validar el veredicto con procedencia, vencimiento e invalidación

- **Evidencia:** la caché hace upsert por tienda/fechas/versión y vence a las 24 horas de evaluación; no conserva en su identidad cuentas, entidades esperadas, hashes de fuentes ni run/snapshot. El lector comprueba `expires_at > now`, pero no `evaluated_at <= now`, consistencia interna del JSON o que la selección de cuentas siga igual. Una fuente casi caducada puede recibir otras 24 horas de uso.
- **Mejora:** evidencia inmutable con versión/hash y procedencia, validación tipada, TTL limitado por la fuente que venza primero e invalidación tras cambio de cuenta, evento, conexión, sync fallido o versión. Evitar que una evaluación antigua termine sobrescribiendo una más reciente.
- **Aceptación:** un estado futuro, malformado, de otra selección o con fuentes vencidas no habilita decisiones. El cliente puede explicar qué evaluación lo produjo y hasta qué instante es aplicable.

### A24-014 · Hacer disponible el gate determinista sin depender de una generación LLM

- **Evidencia:** el cálculo de A24 se ejecuta dentro de `runGenericDiagnosticAgent`, después de comprobar proveedor, agente habilitado y presupuestos. Si eso bloquea, el gate no se renueva aunque las fuentes existan. El orden del array del cron coloca A24 primero, pero luego hay prioridad global, cupos y pendientes sin revisar: no garantiza una evaluación antes de cada lector.
- **Mejora:** servicio determinista de medición reutilizable desde sync/lectura/planificador, con caché y exclusión concurrente; el LLM explica y propone la reparación usando el resultado ya calculado. Los lectores resuelven la evidencia compatible sin invocar una conversación recursiva A24.
- **Aceptación:** A14/A23/A25 acceden a la evaluación barata vigente o a un desconocido justificado. Un presupuesto LLM agotado o una propuesta sin revisar no congela la evaluación técnica de la tienda.

### A24-015 · Sustituir el prompt acumulado por una misión coherente

- **Evidencia:** v8 conserva órdenes iniciales de tratar el píxel sin estadísticas como el caso más grave, invalidar ROAS por compras ausentes y diagnosticar un bucle de aprendizaje desde `last_significant_change`; las secciones posteriores corrigen esas mismas órdenes. Pide una primera frase de diagnóstico, hallazgos y recomendaciones, pero el contrato lean de A24 elimina esos campos de la petición al modelo.
- **Mejora:** prompt canónico que coincida con fuentes y esquema vigentes: evaluación determinista, explicación de restricciones, comprobaciones técnicas y propuestas revisables. Retirar reglas reemplazadas, causalidad no acreditada y el límite arbitrario de 22 palabras.
- **Aceptación:** los ejemplos no convierten ausencia en rotura ni un cambio genérico en reinicio de aprendizaje; la salida solicitada existe en el esquema y puede explicar por qué no se propone actuar.

### A24-016 · Publicar una evaluación tipada fijada por el servidor

- **Evidencia:** el gate se guarda en caché/contexto, pero `agent_outputs` persiste `turn.output` genérico, sin un bloque A24 obligatorio. GET devuelve ese output; la UI no tiene un campo de evaluación A24. `buildLeanOutputContract` puede completar answer/findings/recommendations con valores genéricos, por lo que una respuesta válida no equivale a un diagnóstico de fiabilidad. No hay un vínculo tipado entre restricción, entidad y propuesta.
- **Mejora:** salida `measurement_assessment` con restricciones, cobertura, entidades, procedencia, vencimiento y explicación del servidor; las observaciones del modelo y propuestas enlazan esa evidencia. Validar acciones según su tipo: investigación/reparación posible con unknown, decisiones de inversión sujetas a A14 y su gate.
- **Aceptación:** ninguna frase o tarea puede elevar la evaluación técnica; el mismo estado aparece en API, UI y consumidores. Una lista vacía de tareas conserva un diagnóstico útil y verificable.

### A24-017 · Dar herramientas de investigación acotadas a las incidencias

- **Evidencia:** la versión activa solo declara `search_knowledge`; el runtime añade `propose_capability`. Aunque existe `meta_delivery_health` en el registro, A24 no la tiene autorizada y depende de cuatro bloques precargados sin drilldown por incidencia/evento.
- **Mejora:** lecturas específicas por cuenta/conjunto/píxel/evento, recibos de sync, definición del evento, serie y detalle de la incidencia, con límites, permiso por tienda y procedencia. Declarar capacidades no disponibles y no repetir bloques completos para investigar una sola entidad.
- **Aceptación:** A24 puede explicar qué dato falta y recuperar la evidencia de una incidencia concreta; ninguna herramienta permite ampliar tienda, editar campañas, instalar tracking ni enviar eventos reales sin su flujo autorizado.

### A24-018 · Ampliar la evidencia Pixel/CAPI cuando la fuente lo permita

- **Evidencia:** el sync solicita agregación `event` y guarda fecha/evento/recuento. El esquema no conserva origen navegador/servidor, procesamiento, dominio, deduplicación ni evidencia de parámetros de evento; `enable_automatic_matching` y cookie están en el catálogo pero no prueban calidad de coincidencia. El SDK oficial enumera otras agregaciones y parámetros; su existencia no acredita permisos ni semántica disponible en una cuenta.
- **Mejora:** matriz de capacidades por fuente/permiso, ingesta verificada de cortes admitidos y recibos de validación. Aislar el dominio de la tienda cuando sea posible, comprobar evento/valor/divisa y marcar explícitamente lo que solo puede verificarse en Events Manager o mediante evidencia autorizada. Conservar minimización de datos personales.
- **Aceptación:** el agente diferencia señal observada de calidad de coincidencia/deduplicación probada. Un campo desconocido no se inventa; una señal de otro dominio o un agregado no acredita el checkout de esta tienda.

### A24-019 · Conciliar con Shopify y el motor existente de medición sin duplicar autoridades

- **Evidencia:** el mapeo ya aporta sesiones/pedidos y su disponibilidad, pero el gate no usa esa actividad para diferenciar muestra insuficiente de una discontinuidad con actividad comparable. Existe `measurement-experimentation-engine.ts` y su contrato de recuperación/calidad/experimentación; no hay en el flujo A24 examinado un adaptador explícito que reconcilie ambos resultados.
- **Mejora:** contrato compartido por tienda para actividad observada, cobertura, definiciones de métrica y limitaciones. Usar conciliación temporal y por ámbito para investigar discrepancias; conectar reparación y prueba con el motor existente, sin crear otra verdad de calidad.
- **Aceptación:** las diferencias de consentimiento, zona, atribución, periodo y madurez se explican; no se exige igualdad 1:1 ni se deduce qué ventas causó Meta. El mismo problema técnico no genera dos reparaciones incompatibles.

### A24-020 · Asociar tareas a la versión exacta de Mi Camino y materializarlas juntas

- **Evidencia:** A24 carga el plan, pero sus propuestas usan el contrato genérico. `shouldFallbackToCurrentMilestone` aún permite fallback para A24. Las guardias de plan/version/milestone y el RPC atómico incorporados a A13/A14/A23 no incluyen A24. Los playbooks genéricos tampoco reciben `storeId` para A24.
- **Mejora:** identidad exacta de plan/revisión/hito cuando corresponda, justificación de la contribución, propietario técnico, evidencia y comprobación de cierre. Revalidar al aprobar y crear tarea/vínculo/incidencia de manera atómica; permitir tarea libre cuando no haya plan aplicable.
- **Aceptación:** ningún hito se elige por posición o título parecido; un Camino modificado obliga a revisar la propuesta. Un fallo de vínculo no deja una tarea parcialmente materializada ni conocimiento de otra tienda mezclado.

### A24-021 · Coordinar la reparación y acreditar su cierre con el ecosistema

- **Evidencia:** las tareas son genéricas y no hay en A24 un registro propio de incidencia que una evaluación, propuesta, aprobación, reparación, nueva evaluación y consumidores. Marcar una tarea como completada no demuestra que el evento volvió ni que el gate cambió.
- **Mejora:** incidencia durable por entidad/causa/episodio con rutas a A25 para cambios, A14/A23 para restricciones y A04/A17/A18 para capacidad/plazo. Reutilizar mecanismos existentes de entregables/handoffs; guardar recibo de reparación y reevaluación, también rechazo, supersesión y reapertura.
- **Aceptación:** una incidencia no crea trabajo duplicado en cada ciclo; la restricción solo se levanta por evidencia nueva verificada y el planificador conoce qué trabajo técnico bloquea una campaña o prueba.

### A24-022 · Conservar la evaluación y su caducidad en los resúmenes compartidos

- **Evidencia:** el resumen genérico de A24 conserva answer/findings/recommendations/warnings, omite evaluación y propuestas, y asigna una frescura de 30 días. La reproducción con un output aprobado descarta el estado y la tarea, y lo presenta utilizable como contexto hasta el 19 de noviembre para un run del 20 de octubre; el gate técnico dura 24 horas.
- **Mejora:** adaptador A24 acotado con evaluación, restricciones, IDs, evidencia, acciones y estado de entrega. Distinguir memoria histórica de un permiso técnico vigente; las decisiones nuevas resuelven siempre el gate actual.
- **Aceptación:** planificadores/copilotos recuperan el bloqueo y siguiente paso exactos, pero una evaluación antigua no autoriza inversión ni invalida la medición actual por 30 días.

### A24-023 · Completar idempotencia, cuotas, digest y recuperación por tienda

- **Evidencia:** el POST valida `Idempotency-Key` pero pasa `undefined` como runOptions a A24. A24 no usa la reserva atómica ni `quotaScope` por tienda del runner; el cron usa digest organizativo y no pasa `activityDigest` a esta rama. La cadencia y el bloqueo por salida pendiente pueden frenar una reevaluación necesaria.
- **Mejora:** reserva/lease de generación por tienda y snapshot, propagación de clave y digest real de cuentas/eventos/fuentes, replay, recuperación de fallos y cuotas coherentes. Separar la reevaluación determinista de la regeneración del texto y del estado de revisión de tareas.
- **Aceptación:** dos pestañas, un reintento y el cron no duplican gasto ni reparaciones; la actividad de otra tienda no consume su cupo y un cambio técnico relevante invalida la evidencia antigua.

### A24-024 · Mostrar una única evaluación comprensible y accionable en la UI

- **Evidencia:** A24 está dentro del desplegable de especialistas visible al consultor, con `days={30}`, mientras el panel permite otras ventanas. La tarjeta usa la UI genérica, carece de evaluación determinista propia y no explica su TTL, cobertura o bloqueo. El prompt espera áreas `aprendizaje`, pero la configuración de enlaces de esta tarjeta solo incluye `medicion` y `general`.
- **Mejora:** vista de medición con estado/razones, fechas de datos y evaluación, tienda/cuenta/evento, cobertura, límites y próximo paso/responsable. Unir tarjeta, trust strip y bloques de datos a la misma fuente; explicar cron/actualización y enlazar entidad, evidencia, tarea y revisión. Definir qué resumen ve el cliente y qué detalle técnico el consultor.
- **Aceptación:** se distingue una fuente no conectada de medición restringida; cambiar tienda elimina la lectura anterior, una ventana del panel distinta se explica y abrir la página conserva el comportamiento de lectura sin generación pagada.

### A24-025 · Acotar consultas y contexto con cobertura explícita

- **Evidencia:** mapeo limitado a 100 conjuntos e incidencias a 30; píxeles/eventos y aprendizaje no comparten una paginación/manifest de totales. El mapeo repite las mismas sesiones, pedidos y metadatos por conjunto. Se precargan cuatro fuentes en paralelo, pero el resto del contexto compartido puede crecer y los playbooks de A24 no están acotados específicamente para su misión.
- **Mejora:** resumen de cobertura separado del detalle, paginación por cuenta/entidad, selección previa en SQL, totales y truncamiento exactos; dar al contexto primero evaluación, evidencia, objetivo y restricciones. Verificar índices/planes con consultas representativas y conservar límites de tokens/coste.
- **Aceptación:** cuentas grandes no pierden evidencia silenciosamente; el modelo sabe qué parte inspeccionó y puede investigar una entidad sin volver a recibir todas las fuentes ni inflar el contexto con 100 copias de los mismos datos Shopify.

### A24-026 · Verificar el estado final de la aplicación y la base, además de fixtures aislados

- **Evidencia:** las tres suites focalizadas ejecutadas pasan: 23/23. Varias comprobaciones buscan texto en una migración anterior, por lo que no detectan que otra la reemplazó ni el desacuerdo de fechas entre productor y consumidor. Las reproducciones del parser, cobertura y resumen demuestran vacíos fuera de esa cobertura.
- **Mejora:** pruebas de contrato contra PostgreSQL con todas las migraciones, semántica de muestras completas/parciales, forma real de proveedor y fallos por bloque; JWT/RLS con dos tiendas; aprobación→reparación→reevaluación y consistencia UI/API/consumidores. Manifiesto de release que cruce versión de app, firmas/ACL SQL, esquema y prompt; verificar historial de migraciones antes de afirmar pendiente/aplicada.
- **Aceptación:** CI detecta una migración que retira campos requeridos, el extremo de fecha equivocado, un conjunto con gasto sin mapeo o una incidencia actual excluida. La validación conectada conserva payloads sanitizados y coste; una suite verde por sí sola no certifica calidad del diagnóstico ni incremento de ventas.

### Evidencia y límites de esta auditoría A24

- Descubrimiento mediante `search_graph`, `trace_path` y `get_code_snippet`, contrastado con fuente actual. Los offsets de `ai-runtime.ts` del grafo seguían desactualizados; para conclusiones y consumidores actuales se utilizó el código local. No se reconstruyó el grafo.
- Superficies examinadas: `meta-measurement-verdict.ts`, `meta-sync.ts`, `ai-runtime.ts`, `server.ts`, `marketing-store-scope.ts`, `agent-task-delivery.ts`, `consultant-specialist-context.ts`, contratos AI/medición, página y componente de diagnóstico Meta, migraciones A24 y la redefinición posterior de aprendizaje. Se consultó también `REVISION_AGENTES.md`; sus cierres históricos no se toman como prueba del estado final desplegado.
- TEST y producción: prompt v8, hashes/firmas/ACL de cuatro RPC y conteos de runs/caché/fuentes. Las cuatro funciones tienen los mismos hashes en ambos; solo la función de aprendizaje y pixel health conservan grants PUBLIC/anon en las ACL consultadas. Las políticas de cuatro tablas Meta examinadas en TEST son por organización. No se realizó una prueba JWT cruzada ni se afirma una fuga de datos.
- Reproducciones locales usando los helpers reales, sin persistir: segundo conjunto con gasto sin mapeo → `usable_with_attribution_limits`; evento antiguo con sync nuevo → utilizable; píxel adicional no utilizado e indisponible → `restricted`; forma de aprendizaje desplegada sin campos de frescura → `unknown`; estadística anidada con `data` → `[]`; resumen A24 → sin evaluación/tarea y con validez histórica de 30 días.
- Reproducciones SQL en TEST sin escrituras: la comparación actual solo coincide para PURCHASE/Purchase en los cuatro pares ensayados; una incidencia sintética sincronizada hoy devuelve cero con el filtro de periodo terminado ayer. Son demostraciones de predicados y contratos; no son incidencias reales observadas en las cuentas.
- Pruebas ejecutadas: `meta-measurement-verdict.test.ts`, `a24-meta-scope.test.ts`, `meta-sync-blocks.test.ts`: 23 pruebas, todas correctas. No se añadieron ni modificaron tests. No hubo generación LLM, llamadas a cuentas Meta, eventos enviados, migraciones, cambios de software/despliegue, publicación ni modificación de inversión.
- Fuentes primarias: [AdsPixelStatsResult del SDK oficial de Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adspixelstatsresult.py), [AdsPixelStats](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adspixelstats.py), [AdPromotedObject](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adpromotedobject.py) y [parámetros/agregaciones de AdsPixel](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adspixel.py). Se verificaron estructura y campos; el SDK no certifica permisos/cobertura de estas cuentas. La documentación directa de deduplicación de Meta respondió HTTP 429, por lo que no se usa para afirmar una regla no verificada.

## A25 · Cambios de la cuenta Meta: investigación, comparabilidad y seguimiento

Auditoría del 21 de octubre de 2026. **Estado: mejoras propuestas, pendientes de implementación.** Esta pasada corresponde al siguiente agente después de A24; la implementación de A24 se realiza por separado. Se examinaron código local, consumidores y configuración/funciones de TEST y producción mediante lecturas. No se modificaron software, prompts remotos, datos ni despliegues.

A25 debe explicar qué cambio se observó, sobre qué entidad, qué resultados pueden compararse y qué conviene investigar después. Una comparación antes/después es una observación, no una prueba causal ni una autorización para escalar, pausar o revertir. A24 mantiene la autoridad sobre medición; A14, sobre viabilidad económica e inversión; A23, sobre decisiones creativas. Mi Camino aporta la meta y el hito exactos, y los planificadores convierten trabajo revisado en capacidad y fechas.

### Funcionamiento comprobado y límites

| Superficie | Evidencia actual |
| --- | --- |
| Activación | GET `/ai/cambios-meta` lee caché; POST `/ai/cambios-meta-run` y cron por tienda generan mediante el runner genérico. El alcance implícito multitienda se rechaza; una selección inválida no se agrega a toda la organización. |
| Fuentes específicas | `meta_change_impact`, `meta_audience_overview`, caché del veredicto A24, tareas abiertas y fases de Mi Camino. Las fuentes compartidas añaden restricciones e historial de actividad/propuestas. |
| Configuración remota | A25 v4 activo en ambos entornos, mismo prompt de 6.047 caracteres y MD5 `11cb160391d90ee3a97fdedac4bddf28`. `allowed_tools` solo contiene `search_knowledge`; aprobación `required_before_publish`. |
| SQL de cambios vigente | Firma de siete argumentos, último `target_campaign_id` opcional; MD5 `2626df1581b0ad802ca0e366fd142ddb` en ambos entornos. No devuelve `comparison_status`, objetivo, impresiones/clics/CPM, contexto del cambio ni concurrencia; tampoco conserva el límite SQL de 200. |
| SQL de públicos vigente | Firma de dos argumentos: organización y tienda. MD5 `4cba3107d8f255d234e17f4d7e492fb9` en ambos entornos. Conserva los conteos de inclusión/exclusión y activos/archivados, con el defecto de conteo descrito abajo. |
| TEST | Tres runs: un fallo v2, un éxito v2 agregado y un éxito v4 por tienda del 13 de octubre. Dos outputs pendientes de aprobación; el v2 contiene una tarea y el v4 ninguna. Cero actividades y cero públicos en las tablas contadas. |
| Producción | Un run v2 fallido del 9 de septiembre; cero actividades y públicos en las tablas contadas. Esto no identifica por sí solo la causa de la ausencia de datos. |
| UI actual | `/meta` monta A24 y A23, pero no una tarjeta A25. `ClientMeta` usa los cambios de la RPC para hasta cuatro anotaciones del gráfico; ese dato no es una salida A25. |

### Orden de implementación propuesto

- **P1:** A25-001–007, A25-010–011, A25-014 y A25-016: contratos de fuentes, exactitud, alcance y materialización de tareas.
- **P2:** A25-008–009, A25-012–013, A25-015 y A25-017–022: calidad del diagnóstico, coordinación, recuperación, coste y experiencia de uso.
- **Cierre obligatorio:** A25-023 verifica el estado final de aplicación, SQL y permisos. Una suite verde o un run `succeeded` no sustituyen esa comprobación.

### A25-001 · Restaurar el contrato de cambios en la definición SQL final

- **Evidencia:** `20261115810000_a25_change_investigation_v4.sql` introduce comparabilidad, madurez, entidades no resueltas, contexto y límite de 200. `20261123000000_meta_campaign_detail.sql` elimina esa firma y crea otra de siete argumentos que vuelve a exigir solo `days_before > 0`, `days_after > 0` y gasto mínimo. Excluye eventos sin comparación y retira los campos anteriores. La segunda definición está en TEST y producción; ambas migraciones constan en el historial de TEST. El runtime sigue describiendo la semántica v4.
- **Mejora:** una definición canónica compatible con A25, el drilldown y el detalle de campaña; conservar eventos operativos y estados explícitos de comparación. Resolver firmas sin sobrecargas ambiguas y validar la respuesta al entrar al runtime.
- **Aceptación:** un evento reciente, sin entidad o con un solo día por lado sigue visible y no recibe un veredicto de impacto. Instalar todas las migraciones y actualizar una base existente termina con la misma firma, campos y permisos.

### A25-002 · Corregir los argumentos de la consulta de públicos

- **Evidencia:** `runCambiosMetaAgent` llama `meta_audience_overview` con `window`, que contiene organización, tienda y dos fechas. La función desplegada solo admite organización y tienda. Una llamada SQL de lectura con los cuatro argumentos nominales reproduce `42883`: no existe esa función. `meta-insights.ts` ya utiliza los dos argumentos correctos. El test de alcance llega a exigir la cadena de la llamada incorrecta.
- **Mejora:** construir argumentos específicos de cada RPC y reutilizar contratos tipados de parámetros/respuestas. Conservar la distinción entre consulta fallida y consulta correcta sin filas.
- **Aceptación:** A25 recupera públicos con la firma vigente; se prueba la petición real de RPC, no solo que aparezca `window` en el archivo. Un error de contrato se muestra como indisponibilidad técnica y no como ausencia de públicos.

### A25-003 · Usar métricas diarias canónicas y atribución compatible

- **Evidencia:** la consulta de cambios vigente suma `meta_insight_rows_daily` filtrando anuncio y `breakdown_hash='none'`, sin elegir una representación por anuncio/día entre `action_report_time` y `attribution_hash`. Selecciona compras y valor por `metric_name` mediante ranking de ventanas y luego resume una sola etiqueta de atribución. No demuestra que todas las filas, ambos periodos y ambas métricas compartan definición. A23 ya incorpora una vista canónica en su implementación local.
- **Mejora:** compartir el selector canónico con los consumidores de Meta y fijar explícitamente acción de compra, ventana de atribución, tiempo de reporte y procedencia. Rechazar comparaciones incompatibles, sin sumar informes alternativos de la misma actividad.
- **Aceptación:** dos representaciones del mismo día no duplican gasto; compras y valor usan una definición compatible y conocida. El antes/después coincide con las cifras de la pantalla bajo el mismo alcance y definición.

### A25-004 · Acreditar cobertura, frescura y madurez por cada ventana

- **Evidencia:** los bloques A25 registran éxito/fallo de RPC, pero no aportan recibos de `activities:<cuenta>`, públicos e insights para la cobertura solicitada. La SQL desplegada admite una fecha observada por lado; la v4 anterior contaba fechas, sin demostrar que todos los anuncios esperados estuvieran importados. Varias sumas convierten compras/valor ausentes en cero. Un log vacío no distingue cuenta quieta, backfill incompleto o fuente no sincronizada.
- **Mejora:** evaluación determinista con ventanas esperadas/observadas, cobertura por entidad, último sync completo, errores por bloque y fecha de maduración. Separar cero observado, dato desconocido, ventana parcial y atribución inmadura. Parametrizar la maduración según la definición de métrica, conservando una regla prudente documentada.
- **Aceptación:** siete fechas con anuncios faltantes no equivalen a cobertura completa. Un sync antiguo o fallido impide declarar silencio o ausencia de compras; se explica qué parte sí puede observarse y cuándo revisar el resto.

### A25-005 · Conservar identidad de cambio, cuenta y entidad, con procedencia

- **Evidencia:** el sync guarda una clave natural con cuenta/instante/tipo/objeto/actor, pero la RPC devuelve nombres, fecha y nivel sin IDs estables del cambio, cuenta o entidad. Su definición final resuelve conjuntos y anuncios por organización/ID externo sin repetir la restricción de cuenta que sí tenía v4. Se pierden `object_type` y `extra_data`. El sync descarta actividades sin instante/tipo y fusiona claves repetidas sin exponer esa cobertura a A25.
- **Mejora:** referencias estables y autorizadas al evento y entidad; resolver siempre dentro de cuenta/tienda, conservar contexto sanitizado y motivo de resolución fallida. Adjuntar recibo de origen, normalización, descartes y versión del adaptador; diferenciar el estado actual del objeto de lo acreditado en la fecha del cambio.
- **Aceptación:** renombrar una campaña no rompe la trazabilidad; dos cambios simultáneos no se confunden por título. Un actor desconocido, un objeto eliminado o una actividad no resoluble siguen siendo observaciones explícitas, sin inventar el antes/después del campo editado.

### A25-006 · Mantener moneda y materialidad por cuenta

- **Evidencia:** A25 utiliza `min_spend=50` sin moneda en su contrato de cambios. Las filas no identifican cuenta ni divisa; una tienda puede reunir varias cuentas. Los bloques específicos tampoco aportan una validación financiera que permita interpretar estabilidad del ROAS como capacidad económica de escalar.
- **Mejora:** conservar divisa por cuenta, expresar el umbral de materialidad en esa moneda y separar cuentas incompatibles. No convertir ni sumar importes entre divisas sin una política acreditada. Derivar las oportunidades de inversión a A14 con la evidencia y sus límites.
- **Aceptación:** 50 unidades de una moneda no se describen como 50 EUR por defecto. ROAS estable después de un cambio no acredita rentabilidad, margen ni presupuesto disponible; la misma cifra conserva unidad y definición en API, tarea y UI.

### A25-007 · Unificar calendario y consumo del gate A24 para el periodo pertinente

- **Evidencia:** `metaSpecialistWindow` produce 30 días UTC completos hasta ayer, pero A25 guarda `time_range.end=now` y busca el gate con `periodStart, now`, mientras su consulta usa el día anterior. SQL fecha los eventos con la zona de la cuenta. La investigación puede consultar otras fechas y el antes/después puede extenderse fuera del intervalo de eventos. El gráfico actual sitúa anotaciones con `event_time.slice(0,10)`, sin convertir a esa zona.
- **Mejora:** separar intervalo de selección de eventos, ventanas de observación, instante de evaluación y calendario de la cuenta; normalizar las claves con el contrato compartido de A24 que se está implementando. Verificar que la evidencia de medición es aplicable a entidad y ventanas históricas, no asumirlo por disponer de un estado actual.
- **Aceptación:** un cambio cerca de medianoche aparece en el mismo día en SQL y UI. A25 encuentra la evaluación compatible o explica su ausencia; cambiar fechas para investigar no reutiliza silenciosamente un gate de otro periodo.

### A25-008 · Corregir el conteo de conjuntos activos y distinguir uso real

- **Evidencia:** `meta_audience_overview` calcula activos con `count(*) filter` después de `LEFT JOIN` y considera activo todo estado distinto de `DELETED/ARCHIVED`, incluido NULL. La reproducción SQL con un público sin conjuntos devuelve **un activo**, por la fila nula del join. Un conjunto que incluye y excluye un público puede sumarse dos veces en `ad_sets_using`; además, pausado/desconocido se agrupa con activo.
- **Mejora:** contar IDs reales y distintos; separar inclusión, exclusión, uso único y estados de entrega conocidos. Definir claramente si «activo» significa no archivado, habilitado o con entrega observada y conservar desconocidos aparte.
- **Aceptación:** un público sin referencias devuelve cero conjuntos; uno pausado no se presenta como entregando. La doble referencia no duplica el número de conjuntos únicos y las cifras cuadran con sus detalles.

### A25-009 · Tratar el inventario de públicos como un snapshot con cobertura

- **Evidencia:** el sync hace upsert de públicos recibidos y guarda `last_synced_at`, pero la RPC no entrega ese campo ni recibos de cobertura. No se observa en esa función una reconciliación de públicos que desaparecen de un recorrido completo. El uso se deriva de `targeting_data` actual, no de entrega histórica, expansiones acreditadas o solapamiento de personas.
- **Mejora:** snapshot por cuenta con fecha, permisos, recorrido completo y reconciliación de ausentes solo tras éxito completo. Mostrar uso observable, incertidumbre y límites de la segmentación disponible; no inferir solapamiento real, audiencia inútil o elegibilidad de borrado desde cero referencias.
- **Aceptación:** un público antiguo no se presenta como vigente por permanecer en la tabla. Un fallo parcial de importación no lo marca eliminado y ninguna recomendación de limpieza omite exclusiones, dependencias o la revisión humana requerida.

### A25-010 · Publicar un diagnóstico tipado aunque no haya tareas

- **Evidencia:** A25 usa `buildLeanOutputContract` omitiendo `answer`, `findings` y `recommendations`, aunque su prompt los exige. La reproducción con el helper real acepta una salida sin diagnóstico y completa «Sin trabajo nuevo que proponer en este ciclo». No existe una sección A25 obligatoria que vincule observación, comparación, entidad y fuentes.
- **Mejora:** contrato específico con observaciones de cambios, comparabilidad fijada por servidor, públicos, restricciones, cobertura, evidencia y próximo paso. El texto explica esos hechos; las tareas son una consecuencia opcional. Conservar una lectura útil sin forzar trabajo nuevo.
- **Aceptación:** cero tareas puede significar esperar maduración, investigar una fuente o no observar cambios con cobertura suficiente; esos estados se distinguen. Una frase genérica sobre propuestas no cuenta como diagnóstico de la cuenta y el modelo no puede elevar comparabilidad.

### A25-011 · Validar el tipo de acción y revalidar la evidencia al aprobar

- **Evidencia:** el esquema genérico de A25 acepta una tarea de escalar inversión sin recibir ni validar el gate; se reprodujo con el contrato real. Las guardias de aprobación económica/medición de A14 y las decisiones de A23 no se aplican a A25. La aprobación humana de una tarea sigue existiendo, pero no impide que una propuesta antigua o contradictoria se materialice.
- **Mejora:** acciones tipadas de investigación, documentación, revisión o derivación, vinculadas a evidencia. Cualquier propuesta que implique inversión o cambios operativos necesita el flujo responsable y sus verificaciones actuales; la aprobación de una tarea no equivale a permiso para mutar Meta.
- **Aceptación:** con gate desconocido se permite investigar y se explica el límite. Una recomendación no autoriza escalar, pausar, borrar públicos o revertir automáticamente; al aprobar se comprueban alcance, vigencia, estado del episodio y condiciones de la acción.

### A25-012 · Sustituir el prompt acumulado por una misión coherente

- **Evidencia:** el prompt v4 conserva que ROAS estable tras subir presupuesto demuestra margen para escalar, que cada toque reinicia aprendizaje y que pueden proponerse reversiones/congelaciones. Más abajo añade cautelas de madurez y A24. Pide cifras y hallazgos que el contrato lean omite, mantiene un límite de 22 palabras para justificar tareas y usa un ejemplo con stock que no proviene de una fuente específica A25.
- **Mejora:** prompt canónico alineado con el contrato vigente, centrado en investigación y seguimiento. Retirar causalidad de aprendizaje no acreditada, inferencias de rentabilidad, órdenes reemplazadas y ejemplos que sugieran inventar contexto comercial. Explicar incertidumbre y por qué esperar puede ser la recomendación correcta.
- **Aceptación:** ninguna instrucción interpreta estabilidad de ROAS como permiso económico ni frecuencia de cambios como prueba de reinicios. Los campos pedidos existen y una justificación puede aportar el detalle necesario para revisión.

### A25-013 · Habilitar un drilldown acotado y realmente disponible

- **Evidencia:** runtime y documentación anuncian `meta_change_log`, y su validador admite hasta 31 días dentro de los últimos 90. La versión v4 activa solo autoriza `search_knowledge`; el registro exige que la herramienta esté en `allowed_tools`, por lo que A25 no la obtiene. Cuando se utilice, devuelve la misma RPC, sin filtro por evento/cuenta/entidad ni cursor.
- **Mejora:** permitir investigación de lectura por referencia exacta y fechas, con autorización de tienda, límites de filas/tokens y procedencia. Recuperar recibos y detalles necesarios sin reenviar todo el inventario; mantener la validación temporal existente y declarar capacidades no disponibles.
- **Aceptación:** la configuración efectiva permite la herramienta anunciada y el agente puede investigar un cambio concreto. No puede alterar scope, escribir en Meta ni consultar periodos sin límite; una petición fuera de cobertura explica el motivo.

### A25-014 · Aplicar autorización y elegibilidad por tienda y cuenta

- **Evidencia:** runner genérico y lector usan `requireMembership` para A25; la excepción de permisos operativos por tienda está en A23. El cron filtra elegibilidad Meta solo para A14/A23. Las RPC examinadas filtran por tienda opcional pero no exigen cuentas seleccionadas/activas. Ambas conservan EXECUTE de PUBLIC/anon; son invoker. En TEST, las políticas consultadas de actividades, públicos y cuentas son organizativas.
- **Mejora:** resolver y autorizar tienda/cuentas elegibles en GET, POST, herramientas, cron y aprobación; alinear acceso SQL/RLS con los consumidores legítimos, incluyendo miembros autorizados solo a una tienda. Revisar grants con pruebas reales de roles.
- **Aceptación:** no se consulta ni propone trabajo para otra tienda o cuenta no seleccionada; una tienda sin Meta elegible no consume generación. Los errores fallan cerrado. La ACL amplia de una función invoker no demuestra por sí sola una fuga; verificar JWT/RLS cruzados antes de afirmar aislamiento integral.

### A25-015 · Completar idempotencia, cuota y digest por tienda

- **Evidencia:** el POST valida `Idempotency-Key` pero pasa `undefined` a las opciones de A25. El runner no le asigna `quotaScope` por tienda; su rama cron no pasa `item.digest` y usa el digest organizativo, frente al tratamiento específico de A23. Existen reservas de presupuesto generales, pero no equivalen a deduplicación de la misma investigación.
- **Mejora:** propagar clave y digest real de cuentas, eventos, públicos, fuentes y versión; reserva/lease por tienda y evidencia, replay y recuperación tras fallo. Distinguir releer/calcular comparabilidad de volver a pagar una explicación LLM.
- **Aceptación:** reintento, dos pestañas y cron no generan el mismo análisis dos veces; el fallo de cierre se recupera sin repetir modelo. Una actividad de otra tienda no consume su cuota ni es la única señal para renovar su diagnóstico.

### A25-016 · Asociar tareas a la revisión exacta de Mi Camino y crearlas atómicamente

- **Evidencia:** A25 recibe fases y tareas, pero mantiene propuestas genéricas y `shouldFallbackToCurrentMilestone` permite asignar el hito actual. Las comprobaciones de plan/revisión/hito y materialización atómica de A13/A14/A23 no incluyen A25; su ruta hace upsert de tarea y después enlaza el hito. La carga compartida de playbooks tampoco pasa `storeId` para A25 en el código examinado.
- **Mejora:** identidad exacta de plan/revisión/hito cuando corresponda, contribución a la meta, responsable, evidencia y criterio de cierre. Revalidar al aprobar y materializar tarea/vínculo/referencia del cambio juntos; permitir tarea libre cuando no exista un hito aplicable. Acotar conocimiento a la tienda.
- **Aceptación:** cambiar Mi Camino obliga a revisar la propuesta; no se elige hito por posición ni semejanza de título. Un fallo de vínculo no deja tarea parcialmente materializada ni mezcla conocimiento de otra tienda.

### A25-017 · Coordinar el episodio con A14/A23/A24 y evitar trabajo duplicado

- **Evidencia:** A25 recibe tareas e historial genéricos, pero sus bloques específicos no concilian decisiones/episodios de A14/A23/A24 de la misma entidad. El contador de concurrencia de la migración v4 trabajaba sobre la muestra de cambios, incluía el propio evento y era por cuenta en ±24 h; además, la definición final lo elimina. Eso no identifica por sí solo cambios sobre la misma entidad o sus ancestros.
- **Mejora:** agrupar episodios por entidad/jerarquía/periodo y distinguir evento propio, cambios concurrentes conocidos y cobertura incompleta. Reutilizar handoffs/entregables existentes: A24 para medición, A23 para pieza/prueba, A14 para inversión y A04/A17/A18 para capacidad. Enlazar tareas existentes y registrar aceptación, rechazo y supersesión.
- **Aceptación:** varios eventos relacionados no crean una reparación por agente y ciclo. Una recomendación anterior de pausar o esperar se revisa explícitamente; la concurrencia conocida reduce la fuerza de la lectura sin convertirse en causalidad ni reinicio probado.

### A25-018 · Incorporar contexto comercial observado sin inventar explicaciones

- **Evidencia:** las ventanas comparan la misma entidad y el prompt menciona stock, estacionalidad y otros canales, pero los bloques propios de A25 no aportan series comparables de precio, disponibilidad, promociones, cambios del sitio o entregas. El estado actual de una tienda no demuestra qué ocurrió durante la ventana histórica.
- **Mejora:** recuperar solo hechos comerciales ya acreditados para la tienda, entidad y fechas, con su cobertura. Separar explicación posible de coincidencia documentada; si falta historia, proponer la comprobación correspondiente. Aprovechar los contratos de medición/experimentación existentes para diseñar una prueba cuando proceda.
- **Aceptación:** no se afirma una caída de stock ni una promoción sin fuente fechada. La comparación conserva contexto y limitaciones; una prueba futura declara hipótesis, métrica, revisión y criterio de parada sin prometer incrementalidad a partir de atribución.

### A25-019 · Conservar observaciones y estado de entrega en los resúmenes compartidos

- **Evidencia:** `summarizeSpecialistOutput` trata A25 con el resumen genérico: omite propuestas, referencias de cambios y comparabilidad. Su frescura es de 30 días. La reproducción con un output aprobado, observación y tarea descarta ambas y conserva solo la frase genérica, con vigencia hasta el 20 de noviembre para un run del 21 de octubre.
- **Mejora:** adaptador A25 compacto que preserve evento/episodio, conclusión permitida, limitaciones, próxima fecha de revisión, tareas y estado de entrega. Separar memoria histórica del permiso para tomar una decisión actual; resolver nuevamente las condiciones técnicas/económicas cuando hagan falta.
- **Aceptación:** A19, planificadores y copiloto reciben el próximo paso exacto, con fuente y responsable. No reutilizan durante 30 días una comparación inmadura, un gate vencido o una tarea ya sustituida como si siguieran vigentes.

### A25-020 · Hacer accesible el diagnóstico A25 y alinear las anotaciones de la UI

- **Evidencia:** la página Meta actual solo monta los especialistas A24/A23. El gráfico de `ClientMeta` muestra hasta cuatro cambios de la consulta de insights y añade ROAS antes/después sin recibir `comparison_status` en su tipo. La sección antigua de cambios tampoco modela comparabilidad; no debe asumirse que esté montada en la página actual. Los outputs A25 no se presentan mediante una tarjeta propia allí.
- **Mejora:** definir el punto de lectura/revisión de A25 y un resumen comprensible para cliente/consultor, con acceso al episodio, evidencia y tarea. Anotaciones y detalle deben usar identidad, calendario, cobertura y restricciones del mismo contrato; explicar intervalos de eventos y de comparación.
- **Aceptación:** se puede encontrar y revisar A25 sin confundirlo con anotaciones calculadas de la RPC. Una comparación parcial se etiqueta y no recibe color de éxito/fracaso por defecto; cambiar de tienda retira la lectura anterior y GET no genera gasto de modelo.

### A25-021 · Acotar consultas, paginar y declarar la muestra real

- **Evidencia:** el contexto promete hasta 200 cambios, pero la SQL desplegada no contiene ese límite; públicos tampoco incorpora paginación. Los agregados laterales recorren métricas por cambio y uso por público; muchas ventanas se solapan. No se aportan totales/cursor/cobertura para detectar límites del transporte. La implementación v4 anterior sí limitaba cambios antes de calcular concurrencia, haciendo parcial ese conteo.
- **Mejora:** selección y paginación estable por cuenta/evento, resumen de cobertura separado del detalle, agregados diarios reutilizados y consultas acotadas por misión. Calcular totales y concurrencia sobre el universo pertinente antes de recortar presentación. Verificar planes/índices con volumen representativo y limitar contexto/tokens.
- **Aceptación:** una cuenta grande no pierde eventos silenciosamente ni recibe la afirmación falsa de que se inspeccionaron todos. El drilldown recupera la siguiente página sin repetirla y no exige volcar toda la historia al modelo. No se afirma una latencia mejor sin medirla.

### A25-022 · Programar la revisión por maduración y conservar la evolución de la evidencia

- **Evidencia:** la comparabilidad depende del paso del tiempo y de nueva ingesta, además de nuevos cambios. A25 usa la cadencia/digest genéricos y no registra por evento una fecha de próxima comprobación, transición de parcial a maduro o vínculo entre evaluaciones. Un output pendiente de revisión puede frenar el ciclo general aunque madure una ventana.
- **Mejora:** cálculo determinista de `next_review_at` y estado del episodio a partir de cobertura/madurez; conservar snapshots/versiones para explicar cambios de conclusión. Reevaluar con nueva ingesta o fecha vencida, sin duplicar tareas ni regenerar texto si no cambia una observación material. Cerrar/reabrir por evidencia, no solo por marcar una tarea completada.
- **Aceptación:** un evento parcial vuelve a comprobarse cuando procede aunque no aparezcan eventos nuevos. Backfill, cambio de definición, error de sync o corrección de datos invalidan la lectura afectada; el usuario puede ver qué evidencia cambió y por qué.

### A25-023 · Verificar el estado final de SQL, contratos, permisos y flujo completo

- **Evidencia:** las 12 pruebas focalizadas ejecutadas pasan. La suite de prompts valida texto de la migración v4 que después se reemplaza; la de alcance exige la llamada defectuosa de públicos. No detectan el contrato desplegado ni el conteo de la fila nula. Los runs remotos sin actividades/públicos no acreditan utilidad con datos conectados.
- **Mejora:** pruebas de contrato contra PostgreSQL con todas las migraciones y peticiones RPC reales; fixtures de eventos sin entidad, ventanas parciales/maduras, informes alternativos, moneda, zonas horarias, públicos sin uso y fallos de fuente. JWT/RLS con dos tiendas y roles; aprobación→tarea/hito→revisión de evidencia; consistencia de diagnóstico, resumen y UI. Manifiesto de release con firmas, ACL, esquema y prompt.
- **Aceptación:** CI detecta la redefinición que elimina campos y el parámetro de RPC incompatible. Validación conectada posterior conserva evidencia sanitizada, coste y resultado observado; no se ejecutan cambios de inversión, borrado de públicos ni generación pagada para dar por cerrada esta auditoría documental.

### Evidencia y límites de esta auditoría A25

- Descubrimiento con `search_graph`, `trace_path` y `get_code_snippet`, contrastado con fuente local actual. El grafo no refleja todos los cambios locales del runner; no se reconstruyó. El repositorio ya tenía cambios ajenos, incluidos cambios anteriores en este documento, que se conservaron.
- Superficies examinadas: runner/lector/herramientas/cron/aprobación de `ai-runtime.ts`, rutas de `server.ts`, `meta-change-investigation.ts`, `meta-sync.ts`, `meta-insights.ts`, resolvers de tienda, `agent-task-delivery.ts`, `consultant-specialist-context.ts`, contrato lean de `packages/ai`, página Meta, gráfico `ClientMeta`, tipos/sección de insights y migraciones relevantes. `REVISION_AGENTES.md` describe cierres históricos que no prueban el estado final vigente.
- Lecturas remotas: versiones/prompt/herramientas, firmas/resultados/hash/ACL de ambas RPC, conteos de actividades/públicos/runs en TEST y producción; estados y claves de outputs, tres políticas RLS e historial de las dos migraciones en TEST. No se leyeron ni publicaron tokens, datos de compradores ni nombres de actores. No se probaron JWT cruzados, cuentas Meta ni flujo real de proveedor.
- Reproducciones sin persistencia: llamada nominal de públicos con fechas → `42883`; predicado SQL de público sin conjuntos → un activo; predicado final de cambios con un día por lado y gasto suficiente → aceptado. Son pruebas de contratos/predicados con datos sintéticos, no incidencias reales de las cuentas. La suma de dos representaciones alternativas ilustra el riesgo de duplicación; no se midieron duplicados reales en esta pasada.
- Helpers reales en memoria: contrato lean → diagnóstico omitible y frase genérica; tarea de inversión sin gate → aceptada por ese contrato; resumen A25 → descarta observación/tarea y asigna 30 días. Esto no demuestra que una tarea de inversión se haya ejecutado: la plataforma conserva aprobación humana y no se realizó ninguna aprobación.
- Pruebas ejecutadas: `meta-change-investigation.test.ts` y `a24-meta-scope.test.ts`: 10/10; casos `A23/A25` y `A25 only` de `agent-canonical-prompts.test.ts`: 2/2. No se añadieron ni modificaron tests; no se ejecutó la suite completa ni una compilación porque esta pasada solo añade documentación.
- **Estado de implementación (21-oct-2026):** aplicada la primera pasada sobre los contratos locales actuales y el gate compartido A24. La migración `20270107120001_a25_change_investigation_integrity.sql` restaura la identidad y comparabilidad de los eventos, filtra cuentas activas/seleccionadas, conserva el alcance de tienda, corrige el conteo de públicos y añade paginación, cobertura y lectura exacta por `event_id`. El prompt v5 habilita el drilldown de solo lectura. El runner propaga idempotencia, reserva cuota y digest por tienda, bloquea tiendas no elegibles y fija gate/evidencia en el output; el contrato exige observaciones y tareas de investigación vinculadas a eventos, y evita sugerencias operativas de inversión o cambios en Meta. Se añadió la tarjeta A25, una vista compacta compartida con vigencia de 7 días y el detalle del evento y estado de comparabilidad; la tabla genérica ya no pinta variaciones de ROAS como éxito/fracaso.
- **Pendiente para considerar A25 cerrado:** el digest detecta muestras acotadas (500 actividades/públicos), pero aún no invalida por cualquier corrección histórica; no hay recibo de recorrido completo/reconciliación del inventario, snapshots y re-evaluación programada por maduración, conciliación completa de episodios con A14/A23/A24 ni verificación de decisión al aprobar una tarea. A25 crea tareas libres con referencia en metadata/descripción, todavía mediante el materializador genérico; no aporta histórico comercial fechado ni paginación visible de públicos. Falta lint contra PostgreSQL, validación de grants/RLS con JWT por rol/tienda y flujo conectado; esta migración queda local y no se ha aplicado a TEST ni producción. No se añaden pruebas en esta pasada.
- **Siguiente agente de esta secuencia tras A25: A26, contenido del email.**

## A26 · Contenido del email: evidencia, revisión visual y coordinación editorial

Auditoría del 21 de octubre de 2026. **Estado al 23-oct-2026: mejoras implementadas en el workspace; nueve migraciones aplicadas en TEST y producción. La aplicación y el worker de esta pasada todavía no se han desplegado.** Se revisan el código local actual, los consumidores de A26 y los contratos/configuración desplegados en TEST y producción. Las evidencias y defectos descritos en los apartados de auditoría corresponden al estado inicial del 21-oct; el cierre al final documenta su corrección y verificaciones. El cierre de A24 documentado arriba corresponde a un trabajo separado; A25 se mantiene en el ámbito de su implementación paralela.

A26 debe convertir contenido observado en correcciones editoriales justificadas, identificando la pieza y versión exactas. A12 aporta rendimiento y sus límites; A28, arquitectura de flows; A05/A27, la intención de campañas y secuencias; A11, la creación o revisión del borrador. Mi Camino aporta el objetivo y el hito; A17/A18 organizan capacidad y plazos. El encargo debe circular entre ellos con evidencia y estado de entrega, sin presentar una plantilla actual como envío histórico ni una diferencia descriptiva como efecto probado del diseño.

### Funcionamiento observado en la auditoría inicial del 21-oct

| Superficie | Evidencia actual |
| --- | --- |
| Activación | GET/POST de `contenido-email` y cron genérico. El POST entrega `connectionId` pero descarta la clave de idempotencia; la rama cron no entrega ni conexión ni digest a A26. |
| Configuración remota | A26 v6 activo en ambos entornos, modelo `claude-sonnet-5`, `search_knowledge`, aprobación `required_before_publish`; prompt de 9.703 caracteres, MD5 `55a5b688c241bdc060f490992e6a81e8`. |
| Selección | Inventario SQL completo recibido por el cliente; helper selecciona hasta 30 mensajes por estado del padre, conserva grupos de flows y reserva hasta un 40 % para campañas. No equivale a cubrir todo el inventario ni a reconstruir sus recorridos. |
| Contenido | Extracto de hasta 2.000 caracteres; hasta 12 perfiles HTML; versiones históricas de plantilla observadas por sync; contenido de variaciones opt-in con revisión `2026-07-15.pre`, hasta 12 mensajes. Hay índices por cuenta/plantilla que evitan cruzar IDs externos coincidentes. |
| Rendimiento de variantes | El runner envía `period_start/period_end`; la firma desplegada exige `target_period_start/target_period_end`. La reproducción nominal en TEST devuelve `42883`. Las tres RPC examinadas tienen los mismos hashes en ambos entornos. |
| Render | Primer candidato determinista por ejecución; cola privada por hash de ámbito/HTML; una ejecución posterior puede adjuntar dos primeras pantallas. Worker sin red ni JavaScript, con límites de capturas, recuperación y limpieza. Es simulación de navegador, no inbox ni personalización real. |
| Presentación | La página Klaviyo actual monta A12 y A28. No se encontró un montaje de A26 en las páginas actuales de Klaviyo/Marketing; sí existen rutas API, registro de etiqueta y herramientas administrativas de evidencia visual. |
| Datos remotos | TEST: 2 cuentas, una sin tienda, 16 mensajes de campaña, 3 de flow, 10 plantillas, 7 snapshots; 2 runs A26 exitosos y 3 fallidos. Producción: cero cuentas/contenidos contados y 4 runs fallidos. Estos conteos no explican por sí solos la causa de los fallos ni prueban el build desplegado. |

### A26-001 · Reparar y verificar el contrato final de resultados por variante

- **Evidencia:** `runContenidoEmailAgent` llama a `klaviyo_email_variation_report` con nombres de fecha incompatibles con la firma final de TEST y producción. La llamada nominal equivalente falla con `42883`; el runtime continúa con resultados vacíos y `consulta_fallida`, por lo que el bloque A/B puede quedar permanentemente sin datos aunque existan reportes.
- **Mejora:** adaptar los argumentos al contrato único y probar la petición RPC real después de todas las migraciones. Conservar el error de fuente y distinguir fallo contractual, permiso, fuente vacía y cobertura parcial.
- **Aceptación:** una campaña con reportes relacionables recibe sus filas; un cambio de firma rompe CI. Una RPC fallida nunca se presenta como ausencia de variantes ni como evidencia de rendimiento igual a cero.

### A26-002 · Restaurar el diagnóstico y definir una revisión de contenido tipada

- **Evidencia:** A26 figura en `LEAN_OUTPUT_BY_AGENT` omitiendo `answer`, `findings` y `recommendations`, aunque v6 exige esos campos. El helper real elimina respuesta/hallazgos del esquema y puede reconstruir una frase genérica sobre tareas, con hallazgos vacíos. No existe un contrato específico de revisión A26 que obligue a vincular observación, pieza, fuente y propuesta.
- **Mejora:** preservar el diagnóstico útil y añadir observaciones tipadas: pieza/versión, dimensión textual/estructural/visual, cita o medida, cobertura, hipótesis y siguiente acción. Validar referencias y permitir explícitamente `no_change`, `needs_evidence` y `revision_proposal`.
- **Aceptación:** una revisión puede aportar valor sin crear tareas; un análisis sin cuerpo conserva la abstención y su motivo. No se transforma el fallo de evidencia en una respuesta genérica de que no hay trabajo.

### A26-003 · Exigir tienda, cuentas elegibles y autorización en todas las entradas

- **Evidencia:** sin conexión seleccionada, `resolveMarketingStoreScope` acepta alcance organizativo; el cron A26 no pasa conexión. El runner genérico aplica `requireOperationalStore` a A23/A24/A25, mientras A26 usa membership organizativo. El inventario desplegado acota por tienda si se entrega, pero no incorpora estado de conexión, elegibilidad de cuenta ni frescura. En TEST existe una cuenta sin tienda.
- **Mejora:** resolver ámbito explícito y verificar permisos de tienda para GET, POST, cron, capturas y aprobación. Acreditar cuentas/conexiones elegibles; mantener un agregado organizativo como modo separado y expresamente autorizado cuando aporte valor, con separación de marcas.
- **Aceptación:** un usuario limitado a una tienda no puede analizar ni recuperar evidencia de otra cambiando un ID. El cron no mezcla voces ni ofertas de varias tiendas, y la cuenta sin asignar no se incorpora silenciosamente a un análisis de tienda. La revisión documental no declara una fuga real sin prueba JWT específica.

### A26-004 · Completar idempotencia, cuotas y actualización por evidencia

- **Evidencia:** el endpoint comprueba `Idempotency-Key` pero llama a A26 con opciones `undefined`; su cron tampoco pasa `activityDigest`. A26 no usa las reservas y el ámbito de cuota por tienda incorporados a los especialistas Meta. El nuevo render puede completarse sin que exista un nuevo evento comercial o una nueva salida aprobada.
- **Mejora:** reserva/lease por tienda, petición y fingerprint de fuentes; replay y recuperación del cierre del run. Separar detectar cambios de contenido/render de volver a pagar una explicación. Invalidar por plantilla, versión, estado del mensaje, fuente o render relevante.
- **Aceptación:** dos pestañas o un reintento no duplican generación; cambios de otra tienda no consumen el cupo de esta. Una evaluación nueva necesaria no queda bloqueada indefinidamente por una propuesta pendiente.

### A26-005 · Hacer explícitas las fechas y el estado observado del mensaje

- **Evidencia:** el run A26 declara inicio y fin iguales a `now`, carga un inventario sin filtro temporal y consulta métricas de hasta 365 días. La muestra preparada omite la fecha de envío. El prompt comienza describiendo lo que la tienda envía hoy, aunque admite campañas enviadas, programadas y en envío.
- **Mejora:** distinguir fecha de evaluación, ventana de descubrimiento, estado actual, envío histórico/programado y ventana de reporte. Conservar zona/fecha por cuenta o mensaje y describir el inventario como fotografía, sin atribuirle una ventana de rendimiento ficticia.
- **Aceptación:** una campaña de meses atrás y una programada para mañana tienen etiquetas distintas. La clave de caché, el run, el resumen y la UI expresan el mismo ámbito temporal.

### A26-006 · Reconstruir el recorrido real antes de juzgar una secuencia

- **Evidencia:** `klaviyo_email_inventory` calcula el orden del flow con `row_number` por `external_created_at` y `external_action_id`. Eso no incorpora aristas, bifurcaciones, retrasos, filtros o reentrada. El contexto y el prompt lo presentan como orden real de recepción del suscriptor.
- **Mejora:** aprovechar el grafo de acciones existente para identificar caminos, condiciones y esperas; etiquetar orden demostrado, parcial o desconocido. Comparar repeticiones dentro de un recorrido elegible y conservar la intención aprobada de A28 como propuesta separada.
- **Aceptación:** dos mensajes de ramas excluyentes no se diagnostican como repetición consecutiva. Crear una acción más tarde no modifica artificialmente el orden de recepción; sin topología suficiente se revisan piezas individuales.

### A26-007 · Seleccionar por estado del mensaje y canal, además del padre

- **Evidencia:** el helper filtra `parent_status`, no el estado individual del mensaje/acción. El inventario devuelve estado del flow/campaña; la rama de campañas admite canal nulo como email y la rama de flows no expone canal. Un flow live no acredita que todas sus acciones estén enviando emails.
- **Mejora:** aportar canal, estado y elegibilidad por mensaje/acción con su procedencia; separar envío activo, manual, deshabilitado, borrador e histórico. Tratar un canal desconocido como tal y mantener sus conteos de exclusión.
- **Aceptación:** no se diagnostica como email activo una acción deshabilitada o de otro canal. Si falta ese dato se declara la limitación y se evita proponer cambios operativos sobre una suposición.

### A26-008 · Conservar identidad y versión de toda la pieza editorial

- **Evidencia:** la muestra preparada conserva nombre del padre, asunto y cuerpo, pero descarta IDs de cuenta, mensaje, plantilla y variante, y la fecha de envío. Se puede combinar asunto/preheader actuales con HTML histórico. La RPC histórica devuelve `text_content`, pero la selección de cuerpo utiliza HTML.
- **Mejora:** paquete estable cuenta/tienda/campaña o flow/mensaje/variación, fechas y hash por asunto, preheader, HTML/texto y enlaces. Documentar versiones incompatibles; admitir texto plano histórico sin inventar HTML. Extender el snapshot C2 existente en vez de crear otra copia de verdad.
- **Aceptación:** cada cita y propuesta resuelve una pieza y revisión inequívocas. Plantillas con el mismo ID externo en dos cuentas siguen aisladas. Una promesa de asunto no se contrasta como si fuera enviada junto a un cuerpo de otra revisión.

### A26-009 · Conservar errores, frescura y cobertura de cada fuente

- **Evidencia:** el lookup de plantillas extrae `data` sin registrar `error`; el fallo termina pareciéndose a cuerpo ausente. La cobertura histórica y A/B sí tiene contadores, pero no existe un recibo coherente por inventario, plantilla, versiones, variante y captura. La fecha de cuenta o un sync general exitoso no certifica todos los bloques.
- **Mejora:** manifiesto de cobertura por cuenta/fuente/versión, con última ejecución completa, error posterior, límites y recuentos recibidos/interpretados. Distinguir falta de permiso, lectura fallida, cero observado y falta de asociación.
- **Aceptación:** una lectura de plantilla fallida no genera una recomendación de reescribir un email sin cuerpo. El resultado explica qué dato falta y qué puede revisarse con las fuentes disponibles.

### A26-010 · Corregir la semántica de tracking y reemplazar el prompt acumulado

- **Evidencia:** v6 afirma que sin UTM nadie puede saber si el email funciona. La SQL además convierte un flag UTM ausente en `false`. El prompt combina prohibiciones originales de mirar rendimiento con añadidos A/B posteriores, contiene escapes literales y exige tareas/hallazgos que el contrato recorta.
- **Mejora:** prompt canónico alineado con fuentes y esquema. Separar UTM, seguimiento de clics/aperturas, identificación y atribución; comprobar parámetros observados y configuración conocida, manteniendo `unknown` cuando falte información. La documentación de [UTM](https://help.klaviyo.com/hc/en-us/articles/115005247808) y [seguimiento de conversiones](https://help.klaviyo.com/hc/en-us/articles/115005248128) describe mecanismos distintos; la ausencia de un flag no demuestra ausencia total de atribución.
- **Aceptación:** A26 no propone activar UTM afirmando que desapareció toda medición. Las relaciones entre diseño, repetición, clics o bajas se expresan como hipótesis cuando no hay una prueba apropiada; el estado técnico no depende del juicio del modelo.

### A26-011 · Distinguir variación de contenido y brazo de experimento

- **Evidencia:** el bloque beta se etiqueta como contenido A/B, pero consume recursos `campaign-variation`; la guía actual de [Campaigns omnicanal](https://developers.klaviyo.com/en/reference/campaigns_omni_api_overview) define una jerarquía de audiencias, mensajes y contenido por canal. El adaptador está fijado a `2026-07-15.pre`; la revisión `2026-10-15` cambia contratos de Campaigns. Compartir la palabra variante no demuestra que ambos identificadores representen un brazo de prueba.
- **Mejora:** adaptadores explícitos por revisión y recurso, validación de relaciones e identidad de experimento cuando exista. Conservar canal/audiencia/mensaje/variación y una matriz de capacidades; planificar la revisión estable sin actualizar automáticamente a una forma incompatible.
- **Aceptación:** una variación de contenido no se presenta como A/B probado. La relación con Reporting API se acredita por IDs y semántica, y una forma desconocida queda como parcial o no soportada.

### A26-012 · Calcular comparabilidad A/B antes de generar recomendaciones

- **Evidencia:** `buildKlaviyoVariationContext` conserva el último periodo de cada variante de forma independiente. La reproducción con A en agosto y B en septiembre devuelve ambas sin estado técnico de comparabilidad. Se conservan importes de conversión sin moneda ni definición de atribución en ese contrato, y los contadores admiten cualquier número finito.
- **Mejora:** misma cuenta, experimento/mensaje, ventana, audiencia elegible y definición de métrica; estados de volumen, madurez, moneda, bot/MPP y controles cuando la fuente los proporcione. Diferenciar observación descriptiva de resultado de experimento y no sumar atribuciones de plataformas.
- **Aceptación:** periodos incompatibles no producen una ganadora; falta de moneda limita importes sin ocultar métricas válidas no monetarias. El servidor impide afirmar causalidad o reutilización ganadora cuando no se cumplen las condiciones.

### A26-013 · Paginar el inventario y hacer rotar la muestra por trabajo pendiente

- **Evidencia:** se recupera todo el inventario antes de seleccionar 30 mensajes. El orden estable de grupos y el primer candidato visual favorecen repetir las mismas piezas. Los límites de HTML, variantes y snapshots se declaran parcialmente, pero no ofrecen continuación por entidad para investigar las omisiones.
- **Mejora:** consulta paginada con totales/cursor por cuenta, selección determinista por cambios, problemas verificables y cobertura pendiente; conservar una muestra de secuencias representativa. Priorizar el contexto útil y medir consulta/tokens con volumen representativo.
- **Aceptación:** una cuenta grande no pierde contenido por el límite de transporte ni deja emails sin revisar indefinidamente. Se distinguen universo elegible, muestra textual, perfiles HTML y muestra visual; continuar no repite entidades ni requiere volcar todo el catálogo al modelo.

### A26-014 · Añadir investigación dirigida y conocimiento acotado a la tienda

- **Evidencia:** A26 solo declara `search_knowledge`; no tiene un drilldown específico por mensaje/versión para recuperar el centro omitido de un extracto. El cargador compartido de playbooks pasa `storeId` a otros especialistas, pero no a A26. Su contexto propio no incluye un brief de marca versionado con cobertura explícita.
- **Mejora:** lecturas acotadas por IDs ya autorizados para contenido, estructura, enlaces y render; conocimiento y restricciones con tienda, voz, idioma, oferta y fuentes/versiones. Reutilizar la guía de marketing y conocimiento existentes, declarando ausencias y evitando imponer una voz genérica.
- **Aceptación:** un hallazgo puede investigarse sin ampliar ámbito ni cargar otra tienda. La tool no acepta una conexión arbitraria ni permite editar/publicar; RAG y textos del email se tratan como datos no confiables.

### A26-015 · Separar imagen bloqueada de diseño observado

- **Evidencia:** el worker bloquea toda petición externa y la política permite imágenes embebidas, pero no imágenes remotas ni fuentes externas. Registra `externalRequestsBlocked`; `prepareKlaviyoEmailRenderReview` no entrega ese recibo al modelo. Un email de imágenes remotas puede producir una simulación incompleta sin que la revisión visual explique por qué.
- **Mejora:** reportar disponibilidad de imágenes/fuentes, política de recursos, bloqueos y recortes junto a las capturas. Separar modo sin imágenes de una simulación con recursos acreditados. Si se habilita descarga, usar un servicio controlado, con validación de destino y recursos, conservando el aislamiento de Chromium.
- **Aceptación:** los huecos por imágenes bloqueadas no se atribuyen al diseño real del email. No se afirma revisión de fotografía, colores o producto no visibles, y mejorar la representación no elimina las protecciones de red/script existentes.

### A26-016 · Completar el ciclo asíncrono de revisión visual

- **Evidencia:** una ejecución encola el primer candidato y termina sin capturas; otra posterior puede consumirlas. La finalización del worker no reanuda la evaluación ni invalida por sí sola su caché. Los estados queued/processing pueden coexistir con una salida editorial ya pendiente de aprobación.
- **Mejora:** misión durable por pieza/versión con fases textual, render pendiente, visual disponible y revisión completa/parcial. Usar el evento de finalización para la revisión que corresponda, con deduplicación y presupuesto; permitir consumir texto útil mientras se espera.
- **Aceptación:** no hace falta lanzar otra generación completa a ciegas para descubrir una captura lista. El usuario distingue lo ya evaluado de lo pendiente, y la captura de una versión antigua no se une a un texto nuevo.

### A26-017 · Versionar y conservar recibos de render reproducibles

- **Evidencia:** el ID estable depende de ámbito/plantilla/HTML, pero no de versión del renderer ni política de recursos. La revisión devuelve un ID y número de capturas; la evidencia reside en un spool con limpieza. Se adjuntan primeras pantallas, aunque el worker produce también capturas largas acotadas; las superiores al límite de visión se omiten.
- **Mejora:** recibo con hash de HTML/captura, motor y versión, viewport, recursos, límites, fecha y retención. Vincularlo al snapshot del run; rotar la pieza visual según evidencia y necesidad. Añadir reintento con presupuesto/backoff por job, aprovechando recuperación y limpieza existentes.
- **Aceptación:** el mismo HTML se vuelve a renderizar si cambia el motor; puede explicarse por qué falta una captura. Un run histórico no aparenta contener evidencia que ya expiró, y un error persistente no crea reintentos ilimitados.

### A26-018 · Validar citas y alcance de las afirmaciones editoriales

- **Evidencia:** el prompt exige citar frases, pero el contrato genérico no valida que existan en la versión analizada. El extracto de 2.000 caracteres conserva apertura/final y el parser aporta señales estructurales; ninguno acredita el contenido omitido, la personalización resuelta o el comportamiento de un cliente de correo.
- **Mejora:** referencias a fragmentos/medidas/capturas con offsets o hash; validación de citas y dimensiones demostrables; confianza por hallazgo y cobertura. Distinguir observación, incumplimiento contrastado e hipótesis editorial. Incluir accesibilidad, CTA y contenido dinámico solo con evidencia apropiada.
- **Aceptación:** el modelo no cita una frase inexistente ni afirma ausencia de cierre porque quedó fuera del extracto. Una simulación de navegador no acredita Outlook, inbox, modo oscuro o entrega personalizada; una recomendación indica qué prueba falta.

### A26-019 · Entregar a A11 un encargo sobre la revisión exacta del email

- **Evidencia:** la salida prevista propone tareas genéricas, con nombres y descripción, sin un brief estructurado A26→A11 que incluya entidad/hash, cambio permitido y criterio de aceptación. El contexto sí recibe peers aprobados, pero esa lectura no equivale a materializar un borrador o cerrar una corrección.
- **Mejora:** handoff de revisión con fuente, objetivo, citas, cambios solicitados, límites, responsable y comprobación posterior. Reutilizar borradores/handoffs existentes y enlazar el draft de A11, su render y el resultado de revisión. Pedir nueva validación si cambió la fuente.
- **Aceptación:** una corrección llega a A11 con la pieza inequívoca y conserva lo que se pidió. La aceptación de una tarea no modifica una campaña enviada ni publica automáticamente un flow activo; el flujo de aprobación de borrador/exportación sigue vigente.

### A26-020 · Asociar el trabajo a la revisión exacta de Mi Camino

- **Evidencia:** A26 carga fases y tareas, pero el prompt pide el nombre de la fase y el contrato sigue siendo genérico. A26 no está entre los agentes con exclusión explícita de fallback al hito actual ni entre los RPC de materialización específica examinados.
- **Mejora:** plan/revisión/hito exactos cuando sean aplicables, contribución a la meta, propietario, evidencia y cierre. Revalidar al aprobar y materializar tarea/vínculo/handoff juntos; admitir trabajo libre justificado.
- **Aceptación:** cambiar Mi Camino obliga a revisar el encargo. No se elige hito por posición o semejanza del título y no queda una tarea parcialmente vinculada por un fallo posterior.

### A26-021 · Conservar identidad, vigencia y entrega en todo el ecosistema

- **Evidencia:** el resumen general de especialistas no tiene adaptador A26; el resumen de marketing conserva unos pocos títulos/descripciones de tareas como recomendaciones, sin IDs ni estado de materialización. Los consumidores usan frescuras de 30/45 días, que no acreditan que el email o el flow sigan en la misma revisión.
- **Mejora:** resumen A26 con piezas/hashes, conclusión permitida, cobertura, observaciones, handoff/tarea/draft y próximo paso. Separar memoria editorial de una evaluación vigente, y entregar a A12/A28/A05/A27/A17/A18 solo lo necesario para su misión.
- **Aceptación:** A11 no repite una corrección ya implementada; el planificador conoce responsable y bloqueo; A28 diferencia arquitectura propuesta de mensajes realmente cambiados. Un cambio de plantilla invalida la evaluación afectada sin borrar su historia.

### A26-022 · Cerrar el aprendizaje con evidencia posterior a la revisión

- **Evidencia:** el recorrido A26 examinado termina en salida/propuesta genérica. No se conserva un episodio editorial que una hallazgo, decisión, borrador aprobado, nueva versión observada y comprobación posterior; marcar una tarea completada no demuestra que el texto o destino cambiaron.
- **Mejora:** reutilizar entregables y outcomes existentes para verificar el cambio contra su fuente, registrar aceptación/rechazo/supersesión y coordinar una prueba con A12/motor de experimentación cuando proceda. Separar mejora técnica/editorial observada de efecto comercial.
- **Aceptación:** la corrección se cierra por versión/evidencia, puede reabrirse y no duplica trabajo en cada ciclo. Aumentar clics o ingresos atribuidos tras una edición no se presenta como efecto causal probado sin diseño apropiado.

### A26-023 · Hacer encontrable la revisión y su estado en la UI

- **Evidencia:** A26 tiene API y captura por run, pero no aparece montado en las páginas Klaviyo/Marketing actuales examinadas. El panel genérico no ofrece una lectura por pieza con fuente/versión, cobertura textual/visual y handoff al editor; las herramientas del dataset de juez no sustituyen esa funcionalidad de negocio.
- **Mejora:** acceso desde emails/flows y el copiloto de campañas, con resumen de la revisión, pieza y captura correspondientes, pendientes visuales, propuesta y siguiente acción A11. Vincular lectura, actualización y validación al mismo ámbito.
- **Aceptación:** se entiende qué revisó A26 y cómo solicitar una corrección. Cambiar tienda retira el resultado anterior; abrir GET o una captura no genera gasto de modelo; el cliente y el consultor reciben el detalle adecuado.

### A26-024 · Endurecer la extracción y verificar el flujo final desplegado

- **Evidencia:** `decodeEntities` llama a `String.fromCodePoint` comprobando solo finitud; el helper real lanza `RangeError` con `&#999999999;`. Las 48 pruebas existentes de contenido/cola/variantes y las 8 del worker pasan, pero no detectan el nombre de argumento SQL incorrecto, el contrato lean, el orden del flow ni el estado final multicuenta.
- **Mejora:** validar entidades Unicode y aislar errores por pieza, conservando cobertura de fallos. Añadir contratos contra PostgreSQL final, JWT por tienda/rol, fases de render y revisión/aprobación/handoff con fallos, reintentos y versiones cambiadas. Manifiesto de app/RPC/ACL/prompt/renderer y promoción por el mecanismo vigente.
- **Aceptación:** un email malformado no derriba toda la auditoría. CI detecta firmas incompatibles y regresiones de campos; las pruebas usan fixtures representativos y verifican límites de coste/consulta sin afirmar rendimiento real no medido. No se publican ni envían emails para dar por válida la auditoría.

### Evidencia de la auditoría inicial A26 (21-oct, anterior a la implementación)

- Descubrimiento por `search_graph`, `trace_path` y `get_code_snippet`, contrastado con fuente actual. El grafo conserva offsets antiguos de `ai-runtime.ts`; las conclusiones del runner y sus consumidores se basan en la fuente local vigente. Se preservaron los cambios paralelos, incluidas las secciones A25/A27 del documento.
- Superficies examinadas: runner/contratos/contexto/cron/aprobación/capturas de `ai-runtime.ts`, rutas, autorización y resolvers, inventario SQL final, versiones de plantillas, selección, HTML/texto, contenido y métricas de variantes, peers y resumen de especialistas, cola/worker/render y configuración Docker, página Klaviyo y referencias de frontend. Se contrastaron cierres históricos y la ficha de juez; no se toman como prueba de estado final.
- Lecturas remotas de configuración, firmas/retornos/hash/ACL de las tres RPC y conteos agregados en TEST/producción. Inventario MD5 `2010040a6d47e8a0397a1e3b2e6fd76c`; variantes `54b7c7c37bee4ffe94bf3d3d703c33e8`; histórico `2367a6dfec1a6d34b6f976f89e7a9e74`. Inventario y reportes permiten ejecución a `authenticated` bajo sus tablas/RLS; histórico solo a servicio. No se realizaron pruebas JWT específicas de A26 ni se afirma una fuga observada.
- Reproducción SQL sin escrituras: llamada de variantes con los nombres usados por el runner → `42883`. Reproducciones en memoria con helpers reales y datos sintéticos: el contrato lean elimina respuesta/hallazgos y repone una frase de tareas; ámbito implícito → organizativo; dos variantes de meses distintos → incluidas sin comparabilidad técnica; entidad numérica fuera de rango → `RangeError`. No representan incidentes comerciales de las cuentas.
- Pruebas ejecutadas: `npm run test:a26-html --workspace @e-nora/api`, **48/48**; `render-core.test.mjs`, **8/8**. No se añadieron pruebas para esta auditoría. El test de worker usa un navegador simulado: no acredita compatibilidad visual real entre clientes de correo.
- Fuentes primarias consultadas: documentación Klaviyo de UTM/conversiones y API/changelog omnicanal. Se comprobó la transición de revisión y la distinción de recursos; no se ejerció una cuenta Klaviyo para certificar capacidades o permisos. No hubo generación pagada, llamadas de contenido a Klaviyo, envío, publicación ni migración de A26. Ese era el estado de la auditoría inicial; el cierre siguiente sustituye su estado de implementación.

### Cierre de implementación A26 · 23-oct-2026

Se implementan los 24 puntos auditados. El código queda en el workspace compartido, sin publicar los cambios ajenos ni declarar un despliegue de aplicación que no se ha realizado. La revisión se actualiza automáticamente; la UI de A26 no ofrece «Actualizar ahora». Abrirla, recuperar capturas y consultar estados no llama al modelo. El envío a A11 requiere una revisión aprobada y crea un borrador sujeto a su aprobación habitual.

| Mejora | Implementación y comprobación |
| --- | --- |
| A26-001 | Argumentos `target_period_start/target_period_end`; llamada nominal comprobada contra PostgreSQL final. Los errores siguen siendo errores de fuente. |
| A26-002 | Diagnóstico completo, `content_decision` (`no_change`, `needs_evidence`, `revision_proposal`) y revisiones tipadas. Una abstención no puede crear tareas; proponer revisión exige evidencia. |
| A26-003 | Tienda obligatoria, cuentas con conexión elegible, autorización operacional en lectura/ejecución/aprobación/handoff/capturas; sin agregado implícito. RPC y ledger privados, denegación con dos JWT reales. |
| A26-004 | Reserva idempotente y cuota por tienda, lease recuperable, fingerprint de fuentes y progreso. El replay recupera resultado/consumo sin repetir generación. |
| A26-005 | Fecha de evaluación, inventario observado sin ventana ficticia, reporte de 365 días, estado/fecha/zona de cuenta y procedencia temporal explícitos en C2. |
| A26-006 | Aristas/ramas/esperas observadas del proveedor, alcance por flow y límites de grafo parcial. Sin prueba de topología no se infiere orden por creación ni posición. |
| A26-007 | Selección por canal conocido, mensaje, acción y padre; borradores y piezas deshabilitadas se excluyen. |
| A26-008 | Identidades compuestas y hash del paquete editorial completo, revisión semántica de origen, texto plano histórico y aviso de asunto actual/cuerpo histórico. No se acredita un envío personalizado. |
| A26-009 | Recibos de inventario, cuenta, plantillas, histórico, variantes y render; errores/cobertura parcial conservados y abstención cuando falta la fuente. Una fecha de sync no acredita todos los bloques. |
| A26-010 | Prompt canónico v8, UTM desconocido permanece `null`; tracking/atribución y resultados descriptivos se distinguen sin afirmaciones causales. |
| A26-011 | Adaptador de contenido fijado a `2026-10-15`, validación de relaciones/canal; variación de contenido no equivale a brazo experimental. Se conserva el opt-in existente. |
| A26-012 | Comparabilidad calculada en servidor; periodos incompatibles y contadores inválidos se detectan; importes retenidos si la moneda no está acreditada. |
| A26-013 | Páginas de 100, ventana de consulta de 5.000 con cursor durable, prioridades de piezas no muestreadas y digest de progreso. Muestra textual de 30, perfiles HTML de 12 y captura rotatoria. Consulta y aprobación exactas por mensaje sin el límite de esa ventana. |
| A26-014 | Tool existente `klaviyo_email_content` reparada: lectura por cuenta/mensaje y fragmentos, continuación y misma revisión/hash; conocimiento y guía de marca acotados con versiones de perfiles. |
| A26-015 | Política sin red/scripts, recursos bloqueados, recortes y límites acompañan la captura; evidencia visual autorizada solo para la pieza con imagen adjunta. |
| A26-016 | Recibo durable y reconciliación del worker sin llamada al modelo; UI separa captura pendiente/lista/fallida/no disponible y lo incluido en el diagnóstico de la revisión humana posterior. |
| A26-017 | ID con política v2, hashes de HTML y PNG, viewports, fecha y retención de artefactos de 24 horas. Reintentos con backoff y presupuesto de tres, conservado al limpiar capturas. |
| A26-018 | Citas literales validadas contra el campo o fragmento recuperado de la misma revisión; dimensión, hipótesis/hecho y confianza. Sin imagen/perfil no se admiten hallazgos visuales/estructurales. |
| A26-019 | Encargo aprobado A26→A11 con IDs/hash/revisión/cambio permitido/cierre. Revalidación antes y después del modelo y dentro de la transacción que enlaza el borrador; replay repara un enlace interrumpido y evita duplicación. |
| A26-020 | Materializador específico con bloqueo, deduplicación y validación de plan/version/revision/hito exactos; tarea y vínculo atómicos, sin fallback a un hito supuesto. |
| A26-021 | Peers y planificadores reciben IDs, hash y estados de entrega/tarea/borrador. La memoria histórica se etiqueta como pendiente de revalidación de fuente; A11 comprueba la fuente actual antes de generar. |
| A26-022 | Ledger de episodios, supersesión por cambios, cierre humano con nota y versión exacta de borrador, sin conclusión o reapertura. La comprobación editorial no equivale a envío ni mejora comercial causal. |
| A26-023 | Panel compartido en Klaviyo y detalle de email; accesos desde flows/campañas, lectura por pieza, captura, preparación A11 y comprobación editorial. Cambio de ámbito reinicia el estado. |
| A26-024 | Unicode inválido no derriba el análisis; contratos finales SQL, pruebas de selección/citas/render, JWT reales, fixtures multicuenta y de catálogo grande, y paso A26 incorporado al workflow de calidad. |

**Base de datos:** migraciones `20270110120000`, `20270110120100`, `20270110120200`, `20270110120300`, `20270110120400`, `20270110120500`, `20270110120600`, `20270110120700` y `20270110120800`, aplicadas individualmente mediante `db:push` y `db:push:prod`. Se comprobó su registro en ambos historiales. A26 **v8** activo en ambos, herramientas `search_knowledge` y `klaviyo_email_content`; SHA256 del prompt `d9b1000dfefc406bb52f8c7cf6651fb3cd215f174ec75fa0b358c8218108749a`. Las cuatro tablas A26 tienen RLS y acceso de servicio; las RPC de inventario, materialización, lease, reserva y enlace deniegan ejecución a `authenticated`. Trigger de enlace de borrador presente en ambos.

**Verificación:** contratos A26 **9/9**, HTML/variantes/cola/peers **50/50**, contrato de salida IA **3/3**, worker de render **8/8** e integración TEST **8/8**. Esta última verifica paginación y separación multicuenta, denegación JWT, leases/cuotas, progreso de muestreo, mensaje posterior a los primeros 5.000, materialización/replay/fuente modificada, enlace atómico y reparación de borrador, y cierre por versión. Regresión compartida de entregas, contexto de especialistas, idempotencia, planificación y autorización: **62/62**. Las pruebas usan rollback y eliminan los usuarios Auth temporales. Build de paquetes y tipos de API/web comprobados; sin generación pagada ni envío/publicación de emails.

**Límites de cierre:** la aplicación y el worker modificados necesitan su despliegue habitual para que producción ejecute este código. No se certifica el render con Chromium real ni compatibilidad de clientes de correo: el test del worker utiliza navegador simulado. El adaptador estable no se ejerció contra contenido real del proveedor. No se ha medido rendimiento comercial ni una carga representativa de producción. La cobertura es una muestra progresiva, condicionada a la programación y al presupuesto del agente; no un análisis íntegro en una sola ejecución.

**CI global del workspace:** A26 pasa sus suites; `npm run verify` sigue fallando por promociones directas de A09/A11/A15/A23/A25, funciones `returns table` sin drop en A11/A14/A23, clasificación RLS de `marketing_mailing_delivery_receipts` y pruebas ajenas no registradas. La suite global de IA también presenta fallos en contratos/prompts de otros agentes. Estos resultados no se presentan como CI verde; se preservan los trabajos paralelos.

## A27 · Planificador de mailing: estrategia, producción y seguimiento

**Auditoría: 21-oct-2026. Implementación local actualizada: 23-oct-2026.** La auditoría histórica se conserva debajo. Las mejoras se han llevado al código y a una migración local; el estado por punto, las comprobaciones y los límites de cierre figuran al final de esta sección. A26 pertenece a la intervención paralela.

A27 dirige la secuencia: decide el arco, la cadencia y el papel de cada email. A11 compone los borradores; A26 audita contenido enviado y no debe convertirse en un paso previo de generación. A12 aporta medición y resultados; A28 aporta arquitectura de automatizaciones. La aprobación del cliente y la revisión del consultor deben respetar la decisión vigente del producto: la opinión del consultor no constituye un veto al envío manual del cliente. No se propone restaurar ese veto.

### Base verificada y prioridades

Ya existen planificación persistida, aprobación humana, idempotencia de borradores por secuencia/email, recuperación parcial, checkpoints del grafo, revisión determinista y límites de reintento. A27 no envía emails por sí mismo. El playbook privado devuelve como máximo cuatro principios resumidos y omite nombres, identificadores de fuentes, ejemplos y HTML original. Hay comprobación de derechos al publicar referencias. Estas garantías deben conservarse.

| Prioridad | Mejoras | Resultado esperado |
| --- | --- | --- |
| P1 | A27-001 a A27-011 | Alcance consistente, fechas aprobadas, concurrencia segura, recuperación y estados verificables. |
| P1 | A27-012 y A27-013 | Evidencia financiera y cobertura que no conviertan ausencia en éxito o fracaso. |
| P2 | A27-014 a A27-023 | Decisiones justificadas, coordinación, recursos válidos, continuidad de UI y aprendizaje trazable. |
| P3 | A27-024 | Cierre verificable con contratos finales, permisos y recuperación del flujo completo. |

### A27-001 · Unificar autorización y alcance operativo de tienda

- **Evidencia:** las rutas del planificador usan membresía organizativa y `canAccessMarketingWorkspace`; `resolveMarketingBrandProfileStore` valida la conexión activa de Shopify, pero permite no indicar tienda. El grafo autoriza mediante `resolveThreadActor` y su comprobación opcional de tienda compara el identificador recibido con la secuencia. Las cuentas con acceso solo a una tienda quedan excluidas por ese resolver; el test existente lo confirma. La proyección de emails aplica RLS organizativa. Esto no demuestra acceso cruzado de una cuenta limitada a tienda.
- **Mejora:** aplicar el contrato compartido de tienda operativa y sus permisos a crear, leer, aprobar, reanudar, revisar y cancelar. Definir explícitamente qué operaciones admiten alcance organizativo y cuáles requieren tienda; resolverlo desde la secuencia, no solo desde un filtro opcional de la petición.
- **Aceptación:** dos tiendas, membresía organizativa, acceso solo a tienda y roles de cliente/consultor/administrador producen resultados coherentes en todas las rutas. Cambiar el UUID de secuencia o el `store_id` no amplía permisos; GET y recuperación no generan gasto.

### A27-002 · Vincular la estrategia con la revisión exacta de Mi Camino

- **Evidencia:** `runWeeklyMailingPlanner` resuelve `targetStoreId`, pero llama a `loadOpenTasksBlock` y `loadPlanPhasesBlock` solo con `organizationId`. Otros bloques sí filtran tienda. El output contiene objetivos narrativos, sin un vínculo verificable con la versión de plan, hito o meta comercial aprobados.
- **Mejora:** propagar la tienda a tareas y fases, y adjuntar identidad y revisión del objetivo vigente cuando exista. Explicar qué contribución pretende la secuencia y qué condiciones del plan la limitan; permitir planificación independiente si se declara expresamente. A27 no debe crear tareas ni escoger hitos por coincidencia de título.
- **Aceptación:** una tarea de otra tienda no entra en el contexto. El usuario puede abrir el objetivo que justificó la secuencia; sustituir el plan invalida o requiere revisar las decisiones afectadas sin reescribir su historia.

### A27-003 · Validar fechas reales y fijar zona horaria y hora de tienda

- **Evidencia:** `readWeeklyMailingPlannerRequest` valida fechas mediante expresión regular, elimina duplicados y recorta a siete. Acepta `2026-02-31` y fechas pasadas en la reproducción con el helper real. La UI calcula días a las 09:00 en la zona del navegador y usa `toISOString` para obtener fechas, sin un contrato explícito de zona horaria de tienda.
- **Mejora:** validar calendario real, rango permitido, número de emails y orden; devolver errores por entradas inválidas o excedidas en lugar de descartarlas silenciosamente. Guardar fecha local, hora, zona IANA y su instante resuelto, con tratamiento explícito de cambios de horario.
- **Aceptación:** una fecha imposible se rechaza; una fecha pasada solo se admite para una función histórica expresamente prevista. Dos navegadores en zonas distintas construyen la misma programación de tienda y el usuario ve su zona y hora antes de aprobar.

### A27-004 · Hacer inmutable la programación aprobada por email

- **Evidencia:** el inicio del grafo acepta `scheduled_for` con la misma longitud que el plan y cadenas interpretables por `Date.parse`. No exige coincidencia con las fechas guardadas en `request.scheduled_dates`, ni unicidad o vigencia. Se puede cambiar la programación al iniciar la producción sin una nueva revisión del plan.
- **Mejora:** aprobar una revisión que incluya la correspondencia estable entre email y fecha/hora/zona. Resolver la programación desde esa revisión en el servidor; cualquier cambio material debe crear una nueva revisión pendiente de aprobación.
- **Aceptación:** alterar una fecha en la petición no modifica la secuencia aprobada. Reordenar emails, cambiar de zona o reanudar conserva el mismo vínculo; el servidor rechaza fechas caducadas antes de reservar generación adicional.

### A27-005 · Completar la identidad de petición y la recuperación del resultado pagado

- **Evidencia:** `sameWeeklyMailingPlanRequest` compara los campos principales, fechas e ID de plantilla, pero no su revisión/diseño ni todos los recursos de `client_state`. Cambiar el diseño manteniendo el ID devuelve la misma petición en la reproducción. La UI genera UUID diferentes entre pestañas y el retorno de una secuencia ya generada precede a algunas revalidaciones. Existen presupuestos generales de IA; no equivalen a exclusión atómica por tienda y petición efectiva.
- **Mejora:** huella canónica de organización, tienda, entradas efectivas, versiones de recursos y contrato; distinguir repetición de regeneración intencionada. Reservar cuota de forma atómica y conservar el resultado del run para reparar la escritura de la secuencia sin otra llamada al modelo.
- **Aceptación:** reintentar la misma clave devuelve el mismo resultado; reutilizarla con entradas diferentes devuelve conflicto. Dos pestañas no cobran dos veces por la misma ejecución y un fallo posterior al modelo se recupera desde el output guardado.

### A27-006 · Añadir propietario y renovación a la reserva de generación

- **Evidencia:** la adquisición inicial compara estado y `updated_at`, pero la escritura final y `markGenerationFailed` filtran por `generating` sin identificar al propietario de la reserva. Tras vencer los quince minutos, una ejecución anterior puede volver y modificar una generación reclamada por otra.
- **Mejora:** token de ejecución/reserva, vencimiento y renovación; toda escritura final, fallo y liberación debe comprobar ese token y la revisión esperada. La recuperación debe reconocer resultados ya generados antes de repetir trabajo pagado.
- **Aceptación:** un trabajador antiguo no puede guardar ni marcar fallida la ejecución nueva. Un proceso vivo renueva su reserva; una caída permite reclamarla y recuperar el resultado sin duplicar la secuencia.

### A27-007 · Proteger también la reserva del grafo frente a trabajadores antiguos

- **Evidencia:** `claimLease` usa `graph_lease_until`, sin propietario o renovación; `runExclusive` limpia la reserva por identificador de secuencia en `finally`. Si vence y otro proceso la adquiere, el primero puede liberar la reserva nueva. Las escrituras posteriores no incorporan una condición de propiedad equivalente.
- **Mejora:** propietario y versión de reserva del grafo, renovación durante trabajo largo y comprobación en checkpoints, proyección, revisión y cierre. Liberar únicamente la reserva adquirida por ese proceso; las claves de idempotencia de A11 siguen siendo necesarias.
- **Aceptación:** dos procesos, una reserva vencida y una respuesta lenta de A11 no producen avances incompatibles ni permiten que el proceso antiguo libere al nuevo. La recuperación conserva el borrador ya producido.

### A27-008 · Cerrar la ventana de inicio sin checkpoint recuperable

- **Evidencia:** `startMailingCampaign` pasa la secuencia a `in_progress/graph` antes de lanzar `runExclusive` sin esperarlo. Si el proceso cae antes del primer checkpoint, puede quedar una secuencia iniciada sin emails ni checkpoint. `campaignNeedsResume('in_progress', [], now)` devuelve `false`; `advance` sale si no hay próximos nodos y repetir el inicio devuelve `already_started`.
- **Mejora:** persistir un manifiesto de arranque o trabajo pendiente antes de confirmar el inicio, y permitir reconstruir idempotentemente el estado inicial cuando falte el checkpoint. El recuperador debe distinguir terminado de nunca inicializado.
- **Aceptación:** detener el proceso después de cambiar el estado y antes de invocar el grafo no deja la secuencia bloqueada. Reiniciar el worker la descubre y continúa una sola producción por email.

### A27-009 · Vincular la aprobación a run, output y revisión del plan

- **Evidencia:** A27 mantiene `required_before_publish` y el runner general guarda un output `pending_approval`. Después se valida y guarda el plan de secuencia. La tabla de secuencias no incluye referencias a run/output/revisión; aprobar la estrategia mediante inicio o cambio de estado no actualiza ese output. La memoria compartida solo lee outputs aprobados/publicados. Una validación posterior fallida también puede dejar persistido el output previo.
- **Mejora:** relación explícita secuencia-revisión-run-output, validación completa antes de declarar éxito y aprobación atómica del contenido exacto mostrado. Registrar actor, fecha y decisión; reparar estados intermedios sin regenerar texto. Separar aprobación de estrategia y revisión de cada borrador.
- **Aceptación:** aprobar una revisión deja un único recibo y hace elegible la estrategia correcta para memoria. Cambiar el plan invalida la aprobación anterior; un output rechazado por validación no aparece como plan utilizable.

### A27-010 · Centralizar transiciones y cancelación con control de concurrencia

- **Evidencia:** `updateWeeklyMailingPlanSequenceStatus` comprueba estados antes de actualizar, pero el UPDATE final no exige estado/revisión esperados ni incorpora el orquestador. Dos peticiones concurrentes pueden superar la misma comprobación. Abandonar una secuencia del grafo no garantiza que los nodos que ya leyeron su estado dejen de producir borradores.
- **Mejora:** una máquina de estados por secuencia/orquestador con transiciones condicionales, revisión y recibo. Cancelación visible para cada nodo antes de nuevas operaciones pagadas, conservando los borradores existentes y explicando los trabajos que ya estaban en curso.
- **Aceptación:** completar y abandonar simultáneamente produce una sola transición válida. Una cancelación impide comenzar el siguiente email; reanudar no resucita una revisión terminal ni cambia de orquestador accidentalmente.

### A27-011 · Definir terminación y verificar todas las escrituras de cierre

- **Evidencia:** `weeklyMailingDraftsAreComplete` exige las claves por email y alguna fecha, sin comprobar estado, fecha aprobada, tienda o revisión. Un borrador rechazado con fecha de 1900 cuenta como completo en la reproducción. El navegador asigna fechas antes de la aprobación del borrador. El grafo cierra como `completed` si hay al menos un email programado aunque otros estén rechazados; `closeCampaign` no comprueba el error de su UPDATE antes de marcar el cierre interno.
- **Mejora:** distinguir producción completa/parcial, revisión pendiente, aprobación, fecha prevista local y envío confirmado por proveedor. Validar identidad, revisión y programación exactas según la transición; comprobar errores y reconciliar proyección, checkpoints y secuencia cuando una escritura falle.
- **Aceptación:** rechazo, fecha incorrecta o email ausente no cumplen una terminación que exija aprobación. Un fallo de base de datos no se presenta como cierre confirmado; la UI explica resultados parciales y nunca convierte una fecha local en evidencia de envío real.

### A27-012 · Conservar ausencia, cuenta y moneda en la evidencia de resultados

- **Evidencia:** `summariseEmailForAgent` y el helper de aprendizajes convierten métricas nulas en cero. La reproducción con entregados suficientes y revenue/clics/opens ausentes produce tasas e ingresos cero. La RPC vigente devuelve mes y métricas, sin identidad monetaria o cuenta en cada fila; los resúmenes pueden agregar importes sin esas dimensiones. Una instrucción global sobre moneda no corrige una suma ya mezclada.
- **Mejora:** reutilizar el contrato de medición de A12: `unknown` separado de cero, cuenta seleccionada, moneda, denominador, cobertura y definición de ingreso atribuido. Agregar solo grupos comparables; mantener métricas no financieras útiles cuando falte moneda.
- **Aceptación:** ausencia de revenue no clasifica una campaña como fracaso comercial. Dos monedas no se suman; la estrategia muestra qué datos sostienen cada comparación y no equipara atribución a beneficio ni incrementalidad.

### A27-013 · Describir el periodo y la muestra que realmente devuelve cada fuente

- **Evidencia:** el runner pide dos ventanas de noventa días con un límite compartido, mientras la definición final de `klaviyo_email_report` consume informes enteramente contenidos y devuelve `bucket_month`, no el intervalo real de cada informe. Las etiquetas del resumen no acreditan noventa días completos. La madurez del aprendizaje se infiere por mes más siete días y el ranking principal puede seguir incluyendo muestras pequeñas o inmaduras. Clasificar por posición también puede situar una misma campaña entre mejores y peores cuando hay muy pocas elegibles.
- **Mejora:** intervalos efectivos sin solapamiento, cobertura/sincronización, muestra y madurez de atribución desde la fuente. Aplicar elegibilidad coherente a todos los rankings y etiquetar ordenaciones descriptivas; exigir umbrales explícitos para afirmar un aprendizaje de éxito o fracaso.
- **Aceptación:** una ventana parcialmente cubierta no aparece como comparación completa. Una sola campaña no se presenta como patrón ganador y perdedor; ausencia, cero y dato inmaduro producen recomendaciones distintas.

### A27-014 · Incorporar una decisión explícita de no producir o pedir información

- **Evidencia:** el contrato de plan exige entre uno y siete emails. Admite fuentes vacías, confianza alta y experimento listo; la reproducción valida esa combinación. El prompt solicita una secuencia conservadora del número fijado incluso con poca información. `requires_user_approval` es un campo del modelo, aunque la aprobación general permanece obligatoria.
- **Mejora:** decisión tipada `ready`, `needs_input`, `hold` o `no_send`, motivos verificables y preguntas mínimas. Reglas del servidor para confianza y preparación cuando falten requisitos; la política de aprobación no debe depender de un booleano generado.
- **Aceptación:** falta de oferta válida, conflicto relevante o evidencia insuficiente puede terminar en una recomendación de esperar sin pagar A11. Un plan listo conserva soporte por decisión y no puede autodeclararse exento de aprobación.

### A27-015 · Acreditar oferta, audiencia y compatibilidad de cadencia

- **Evidencia:** objetivo, oferta y audiencia son texto libre. A27 recibe resúmenes y calendario, pero no un contrato de segmentos elegibles, exclusiones o exposición por destinatario entre campañas y flujos. El prompt prohíbe inventar stock, descuentos o segmentos; esa prohibición no acredita su existencia ni permite medir fatiga con agregados mensuales.
- **Mejora:** separar audiencia propuesta de segmento verificado; referencias fechadas para promociones, productos, existencias, límites y URLs cuando se usen como hechos. Declarar qué conflictos de calendario se comprobaron y cuáles requieren validar exposición/supresiones al preparar el envío manual.
- **Aceptación:** no se inventan escasez ni descuentos. La UI muestra las condiciones pendientes; no afirma que no hay solapamiento o fatiga por carecer de datos. La composición conserva esas restricciones hasta la revisión del borrador.

### A27-016 · Transmitir a A11 las restricciones y el experimento aprobados

- **Evidencia:** `buildWeeklyMailingEmailBrief` conserva diagnóstico, justificación, dirección visual y campos del email, pero no transmite íntegramente experimento, criterios de éxito/parada, cadencia y referencias de evidencia. La reproducción con marcadores de éxito/parada confirma su pérdida. Esos campos son principalmente texto libre, sin contrato ejecutable de evaluación.
- **Mejora:** paquete de producción versionado por email con objetivo, hipótesis, audiencia, restricciones, fuentes y revisión aprobada. Tipar métrica principal, denominador, ventana, cohorte, umbrales, guardrails y fecha/responsable de revisión cuando haya un experimento; conservarlo en el handoff y el recibo del borrador.
- **Aceptación:** A11 recibe y respeta los límites aprobados; un cambio de versión exige revisar el resultado afectado. A12 puede evaluar el criterio original y la parada sin deducirlo de la prosa ni atribuir causalidad a una comparación descriptiva.

### A27-017 · Separar memoria histórica de decisiones vigentes y corregir el contexto entre agentes

- **Evidencia:** el resumen especial `mailing_strategy` conserva solo los primeros cinco emails y omite experimento, éxito/parada y vínculo de revisión/ejecución. El contexto de A27 no fija antigüedad máxima; un output aprobado del año 2000 entra en el helper real. El listado de agentes consultados por `loadMarketingPeerHistory` excluye A05 aunque el prompt y el conjunto de relevantes lo mencionan.
- **Mejora:** incluir A05 cuando corresponda; conservar revisión, vigencia, estado real y resumen de condiciones/experimento, declarando recortes. La memoria histórica puede orientar, pero cualquier decisión vigente debe resolver otra vez aprobación, alcance y restricciones actuales.
- **Aceptación:** los siete emails se representan o se indica cuántos se omitieron. Una estrategia antigua no autoriza una oferta actual; A27 puede distinguir una propuesta aprobada de una secuencia producida o enviada.

### A27-018 · Distinguir fallo de fuente, vacío real y contexto recortado

- **Evidencia:** errores de algunas consultas de calendario, borradores y peers se degradan a listas vacías. Hay límites sin manifiesto de cobertura: treinta borradores antes de filtrar emails, treinta eventos futuros y cien peers/entradas de playbook. El calendario por inicio futuro puede omitir campañas ya activas que se solapan con las fechas pedidas.
- **Mejora:** manifiesto compacto por fuente con estado, tienda, intervalo, frescura, recorte y siguiente página. Filtrar tipo y alcance antes del límite; consultar solapamiento del horizonte solicitado. Recuperar solo el detalle necesario, manteniendo límites de coste/contexto.
- **Aceptación:** un fallo de calendario se comunica como comprobación pendiente, no como ausencia de conflictos. Muchos borradores de otros canales no ocultan los emails relevantes y el plan no presume haber inspeccionado toda la historia cuando solo leyó una muestra.

### A27-019 · Validar recursos efectivos sin reingerir el corpus privado

- **Evidencia:** la plantilla principal se vuelve a cargar y valida como global o de la conexión elegida, una garantía existente. La identidad de petición solo conserva su ID; recursos secundarios/imágenes no tienen un recibo común de revisión/disponibilidad. La UI consulta plantillas por organización y puede mostrar una opción de otra tienda que el backend rechace. El playbook ya tiene proyección privada y corpus ingerido.
- **Mejora:** prevalidar recursos elegidos contra tienda, derechos, disponibilidad y revisión; guardar sus identidades y versiones efectivas para producción. Mejorar selección del playbook antes del límite, conservando la proyección de principios y los controles de publicación. No releer originales ni volver a ingerir el corpus para esta mejora.
- **Aceptación:** una plantilla ajena a la conexión no aparece como utilizable; retirar o cambiar un recurso obliga a resolverlo antes del siguiente coste. Ni el modelo ni el cliente reciben originales, nombres privados o ejemplos del corpus como resultado de mejorar trazabilidad interna.

### A27-020 · Descubrir secuencias pendientes sin depender de localStorage

- **Evidencia:** la recuperación del navegador guarda un puntero por organización/tienda. Existe GET por UUID conocido, pero no una bandeja paginada para descubrir las secuencias pendientes desde otro dispositivo o después de perder el almacenamiento local.
- **Mejora:** listado autorizado por tienda con estado real, revisión, próxima acción y coste ya incurrido; retomar, revisar o cancelar desde allí. Usar localStorage como comodidad y reconciliarlo con el servidor.
- **Aceptación:** limpiar el navegador o cambiar de equipo no pierde una secuencia ni obliga a pagar un plan nuevo. La bandeja recupera estados parciales y errores de inicialización; leerla no llama al modelo.

### A27-021 · Aislar formularios, cachés y respuestas al cambiar de contexto

- **Evidencia:** el efecto de cambio de organización/tienda limpia plan y secuencia, pero no reinicia todos los recursos, selección y `hasLoadedTemplates`. El cargador de plantillas depende de organización y una carga previa puede evitar la consulta nueva. La generación tampoco protege toda actualización de UI mediante una identidad de contexto capturada. Las validaciones del backend no prueban que haya ocurrido una escritura entre organizaciones.
- **Mejora:** una clave de contexto para organización/tienda, reinicio completo de recursos pertinentes y cancelación o descarte de respuestas anteriores. Alinear cachés y consultas de plantillas con su alcance real, conservando borradores recuperables por su propio contexto.
- **Aceptación:** cambiar de tienda durante una consulta o generación no dibuja el plan anterior ni reutiliza sus recursos. Volver a la tienda original permite recuperar su trabajo; no se pierde por una respuesta tardía de otro contexto.

### A27-022 · Alinear grafo, UI y documentos con la política de revisión vigente

- **Evidencia:** el grafo contempla espera de revisión del consultor para la planificación local si está asignado. ADR0025 describe una parada previa, mientras la decisión posterior documentada en `klaviyo.ts` permite al cliente aprobar y enviar manualmente y define la revisión del consultor como opinión sin veto. Son superficies con semántica distinta que no deben confundirse.
- **Mejora:** declarar por separado quién aprueba estrategia, quién revisa contenido, qué significa una opinión pendiente y quién programa/envía en el proveedor. Reflejar la política vigente en textos, grafo y documentación; mantener A26 como auditoría posterior al envío y revisión determinista previa donde corresponda.
- **Aceptación:** el cliente entiende qué puede hacer y qué espera revisión. La UI no presenta la opinión del consultor como veto al envío manual; completar el grafo no afirma que Klaviyo haya programado o enviado nada.

### A27-023 · Conectar producción y resultados mediante recibos, no por similitud de nombres

- **Evidencia:** A27 conoce estrategia y borradores locales, pero no tiene un recibo propio que una revisión aprobada, asset de A11, audiencia real, campaña/mensaje del proveedor, envío y resultado maduro. Aprobar un output o poner una fecha no acredita ejecución. Los resúmenes compartidos omiten parte de ese estado.
- **Mejora:** cadena de referencias secuencia/revisión/email/borrador/revisión de contenido/campaña-mensaje con alcance de cuenta y tienda. Incorporar confirmación real del envío cuando exista y resultados de A12/A26 por esa identidad; distinguir no enviado, no medible, inmaduro y evaluable. A05 y A28 reciben el estado pertinente sin apropiarse de la misma ejecución.
- **Aceptación:** se puede explicar qué se aprobó, qué se produjo, qué se envió y qué resultado se observó. Renombrar campañas no rompe el vínculo; la siguiente estrategia aprende de resultados maduros y no de la mera aprobación o de revenue asignado a otra campaña.

### A27-024 · Cerrar con pruebas del contrato final y recuperación completa

- **Evidencia:** las cinco suites existentes ejecutadas pasan: 40/40. Incluyen contratos y dobles del grafo, pero no detectan los casos negativos reproducidos en esta auditoría. Los metadatos remotos confirman migraciones y prompt; no demuestran el build desplegado, permisos con JWT reales ni una secuencia conectada completa.
- **Mejora:** cobertura focalizada de calendario/zona, identidad de recursos, métricas nulas/moneda, aprobación versionada, carreras de estado, reserva vencida y caída antes del primer checkpoint. Validar contra PostgreSQL con migraciones finales, roles y dos tiendas; recorrer plan-aprobación-A11-revisión-programación local y reconciliación de resultados. Manifiesto de release con contratos, esquema, prompt, flags y worker.
- **Aceptación:** CI detecta el trabajador antiguo que intenta escribir y la secuencia sin checkpoint. Las pruebas del flujo distinguen producción de envío y resultado; una validación conectada posterior conserva recibos sanitizados. No es necesario generar con modelos pagados ni enviar emails para cerrar esta auditoría documental.

### Coordinación que debe conservar la implementación de A27

| Relación | Contrato esperado |
| --- | --- |
| Mi Camino → A27 | Tienda, objetivo/hito y revisión vigentes, restricciones y contribución prevista. |
| A05 / A28 → A27 | Campañas y arquitectura pertinentes, vigencia y estado confirmado; aprobación no significa despliegue. |
| A27 → A11 | Paquete aprobado por email, fechas, recursos, restricciones y criterio de evaluación sin pérdidas. |
| Producción / cliente / consultor | Estado y recibo de cada decisión; política actual de revisión, sin convertir opinión en veto. |
| Envío → A12 / A26 → A27 | Campaña/mensaje real, revisión enviada, cobertura, madurez, auditoría posterior y aprendizaje atribuible a esa secuencia. |

### Evidencia y límites de esta auditoría A27

- Descubrimiento mediante `search_graph`, `trace_path` y `get_code_snippet`, contrastado con el código local vigente. El índice del runtime tiene posiciones desactualizadas; se recurrió a lectura local para confirmar esos bloques, sin reconstruirlo. No se generó un corpus nuevo ni se reingirió el playbook.
- Superficies revisadas: runner y rutas A27, `marketing-mailing-sequence.ts`, aprendizajes, peers, playbook, contratos de `packages/ai`, planificador web y panel de campaña, grafo/checkpointer/review, contratos compartidos, worker de reanudación, migraciones y ADR0025. `REVISION_AGENTES.md` conserva cierres históricos que deben contrastarse con el estado final.
- TEST y producción: A27 activo v5, modelo `claude-sonnet-5`, aprobación `required_before_publish`, prompt coincidente con MD5 `c89d7f7963ff5d2131bdcfbc9c50ef74`. Se consultaron esquema, políticas, historial y conteos sin modificar datos ni leer contenido de compradores.
- En ambos entornos figuran aplicadas las migraciones A27 de definición/orquestación, playbook, runs, decision brief, idempotencia, reanudación y reserva, además de `20261209100000_mailing_campaign_graph` y `20261210100000_mailing_campaign_graph_hardening`. La migración A12 `20270101110000` también figura aplicada. La RPC final `klaviyo_email_report(uuid,date,date,uuid)` coincide en ambos, MD5 `f367bf58cbe2c4b8d1985fb95fe67889`, sin `SECURITY DEFINER`; su contrato final no devuelve moneda ni cuenta por fila.
- Las tablas de secuencias, checkpoints, writes, emails y playbook tienen RLS. La política encontrada para la proyección de emails es SELECT organizativo mediante `private.can_access_org`; las otras tablas de este grupo no exponen políticas autenticadas. Esto no sustituye una prueba de permisos usando JWT por rol/tienda.
- TEST presenta dos runs A27 completados y dos outputs pendientes de aprobación, una secuencia `planned/browser` y cero filas de checkpoint/emails del grafo. Producción no presenta runs, outputs o secuencias A27, ni filas de checkpoint/emails. Son conteos de esta lectura; no prueban el estado de flags, conexiones ni el build desplegado.
- Pruebas ejecutadas: `marketing-mailing-sequence.test.ts`, `marketing-mailing-learnings.test.ts`, `mailing-campaign-graph.test.ts`, `mailing-campaign-contract.test.ts` y `marketing-peer-history.test.ts`: **40/40 correctas**. No se añadieron tests ni cambios de aplicación en esta pasada.
- Reproducciones en memoria con helpers reales y datos sintéticos: fecha imposible/pasada aceptada; diseño de plantilla distinto considerado misma petición; borrador rechazado con fecha equivocada considerado completo; grafo sin proyección no marcado para reanudar; métricas nulas convertidas a cero; peer del año 2000 incluido; plan listo con confianza alta y fuentes vacías aceptado; éxito/parada omitidos del brief A11. La aprobación general sigue siendo obligatoria. Estos casos no demuestran incidentes reales de usuarios.
- Los riesgos de concurrencia, caída de proceso y escritura fallida se identifican por recorrido de código; no se provocaron en los entornos remotos. No se aprobaron outputs, no se enviaron emails, no se ejecutó generación pagada y no se aplicaron migraciones. Esta pasada modifica únicamente el registro documental de A27 y conserva el trabajo de la otra intervención.
- **Siguiente agente tras A27: A28, arquitecto de flujos.** El estado posterior de implementación de A27 consta a continuación; esta intervención no inicia otra auditoría de A28.

### Implementación local de A27 · 23-oct-2026

**Estado: código y migración preparados y comprobados localmente; despliegue y aceptación conectada pendientes.** Esta actualización conserva la evidencia de la auditoría del 21-oct. No convierte las comprobaciones con dobles o PostgreSQL aislado en una certificación del entorno desplegado.

| Punto | Implementación y límite verificable |
| --- | --- |
| A27-001 | `requireMailingAccess` aplica tienda operativa y rol a planificación, lecturas, grafo, estado, recursos, programación y recibos. Las rutas A11 usadas por el recorrido comprueban el ámbito resuelto. La proyección del grafo pasa a ser de servicio: su anterior SELECT organizativo deja de ofrecer una lectura autenticada alternativa. Hay pruebas de contexto limitado a tienda; faltan JWT reales del recorrido completo. |
| A27-002 | Tareas y Mi Camino reciben la tienda. Se conserva el plan aprobado y su versión en `context_snapshot`; la UI muestra la referencia y permite consultar Mi Camino. A11 recibe referencia y contribución prevista. Sin plan, la secuencia se declara independiente; no se crean tareas ni se eligen hitos por semejanza. Un cambio de plan bloquea la producción. |
| A27-003 | Fechas de calendario reales, únicas, entre una y siete, ordenadas, futuras. Instantes a las 09:00 en la zona IANA de la tienda mediante el resolver existente, incluidos sus controles de horario estacional. El navegador calcula días de calendario sin convertirlos desde su zona local. |
| A27-004 | Revisión y programación guardadas por el servidor; el arranque usa esas fechas. Se rechazan otra revisión, otros instantes o fechas vencidas antes de producir/programar. |
| A27-005 | Huella canónica SHA-256 de entradas, contrato, diseño, recursos, imágenes y literales; índice único para la petición viva por organización/tienda. La recuperación busca un output exitoso ya pagado antes de repetir modelo y valida estructura y numeración. |
| A27-006 | Reserva de generación con token propio, revisión, renovación y escrituras condicionales. Un token antiguo no guarda el plan. Los fallos de recuperación liberan el estado a `failed`; cancelar invalida los tokens. |
| A27-007 | Bootstrap del grafo guardado con la aprobación antes del primer checkpoint. La reanudación cubre campañas sin proyección, ordena establemente y conserva el propietario de la ejecución. |
| A27-008 | RPC con bloqueo breve de secuencia y comprobación de token para checkpoints, writes, proyección, rechazo automático, programación, cierre y finalización de A11. Se prueba que el propietario antiguo no finaliza un borrador ni libera la reserva nueva. No se mantiene una transacción abierta durante el modelo. |
| A27-009 | Estado y revisión comprobados en cada transición, cancelación explícita y cierre bajo bloqueo. El navegador no puede cerrar el grafo por su cuenta; la cancelación impide sus siguientes escrituras. |
| A27-010 | `approve_mailing_sequence` enlaza revisión, actor, output y run exactos; aprueba estrategia y secuencia en una transacción y admite replay idempotente. No se sustituye la aprobación humana por un booleano del modelo. |
| A27-011 | `completed`, `partial` y `abandoned` reflejan la producción; el navegador exige todos los borradores esperados con tienda/fecha correctas y estado admisible. `scheduled` se presenta como «Fecha prevista guardada». La revisión y el envío real se conservan como pasos distintos. |
| A27-012 | Ausencia permanece `null`; se conserva cuenta, moneda e intervalo. No se suma revenue de monedas incompatibles ni se convierte su ausencia en cero. Las observaciones no se presentan como beneficio o incrementalidad. |
| A27-013 | Ventanas de tres meses completos sin solapamiento, intervalos observados y manifiesto de recortes. Rankings con muestra mínima de entregados y margen conservador de madurez; sin alerta de fracaso por ocupar el último puesto. El margen de siete días del helper no acredita la ventana real de atribución configurada en cada cuenta. |
| A27-014 | Decisiones `ready`, `needs_input`, `hold`, `no_send`; las tres últimas exigen motivos y cero emails. Evidencias referenciadas al registro de fuentes recuperadas y herramientas exitosas. Sin fuentes no hay confianza alta ni experimento listo; contexto esencial no disponible impide un plan `ready`. |
| A27-015 | Audiencia propuesta identificada como pendiente de segmento, exposición y supresiones. Oferta, stock y cadencia se transmiten como condiciones que deben comprobarse; se conserva la prohibición de inventarlos. No se afirma elegibilidad individual desde agregados mensuales. |
| A27-016 | Paquete A27→A11 reconstruido en servidor: restricciones, recursos, fuentes, cadencia, éxito/parada y experimento. Evaluación tipada con cohorte, denominador, ventana, muestra, unidad/moneda, umbrales y revisión. Tasas entre cero y uno; los campos adicionales del cliente no sustituyen el paquete aprobado. |
| A27-017 | A05 incluido en peers, frescura por especialista y siete emails en el resumen. A05/A28 y los demás consumidores reciben la secuencia/revisión, estado de producción y recibos mediante el resumen A27. Una aprobación histórica sigue etiquetada como ejecución no acreditada. |
| A27-018 | Manifiesto por fuente con error/vacío/recorte, ámbito y periodos; filtro de email anterior al límite y calendario por solapamiento del horizonte. Fallos de calendario, guía o contexto estratégico no se presentan como comprobación satisfactoria. |
| A27-019 | Plantillas por ámbito y `updated_at`; imágenes por ID, revisión, checksum, pertenencia a tienda y versión/disponibilidad del archivo. Autorización explícita para publicar su copia como recurso del email; copia con hash y sin sobrescritura en `marketing-assets`, sin URLs temporales en HTML. Selección lexical del playbook antes del límite y proyección de principios privada. No se reingiere el corpus. |
| A27-020 | Bandeja paginada por tienda para recuperar secuencias desde el servidor, con estados y revisión. `localStorage` conserva únicamente una comodidad de acceso; leer o recuperar no llama al modelo. |
| A27-021 | Reinicio de formulario/recursos/cachés por organización y tienda, consultas de plantillas e imágenes con ese ámbito, clave de contexto y descarte de respuestas antiguas. El bucle del navegador deja de lanzar nuevas operaciones al cambiar de contexto. |
| A27-022 | La aprobación del cliente continúa hacia la fecha local. La opinión del consultor se registra sin veto, revocación ni generación automática. Se actualizan grafo, UI y ADR-0025; A26 conserva su función posterior al envío. |
| A27-023 | Recibo inmutable por secuencia/revisión/email/borrador/versión y cuenta/campaña/mensaje enviado, con vínculo manual idempotente y autorizado. UI de asociación con mensajes importados de la tienda. A12/A27 reciben identidades y criterio original. Se distinguen envío no confirmado, criterio ausente, ventana inmadura y pendiente de comprobar métricas/muestra. `content_match_status=unverified`: falta acreditar igualdad del contenido enviado y no se declara efecto causal. |
| A27-024 | Pruebas focalizadas, PostgreSQL aislado con reaplicación de la migración, roles y fallos de reserva/aprobación/cancelación; CI ejecuta el contrato SQL con PGlite fijado a `0.5.11`. Quedan la prueba conectada con JWT, navegador/Storage real, medición de rendimiento y comprobación del despliegue. |

### Comprobaciones de esta implementación

- **59/59** pruebas focalizadas: secuencia, aprendizajes, producción A27→A11, grafo, contrato del grafo, peers y playbook. Incluyen cambio de calendario/Mi Camino/guía, intento de sustituir el paquete, recursos retirados o de otra tienda y madurez de la observación.
- **7/7** pruebas de PostgreSQL aislado en `scripts/a27-mailing-db.test.mjs`. Se ejecuta el SQL real de A27 sobre un esquema mínimo de dependencias y se aplica dos veces. La finalización común de A11 usa un stub en esta prueba: se acredita la exclusión de A27 antes de delegar, no toda la persistencia histórica de A11.
- **25/25** comprobaciones adicionales de idempotencia A11, helpers Klaviyo, resumen de reportes y API/selección del playbook/plantillas; parte del playbook se solapa con las 59 anteriores y no se suma como cobertura independiente.
- Build de `@e-nora/contracts` y `@e-nora/ai`, TypeScript de API y web y comprobación de espacios de los cambios revisados. Contrato específico A27 de `packages/ai/src/index.test.ts` correcto.
- Suite general de IA: **271/277**, con seis fallos en comprobaciones de A12/A13/A14, dos de A23 y extracción de imagen. Las tres primeras exigen textos/formas de código que no están en el runtime actual; las demás usan fixtures incompatibles con contratos actuales. Se conservan como pendientes del workspace compartido, sin relajar las pruebas para cerrar A27.
- `npm run verify` conserva tres guardas en rojo: promoción de versiones en migraciones de otros agentes; idempotencia de funciones A11/A14/A23; tres tests de otros cambios sin registrar en una suite. La nueva tabla/ACL de A27 pasa la guarda RLS y su nuevo test de producción queda registrado en `test:unit`.
- No se ejecutaron modelos pagados, aprobaciones de datos reales, exportaciones ni envíos. No se aplicó la migración remota desde esta intervención. El trabajo paralelo se conserva.

### Manifiesto y límites de entrega A27

| Componente | Estado comprobado |
| --- | --- |
| Contrato de ejecución | `a27-mailing-v2`, guardado en la petición y su contexto; salida con decisión explícita, referencias y evaluación tipada. |
| Migración necesaria | `20270109191233_a27_mailing_execution_integrity.sql`, SHA-256 `ca49b7d1bdecdb9dc59efc1b0a953da8ccb29788a829b493fcf16472aa4e0aa5`; **no figura aplicada en TEST ni en producción** en la lectura del 23-oct. Requiere el mecanismo `db:push` del proyecto y precede al despliegue del código nuevo, también con el grafo apagado. |
| RPC de servicio | `approve_mailing_sequence`, `mutate_mailing_graph`, `set_mailing_draft_schedule`, `finalize_a27_mailing_generation`, `a27_mailing_report`, `reserve_a27_manual_refresh`, `link_mailing_delivery`. Invoker y sin EXECUTE autenticado en la prueba SQL. |
| Prompt remoto | TEST y producción continúan en A27 v5, `claude-sonnet-5`, prompt `a27_planificador_mailing_system/v5`, checksum `f620805c36a9e858dc5a4b7b4d56ecb90225cc5c292bf88f74be338f60e41653`. Esta implementación no promociona otra versión de prompt. |
| Grafo y worker | Se conserva `MAILING_GRAPH_ENABLED` y el piloto por organización; `mailing-campaign-resume` usa el mismo contrato con token. La disponibilidad de RPC, flag, build y worker desplegados debe comprobarse conjuntamente. |
| Legado | Estrategias sin programación/contexto/recursos verificables requieren descartar y planificar otra revisión. No se inventan fechas futuras ni se migra silenciosamente una aprobación antigua. |
| Medición | Un recibo manual identifica qué mensaje inspeccionar. La muestra, exposición real, supresiones, cobertura y ventana de atribución de cuenta deben verificarse al evaluar; cumplir la ventana temporal no convierte el resultado en causal. |

**Cierre pendiente:** aplicar y verificar el esquema por el flujo de despliegue vigente; recorrer los dos modos con JWT reales de dos tiendas, roles, reinicio y cambio de contexto; probar Storage y la copia pública con una imagen de prueba autorizada; comprobar API/web/worker desplegados y rendimiento con datos representativos. Hasta esa validación, estos 24 puntos no se dan por cerrados en producción.

## A28 · Arquitecto de flujos: oportunidades verificables y ejecución coordinada

**Auditoría: 23-oct-2026. Estado: 24 mejoras identificadas, pendientes de implementación en esta pasada.** Revisión del código actual, consumidores, UI y configuración/SQL de TEST y producción. Actualiza la revisión histórica de `REVISION_AGENTES.md` y la ficha parcial de `AUDITORIA_JUEZ_AGENTES.md`; sus cierres locales anteriores no acreditan el recorrido actual. Esta intervención solo añade esta auditoría al documento.

A28 debe decidir qué automatización merece diseñarse, corregirse, medirse o retirarse y explicar cómo contribuye al objetivo de la tienda. Mi Camino aporta la meta y su revisión; A20, oportunidades de retención; A12, rendimiento y límites de medición; A05/A27, campañas y presión comercial; A26, evidencia editorial; A11, borradores. Un diseño aprobado expresa una intención: la implementación y el resultado observado necesitan sus propios recibos.

### Estado comprobado

| Superficie | Evidencia del 23-oct |
| --- | --- |
| Configuración | A28 v2/prompt v2 activos en ambos entornos; `claude-sonnet-5`, solo `search_knowledge`, aprobación `required_before_publish`. MD5 del contenido del prompt: `c4741fba832235648bde3c9f9040d46c`, coincidente. |
| Entrada | GET y POST `klaviyo-flow-architect`; el runner exige conexión explícita. La ruta POST no pasa clave idempotente. El grafo de llamadas y la fuente muestran ejecución manual; no una rama propia del cron que ejecute A28. |
| Alcance | El resolver busca el ID de conexión en `shopify_stores`; después el runner exige ese mismo ID en `klaviyo_accounts.connection_id`. TEST tiene dos cuentas, una asignada a tienda y ninguna con conexión coincidente con Shopify. |
| Contexto | Cuentas, inventario, acciones/mensajes resumidos, métricas, cobertura, peers, tareas y fases/objetivos de Mi Camino. Límites iniciales: 100 cuentas, 200 flows, 1.200 acciones y mensajes; resumen de hasta 60 flows y ocho acciones por flow. |
| Estructura | Se consume `raw_data.a28_flow_structure`, sin identidades/aristas completas. `definition_graph` existe en ambos esquemas; TEST conserva tres flows y tres grafos, pero el runner no los selecciona. |
| Rendimiento | Código/lookback de 30 días y periodo anterior móvil; etiqueta de contexto y UI hablan de 90. La RPC desplegada solo admite agregados íntegramente contenidos en las fechas pedidas y devuelve granularidad mensual. |
| Contrato | Objeto específico `flow_architecture` con tres decisiones y hasta cuatro candidatos. El override explícito conserva el diagnóstico completo; la entrada antigua de A28 en el mapa lean no demuestra que aquí se estén eliminando answer/findings. |
| Presentación | Sección de especialistas de Klaviyo; el diseño despliega todos los candidatos, condiciones, pasos y evidencia. GET sirve caché. La UI genérica permite actualizar manualmente. |
| Actividad remota | TEST: un run A28 exitoso; producción: ningún run A28 encontrado. Estos conteos no prueban qué build generó el resultado ni validan el recorrido vigente. |

### A28-001 · Resolver correctamente tienda y cuentas de Klaviyo

- **Evidencia:** `resolveMarketingDiagnosticStoreScope` resuelve una conexión Shopify; `runKlaviyoFlowArchitectAgent` filtra cuentas por ese mismo ID de conexión y por tienda. Son identidades de conexiones de proveedores distintos. En TEST no hay coincidencias entre ambas.
- **Mejora:** resolver primero la tienda autorizada y después sus cuentas Klaviyo mediante `store_id`, verificando conexión, estado y ausencia de borrado. Diferenciar tienda no encontrada, cuenta sin asignar, integración desconectada y consulta fallida.
- **Aceptación:** la conexión Shopify seleccionada recupera la cuenta Klaviyo vinculada a esa tienda. Cambiar de tienda no incorpora cuentas ajenas; una cuenta ausente no se interpreta como ausencia de flows.

### A28-002 · Aplicar autorización operacional por tienda en todas las entradas

- **Evidencia:** A28 no figura en el conjunto del runner genérico que usa `requireOperationalStore`; utiliza membership organizativo. La exigencia de un ID de tienda no sustituye la comprobación del alcance de la persona. Tampoco tiene el control específico de aprobación incorporado para A26.
- **Mejora:** aplicar permisos y estado operacional de tienda en GET, ejecución, investigación, aprobación, entrega y lectura de evidencia. Mantener la validación antes de gasto o mutación.
- **Aceptación:** JWT de dos tiendas/roles no recuperan ni aprueban artefactos fuera de su alcance. Se documenta el resultado real; esta auditoría no afirma una fuga comprobada.

### A28-003 · Definir y hacer visible cuándo se actualiza

- **Evidencia:** el runner se declara manual y solo se encontró su llamada desde POST; la pantalla usa el componente genérico, que puede hablar de actualizaciones automáticas. No hay una rama de ejecución propia de A28 en el orquestador examinado.
- **Mejora:** definir una política coherente con los demás agentes: programación por tienda, cambios relevantes de fuentes y presupuesto; explicar último análisis, pendiente y siguiente motivo de evaluación. Si se adopta actualización automática, retirar el botón manual correspondiente.
- **Aceptación:** el usuario entiende el disparador real. Abrir el panel no ejecuta el modelo; los cambios necesarios se evalúan sin depender de pulsar un botón ni acumular diagnósticos idénticos.

### A28-004 · Incorporar idempotencia, cuota por tienda y exclusión de ejecuciones

- **Evidencia:** el POST no exige/pasa `Idempotency-Key`; A28 no está en las reservas específicas ni en el ámbito de cuota por tienda del runner. No aporta lease o replay propio.
- **Mejora:** reserva por petición/tienda, lease recuperable y fingerprint de inventario, grafo, rendimiento, objetivo y configuración. Reutilizar resultado y consumo del mismo intento.
- **Aceptación:** dos pestañas/reintentos no pagan dos generaciones; un proceso caído se recupera y otra tienda no consume el cupo de esta. La finalización se conserva con sus identificadores.

### A28-005 · Alinear ventanas, madurez y textos de UI

- **Evidencia:** `KLAVIYO_FLOW_ARCHITECT_LOOKBACK_DAYS=30`; el bloque declara últimos 90 días y la UI usa `days={90}`. La RPC final filtra intervalos completos: una ventana móvil puede no contener ningún mes íntegro.
- **Mejora:** construir ventanas compatibles con los agregados disponibles, preferiblemente meses completos comparables; separar as-of del inventario y periodo de rendimiento, con zona de cuenta, cobertura y madurez.
- **Aceptación:** run, caché, prompt y pantalla expresan las mismas fechas. Un mes omitido por cobertura no pasa a ser un cero ni sustenta retirar un flow.

### A28-006 · Paginar inventario y conservar continuación por entidad

- **Evidencia:** las consultas usan límites sin cursor ni total previo; el resumen solo detecta truncamiento dentro de las filas ya recibidas. Las acciones/mensajes tienen además un límite global compartido por flows.
- **Mejora:** paginación estable y recibo de universo observado, muestra incluida y entidades omitidas. Rotar por cambios/pendientes y permitir investigación exacta sin volcar todo el catálogo al modelo.
- **Aceptación:** superar 200 flows o 1.200 acciones no produce un inventario aparentemente completo. Un flow grande no deja indefinidamente sin datos a los demás.

### A28-007 · Utilizar el grafo real del recorrido

- **Evidencia:** A28 no selecciona `definition_graph`. Su resumen de definición conserva tipos/esperas y booleanos de ramas, pero elimina IDs y destinos; las acciones se ordenan por `position`. El extractor antiguo consulta `links.yes/no`, mientras el grafo existente también contempla `next_if_true/next_if_false`.
- **Mejora:** adaptar el grafo existente a referencias internas seguras, con entrada, aristas, ramas, esperas, terminales y cobertura. Distinguir recorrido observado de secuencia propuesta; no interpretar orden de array como adyacencia.
- **Aceptación:** ramas excluyentes no aparecen consecutivas; enlaces desconocidos o truncados limitan conclusiones. La representación no filtra cuerpos ni valores privados de filtros al contexto.

### A28-008 · Evaluar entrada, salida y elegibilidad con evidencia suficiente

- **Evidencia:** A28 recibe conteos de grupos/condiciones, no su semántica. El propio contexto declara que no dispone de volumen elegible, configuración detallada ni audiencia completa. Los conteos no permiten comprobar exclusión de compradores o reentrada.
- **Mejora:** calcular señales de elegibilidad y restricciones en backend, con procedencia y estado desconocido cuando no sea verificable. Distinguir evento existente, evento observado y perfil elegible; validar también consentimiento/canal, reentrada y salida.
- **Aceptación:** no se etiqueta como verificada una audiencia por tener un trigger conocido. Se propone validar cuando falta configuración, preservando privacidad y límites de acceso.

### A28-009 · Acreditar frescura de cada bloque de sincronización

- **Evidencia:** el resumen usa `last_synced_at` y comparación de timestamps; `isDifferentTimestamp` devuelve false cuando falta una de las fechas. Un resumen existente puede por ello aparentar no estar desactualizado sin poder comprobarlo.
- **Mejora:** estados fresh/stale/unknown por definición, acciones, mensajes, métricas y volumen; conservar último éxito y error posterior. No reducir calidad a una fecha general de cuenta.
- **Aceptación:** fecha ausente o inválida se muestra como desconocida, un fallo posterior no desaparece tras otro bloque correcto y una definición antigua no autoriza cambios actuales.

### A28-010 · Completar el uso y cobertura del volumen de eventos

- **Evidencia:** sync conserva agregados por métrica y A28 los lee, pero `event_volume_available` permanece false, existen varias señales de disponibilidad y el resumen global toma el periodo de la primera fila fresca. Se limitan seis consultas y referencias por flow; el recuento global puede contar varias veces una métrica compartida.
- **Mejora:** manifiesto por cuenta/métrica/periodo con deduplicación, continuidad de pendientes, error y frescura; vincular trigger a métrica verificada y conservar que eventos totales no son perfiles elegibles.
- **Aceptación:** una métrica compartida no infla cobertura, periodos distintos no se presentan como uno y el límite de seis no deja métricas sin revisar sin explicar continuación.

### A28-011 · Aplicar comparabilidad y moneda antes de razonar sobre rendimiento

- **Evidencia:** el resumen conserva rendimiento por flow, pero A28 no aplica la comprobación/redacción de ingresos por moneda que utiliza A12. La RPC no devuelve moneda/cuenta por fila en su firma pública; hay muestras acotadas independientes de campañas y flows.
- **Mejora:** manifiesto con cuenta/entidad/periodo, moneda acreditada, denominadores, madurez y atribución. Retener importes cuando falte compatibilidad y permitir métricas no monetarias válidas; no declarar causalidad.
- **Aceptación:** no se comparan importes incompatibles ni ventanas distintas como mejora del diseño. La muestra y las omisiones acompañan cada recomendación.

### A28-012 · Conservar fallo, vacío y ausencia de contexto de otros agentes

- **Evidencia:** el runner registra errores de inventario y reportes, pero llama a `loadMarketingPeerHistory` sin recibo de disponibilidad. Una lista vacía no acredita que no existan precedentes, entregas o campañas que entren en conflicto.
- **Mejora:** recibos de fuente con estado, fecha, alcance, límites y fallo; incluir calendario/producción pertinente de la misma tienda para comprobar presión comercial.
- **Aceptación:** un fallo de peers/calendario provoca una limitación explícita, nunca la afirmación de que no hay conflictos. La cobertura queda persistida en C2.

### A28-013 · Validar reglas entre decisión, candidatos, evidencia y pasos

- **Evidencia:** el schema acepta `design_proposal` sin candidatos y `no_change` con un candidato create, trigger verified, evidencia vacía y 16 pasos repetidos con `step=1`. Se reprodujo con el validador real. El número de step tiene máximo ocho, pero el array sequence no tiene máximo.
- **Mejora:** invariantes entre decisión y acciones, referencias de evidencia del snapshot, verificación calculada por servidor, cardinalidad y unicidad de pasos; esquema JSON y validador alineados.
- **Aceptación:** esos contraejemplos fallan; medidas de investigación no se confunden con un diseño listo para implementar. Una etiqueta verified requiere evidencia autorizada de la fuente.

### A28-014 · Añadir investigación dirigida y conocimiento de la tienda

- **Evidencia:** la allowlist remota solo contiene `search_knowledge`. No existe drilldown propio por flow/revisión. A28 no está entre los agentes a los que el cargador compartido de playbooks pasa `storeId`; su contexto propio tampoco carga la guía de marca versionada.
- **Mejora:** reutilizar lecturas acotadas de grafo, métricas, cobertura y evidencia por referencias autorizadas, junto con RAG/guía de marketing de la tienda. Presupuestar llamadas y tratar textos recuperados como datos no confiables.
- **Aceptación:** una duda se investiga sobre la pieza correcta sin ampliar ámbito ni editar el proveedor; voz y restricciones tienen procedencia, y la fuente ausente no se inventa.

### A28-015 · Vincular propuestas a la revisión exacta de Mi Camino

- **Evidencia:** A28 carga fases/objetivos actuales, pero los candidatos no incluyen plan/version/revision/hito. `shouldFallbackToCurrentMilestone` no excluye A28 y admite asignar un hito por fallback.
- **Mejora:** conservar meta, revisión exacta, contribución esperada y vínculo opcional al hito; validar al aprobar y eliminar fallback. Admitir trabajo libre justificado cuando no haya vínculo válido.
- **Aceptación:** cambiar el plan obliga a revisar el encargo. Ninguna automatización queda atribuida a un hito supuesto o a otra tienda.

### A28-016 · Entregar un diseño ejecutable a A11/A26/A27

- **Evidencia:** el resumen aprobado circula como contexto, pero los candidatos no tienen identificador/revisión propios, `existing_flow_id` ni claves de pasos. Leer el resumen no crea un borrador ni garantiza conservar exclusiones o criterio de parada.
- **Mejora:** encargo aprobado con candidato/revisión/flow/pasos, cambio permitido, restricciones, responsables y aceptación. A11 prepara piezas, A26 revisa contenido y A27 coordina producción/calendario; enlazar resultados reales.
- **Aceptación:** el mismo encargo se recupera sin duplicar drafts. Aprobar arquitectura no implica activar un flow y un cambio de fuente requiere nueva validación.

### A28-017 · Coordinar oportunidades y presión comercial en todo el ecosistema

- **Evidencia:** el conjunto de peers de marketing incluye A05/A12/A17/A18/A26/A27, pero no A20; A28 puede volver a describir oportunidades de retención sin el diagnóstico que las originó. Tampoco dispone de una comprobación determinista completa de solapamiento de audiencias.
- **Mejora:** recibir oportunidades aprobadas de A20 y la intención vigente de campañas/producción, con IDs, vigencia y entrega. Registrar conflictos conocidos y desconocidos, límites de frecuencia y prioridad respecto a la meta.
- **Aceptación:** A20 aporta el porqué y A28 diseña el cómo. Una propuesta de winback no repite trabajo abierto ni presupone que audiencias diferentes son disjuntas.

### A28-018 · Materializar tareas y vínculos con atomicidad y deduplicación

- **Evidencia:** A28 usa la materialización genérica de tareas; no tiene RPC específica que una candidato, versión de fuente, tarea y hito. Una propuesta genérica tampoco obliga a identificar el candidato que implementa.
- **Mejora:** vínculo obligatorio de tarea a candidato/revisión, deduplicación de episodios y transacción para tarea/hito/estado de entrega. Conservar responsable, entregable y criterio de cierre.
- **Aceptación:** fallo de vínculo no deja una tarea parcialmente creada; un replay recupera el mismo trabajo y no crea otra automatización con un nombre parecido.

### A28-019 · Revalidar fuentes y permisos antes de aprobar cambios

- **Evidencia:** la aprobación genérica no tiene una rama A28 que compruebe si cambiaron definición, estado del flow, eventos, cuenta o plan desde el análisis. Los candidatos carecen de fingerprint de origen.
- **Mejora:** snapshot versionado por candidato y comprobación de liveness al decidir, preparar borradores o confirmar implementación. Marcar supersesión sin borrar historia.
- **Aceptación:** una propuesta sobre un flow editado/archivado o una cuenta desconectada no pasa a ejecución como si siguiera vigente; la UI explica qué cambió.

### A28-020 · Mostrar una ficha breve y el recorrido bajo demanda

- **Evidencia:** el panel despliega todos los campos de hasta cuatro candidatos: resumen, entrada, exclusiones, cadencia, KPI, pasos, evidencia, lagunas y conflictos. Reproduce el problema de textos extensos señalado en la pantalla de consultor.
- **Mejora:** cabecera con decisión, motivo breve, siguiente comprobación y estado; cada candidato plegado, con detalle de evidencia y un recorrido visual de ramas/esperas. Enlaces a flow, tarea y borrador autorizados.
- **Aceptación:** la vista inicial se entiende sin leer el brief completo; el detalle mantiene toda la evidencia y distingue observado/propuesto, pendiente/aprobado/implementado.

### A28-021 · Conservar identidad y vigencia al compartir resúmenes

- **Evidencia:** `summarizeKlaviyoFlowArchitecture` reduce cuatro candidatos a tres y sus secuencias a cinco pasos sin marcar esos recortes en el resumen. Los consumidores usan frescuras distintas, entre 14 y 90 días, sin que esa antigüedad pruebe la revisión actual del flow.
- **Mejora:** IDs/revisión de candidato y paso, cobertura del resumen y continuación; vigencia basada en fuente y estado de entrega, además de antigüedad. Mantener condiciones críticas aunque el resumen se acote.
- **Aceptación:** un consumidor no ejecuta una secuencia recortada como si estuviera completa ni considera vigente un flow cambiado dentro del plazo de frescura.

### A28-022 · Cerrar el episodio con implementación y aprendizaje verificables

- **Evidencia:** la salida se conserva como arquitectura aprobada, sin episodio específico que una decisión, tarea, borradores, implementación observada y resultado maduro por versión. Completar una tarea no demuestra que el proveedor haya cambiado.
- **Mejora:** registrar no implementado/en preparación/observado/verificado/inconcluso/supersedido, con recibos y reapertura. Evaluar con A12 las métricas maduras y con A26 el contenido; distinguir comprobación técnica, atribución e incrementalidad.
- **Aceptación:** no se repite una corrección resuelta; un cambio confirmado permite seguimiento sobre la versión exacta y un resultado comercial posterior no se presenta automáticamente como causal.

### A28-023 · Consolidar prompt, contrato y presupuesto del contexto

- **Evidencia:** el contenido remoto incluye escapes literales de salto de línea y combina formato narrativo con contrato estructurado añadido. El mapa lean conserva una entrada A28 que el override de este runner evita. Además de su inventario, el runner genérico añade varios bloques compartidos.
- **Mejora:** prompt canónico coherente con las capacidades reales, contrato único y eliminación de configuración inefectiva tras comprobar consumidores. Priorizar evidencias y restricciones por tamaño, conservar recibo de omisiones y medir consulta/tokens/latencia con volumen representativo.
- **Aceptación:** ninguna optimización elimina reglas de salida o evidencia necesaria. Se conserva el diagnóstico sin tareas y se acredita el coste/latencia medido, sin prometer ganancias no comprobadas.

### A28-024 · Verificar el recorrido final y la configuración desplegada

- **Evidencia:** la suite existente pasa 27/27; cubre helpers y varias comprobaciones estáticas, pero permite los contraejemplos de contrato reproducidos y no ejerce la resolución conjunta Shopify/Klaviyo con usuarios reales.
- **Mejora:** contratos del estado final PostgreSQL, fixtures multicuenta con grafos/volumen/reportes parciales, JWT por rol/tienda, concurrencia/replay y aprobación/handoff/reapertura con fuentes cambiadas. Verificar API/web/worker/RPC/prompt realmente desplegados y usar promoción serializada vigente.
- **Aceptación:** CI detecta el fallo de conexión y contradicciones del schema. Un E2E acredita lectura y entrega de borradores autorizados sin necesitar enviar emails para aprobar la auditoría.

### Evidencia y límites de esta auditoría A28

- Descubrimiento con `search_graph` y `trace_path`, contrastado con fuente actual de runner, resolver, servidor, aprobación genérica, tareas, peers, resumen de especialistas, schemas, sync, extractores de definición/eventos, grafo y UI. El grafo conserva posiciones antiguas; las conclusiones utilizan el archivo local vigente.
- Consultas remotas de solo lectura a TEST y producción para versión/prompt/tools, firma/hash del reporte, esquema, conteos de cuentas y actividad A28. La RPC `klaviyo_email_report(uuid,date,date,uuid)` coincide en ambos: MD5 de definición `f367bf58cbe2c4b8d1985fb95fe67889`. Se leyó su definición final en TEST para comprobar intervalos completos y granularidad.
- TEST: dos cuentas Klaviyo, una con tienda, cero coincidencias entre su conexión y una conexión Shopify; tres flows, tres grafos, tres resúmenes de estructura y dos con caché de volumen. Producción no tiene cuentas Klaviyo en el conteo de esta lectura. No se leyeron cuerpos ni datos de compradores.
- Auditoría inicial: la suite existente 27/27 pasaba, pero permitía contraejemplos de contrato; la implementación añade validación cruzada y pruebas negativas/positivas. Suite final A28: 28/28 pasan.
- En esta implementación no se ejecutaron generación pagada, aprobación, envío ni publicación. La migración sí se aplicó a TEST y producción. No se certifica el build servido ni un recorrido E2E autenticado; los puntos fuera de esta entrega se detallan en el estado de implementación anterior.
- **Siguiente agente de la secuencia: A29, analista de métricas.** Esto indica orden de trabajo, no ausencia de revisiones históricas.
### Estado de implementación A28 (2026-10-23)

- Implementados en runner, contexto, contrato de salida, coordinación, aprobación y UI: alcance por tienda, ejecución manual/idempotente y cuota por tienda; ventanas de informe completas; paginación acotada con señalización de truncado; topología saneada del grafo; frescura/cobertura y referencias `flow-###`; redacción de ingresos con moneda no verificada; historial de A20, guía de marca y playbooks con storeId; reglas cruzadas de candidatos/pasos/evidencia; alineación exacta de plan/revisión; materialización atómica/deduplicada y revalidación de tienda, candidato, flows fuente y plan; resumen compacto con detalle expandible.
- Migración `20270110120900_a28_architect_verified_coordination.sql` aplicada con `db:push` a TEST y `db:push:prod` a producción. Verificación remota en ambos: A28 v3 activa, prompt y schema v3, nuevas RPC presentes y migración registrada.
- Verificación local: suite A28 28/28; typecheck API y web correctos; `git diff --check` sin errores de contenido (solo avisos de conversión CRLF en archivos preexistentes).
- Límite restante: A28 sigue siendo asesor de solo lectura. No se implementa escritura/activación de flows en Klaviyo ni seguimiento automático del resultado posimplementación; completar ese ciclo requiere una integración de escritura y recibos de ejecución separados. Tampoco se ejecutó un E2E autenticado sobre la UI desplegada; no se publicó ni desplegó código de aplicación.

## A29 — Analista de métricas · Auditoría completa (2026-10-23)

Estado: **25 mejoras propuestas; esta entrega es auditoría, sin implementación funcional ni migraciones.** Se conserva la arquitectura de ADR-0027: reglas deterministas para evaluar; IA para explicar una métrica y proponer acciones revisables. El valor diario depende primero de que cifra, comparación, estado y explicación correspondan a la misma evidencia.

Recorrido comprobado: `GET /metric-analysis` calcula las cinco fichas actuales (`mer`, `cac_new`, `conversion`, `meta_roas`, `email_open_rate`). Web y móvil lo consumen para estados/alertas; al montar la explicación hacen `POST /metric-analysis/:metric/explanation`. El servidor reutiliza resultados de menos de una hora o llama a `runMetricAnalystAgent`. No hay programación diaria propia de A29. En móvil existe además `POST /metric-analysis/:metric/actions`. Mi Camino consume objetivos sugeridos desde el hook web, pero A29 no recibe una identidad explícita de plan/hito para sus recomendaciones.

### A29-001 · Resolver y autorizar la tienda sin ampliar el alcance

- **Evidencia:** `runMetricAnalystAgent` y `getMetricAnalystExplanation` usan `resolveStoreScope` (`apps/api/src/ai-runtime.ts`), que devuelve todas las tiendas cuando una conexión no se resuelve, sin distinguir error y ausencia. Las ramas de acceso específico por tienda del runner y de `getCachedDiagnostic` no incluyen A29.
- **Mejora:** resolver organización, conexión Shopify, tienda activa y acceso operativo antes de leer caché o generar. Con conexión explícita inválida, fallar; representar el agregado como una elección explícita. Aplicar el mismo alcance a observación, especialistas y tareas.
- **Aceptación:** una conexión ajena, inactiva o inexistente nunca recupera la explicación agregada; pruebas con usuarios limitados a una tienda y organizaciones suspendidas.

### A29-002 · Propagar cobertura y errores antes de emitir un estado

- **Evidencia:** `getMetricAnalysis` distingue principalmente `ok`, conexión y muestra. No incorpora al veredicto la cobertura completa de sincronización, los días disponibles, revisiones de medición ni las ventanas de atribución que los servicios ofrecen. Un error de Meta se describe junto con falta de conexión/datos; Shopify condiciona toda la respuesta, incluso para una métrica de email.
- **Mejora:** estados tipados por fuente y métrica: disponible, parcial, vacío, pendiente, sin permiso y error. Separar autorización común de disponibilidad de cada integración; exigir cobertura mínima y degradar comparación/confianza cuando falte.
- **Aceptación:** un fallo temporal no aparece como cero ni como buen rendimiento; Klaviyo puede explicarse con su evidencia aunque otra integración no tenga datos.

### A29-003 · Corregir el denominador de llegada al pago

- **Evidencia:** `shopify-metrics.ts` calcula `checkout_rate = checkouts_reached / sessions`; `metric-analysis.ts` calcula su anterior con `prevCounts.checkout / prevCounts.cart`. Con ambos periodos idénticos de 1.000 sesiones, 200 carritos y 100 llegadas al pago, compara 10 % contra 50 %: inventa una caída del 80 %.
- **Mejora:** una definición canónica por paso; calcular actual y anterior con iguales numerador, denominador y población. Distinguir llegada al pago por sesión de avance carrito→pago.
- **Aceptación:** dos embudos idénticos generan variación cero y ningún consejo basado en esa caída ficticia.

### A29-004 · Comparar ventanas exactas y comparables

- **Evidencia:** la observación pide N y 2N días en llamadas separadas y resta sumas; cada servicio calcula su propio `new Date()` y puede reutilizar cachés de distinto momento. El runner vuelve a construir las fechas en vez de recibir `measurement_period`. Klaviyo trabaja con fechas de día y otras fuentes con timestamps.
- **Mejora:** capturar un instante/ventana común, zona de negocio y fronteras exclusivas; obtener anterior explícito o justificar la resta con un recibo de misma instantánea. Declarar día/mes parcial, madurez de atribución y periodos no comparables.
- **Aceptación:** cambios de día, cachés desfasadas o un sync entre llamadas no generan recuentos anteriores negativos ni comparaciones artificiales; la explicación cita el periodo realmente calculado.

### A29-005 · Aplicar moneda, impuestos y comparabilidad económica a la cifra

- **Evidencia:** `economicsOk` limita umbrales, pero MER/CAC se calculan igualmente con los agregados financieros; el ROAS Meta se toma del resumen sin incorporar su moneda al `MetricAnalysis`. El contrato no conserva moneda por importe. Los textos sugeridos de ROAS/CAC incluyen euros de forma fija.
- **Mejora:** puerta de moneda/cobertura para valor y drivers, no solo umbrales; incluir unidad, moneda, base fiscal y procedencia. Justificar cuándo el equilibrio de tienda es comparable con ingresos atribuidos de Meta, sin tratar atribución como beneficio comprobado.
- **Aceptación:** cuentas con monedas incompatibles no producen un CAC o equilibrio aparentemente fiable; los importes llevan su moneda real y no se suman atribuciones entre plataformas.

### A29-006 · Separar nivel, tendencia y confianza de cada razón

- **Evidencia:** `assessMetric` elige la peor razón y asigna confianza alta si existe cualquier razón económica. Reproducción: MER 4 frente a 8, equilibrio 2, muestra 100 → `bad/high`, aunque la razón económica es favorable y la alerta proviene de tendencia. No implementa una precedencia estricta aunque el ADR hable de pesos.
- **Mejora:** representar nivel económico, cumplimiento y evolución separadamente; definir una política explícita de síntesis y vincular la confianza a la razón que determina la conclusión. Evitar que una caída rentable se describa como pérdida económica.
- **Aceptación:** el usuario distingue «rentable, pero empeora» de «pierde dinero»; el modelo no hereda confianza alta de una evidencia que no sostiene la alerta.

### A29-007 · Rechazar valores imposibles y no finitos

- **Evidencia:** la función pública `assessMetric` solo comprueba nulidad y tamaño de muestra. Reproducciones con `value: NaN` e `Infinity`, anterior 3 y muestra 100 devuelven `good`. No hay validación semántica por tasa, ratio, conteo o denominador.
- **Mejora:** normalizar y validar finitud, dominio, muestra y divisiones en la frontera de observación y en el motor. Un valor rechazado genera cobertura insuficiente con motivo, no una tendencia.
- **Aceptación:** NaN, infinitos, tasas fuera de dominio y anteriores inválidos no aparecen como «Va bien» ni se envían como cifras válidas al modelo.

### A29-008 · Corregir empates y comparabilidad del historial/benchmark

- **Evidencia:** `percentileRank` cuenta solo valores estrictamente menores; seis meses idénticos y valor actual igual producen `watch` para MER. `closedMonths = monthly.slice(0,-1)` elimina la última fila tras filtrar meses, sin comprobar si es realmente el mes abierto. Benchmarks filtran sector/moneda, pero no país, antigüedad ni tamaño/cohorte de muestra.
- **Mejora:** percentiles con empates neutrales; cerrar meses por fecha y cobertura, comparar iguales poblaciones/ventanas. Seleccionar benchmarks compatibles y fechados, con muestra y metodología; caducarlos y abstenerse cuando no corresponden.
- **Aceptación:** estabilidad histórica no dispara vigilancia; no se elimina un mes cerrado por carecer de fila del mes actual; un benchmark antiguo o de otro mercado no decide el estado sin advertencia.

### A29-009 · Distinguir movimiento de un driver y contribución explicativa

- **Evidencia:** `main_driver` es el mayor cambio porcentual adverso, sin descomposición de contribución ni control de coherencia del embudo. El prompt v4 propone considerar una caída incompatible como «casi seguro» fallo de medición, una certeza que esas observaciones por sí solas no demuestran.
- **Mejora:** clasificar identidades matemáticas, asociaciones y posibles errores de medición. Validar población/denominadores antes de ordenar drivers; mostrar contribución cuando sea calculable y alternativas cuando no. Usar incertidumbre explícita en hipótesis de medición.
- **Aceptación:** un indicador de base pequeña no se presenta automáticamente como causa principal; ninguna discrepancia se atribuye con certeza a comportamiento o tracking sin prueba adicional.

### A29-010 · Conectar objetivos y acciones con la revisión exacta de Mi Camino

- **Evidencia:** las fichas reciben objetivos mediante `shopify-metrics.ts`/`organization_metric_targets`; el modal de Camino pide sugerencias con `useMetricAnalysis(organizationId,...)` sin conexión de tienda. A29 no conserva plan/version/revisión/hito en su observación ni en `metric-actions.ts`.
- **Mejora:** resolver objetivo aprobado de la tienda, su vigencia y origen; distinguir objetivo fijado de sugerido. Incorporar el objetivo pertinente al razonamiento y permitir vincular una acción al plan/hito exactos, revalidándolos al crear la tarea.
- **Aceptación:** dos tiendas con metas diferentes reciben sus propias sugerencias; una revisión de Camino invalida la alineación antigua y nunca se sustituye silenciosamente por un hito actual.

### A29-011 · Dar identidad verificable a la explicación y su caché

- **Evidencia:** el GET compartido busca en los últimos 25 runs y filtra después la etiqueta textual `[metric=...]`; la ruta POST reutiliza por edad inferior a una hora, sin comprobar `stale` ni fingerprint del análisis actual. La selección no exige la versión activa del agente/prompt.
- **Mejora:** clave estructurada por organización/tienda/métrica/periodo/versión de reglas y fuentes; guardar snapshot y hash de datos, objetivos y configuración. Consultar la métrica en SQL antes del límite. Distinguir disponible, desactualizada y caducada; regenerar con evidencia de cambio y política de coste.
- **Aceptación:** una cifra/objetivo corregidos no siguen recibiendo una explicación incompatible durante una hora; 25 runs de otra métrica no ocultan la caché existente; una nueva versión no reutiliza contenido antiguo sin indicarlo.

### A29-012 · Unificar llamadas concurrentes y coste diario

- **Evidencia:** dos POST pueden superar a la vez la lectura de caché y generar. A29 queda fuera de la reserva atómica usada por otros agentes; su cuota cuenta runs y el límite genérico por defecto es 1.000 diarios. Web/móvil piden por efecto al montar y no unifican peticiones entre superficies.
- **Mejora:** una ejecución compartida por clave/fingerprint, reserva atómica, replay e identificador idempotente; devolver estado/resultado existente. Definir cuota y presupuesto por tienda/métrica con métricas de caché, coste y latencia; conservar límites económicos existentes.
- **Aceptación:** varias pestañas, cliente/consultor y móvil solicitando lo mismo provocan una sola generación; reintentar tras timeout no duplica gasto ni tareas.

### A29-013 · Corregir la deriva entre versión activa, historial y UI

- **Evidencia remota:** en TEST y producción está activa **v2**. En TEST se confirmaron v3/v4 existentes e inactivas; las migraciones `20270104130000`, `20270104140000` y `20270104150000` están registradas en ambos entornos. No son migraciones pendientes. El checksum del prompt activo no coincide con SHA-256 del contenido; las migraciones locales hashean una etiqueta constante.
- **Mejora:** investigar promoción/rollback y activar una versión canónica compatible con el contrato final, con comprobación de estado posterior y checksum real del contenido. Conservar trazabilidad de promoción y contrato UI/API/prompt.
- **Aceptación:** el despliegue verifica versión realmente activa en ambos entornos, no deduce éxito del historial; ninguna promoción recupera instrucciones incompatibles sin detectar el cambio.

### A29-014 · Validar fidelidad, cifras y brevedad con un contrato propio

- **Evidencia:** A29 usa `buildReadOnlyOutputContract`, que vacía escrituras pero conserva el esquema genérico. No limita por sí mismo conclusión/hallazgos/acciones ni vincula confianza, cifras o severidad al `MetricAnalysis`. Reproducción: acepta `answer` de 4.600 caracteres y confianza alta. TEST tiene 15 salidas guardadas: conclusión media 483 caracteres, máxima 945.
- **Mejora:** contrato específico por métrica con conclusión breve, hallazgos/acciones acotados, referencias a evidencias y confianza máxima determinista. Construir las fichas numéricas desde datos validados o comprobar exactamente las que propone el modelo. Rechazar contradicciones; fallback corto si falla.
- **Aceptación:** no basta una instrucción del prompt: una salida larga, una cifra inventada o confianza excesiva falla validación; un fallo del modelo deja visible el estado determinista y su motivo.

### A29-015 · Versionar metodología y memoria sin convertirlas en datos

- **Evidencia:** `methodologyFor` busca con la consulta fija de ficha y memoiza por texto en un Map sin caducidad, aunque Redis tenga siete días. La búsqueda mezcla candidatos de organización antes de filtrar globales, por lo que la primera organización puede condicionar lo retenido. El `search_knowledge` adicional no equivale a un acceso de investigación a métricas.
- **Mejora:** recuperar metodología global de forma explícita, con versión/TTL y procedencia, y memoria relevante de tienda en un bloque separado. Añadir driver principal a la investigación cuando aporte valor. Aplicar política de audiencia a cualquier salida derivada y tratar textos recuperados como datos no confiables.
- **Aceptación:** una actualización del corpus se refleja sin reiniciar procesos; la memoria de una tienda no afecta a otra y el cliente no recibe títulos/metodología interna por una omisión del prompt.

### A29-016 · Consumir especialistas aprobados, vigentes y comparables

- **Evidencia:** `loadOwnerAgentFindings` exige run exitoso pero no estado aprobado del output, caducidad, periodo comparable ni vigencia de fuente. Limita 20 filas globales antes de elegir una por agente; algunos especialistas pueden desaparecer del contexto por el volumen de otro.
- **Mejora:** seleccionar la última salida apta por especialista y tienda, con IDs, fecha, ventana, aprobación, cobertura y estado de implementación. Separar vacío/error/no disponible. Compartir discrepancias y trabajo abierto con A02/A13/A14/A20/A21/A24/A12 según la ficha.
- **Aceptación:** una propuesta pendiente o un diagnóstico antiguo no se convierten en hechos; la ausencia de un especialista queda declarada y no significa que todo esté correcto.

### A29-017 · Investigar una métrica con contexto y consultas proporcionados

- **Evidencia:** cada explicación llama a `getMetricAnalysis` para todas las fichas: dos Shopify, dos Meta y un reporte Klaviyo, más metodología de las cinco. Después el runner genérico usa perfil `full` y añade actividad/playbooks/contexto compartido; A29 no tiene drilldown numérico propio ni storeId explícito en esa rama de playbooks.
- **Mejora:** separar observación común y obtención selectiva por métrica, reutilizar snapshot y cargar solo fuentes/drivers pertinentes. Ofrecer investigación de solo lectura con rangos y alcance cerrados cuando falte evidencia. Presupuestar bloques y registrar omisiones, coste y latencia reales.
- **Aceptación:** explicar apertura de email no recalcula todas las áreas; reducir contexto no elimina restricciones ni evidencia; el ahorro se acredita con mediciones, no estimaciones narrativas.

### A29-018 · Mantener la identidad de cada recomendación al crear tareas

- **Evidencia:** `withRenewal` filtra recomendaciones del consultor para el cliente; móvil manda el índice de la lista filtrada, pero `createMetricActionTask` lo aplica a la lista original sin filtrar. Ejemplo reproducido: `[consultor,cliente]` muestra cliente como índice 0, pero crea la acción de consultor. Además, el endpoint vuelve a resolver la explicación más reciente sin recibir el output visto.
- **Mejora:** IDs estables de recomendación y output; el cliente envía esa identidad y el servidor verifica contenido, rol, alcance y revisión. Conservar las identidades al filtrar por audiencia y detectar resultados sustituidos.
- **Aceptación:** el texto aprobado es exactamente el de la tarea creada, incluso con acciones de ambos roles o una regeneración entre lectura y clic.

### A29-019 · Autorizar acciones y audiencia en el servidor

- **Evidencia:** la lectura filtra recomendaciones en `withRenewal`, pero la creación usa el output bruto y no comprueba que el usuario pueda materializar una recomendación `owner: consultor`. El filtrado actual tampoco representa una política explícita para hallazgos, evidencias o advertencias internas.
- **Mejora:** autorización por rol/recomendación en el endpoint de escritura, además de la presentación. Definir contrato público e interno, visibilidad de tarea y responsable; validar cuerpos/IDs sin coerciones ambiguas. Mantener acceso por tienda y restricciones operativas.
- **Aceptación:** manipular un índice o llamar directamente a la API no permite al cliente crear trabajo interno ni acceder a contenido reservado; las tareas internas conservan su visibilidad.

### A29-020 · Crear tareas con atomicidad, tienda y evidencia completas

- **Evidencia:** `metric-actions.ts` busca duplicado por metadata, crea tarea genérica y luego actualiza source/metadata. No pasa `connectionId`, `agentOutputId` ni `agentProposalIndex` que `createTask` ya soporta. Dos solicitudes pueden insertar dos tareas; un fallo de actualización deja tarea sin vínculo. No guarda valor inicial ni periodo exacto pese al comentario de seguimiento.
- **Mejora:** materialización atómica con clave única y revalidación de output/recomendación/tienda/plan; recibo de identidad, responsable, baseline, unidad, moneda, criterio de cierre y evidencia. Deduplicar también trabajo abierto equivalente de otros agentes cuando haya una referencia común fiable.
- **Aceptación:** repetir una acción devuelve la misma tarea, etiquetada con su tienda; ninguna respuesta de fallo deja una tarea huérfana y el consultor puede reconstruir por qué se creó.

### A29-021 · Hacer clara y breve la experiencia diaria en web

- **Evidencia:** el popover acumula explicación, razones, drivers, objetivo, metodología y definición; no hay límite específico de salida. El pie dice «Se renueva a las…», pero no hay renovación programada ni refresco al llegar esa hora: solo un nuevo POST puede regenerar. En varias rutas `insufficient` omite A29 o usa fallback de A02, sin garantizar equivalencia de evidencia.
- **Mejora:** primera vista con estado, conclusión breve, acción y fecha/periodo reales; detalles desplegables y jerarquía accesible. Distinguir «puede actualizarse desde» de «se actualizará». Mostrar muestra insuficiente, cambio de fuentes, error y última explicación válida de forma explícita, con reintento controlado.
- **Aceptación:** el usuario entiende en pocos segundos qué pasa y qué hacer; no interpreta un fallo de generación como salud del negocio ni espera una renovación automática inexistente.

### A29-022 · Igualar evidencia y continuidad entre móvil, web y copiloto

- **Evidencia:** el móvil representa `answer` y recomendaciones, pero no los `findings[].figures` donde v4 ordena poner las cifras; su tipo declara warnings sin mostrarlas en la explicación. La pregunta al copiloto transporta etiqueta/answer en texto, sin identidad de output, periodo, fuente ni tienda verificados como evidencia estructurada.
- **Mejora:** contrato de presentación común: cifras/unidades, advertencias esenciales, confianza y edad. Mantener IDs de acción al filtrar. Pasar al copiloto una referencia autorizada al análisis para cargar evidencia, no depender del resumen pegado. Conservar límites de alcance móvil del repositorio.
- **Aceptación:** una recomendación conserva significado y límites al pasar de web a móvil/copiloto; v4 no deja la explicación móvil sin las cifras que la justifican.

### A29-023 · Ampliar fichas por utilidad diaria y sin duplicar especialistas

- **Evidencia:** `METRIC_SPECS` solo cubre cinco métricas; no hay fichas para beneficio/margen, ticket, recurrencia, disponibilidad de stock ni clic/bajas/spam de email. El plan existente recoge parte de esta ampliación. Aperturas tiene sesgos de privacidad reconocidos en su definición.
- **Mejora:** ampliar el catálogo usando la misma arquitectura, con definición, fuente, unidad, muestra, cobertura, población, ventana, objetivo y especialista responsable por ficha. Priorizar en la vista diaria los problemas accionables del negocio; combinar aperturas con señales más cercanas a interacción/entregabilidad y resultados maduros.
- **Aceptación:** cada nueva cifra tiene observación y pruebas propias, puede abstenerse y enlaza al agente de área adecuado; se evita añadir un nuevo agente por KPI o crear alertas duplicadas sobre el mismo problema.

### A29-024 · Cerrar el ciclo de feedback y resultado de acciones

- **Evidencia:** ADR-0027 deja feedback y medición posterior para fase 3; en TEST `metric_analysis_feedback` no existe. Las tareas A29 no guardan la observación inicial y su metadata no permite por sí sola medir resultado comparable. Hay infraestructura genérica de resultado de tarea que conviene reutilizar.
- **Mejora:** registrar útil/incorrecto con corrección del consultor, dataset versionado y revisión de reglas; unir recomendación, tarea y medición posterior madura. Estados pendiente de acción, realizada, observada, inconclusa y sustituida, con condiciones para reabrir. Coordinar aprendizaje con el especialista y A02/Mi Camino.
- **Aceptación:** marcar una tarea completada no demuestra mejora ni causalidad; una acción resuelta no se recomienda otra vez sin evidencia nueva; ninguna calibración se aplica silenciosamente a todas las tiendas.

### A29-025 · Probar el recorrido real y vigilar calidad, coste y deriva

- **Evidencia:** los 13 tests del motor pasan, pero no cubren los contraejemplos reproducidos, las rutas A29, el índice filtrado, concurrencia, store fallback ni el estado final remoto. No se ha acreditado aquí un E2E autenticado ni el build realmente servido.
- **Mejora:** fixtures por métrica/moneda/cobertura/rol/tienda; pruebas de observación y contratos; carreras de generación/materialización; recuperación tras timeout; E2E web/móvil/API sin envío externo. Evals de fidelidad, brevedad, cifras, atribución y abstención por ficha. Medir tasa de caché, rechazos, coste, latencia, correcciones y versión activa; promoción serializada con verificación posterior, sin restaurar requisitos de release retirados por el usuario.
- **Aceptación:** CI detecta los fallos descritos y las pruebas remotas comprueban el comportamiento final, no solo SQL registrado. Un cambio de prompt no se considera publicado hasta comprobar la versión activa y compatibilidad con sus consumidores.

### Evidencia y límites de la auditoría A29

- Descubrimiento mediante `search_graph` y `trace_path`; el índice no contiene varios símbolos/archivos A29 actuales, por lo que se contrastó directamente la fuente vigente. Lectura de runner/caché/cuota/contrato compartido, reglas, observación, rutas, materialización de tareas, UI web/móvil, Camino, registro de insights, ADR-0027, plan existente y migraciones v1–v4.
- `npx tsx --test packages/contracts/src/metric-analyst.test.ts`: **13/13 pasan**. Reproducciones adicionales en memoria con la función real: NaN/Infinity → good; seis meses empatados → watch; caída rentable → bad/high. El validador compartido admite una conclusión de 4.600 caracteres. Reproducción aislada de denominadores e índices filtrados descrita en A29-003/A29-018; no se crearon tareas reales.
- Consultas remotas de solo lectura a TEST y producción: A29 v2 activa, `search_knowledge` como única herramienta, aprobación `none`, checksum distinto del hash del contenido y migraciones v2–v4 registradas. TEST: v3/v4 inactivas, 16 runs y 15 outputs, conclusión media de 483 caracteres y máxima de 945; producción: cero runs A29 en esta lectura. Estas cifras describen el momento de la auditoría, no garantizan el estado posterior.
- Estado de la auditoría: la evidencia y los conteos de ese momento son históricos. Desde entonces se implementaron cambios locales y se activó A29 v5 en TEST y producción; ver el estado de implementación que sigue.

### Estado de implementación A29 (2026-10-23)

- Corregidos el denominador del paso carrito→pago, valores no finitos, empates históricos y confianza asociada a la razón que determina el estado.
- El alcance explícito de tienda de A29 ahora exige una tienda activa de la organización y permisos operativos; una conexión inválida devuelve error y no cae al agregado.
- La caché POST regenera cuando el diagnóstico compartido marca el resultado como obsoleto. El TTL en memoria de metodología está acotado y separado por organización. A29 usa contrato propio: conclusión de hasta 280 caracteres, hallazgos/acciones acotados, confianza limitada por reglas, cifras contrastadas con la observación y sin cambios de estado ni escrituras.
- El refresco manual de A29 pasa por reserva atómica con un límite predeterminado de ocho por organización/día. Los hallazgos de especialistas se limitan a outputs aprobados/publicados de los últimos 45 días y a la tienda correspondiente.
- El análisis de apertura de email solicitado por A29 consulta solo Klaviyo y su metodología, sin bloquearse por Shopify ni recalcular todas las fichas.
- Las tareas A29 conservan el índice original tras filtrar por rol, verifican el `output_id` y el texto que la persona vio, guardan tienda/identidad/metadatos en el insert y ocultan al cliente las tareas asignadas al consultor. El botón refleja el output mostrado.
- Se añadió valoración `helpful`/`incorrect` por usuario y output, con corrección opcional, aislamiento por organización/tienda y endpoint móvil; la tabla tiene RLS y solo escritura desde el API con service role.
- Web y móvil presentan las cifras estructuradas; la UI explica que se puede volver a generar desde la hora indicada, sin prometer renovación automática.
- Migraciones `20270110121000_a29_contract_and_active_v5.sql` y `20270110121100_a29_metric_feedback.sql` aplicadas con `db:push` en TEST y `db:push:prod` en producción. Consulta posterior: v5 activa y checksum SHA-256 coincidente en ambos entornos; tabla de feedback, política RLS y migraciones registradas comprobadas.
- Límites que siguen abiertos: fingerprint exacto de la observación y deduplicación de generaciones concurrentes por tienda/métrica; cobertura/tipos de error por fuente y ventanas/moneda completas; objetivo y revisión exacta de Mi Camino; investigación selectiva de las demás cuatro métricas; unificación del copiloto con evidencia autorizada; ampliación de fichas; medición madura de resultados (el feedback ya se registra, pero no prueba causalidad ni cierra por sí solo el ciclo); E2E y evals de fidelidad/coste/latencia. Por ello, las 25 mejoras no se declaran completas todavía.
- Verificación: `npm run typecheck` completó para paquetes, API, web, móvil y worker. No se ejecutó una generación pagada ni se desplegó la aplicación.

### Revisión posterior de A29 (2026-10-23)

**Resultado: no cerrar A29 todavía.** Revisión de los cambios locales respecto a HEAD y de su coherencia con A29-001…025. Se contrastó la fuente vigente porque el índice del grafo no incorpora todas las modificaciones. Esta revisión modifica únicamente este documento; no corrige código ni modifica bases de datos. Las mejoras que siguen se registran para su corrección.

#### Standards: coherencia de contratos, permisos y ejecución

1. **P1 · El contrato enviado al modelo contradice la validación de `area`.** `packages/ai/src/index.ts:412` indica devolver `area: null` si el prompt no enumera claves; el prompt v5 no las enumera. Sin embargo, `index.ts:3684` exige que el primer hallazgo lleve exactamente el ID de la métrica. Una respuesta que siga las instrucciones puede rechazarse. **Mejora:** declarar la clave literal en el esquema específico o asignarla desde el servidor; alinear prompt, JSON Schema y Zod.
2. **P1 · El acceso concedido solo a una tienda sigue bloqueado después del resolver.** `apps/api/src/ai-runtime.ts:6060` y `:7197` excluyen A29 de la rama `requireOperationalStore`. El resolver acepta `storeMemberships`, pero runner/caché vuelven a exigir membership de organización y responden `store_scope_required`. El feedback tiene el mismo problema en `apps/api/src/metric-actions.ts:23`. **Mejora:** usar la misma autorización por tienda durante todo el recorrido, incluidas lectura, ejecución, feedback y tarea.
3. **P2 · Se rechazan cifras correctas por un formato canónico que el modelo desconoce.** `ai-runtime.ts:5986` prepara valores con dos decimales; para dinero omite moneda. `packages/ai/src/index.ts:3700` compara etiqueta, valor, anterior y variación por igualdad exacta, sin entregar esas filas canónicas al modelo. Reproducción: con valor esperado `3,00×`, `3×` falla; un importe con moneda puede fallar cuando se espera texto sin moneda. **Mejora:** construir las fichas desde la observación validada o entregar filas canónicas con identidad verificable; no pedir al modelo que adivine formato ni precisión flotante.
4. **P2 · La reserva protege el cupo, pero no comparte una generación equivalente.** A29 llama a la reserva genérica en `ai-runtime.ts:5670` sin clave por evidencia/tienda/métrica; `runMetricAnalystAgent` no aporta `manualRequestKey`. Dos POST concurrentes con caché antigua pueden generar y cobrar dos veces. El valor predeterminado de ocho se aplica por organización/agente, no por tienda/métrica. **Mejora:** claim durable por fingerprint y alcance, con lease, replay y recuperación tras timeout. La reserva actual no acredita esta mejora como cerrada.

#### Spec: requisitos incompletos y regresiones

5. **P1 · Regresión en los extremos del historial.** `packages/contracts/src/metric-analyst.ts:289` exige `rank > 0` para generar la razón adversa; un MER menor que todos los meses previos tiene rank cero y deja de producir vigilancia. La condición de mejor extremo también excluye rank uno en `:290`. **Reproducción real:** MER actual 2,5, anterior 2,6, muestra 100 e historial `[3,3.2,3.4,3.1,2.9,3.3]` devuelve `good`. La prueba existente espera `watch` y falla. **Mejora:** mantener midrank para empates sin excluir los extremos válidos.
6. **P1 · Valores imposibles o anteriores inválidos todavía generan «Va bien».** La validación de `metric-analyst.ts:236` no cubre anterior, dominio de tasas ni drivers. Reproducciones reales: conversión actual/anterior 1,4 con muestra 2.000 devuelve `good`; MER 3 con anterior `Infinity` termina como `good` y texto «Estable… NaN %» (`:310`). **Mejora:** validar toda la observación antes de calcular cambios y normalizar los datos rechazados; las tasas imposibles deben abstenerse.
7. **P1 · El contrato no garantiza fidelidad al estado ni ausencia de cifras inventadas en prosa.** `packages/ai/src/index.ts:3681` solo prohíbe dígitos en `answer`; `:3697` solo contrasta `figures`. Reproducciones con el validador real: estado esperado `bad` acepta «La cifra va bien.» con gravedad `info`; también acepta `evidence: "Hay 999999 EUR de beneficio."` y figuras vacías. **Mejora:** construir estado/cifras y referencias de evidencia de forma determinista; validar el contenido dependiente de evidencia y ofrecer fallback breve cuando no pueda acreditarse. No considerar esta mejora cerrada por limitar longitud y gravedad máxima.

#### Estado contrastado de las 25 mejoras

«Implementada» identifica el cambio principal acreditado en código/BD; no equivale a certificación E2E del producto desplegado.

| ID | Estado | Trabajo restante o evidencia |
|---|---|---|
| 001 | Parcial | Resolver estricto añadido; falta autorización coherente por tienda en runner/caché/feedback. |
| 002 | Parcial | Email selectivo; faltan estados tipados y cobertura por fuente. |
| 003 | Implementada | Actual y anterior de llegada al pago usan sesiones como denominador. |
| 004 | Pendiente | Ventanas exactas, recibo de snapshot y madurez comparables. |
| 005 | Pendiente | Moneda/base fiscal/procedencia en valor y drivers, no solo en umbrales. |
| 006 | Parcial | Confianza ligada a la razón decisiva; falta separar nivel y evolución. |
| 007 | Parcial | Finitud actual/muestra; anteriores, drivers y dominio aún admiten errores. |
| 008 | Parcial | Midrank añadido con regresión de extremos; cierre de meses y benchmark incompletos. |
| 009 | Parcial | Prompt más prudente; el driver continúa siendo la mayor variación adversa. |
| 010 | Parcial | Sugerencias reciben tienda; faltan plan/revisión/hito y su revalidación. |
| 011 | Parcial | Filtro SQL por métrica, versión activa y stale; falta fingerprint/snapshot. |
| 012 | Parcial | Reserva de cupo; falta ejecución compartida y replay. |
| 013 | Implementada | v5 activa y checksum real verificados en TEST y producción; no se acredita la causa de la deriva histórica. |
| 014 | Parcial | Límites de tamaño/confianza; contradicciones y desalineación del contrato siguen abiertas. |
| 015 | Parcial | TTL y clave por organización; falta selección global/versionado explícito del corpus. |
| 016 | Parcial | Solo outputs aprobados/publicados recientes; sigue límite global de 20 antes de elegir por especialista y falta comparabilidad. |
| 017 | Parcial | Solo apertura email evita recalcular las demás áreas. |
| 018 | Implementada | ID de output, texto aprobado e índice original preservados. |
| 019 | Parcial | Acciones filtradas/autorizadas; falta política completa para evidencia y errores de cuerpos no tipados. |
| 020 | Parcial | Insert/dedupe mejorados; baseline opcional formateada, sin unidad/moneda/periodo exactos ni revalidación transaccional de plan/output. |
| 021 | Parcial | Texto acotado y etiqueta de refresco corregida; falta validar estados/reintento del recorrido real. |
| 022 | Parcial | Figuras y warnings móviles; el copiloto recibe texto sin referencia autorizada al análisis. |
| 023 | Pendiente | Catálogo ampliado con observaciones y cobertura propias. |
| 024 | Parcial | Feedback/corrección registrados; falta ciclo maduro de resultado de acciones. |
| 025 | Parcial | Revisión y reproducciones realizadas; suite con una regresión, sin E2E/evals completos. |

Balance de implementación: **3 implementadas, 19 parciales y 3 pendientes**. No afirmar «25 completadas».

#### Evidencia de esta revisión

- Suite ejecutada: `npx tsx --test packages/contracts/src/metric-analyst.test.ts` → **12/13 pasan; falla «historial: entre los peores meses = vigilar»**. El typecheck previo no detecta esta regresión funcional.
- Reproducciones locales con el motor y contrato reales: mínimo histórico, tasa fuera de dominio, anterior infinito, contradicción del estado, cifras falsas en prosa y rechazo por formato de cifra. No se llamó a un modelo ni se crearon tareas/feedback reales.
- SQL exclusivamente de lectura en TEST y producción: A29 v5 activa, prompt v5, checksum coincidente; ambas migraciones registradas; `metric_analysis_feedback` con RLS, sin SELECT de authenticated y con INSERT de service_role. No se deduce de esto que las rutas o la UI estén verificadas de extremo a extremo.
- Resultado de los dos ejes: **Standards: 4 hallazgos**, los más graves son contrato contradictorio y acceso por tienda bloqueado. **Spec: 3 hallazgos**, los más graves son regresión histórica y validación insuficiente de estado/datos.


### Cierre de los siete hallazgos de la revisión posterior de A29 (2026-10-23)

Se corrigieron en el código local los siete defectos concretos documentados arriba:

- La respuesta factual de A29 se construye desde el veredicto validado. El modelo solo devuelve hasta dos recomendaciones; no puede cambiar el estado, severidad, evidencia, cifras, periodo ni área, y el contrato rechaza cifras inventadas en las acciones.
- El permiso de tienda se conserva en runner, caché, análisis de Meta/Klaviyo, feedback y creación de tareas. Si una cuenta limitada solo tiene una tienda autorizada, se resuelve esa tienda de forma explícita; una selección ambigua o ajena falla cerrada.
- Los importes se presentan desde los valores canónicos y llevan la moneda de su fuente. El análisis conserva el periodo y las tareas guardan el valor numérico, variación, moneda, confianza y ventana exacta como línea base estructurada.
- Las explicaciones de MER, CAC y conversión consultan solo Shopify; el ROAS usa solo Meta y apertura ya usa solo Klaviyo. La ventana exacta se comparte con la ejecución, los especialistas tienen una lectura ampliada pero acotada y la caché de metodología lleva versión explícita.
- Las generaciones A29 usan una clave durable por tienda, métrica, huella de evidencia y hora. PostgreSQL serializa solicitudes equivalentes, limita el cupo por tienda/métrica y los POST concurrentes esperan la salida guardada hasta 45 segundos.
- Midrank conserva los extremos históricos. Se rechazan observaciones no finitas, tasas fuera de 0–100 %, cifras negativas, drivers inválidos, objetivos/umbrales inválidos e historiales imposibles.

La migración 20270110121200_a29_metric_singleflight_contract_v6.sql se aplicó mediante db:push a TEST y db:push:prod a producción, y quedó registrada en ambos. Verifiqué que ambos tienen la función de reserva y prompt v6, mientras v5 sigue activa. v6 queda inactiva hasta publicar el backend que consume el nuevo contrato; así se evita cambiar la instrucción activa antes de que el servicio actualizado llegue a producción.

Verificación local: npm run typecheck pasó en todo el monorepo; el build de API pasó; las pruebas del motor pasaron 16/16, la presentación canónica 1/1 y el contrato A29 1/1. La suite completa de packages/ai/src/index.test.ts conserva tres fallos en pruebas de A23, una inspección general de JSON Schema y extracción visual de Instagram; la prueba nueva de A29 pasa y esos fallos no pertenecen a A29. No se desplegó código ni se activó v6.

Los siete hallazgos de revisión quedan corregidos en local. La tabla de las 25 mejoras de arriba es el balance previo y conserva trabajo de alcance mayor aún pendiente (por ejemplo, las métricas nuevas y la coordinación completa con Mi Camino y el copiloto); no se certifica aquí que las 25 estén cerradas ni que el recorrido esté desplegado.
