# Plan: A05, planificador de campañas con contexto

**Estado:** primera entrega implementada y aplicada en Supabase local; quedan mejoras de especialistas frescos y telemetría de producto abajo.
**Objetivo:** convertir «Proponer con IA» en una planificación revisable de email y Meta Ads, preparada con evidencia estacional, conocimiento interno, resultados previos y el plan de negocio de la tienda.

## Decisión de producto

A05 será el **coordinador del calendario de marketing**. No investigará, redactará y diseñará todo por sí solo. Recibirá paquetes breves de especialistas, resolverá solapamientos y propondrá iniciativas fechadas con motivo, canal, audiencia, oferta/CTA, KPI y tareas de preparación.

El plan debe distinguir cuándo se ejecuta una campaña y cuándo hay que empezar a prepararla. Una tienda de nieve en España que planifica en junio puede preparar Navidad desde el verano, pero las comunicaciones de junio deben tener una razón comercial propia —por ejemplo, liquidación o preventa si existe—. El agente no debe tratar junio como temporada de nieve local ni inventar stock, descuentos, eventos o demanda.

La persona elige un mes, trimestre o intervalo personalizado; también puede señalar fechas concretas, mercado/país y objetivo. A05 explica qué señales justifican cada fecha y qué información falta.

## Auditoría breve del código local (línea base antes de esta entrega)

Hallazgos observados en el código y documentos locales; **no confirman qué está desplegado en ningún entorno remoto**:

- El runner A05 ya combina ventas recientes y periodo anterior, finanzas, inventario/riesgo de stock, informe de Klaviyo, gasto de Meta, plan estratégico activo, calendario existente, resultados previos de especialistas y búsqueda en conocimiento. Resuelve la tienda antes de ejecutar.
- El horizonte de A05 está limitado a mes/trimestre. El plan y la consulta del calendario usan un número fijo de días. Así no se puede pedir con naturalidad «junio a diciembre» ni un intervalo personalizado con hitos de preparación.
- A05 no recibe actualmente el paquete estacional completo de A19/Mi Camino como evidencia de temporada, histórico mensual de la tienda ni una ficha de días/eventos con procedencia y mercado. Un hito de Mi Camino puede dar contexto indirecto, pero no sustituye estas pruebas.
- A05 declara búsqueda en conocimiento. La revisión de agentes indica que el RAG privado de mailing ya existe y que A05/A27 deben usarlo para metodología. Hay que comprobar retrieval durante la implementación; no reingerir el corpus.
- El resumen de campañas actual filtra campañas maduras y exige al menos 50 entregados para rankings comparables. Devuelve asunto y métricas, no el cuerpo completo ni una explicación causal.
- Hay recuperación separada de variaciones/contenido Klaviyo y selección de emails para auditoría. Puede aportar el contenido observado si se vincula con el ID de campaña/variante y se declaran cobertura y snapshot disponible.
- A23–A25 aportan análisis de creatividades, medición y cambios Meta. Reutilizar sus hallazgos y métricas, conservando gates de cobertura/frescura y la advertencia de que observación no demuestra causalidad.
- A27 ya coordina estrategia de mailing con el RAG privado y entrega dirección/briefs; A11 compone correos, A26 audita contenido y diseño, A12 evalúa resultados. A05 debe consumir decisiones compactas de A27 para incluir email en el calendario, sin duplicar su trabajo.
- La propuesta actual se materializa como elementos de calendario; no produce automáticamente drafts de Klaviyo ni creatividades de Meta. La experiencia necesita enlazar cada evento con su trabajo de producción después de aprobarlo.
- Las consultas de plan y calendario de A05 deben comprobar scope de organización **y tienda**. En el código local observado filtran por organización, pero esos dos bloques no añaden el identificador de tienda; corregir antes de ampliar contexto.
- La propuesta vive en el componente de planificación de campañas. Al aprobar, el recorrido debe confirmar qué se guardó y llevar al calendario con las piezas creadas.

