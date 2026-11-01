# Prompt final maestro — auditoría de tres fuentes Meta Ads en e‑NORA

## Objetivo

Audita el repositorio real de e‑NORA y compara **tres paquetes de conocimiento**: `ENORA_MetaAds_Conocimiento_Auditoria/` (vídeo 01, configuración y diagnóstico general), `ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/` (vídeo 02, presupuestos reducidos) y `ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/` (vídeo 03, investigación y estrategia creativa). Determina qué capacidades de Meta Ads, Shopify, Klaviyo, IA y RAG están implementadas, cuáles son parciales, qué se solapa entre las fuentes y qué aporta cada una realmente.

Entrega un informe que permita decidir cambios incrementales. **Esta tarea es una auditoría de solo lectura: no integres ni indexes ninguno de los paquetes.** El objetivo es evitar duplicados entre vídeos, conservar las fuentes de verdad actuales y señalar mejoras que tengan evidencia, permisos y un consumidor real en el producto.

## Contexto y criterio sobre el vídeo

Hay tres transcripciones aportadas por el usuario: vídeo 01 (~33 minutos), vídeo 02 (~27:33) y vídeo 03 (~21:54 de contenido transcrito). Ninguna tiene URL o publicación verificada; pueden contener errores de reconocimiento, afirmaciones anecdóticas y bloques promocionales. Los tiempos citados en las fichas son orientativos. Distingue siempre:

- `[VÍDEO]`: aparece en la transcripción; no significa que sea correcto, actual ni recomendado.
- `[INFERENCIA]`: conclusión derivada, no afirmación literal de la fuente.
- `[PROPUESTA e-NORA]`: idea de producto pendiente de contraste.
- `[VERIFICAR]`: depende de políticas, APIs, datos o comportamiento que requieran evidencia adicional.

No trates el vídeo como curso de producción audiovisual. Menciona formatos y ángulos creativos, pero no enseña de forma operativa guion, rodaje, montaje, sonido ni generación de vídeo.

Evalúa su valor incremental con este filtro:

1. **Candidato a conservar si aporta algo:** separar ROAS atribuido de rentabilidad real; exigir definiciones y periodos comparables; diagnosticar primero calidad de medición; usar costes y cálculos deterministas; plantear hipótesis de embudo sin afirmar causalidad; evaluar creatividades con muestra y evidencia suficientes.
2. **Probablemente redundante o de bajo valor:** explicación genérica de la jerarquía campaña/conjunto/anuncio, configuración básica de cuentas, nombres de herramientas externas y consejos operativos que no estén sustentados por datos de e‑NORA.
3. **No convertir en regla fija:** “broad siempre mejor”, “tres días bastan”, “sube el presupuesto 10–20 %”, “bajar presupuesto garantiza eficiencia”, “Meta deja de gastar en anuncios malos”, “ROAS alto implica beneficio” o “las UTMs no importan”. Tampoco aceptar como reglas V03 afirmaciones basadas solo en experiencia de la ponente.
4. El valor incremental de cualquiera de los vídeos puede ser **bajo aunque alguna idea puntual sea útil**. En V2, evalúa como posibles matices: suficiencia de señal según CPA y conversiones esperadas; separar monitorización de cambios estratégicos; incertidumbre estadística; mensaje de nicho frente a targeting; caja, payback y contribución LTV; duración visible de anuncios de competidores como señal débil; orgánico como hipótesis; y consolidación de campañas/ad sets cuando no haya razón estratégica para fragmentarlos.
5. En V3 puede ser útil como **marco de trabajo**, no como prueba de rendimiento: ficha de marca/producto/promesa/prueba; agrupación cuidadosa de objeciones autorizadas; personas como hipótesis basadas en necesidades; matriz persona/ángulo/conciencia/concepto/formato; detección de brechas; y puente entre investigación, brief, experimento y aprendizaje.
6. V3 no demuestra que sus ejemplos de Grüns, Oats Overnight o Rhode hayan sido probados con éxito ni aporta el SOP, la hoja de reviews o el deck de personas originales. No inventes resultados ni presentes sus ejemplos como casos probados.
7. Trata como promocionales, no como recomendaciones validadas, Holo y el curso/comunidad de V2, y Storyblocks en V3. No atribuyas a V3 un tutorial de producción audiovisual.
8. Review mining, comentarios de anuncios y escucha en Google/Reddit/Amazon/YouTube requieren fuentes, permisos, términos, derechos y controles de privacidad. Shopify no garantiza tener las reseñas; la integración Meta no garantiza acceso a comentarios; no propongas scraping por defecto.
9. Prefiere convertir cualquier matiz útil en criterios de evaluación o caveats dentro del módulo canónico existente; no crees un agente, motor, playbook o documento paralelo salvo que demuestres el hueco y un consumidor real.

