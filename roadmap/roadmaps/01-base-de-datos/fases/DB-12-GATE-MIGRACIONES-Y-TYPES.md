# DB-12 — Gate de migraciones remotas y typegen

## Estado

`implemented_partial`: el repositorio contiene las migraciones locales y el
contrato TypeScript necesario para continuar el desarrollo. La comprobación
remota queda pendiente de permisos de Supabase, no de una decisión de diseño.

## Evidencia local

- `20260824130000_ai_07_memory_queue_claims.sql` añade el claim CAS de la cola
  de memoria y recuperación de workers obsoletos.
- La tabla `memory_ingestion_queue` ya tiene RLS y no expone policies de lectura
  para usuarios; solo la usa el backend con `service_role`.
- `20260824150000_ai_03_sql_gateway_cost_guard.sql` limita timeout, filas y
  coste estimado antes de ejecutar el SQL validado por el API.
- `packages/db/src/memory-queue.types.ts` compone el typegen existente con
  `processing_started_at` sin editar manualmente el archivo generado.

## Gate remoto obligatorio

Con permisos de proyecto se debe ejecutar, en este orden:

1. Aplicar ambas migraciones con el flujo controlado de Supabase.
2. Ejecutar advisors de seguridad y rendimiento.
3. Generar de nuevo `packages/db/src/database.types.ts`.
4. Ejecutar una prueba de claim concurrente, recuperación de claim obsoleto,
   aislamiento RLS y guard de coste SQL.

Hasta entonces no se afirma que producción tenga estas columnas o funciones.
El type overlay permite que el código local sea coherente, pero no sustituye la
prueba remota ni el typegen oficial. La política sigue las recomendaciones
actuales de Supabase sobre RLS y exposición explícita del Data API.