## Responsabilidades y subagentes

La división propuesta es **tres preparadores de contexto y A05**, ejecutados en paralelo cuando sus dependencias lo permitan. Reutilizar agentes, RPC y resúmenes existentes; crear un agente nuevo solo si la ejecución actual no puede entregar un contrato acotado y reutilizable. Los preparadores son de solo lectura y devuelven paquetes estructurados; no crean campañas, borradores ni anuncios.

| Preparador | Base a reutilizar | Paquete que entrega a A05 |
|---|---|---|
| **Contexto estacional y fechas** | Datos e histórico estacional de A19/Mi Camino; planes/hitos aprobados; calendario público curado por mercado si existe fuente configurada. | Evento y fechas candidatas, país/región, etapa de preparación, ventana de demanda, evidencia/procedencia, relevancia para la tienda, caducidad y confianza. Separar ventas propias, conocimiento interno y fechas externas. Un festivo no implica automáticamente una oportunidad comercial. |
| **Estrategia e inteligencia de mailing** | A27 y RAG de mailing; métricas maduras de A12/Klaviyo; contenido/variantes recuperables; veredictos humanos T6 disponibles. | Rol del email en la campaña, arco/cadencia orientativos, audiencia y KPI sugeridos, patrones internos aplicables, ejemplos propios comparables con asunto/contenido disponible, resultados/denominadores, límites de cobertura y recomendaciones no causales. |
| **Rendimiento y oportunidades Meta** | A23 (rendimiento/creativas), A24 (gate de medición), A25 (cambios), campañas/resultados sincronizados. | Objetivo y audiencia posibles, señales de creatividades previas, formato/ángulo a probar, KPI observable, frescura/cobertura, moneda y límites de atribución. Si el gate no permite evaluar, devolver desconocido y no recomendar inversión como si hubiera evidencia. |
| **A05, coordinador** | Runner actual de A05 y paquete comercial/plan existente. | Calendario sin duplicados: iniciativa, fecha de publicación, fechas/hitos de preparación, canal, objetivo, audiencia, propuesta de mensaje/ángulo, hipótesis, KPI, evidencia enlazada, incertidumbres, dependencias y siguiente paso. Resolver conflictos entre canales y capacidad de stock/oferta. |

### Orden de ejecución

1. Validar membresía, tienda, mercado, fechas y permisos. Si hay varias tiendas, exigir selección.
2. Leer datos comerciales, stock, calendario, objetivos de Mi Camino e informes existentes con scope exacto de tienda.
3. Ejecutar en paralelo los tres preparadores con presupuesto explícito de fuentes/resultados. Si existe una salida fresca y aprobada, reutilizarla con su fecha; no volver a ejecutar un diagnóstico caro sin necesidad.
4. Pasar a A05 paquetes compactos, fuentes y cobertura. El texto recuperado del RAG es evidencia no confiable, nunca instrucciones del sistema.
5. Validar contrato de salida, fechas, solapamientos, oferta/stock y referencias antes de mostrar la propuesta.
6. La persona revisa y selecciona. Solo entonces se escriben elementos del calendario y, como acción siguiente explícita, se crean briefs/drafts de producción.

## Contrato de evidencia y aprendizaje histórico

Cada afirmación relevante debería llevar una referencia estable a la fuente: tipo e ID de fuente, tienda/cuenta, periodo observado, fecha de sincronización, cobertura, denominador, definición de métrica y confianza. Los fragmentos privados de RAG permanecen server-side y no se muestran como documentación interna al cliente; la UI puede mostrar el nombre de la fuente y una explicación entendible.

Para mailings históricos, unir **campaña/variante → snapshot de contenido enviado → métricas maduras**. Conservar por separado:

