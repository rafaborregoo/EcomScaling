# OPS-01 - Piloto MVP

## Estado

- **Estado real:** `planned`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** OPS-00 (staging), SQO-00/02/03, INT-01 (webhooks de privacidad)
- **Bloqueador:** ninguno tecnico para el Piloto 1 (Shopify); Meta App Review bloquea el Piloto 2.
- **Correccion sobre la version anterior de este documento**: el paso 1 exigia "Shopify y Meta" desde el
  arranque, pero Meta sigue bloqueado por App Review/business verification (ver BE-04, INT-02) — no tiene
  sentido bloquear todo el piloto por eso. Dividido en piloto por capacidad, no todo-o-nada.

## Piloto 1 — Shopify y operacion (primero, sin dependencia de Meta)

Validar: onboarding, sincronizacion, metricas, configuracion financiera, dashboard, alertas, tareas,
llamadas (A01), monitor de negocio (A02) en shadow mode, soporte.

### Criterios de entrada (ninguno cumplido todavia — no incorporar clientes hasta marcarlos)

- [x] No existe hard-delete inmediato de organizaciones — resuelto 2026-07-21, soft-delete con 30 dias de
      gracia (R-008, ver FE-08/consultant.ts).
- [x] Shopify reconciliado con desviacion conocida contra una tienda real con pedidos — **cerrado
      2026-07-22**: productos exacto (11/11), pedidos con desviacion de 22 explicada (ventana de 60 dias de
      la API de Shopify, no un bug), ver INT-01.
- [x] Webhooks de privacidad de Shopify — **cerrado 2026-07-22**: registrados en codigo y deployados a
      Shopify (`shopify.app.toml` + `shopify app deploy`, version `ecomscaling-custom-4`), endpoint
      verificado en vivo devolviendo 401 ante HMAC invalido (ver INT-01).
- [x] `app/uninstalled` — **cerrado 2026-07-22**: gestionado en codigo y reenviado a la tienda piloto ya
      conectada (`padelespana.myshopify.com`) via `resendShopifyWebhookRegistrations`, ver INT-01.
- [x] RLS basico validado — **cerrado 2026-07-22**: 67 tests en `apps/api` (antes 60), cubriendo
      `organizations`/`tasks`/`alerts`, permisos del schema `private`, idempotencia de webhooks, aislamiento
      del RAG, aislamiento tenant del SQL Gateway, y ahora tambien configuracion financiera (4 tablas de
      DB-03: select cross-tenant denegado, insert directo sin grant rechazado) y conexiones de integracion
      (select/update cross-tenant denegado en `integration_connections`/`integration_sync_runs`, y
      confirmado que el schema `private` no esta expuesto por PostgREST). Ver SQO-00,
      `rls-tenant-isolation.test.ts`.
- [ ] Backups configurados y restauracion probada al menos una vez (SQO-03, R-016) — **corregido
      2026-07-22**: el proyecto esta en plan `free` de Supabase, sin backups/PITR gestionados (la version
      anterior de esta linea asumia lo contrario). Mecanismo de backup manual propio ya implementado
      (`.github/workflows/backup-database.yml`, `pg_dump` diario + verificacion de integridad, ver RB-007).
      **2026-07-23**: Rafa esta configurando el secret `SUPABASE_DB_URL` (en curso). **Decision explicita de
      Rafa**: el drill de restauracion real (crear un proyecto Supabase desechable y restaurar ahi) se
      pospone a proposito hasta el final del programa, para no invertir tiempo en eso ahora -- ver RB-007.
      El resto del criterio ("backup configurado" con verificacion de integridad automatica) puede cerrarse
      en cuanto el secret este activo y el workflow corra una vez con exito, sin esperar al drill completo.
      **RPO/RTO fijados 2026-07-29 (Q-015)**: RPO=24h (coherente con el backup diario, sin PITR en el plan
      `free` de Supabase) y RTO=4h (restauracion manual siguiendo RB-007 contra un proyecto nuevo). No
      cambia el estado del drill (sigue pospuesto a proposito), pero ya no falta definir "numeros concretos"
      como pedia Q-015.