## Material que debes revisar

Lee los tres `README.md` y `MANIFIESTO.md`, las tres fichas de procedencia, las nueve fichas de V01, las nueve fichas de V02, las once fichas de V03, contratos, taxonomía, playbooks, políticas, documentos de experiencia, requisitos de datos y documentos de auditoría. Consulta las transcripciones para resolver dudas de procedencia o tensiones concretas; no es necesario reproducirlas enteras en el informe. Si un paquete no está disponible, declara parcial la comparación.

Archivos y módulos candidatos:

- `META-001` gobernanza de activos y cuenta.
- `META-002` tracking, eventos y calidad de medición.
- `META-003` estructura, objetivos y audiencias.
- `META-004` diagnóstico del embudo.
- `ECO-001` ROAS, CPA, margen y rentabilidad.
- `META-005` estrategia y evaluación de creatividades.
- `META-006` presupuesto, aprendizaje y escalado.
- `META-007` entrega e incidentes.
- `META-008` aplicaciones y límites de IA.
- `GAP-VIDEO` conocimiento que la fuente no cubre sobre producción audiovisual.

Vídeo 02 — presupuesto reducido:

- `META-SB-001` suficiencia de presupuesto y objetivo de prueba.
- `META-SB-002` fase de aprendizaje y cadencia de cambios.
- `META-SB-003` escasez de datos y estadística.
- `META-SB-004` perfil de cliente y mensaje de nicho.
- `META-SB-005` benchmark competitivo y Meta Ad Library.
- `META-SB-006` objetivo de conversión frente a notoriedad.
- `META-SB-007` contenido orgánico como hipótesis creativa.
- `META-SB-008` consolidación de ofertas, campañas y ad sets.
- `ECO-SB-001` CAC, LTV, ROAS, contribución y beneficio absoluto.

Vídeo 03 — investigación y estrategia creativa:

- `META-CR-001` estrategia creativa antes que formatos.
- `META-CR-002` investigación de marca, producto, promesa y prueba.
- `META-CR-003` reputación y objeciones multifuente.
- `META-CR-004` minería de reseñas/comentarios con IA.
- `META-CR-005` personas como hipótesis basadas en necesidades.
- `META-CR-006` matriz persona, ángulo, conciencia y formato.
- `META-CR-007` competencia como inspiración sin copia.
- `META-CR-008` análisis de brechas creativas.
- `META-CR-009` roadmap creativo trimestral/mensual.
- `META-CR-010` ejemplos de marca como hipótesis, no resultados causales.
- `ECO-CR-001` bundling, AOV, margen y viabilidad económica.

## Reglas de auditoría

