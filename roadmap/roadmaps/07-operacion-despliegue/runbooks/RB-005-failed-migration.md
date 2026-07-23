# RB-005 - Migracion fallida (aplicacion parcial o drift de version)

## Contexto operativo real

No hay CI que aplique migraciones (`ci.yml` no tiene ningun paso de `supabase db push`/`migration up`) ni
staging propio (ver OPS-00, R-015 cerrado). Las migraciones de `supabase/migrations/` se aplican a mano
contra el proyecto de produccion (`SaaS-EcomScaling`, `cthjwpeygpzwdmjkxeqa`) via CLI/MCP durante el
desarrollo — no hay una politica de migraciones escrita todavia (gap ya senalado en OPS-00). Este runbook
cubre los dos modos de fallo reales de ese flujo.

## Sintoma

Uno de estos dos:

1. **Aplicacion parcial/con error**: un `create table`/`alter table`/`create function` a mitad de una
   migracion falla (constraint violado, tipo ya existente, dependencia circular) y deja el schema en un
   estado intermedio — o la migracion completa pero un test/build posterior revela que algo no quedo como
   se esperaba.
2. **Drift de version** (silencioso, sin error visible): el nombre de archivo local no coincide con la
   version que Supabase registro como aplicada en `supabase_migrations.schema_migrations`. No rompe nada
   inmediatamente, pero futuras herramientas que comparen "migraciones locales" vs "migraciones aplicadas"
   por version (`supabase migration list`, `supabase db push` con deteccion de pendientes) dejan de ser
   confiables.

## Hallazgo real (2026-07-23, confirmado con `list_migrations` contra el proyecto real)

El modo 2 **ya esta sucediendo hoy**, sin que nadie lo hubiera detectado antes de este runbook. Comparando
los 46 archivos de `supabase/migrations/` contra las 44 filas que Supabase tiene registradas como aplicadas,
10 migraciones tienen el mismo nombre pero una version (timestamp del nombre de archivo) distinta a la
registrada en remoto:

| Archivo local | Version en archivo | Version registrada en remoto |
| --- | --- | --- |
| `ai_09_budget_status` | `20260722190000` | `20260721065422` |
| `db_12_pending_deletion_enum` | `20260722200000` | `20260721065437` |
| `db_13_soft_delete_lifecycle` | `20260722200100` | `20260721065449` |
| `db_01_enum_labels_helper` | `20260722210000` | `20260721065509` |
| `db_01_enum_labels_search_path_fix` | `20260722210100` | `20260721065535` |
| `be_07_gateway_lock_timeout` | `20260722220000` | `20260721094718` |
| `db_07_task_status_history_visibility_fix` | `20260722230000` | `20260722074047` |
| `ai_07_memoria_acumulativa` | `20260722240000` | `20260722170759` |
| `ai_07_knowledge_documents_source_types` | `20260722241000` | `20260722170938` |
| `fe_03_strategic_plans_draft_visibility_fix` | `20260722250000` | `20260722214617` |

Causa mas probable: estos archivos se aplicaron primero con su timestamp original (las versiones de la
columna derecha), y se renombraron **despues** en el repositorio local para reordenarlos junto a
migraciones vecinas del mismo dia — sin volver a sincronizar el registro remoto. El schema en si no esta
roto (todas las funciones/tablas de estas 10 migraciones existen y sus tests pasan, confirmado en las
sesiones de DB-00 a DB-13 de esta ronda), es puramente un desajuste de **metadatos de versionado**. Sigue
siendo un riesgo real: si alguna vez se ejecuta `supabase db push` o `supabase migration list` contra este
proyecto, la CLI intentaria reaplicar (o marcaria como pendientes) estos 10 archivos con su timestamp local,
porque no encuentra esa version exacta en `schema_migrations` — probable colision con objetos que ya
existen (`already exists` en `create table`/`create type`, no en `create or replace function`, que es
idempotente).

## Impacto

- **Modo 1 (aplicacion parcial)**: alto — el schema puede quedar en un estado que ninguna migracion
  posterior asume, rompiendo funciones/RLS que dependen de la tabla/columna a medio crear.
- **Modo 2 (drift de version)**: bajo hoy (nadie usa `supabase db push` automatizado todavia), pero se
  convierte en bloqueante en el momento en que se automatice el despliegue de migraciones (ver Prevencion) —
  hay que corregirlo antes de esa fecha, no despues del primer fallo real de CI.

## Severidad

SEV-2 si la migracion parcial ya esta en produccion y bloquea una feature; SEV-3 (no urgente) para el drift
de version puro sin sintoma funcional, como el hallazgo de arriba.

## Comprobaciones iniciales

1. Confirmar el modo de fallo:
   ```
   mcp: list_migrations(project_id) -> comparar contra `ls supabase/migrations/` por nombre
   ```
   Si el nombre existe en ambos lados pero la version (prefijo numerico) difiere -> drift de version (modo
   2), no hay corrupcion de schema.
2. Si hubo un error explicito al aplicar (CLI o MCP `apply_migration` devolvio un error): revisar el
   mensaje completo — casi siempre es uno de:
   - `relation "X" already exists` / `type "X" already exists`: la migracion (o parte de ella) ya se habia
     aplicado antes, posible reintento sobre un estado parcial.
   - `column "X" does not exist` / `relation "X" does not exist`: la migracion asume una migracion previa
     que no se aplico o se aplico despues por error de orden.
   - Violacion de constraint al hacer backfill de una columna nueva (`not null`, `check`) sobre datos
     existentes.
