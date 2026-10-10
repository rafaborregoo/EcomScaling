# Verificación del juez — 10-oct-2026

## Cambios terminados en esta iteración

- Separados los conjuntos repetibles `calibration` y `holdout` de certificación final en API, persistencia y panel.
- Las pruebas de calibración no congelan ni consumen holdout y nunca satisfacen el gate de promoción.
- La certificación congela un manifiesto SHA-256 y reclama el conjunto antes de llamar al modelo. Una segunda ejecución del mismo dataset/rúbrica se rechaza aunque se cambie de modelo.
- El gate de promoción requiere un informe aprobado del holdout congelado y una reclamación coincidente.
- La evaluación live ahora entrega al provider el candidato solicitado y exige que cada resultado devuelva ID y fingerprint de ejecución observados. Una discrepancia falla el caso y deja `candidate_pin_verified=false`; el hash solicitado por sí solo ya no puede certificar la versión ejecutada.
- Migraciones `20261215130000_agent_judge_holdout_single_use.sql` y `20261215140000_agent_judge_calibration_split_release_gate.sql` aplicadas en TEST (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`).

## Verificación

- AI: 12/12 pruebas.
- API dirigida de dataset, auth, runtime, release gate y runner: 29/29.
- Revalidación específica del contrato live candidate-pinned: AI 9/9 y API runner 10/10; typecheck API correcto.
- Endpoints protegidos ejecutados en TEST: 4/4.
- Build API, typecheck web y build de producción web: correctos.
- En TEST y producción se confirmó `evaluation_split`, ausencia de lectura de claims para `anon`, lectura para `service_role` y gate que requiere holdout más claim.
- En ambos proyectos se ejecutó un probe negativo transaccional: activar un candidato inactivo sin evidencia recibió `check_violation`; el candidato permaneció inactivo.
- `git diff --check` no encontró errores de whitespace; mostró únicamente avisos CRLF/LF del checkout.

## Límites actuales

- No existen todavía casos gold reales adjudicados suficientes para certificar los 26 agentes.
- No se ha ejecutado certificación real del juez ni desplegado la aplicación.
- El runner de evaluación candidate-pinned todavía no está conectado al flujo operativo; por seguridad no hay promoción certificada.
- `AI_JUDGE_MODE` permanece apagado. Una certificación fallida consume el holdout; repetir exige una versión nueva del dataset.
## Endurecimiento de pinning por caso (10-oct-2026)

El proveedor de evaluación live ahora devuelve por cada caso el código del agente realmente ejecutado, el ID de versión y la huella del candidato. El runner compara esos valores con el manifiesto capturado antes de ejecutar; si faltan o difieren, el caso falla y la suite no puede ser elegible para release. La evidencia persistida incluye además el split del caso (`gold`/`holdout`/`smoke`).

- Migraciones `20261215150000_agent_release_requires_executed_candidate_pin.sql` y `20261215160000_agent_release_verify_candidate_cases.sql` aplicadas en TEST (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`).
- SQL read-only confirma en ambos entornos el requisito de pinning, validación por caso de código/versión/hash, split y trigger de activación.
- Probe negativo transaccional en ambos: activar versión sin evidencia completa falla con `check_violation`; la versión sigue inactiva.
- AI build y pruebas live: 9/9; runner API: 10/10; typecheck API correcto.

Sigue pendiente conectar un proveedor candidate-pinned operativo y cargar gold/holdout humanos reales. La DB cierra la promoción sin evidencia falsamente atribuida, pero esto no certifica la calidad semántica ni habilita el rollout.
## Readiness visible de candidatas (10-oct-2026)

El endpoint que alimenta el panel de versiones ya no deriva `can_promote` solo de estados `passed`. Comprueba la huella de release vigente y `release_eligible`; para live valida pinning, código/versión/hash en cada caso y mínimos gold/holdout. Así, los registros históricos o incompletos no muestran una acción de activación habilitada antes de que el gate SQL la rechace. La decisión final sigue en la base de datos. Pruebas de release admin: 4/4; typecheck API y `git diff --check` correctos.
## Preflight de migraciones de release (10-oct-2026)

`db:push` ahora detecta migraciones que activan `agent_versions` directamente y, antes de ejecutarlas, verifica contra la base destino que el trigger está habilitado, que la función de evidencia valida pinning/código/versión/hash/holdout y que `promote_agent_version` usa ese gate. `scripts/verify.mjs` incorpora una guarda estática: migraciones posteriores al baseline candidate-pinned no pueden activar versiones con DML directo; deben usar la RPC protegida. La detección ignora comentarios, strings SQL y el cuerpo de funciones, y revisa bloques DO.