1. Respeta las instrucciones del repositorio y trabaja sobre el estado visible del working tree. Registra `git status --short` al inicio y al final. No reviertas ni limpies cambios ajenos.
2. Inspecciona estructura, código, migraciones, pruebas existentes, prompts, documentación y consumidores reales de runtime. Distingue implementación activa, documentación, tests, fixtures, mocks, stubs, legado y propuesta.
3. Para descubrir código, usa primero el grafo de conocimiento del repositorio (`search_graph`, `trace_path`, `get_code_snippet`, `get_architecture`) si está disponible; confirma hallazgos importantes en los archivos actuales. El grafo puede estar desactualizado respecto del working tree.
4. Cita evidencia como `ruta:línea`. Una función encontrada no demuestra que esté desplegada ni que los datos estén disponibles para cada tenant. Si no puedes comprobar base de datos, conectores o despliegue, declara el límite como `NO_VERIFICABLE`.
5. No accedas a datos personales reales ni hagas consultas a servicios externos con efectos. Usa contratos, código, migraciones y fixtures existentes.
6. No hagas cambios en código o documentos del producto; no alteres prompts o políticas; no importes archivos; no ejecutes migraciones, ingestas, reindexaciones ni generación de embeddings; no escribas en Meta, Shopify o Klaviyo; no despliegues ni hagas commits o instalaciones.
7. No concluyas que algo no existe solo porque no aparece en una búsqueda. Usa `NO_ENCONTRADO` para “no localizado” y `NO_VERIFICABLE` cuando falte acceso o evidencia.
8. No ejecutes pruebas. Puedes leer tests existentes y recomendarlos en el plan futuro.
9. Si una afirmación sobre una API o política actual afecta la recomendación, contrástala solo con documentación oficial y cítala. Si no puedes verificarla, déjala como pendiente; la auditoría del código no requiere navegación por defecto.

## Áreas que debes inspeccionar

### Arquitectura de IA y RAG

Localiza la fuente de verdad del conocimiento, el catálogo o corpus, documentos activos, almacenamiento, esquema de IDs/versiones/checksum, chunking, proveedores y dimensiones de embeddings, ingestión, filtros por tenant/tienda/audiencia, retrieval, reranking, consumidor IA, deduplicación, reemplazos, retiradas, trazabilidad y rollback. Separa lo que prueban el código y las migraciones de lo que solo podría confirmar una base de datos desplegada.

### Meta Ads

Verifica conexión OAuth y permisos disponibles, activos/cuentas, campañas/conjuntos/anuncios, sincronización, métricas y ventanas de atribución, píxel/eventos, salud de medición, alertas, creatividades y acciones de escritura. Para cada capacidad identifica ruta, línea, consumidor y pruebas ya existentes. No supongas acceso a facturación, motivos internos de revisión o datos audiovisuales por tener una integración Meta.

### Shopify, Klaviyo y economía

Comprueba ventas, pedidos, descuentos, cancelaciones, devoluciones/reembolsos, impuestos, moneda, costes de producto, comisiones, envío, gastos fijos y frescura. Confirma qué significa cada cálculo de ROAS, CPA, CAC, AOV, margen y break-even, qué denominador usa y en qué función vive. Indica si COGS u otro coste es parcial o desconocido. Distingue ventas reales de ventas atribuidas por Meta o Klaviyo y no las sumes como independientes.

### Creatividades y vídeo

Separa: (1) métricas de rendimiento por anuncio, (2) inspección del contenido observable —texto, imagen o vídeo realmente disponible—, y (3) generación/producción audiovisual. Identifica la cobertura probada para cada capacidad. No atribuyas comprensión visual a una URL o ID de creativo, ni producción de vídeo al material fuente.

### Aprendizaje con poco presupuesto y contraste entre fuentes

Resuelve estas aparentes tensiones con criterios observables; no elijas un vídeo como regla:

- **3 días frente a 7–10 días:** el calendario es una referencia de los ponentes, no el criterio de salida. Distingue alertas urgentes, monitorización y decisiones estratégicas; evalúa volumen de conversiones, gasto, variabilidad, ciclo de compra, tracking y riesgo.
- **Audiencia amplia frente a nicho:** separa los controles de `targeting` del enfoque del mensaje. Un mensaje específico puede probarse con audiencia amplia; una recomendación de targeting estrecho requiere evidencia y restricciones reales.
- **Muchos creativos frente a consolidar estructura:** distingue número de variantes a nivel anuncio de número de campañas y ad sets. Menos fragmentación puede concentrar señal, pero no garantiza mejor rendimiento ni elimina necesidades por país, oferta, inventario u objetivo.
- **ROAS de primera compra frente a LTV:** presenta compra inicial, contribución acumulada, horizonte, retención demostrada, payback y caja por separado. LTV de ingresos no es contribución disponible ni permiso para financiar pérdidas.
- **Competidores:** V02 propone modelar anuncios que parecen longevos; V03 critica copiar o elegir por impresiones. Permite benchmarking abstracto como inspiración, pero duración, impresiones y apariencia no prueban rendimiento. No copiar contenido ni afirmar ROAS de terceros.
- **Contenido orgánico:** engagement y visualizaciones pueden inspirar hipótesis; no prueban ventas ni causalidad en pago.
- **Estadística:** no uses “90 %” como estándar. Distingue comparación descriptiva de experimento aleatorizado; considera muestra, métrica primaria, asignación y sesgos antes de llamar “ganador” a un anuncio.

### Investigación y estrategia creativa

Comprueba si el producto tiene datos y capacidades reales para cada paso: entender promesa y pruebas del producto; leer feedback propio autorizado; resumir objeciones con IDs y muestras; proponer personas agregadas basadas en necesidades; clasificar inventario creativo; detectar brechas; crear briefs trazables; y medir los experimentos. Distingue `creative strategy` de generación de assets, edición, publicación o scraping.

- Trata una reseña, comentario o persona como señal acotada a la fuente y su muestra; no la generalices a todos los compradores.
- No incluyas PII innecesaria en prompts, logs, chunks o embeddings. Revisa minimización, permisos, retención, borrado, derechos de testimonios y aislamiento por tenant.
- No infieras salud, medicación, embarazo, ingresos u otros atributos sensibles a partir de reseñas, ni recomiendes targeting discriminatorio. Ejemplos sobre GLP-1, perimenopausia o postparto no habilitan perfiles publicitarios.
- No generes historia de marca, beneficios funcionales o claims sin evidencia. Un aumento de AOV por bundle no demuestra aumento de contribución: considerar costes, descuentos, devoluciones, fulfillment y stock.
- Las brechas creativas pueden ser intencionales o no evaluables por falta de histórico, permisos o clasificación fiable. No rellenes la matriz por cuotas.
- Una planificación trimestral/mensual es una propuesta organizativa; no debe confundirse con cadencia de edición de campañas ni con prueba de eficacia.
- Ideas de tendencia, partnership ads o ejemplos de marcas requieren validación actual y datos propios antes de convertirse en recomendaciones técnicas.

### Seguridad, permisos y tenant

Verifica cómo se fija el tenant en servidor, cómo se limita el acceso a tiendas y documentos, qué roles pueden ver contenido interno, dónde se ejecutan cálculos y si el agente puede efectuar cambios externos. Cita RLS, validaciones, herramientas y pruebas pertinentes. Señala cualquier hueco sin extrapolarlo a una fuga confirmada.

## Clasificación obligatoria

Usa un estado por capacidad o módulo:

- `EXISTE_COMPLETO`: código, consumidor real, datos y evidencia suficiente.
- `EXISTE_PARCIAL`: existe una parte, pero falta una condición relevante.
- `SOLO_DOCUMENTADO`: encontrado en documentos o prompts sin implementación probada.
- `DUPLICADO_CONFLICTIVO`: hay fuentes de verdad o comportamientos incompatibles demostrables.
- `NO_ENCONTRADO`: no localizado tras búsquedas documentadas.
- `OBSOLETO`: se demuestra que existe pero ya no se usa o está retirado.
- `NO_VERIFICABLE`: falta acceso o evidencia para decidir.

