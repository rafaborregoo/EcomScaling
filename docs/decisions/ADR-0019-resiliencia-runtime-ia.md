# ADR-0019 — Resiliencia y límites del runtime de IA

**Estado:** aceptado

## Decisión

Todas las llamadas a proveedores LLM pasan por `withAgentResilience` en
`packages/ai/src/resilience.ts`. La política por defecto es timeout de 45 s,
hasta 2 reintentos, backoff exponencial acotado de 500 ms a 8 s y jitter del
20 %. Solo se reintentan timeouts, errores de red, 408/409/425/429 y 5xx;
errores de autenticación, permisos, validación y presupuesto fallan rápido.

El timeout aborta la petición cuando el SDK lo soporta. No se reintenta la
ejecución de tools: así no se duplican escrituras ni auditorías. El circuit
breaker durable por organización de `apps/api/src/ai-runtime.ts` sigue siendo
la barrera de nivel servicio y se abre tras 3 fallos recientes en una ventana
de 5 minutos.

## I/O-bound y CPU-bound

Las esperas de red usan `async/await`, `AbortSignal` y timers no bloqueantes.
Las lecturas independientes se agrupan en paralelo con límites; las tareas
CPU síncronas (parseo, validación y serialización) se mantienen acotadas por
presupuesto/tamaño y los trabajos de ingestión o sincronización se ejecutan en
workers. No se permite un retry infinito ni trabajo CPU dentro de bucles sin
límite.

La política tiene tests puros para backoff, timeout, clasificación y número
máximo de intentos. Se puede sobrescribir por turno para pruebas o tuning
operativo, pero nunca eliminar los límites desde el prompt del modelo.