Verificación: 5/5 pruebas del preflight; guarda aplicada a 498 migraciones existentes; sintaxis de los scripts y `git diff --check` correctos. Este control cubre `db:push` del repositorio y `npm run verify`; el trigger SQL continúa siendo la protección efectiva ante otras rutas privilegiadas. No se cambió el estado de las bases en esta entrega. Falta incorporar el preflight en el CI/deploy real y demostrar que todas las rutas de despliegue lo ejecutan.
## Verificación general del repositorio y reparaciones (10-oct-2026)

La primera pasada de `npm run verify` encontró cuatro fallos. Se corrigieron: la clasificación service-only de tablas privadas del juez y checkpoints de campañas; el inventario de pruebas API (las suites que requieren configuración Supabase se asignaron a `test:remote`); dos falsos positivos de idempotencia con firmas `RETURNS TABLE` que no cambian; y el checker de Markdown, que intentaba leer como archivo los enlaces válidos a directorios.

Resultado final: `npm run verify` con 18/18 guardas en verde. Las 10 pruebas locales incorporadas al inventario pasan 37/37; el test de rutas anónimas con configuración remota está registrado en `test:remote`, no ejecutado en esta pasada. Cobertura RLS: 315/315 tablas habilitadas, 27 clasificadas service-only. Idempotencia: 498 migraciones comprobadas. No se aplicaron migraciones ni se modificaron datos remotos en este turno.
## CI automático de calidad del juez (10-oct-2026)

Se añadió `.github/workflows/quality-gates.yml`, que corre en cada `pull_request` y `push` con Node 24 y `npm ci`. Ejecuta `npm run verify` (incluye la guarda estática de migraciones), build de paquetes compartidos y API, pruebas completas de AI, `test:unit` de API y cinco pruebas del preflight de migraciones. El YAML se parseó y se ejecutaron en local los mismos pasos: builds correctos, AI correcto, API 1.071/1.071 y preflight 5/5; `npm run verify` pasó 18/18 guardas.

El workflow no necesita secretos. La prueba de rutas remotas sigue en `test:remote` y no forma parte de este job. La consulta del estado del gate SQL ocurre en `db:push` cuando se aplica una migración candidata; este CI no promueve agentes ni despliega a producción. Faltan conectar el workflow a cualquier pipeline de despliegue existente y completar el provider y los conjuntos gold/holdout.

## Revalidación del repositorio (10-oct-2026)

En la revisión posterior a la incorporación del broker de replay: `npm run verify` pasó **19/19 guardas**. La suite dirigida de dataset, feedback, runtime, admin, fixtures y replay pasó **35/35**. La verificación cubre validaciones locales y estáticas; no ejecuta casos contra un proveedor live ni altera bases remotas. El broker reproduce exclusivamente respuestas fixture y no constituye todavía un runner candidate-pinned operativo. En consecuencia, siguen pendientes la integración end-to-end, los gold/holdout humanos, la certificación real y cualquier activación/despliegue.

## Runner candidato integrado — 10-oct-2026

La ejecución candidate-pinned ya está conectada en código y en el panel de fixtures. `POST /v1/admin/agent-release-eval-fixtures/run` exige `platform_admin`, carga los fixtures inmutables seleccionados y verifica agente, rúbrica y dataset antes de ejecutar. El panel permite elegir versión candidata y fixtures del mismo agente, ejecutar la suite y ver el resultado por caso, coste, latencia y elegibilidad.

El proveedor vuelve a comprobar el manifiesto/prompt fijado, usa el modelo y prompt de la versión exacta y únicamente declara herramientas que tienen replay. El candidato recibe parámetros, alcance y fuentes disponibles; no recibe constraints, grabaciones ni resultados esperados. Una discrepancia en argumentos, orden, hash o llamadas omitidas hace que el caso no pueda aprobar. Se rechaza el modelo sin precio conocido antes de llamar al proveedor y se limita cada turno candidato a 0,25 USD y cada juicio a 0,03 USD.

Los contratos especializados v3 (incluidos A19 arquitecto y revisión) y los casos visuales sin bytes/render final quedan `no_evaluable`; no se presentan como aprobados. La suite de release necesita 10 casos de calibración y 3 de release por agente y no declara elegibilidad con una muestra menor. Esto deja 20 agentes de contrato v1 con ejecución textual disponible; la certificación de todo el catálogo sigue pendiente de soporte específico para los contratos v3, evidencia multimodal vinculada y datos gold/holdout humanos adjudicados.

Verificación local: `npm run verify` 19/19; paquete AI 252/252; API `test:unit` 1.091/1.091; typecheck API y web; build API; `git diff --check`. El test de proveedor cubre schema no soportado, cambio de huella, agente visual sin bytes y que el candidato no ve información de evaluación. El panel muestra la elegibilidad de la evaluación; la promoción continúa bajo el gate SQL.

No se ejecutó una campaña contra un candidato real, no se desplegó el código, no se activó `AI_JUDGE_MODE` y no se aplicaron migraciones en esta verificación. Los datos gold/holdout existentes siguen siendo insuficientes para certificar agentes.