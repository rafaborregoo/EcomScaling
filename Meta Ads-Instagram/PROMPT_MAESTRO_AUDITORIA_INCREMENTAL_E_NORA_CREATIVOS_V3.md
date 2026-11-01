# PROMPT MAESTRO — CLAUDE CODE | AUDITORÍA INCREMENTAL VÍDEO 03 (CREATIVE STRATEGY) PARA e-NORA

## Rol

Eres auditor principal de arquitectura, conocimiento RAG, agentes IA, analítica ecommerce, gobernanza de datos y estrategia creativa. El producto es **e-NORA** (plataforma ecommerce conectada a Shopify, Meta y Klaviyo), NO el CRM inmobiliario NORA. Este ZIP contiene conocimiento **candidato** del **tercer vídeo** sobre investigación de consumidores y estrategia de anuncios. Debes determinar qué valor **incremental** añade respecto del repositorio REAL y los vídeos/ZIP 01 (configuración/diagnóstico Meta) y 02 (presupuesto reducido). Evita reescritura de conocimiento existente y no confundas paquetes propuestos con código de producción.

## RESTRICCIÓN ABSOLUTA — SOLO LECTURA

No cambiar archivos del repositorio, no escribir documentación en él, no generar commits, no instalar dependencias que alteren lockfiles, no ejecutar migraciones, no insertar datos, no crear ni actualizar embeddings, no reindexar, no cambiar prompts operativos, no publicar/desplegar, no lanzar trabajos de marketing, no modificar campañas/anuncios/budgets ni datos en Shopify/Klaviyo. No extraer masivamente datos de terceros ni acceder a datos de tenant reales fuera de autorizaciones. **Entregar la auditoría íntegramente en tu respuesta, sin escribir archivos del proyecto.** Verifica `git status` antes y después si dispones del repo; si no puedes, dilo. La lectura de este ZIP no autoriza operaciones de escritura.

## Material disponible y orden de lectura

1. `README.md`, `MANIFIESTO.md`, `00-corpus-maestro/00_FICHA_FUENTE_Y_TRAZABILIDAD.md`.
2. Las **11 fichas** de `01-rag-produccion/` (`META-CR-001` a `META-CR-010`, más `ECO-CR-001`). No dar por hecho que son válidas ni que se haya indexado nada.
3. `02-contratos-IA/`, `03-runtime/`, `04-policies-guardrails/`, `05-experience-learning/`, `06-tenant-context/`.
4. `99-auditoria/MAPA_SOLAPAMIENTOS_VIDEOS_01_02_03.md`, `MATRIZ_AUDITORIA_INCREMENTAL_V03.md`, `CRITERIOS_DECISION_SIN_INGESTA.md`, `PROMOCIONALES_Y_LIMITES_DEL_VIDEO.md`.
5. `00-corpus-maestro/01_TRANSCRIPCION_ORIGINAL.md` para verificar formulaciones y minutos.
6. Si los ZIP V01/V02 o informes de auditorías previas están disponibles, coteja directamente; **si faltan, informa comparación parcial**. No presupongas integración por el mero hecho de que se prepararon ZIP.

## A. Descubre la arquitectura real de e-NORA

Inspecciona (solo lectura) estructura, reglas, contratos, rutas de agentes y sus prompts, base RAG e ingesta/indexación, IDs de fuentes/chunks, versión y deduplicación, recuperación de contexto, flags, permisos, repositorios de pruebas y telemetría. Distingue **definido/documentado**, **implementado pero no invocado**, **llamado por agente**, **indexado persistido**, **activo en producción**, **legacy** y **no verificable**.

Localiza las integraciones Shopify, Meta y Klaviyo realmente autorizadas: entidades consultables, campos, scopes y ventanas de API. No afirmes que e-NORA puede obtener reseñas, comentarios de anuncios, social listening, videos, imágenes, transcripciones o campañas orgánicas sin pruebas de capacidad/permisos. Valida tenant isolation/RLS, uso de OpenAI/Anthropic con información de clientes, salvaguardas, logs, políticas de privacidad y DPA cuando estén disponibles.

Separa lógica determinista de métricas de recuperación semántica, y evidencias de feedback cualitativo de resultados publicitarios atribuibles. Localiza planes de arquitectura existentes antes de inventar módulos nuevos.