Para cada módulo selecciona una decisión: `REUTILIZAR`, `FUSIONAR`, `AMPLIAR`, `DESCARTAR`, `CREAR_NUEVO` o `NO_INDEXAR`. Usa `CREAR_NUEVO` solo después de demostrar que no existe un destino canónico apropiado.

## Formato de salida

### 1. Conclusión ejecutiva

Resume el estado real, los 3–5 hallazgos que más afectan al producto, el valor incremental de cada vídeo y el valor marginal acumulado (`alto`, `medio` o `bajo`), más la recomendación de ingestión. La recomendación por defecto es **no indexar hasta verificar duplicados y aprobar el contenido**.

### 2. Mapa actual

Describe el flujo que realmente existe: fuentes → sincronización/ingestión → almacenamiento → cálculos/retrieval → agentes/herramientas → respuesta o acción → seguridad. Añade rutas y líneas; señala qué queda sin verificar.

### 3. Matriz de módulos

Una fila por cada ID `META-001`–`META-008`, `ECO-001`, `GAP-VIDEO`, `META-SB-001`–`META-SB-008`, `ECO-SB-001`, `META-CR-001`–`META-CR-010` y `ECO-CR-001`, con:

`ID | estado | evidencia ruta:línea | qué existe | gap comprobado | aporte incremental del vídeo | decisión | prioridad | riesgo`.

### 4. Matriz transversal

Evalúa `CONTRACT`, `TAXONOMY`, `CREATIVE_INTELLIGENCE`, `RUNTIME`, `EXPERIMENT`, `GUARD`, `PRIVACY`, `DATA`, `LEARNING` e `INGEST` usando el mismo formato. No vuelvas a enumerar hallazgos: enlaza los IDs relacionados.

### 5. Duplicados, conflictos y límites

Incluye documentos equivalentes entre paquetes, reglas incompatibles, cálculos repetidos, métricas no comparables, riesgo de duplicar embeddings y afirmaciones de los tres vídeos que no deben convertirse en recomendaciones. Resuelve las tensiones descritas arriba, incluidas las de investigación creativa y privacidad. Distingue duplicado probado de duplicado potencial por falta de inventario RAG.

### 6. Plan futuro priorizado — no ejecutar

Para cada acción indica `problema y evidencia`, `cambio mínimo`, `destino canónico real o NO_VERIFICABLE`, `dependencias`, `pruebas que habría que añadir/ejecutar`, `riesgo`, `impacto`, `esfuerzo` y `criterio de aceptación`.

- `P0`: medición, matemáticas, permisos, aislamiento o funcionamiento que pueda causar conclusiones perjudiciales.
- `P1`: hueco demostrado que mejore un flujo existente y tenga datos disponibles.
- `P2`: contenido educativo opcional, nuevas fuentes de vídeo o mejoras evolutivas.

No inventes dependencias de API ni propongas una implementación paralela cuando baste ampliar el componente canónico.

### 7. Destino de cada archivo del paquete

Lista cada módulo de los tres paquetes y sus corpus maestros con acción (`no indexar`, `fusionar en documento existente`, `reescribir antes de aprobar`, `candidato nuevo`), destino canónico si se conoce y razón. Las transcripciones originales quedan como fuente de referencia, no como documentos de producción, salvo aprobación expresa y deduplicación.

### 8. No verificable y cierre

Enumera solo límites que cambian la decisión. Incluye el `git status --short` inicial y final, herramientas de lectura usadas y confirma si hubo cero cambios del auditor. Si hubo actividad externa concurrente o varió el estado del árbol, dilo; no atribuyas cambios sin evidencia.

## Criterio de finalización

La auditoría está completa cuando los 30 módulos candidatos y las diez áreas transversales tienen estado, evidencia o un límite explícito; cada decisión de RAG tiene un destino o una razón para no indexar; y existe un plan priorizado con criterios de aceptación. Ninguno de los paquetes se integra al terminar.