3. Confirmar el estado real de los objetos que la migracion debia crear/modificar (`\d nombre_tabla` en
   `psql`, o `select * from information_schema.columns where table_name = 'x'`) — no asumir por el mensaje
   de error que nada se aplico; en Postgres cada sentencia DDL fuera de una transaccion explicita se
   confirma independientemente salvo que la migracion completa este envuelta en `begin`/`commit` (Supabase
   CLI envuelve cada archivo de migracion en una transaccion por defecto, pero `apply_migration` via MCP
   puede no hacerlo igual — confirmar el mecanismo usado antes de asumir atomicidad).

## Diagnostico

- **Drift de version puro** (como el hallazgo de arriba): el schema esta correcto, es solo el registro de
  versionado el que no coincide. No requiere accion urgente, pero si accion antes de automatizar despliegues.
- **Aplicacion parcial real**: uno o mas objetos de la migracion existen, otros no. El resto de migraciones
  posteriores que ya se aplicaron con exito sobre ese estado incompleto tambien hay que revisarlas — pueden
  estar asumiendo silenciosamente el objeto faltante sin haber fallado (ej. una funcion que referencia una
  columna nueva vía `select *`, que no falla hasta que se ejecuta esa rama de codigo).

## Acciones

**Nunca reintentar la migracion completa sin revisar primero que sentencias ya se aplicaron** — la mayoria
de sentencias `create table`/`create type` no son idempotentes (fallan con `already exists` si se repiten),
a diferencia de `create or replace function`/`create index if not exists`, que si lo son.

1. Para aplicacion parcial: escribir una migracion **nueva** (nunca editar un archivo ya aplicado) que
   complete solo lo que falta, usando `if not exists`/`create or replace` donde el motor lo soporte para que
   sea segura de reintentar. No hacer `drop` de lo ya aplicado salvo que sea explicitamente necesario y con
   confirmacion de que no hay datos reales dependientes.
2. Para drift de version: usar `supabase migration repair --status applied <version>` (o el equivalente que
   exponga el MCP) para que el registro remoto declare la version que el archivo local realmente tiene,
   **sin re-ejecutar el SQL** (el schema ya esta correcto, solo se corrige el metadato). Alternativa mas
   simple si no se puede usar `migration repair`: renombrar el archivo local para que coincida con la
   version ya registrada en remoto, en vez de al reves — es la operacion sin riesgo porque no toca el
   proyecto real.
3. Tras cualquiera de los dos casos, correr `npm run test -w @ecomscaling/api` completo (105 tests,
   incluye RLS/RPC/aislamiento) para confirmar que el schema resultante sigue siendo el esperado por el
   codigo — no solo que la migracion "se aplico sin error".

## Rollback

Postgres no tiene rollback automatico de DDL ya confirmado fuera de una transaccion activa. Si una
migracion parcial dejo el schema en un estado peor que el anterior (por ejemplo, un `alter table` que
elimino una columna en uso), la unica via real hoy es restaurar desde el backup diario mas reciente
(`RB-007-database-backup-restore.md`) a un proyecto de prueba, confirmar el estado correcto, y escribir una
migracion nueva que revierta manualmente el cambio problematico sobre produccion — no hay PITR en el plan
actual (ver RB-007), así que cualquier dato escrito despues del ultimo dump diario y antes del rollback se
pierde si se restaura el proyecto completo (por eso el rollback preferido es una migracion correctiva
nueva, no restaurar produccion entera).

## Validacion de recuperacion

- `list_migrations` (MCP) y `ls supabase/migrations/` coinciden en cantidad y en version por nombre.
- El schema tiene exactamente las tablas/columnas/funciones que el conjunto completo de migraciones locales
  declara (sin objetos huerfanos de un intento fallido, sin objetos faltantes de uno incompleto).
- Suite completa de `apps/api` (105 tests) pasa contra el proyecto real.
- `supabase db advisors --linked --type security --level warn` sin warnings nuevos.

## Comunicacion al cliente

No aplica salvo que la migracion parcial haya causado un error visible en produccion (endpoint devolviendo
500 por columna/tabla faltante) durante el tiempo que estuvo sin corregir — en ese caso, tratar como
incidente de disponibilidad puntual, no de privacidad.

## Escalado

Sin equipo de guardia formal (R-018, equipo de una persona) — este runbook es la guia hasta que exista.

## Evidencias a conservar

Mensaje de error completo de la migracion fallida (si lo hubo), el diff exacto entre `list_migrations` y
los archivos locales en el momento del incidente, y el archivo de la migracion correctiva nueva.

## Prevencion

- **Accion pendiente concreta** (no solo principio general): las 10 migraciones listadas en "Hallazgo real"
  arriba tienen drift de version hoy mismo — corregirlas con `migration repair` (o renombrado local) antes
  de automatizar cualquier `supabase db push` en CI, para que la primera ejecucion automatica no falle por
  un `already exists` sobre objetos que llevan dias en produccion. **Intentado 2026-07-23**: la correccion
  via `UPDATE` directo sobre `supabase_migrations.schema_migrations` quedo bloqueada por el clasificador de
  auto-mode (escritura directa sobre metadatos de produccion) -- pendiente de que Rafa autorice
  explicitamente esta accion puntual antes de ejecutarla.
- Nunca renombrar un archivo de migracion despues de haberlo aplicado a un proyecto real — si hace falta
  reordenar migraciones del mismo dia, usar un sufijo de segundos/minutos distinto desde el principio en vez
  de renombrar retroactivamente.
- **Resuelto 2026-07-23**: politica de migraciones escrita —
  [`ADR-0014-migration-policy.md`](../../../docs/decisions/ADR-0014-migration-policy.md). Define quien
  aplica (hoy, cualquiera con acceso, equipo de una persona), con que mecanismo (CLI o MCP, indistinto sin
  staging que proteger), y deja explicito que no hay revision formal por PR todavia.
