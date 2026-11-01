# META-CR-001 — Estrategia creativa antes que formatos

**Estado:** CANDIDATO — NO APROBADO PARA PRODUCCIÓN.  
**Origen:** Vídeo 03: transcripción proporcionada por el usuario. Tramo: 00:01–00:41; 11:16–12:59; 21:17–21:54.  
**Alcance:** Conocimiento propuesto para e-NORA; **no significa que la plataforma ya lo implemente**.

## Lo que afirma o muestra la fuente

- La ponente considera insuficiente copiar anuncios de competidores o producir muchas variaciones de formato sin un diagnóstico.
- Describe una estrategia que busca identificar carencias del ecosistema creativo actual y alinearlas con los objetivos del negocio.
- Pregunta central: por qué un anuncio, una persona y un ángulo específicos, y qué oportunidad pretenden cubrir.

## Traducción candidata para e-NORA (inferencia / diseño, NO extraída literalmente)

- Proponer un `creative_brief` con campos `objective`, `business_problem`, `target_persona_hypothesis`, `evidence_refs`, `awareness_stage`, `angle`, `creative_concept`, `format`, `test_hypothesis`, `primary_metric`, `guardrail_metrics`, `confidence` y `next_action`.
- No generar una «lista de 20 hooks» sin explicar qué problema comercial y qué hipótesis concreta justifican cada grupo de propuestas.
- Trazar cada idea a una brecha observada o a una hipótesis explícita; una idea sin evidencia puede existir, pero debe figurar como exploratoria.

## Datos y condiciones previas

- Objetivo explícito del cliente (adquisición, activación, crecimiento por producto, posicionamiento, ticket medio, retención).
- Inventario creativo real o declaración explícita de que no está disponible.
- Datos de negocio actualizados y periodo de análisis comparable; consentimiento/permiso de acceso por tenant.

## Límites, sesgos y riesgos

- La creación de un brief no demuestra eficacia del anuncio.
- Si no hay activos accesibles o históricos, clasificar cualquier gap como `NO_EVALUABLE`, no como ausencia real.
- Separar estrategia de contenido, objetivo de campaña Meta y formato/placement.

## Comprobaciones y ejemplos de aceptación (propuestas)

- Caso A: petición «haz un vídeo» sin datos → ofrecer hipótesis y solicitar la mínima información faltante, no inventar métricas.
- Caso B: hay señal de abandono en producto X pero no datos sobre objeciones → investigación sugerida antes de afirmar causa.
- Caso C: un concepto se propone → justificar objetivo, persona, evidencia, experimento y métrica.

## Decisión

Auditar cobertura del repositorio, RAG, índices, contratos y conectores existentes; `REUTILIZAR / FUSIONAR / AMPLIAR / CREAR / DESCARTAR / BLOQUEAR`. Ninguna ingestión sin decisión explícita posterior.
