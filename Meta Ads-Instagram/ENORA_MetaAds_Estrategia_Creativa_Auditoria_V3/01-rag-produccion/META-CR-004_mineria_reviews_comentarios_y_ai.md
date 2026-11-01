# META-CR-004 — Minería de reseñas y comentarios con IA

**Estado:** CANDIDATO — NO APROBADO PARA PRODUCCIÓN.  
**Origen:** Vídeo 03: transcripción proporcionada por el usuario. Tramo: 07:31–09:38.  
**Alcance:** Conocimiento propuesto para e-NORA; **no significa que la plataforma ya lo implemente**.

## Lo que afirma o muestra la fuente

- Describe exportar reseñas de clientes desde su plataforma y crear una hoja de minería de opiniones.
- Recomienda incluir comentarios de anuncios relevantes del último año y ejemplos detectados manualmente en otras fuentes.
- Quiere obtener fortalezas, debilidades, objeciones, frases particularmente expresivas, patrones de lenguaje y desencadenantes de compra.
- Sugiere usar un LLM para analizar estos materiales, manteniendo criterio humano.

## Traducción candidata para e-NORA (inferencia / diseño, NO extraída literalmente)

- Pipeline candidato: `collect_authorized` → `normalize` → `deduplicate` → `remove_PII` → `tag_source` → `classify_theme` → `extract_supported_phrase` → `aggregate` → `human_review` → `creative_hypotheses`.
- Guardar procedencia por reseña/comentario, producto/idioma/fecha y nivel de corroboración.
- Etiquetas candidatas: uso, objeción, confianza, precio, logística, comparación, beneficio percibido, valoración, satisfacción, fraude/ruido.
- Resumen AI reproducible con citas a IDs internos; separar citas reales de paráfrasis.

## Datos y condiciones previas

- Verificar existencia de API/export para la plataforma concreta de reseñas; Shopify, Meta y Klaviyo no garantizan por sí solos todos los textos de review.
- Comentarios de anuncios condicionados por permisos, API y políticas, y por campaña y período.
- Controles por tenant, retención de PII, tratamiento por modelos IA, cuotas y trazabilidad.

## Límites, sesgos y riesgos

- No reimprimir testimonios identificables ni reutilizar testimonios en anuncios sin los derechos/consentimientos necesarios.
- El volumen alto de reseñas no implica representatividad; considerar sesgo positivo/negativo y clientes que no opinan.
- El modelo puede alucinar citas o inventar tendencias; exigir extractos con IDs originales.

## Comprobaciones y ejemplos de aceptación (propuestas)

- Reviews duplicadas entre web y plataforma externa: no duplicar conteo.
- Frase que no aparece en el material: rechazar cita textual inventada.
- Sin acceso a comentarios Meta: presentar análisis limitado a fuentes verificadas.

## Decisión

Auditar cobertura del repositorio, RAG, índices, contratos y conectores existentes; `REUTILIZAR / FUSIONAR / AMPLIAR / CREAR / DESCARTAR / BLOQUEAR`. Ninguna ingestión sin decisión explícita posterior.