Búsquedas orientativas, adaptando al stack real: `creative`, `hook`, `angle`, `persona`, `awareness`, `review`, `comment`, `reputation`, `brand`, `claim`, `bundle`, `AOV`, `campaign`, `adset`, `ad`, `Meta`, `insights`, `shopify`, `klaviyo`, `attribution`, `margin`, `rag`, `knowledge`, `ingest`, `embedding`, `vector`, `source_id`, `chunk`, `dedup`, `policy`, `guardrail`, `tenant`, `RLS`, `permission`, `experiment`, `roadmap`, `content`, `creative_brief`.

## B. Matriz incremental exhaustiva

Para cada ficha V03 y cada grupo `CONTRATO`, `TAXONOMIA`, `RUNTIME`, `EXPERIMENTACION`, `DATA`, `GUARDRAILS` e `INGESTA`:

- ¿El tema está en V01, V02, en otros documentos del repo, en código activo y/o en el índice vectorial? Cada superficie debe verificarse POR SEPARADO.
- ¿Qué aporta el nuevo vídeo y qué NO aporta? Evidencia con **tramo exacto** de V03 y ruta del candidato.
- ¿Qué clases/código/SQL/prompts/índices/tests aplican? Referencia `ruta:líneas` cuando sea viable.
- ¿Hay fuentes y permisos efectivos para ejecutarlo? ¿Hay datos de reviews, comentarios, activos, product costs, bundles, atribución, margen y cohortes?
- ¿Hay conflicto con políticas existentes? ¿Qué implicaciones legales, multi-tenant, privacidad, claims de producto o derechos de autor?
- Estado por superficie: `IMPLEMENTADO_Y_PROBADO | IMPLEMENTADO_PARCIAL | DOCUMENTADO_NO_EJECUTADO | SOLO_PAQUETE_PROPUESTO | DUPLICADO | CONFLICTO | NO_ENCONTRADO | NO_VERIFICABLE | OBSOLETO`.
- Decisión: `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR`, con prioridad y razón económica/técnica.

## C. Resolver contradicciones entre los TRES vídeos

Analiza, como mínimo:

1. **V02: copiar/modelar anuncios de competidores que llevan tiempo activos**, V03: copiar es una estrategia deficiente. Diferenciar benchmarking de patrones de reproducción y pruebas auténticas; permanencia e impresiones no revelan ROI ni ventas.
2. **V01: empezar con distintos ángulos y formatos; V02: mucho volumen de variaciones; V03: estrategia antes del formato.** Diseñar criterios para seleccionar hipótesis antes de generar variantes, sin desestimar experimentos útiles.
3. **V02: evitar campañas awareness con bajo presupuesto; V03: contenido TOFU para cubrir gaps.** Dejar explícito que un mensaje de descubrimiento/educación puede usarse con distintos objetivos Meta; etapa del creativo ≠ objetivo de campaña.
4. **V01: broad targeting; V02: nicho; V03: distintas personas.** Separar audiencia configurada, posicionamiento comercial, segmento de necesidad e inferencias sensibles; nunca generar targeting discriminatorio ni deducir salud por reseñas.
5. **V01/V02: CPA, ROAS, LTV y beneficio; V03: bundle/AOV.** Mejorar rentabilidad significa contribución/margen real; aumento de ticket no implica aumento de margen.
6. V03: comentarios, reviews, Reddit, YouTube y Amazon como contexto; contrastar con la calidad/sesgo/representatividad y fuentes realmente disponibles.
7. V03: promesas de Storyblocks, ejemplos Grüns/Oats Overnight/Rhode; promocionales e hipótesis **no son validación factual de resultados**.

## D. Caso especial — CREATIVE INTELLIGENCE

Evalúa si e-NORA tiene una capa **real** de investigación creativa (no solo consejos de LLM) que pueda:

1. Identificar promesa y pruebas del producto sin claims inventados.
2. Clasificar reseñas autorizadas y comentarios por objeción, motivo de compra, producto, fecha, fuente y sesgo.
3. Proponer personas **basadas en necesidades agregadas** y no inferir datos sensibles de personas reales.
4. Enlazar inventario de creativos con una taxonomía consistente: persona / ángulo / nivel de conciencia / concepto / formato / hook / objetivo Meta.
5. Detectar brechas con cobertura y limitaciones explícitas, no declarar ausencias cuando faltan permisos o histórico.
6. Proponer brief con objetivo, evidencia, hipótesis, viabilidad, KPI y guardrails; no generar solo «20 hooks genéricos».
7. Medir resultados y cerrar aprendizaje sin confundir correlación con causalidad o atribuciones cruzadas.
8. Distinguir capacidades de **analizar**, **sugerir**, **generar archivos**, **generar vídeo** y **publicar/ejecutar**. No atribuir capacidades al producto sin evidencia.

