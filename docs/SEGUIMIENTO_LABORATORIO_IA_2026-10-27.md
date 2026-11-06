# Seguimiento del laboratorio de IA — 27/10/2026

## A17 cerrado · 06/11/2026

Sonnet 5.5 principal y Terra fallback tras seis respuestas con contexto runtime de E-NORA Demo, histórico, semanas comparables y 72 tareas. Cinco contratos válidos; Opus incumple due_hint. Corregidos scope cron/UI, periodos, índice de duplicados, plan_id, capacidad semanal y explicación visible. Una generación cada seis días por tienda, compartida por cliente/consultor; referencia Sonnet ~$0,69/30 días para cinco ejecuciones, equivalente API CLI en frío. Respuesta guardada en Tareas → A17 · Plan semanal; misma salida verificada con ambas sesiones, Admin Costes/Laboratorio 200. Sin revisión visual autenticada. [Revisión, precios y límites](./A17_REVISION_TIENDA_2026-11-06.md).

## Estado más reciente · A14 y A15 · 05/11/2026

A14: el usuario delegó la elección de cuenta. Rafael Borrego Reyes seleccionada/asignada; ficha e informes legibles y sincronización completa tras corregir el acceso a datos de facturación opcionales. Rafa Borrego desasignada/deseleccionada, histórico conservado aparte. Segunda comparación de seis modelos: Sol principal, Terra fallback, diagnóstico/abstención elegidos. Nueva respuesta compartida visible en `/meta#meta-pendiente`, run `1d7e3e46-724c-4e96-9b46-6d06dde25635`; referencia 2,77938 USD/30 ejecuciones. Sin adquisición en ventanas y finanzas incompletas: la elección no habilita inversión ni valida optimización con campaña activa. [Detalle A14](./A14_REVISION_TIENDA_2026-11-05.md). Esta actualización sustituye la necesidad de reconectar y el estado provisional descritos más abajo.

A15: Terra principal, Sol segundo modelo/fallback. Doce respuestas finales con píxeles idénticos de formas abstractas y producto Shopify de E-NORA Demo; sin Astra. Corregidos enum de suscripción, contrato de límites, modelo/fingerprint y metadatos de tienda; originales y tandas previas conservados. Dos fichas de Terra verificadas para cliente/consultor en `/marketing/imagenes`, con aislamiento de tienda y preview privado. Documento visual de semilla archivado; indexación nueva pendiente, sin embeddings pagados. Coste medio del catálogo 0,028529 USD/imagen o 0,57058 por veinte; escenario CLI, no factura. Comparación de quince campos en el laboratorio. [Auditoría final A15](./A15_REVISION_TIENDA_2026-11-05.md). Revisión visual de UI pendiente por CUA no disponible.

## A14 · selección provisional y UI compartida · 05/11/2026

Tras la reconexión confirmada por el usuario, comprobación directa: `ads_read` concedido; la cuenta asignada «Rafa Borrego» (`act_946548861093802`) deniega ficha e informes. La conexión solo lista «Rafael Borrego Reyes» (`act_1797270924877645`). Elección de cuenta solicitada al usuario; no cambiar asignación ni mezclar histórico sin respuesta. No se resuelve repitiendo únicamente el permiso genérico.

