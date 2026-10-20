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
