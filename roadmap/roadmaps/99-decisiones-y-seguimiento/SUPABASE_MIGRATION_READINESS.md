# Preparación de migraciones Supabase

## Estado verificado 2026-08-26

| Comprobación | Resultado | Interpretación |
| --- | --- | --- |
| `SUPABASE_URL` | presente, proyecto `cthjwpeygpzwdmjkxeqa` | URL remota configurada |
| Service role contra REST | HTTP 200 | el backend puede autenticarse contra Supabase |
| Host PostgreSQL / TCP 5432 | accesible | la red llega al proyecto |
| `SUPABASE_DB_URL` y password | presentes localmente | existe material para conexión directa, sin imprimir secretos |
| Clave pública web | Auth health HTTP 200 y consulta REST real HTTP 200 | la clave pública funciona para Auth y Data API; el 401 del índice raíz `/rest/v1/` era un falso positivo y no se usa como prueba |
| Supabase CLI | no instalado globalmente, pero `npx supabase 2.109.1` disponible | `migration list` y advisors funcionan; `db push` sigue fallando por tooling Windows |
| `psql` | no instalado en PATH; cliente disponible dentro de Docker | fallback directo operativo con `docker run --network host` |
| Supabase MCP | URL oficial añadida a `.mcp.json`, pero autorización actual denegada | no se pueden listar migraciones, ejecutar advisors, aplicar DDL ni regenerar tipos mediante MCP hasta completar OAuth |

## Corrección de estado 2026-08-26

Las siete migraciones pendientes fueron revisadas, ejecutadas primero en una transacción de prueba
con `ROLLBACK` y aplicadas después en orden contra el proyecto `cthjwpeygpzwdmjkxeqa` mediante
`psql` dentro de Docker con red host, porque `db push` de la CLI falla en Windows con `uv_spawn`.

La verificación posterior confirma `localCount=71`, `remoteCount=71`, `pendingLocal=[]` y
`remoteOnly=[]`. También existen en remoto las tablas de evidencia de evals, la cola de memoria,
la cola Fathom, `agent_sql_gateway` y `knowledge_search_hybrid`. El MCP sigue sin permisos para
este proyecto, pero ya no bloquea la migración porque el acceso PostgreSQL directo está operativo.

## Historial remoto verificado

> Typegen oficial 2026-08-26: se regeneró desde el mismo `SUPABASE_DB_URL` con los esquemas
> `public,private` y actualizó `packages/db/src/database.types.ts` (7.393 líneas). El archivo
> contiene AI-26, `processing_started_at`, `external_recording_id` y los RPC nuevos; typecheck
> de db/API/web pasa.

La CLI `2.109.1` ejecutada vía `npx` pudo conectarse usando `SUPABASE_DB_URL`
sin mostrar la contraseña. El remoto tiene aplicadas migraciones hasta
`20260824120000`. Hay 7 migraciones locales posteriores todavía no aplicadas:

- `20260824130000`
- `20260824150000`
- `20260824170000`
- `20260824180000`
- `20260826120000`
- `20260826140000`
- `20260826153000`

Esto demuestra que la conexión de gestión PostgreSQL funciona aunque el CLI no
esté instalado globalmente; antes de hacer `db push` hay que revisar esas siete
migraciones, ejecutar advisors y decidir explícitamente si se aplican al
proyecto remoto actual.

La CLI puede ejecutar `migration list` y `db advisors`, pero `db push --dry-run`
falla en este Windows con `EUNKNOWN: unknown error, uv_spawn` antes de tocar la
base. No se aplicó DDL. Es un bloqueo de la herramienta de aplicación local,
no de autenticación ni de red; queda pendiente resolverlo con una instalación
CLI soportada/MCP autorizado antes de promover las siete migraciones.

`supabase gen types --db-url` también se intentó y no llegó a consultar el
esquema porque esta instalación necesita el daemon Docker Linux, que no está
activo. Los tipos locales existentes permanecen intactos; no se reemplazan por
una salida incompleta.

## Informe reproducible de drift

`scripts/report-supabase-migration-drift.mjs` compara el historial local y remoto
sin ejecutar mutaciones. La última ejecución detectó 71 migraciones locales, 64
remotas y las siete pendientes listadas arriba; termina con `drift_detected` y
`mutationPerformed: false`.

## Advisors remotos

La ejecución de advisors con la misma URL detectó warnings reales, principalmente
políticas RLS permisivas duplicadas, un índice duplicado de Klaviyo y funciones
con `search_path` mutable. Son deuda existente que requiere revisión individual;
la migración RAG nueva ya fija explícitamente `search_path` tanto en el RPC
híbrido como en el RPC semántico anterior para no añadir deuda de seguridad.

## Conclusión

La conexión de la API y de la web con Supabase sí funciona. La cadena completa
para migraciones todavía no está verificada: no se debe afirmar que la base
remota está alineada ni ejecutar DDL hasta resolver el acceso de gestión.

## Secuencia histórica antes de habilitar el acceso

El chequeo reproducible está en `scripts/check-supabase-readiness.mjs`: sólo
imprime estados HTTP y disponibilidad de herramientas, nunca valores de claves.
La vía `npx supabase` con `SUPABASE_DB_URL` ya está disponible; MCP/CLI global y
la revisión/aplicación explícita de las migraciones siguen siendo pasos aparte.

1. Autorizar el conector/MCP oficial de Supabase o instalar el CLI autenticado,
   manteniendo el proyecto `cthjwpeygpzwdmjkxeqa` como destino explícito.
2. Obtener desde Supabase una publishable/anon key activa y reemplazar sólo la
   variable pública; nunca usar `SUPABASE_SERVICE_ROLE_KEY` en la web.
3. Leer la lista remota de migraciones y comparar con `supabase/migrations`.
4. Ejecutar advisors y revisar RLS/grants antes de aplicar DDL.
5. Aplicar primero en un entorno/branch aislado; después verificar funciones,
   tipos y tests de aislamiento.
6. Aplicar a producción sólo tras confirmar el diff de migraciones y conservar
   el resultado de la lista remota como evidencia.

Mientras tanto, las migraciones nuevas permanecen preparadas en el repositorio,
pero su estado remoto se marca como no verificado.

## Estado canónico posterior a la aplicación

La condición anterior queda supersedida por la corrección de 2026-08-26: las siete migraciones
están aplicadas y el informe de drift devuelve `aligned`. Para futuras migraciones se mantiene la
secuencia de revisión, prueba con rollback, aplicación ordenada, verificación y actualización de
esta readiness.