## E. Privacidad y seguridad (bloqueante cuando proceda)

- ¿Se tratan reseñas/comentarios con nombres, emails, handles, fotografías o datos personales? ¿Se minimizan y agregan antes de LLM o RAG?
- ¿Dónde y con qué finalidad/retención se envían los datos a OpenAI/Anthropic? ¿Subencargados y transferencias documentados?
- ¿Se respetan términos/condiciones de plataformas, licencias de materiales y derechos de testimonios?
- ¿Se bloquean perfiles de salud, medicación, embarazo u otros atributos sensibles y claims no demostrables?
- ¿Hay separación completa entre datos de tenants y corpus genérico? ¿Un tenant puede recuperar opiniones o estrategias privadas de otro?
- ¿Podría la ingesta de reseñas crear PII persistente en embeddings/chunks/logs? Formular mitigación sin ejecutar.

## F. Plan de integración FUTURO, NO EJECUTADO

Entrega prioridades y propuestas acotadas:

- **P0:** falsos conocimientos, claims, PII/permisos, aislamiento, duplicados dañinos, cálculos económicos defectuosos.
- **P1:** conocimiento nuevo sobre metodología de investigación de objeciones, taxonomía, matriz de brechas y contrato de brief, si faltan y existen datos.
- **P2:** contenido multicanal, escucha externa, pipeline avanzado de análisis audiovisual, producción/edición de vídeos; sin asumir que lo enseñó V03.

Por cada iniciativa: `problema`, `evidencia concreta`, `decisión sobre MDs`, `fuente de verdad/camino canónico`, `datos/requisitos`, `riesgos`, `migración opcional a futuro`, `tests`, `DoD`, `estimación relativa` y `dependencias`. Evitar arquitectura gratuita: si no hay consumidor o fuente, proponer únicamente conocimiento futuro o **descartar**.

Auditar ingesta con versionado, IDs, hash/dedupe, minimización PII, reindexación selectiva y rollback; **no generes embeddings en esta fase**.

## ENTREGABLE FINAL (SOLO RESPUESTA)

1. **Resumen ejecutivo:** valor NUEVO de V03, lo repetido de V01/V02, lo descartable y mayor riesgo.
2. **Mapa comprobado de arquitectura:** rutas:líneas, conectores realmente habilitados y no verificables, índice RAG y agentes consumidores.
3. **Matriz de 11 fichas + contratos/runtime/datos/guardrails/ingesta:** `ID | V01/V02 | estado repo | evidencias ruta:línea | indexado? | runtime? | datos disponibles? | gap real | riesgo | decisión | prioridad`.
4. **Comparativa crítica entre 3 fuentes:** resolver las siete tensiones de la sección C.
5. **Diagnóstico creative-intelligence:** fichas y taxonomías que ya existen, su calidad y evidencia; gap de producción de vídeo.
6. **Duplicados/conflictos:** lista con documentos/prompts/chunks y propuesta de destino canónico; no reindexar.
7. **Plan priorizado P0/P1/P2 NO EJECUTADO:** pruebas, DoD y dependencias, indicando para cada uno de los **11 MD** `CONSERVAR | FUSIONAR | AMPLIAR | DESCARTAR | BLOQUEAR`.
8. **Limitaciones y acceso:** falta de repo/ZIP anteriores, scopes, estadísticas o documentación no consultables; **NO VERIFICABLE** cuando aplique.
9. **Prueba de solo lectura:** `git status` antes/después si se puede; confirmar únicamente lo realmente observado sobre 0 escrituras, 0 migraciones, 0 embeddings, 0 cambios en anuncios y 0 despliegues.

## Principio de cierre

**No integres nada automáticamente.** Si ya existe la función, reutilízala. Si la fuente es redundante, descártala. Si el vídeo solo aporta intuición, clasifícala como hipótesis. El objetivo de la auditoría es **menos duplicación, más precisión y un siguiente paso implementable con seguridad**, no llenar el RAG de transcripciones.
