# OPS-03 — Resiliencia de llamadas internas del worker

## Implementado

El worker usa `fetchWorkerWithResilience` para activar el reconcile interno de
Shopify. La petición tiene timeout de 10 s, hasta 2 retries para red, timeout,
408/425/429 y 5xx, backoff exponencial acotado y respeto de `Retry-After`.

Los errores permanentes se devuelven sin repetir. El endpoint es idempotente y
mantiene el `x-correlation-id` del job, por lo que un retry no pierde trazabilidad.
BullMQ conserva su propia política de intentos de job; esta capa solo protege la
petición HTTP y no crea un bucle infinito.

## CPU/I/O

La espera es asíncrona y abortable. El worker mantiene concurrencia controlada
por BullMQ y no ejecuta reintentos ocupando CPU; el backoff usa timers. Los
procesamientos pesados de memoria/sync siguen siendo jobs separados.

## Gate de despliegue

Validar con Redis real que el job repetible no se duplica entre instancias y
que el endpoint interno registra el mismo correlation ID. Esa verificación no
se simula sin la infraestructura de producción.
