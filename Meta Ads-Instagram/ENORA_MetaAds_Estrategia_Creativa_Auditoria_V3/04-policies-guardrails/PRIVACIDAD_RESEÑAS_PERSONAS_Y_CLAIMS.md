# Privacidad, derechos y calidad de fuentes en investigación creativa

## Superficies a auditar

| Superficie | Riesgo | Tratamiento propuesto |
|---|---|---|
| Reviews propias | PII, textos identificables, derechos de publicación | Exportación autorizada, minimización, agregación, retención limitada, evidencias sin datos personales |
| Comentarios Meta | APIs y permisos, datos de terceros, finalidad original | Comprobar scopes y términos, no simular acceso, evitar copiar perfiles |
| Reddit/YouTube/Amazon | Restricciones de extracción, datos sesgados, copyright | Uso compatible con términos, referencias minimizadas, no scraping por defecto |
| LLMs OpenAI/Anthropic | Transmisión a subencargados, retención, residencia | Auditar DPA, política privacy, base jurídica, minimización, controles y logs |
| Personas inferidas | Discriminación, inferencias de salud/ingresos | Necesidades agregadas no sensibles, revisión humana, exclusión de atributos sensibles |
| Material creativo | Música, vídeos, rostros, testimonios, logos y licencias | Comprobar derechos antes de reutilización/publicación |
| Claims | Riesgo de publicidad engañosa, regulaciones por sector | Evidencia documentada, validación antes de producción |

## Preguntas obligatorias para la auditoría

- ¿Existen datos de reseñas directamente accesibles o solo se supone que Shopify los ofrece?
- ¿Comentarios de anuncios están realmente disponibles bajo los permisos actuales de Meta?
- ¿Se almacenan PII o textos originales en embeddings, cachés, logs y prompts?
- ¿Qué tenant posee el dato y quién puede verlo? ¿RLS y aislamiento verificados?
- ¿Hay validadores de claims, revocación y derecho de borrado y control de versiones?

Este documento **no sustituye** análisis jurídico ni determina una base legal concreta sin conocer el tratamiento real.
