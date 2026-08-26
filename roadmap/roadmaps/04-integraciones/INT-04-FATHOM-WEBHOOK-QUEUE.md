# INT-04 — Entrada segura de webhooks Fathom

Incremento local: implementado.

El worker programa `fathom-webhook-processing` cada minuto y llama al endpoint interno protegido.
El consumidor reclama con compare-and-swap, crea una llamada Fathom y una unica transcripcion por
`external_recording_id`, reintenta con backoff hasta cinco veces y ejecuta A01 solo si existe
transcripcion. Una salida de A01 sigue siendo borrador pendiente de aprobacion.

La migracion `20260824180000_int_04_fathom_webhook_queue.sql` anade claims, backoff, resultado,
estado `processing` y la clave de grabacion externa.

`apps/api/src/fathom-webhook-handler.ts` añade el endpoint preparado
`POST /v1/fathom/webhooks/:connectionId`. Verifica el secreto firmado, rechaza replay/firma inválida,
resuelve la organización exclusivamente por `integration_connections`, persiste el evento como
`queued` en `private.webhook_events` y devuelve `duplicate` para reintentos ya registrados.

La variable `FATHOM_WEBHOOK_SECRET` es opcional y server-side. La materialización posterior de la
llamada y transcripción se mantiene en una fase de consumo de cola, que debe pasar por A01 y la
aprobación humana; el handler nunca crea tareas ni publica contenido.

Tests directos cubren secreto ausente, firma inválida, replay, payload incompleto y deduplicación.
La validación contra una cuenta Fathom real continúa siendo externa y no se simula.
