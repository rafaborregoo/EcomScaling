# Criterios de decisión tras la auditoría

## REUTILIZAR

El repositorio tiene una regla vigente con tests y consumo por agente. Añadir, como máximo, referencia de origen o caso acotado.

## FUSIONAR / AMPLIAR

El conocimiento nuevo aporta una condición, límite, ejemplo o taxonomía que falta en una fuente canónica; proponer cambio acotado sin duplicar chunks.

## CREAR

Existe gap funcional y documental auténtico, hay datos y permisos suficientes, pruebas previstas y un agente consumidor. Aprobar expresamente antes de crear o indexar.

## DESCARTAR / BLOQUEAR

Contenido redundante, publicitario, sin evidencia suficiente, inseguro, sin fuentes accesibles o que implique inferir salud/PII o claims no verificados.

## Criterios de aceptación para una futura fase autorizada

- Contratos y fuente de verdad única versionados, pruebas de regresión y seguridad multi-tenant.
- Ingesta idempotente; deduplicar por ID de origen y/o hash semántico revisado, sin reembeddings innecesarios.
- Estructuras/índices de producción nunca se cambian sin estrategia de rollback y aprobación.
- Métricas de calidad de recuperación y fidelidad a fuentes antes y después.
- Acciones externas siempre separadas de análisis, con permisos explícitos.
- Nuevos contenidos solo si mejoran decisiones operativas medibles; si todo está cubierto, **NO INTEGRAR**.
