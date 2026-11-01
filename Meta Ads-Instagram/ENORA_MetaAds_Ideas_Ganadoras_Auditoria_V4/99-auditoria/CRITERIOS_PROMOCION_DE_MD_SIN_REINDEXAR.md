# Decisión documental después de auditoría — todavía NO ejecutar

## Reutilizar
Si una regla equivalente existe y es correcta, preferir el origen canónico actual y documentar el aporte incremental (si lo hay).

## Fusionar
Si V04 aporta una distinción útil a la misma entidad V03 (ej. big idea + angle + format), generar cambio mínimo al documento canónico, con cambio de versión y pruebas propuestas; **no hacerlo todavía**.

## Crear
Solo si existe consumidor real o roadmap aprobado, fuente de datos y prueba de valor. No crear tablas o índices preventivamente.

## Bloquear
Si depende de APIs inexistentes, material sin licencia, PII sin protección, datos cruzados entre tenants o claims engañosos.

## Descartar
Si no hay conocimiento nuevo, es una anécdota no contrastada o contraproducente para aprendizaje de agentes.

## Ingesta FUTURA controlada
- Document IDs canónicos estables y trazabilidad de versión/source_id.
- Deduplicación por hash/semantic diff y comparación de chunks existentes, no solo nombres de archivo.
- Borrado/actualización de chunks antiguos si cambia el documento aprobado, con rollback.
- Separar corpus genérico de conocimiento privado de tenants.
- Pruebas de retrieval y respuestas antes de indexar producción.
- Solo plantear scripts/SQL; en la auditoría **0 escrituras, 0 embeddings**.
