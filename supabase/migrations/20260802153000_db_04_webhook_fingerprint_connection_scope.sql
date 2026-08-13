-- DB-04: un mismo payload puede existir validamente en dos tiendas distintas.
-- La deduplicacion debe aislarse por conexion, no solo por proveedor, para no
-- convertir un webhook de una tienda en un falso duplicate de otra.
-- Verificacion previa 2026-08-02: 716 filas en produccion, sin colisiones
-- provider+fingerprint entre conexiones.

drop index if exists private.webhook_events_unique_fingerprint;

create unique index webhook_events_unique_fingerprint
on private.webhook_events (provider, connection_id, fingerprint);
