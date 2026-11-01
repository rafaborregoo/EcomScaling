# Decisiones después de la auditoría (no ejecutar todavía)

## Regla de integración

- **Ya existe completo:** NO duplicar. A lo sumo añadir referencias documentales o casos de prueba útiles.
- **Existe parcialmente:** proponer patch mínimo en el módulo canónico vigente.
- **Solo documentado:** comprobar contratos/código antes de llamarlo funcionalidad.
- **Duplicado:** recomendar una única fuente de verdad y migración sin cambios silenciosos.
- **No encontrado:** definir diseño mínimo con dependencias y tests, pendiente de aprobación.
- **Contradice conocimiento validado:** conservar en cuarentena como hipótesis discutible o descartar.

## RAG e ingestión (fase futura)

Antes de generar nuevos embeddings hay que inventariar: corpus maestro, documentos de producción, chunking, IDs/canonical URLs, hashes, versiones, namespaces de tenant, filtros de retrieval, backfills, dedup/upserts, reindexación, observabilidad y tests. El agente debe proponer reconciliación por identificador y contenido hash para evitar indexar duplicados. No ejecutar ingestión con este pack.

## Pruebas mínimas para cualquier fase de implementación

- No regresiones en consultas existentes ni alteraciones de respuesta en otras áreas de e-NORA.
- Fuente trazable y contratos con periodos, divisa, denominadores y datos faltantes.
- Ejemplos de margen insuficiente, tracking ausente, atribución distinta, muestra escasa y multi-tenant.
- Comparación canónica entre nuevo conocimiento y respuesta de agentes existentes.
- Ejecución idempotente, sin embeddings duplicados y con rollback documentado.
- Revisión de privacidad, permisos, PII, subencargados y accesos a datos de tienda.

## Entregables tras la auditoría

1. Inventario estructural real del RAG, conectores y agentes.
2. Matriz completada con evidencias de rutas+líneas.
3. Duplicados, contradicciones y documentos obsoletos.
4. Plan priorizado P0/P1/P2, distinguiendo quick wins, revisión documental y cambios de runtime.
5. Lista de decisiones abiertas que requieren criterio del propietario.
6. Recomendación explícita de ingestión: *qué documentos*, *cuándo*, *qué reemplazan* y *qué NO se indexa*.
7. Confirmación de no cambios y salida del `git status` final.