- [x] Logs y alertas minimas — **cerrado 2026-07-22**: los logs estructurados ya existian (Fastify/pino +
      `createLogger`, con redaccion de secretos, ver SQO-02). Alertas operativas anadidas:
      `.github/workflows/ops-health-check.yml` corre cada 2h, agrega las senales de RB-001 (conexion en
      error o `syncing` atascada >2h), RB-001 (sync con 3+ reintentos fallidos en 24h), RB-002 (token
      OAuth expirado o expira en <24h) y RB-006 (run de agente cortado por presupuesto excedido), y
      crea/actualiza un issue de GitHub (label `ops-alert`) sin necesitar secrets nuevos. Sin plan de
      Sentry/APM (**Q-014 resuelta 2026-07-29**: Rafa decidio seguir solo con pino por ahora, sin contratar
      un proveedor nuevo mientras no haya cliente real; revisar al escalar), pero ya no depende de que
      alguien revise Supabase a mano para enterarse de un fallo. Metricas agregadas (paneles) siguen sin
      implementar.
- [x] Runbook de sync fallido existe — **corregido 2026-07-22**: `RB-001-shopify-sync-failed.md` ya esta
      escrito (formato completo con diagnostico/acciones/rollback, ver OPS-02), no esta vacio.
- [x] Staging operativo — **reevaluado 2026-07-22**: `apps/api` y `apps/web` ya estan desplegados en
      produccion en Vercel (`ecom-scaling-api`, `ecom-scaling-web`, verificado via API de Vercel). No existe
      un entorno de staging separado (R-015 sigue activo tal cual: los cambios van de local/preview directo
      a produccion), pero el criterio original asumia que faltaba *cualquier* hosting -- eso era falso.
      `apps/worker` (BullMQ+Redis) no esta desplegado en ningun sitio y no hace falta: es un unico archivo
      con una sola cola repetible (reconciliacion diaria de Shopify) que ya duplican los workflows de
      GitHub Actions (`shopify-reconcile.yml`, `alert-rules.yml`, `purge-expired-deletions.yml`,
      `backup-database.yml`, `ops-health-check.yml`); ningun otro punto del codigo encola trabajos en esa
      cola. Q-001 (proveedor de hosting API/worker) queda en pausa -- no es bloqueante mientras el patron
      "Vercel serverless + GitHub Actions cron" cubra la carga real. Revisar solo si aparece procesamiento
      asincrono real (un job disparado por accion de usuario que no quepa en una request serverless).
- [x] Responsable de soporte definido — **cerrado 2026-07-22**: Rafa confirmado como responsable de
      soporte del Piloto 1 (ver R-018: es tambien el punto unico de fallo para producto/ingenieria/
      operacion, sin sustituto documentado todavia). Diagnostico apoyado en RB-001/002/006/007 y el issue
      automatico de `ops-health-check.yml`.

## Piloto 2 — Adquisicion (solo cuando Meta este desbloqueado)

Añadir: Meta OAuth, Insights, ROAS, CAC, creatividades, reconciliacion con Ads Manager. No empieza hasta
que Meta apruebe la app (bloqueador externo, ver BE-04/INT-02).

## Piloto 3 — Retencion (cuando el nucleo anterior sea estable)

Añadir Klaviyo (INT-03, hoy `planned` sin codigo).

## Metricas de exito (sustituyen a "dashboard confiable", que no es medible)

| Metrica | Objetivo inicial |
| --- | --- |
| Diferencia facturacion vs Shopify Admin | <1%, o explicada |
| Diferencia pedidos vs Shopify Admin | 0, o explicada |
| Sync de pedidos (freshness) | <30 min |
| Sync diario correcto | >=99% |
| Incidentes criticos cross-tenant | 0 |
| Tareas consideradas utiles por el consultor | >=60% |
| Resumenes A01 aprobados sin cambios | >=70% |
| Tiempo de diagnostico de un sync fallido | <30 min |
| Uso semanal del panel por el consultor | >=3 dias/semana |

## Protocolo por cliente incorporado

`seleccion -> consentimiento y alcance -> conexion -> reconciliacion -> configuracion financiera ->
formacion -> primera semana acompañada -> revision semanal -> registro de incidencias -> evaluacion final`.
Recoger explicitamente: discrepancias, tareas utiles/inutiles, tiempo ahorrado, decisiones tomadas,
modulos no usados, errores, frustraciones, solicitudes de funcionalidad.

## Freeze de alcance (cuantificado, no solo "congelar expansion")

No iniciar Klaviyo, Instagram ni agentes nuevos hasta que al menos 3 clientes hayan usado el nucleo del
Piloto 1 durante 4 semanas continuas y se cumplan los umbrales de la tabla de metricas de arriba.

## Criterios de cierre

- Todos los criterios de entrada del Piloto 1 marcados.
- Umbrales de la tabla de metricas alcanzados con al menos 3 clientes reales durante 4 semanas.
- Soporte puede diagnosticar un fallo de sync en <30 min usando runbooks (no investigacion ad-hoc).