- **Lo observado:** asunto, preheader/cuerpo/CTA cuando se recuperen, audiencia, fecha, oferta, resultado, entregados, clics, bajas, ingresos atribuidos y definición de atribución.
- **Lo comparable:** campañas con periodo maduro y tamaño suficiente, segmento y objetivo similares; informar qué registros quedan fuera y por qué.
- **Lo interpretado:** patrón o hipótesis («este mensaje coincidió con más clics en esta muestra»), nunca «funcionó por el asunto» salvo experimento que aísle esa variable y medición suficiente.
- **Lo confirmado por personas:** veredicto T6 con actor/fecha/motivo, vinculado a la iniciativa y su versión. Un resultado bruto del agente no se reingiere como verdad.

En Meta, conservar identidad/versión creativa y objetivo junto con inversión/resultado, cuenta y moneda; respetar A24 y no inferir que un cambio específico causó el rendimiento. Al reutilizar conocimiento entre tiendas, anonimizar y aplicar permisos; por defecto, el historial de resultados es de la tienda seleccionada.

Si falta contenido histórico, atribución, muestra, stock, retrieval RAG o frescura, decirlo explícitamente y bajar el grado de recomendación. **Desconocido no equivale a cero ni a mal rendimiento.**

## Contrato de calendario y experiencia

Cada iniciativa debe ser una unidad de calendario con:

- Canal: email, Meta Ads u otro canal admitido.
- Fecha/intervalo de publicación y tareas de preparación con fechas límite previas (brief, copy, diseño, revisión, aprobación).
- Objetivo, audiencia, mercado, tema/ángulo, oferta real si está confirmada, KPI y criterio de revisión.
- Motivo de fecha, evidencia referenciada, hipótesis y límites/incertidumbres.
- Vínculo opcional con objetivo/hito de Mi Camino y dependencias (stock, landing, precio, creatividad, aprobación).
- Estado de planificación y referencias a los objetos de trabajo generados después.

El selector permitirá **próximo mes, trimestre, rango personalizado y fechas/eventos seleccionados**. Interpretar fechas en la zona horaria de la tienda. Para campañas futuras, las tareas de preparación pueden comenzar antes del intervalo solicitado; la UI separa fecha de envío/lanzamiento y fecha de preparación. El brief puede fijar mercado, temporada objetivo, prioridades, límite de frecuencia, canales y restricciones.

Al aceptar una propuesta, mostrar un resumen de elementos guardados y navegar al calendario filtrado por el nuevo plan. Cada evento ofrece una acción contextual:

- **Email → Preparar mailing:** crea un brief vinculado a A27/A11 y después deja el borrador identificable en la sección de mailings/plantillas.
- **Meta → Preparar creatividad:** crea brief/tarea para el flujo de creatividades Meta y mantiene el enlace desde el calendario.

El éxito de aplicación debe ser idempotente por elemento y conservar errores parciales para reintentar los fallidos. La interfaz no afirma que el anuncio se publicó ni que el mailing se envió. Enviar, activar campañas o cambiar inversión requiere una acción humana explícita.

## Implementación local de esta entrega

