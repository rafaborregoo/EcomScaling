# RB-007 - Backup y restauracion de la base de datos

> Correccion operativa 2026-08-21: `.github/workflows/backup-database.yml` incluye ahora un restore
> drill manual opt-in (`run_restore_drill=true`). Requiere el secreto separado
> `SUPABASE_RESTORE_DB_URL`, bloquea explicitamente si coincide con `SUPABASE_DB_URL` y valida que
> `public.organizations` y su policy RLS existan tras restaurar. No se ejecuta por defecto ni toca
> produccion.

## Contexto

El proyecto Supabase (`SaaS-EcomScaling`, organizacion `EcomScaling`) esta en **plan `free`**, que no
incluye backups automaticos ni PITR (eso empieza en el plan Pro, $25/mes, y PITR real requiere un add-on
adicional sobre Pro/Team). `RIESGOS.md` R-016 asumia que "Supabase gestiona backups/PITR a nivel de
infraestructura" — verificado 2026-07-22 que es falso en el plan actual: sin backup propio, un borrado o
corrupcion en produccion no tiene red de seguridad.

Decision de Rafa (2026-07-22): backup manual propio via `pg_dump` programado, en vez de subir a plan Pro
por ahora.

## Mecanismo de backup

Los workflows de backup y CI declaran `permissions: contents: read` de forma
explicita. El artifact sigue siendo un respaldo de produccion y su acceso debe
limitarse a los administradores del repositorio; no se debe compartir ni
descargar en equipos personales sin control. La configuracion del secret y el
drill de restauracion siguen siendo gates operativos externos.

`.github/workflows/backup-database.yml`, workflow manual `workflow_dispatch` (el cron
`30 2 * * *` UTC permanece comentado por decision operativa):

1. Instala `postgresql-client` en el runner (`ubuntu-latest`).
2. `pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges` — formato custom de
   `pg_dump`, comprimido y restaurable con `pg_restore` (no un `.sql` plano).
3. Verifica que el dump no esta corrupto con `pg_restore --list` antes de subirlo (falla el job si el
   archivo esta roto, en vez de descubrirlo el dia de una restauracion real).
4. Calcula un SHA-256 y sube el dump junto con su checksum como artifact de GitHub Actions,
   `retention-days: 30`; `if-no-files-found: error` impide que un artifact vacío se marque como
   correcto, y el checksum permite detectar corrupción o sustitución antes del drill.

## Configuracion pendiente (accion manual de Rafa, no automatizable por el agente)

El workflow necesita un secret `SUPABASE_DB_URL` con la cadena de conexion directa a Postgres (no la URL
de la API REST que ya existe como `SUPABASE_URL`). Pasos:

1. Dashboard de Supabase -> Project Settings -> Database -> Connection string -> modo **Session pooler**
   o conexion directa (puerto 5432), con la contraseña de la base de datos.
2. `gh secret set SUPABASE_DB_URL --repo <owner>/<repo>` (o Settings -> Secrets and variables -> Actions
   en GitHub) y pegar la cadena completa (incluye la contraseña, tratar como secreto igual que
   `SUPABASE_SERVICE_ROLE_KEY`).
3. Lanzar el workflow manualmente una vez (`workflow_dispatch`) para confirmar que el dump se genera y
   pasa la verificacion de integridad.
4. Para el drill, configurar temporalmente `SUPABASE_RESTORE_DB_URL` con una base desechable y lanzar
   `workflow_dispatch` con `run_restore_drill=true`. El workflow restaura, valida el esquema/RLS y
   falla si el destino coincide con produccion.

Sin este secret el job falla explicito (`SUPABASE_DB_URL secret is not set`), no en silencio.

## Procedimiento de restauracion (drill — ejecutar al menos una vez, no solo dejarlo escrito)

**No restaurar nunca directamente sobre el proyecto de produccion para probar.** El objetivo del drill es
demostrar que un dump es utilizable, no verificar el proyecto real.

1. Descargar el artifact mas reciente (`gh run download <run-id> -n <dump-file>` o desde la pestaña
   Actions del run).
2. Crear un proyecto Supabase nuevo y vacio *solo para el drill* (o una base Postgres local/Docker si hay
   Docker disponible — ver Q-007, hoy no disponible en este entorno) y obtener su cadena de conexion.
3. Restaurar contra ese destino desechable:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname "<connection-string-del-proyecto-de-prueba>" \
     ecomscaling-backup-<timestamp>.dump
   ```
4. Validar contra el destino restaurado (no contra produccion):
   - `select count(*) from organizations;` y comparar con el conteo esperado del momento del dump.
   - Revisar que RLS y funciones `SECURITY DEFINER` existen (`\df` en `psql`, o consulta a
     `information_schema.routines`) — un dump con `--no-owner --no-privileges` no siempre preserva
     policies de RLS igual que el original; confirmar antes de asumir que "restaurar" == "restaurar
     completo".
5. Borrar el proyecto/base de prueba al terminar — no dejarlo corriendo con datos reales de clientes.
6. Documentar aqui mismo (seccion "Historial de drills" abajo) fecha, duracion total (RTO real medido) y
   cualquier gap encontrado (ej. policies de RLS no restauradas, extensiones faltantes en el destino).

## RPO / RTO

- **RPO objetivo**: 24h (frecuencia del cron diario). Si se necesita menor RPO, subir frecuencia del
  workflow (coste: minutos de Actions, sin coste de Supabase) — no requiere plan Pro.
- **RTO objetivo**: sin medir todavia — pendiente del primer drill real (ver seccion siguiente). Q-015
  pide estos numeros formalmente para el criterio de entrada del piloto.

## Historial de drills

_Sin ejecutar todavia. No marcar el criterio de entrada "Backups configurados y restauracion probada al
menos una vez" (`OPS-01-piloto-mvp.md`) como cumplido hasta que haya al menos una fila aqui._

**Estado actual**: el procedimiento y el guard de seguridad ya estan automatizados en el workflow,
pero el drill sigue sin considerarse ejecutado hasta que un administrador configure
`SUPABASE_RESTORE_DB_URL` y lo lance sobre un destino desechable. La ausencia de ese secret no se
interpreta como exito.

| Fecha | Ejecutado por | Duracion (RTO medido) | Resultado | Gaps encontrados |
| --- | --- | --- | --- | --- |

## Limitaciones conocidas de este mecanismo

- No es PITR: solo se puede restaurar al punto del ultimo dump diario (hasta 24h de datos perdidos en el
  peor caso), no a un segundo exacto.
- Un solo punto de fallo si `SUPABASE_DB_URL` cambia (rotacion de contraseña) y no se actualiza el
  secret — el job fallaria explicito, pero solo se nota si alguien revisa las Actions o hay alertas
  configuradas (ver SQO-02, pendiente).
- `pg_dump`/`pg_restore` de un runner de GitHub Actions no cubre Storage de Supabase (archivos), solo la
  base de datos — no aplica hoy porque el producto no usa Storage, revisar si eso cambia.

## Prevencion

Reevaluar subir a plan Pro (backups diarios gestionados + opcion de PITR) antes de incorporar el primer
cliente de pago real — este mecanismo manual es razonable para pre-piloto sin datos de clientes reales
todavia, no para produccion con clientes.