Actualización posterior: dependencia financiera aplicada solo en TEST; RPC operativa, sin error PGRST202. A24 recalculado determinísticamente conserva unknown. Bloqueo externo confirmado en la cuenta Meta Rafa Borrego: falta permiso de lectura (#200); requiere revisar acceso y reconectar en Integraciones → Meta. Mejorado el mensaje en código y TEST. La cobertura revela 951 pedidos sin base monetaria verificada y 951 costes actuales usados como estimación histórica; requiere reconciliación y costes acreditados. A14 bloquea antes del modelo (`meta_source_not_ready`), comprobado sin API pagada. No se marca como cerrado ni se salta a A15 mientras quede esta aceptación pendiente. Ver actualización detallada en la auditoría A14.

Seis respuestas ejecutadas el 3/11 sobre veinte bloques del runtime TEST: Sol principal provisional, Terra segundo modelo. Sol presenta gasto, compras y CPA atribuidos con cautela, reconoce medición/finanzas ausentes y evita duplicar tareas. Sonnet contiene un error aritmético y Opus infiere conversión de clic a partir de atribución. Originales y revisiones conservados. Referencia Sol 0,09327 USD por ejecución y 2,7981 por treinta lecturas de una tienda, con tarifas del catálogo; no factura. Cadencia de diseño corregida a una diaria por tienda elegible, compartida por ambos roles.

Resultado guardado y API verificada para cliente y consultor en Meta Ads → A14, tres hallazgos y cero tareas. La UI abre el panel por defecto. **Falta el escenario completo**: A24 no tiene veredicto vigente y `shopify_financial_coverage` devuelve PGRST202 en TEST; el despliegue IMP-02 pertenece a la entrega final reservada. No se habilitan decisiones de inversión sin estas pruebas. [Detalle y límites de A14](./A14_REVISION_TIENDA_2026-11-05.md). Revisión visual pendiente por acceso al navegador indisponible.

## Ficha de campaña y A13 · 03/11/2026

Ficha en Klaviyo → Campañas, enlazada también desde Emails: contenido observado, métricas, revisión A26 vigente por versión y conclusiones reutilizar/mejorar/corregir/evidencia insuficiente. Ambas cuentas y aislamiento de tienda/organización verificados; no añade llamadas LLM al consultar ni inventa cuerpos/revisiones ausentes. [Detalle de la ficha](./FICHA_CAMPANA_EMAIL_2026-11-03.md).

A13 revisado con seis modelos sin Astra: Sol principal, Terra segundo modelo/fallback. Corregido un fallo del caller que normalizaba treinta días como siete y declaraba alcanzada la meta con 216.227,50 EUR ficticios de ritmo. Ahora lee 3.847,10 EUR del mes natural de noviembre frente a referencia acumulada de 7.500; la tanda inicial queda archivada y la válida termina en `-calendar`. Sol devuelve tres hallazgos y cero tareas nuevas, evitando duplicar A06/backlog. Lectura compartida en Shopify → Resumen → A13, también visible para cliente. Referencia 0,102828 USD/ejecución, 3,08484 por 30 lecturas de tienda y 6,16968 con otras 30 organizativas; escenario, no factura. [Auditoría A13](./A13_REVISION_TIENDA_2026-11-03.md).

## A12 · seis modelos con histórico TEST · 02/11/2026

Sol principal, Sonnet 5.5 fallback y Terra alternativa. Dos tandas separadas de seis modelos sin Astra: cobertura ausente y contexto normalizado. Corregidos doce intervalos sintéticos TEST y sus recibos, antes exclusivos, al contrato inclusivo del informe; producción y SQL intactos. La tanda final compara octubre con septiembre con doce bloques del runtime. Seis contratos válidos; Sol ofrece la lectura más prudente y correcta de cifras, atribución e historial de tareas. El histórico de rendimiento es sintético de demostración ya persistido, no actividad comercial real.

Resultado seleccionado en Dashboard → Klaviyo → A12 para cliente y consultor, mismo output `f5577539-9021-4f08-8bd8-95721d746a68`, cuatro hallazgos y cero tareas. Sin aprobación para leer ni cambios en Klaviyo. Coste Sol sin caché 0,09684 USD/ejecución: 2,9052 por 30 lecturas de tienda, 5,8104 con otras 30 organizativas; escenario condicionado a actividad y cupos, no factura. Perfil y contador de agentes cerrados usan decisión común; cadencia contabiliza tienda más agregado, sin duplicación por rol. [Auditoría A12](./A12_REVISION_TIENDA_2026-11-02.md).

## A02: Terra asignado tras comparacion real con historico - 29/10/2026

El propietario elige **GPT-6.1 Terra como modelo principal de A02** y **GPT-6.1 Sol como fallback**. La decision queda aplicada en el contrato compartido y la heredan runtime, Costes y laboratorio; overrides antiguos no cambian A02. El fallback se usa ante rate limit, timeout o indisponibilidad antes de consumir tokens.

La nueva tanda usa E-NORA Demo en Supabase TEST y un historico de ventas, finanzas y Meta de seis meses. Se ejecutan seis modelos en Overview cliente y Panel consultor (12 respuestas) y cada salida se revisa con 16 campos. Balance pass/fail/uncertain: Terra 29/0/3; Sol 30/0/2; Haiku 25/2/5; Luna 24/3/5; Sonnet 22/2/8; Opus 20/4/8. Terra no tuvo fallos coincidentes y cuesta unos $0.084 por un par Overview+Panel frente a $0.182 de Sol. Sol pasa un campo mas; Terra se elige por calidad cercana y menor coste. Es una muestra pequena con dos jueces automaticos (Sonnet y Sol), ambos candidatos tambien.

El laboratorio abre por defecto la respuesta de Overview y compara Terra con Sol; el selector permite abrir Panel y los otros modelos. Los originales completos y las revisiones de ambos evaluadores permanecen disponibles. El coste es estimacion API sobre tokens CLI, no consumo facturado. Las dos vistas reciben contextos distintos por diseno. Los diagnosticos previos estaban pendientes de aprobacion; no se consideran tareas completadas. No se han probado herramientas ni la API pagada.

Este veredicto sustituye la asignacion Sol del 28/10 y los datos sinteticos/anteriores se conservan como historial, no se mezclan con este par real. Seguir agente por agente con el mismo metodo: contexto real de TEST e historico pertinente, vistas/roles separados, seis modelos sin Astra, contratos y campos comparables, costes por respuesta, revision humana de salidas, y solo despues decision en codigo y UI.


## A08: primera comparación controlada — 29/10/2026

Se añadieron dos casos sintéticos y se probaron con Haiku 5.5, Sonnet 5.5, Opus 5.5, GPT-6 Luna, Sol y Terra (12 respuestas; Astra excluido). Los seis devolvieron JSON válido y cumplieron el contrato de solo lectura. Los casos comprueban la separación entre documentos globales y privados, y el manejo de dos candidatos semánticos, un documento distinto y una señal de demanda de inventario. Como el ensayo no habilitó herramientas, solo evalúa la lectura del contexto; no demuestra el comportamiento de `search_knowledge` en ejecución real.

Coste API estimado para estos dos casos: Haiku 0,0051–0,0057 USD; Luna 0,0048; Sonnet 0,0572–0,0694; Terra 0,0617; Sol 0,1284; Opus 0,1407–0,1651. La suma de las 12 respuestas es 0,3979–0,4351 USD estimados a tarifas directas, no un cargo real: se ejecutaron mediante CLI. Por caso, Sonnet promedia 0,0286–0,0347 USD y Terra 0,0309 USD.

Decisión del propietario, 29/10/2026: **Claude Sonnet 5.5 asignado a A08**. El fallback automático queda en **GPT-6.1 Sol** para cubrir fallos de Anthropic. Opus 5.5 se conserva como alternativa Anthropic de mayor capacidad, pero no como failover del proveedor. Esta distinción es necesaria porque el runtime solo activa el fallback automático cruzando a OpenAI. La configuración queda registrada en el contrato de decisiones, runtime, laboratorio, auditoría y Costes de IA. A08 sigue siendo manual y de solo lectura; aún no hay frecuencia confirmada para estimar el gasto mensual. Falta probar la llamada real con `search_knowledge` habilitado y una API.

## A06: piloto por eventos y modelo asignado — 29/10/2026

Seguimiento del piloto, arquitectura, resultados y límites en [A06_STOCK_EVENTOS_PILOTO.md](A06_STOCK_EVENTOS_PILOTO.md). E-NORA Demo está inscrita en observación sin consumo API. Añadidas 18 respuestas válidas (tres casos por seis modelos, sin Astra): mismo snapshot con/sin señal de evento y una propuesta previa pendiente. Los seis evitan duplicar la propuesta. Haiku obtiene 48/0/0 campos en esta tanda. Decisión cerrada: Haiku 5.5 para A06 y GPT-6.1 Sol como fallback de mayor capacidad si Anthropic falla. La decisión está en código, Costes de IA y configuración de desarrollo. El piloto sigue en observación sin API. El filtro usa cobertura configurable y nivel agotado, no un porcentaje fijo de caída. Hay 33 comprobaciones dirigidas entre reglas, evidencia, SQL y flujo; el adaptador de API real del flujo es simulado. Ningún otro agente se ha migrado.

## A06: pruebas iniciales — 29/10/2026

Planificador de stock: alcance programado por tienda, sin pasada adicional organizativa. La referencia de coste es una ejecución por día y tienda, sujeta a actividad, revisión pendiente y cupos; la ejecución manual y los reintentos son adicionales. Se comparan seis modelos con contrato nativo y cuatro casos: histórico corregido, stock urgente, tarea duplicada y datos insuficientes. La rúbrica previa cubre 16 campos por caso; dos revisores terminaron las 64 comprobaciones de cada modelo. No se ejecutan herramientas, tareas ni compras. La primera versión del caso de sincronización insuficiente incluía una previsión numérica incompatible con semanas incompletas; se archivó y se repitió corregida. El ID servido por Codex no se confirma.

La primera tanda de los tres casos sintéticos heredó el periodo temporal del snapshot histórico, incompatible con su stock reciente. Las 21 respuestas afectadas se archivaron en `report.json.a06-inconsistent-period-archived`, se excluyeron y se reejecutaron con periodo explícito 29/09–29/10. El verificador comprueba el periodo, la cobertura y que no exista previsión numérica con semanas incompletas.

### Comparación por campos — 29/10/2026

Las 24 respuestas activas cumplen el contrato. Balance sin fallo detectado / fallos coincidentes / dudas: Sol 63/0/1; Sonnet y Terra 62/0/2; Haiku 61/0/3; Opus 60/0/4; Luna 60/1/3. No son porcentajes de precisión; los revisores también son candidatos. Se corrigió el caso histórico: la versión archivada mezclaba ventas hasta el 19/10 con inventario marcado sincronizado hacía 2,8 horas. La tanda actual presenta el stock como desconocido y con 10 días sin sincronización. La única tarea histórica propuesta por Haiku es reparar y verificar la sincronización general; no recomienda comprar. En el caso urgente los seis enlazan la revisión al producto exacto y no ejecutan una compra. En el duplicado los seis evitan otra tarea para T-06; en datos insuficientes Haiku y Opus proponen comprobar la sincronización y los demás se quedan en recomendaciones.

Coste API orientativo para una tienda, una ejecución al día durante 30 días, sin caché: Haiku 0,12 USD; Sonnet 1,86; Opus 3,40; Luna 0,08; Sol 2,20; Terra 1,04. Es una media de cuatro usos CLI a tarifas estándar; no una factura real. Con la utilidad de las tareas ya revisada, Haiku queda asignado por su menor coste y porque convierte la sincronización rota en una tarea y se abstiene ante duplicados. Sol tiene el mejor balance de campos y la tarea urgente más detallada, por eso queda como fallback de mayor capacidad, pero cuesta unas 18 veces más en el escenario de 30 ejecuciones. Las propuestas requieren aprobación humana; faltan pruebas API, herramientas y operación real.

## Decisión posterior A04 — 28/10/2026

El propietario elige GPT-6.1 Terra para A04; Sol queda como alternativa si la calidad observada lo exige. La política compartida lo fija en código, prevalece sobre ajustes anteriores y usa Responses. El perfil de costes toma la media de cuatro respuestas CLI sin descuento de caché: 29.351,25 tokens de entrada y 651,75 de salida; a tarifa estándar equivale a 1,9566 USD por 60 ejecuciones. El despliegue remoto y una prueba API real aún están pendientes. La recomendación y la versión TEST descritas abajo son históricas y anteriores a esta decisión.

Costes de IA incluye un acumulado estimado de agentes cerrados; A01 queda pendiente hasta indicar reuniones mensuales (referencia de 60 minutos). Es una proyección, no gasto facturado, y no incluye agentes sin decidir, herramientas ni reintentos.

## A05: comparación iniciada — 28/10/2026

### Revisión por campos — 29/10/2026

Decisión posterior del propietario: **A05 cerrado con GPT-6.1 Sol**, Terra queda como alternativa para reevaluación futura y no se activa automáticamente. La política compartida queda fijada en código y se incorpora al acumulado de costes con 30 generaciones manuales por mes como hipótesis editable. El promedio equiponderado de tres casos y sin caché estima 2,55052 USD/cliente/mes; aún requiere despliegue y medición de API. No se cambió la versión remota de la base de datos.

Dos revisores automáticos (Sonnet y Sol, ambos candidatos) evaluaron las 21 respuestas sobre 16 campos por caso. Agregado sin fallo detectado / fallo coincidente / dudas: Sol 48/0/0; Astra 47/0/1; Terra 42/0/6; Luna 38/0/10; Haiku 35/0/13; Sonnet 35/0/13; Opus 28/0/20. Las dudas son discrepancias o citas no verificables; las cifras no son porcentajes de precisión. La rúbrica se definió después de las respuestas y puede tener sesgo retrospectivo. Las tres ventanas y zonas se comprobaron directamente. Sol ofrece la mejor combinación observada de cautela y coste frente a Astra; Terra merece seguimiento por su menor coste, con dudas sobre la necesidad del segundo envío y verificaciones previas. Recomendación: Sol, pendiente de decisión del propietario; sin modificar el modelo de A05. Son solo tres casos y no hay prueba de herramientas o API. Faltan escenarios de campañas Meta y aprobación real.

La primera tanda histórica (seis modelos originales más Terra) no recibió el esquema de salida nativo. Los siete produjeron JSON que no supera el validador actual; esto es un defecto del procedimiento de prueba y no demuestra que fallen con el contrato entregado. Se conserva para trazabilidad y se repitió con el esquema nativo.

Nueva tanda: 21/21 respuestas válidas contra el esquema en tres casos por siete modelos: snapshot histórico y dos escenarios sintéticos congelados (campaña con stock disponible, y campaña duplicada con stock crítico y descuento sin validar). No se realizaron búsquedas, llamadas a herramientas ni publicaciones. Los siete se abstuvieron en el histórico y el escenario de stock crítico. En el viable, Luna se abstuvo y los otros seis propusieron iniciativas. La lectura inicial favorece Sol por una propuesta de un solo email con comprobaciones previas y cautela en atribución; Terra propone dos envíos con una sola observación histórica, lo que requiere revisar si el segundo está justificado. Revisión sistemática de todos los campos, más escenarios y pruebas de herramientas están pendientes; no se asignó modelo.

Coste orientativo para 30 generaciones manuales al mes, promedio equiponderado de los tres casos y entrada sin descuento de caché (USD): Haiku 0,29; Sonnet 3,80; Opus 4,99; Luna 0,11; Sol 2,55; Astra 11,39; Terra 1,24. La frecuencia es hipotética, incluye sobrecarga de CLI y no incluye herramientas ni reintentos; no es una factura de API. El ID servido por Codex no está confirmado. Los resultados y el original se muestran en el laboratorio.

## A04: revisión en curso — 28/10/2026

A01 y A02 siguen cerrados con Sol. A04 es el planificador diario: propone hasta cinco tareas con evidencia y horizonte diario; la ejecución de acciones y aprobación no se prueba con CLI. La versión activa leída en TEST es v13 con `gpt-6-luna`, herramientas `sql_select` y `search_knowledge`. No se cambia todavía su asignación.

Se comparan los siete modelos, incluido Terra, en cuatro casos con contrato nativo: snapshot histórico real y tres escenarios sintéticos (urgencia que el backlog cubre tarde, riesgo cubierto y reactivación con evidencia nueva). El prompt activo, contrato y requisitos se congelan antes de cada generación; se evalúan 16 campos y se estima precio con CLI, incluyendo el escenario de organización y tienda. No hay herramientas reales ni escrituras.

La revisión de las entradas detectó tres errores en los fixtures propios: periodo sintético heredado del snapshot real, nombre de tienda distinto del objetivo y ventas incompatibles con cobertura. Se archivaron las tandas afectadas en `report.a04-invalid-period-archived.json`, `report.a04-invalid-store-archived.json` y `report.a04-invalid-coverage-archived.json`, y se regeneraron solo los casos corregidos. Las entradas antiguas y sus respuestas no cuentan contra modelos. El verificador comprueba periodo, tienda y aritmética de cobertura. Las referencias corregidas se fijaron antes de cada nueva generación; no se ha modificado ninguna respuesta generada.

El simulador de Costes pasa de una a dos ejecuciones nominales diarias para A04 en un escenario de un cliente y una tienda: una caché organizativa y otra por tienda. Esta es una hipótesis de demanda, no frecuencia real garantizada. El cron, actividad, aprobaciones pendientes, cupos y refrescos manuales pueden cambiarla; las salidas CLI no miden llamadas a herramientas ni facturas de API.

Estado: terminadas **28/28 respuestas**, las 28 válidas contra el contrato nativo, y las 28 evaluaciones por dos revisores automáticos completos. No se han cambiado datos de la tienda ni se han creado tareas. Sonnet 5.5 y Sol 6.1 evaluaron 16 campos por resultado; también son candidatos y no son revisores independientes. La CLI de Codex no confirma el ID servido. Los recuentos no son porcentaje de precisión; hay dudas por citas de los revisores que no se pudieron verificar y algunos campos agrupan el mismo defecto.

| Modelo | Sin fallo detectado / fallos coincidentes / dudas (64 campos) | USD/mes, escenario de 60 ejecuciones |
| --- | --- | ---: |
| Haiku 5.5 | 39 / 5 / 20 | 0,30–0,37 |
| Sonnet 5.5 | 40 / 7 / 17 | 2,92–4,11 |
| Opus 5.5 | 43 / 6 / 15 | 6,36–8,73 |
| Luna | 57 / 3 / 4 | 0,16 |
| Sol 6.1 | 53 / 0 / 11 | 4,11 |
| Astra | 59 / 0 / 5 | 17,75 |
| Terra 6.1 | 54 / 0 / 10 | 1,96 |

El precio mensual usa un caso hipotético con una ejecución diaria del ámbito organizativo y otra de una tienda, 30 días, ningún refresco manual, el promedio igual de las cuatro muestras CLI y sin asumir hits de caché entre pasadas. No es frecuencia observada, ni factura API, ni incluye herramientas y reintentos. En TEST, al consultar `ai_agent_refresh_limits`, A04 no tenía override: el valor por defecto del código para pruebas es 1.000 regeneraciones manuales diarias por organización/agente; el presupuesto puede limitarlo. Definir el límite operativo antes de producción, sin cambiarlo arbitrariamente durante esta auditoría.

Lectura propuesta: **Sol** por la tarea de urgencia: pide disponibilidad y fecha al proveedor, nombra la tarea T-10 que vence tarde y permite cerrar hoy dejando la dependencia registrada si el proveedor no responde. Terra es una alternativa más barata y no duplicó la tarea cubierta; su propuesta urgente deja más vaga la medida y el cierre, y en el caso cubierto no menciona la hora de vencimiento ni advierte la falta de plazo de suministro. Astra recibe más campos sin fallo detectado, pero cuesta más y en el histórico no concreta qué avanzar de las tareas existentes. Luna es mucho más barato, pero en el caso histórico no explica qué tareas avanzar y cita fuentes antiguas; en el urgente no advierte bien el plazo ausente. Claude Sonnet/Opus amplían la tarea urgente a cambios y canales sin evidencia suficiente. Estos ejemplos son observaciones de cuatro muestras, no garantías.

La recomendación A04 es **provisional y no asignada**. La versión activa observada en TEST conserva `gpt-6-luna`; A01 y A02 continúan cerrados con Sol. La ficha de laboratorio muestra los siete modelos, los escenarios, los campos y los costes. No iniciar otro agente en esta tanda.

Verificación local: 17 pruebas de normalización, acceso, frecuencias y precios aprobadas; tipos de API/web y lint dirigido aprobados. El verificador comprueba 42 casos/261 combinaciones, sus hashes y las 28 evaluaciones A04 completas. Laboratorio de A04, auditoría y Costes devuelven HTTP 200. No se pudo inspeccionar visualmente el navegador porque el host de acceso al navegador no estaba disponible; tampoco se han probado llamadas reales a herramientas ni la API de pago.

## A02: veredicto final tras añadir Terra — 28/10/2026

**A02 queda asignado a GPT-6.1 Sol en código local**, también para el panel del consultor. La decisión compartida impide que un override antiguo cambie este agente. Se usa Responses, razonamiento medio y la resiliencia existente de A02; A01 continúa con su decisión propia. La versión de base de datos y su override histórico no se han modificado: el runtime aplica la decisión compartida. No hay despliegue ni consumo API de IA.

Terra se añade al catálogo de comparaciones desde A02 y se han generado sus cinco respuestas con las mismas entradas, prompt y contrato nativo: 5/5 completadas y válidas. Los otros casos conservan su catálogo original de seis modelos; Terra no reabre ni altera resultados de A01. La extensión evaluó Terra y Sol en pareja con 16 campos y conserva por separado los recibos de los revisores. Tres vistas se revisaron con Sonnet y Sol. Codex agotó su cuota para las dos restantes, que se completaron con Sonnet y Opus; se conservan tanto el bloqueo como los recibos. Ambas revisiones son automáticas, sus modelos también participan como candidatos y las parejas distintas limitan la comparación.

Tras aplicar a Terra la misma comprobación aritmética que a Sonnet, Opus y Luna —sin borrar los juicios originales— el balance es **Sol 77/0/3 y Terra 73/0/7** sobre 80 campos (sin fallo detectado/fallos coincidentes/por resolver). No es precisión estadística. Terra deja una duda sobre causalidad en Meta al decir que la inversión «generó» compras atribuidas; en Klaviyo falta una advertencia sobre atribución. Sol distingue con más claridad la atribución, rentabilidad y frescura. Sol conserva tres dudas propias. Se elige Sol de forma conservadora para este diagnóstico financiero; no se descarta Terra para otros agentes.

Con una tienda y consultor, coste estimado basado en las respuestas CLI y tarifa estándar sin hits entre pasadas: Sol **12,5811 USD/mes**, Terra **5,9758 USD/mes**, diferencia **6,6053 USD/cliente/mes**. Para 100 clientes, la diferencia sería unos 660,53 USD/mes. Las ventanas 7/90 son proxies de 30 días, hay variabilidad de CLI, caché, reintentos, herramientas y ejecución real. La CLI de Codex no confirma el ID servido. No se demuestra que la mejora de calidad compense el coste de forma estadística o comercial; se debe contrastar con mediciones reales cuando haya acceso API. Tarifas oficiales: https://developers.openai.com/api/docs/models/gpt-6.1-terra.

El perfil de Costes para A02 usa la media ponderada de Sol del escenario de una tienda, sin mezclar los runs históricos de otros modelos; el panel inferior calcula por vista. A02 queda cerrado en laboratorio y auditoría, y su modelo aparece fijado en Costes. Los resultados y sus dudas permanecen accesibles. Este veredicto sustituye los estados históricos de «propuesta pendiente» de las secciones posteriores.

Validación: 24 pruebas dirigidas aprobadas, incluyendo overrides A01/A02, Responses con herramientas, precios, caché y demanda; tipos de API/web y lint dirigidos aprobados. Verificación directa del laboratorio: 38 casos/233 combinaciones, 35 respuestas nativas de A02 con evaluaciones por campos y referencias intactas. Servicio local de Costes consultado en TEST: modelo efectivo y por defecto `gpt-6.1-sol`, no configurable, perfil estimado 25.480 tokens de entrada y 1.516 de salida, más 2 ejecuciones del panel al día. Las cuatro rutas administrativas devuelven HTTP 200. No se ha comprobado visualmente el navegador ni la integración API de pago.

## Estado vigente de A01 — cerrado el 28/10/2026

El propietario ha cerrado la revisión y ha elegido **GPT-6.1 Sol (`gpt-6.1-sol`)** para A01 en todas las duraciones. La decisión está aplicada en código mediante `packages/contracts/src/ai-model-decisions.ts`, compartida por runtime, laboratorio, auditoría y Costes de IA. Prevalece sobre overrides antiguos de cliente/plataforma. Los estados «candidato» o «asignación pendiente» de los cortes históricos de este documento quedan superados por este cierre.

Las respuestas y los fallos de otros modelos quedan archivados y plegados. No se borran ni se convierten en pruebas aprobadas. A02 se revisa individualmente a continuación; A03 y siguientes siguen pendientes.

## A02 — revisión individual del 28/10/2026

- A01 permanece cerrado con Sol. No se cambia el modelo asignado a A02 durante la comparación.
- Lectura de `agent_versions` en TEST: versión activa v11, prompt `a02_monitor_negocio_system@v10`, modelo `claude-sonnet-5`. No había ejecuciones completadas recientes de A02 para la organización de pruebas.
- Se conserva el snapshot Meta real histórico y su tanda anterior. Se añaden cinco casos nativos: overview, Shopify, Meta, Klaviyo y panel del consultor. Meta reproduce el snapshot histórico; las otras cuatro vistas usan cifras **sintéticas**, rotuladas expresamente. No representan la situación comercial actual de la cuenta.
- 30 generaciones nuevas: cinco vistas por seis modelos, todas completadas y válidas contra el contrato nativo. Una muestra por vista/modelo; sin medición estadística de precisión ni p95. Los modelos reciben las mismas entradas de cada caso, sin herramientas ni acciones.
- A02 interpreta métricas calculadas por backend; diagnostica y recomienda. No crea `proposed_writes` ni tareas: A04 se ocupa de convertir vacíos en tareas.
- Se revisan 16 campos con Sonnet y Sol, ambos también candidatos: no son revisores independientes. Entradas, requisitos de cada caso, respuestas y referencias conservan sus hashes. La rúbrica v1 produjo falsos positivos al excluir severity=info y confundir las vistas con el panel exclusivo del consultor. Se archivó en `field-evaluations.a02-v1-invalid.json` y se repitió **solo la evaluación** con `a02-fields-v2-contract`. Se informa de esta corrección posterior en la UI; no se presenta toda la rúbrica como preinscrita sin cambios.
- Corrección adicional de interpretación: pasar de +3.000 a −2.000 da −166,666… %. Es aritméticamente correcto y el prompt servido no prohíbe ese cálculo. Las marcas automáticas de «porcentaje inventado/prohibido» no deben perjudicar a Sonnet, Opus o Luna. Se conserva el juicio original junto a su revisión de fuente y aritmética; no se borran los recibos de los evaluadores.
- Corregido el precio del laboratorio: `input_tokens` de OpenAI ya incluye caché. Se descuenta antes de cobrar entrada nueva y se tarifa la lectura de caché. Anthropic informa categorías separadas. Se respeta el intervalo de escritura 5 min/1 h y los tramos largos de Haiku/Sol. Hay pruebas de regresión. Los tokens CLI incluyen contexto propio y caché variable: el precio mostrado es orientativo, no un presupuesto API normalizado ni una factura.
- Medias de cinco generaciones, USD orientativos: Haiku 0,002787–0,003137; Sonnet 0,035506–0,043006; Opus 0,073168–0,087088; Luna 0,002354; Sol 0,064858; Astra 0,276428. Sin consumo API pagado. El ID servido por Codex continúa sin confirmación; Claude sí lo informa.
- La UI agrupa cobertura por vista, balance por modelo, 16 campos del caso seleccionado, precios y lecturas explicadas. Los originales quedan plegados y accesibles.

Tanda terminada: 30/30 respuestas y 30/30 revisiones con ambos evaluadores completados. Balance sobre 80 campos por modelo tras retirar los tres falsos positivos de aritmética: Sol 77/0/3, Astra 77/0/3, Luna 71/1/8, Haiku 63/1/16, Sonnet 61/6/13 y Opus 61/3/16 (sin fallo detectado / fallo de campo coincidente / por resolver). No son porcentajes de precisión y los evaluadores pueden señalar defectos distintos dentro de un mismo campo.

Conclusión propuesta: **GPT-6.1 Sol** para A02. Respeta mejor las cautelas de rentabilidad, atribución y datos incompletos en estas muestras. Astra cuesta unas 4,3 veces más sin mejora demostrada; Haiku cuesta unas 21–23 veces menos que Sol, pero en Meta inventa desde cuándo existe el error de sincronización y conserva otras dudas. Sonnet sugiere escalar Meta sin verificar costes y llama bajo al clic del 2 % sin referencia. Opus introduce el umbral de cobertura >90 % sin respaldo. Luna omite advertencias importantes de Meta y simplifica la lectura de Klaviyo. Las tres dudas de Sol se refieren al impacto esperado de completar costes, detalle de cobertura histórica de Meta y confianza del panel. No se justifica aún un routing automático por vista.

La decisión de A02 queda pendiente del propietario: **no se modifica su runtime ni su modelo de costes asignado**. La propuesta y su justificación están reflejadas en laboratorio y auditoría, con los fallos originales accesibles. Próximo agente: no iniciar hasta que el propietario cierre esta revisión.

Validación local: 11 pruebas de normalización, precios y acceso aprobadas; contratos compilados; tipos de web y API comprobados; lint dirigido de web aprobado. `ai-model-lab-verify.mts --fields --monitor-fields` comprueba 38 casos/228 combinaciones, hashes intactos, A01 conservado y las 30 revisiones nativas A02 con dos evaluadores. Laboratorio, detalle A02, auditoría y Costes de IA devuelven HTTP 200. No se ha realizado una nueva validación visual ni un despliegue externo.

## Objetivo y alcance autorizado

### Corrección del coste operativo A02 — 28/10/2026

La propuesta anterior comparaba calidad y precio por respuesta, pero **no bastaba para concluir que Sol fuera rentable**. Se ha añadido un cálculo compartido en Laboratorio y Costes de IA, sin cambiar modelo ni programación.

- El cron configurado en `apps/worker/src/repeatable-jobs.ts` es `0 6,15 * * *`, Europe/Madrid. No es un cron cada 12 h: alterna 9 y 15 h. Abrir las pantallas hace GET de la caché; no genera otra respuesta. El POST manual de A02 devuelve 410.
- `runDiagnosticOrchestratorTickInner` genera cuatro vistas independientes de 30 días (overview, Shopify, Meta, Klaviyo), tanto para cada tienda como para la organización completa. Solo para la organización añade overview de 7 y 90 días. Mínimos: 24 h, 56 h y 168 h, respectivamente. Una sola tienda también tiene ejecución separada de tienda y agregado.
- `runPanelReadingsPass` añade la lectura **del consultor**, con ventana de 30 días, mínimo de 8 h y dos pasadas al día. Requiere consultor asignado. Con una tienda genera solo el agregado; con varias genera agregado y cada tienda. El número de consultores/visitas no multiplica esta caché.
- El ajuste positivo de `platform_ai_agent_settings.runs_per_day` escala solo los intervalos de los dashboards usando la referencia heredada 4,33. No escala el panel. Valor cero apaga ambos. Se conserva esa referencia para no alterar silenciosamente el runtime; Costes ahora añade las dos lecturas del consultor a sus totales de diseño para una tienda. No se publica un supuesto máximo A02 basado en una sola cadencia.
- Demanda aproximada por cliente, N tiendas y sin override: dashboards `4×(N+1)×24/60 + 1 + 1/7`; panel `2×(N>1 ? N+1 : 1)` si hay consultor. El redondeo 56→60 h es una hipótesis de planificación. El cron real y contar desde `finished_at` pueden retrasar las ventanas diarias/semanales; no se presenta esta demanda como frecuencia real medida.
- Con una tienda y consultor: **4,342857 + 2 = 6,342857 lecturas/día**, unas **190,29 al mes**. Fórmula monetaria: suma por vista de precio unitario × su demanda diaria × 30 × número de clientes. Las ventanas 7/90 usan como proxy la respuesta overview de 30 días: todavía no se han medido sus contextos propios.
- No se proyectan hits de caché entre pasadas: se convierten en entrada nueva en OpenAI y escritura de caché en Claude, manteniendo intervalo 5 min/1 h. Los tokens siguen siendo CLI, con sobrecarga interna; no son un presupuesto API normalizado. Se puede añadir reserva de 10 % o duplicación de consumo por intentos, sin fingir que sea la tasa de fallos observada.

| Modelo | Dashboards USD/30 días | Consultor USD/30 días | Total USD/30 días |
| --- | ---: | ---: | ---: |
| Haiku 5.5 | 0,3896–0,4480 | 0,1930–0,2221 | 0,5826–0,6700 |
| Sonnet 5.5 | 5,3568–6,7922 | 2,4460–3,0246 | 7,8028–9,8168 |
| Opus 5.5 | 10,4881–12,8133 | 5,3132–6,4697 | 15,8013–19,2830 |
| Luna | 0,3353 | 0,1640 | 0,4993 |
| Sol 6.1 | 8,6367 | 3,9444 | **12,5811** |
| Astra | 36,9852 | 16,9194 | 53,9046 |

Escenario: un cliente, una tienda, consultor, 30 días, sin override ni intentos adicionales, USD sin impuestos. Con 100 clientes iguales, Sol estima 1.258,11 USD/mes; Haiku 58,26–67,00. La diferencia de calidad observada debe justificar aproximadamente 11,91–12,00 USD más por cliente/mes; no hay todavía datos de precio del servicio ni valor de errores evitados para afirmar rentabilidad comercial.

Limitaciones de capacidad: cupo predeterminado de 12 runs/día por organización para **todos** los agentes; ciclo principal 15 runs/pasada (configurable) y ciclo panel hasta 20/pasada para toda la plataforma. El panel corre después del principal y comparte presupuesto/cupo organizativo. El principal A02 encola solo una tienda por organización y pasada. Con tres tiendas, la demanda A02 ya supera por sí sola las 12 ejecuciones diarias; incluso con dos casi agota el cupo. La UI avisa de lecturas pospuestas, sin recortar costes para fingir que se atendieron. Los límites de ejecuciones no son un límite en dólares.

Lectura real de TEST el 28/10 para la organización autorizada, últimos 30 días: **17 ejecuciones antiguas, todas manuales**, entre 06/10 y 15/10, en cinco días activos; 8 succeeded, 6 timeout, 1 rejected_output, 1 failed y 1 budget_exceeded. Ningún cron ni lectura panel registrada. Suma de `estimated_cost_usd` disponible: 3,084586 USD, de los que 0,790968 corresponden a succeeded; failed tiene coste null. Es contabilidad estimada histórica, no factura, no gasto de Sol, ni evidencia de uso diario típico actual. Sin override A02 en plataforma en esta lectura. Las consultas fueron SELECT; no se tocaron datos.

Las 30 generaciones y sus evaluaciones se conservan. **Sol sigue siendo candidato por calidad; cierre económico y asignación A02 pendientes.** El cálculo está en `a02-cost-sim.ts`; se valida la inclusión del panel, varias tiendas, apagado, escala de dashboards, ponderación por vista y retirada del descuento de caché.

Verificación de este cambio: 14 pruebas de costes/caché/proyección y política de asignación aprobadas; tipos de web/API y lint dirigido aprobados. Lectura directa del servicio con `.env.local`: modelo A02 efectivo `claude-sonnet-5`, sin override, referencia 4,33, panel adicional 2, cadencias 24/56/168 h, panel 8 h, cupo organizativo 12. Las dos rutas web responden HTTP 200. No hubo nuevas generaciones de modelos, consumo API de IA, cambios de asignación, publicación ni nueva inspección visual de navegador.

Comparar los 27 agentes con seis modelos mediante las suscripciones de Claude Code y Codex, agrupar resultados en una página de platform admin por agente y registrar los errores y sus correcciones. No contratar consumo API ni publicar cambios de modelos sin validar su calidad.

- Cuenta: `borregorafa99@gmail.com`.
- Consultor: `rafael@noraapp.es`; asignación activa verificada.
- Proyecto de pruebas: `kopcblejsxpkxoykldyh` (TEST ES IA), configuración de `.env.local`.
- Organización: `5ebc7b02-ca86-402e-bd61-9abd22f1ee04`.
- Tienda activa: E-NORA Demo. Las otras dos tiendas están inactivas y no forman parte de esta tanda.
- Modelos: Haiku 5.5, Sonnet 5.5, Opus 5.5, GPT-6 Luna, GPT-6.1 Sol y GPT-6 Astra.

## Estado histórico al retomar el 27/10

La tanda inicial de 162 combinaciones ya terminó su recorrido: 117 respuestas recibidas, 5 timeouts (150 segundos, arquitecto de Mi camino) y 40 bloqueadas por límites de suscripción. Los procesos del ejecutor y del revisor ya no están activos. Hay 30 revisiones automáticas persistidas.

El aviso de Claude indica reinicio a las 23:40 Europe/Madrid; el de Codex indica 23:43. Son avisos del proveedor, no una garantía de disponibilidad. No repetir llamadas mientras el límite siga vigente.

La existencia de una respuesta y un JSON interpretable no implica aprobación de calidad. La CLI de Claude informa el modelo canónico usado; el JSONL de Codex no expone el ID servido, por lo que se mantiene `actual_model: null` y no se finge confirmación.

## Artefactos y páginas

- `/admin/laboratorio-ia`: índice de agentes y estado de ejecución/revisión.
- `/admin/laboratorio-ia/<agentCode>`: comparación de dos respuestas, originales, consumo informado, limitaciones y fallos.
- `/admin/auditoria-ia`: auditoría anterior, actualizada para señalar correcciones en código.
- `.e-nora-test-lab/ai-models/report.json`: informe privado con entradas identificadas por hashes y resultados. Directorio ignorado por Git.
- `.e-nora-test-lab/ai-models/reviews.json`: revisiones automáticas separadas, para no colisionar con el ejecutor.
- `*.input.json` y `*.receipt.json`: entradas y recibos privados. No versionar ni publicar estos archivos.

La API solo sirve estos resultados a `platform_admin` y comprueba que el informe pertenece al mismo proyecto Supabase que el servidor. No hay cambios de permisos, escrituras en Supabase ni activación de modelos desde el laboratorio. El informe es local a este servidor; no se ha desplegado.

## Método y límites

Se exportaron mediante consultas de lectura contextos históricos reales de la cuenta, filtrados por organización y tienda activa o ámbito de organización. Se conserva la fecha original, el prompt de la versión activa y los hashes. Las salidas se normalizan para presentarlas, manteniendo el original. Se omiten contactos, credenciales y URLs con parámetros.

Esto es una repetición de contexto mediante CLI: no se ejecutan las herramientas nativas de E-NORA, no se adjuntan imágenes y no se reproducen todas las instrucciones añadidas por las rutas del runtime. Los estados de conexión corresponden a la exportación y los datos de negocio a su periodo histórico. No inferir estado actual de inventario a partir de ellos.

Las revisiones automáticas comparan candidatos sin nombre de modelo visible, piden citas literales y descartan notas cuya cita no aparece en la respuesta. No certifican exactitud de todas las conclusiones ni sustituyen una evaluación del runtime. No se escoge ganador con una sola muestra.

## Incidencias detectadas

1. Claude Code 2.1.252 rechazaba Opus 5.5: actualizado a 2.1.311; Opus respondió después.
2. El ejecutor interpretaba menciones de cuota dentro de respuestas válidas como un bloqueo: corregido y cubierto por prueba. Se reanudó conservando las respuestas terminadas.
3. El arquitecto de Mi camino superó 150 segundos en cinco modelos. Luna respondió, pero esa salida no se interpretó como JSON. Revisar tiempo, tamaño y contrato antes de atribuirlo a capacidad del modelo.
4. Algunos candidatos presentan inventario histórico como vigente. Revisar advertencias y evidencias por respuesta; no convertir esto en un diagnóstico actual.
5. Dos agentes de la tanda inicial no tenían snapshot admisible para la tienda activa: A01 y revisión de Mi camino. Se probaron como datos ausentes. Sí existe una transcripción real de A01: añadir un caso adicional sin borrar el de abstención.
6. La suite amplia del paquete IA encontró tres fallos: fixture/contrato A23, campos de JSON Schema estricto y fixture de análisis de imágenes. La API también tiene un error de TypeScript en `camino-routes.test.ts:13`, ajeno a esta entrega. Registrar y distinguir las correcciones de los cambios previos del usuario.
7. Suscripciones agotadas durante la tanda: se conservan bloqueos reales. No son fallos de calidad de esos agentes.

## Correcciones de la auditoría ya realizadas

- `resolveAgentModel`: especialistas usan plataforma > defecto; la preferencia del cliente solo queda para A09. Se retiró el selector global de especialistas por cliente. Pruebas del resolver aprobadas.
- Costes conserva IDs exactos. Si no hay tarifa del modelo, se bloquea la simulación y se informa; se eliminó el respaldo silencioso al primer modelo.
- Añadidos GPT-6 Sol y Luna al catálogo de capacidades y tarifa de respaldo de GPT-6 Sol. Sigue pendiente unificar y ampliar los catálogos y la contabilidad de caché por llamada.
- Estas correcciones son locales y no se han desplegado.

## Reanudación sin perder resultados

1. Leer este documento y comprobar `report.json` y `reviews.json`; no ejecutar otra exportación encima de la tanda. El exportador preserva un informe existente.
2. Terminar las verificaciones del panel y las correcciones pendientes sin consumir modelos.
3. La transcripción de A01 ya está añadida. No repetir `ai-model-lab-add-call.mts`: el caso de abstención se conserva y las entradas están archivadas por hash. Hay ahora 28 casos y 168 combinaciones previstas.
4. Después de restablecerse la cuota, ejecutar `npx tsx scripts/ai-model-lab-status.mts --resume-blocked`. Archiva el informe anterior y reabre solo los 40 registros bloqueados; conserva las 117 respuestas, los 5 timeouts y las 6 pendientes de A01. No cambiar los contextos ni volver a exportar.
5. Ejecutar `npx tsx scripts/ai-model-lab-run.mts`. Solo procesa estados `pending` y `running`; conserva `completed`, `failed`, `blocked` y `skipped`.
6. Ejecutar `npx tsx scripts/ai-model-lab-review.mts`. Conserva revisiones terminadas y continúa casos nuevos o pendientes.

Los timeouts requieren una tanda específica con límite mayor o salida acotada y registro del cambio de condiciones. No convertirlos en pendientes sin dejar constancia ni mezclar silenciosamente esa repetición con la tanda original.

## Verificación hasta este punto

- Nueve pruebas dirigidas aprobadas (resolver, acceso del laboratorio, normalización, privacidad y detección de límites).
- TypeScript del frontend aprobó antes de las últimas ampliaciones de revisión/casos; repetir al finalizar.
- ESLint dirigido sin errores; avisos previos en la página de agentes y un import no usado en Costes.
- Paquete IA: 94/97 pruebas aprobadas; los tres fallos están anotados arriba. Las dos pruebas dirigidas de `estimateCostUsd` pasan.
- Navegador disponible con rol cliente: el acceso al panel administrativo está bloqueado correctamente. No se acredita revisión visual completa como administrador.

Para actualizar automáticamente las cifras de este documento: `npx tsx scripts/ai-model-lab-status.mts`.

## Correcciones y verificación al continuar

- Corregido el contrato JSON estricto común: seis propiedades de tareas se declaraban sin incluirlas en `required`. Se deduplican las listas al extender A13/A14/A26. La restricción de que las propiedades sean requeridas está documentada por [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- Actualizados los fixtures de A23 y del análisis de imágenes para incluir campos que sus contratos ya exigían. No se relajaron los controles de producción.
- Suite del paquete IA: **97/97 pruebas aprobadas** tras estas correcciones. Los tres fallos anotados inicialmente ya están resueltos.
- Pruebas dirigidas del laboratorio y del resolver: **10/10 aprobadas**, incluida la reanudación que no repite respuestas terminadas ni borra fallos técnicos.
- Build de `@e-nora/ai` y `@e-nora/contracts`: aprobado.
- TypeScript del frontend: aprobado. TypeScript de API sigue señalando únicamente `camino-routes.test.ts:13` (`Object is possibly 'undefined'`), fuera de esta entrega.
- Verificación directa de artefactos y servicio: hashes intactos en los 28 casos, seis modelos por caso, IDs sin duplicados, índice sin salidas completas, 27 detalles filtrados por agente, rechazo de otro entorno y rechazo de parámetros que no identifican agentes.
- Endpoint local sin sesión: **401**, sin filtrar resultados. La revisión visual completa como administrador sigue pendiente.
- Registro del laboratorio sincronizado con la auditoría: 16 incidencias persistidas, más señales de salida y revisión calculadas por el servicio.
- No hay ejecutores de modelos activos al cerrar esta continuación. Falta cuota para las 46 combinaciones bloqueadas o pendientes y para continuar las revisiones automáticas.

## Continuación del 28/10: cobertura de los seis modelos

La cuota permitió reanudar las combinaciones bloqueadas: la tanda de 28 casos terminó con 163 respuestas y 5 timeouts conservados. Cada agente tiene pruebas con los tres modelos de Claude y los tres de OpenAI, independientemente del modelo asignado en producción. El índice del laboratorio ahora incluye una columna por modelo, con respuestas sobre casos previstos y estados de fallo o espera.

Se añadieron dos casos independientes, siempre con los seis modelos: un contrato nativo de Mi camino con salida estructurada, validación local y hasta 420 segundos; y una consulta de lectura del plan activo de la tienda (4 fases y 9 hitos). No sustituyen los primeros intentos. Son 30 casos y 180 combinaciones. El estado calculado siguiente prevalece sobre los cortes históricos anteriores.

El caso de contrato nativo de Mi camino produjo salidas válidas localmente con Luna (132 s), Haiku (298 s), Sonnet (315 s) y Opus (348 s). Sol y Astra agotaron 420 s sin una respuesta final aprovechable. Los tiempos pertenecen a esta ejecución CLI, no a un SLA ni a un benchmark estadístico; en Codex el modelo servido sigue sin estar confirmado por el recibo. El resultado muestra que el contrato y el límite de tiempo afectaban a la primera prueba, pero no certifica la calidad del plan ni sus herramientas.

Las revisiones son automáticas y provisionales. Las pruebas CLI no certifican ejecución de herramientas ni visión ni facturación API. Los nuevos recibos incluyen el identificador del caso para conservar separados los distintos ensayos de un mismo agente y modelo.

## Conclusión de A01 y comparación de precios (28/10/2026)

Esta conclusión económica inicial se amplía con la revisión de campos siguiente: los 42 controles de referencia no cubrían todos los campos del agente.

- En la ficha individual se añadió una columna de **precio API estimado en USD** junto al coste orientativo informado por CLI. Se calcula con los tokens del escenario seleccionado y las tarifas públicas consultadas en [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) y [OpenAI](https://developers.openai.com/api/docs/pricing).
- El precio Claude muestra un intervalo: el recibo no identifica si la caché se escribió con TTL de 5 minutos o de 1 hora. Para Haiku también se aplica la tarifa de contexto largo cuando el total de tokens de entrada, caché leída y caché creada excede 100.000. Son cálculos API orientativos, no cargos realizados; el coste real requiere una llamada de API con ID/modelo confirmado.
- En la prueba sintética de 120 minutos, GPT-6.1 Sol y Claude Opus obtuvieron 42/42 controles. Sol estima **0,1293 USD** y Opus **0,3672–0,5092 USD**; Sol tardó 66 s y Opus 52 s. Sol queda como candidato de mejor calidad-precio para la siguiente ronda y Opus como referencia premium. Haiku resulta más barato (**0,0122–0,0158 USD**), pero dejó dos dudas y produjo 12.485 tokens.
- Incidencia de coste registrada: para Haiku a 30 minutos, el recibo de CLI informa **0,0265 USD**, pero la tarifa API de contexto largo aplicada al uso registrado estima **0,1147–0,1327 USD**. Revisar cómo se midió o presentó ese coste antes de tomar decisiones económicas.
- No se cambia el modelo de producción de A01. Sigue siendo una muestra sintética de una plantilla, con jueces automáticos; Codex no confirma el modelo GPT servido. La siguiente evidencia útil es revisar varias transcripciones largas anonimizadas con referencia humana y repetir una ejecución API con modelo y coste verificables.

## A01: segunda evaluación de los 14 campos (28/10/2026)

Se ejecutaron seis revisiones CLI (Sonnet y Sol para cada duración) de las 18 respuestas existentes. A diferencia de los controles iniciales, los revisores recibieron el prompt real, el contexto y la transcripción completa, más recuentos de turnos calculados en código. Se conservan las salidas originales y la revisión anterior. La nueva rúbrica está en `scripts/ai-model-lab-a01-field-rubric.ts`; los resultados privados en `field-evaluations.json`, con hash de salida, hash de referencia y versión `a01-fields-v1`. La API solo los une cuando los hashes coinciden y no incluye detalles de campos en el índice.

La rúbrica es posterior a las generaciones y los dos revisores también son candidatos. No constituye evaluación humana independiente. Cada celda es un campo con todos sus subcampos; estos recuentos NO son porcentajes de precisión y no ponderan la gravedad del error.

| Modelo | Campos sin fallo detectado (de 42) | Fallos coincidentes | Por resolver |
| --- | ---: | ---: | ---: |
| GPT-6.1 Sol | 41 | 0 | 1 |
| GPT-6 Astra | 36 | 0 | 6 |
| Claude Opus 5.5 | 31 | 3 | 8 |
| Claude Haiku 5.5 | 20 | 9 | 13 |
| Claude Sonnet 5.5 | 19 | 5 | 18 |
| GPT-6 Luna | 17 | 15 | 10 |

Hallazgos comprobables:

- Haiku resume 29 bloques a 30 minutos, pero la transcripción contiene 16. En 60 minutos altera al menos una cita; en 120 describe bloques de tres turnos que tienen cuatro. Incluye huecos sobre temas tratados y amplía el acuerdo de validar costes a calcular su impacto en beneficio.
- Sonnet y Opus atribuyen al cliente un conjunto de cuatro compromisos que contiene uno del consultor. Sonnet también añade huecos de temas ya tratados y dependencias de canal no verificadas. Opus mantiene bien el núcleo de hechos, pero deja de ser una referencia de calidad máxima al revisar todas las señales.
- Luna estima para 120 minutos unos 113 turnos en total, frente a los 338 reales (Rafael tiene 57, no aproximadamente 9). También presenta como huecos asuntos ya tratados y omite seguimientos en summary; hay problemas de citas y advertencias.
- Sol distingue un compromiso del consultor y tres de la tienda y mantiene los cuatro trabajos y sus plazos literales. En 30 y 60 minutos obtiene 14/14 campos sin fallo detectado. En 120 obtiene 13/14 y una duda del sistema de revisión: Sonnet citó «Toda propuesta queda pendiente de revisión humana.» con punto, pero el original continúa con punto y coma. La advertencia sí existe; se conserva el juicio automático como incierto, sin convertirlo en un fallo del agente.
- La rúbrica pide identificar al responsable real en cada tarea. El esquema actual solo exige `owner: cliente | consultor`; por tanto, perder el nombre de Inés o Rafael es un defecto de calidad/contrato para trabajo multiusuario, aunque se cumpla el JSON. Esta exigencia adicional no debe interpretarse como incumplimiento de una propiedad obligatoria que el esquema nunca tuvo.

Estado previo al cierre: se propuso Sol para 30, 60 y 120 minutos y se documentaron las limitaciones de CLI e ID servido. Este estado fue sustituido por la decisión explícita del propietario y por la implementación descrita al inicio del documento.

Seguimiento de calidad conservado: calcular señales cuantitativas en código, conservar la persona responsable y no ampliar tareas, verificar citas literalmente y separar temas tratados sin resolver de omisiones reales del consultor. La selección futura debe considerar tokens de contexto, contradicciones y calidad de transcripción además de duración. Las generaciones originales no se modifican; cualquier repetición deberá conservar su versión anterior.

En el corte de las primeras 163 revisiones automáticas: 65 sin error evidente en esa muestra, 66 que requieren revisión, 30 con señal de error importante y 2 revisiones con citas incompletas que no se dan por verificadas. No son notas finales ni un ranking: hay que contrastar los señalamientos con la entrada original. Ejemplos: atribución confundida con incrementalidad en A02/Opus; acciones propuestas con datos caducados en A04/Haiku. También se ha registrado que los estados de integración de la organización no identifican necesariamente la tienda activa; esa ambigüedad del ensayo debe distinguirse de un fallo del modelo.

Comprobaciones: suite IA 97/97; pruebas de programación, laboratorio y permisos 10/10; rutas de Mi camino 4/4; TypeScript de API aprobado tras corregir una comprobación de existencia en su fixture. La revisión visual autenticada sigue pendiente porque el host del navegador no está disponible.

Cierre de ejecución del 28/10: 180/180 combinaciones recorridas, 173 respuestas y 7 timeouts; sin pendientes ni bloqueadas por cuota. Cada modelo tiene 30 intentos: Haiku 29 respuestas/1 timeout, Sonnet 29/1, Opus 29/1, Luna 30/0, Sol 28/2 y Astra 28/2. Los timeouts se concentran en el arquitecto de Mi camino (5 originales y 2 en el caso con contrato). No equivalen a siete respuestas de mala calidad: no hubo respuesta final evaluable dentro de su límite.

## Revisión de modelos agente por agente

### A01 Analista de llamadas

Rectificación: la recomendación inicial de Sol/Astra por dos casos fue demasiado firme; la única transcripción real tenía cuatro intervenciones y GPT-6.1 Sol también había hecho de juez. No bastaba para escoger modelo.

Se añadieron 18 pruebas con los seis modelos: reuniones sintéticas de 30, 60 y 120 minutos nominales, seis interlocutores y 14 controles congelados antes de las ejecuciones. Los controles cubren acuerdos, rectificaciones, tareas duplicadas, responsables/plazos, ideas canceladas, campaña solo preparada, margen sin confirmar y contexto histórico. Las 18 respuestas validaron el contrato nativo. Dos revisores automáticos anónimos coincidieron en 246 de 252 controles: Opus y Sol 42/42; Sonnet y Astra 41/42; Haiku y Luna 40/42. Hubo seis dudas, sin fallos coincidentes. Sol participa como juez, por lo que no es una evaluación independiente. La misma plantilla se amplió para las tres duraciones: mide carga de texto y recuperación de puntos conocidos, no la variedad de reuniones reales, audio ni diarización.

En esta plantilla Sonnet y Luna fueron más rápidos; Opus tuvo cobertura total de referencia y Sol logró la misma cobertura con salidas más concisas. Coste Claude es orientativo de CLI y Codex no expone coste API comparable ni confirma modelo servido. Decisión A01: todavía no fijar un mejor/peor modelo de producción; validar con transcripciones anonimizadas variadas y revisión humana. En A01 el panel muestra desglose por duración y criterios. Los otros agentes siguen pendientes de su revisión individual.

A las 08:48 Europe/Madrid termina también el revisor: 173/173 respuestas con revisión automática persistida. Ejecutor y revisor han finalizado correctamente. Por indicación del usuario se detiene aquí el trabajo, sin iniciar más pruebas. Quedan para una futura sesión la revisión humana, la comprobación visual autenticada y las evaluaciones del runtime con herramientas e imágenes; no hay aprobaciones de modelos para producción.

La comprobación final de artefactos y servicio aprobó los 27 agentes, 30 casos y 180 combinaciones: integridad de hashes, seis modelos por caso, aislamiento por agente, protección del índice y rechazo de otro entorno. TypeScript del frontend, lint de las páginas nuevas y formato aprobados. Estos cambios y los resultados están en el laboratorio local; no se ha desplegado ni cambiado la asignación de modelos como consecuencia del benchmark.

<!-- LAB_STATUS_START -->
## Estado calculado desde los artefactos

Comprobación: 29/10/2026, 11:10:12 (Europe/Madrid).

27 agentes, 57 casos, 356 combinaciones. Revisiones automáticas persistidas: 191.

Estados: completed: 349; failed: 7.

Todos los agentes participan con los seis modelos, con independencia del modelo asignado en producción.

| Modelo | Respuestas | Fallos | En ejecución o pendientes | Bloqueadas |
| --- | ---: | ---: | ---: | ---: |
| Haiku 5.5 | 56 / 57 | 1 | 0 | 0 |
| Sonnet 5.5 | 56 / 57 | 1 | 0 | 0 |
| Opus 5.5 | 56 / 57 | 1 | 0 | 0 |
| GPT-6 Luna | 57 / 57 | 0 | 0 | 0 |
| GPT-6.1 Sol | 55 / 57 | 2 | 0 | 0 |
| GPT-6 Astra | 43 / 45 | 2 | 0 | 0 |
| GPT-6.1 Terra | 26 / 26 | 0 | 0 | 0 |

| Agente | Respuestas / previstas | Bloqueadas | Fallidas | Revisadas |
| --- | ---: | ---: | ---: | ---: |
| a01_analista_llamadas | 30 / 30 | 0 | 0 | 30 |
| a02_monitor_negocio | 41 / 41 | 0 | 0 | 6 |
| a04_generador_tareas | 34 / 34 | 0 | 0 | 6 |
| a05_estrategia_campanas | 28 / 28 | 0 | 0 | 6 |
| a06_planificador_stock | 48 / 48 | 0 | 0 | 6 |
| a08_gestor_conocimiento | 18 / 18 | 0 | 0 | 6 |
| a09_copiloto_consultor | 6 / 6 | 0 | 0 | 6 |
| a11_generador_marketing | 25 / 25 | 0 | 0 | 6 |
| a12_analista_email | 6 / 6 | 0 | 0 | 6 |
| a13_operativa_shopify | 6 / 6 | 0 | 0 | 6 |
| a14_operativa_meta | 6 / 6 | 0 | 0 | 6 |
| a15_analista_imagenes | 6 / 6 | 0 | 0 | 6 |
| a16_texto_sobre_imagen | 6 / 6 | 0 | 0 | 6 |
| a17_plan_semanal | 6 / 6 | 0 | 0 | 6 |
| a18_plan_mensual | 6 / 6 | 0 | 0 | 6 |
| a19_arquitecto_camino | 5 / 12 | 0 | 7 | 5 |
| a19_revision_camino | 12 / 12 | 0 | 0 | 12 |
| a20_retencion_clientes | 6 / 6 | 0 | 0 | 6 |
| a21_adquisicion_shopify | 6 / 6 | 0 | 0 | 6 |
| a22_postventa_shopify | 6 / 6 | 0 | 0 | 6 |
| a23_creatividad_meta | 6 / 6 | 0 | 0 | 6 |
| a24_medicion_meta | 6 / 6 | 0 | 0 | 6 |
| a25_cambios_meta | 6 / 6 | 0 | 0 | 6 |
| a26_contenido_email | 6 / 6 | 0 | 0 | 6 |
| a27_planificador_mailing | 6 / 6 | 0 | 0 | 6 |
| a28_arquitecto_flujos | 6 / 6 | 0 | 0 | 6 |
| a29_analista_metrica | 6 / 6 | 0 | 0 | 6 |

<!-- LAB_STATUS_END -->

## Implementación del cierre de A01 — 28/10/2026

- Política compartida: `packages/contracts/src/ai-model-decisions.ts` fija `gpt-6.1-sol`, razonamiento medio, Responses y estado cerrado. Runtime y Costes ignoran overrides antiguos de A01; la API de ajustes rechaza asignarle otro modelo. No se reescriben versiones ni ejecuciones históricas.
- Adaptador: nueva ruta Responses para el ID exacto de Sol, con herramientas validadas, conservación de items de razonamiento cifrados, `store: false`, salida JSON estricta, streaming, abort/reintentos acotados y contabilidad de caché/razonamiento. Las tarifas se calculan por llamada; el umbral largo no se aplica sobre la suma de varias llamadas.
- Reuniones largas: A01 dispone de 600.000 caracteres por bloque y 800.000 en total, con 300 s por petición y un reintento. Si la serialización recorta contexto, se rechaza antes de llamar al modelo. Se evita el antiguo recorte de bloques a 12.000 caracteres y el timeout general de 45 s.
- Costes: tarifa Sol Standard (entrada 2 USD/MTok, caché leída 0,10, salida 10), umbral por encima de 272.000 tokens (entrada/caché ×2 y salida ×1,5). Referencia de simulación: 60 min sintéticos, 39.533 tokens de entrada y 2.496 de salida, unos 0,1040 USD. Escenarios visibles: 30 min 0,0906 USD; 60 min 0,1040 USD; 120 min 0,1293 USD. El perfil histórico agrupado por agente no se atribuye al modelo nuevo.
- UI: A01 figura cerrado y asignado en el índice del laboratorio, su ficha, la auditoría y Costes. Las respuestas, métricas detalladas y errores anteriores quedan plegados. El selector de modelo de A01 está bloqueado y los cambios masivos de simulación lo respetan.
- Verificación: 122 pruebas dirigidas aprobadas (incluyen Responses, streaming, herramientas, presupuesto, contexto largo, precio, override antiguo y catálogo de Costes). TypeScript de IA, API y web, y ESLint dirigido de administración: aprobados. Los artefactos privados siguen íntegros: 27 agentes, 33 casos y 198 combinaciones; las 18 revisiones por campos conservan sus hashes. Las cuatro rutas administrativas responden HTTP 200 sin errores de compilación.
- La comprobación de proveedor utiliza respuestas simuladas y no genera consumo API de pago. La revisión visual con sesión de administrador no se pudo ejecutar porque el host de navegador no está disponible. Los cambios están aplicados al código y al servidor local; no se ha realizado un despliegue externo.

## Cierre revisado de A05 — 30/10/2026

- Se conserva GPT-6.1 Sol como modelo principal y se fija GPT-6.1 Terra como fallback operativo en `packages/contracts/src/ai-model-decisions.ts`. Runtime comparte la decisión con Laboratorio y Costes.
- Comparación de seis modelos, sin Astra en la UI: cuatro casos guardados (dos replays históricos de TEST, un caso sintético viable y otro con duplicidad/stock escaso). Todos completaron respuesta; los tres casos con contrato nativo validaron 3/3 por modelo. El replay de 12/10 y su inventario sincronizado el 09/10 son contexto histórico, no una base para ejecutar campañas actuales. En los replays no se llamaron herramientas.
- Sol separa con cuidado resultados históricos de condiciones actuales y propone una sola iniciativa en el caso viable. Terra es prudente con el replay histórico y más barato, aunque sugiere dos envíos con solo una referencia histórica en el caso viable; se debe revisar la cadencia antes de usarla como principal. Luna se abstiene también en el caso viable; Haiku, Sonnet y Opus extrapolan una cadencia de dos envíos; Opus también presenta como probable una rotura desde inventario obsoleto.
- Coste API orientativo por 30 generaciones idénticas, tres escenarios nativos y sin descuento de caché: Haiku $0,29; Sonnet $3,80; Opus $4,99; Luna $0,11; Sol $2,55; Terra $1,47. A05 se ejecuta manualmente: esta columna no es gasto mensual real. El coste y la latencia de CLI no son factura ni validación del modelo servido.
- UI: la ficha `/admin/laboratorio-ia/a05_estrategia_campanas` omite Astra, abre la comparación guardada y presenta Sol frente a Terra. Costes aclara que 30 generaciones es un escenario hipotético. Auditoría individual actualizada con las seis lecturas.
- Verificación realizada: `npm run typecheck -w web` aprobado y la ruta local de A05 responde HTTP 200. La inspección visual autenticada no estuvo disponible porque el host del navegador no respondió.
## A05 - simulacion de plan nov-dic con datos TEST actuales - 30/10/2026

- Se incorporo al Laboratorio el caso `real-store-two-months-v2-2026-11`, con ventana 01/11-31/12/2026 y el contexto Shopify/Klaviyo/Meta de E-NORA Demo consultado en solo lectura. Se ejecutaron Haiku, Sonnet, Opus, Luna, Sol y Terra; los seis devolvieron JSON valido. Astra se excluye.
- La primera version del caso se marca `SUPERSEDED`: el agregado original no acotaba `processed_at` al momento de evaluacion e incluia pedidos TEST con fecha futura. V2 corrige el corte al 30/10. Las respuestas detectan tambien diferencias entre cortes mensuales de agosto y el periodo previo; no usarlos para afirmar tendencia.
- Hechos que limitan la campana: 2.466 pedidos y 133.330,70 EUR netos en los 90 dias hasta 30/10; inventario del 30/10 de 457 unidades en 34 referencias; lideres con cobertura descriptiva de 1,5-5,9 dias; margen no actualizado, conversion de Klaviyo sin sincronizar, consentimiento/tamano de audiencia no verificado y Meta pausado sin presupuesto confirmado.
- Sol (principal ya elegido) propone preparar y decidir en hitos fechados, pero no produce objetos initiative/campaign ni copy: abstencion razonada ante stock y mediciones insuficientes. Terra tambien se abstiene, con hitos breves. Sonnet ofrece el borrador de calendario mas directamente revisable: emails condicionales para BF/CM y Navidad, y una propuesta Meta condicionada; depende de revisar stock, margen, consentimiento, medicion y enlaces. Haiku propone una cadencia mas intensa y flows, por lo que exige mas revision. No se cambia la asignacion Sol/Terra con una unica simulacion.
- No se escribio en Shopify, Klaviyo o Meta; no se envio ni programo nada. Las respuestas se consultan en `/admin/laboratorio-ia/a05_estrategia_campanas`, seleccionando el caso de dos meses v2 y comparando Sol con Sonnet. Resultado de CLI: simulacion de texto, no llamada API facturada ni validacion de ejecucion en plataformas.

## A05 en cuentas cliente y consultor - 30/10/2026

- La pestaña Marketing > Campañas ahora muestra la planificación A05 mas reciente tambien cuando el modelo no produce acciones fechadas. La tarjeta incluye modelo, periodo, diagnostico, estado, hitos y alertas; es compartida entre cliente y consultor. Los asesores pueden abrir la revision de A05.
- Se importo a TEST el resultado que GPT-6.1 Sol ya genero por CLI para la ventana 01/11-31/12/2026, con estado `pending_approval`, `approval_required=true`, origen `cli-lab:a05-two-months-v2`, coste API nulo y nota de que no hubo llamada API ni herramientas. Output: `e719cf23-a5cf-4fa5-80ea-246a2ce6f4f5`; run: `54438fb6-7571-49e5-b73d-06c11534e383`.
- El resultado de Sol no propone campañas ni iniciativas: muestra en las dos cuentas su decision prudente de no programar aun, con los hitos y bloqueos. No se materializaron items de calendario porque el modelo no devolvio acciones y no se aprobo ni envio una campaña.
- Ruta para el cliente borregorafa99@gmail.com y el consultor rafael@noraapp.es: `/marketing?section=campanas`, con la tienda de prueba seleccionada. Ruta local responde HTTP 200. Typecheck web y API aprobados en esta tanda.

## Regla de trabajo para resultados de agentes - 30/10/2026

Cada prueba o ejecucion de un agente que se quiera revisar con Rafael debe cerrar el ciclo hasta la interfaz apropiada del producto, en las sesiones de cliente y consultor que correspondan. El Laboratorio IA sirve para comparar modelos; no sustituye la vista del producto.

- Persistir el resultado en la cuenta de pruebas con su organizacion y tienda correctas, indicando si procede de una ejecucion real de runtime o de una simulacion CLI. No presentar una simulacion como llamada API.
- Renderizar la respuesta con el contrato y componentes del agente (por ejemplo, resumen de llamada A01, aportes KPI A02/A29, tareas A04, plan A05), no dejarla solamente como JSON bruto en el Laboratorio.
- Usar la superficie de producto correspondiente y comprobarla como cliente y como consultor; respetar los permisos y el estado de revision/aprobacion que aplique. Si el modelo se abstiene o no devuelve acciones, mostrar tambien ese resultado y sus motivos, no una pantalla vacia.
- No crear, aprobar, publicar, enviar ni programar efectos externos como parte de una simulacion, salvo que se autorice expresamente. Anotar bloqueos y fallos encontrados en este seguimiento.
- Cierre A05: el plan Sol de noviembre-diciembre ya se persiste como simulacion CLI pendiente de revision y se muestra en Marketing > Campanas para cliente y consultor; la pagina del producto conserva el diagnostico aunque no haya acciones de calendario.

## A05 reabierto: continuidad y operación de email - 31/10/2026

Se detectó que la simulación anterior no investigaba campañas puntuales de Klaviyo, borradores y pendientes operativos. Se implementó `get_email_campaign_pipeline`, se integró como contexto inicial y se habilitaron diez herramientas de lectura. Se corrigió la instrucción de abstención global y el texto fijo de la UI que interpretaba cero acciones nuevas como «no programar campañas». Sol sigue seleccionado; no se ha generado una respuesta nueva durante esta revisión. El caso anterior conserva su JSON y ahora muestra la limitación en el laboratorio.

Detalle y límites: [Auditoría A05 de email](./A05_AUDITORIA_PLANIFICACION_EMAIL_2026-10-31.md). Migración de permisos aplicada en TEST y producción; código nuevo activo en el servidor local, pendiente de despliegue para producción. Verificación: 15 pruebas focalizadas, build de AI y typecheck API/web correctos; inspector real de TEST sin errores y sin fallback de tienda. API local reiniciada, health HTTP 200.

## A05: limpieza TEST y nueva ejecución Sol - 31/10/2026

Limpieza definitiva autorizada, solo NORA/base TEST de Prueba Borrego: 25 borradores, 3 calendarios/2 acciones, 1 secuencia, 2 diseños de flow y 32 ejecuciones/propuestas antiguas de marketing, con dependencias. Se preservó histórico e integraciones externas. Quedan cero borradores, acciones y secuencias antiguas de NORA.

Nueva simulación Sol con contexto runtime actual y lecturas reales del arnés, incluido catálogo de 25 productos. La primera tentativa se detuvo por un filtro incorrecto del arnés durante syncing y fue sustituida por el caso `a05_estrategia_campanas:clean-runtime-v2-2026-10-31`. Respuesta válida: 3 iniciativas / 4 emails condicionales, confianza baja. No se enviaron ni programaron campañas.

Resultado compartido en las cuentas de cliente y consultor: output `4a361ea7-d8f6-4340-a14c-7448f2b17c9d`, run `f087aaed-f67b-4ec2-9754-1bfd22ef6b6b`, pendiente de revisión, origen CLI. Comprobado el mismo payload de cuatro acciones con ambos accesos. El laboratorio abre el caso nuevo. Detalle: [Reinicio TEST A05](./A05_REINICIO_TEST_2026-10-31.md).

## A06: contexto runtime actual y seis modelos - 31/10/2026

Nueva captura real `a06_planificador_stock:real-store-runtime-2026-10-31`, 39 bloques, ocho productos con demanda, doce semanas y dos propuestas pendientes. Seis respuestas válidas, IDs correctos y sin duplicar pendientes. Se mantiene Haiku para la rutina y Sol como respaldo. Las tareas adicionales de Terra/Sol son razonables; la cantidad no se penaliza. Hallazgos y límites de cada modelo quedan en laboratorio y auditoría. Perfil de coste actualizado: referencia aproximada de 0,44 USD por 30 revisiones sin caché, con tokens CLI y tarifas internas del 28/10; no es consumo API medido.

Corregida la deduplicación de propuestas también en revisión periódica. El cliente ya recibe la lectura A06 en Shopify > Stock y las propuestas anteriores no desaparecen de la cola tras una nueva revisión. Output compartido `5cfca320-5109-41d5-b3e9-86a6c96762b9`, pendiente de revisión; dos propuestas nuevas para Arcilla/Boreal, sin compras ni tareas creadas automáticamente. Mismo payload comprobado para cliente y consultor; Bruma/Arena continúan pendientes. Eventos siguen en shadow. Detalle: [Revisión real A06](./A06_REVISION_REAL_2026-10-31.md).

## A08: catálogo real, seis modelos y resultado en Conocimiento - 31/10/2026

A07 está inactivo y sin handler; se continúa con A08 interno de conocimiento. Seis respuestas CLI con el mismo contexto runtime autorizado: 338 documentos (316 metodología global, 22 organización), 2.589 fragmentos, muestra de 16, candidato semántico y telemetría de 30 días. Una búsqueda real preparada por el arnés; sin selección dinámica de herramientas ni API LLM, sin Astra.

Terra principal, Sonnet respaldo entre proveedores y Sol alternativa. Referencia 0,0451 USD por ejecución sin caché; cuatro manuales serían 0,1805 USD, no frecuencia obligatoria. Coste y análisis guardados en laboratorio; comparación plegada y caso real por defecto. Corregido alcance que omitía 316 documentos, etiqueta de extracto parcial, visibilidad interna y despacho de fallback Claude desde OpenAI. Migración de tres nuevas RPC aplicada a TEST y producción; código pendiente de despliegue productivo.

Resultado Terra en Conocimiento > Gestor IA del consultor: output 3a5f3a8c-f473-464b-bb9c-5ae793d5bc21, cuatro hallazgos y dos recomendaciones, sin tareas ni aprobación para leer. Cliente recibe 403 por diseño interno. Identidades reales y payload verificados. Detalle y defectos de cada modelo: [Revisión real A08](./A08_REVISION_REAL_2026-10-31.md).

## A11 · tres plantillas internas desde capturas - 31/10/2026

A petición del propietario, se reconstruyen tres estructuras con marca/producto ficticios reemplazables: pregunta y descubrimiento, lista de momentos e hilo editorial. Se reutiliza el laboratorio interno de mailing y su repositorio privado, sin añadir borradores a tiendas. Marca Órbita y fotografía sintética; entre 18 y 21 campos por plantilla. Galería con previsualización móvil/escritorio, HTML/JSON y nuevas versiones. Persistidas como borradores v2 en TEST, sin publicación ni entrenamiento de pesos.

17 pruebas focalizadas, build de contratos y typecheck API/web correctos. Seis renders con viewport 600/360 px, imágenes cargadas y sin desbordamientos. Verificación del listado y permisos, sin recorrido autenticado completo de la galería. Detalle: [Tres plantillas internas A11](./A11_TRES_PLANTILLAS_INTERNAS_2026-10-31.md). La comparación de modelos de A11 permanece pendiente del nuevo proceso creativo.

## A11 · biblioteca ampliada a siete referencias con contexto - 31/10/2026

Las cuatro nuevas capturas se convierten en Colección y acceso, Descubrimiento en profundidad, Garantía y evidencia y Anatomía de producto. Siete plantillas internas TEST en total, con datos ficticios, imágenes reemplazables y entre 18 y 37 campos. Las tres anteriores reciben contexto común en nuevas versiones, preservando el contenido editado por el administrador. La galería muestra contexto editorial y lo incluye al descargar el JSON.

Acuerdo de trabajo: las capturas adicionales que el propietario aporte en esta revisión seguirán el mismo método. Primero terminar y revisar la biblioteca; después comparar Haiku/Sonnet/Opus/Luna/Sol/Terra, sin Astra, con el mismo contexto y recursos. Manifiesto preparado con hashes, origen manual y criterios; no se han ejecutado modelos ni entrenado pesos en esta fase. No confundir las composiciones de Codex con resultados de Opus.

Diez pruebas focalizadas y typecheck web correctos; ocho renders nuevos 600/360 px, imágenes cargadas y sin desbordamientos. Persistencia/listado de los siete borradores y 403 del consultor comprobados; repetición del script sin duplicar versiones. Detalle: [Siete referencias y protocolo de comparación](./A11_BIBLIOTECA_SIETE_REFERENCIAS_2026-10-31.md).

## A11 · biblioteca ampliada a diez referencias - 31/10/2026

Capturas 5.jpeg, 6.jpeg y 7.jpeg convertidas en Producto y kit, Colección y estilo de vida, y Beneficio y ritual en tres pasos. Contexto editorial, variables, riesgos y criterios persistidos; diez borradores internos en TEST. Diez pruebas focalizadas y seis renders nuevos 600/360 px correctos, con imágenes cargadas y sin desbordamiento. Listado de los diez y acceso interno comprobados. Manifiesto de comparación actualizado; seis modelos sin Astra, todavía sin ejecutar. Detalle: [Diez referencias internas](./A11_BIBLIOTECA_DIEZ_REFERENCIAS_2026-10-31.md).

## A11 · recopilación cerrada por ahora en trece referencias - 31/10/2026

Última tanda: Producto y ficha de datos, Ritual editorial y oferta, y Temporada y selección de productos. Trece plantillas internas TEST con contexto, campos y criterios para la comparación. Diez pruebas focalizadas y seis renders nuevos 600/360 px correctos; imágenes cargadas y sin desbordamiento. Los datos destacados, promociones, regalos y reseñas quedan por verificar o retirar, sin copiar hechos de las referencias. Manifiesto preparado con las trece y los seis modelos sin Astra; comparación todavía no ejecutada. Detalle: [Trece referencias y cierre de tanda](./A11_BIBLIOTECA_TRECE_REFERENCIAS_2026-10-31.md).

## Pack Meta Ads: extracción y auditoría - 31/10/2026

Cinco ZIP extraídos dentro de `Meta Ads-Instagram/skills_meta-ads`; nueve archivos comprobados por SHA-256 y ZIP borrados después de verificar, según autorización del propietario. Cinco skills y todos sus auxiliares leídos. Copywriter/multiplicadora y método de diseño aprovechables con adaptación; investigación de competencia debe retirar la equivalencia antigüedad/rentabilidad; analista no apto para recomendaciones operativas sin corregir parser, datos ausentes, límites y contexto. Renderer requiere validación/aislamiento antes de servir trabajos de usuarios. No se han instalado las skills ni cambiado agentes, datos de cuentas o campañas.

Informe individual y encaje A11/A14/A15/A16 en [Auditoría del pack](<../Meta Ads-Instagram/skills_meta-ads/AUDITORIA_E-NORA.md>). Ambos scripts pasan AST; funciones puras revisadas y reproducción escalar de conversión con límites declarados. CLI completo no ejecutado: dependencias ausentes, sin instalaciones. Recibos en `.e-nora-test-lab/skills-meta-ads/`. Comparación de modelos todavía pendiente.

## Integración de métodos Meta en NORA · 01/11/2026

Aplicada sobre A11, editor del Estudio y guías analíticas A14/A23/A24/A25. Contexto de organización/tienda, marca completa, productos/fotos/enlaces, historial editorial y feedback reciente aprobado. Modos original/guiado visibles en la creación mediante brief; producto seleccionable. Trece estrategias abstractas activadas en TEST con administrador real, sin exponer los ejemplos privados; activador idempotente. El contexto y las imágenes transmitidas quedan trazados, las nuevas selecciones entran en idempotencia y siguen los límites/costes existentes.

Verificado con datos reales de Prueba Borrego/E-NORA Demo: doce productos y selección exacta por product_id, marca y referencias pertinentes. Primera batería de 44 pruebas correcta más tres de perfil de marca; batería posterior de contexto, imágenes e historial: 14 correctas. Se corrigió una prueba antigua cuyo fixture dependía del día actual, fijando su reloj. Typecheck web y API; HTTP 200 de Marketing, biblioteca y salud API. La herramienta de navegador carece de host/pipe en esta sesión: revisión visual autenticada del selector no realizada. No hay nuevas generaciones o campañas enviadas por el activador ni se ha cambiado el ganador de A11.

Detalle, uso, límites y siguiente comparación de seis modelos sin Astra en [Integración aplicada](./INTEGRACION_SKILLS_META_EN_NORA_2026-11-01.md). Se reutilizan render y contratos existentes; no se ha creado un productor nuevo de PNG/vídeo ni un scraper de competencia. Aplicación no desplegada en producción; sin migraciones nuevas.

## A11 · comparación real con seis modelos · 02/11/2026

36 combinaciones finales (email/Meta/Instagram, original/guiado), mismas dos fotos y productos del Shopify de Prueba Borrego/E-NORA Demo. 35 contratos válidos y borradores visibles; Opus excede 2000 caracteres en un brief de Instagram. UI dentro de la cuenta: Marketing → Laboratorio de marketing, filtros, tabla de precio/tiempo, dos vistas A/B, originales y fallos conservados, simulación mensual manual y apertura en el Estudio. Propietario y consultor autenticados ven los mismos 35 borradores y manifiesto de 36; filtros malformados y otro tenant denegados.

Corregidos límites ocultos del contrato social, tres variantes involuntarias en peticiones de creación e inclusión de borradores de laboratorio en el histórico normal. La primera preparación con fotos numeradas al revés se excluyó; las rondas anteriores y sus costes se conservan por separado. Tanda final: 2,3090–2,6349 USD de API equivalente sobre uso CLI; no es factura ni coste mensual. 14 pruebas focalizadas y typechecks API/web correctos.

Recomendación editorial provisional Sol, Sonnet como segundo candidato y Opus para narración de email; no cambia la asignación sin revisión visual del propietario. Computer Use detuvo Chrome porque no podía verificar la URL; no se declara inspección visual realizada. Meta/Instagram muestran copy, dirección y fotos de origen, sin atribuir un PNG terminado al modelo. [Auditoría completa](./A11_COMPARACION_SEIS_MODELOS_DATOS_TIENDA_2026-11-02.md). Artefactos en `.e-nora-test-lab/a11-real-2026-11-02-v4/`.

## A11 · piloto de subagentes · 02/11/2026

Implementado y ejecutado coordinador de laboratorio: Sol redacta → Opus compone HTML → Sonnet revisa contenido/código, con contexto y fotos reales del mismo caso email original. Tres respuestas conservadas y un borrador TEST visible en cliente y consultor. Laboratorio de marketing incorpora «Comparar Sol con el equipo» y desglose por etapa. Total conocido 0,498544–0,596824 USD API equivalente frente a 0,106320 USD de Sol individual; revisión visual pendiente y sin cambio de asignación productiva. Corregida incompatibilidad JSON Schema del revisor, con reintento exclusivo de esa etapa y recibo fallido conservado sin consumo final medido. Cinco pruebas del coordinador, prueba de comparación, typechecks API/web y ESLint correctos; visibilidad autenticada y aislamiento verificados. [Detalle del piloto](./A11_SUBAGENTES_PILOTO_2026-11-02.md).

## A16 · Texto sobre imagen · 06/11/2026

Actualización de integración: exportación autenticada privada, composición persistida adjunta a A11, marca/recorte/vecinos como contexto, autosave antes de captions, recuperación por slide y clave de petición. Borrador técnico normal de Marketing `10475151-bfef-4cae-800e-eb7002672cec`; no es nueva generación A11. Comprobaciones y límites en [cierre de integración A16/A11](./A16_INTEGRACION_CREACION_MARKETING_2026-11-06.md). El ranking anterior no evalúa todavía el contexto nuevo.

Comparación final con los seis modelos y dos imágenes adjuntas: arte del banco y producto Shopify The Hidden Snowboard de E-NORA Demo. **Opus principal; Sol fallback.** El editor ahora respeta coordenadas por bloque; A16 recibe datos de producto verificados y omite CTA sin destino confirmado. Sigue siendo manual; coste conservador estimado ~$0,05376 por imagen y ~$0,54/mes para diez piezas. Sin Astra, llamadas pagadas ni publicación. [Revisión real A16](./A16_REVISION_TIENDA_2026-11-06.md).