- Horizontes: 1, 2 y 3 semanas, mes, trimestre y rango de fechas (máximo 366 días). Las fechas se resuelven con la zona horaria de la tienda; los presets y nuevos envíos empiezan mañana para no crear elementos a una hora que ya pasó.
- Scope estricto por tienda en ejecución, recuperación de propuesta, calendarios, email, Meta, plan estratégico, resultados y contexto de A23–A25. Sin tienda seleccionada no se genera un agregado de organización.
- Contexto estacional A19 reutilizado desde ventas mensuales Shopify y conocimiento guardado de la tienda; calendario comercial español solo si el mercado se indica como España. Se conservan avisos cuando una fuente falla.
- Historial de mailing con cohortes completas, 7 días de maduración y al menos 50 entregas. Para los mejores y peores comparables se adjunta cuerpo sincronizado cuando existe una coincidencia temporal de plantilla; se marca como observación aproximada, no como prueba del mensaje personalizado enviado.
- Cada propuesta nueva exige fecha absoluta de lanzamiento, ventana, brief de producción, hipótesis, KPI y al menos una evidencia concreta por iniciativa, además de fuentes a nivel de plan. Si no hay evidencia, A05 debe devolver calendario vacío y explicar la carencia. Meta recibe concepto creativo; Email recibe ángulo, oferta confirmada y CTA. Nada se envía ni publica.
- Aplicación idempotente por salida e índice de iniciativa. La aplicación parcial mantiene pendientes reintentables y enseña qué iniciativas ya están en calendario.
- El modal usa la tienda activa, explica fuentes y mercado, permite fechas concretas, carga solo calendarios de esa tienda y al completar abre el calendario en el primer día. Email, Meta e Instagram abren el estudio con canal, fecha y brief; la pieza creada se enlaza al evento y se puede volver a abrir desde el calendario.
- Las migraciones locales [`20261203110000_a05_contextual_campaign_calendar.sql`](../supabase/migrations/20261203110000_a05_contextual_campaign_calendar.sql) y [`20261203120000_a05_evidence_required.sql`](../supabase/migrations/20261203120000_a05_evidence_required.sql) quedaron aplicadas en Supabase local. El baseline necesitó retirar una migración de factura duplicada que estaba fechada antes de crear su tabla y mover la migración del informe A09 detrás de su requisito v14. No se aplicó ninguna migración al proyecto remoto enlazado.
- Verificación local: A05 v5 y su prompt están activos con `search_knowledge` y aprobación obligatoria; los índices de idempotencia están presentes. `typecheck` de API y web y build del paquete AI correctos; 19 pruebas focalizadas de propuesta, ventana, historial y scope correctas.

### Pendientes para completar el flujo de producción

- Email y Meta producen borradores dentro del estudio, enlazados al item del calendario; requieren revisión humana. El flujo Meta prepara el plan pausado tras aprobación del borrador, pero no crea ni publica objetos en Meta.
- A05 reutiliza contexto estacional A19, método/corpus RAG de mailing, métricas e histórico por tienda, planes aprobados y recientes de A27 y hallazgos aprobados de especialistas Meta. A27 no se relanza desde A05 porque ese flujo reserva y guarda una secuencia antes de la aprobación del calendario; si no hay salida aprobada reciente, A05 usa los datos propios y señala la ausencia.
## Fases de implementación

### Fase 0 · contratos, scopes y fuentes

- Definir esquema versionado para rango temporal, contexto de tienda/mercado, paquetes de evidencia y propuestas.
- Resolver y comprobar scope de tienda en planes, calendario, métricas de Klaviyo/Meta, historial y referencias RAG. Revisar RLS/tenant boundaries.
- Inventariar RPC/columnas locales para ventas mensuales, eventos estacionales, snapshots de email, contenido de variantes, campañas Meta y veredictos T6. Reutilizar antes de crear tablas o RPC nuevas.
- Registrar en UI fuentes conectadas, frescura y límites relevantes antes de generar.

### Fase 1 · A05 con horizonte libre y evidencia estacional

- Ampliar horizonte a fechas de inicio/fin y mercado/zona horaria; mantener mes/trimestre como presets.
- Exponer a A05 histórico mensual propio y paquete estacional de A19 con procedencia/cobertura; incluir hitos confirmados de Mi Camino.
- Incorporar fechas públicas solo desde calendario de fuentes permitido y versionado; sin fuente comprobable, pedir o usar fechas aportadas por la persona.
- Mejorar modal: qué analiza, intervalo y mercado, canales, datos disponibles/faltantes, y diferencia entre propuesta, aprobación y producción.

### Fase 2 · preparar estrategia de canal en paralelo

- Definir salidas compactas y de solo lectura de A27 y A23–A25. Reutilizar hallazgos frescos por tienda; ejecutar especialistas solo cuando falte cobertura necesaria.
- Añadir contenido histórico de Klaviyo al resumen cuando pueda reconstruirse de forma verificable; no copiar grandes HTML al prompt.
- Incorporar veredictos T6 junto al rendimiento cuantitativo sin convertir correlación en causalidad.
- Hacer que A05 sintetice por objetivo y fecha, elimine duplicados y explique evidencia y lagunas de cada iniciativa.

