# META-CR-005 — Personas como hipótesis, no como hechos

**Estado:** CANDIDATO — NO APROBADO PARA PRODUCCIÓN.  
**Origen:** Vídeo 03: transcripción proporcionada por el usuario. Tramo: 09:39–10:24; 13:01–13:51; 19:11–21:16.  
**Alcance:** Conocimiento propuesto para e-NORA; **no significa que la plataforma ya lo implemente**.

## Lo que afirma o muestra la fuente

- Propone usar reviews, análisis reputacional y un prompt/deck para identificar perfiles de comprador y diseñar estrategias para llegar a nuevas audiencias.
- Compara personas detectadas en el estudio con las personas presentes en los creativos de la cuenta.
- En ejemplos intenta ampliar una marca hacia segmentos de consumidores que considera infrarepresentados.

## Traducción candidata para e-NORA (inferencia / diseño, NO extraída literalmente)

- Mantener `persona_hypothesis` con necesidades, contexto de uso, objeciones, ventajas, evidencia observada, número de fuentes independientes, incertidumbre y revisión humana.
- Persona ≠ segmentación de Meta: el mensaje puede dirigirse a una necesidad concreta manteniendo audiencias amplias, según estrategia de medios.
- Priorizar personas por oportunidad combinada (relevancia real, ingresos/margen observables, brecha creativa y capacidad de atenderlas), nunca por estereotipos demográficos.

## Datos y condiciones previas

- Datos agrupados y legítimamente obtenidos. Para conectar Shopify/Klaviyo, revisar propósito, base jurídica, calidad de datos y límites del procesamiento.
- Si las únicas fuentes son reseñas, expresar que representan autores de reseñas, no a todos los compradores.
- Requiere un inventario de campañas/creativos para detectar cobertura existente.

## Límites, sesgos y riesgos

- No inferir salud, embarazo, medicación, ingresos, religión u otros atributos sensibles de clientes individuales a partir de datos privados o públicos.
- Los ejemplos GLP-1 y perimenopausia del vídeo son situaciones mencionadas, **no autorización para perfilar usuarios por salud**.
- No generar audiencias especiales ni mensajes que exploten atributos personales sensibles.

## Comprobaciones y ejemplos de aceptación (propuestas)

- Una persona inferida de 3 comentarios: marcar `BAJA_CONFIANZA`.
- El agente debe explicar evidencia y límites en lugar de decir «el 40 % de tus clientes son X» sin datos.
- Un arquetipo no justifica activar targeting restringido o discriminatorio.

## Decisión

Auditar cobertura del repositorio, RAG, índices, contratos y conectores existentes; `REUTILIZAR / FUSIONAR / AMPLIAR / CREAR / DESCARTAR / BLOQUEAR`. Ninguna ingestión sin decisión explícita posterior.
