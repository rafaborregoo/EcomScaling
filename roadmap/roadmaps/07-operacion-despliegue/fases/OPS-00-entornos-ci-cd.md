# OPS-00 - Entornos y CI/CD

> Correccion vigente 2026-08-02: el historial de drift de 10 migraciones pertenece a una auditoria
> anterior. Tras los forward-fixes DB-09, DB-04, DB-10 y AI-13, hay 64 migraciones locales/remotas alineadas;
> `supabase db push --linked --include-all --dry-run` indica al dia y `supabase db lint` no encuentra
> errores. La falta de staging separado sigue siendo una decision operativa, no un fallo de migraciones.

> **CorrecciÃ³n vigente 2026-08-26:** la evidencia actual del proyecto remoto es
> 71 migraciones locales y 71 remotas alineadas, sin pendientes ni migraciones
> remotas adicionales. Las referencias a 64 migraciones describen una auditorÃ­a
> anterior. La aplicaciÃ³n se hizo mediante Docker/psql por el fallo `uv_spawn` de
> la CLI de Supabase en Windows.

## Estado

> Aclaracion vigente 2026-08-24: la ausencia de staging no bloquea el Piloto 1
> Shopify-only por decision operativa documentada en R-015/Q-001; si se crea
> staging sera para validaciones futuras y no una precondicion retroactiva. La
> politica de migraciones ya esta en ADR-0014 y las 63 versiones estan alineadas.

> **Corrección operativa 2026-08-24:** el workflow de CI está completo y ejecutable manualmente, pero sus
> disparadores `push`/`pull_request` permanecen comentados por decisión explícita de Rafa. No se debe
> describir como CI automático hasta reactivar esos eventos.

> El workflow manual también genera el SBOM de producción y construye/escanea las imágenes de API y worker;
> esto verifica los Dockerfiles sin publicar artefactos ni desplegar.

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** Q-001 (proveedor API/worker), Q-007 (Docker local)
- **Bloqueador:** ninguno tecnico, pero sin decision de Q-001 no hay staging real posible.
- **Evidencia:** `.github/workflows/ci.yml` (typecheck + build web + tests + lint; ejecución manual),
  `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `.dockerignore` (**corregido 2026-07-22**: existen, ya
  no es un gap — la version anterior de esta seccion decia "sin Dockerfiles confirmados").
- **Lo que si existe**: local funciona contra Supabase remoto (sin Docker, ver Q-007), CI tiene el pipeline
  completo para ejecución manual con los tests reales de SQO-00/01, Dockerfiles de API y worker listos (copian `apps/web/package.json`
  explicitamente para que `npm ci` resuelva el workspace completo, ver nota en el propio Dockerfile).
- **Lo que no existe, confirmado, no solo "por documentar"**: no hay staging (ni entorno ni proveedor
  decidido, ver Q-001), no hay politica de migraciones escrita (expansion/contraccion, quien aplica,
  rollback), ~~no hay matriz de secrets por entorno~~ (**cerrado 2026-08-03**:
  [`../MATRIZ_SECRETS.md`](../MATRIZ_SECRETS.md), extraida de `packages/config` y de los `env:` reales de
  los workflows), y trabajar contra Supabase remoto directamente en
  local/tests tiene los riesgos ya documentados en SQO-01 (datos compartidos, migraciones accidentales,
  tests que interfieren entre si). En esta sesion no se ejecuta un build Docker local; el workflow CI
  manual ya construye las imagenes de API y worker y las escanea con Trivy antes de considerar el control
  de supply-chain correcto.
- **Hallazgo real 2026-07-23** (ver `RB-005-failed-migration.md`, OPS-02): esta falta de politica de
  migraciones ya produjo drift real, no solo riesgo teorico -- 10 de las 46 migraciones locales tienen un
  timestamp de archivo distinto al que Supabase registro como version aplicada (`list_migrations` del
  proyecto real vs `ls supabase/migrations/`), probablemente por renombrarse tras aplicar para reordenar
  migraciones del mismo dia. El schema esta correcto (confirmado con la suite completa de tests), pero
  automatizar `supabase db push` en CI sin corregir antes este drift fallaria en el primer intento.
  **Correccion del drift en si (UPDATE sobre `supabase_migrations.schema_migrations`) bloqueada por el
  clasificador de auto-mode** por ser una escritura directa sobre metadatos de produccion -- queda
  pendiente de autorizacion explicita de Rafa, no es un problema de diseño de la correccion.
- **Resuelto 2026-07-23 (politica de migraciones escrita)**: `docs/decisions/ADR-0014-migration-policy.md`
  -- fuente de verdad es siempre el archivo en `supabase/migrations/`, timestamp inmutable una vez aplicado
  (causa raiz exacta del drift de RB-005), forward-fix en vez de editar migraciones aplicadas, verificacion
  de drift obligatoria antes de automatizar `supabase db push` en CI, sin revision formal por PR todavia
  (equipo de una persona, reconocido como gap explicito). Cierra el entregable de politica de migraciones
  que llevaba pendiente desde el origen de este documento.
- **Siguiente accion real**: resolver Q-001 (proveedor de hosting API/worker) — sin eso no se puede crear
  un staging real, y sin staging no se puede cerrar ningun criterio de entrada al piloto (OPS-01). Aparte,
  autorizacion pendiente de Rafa para corregir el drift de version de las 10 migraciones (ver arriba).

## Fallo real encontrado al escribir la matriz (2026-08-03)

`loadApiEnv` exige `SHOPIFY_API_KEY`/`_API_SECRET`/`_SCOPES`/`_REDIRECT_URI` **siempre**, sin importar que
hace el proceso. `klaviyo-reconcile.yml` (desde su creacion) y `meta-reconcile.yml` (creado el mismo dia)
no las declaraban en su bloque `env:`, asi que ambos crones abortaban al arrancar antes de leer una sola
conexion. GitHub Actions no hereda secretos entre workflows: lo que no declara el `env:` del job no existe.

Corregido en los dos workflows y protegido por `apps/worker/src/cron-workflow-env.test.ts`, que construye
un entorno falso con exactamente lo que cada workflow declara y se lo pasa a `loadApiEnv` real. No repite
una lista de variables requeridas: si manana se anade un requisito nuevo al schema, el test dice que
workflows se quedan cortos sin que nadie tenga que acordarse de actualizarlo. 9/9, ya en CI.

## Entregables

- Local reproducible.
- Preview por PR.
- Staging con OAuth y secretos propios.
- Produccion con migraciones aprobadas.
- CI para lint, typecheck, tests, build y smoke.
- Dockerfiles de API y worker.
- `docker-compose.yml` de desarrollo para API, worker y Redis si se decide trabajar con Redis local.
- Estrategia de despliegue separada: web en Vercel o equivalente; API y worker como servicios persistentes.

## Criterios de cierre

- Clonar, instalar y arrancar local funciona con un comando documentado.
- Secrets separados por entorno.
- La API y el worker tienen una ruta clara a staging/produccion mediante contenedor.

## Decision Docker

- No se dockeriza Supabase gestionado.
- No se bloquea el MVP por Supabase local si se trabaja directamente contra el proyecto remoto.
- Si se necesita test local de DB/RLS, Supabase CLI requerira Docker Desktop.
- API y worker si deben tener Dockerfile antes del piloto MVP.
