# META-CR-003 — Investigación reputacional y objeciones

**Estado:** CANDIDATO — NO APROBADO PARA PRODUCCIÓN.  
**Origen:** Vídeo 03: transcripción proporcionada por el usuario. Tramo: 03:25–07:26.  
**Alcance:** Conocimiento propuesto para e-NORA; **no significa que la plataforma ya lo implemente**.

## Lo que afirma o muestra la fuente

- La ponente propone reconstruir el recorrido de investigación de un comprador: primera página de Google, noticias/prensa, Reddit, Amazon, redes sociales y vídeos/comentarios de YouTube.
- Su objetivo es descubrir objeciones: dudas sobre efectividad, valor, precio, confianza y fricciones de compra.
- Advierte de posible contenido pagado en medios/reviews; expresa confianza subjetiva en algunos canales, **sin demostrar representatividad**.

## Traducción candidata para e-NORA (inferencia / diseño, NO extraída literalmente)

- Definir `reputation_finding` con `claim_or_objection`, `source_type`, `source_url_or_id`, `observed_at`, `excerpt`, `evidence_strength`, `potential_bias`, `sample_scope`, `verification_status`, `tenant_id` si aplica.
- Agrupar objeciones por tema, asociarlas a páginas/productos y formular experimentos de mensajes de prueba, FAQs o pruebas sociales reales.
- Contrastar señales públicas con datos propios del comerciante, en lugar de inferir causalidad directamente desde comentarios.

## Datos y condiciones previas

- El vídeo NO concede acceso a Google, Reddit, Amazon o YouTube ni prueba que e-NORA tenga conectores/permisos para obtenerlos.
- Fuentes públicas sujetas a términos de uso, derechos de autor, privacidad y restricciones de consulta; preferir datos autorizados o aportados.
- Necesaria evaluación temporal, geográfica, lingüística y por producto.

## Límites, sesgos y riesgos

- Una crítica aislada o anónima no demuestra prevalencia ni veracidad.
- Los comentarios pueden estar manipulados, seleccionados o incentivados.
- No exponer identidad de consumidores ni inferir atributos sensibles; minimizar, agregar y citar.

## Comprobaciones y ejemplos de aceptación (propuestas)

- 1 comentario negativo: clasificar como señal puntual, no como tendencia.
- 200 comentarios similares pero procedentes de una campaña sesgada: indicar sesgo de muestra.
- No existe acceso externo: emitir `NO_DISPONIBLE` y propuesta de estudio manual, sin fingir rastreo.

## Decisión

Auditar cobertura del repositorio, RAG, índices, contratos y conectores existentes; `REUTILIZAR / FUSIONAR / AMPLIAR / CREAR / DESCARTAR / BLOQUEAR`. Ninguna ingestión sin decisión explícita posterior.