### Fase 3 · guardar, enlazar y navegar

- Aplicar por selección con idempotencia por propuesta/elemento y estado independiente para cada inserción.
- Persistir vínculos entre evento, iniciativa, brief de canal, borrador de mailing y pieza creativa.
- Al completar, mostrar conteo creado/omitido/fallido y abrir el calendario en ese rango; permitir retomar errores parciales.
- Añadir acciones contextuales para generar briefs/drafts e indicar dónde quedan disponibles.

### Fase 4 · aprender del resultado

- Cerrar el ciclo iniciativa → entrega/publicación → resultado maduro → veredicto humano opcional T6.
- Mostrar qué ocurrió frente al KPI previsto con métricas, cobertura y límites de atribución.
- Alimentar futuras planificaciones con señales validadas; conservar versiones y permitir corregir una interpretación humana sin borrar el registro medido.

## Criterios de aceptación

1. **Tienda de nieve en España, planificación junio–diciembre:** propone hitos previos a Navidad, distingue preparación de envíos y explica por qué junio es temporada baja local. Ofertas de verano solo aparecen si hay evidencia de descuento, stock o liquidación confirmada.
2. **Meses o fechas concretas:** respeta zona horaria, intervalo y eventos indicados; detecta campañas existentes y no duplica fechas/tareas.
3. **RAG privado:** recupera metodología de mailing pertinente y procedencia; no expone el corpus privado ni obedece instrucciones incrustadas en documentos.
4. **Histórico incompleto:** sin snapshot de contenido, muestra asunto/métricas disponibles y declara que no puede evaluar el cuerpo; no explica causalidad.
5. **Resultados débiles o inmaduros:** campañas bajo umbral o periodo inmaduro quedan fuera de rankings comparables con motivo visible.
6. **Meta sin medición utilizable:** recibe desconocido, conserva el límite y no afirma ganadores ni recomienda inversión basada en medición bloqueada.
7. **Falta de stock/frescura/contexto:** reduce alcance, añade dependencia o se abstiene; no inventa disponibilidad ni objetivos.
8. **Varias tiendas/cuentas:** solo combina fuentes de la tienda seleccionada; sin selección, no agrega datos.
9. **Aplicación parcial/reintento:** los ítems creados no se duplican; los fallidos siguen identificables y se pueden reintentar.
10. **Recorrido final:** después de aplicar, el usuario llega al calendario y desde un evento reconoce cómo producir cada mailing/creativo y dónde encontrar su borrador.
11. **Aprobación:** generar y revisar no publica, envía ni activa anuncios; esas acciones requieren confirmación explícita.

## Métricas de producto

- Propuestas aceptadas/descartadas y ediciones humanas por campaña.
- Iniciativas con evidencia utilizable e iniciativas reducidas por dato ausente.
- Duplicados, errores parciales y reintentos de materialización.
- Tiempo desde calendario aceptado hasta draft/creativo listo.
- Resultados maduros frente al KPI previsto, segmentados por canal y con límites de atribución visibles.
- Correcciones de veredictos y proporción de recomendaciones que sobreviven a la revisión humana.

## Fuera de alcance de la primera entrega

- Publicar o enviar automáticamente desde la propuesta.
- Ejecutar cambios de presupuesto, audiencias o estado en Meta/Klaviyo.
- Crear otro índice RAG para duplicar el conocimiento de mailing existente.
- Presentar una fecha festiva como oportunidad rentable sin señales del producto/mercado.
- Declarar causalidad sin experimento que la sostenga.

## Orden recomendado

Cerrar Fase 0 primero y luego entregar una primera versión útil de Fases 1–3: calendario personalizable, evidencia estacional/comercial, integración de solo lectura de A27 y Meta, aprobación visible, persistencia e introducción directa a producción. La Fase 4 completa el aprendizaje cuando existan campañas maduras y veredictos humanos suficientes.
