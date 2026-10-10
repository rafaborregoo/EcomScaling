# Estado de implementaciÃƒÂ³n del juez

**Actualizado:** 10 de octubre de 2026

## Gate de activaciÃƒÂ³n implementado

- El runner offline acepta IDs explÃƒÂ­citos de versiones candidatas inactivas, valida que todas existan y persiste evidencia por versiÃƒÂ³n. Los IDs ausentes fallan antes de escribir resultados.
- `agent_versions` tiene un trigger que impide activar una candidata si no hay evidencia `passed` offline y live para el mismo ID, cÃƒÂ³digo de agente y dataset vigente (`2026-09-29.v2`).
- `public.promote_agent_version(uuid)` desactiva la versiÃƒÂ³n anterior y activa la candidata en una operaciÃƒÂ³n transaccional. Si falla la validaciÃƒÂ³n, conserva la versiÃƒÂ³n anterior.
- La migraciÃƒÂ³n estÃƒÂ¡ aplicada en TEST y producciÃƒÂ³n. En ambos entornos: trigger instalado; `authenticated` no puede ejecutar la promociÃƒÂ³n; `service_role` sÃƒÂ­.
- Prueba funcional en TEST y producciÃƒÂ³n: rechazo sin evidencia tanto por RPC como por `UPDATE` directo, promociÃƒÂ³n y regreso a la versiÃƒÂ³n anterior usando filas fixture offline/live. Los fixtures se eliminaron; esto valida el enforcement transaccional, no la calidad de evaluaciones reales.

## VerificaciÃƒÂ³n local

- `apps/api/src/agent-eval-runner.test.ts`: 6/6 pruebas correctas, incluida candidata inactiva y rechazo de IDs inexistentes o fuera del catÃƒÂ¡logo.
- El panel de AdministraciÃƒÂ³n de agentes lista versiones del catÃƒÂ¡logo activo, muestra offline/live por versiÃƒÂ³n, permite ejecutar la evaluaciÃƒÂ³n offline y solo habilita promociÃƒÂ³n cuando ambas constan aprobadas.
- API de candidatas, evaluaciÃƒÂ³n offline y promociÃƒÂ³n restringidas a `platform_admin`; errores de evidencia de promociÃƒÂ³n se devuelven como conflicto y no cambian la versiÃƒÂ³n activa.
- `apps/api/src/agent-release-admin.test.ts` y runner: 8/8 pruebas correctas sobre estado visible y disponibilidad de promociÃƒÂ³n.
- E2E con API/Fastify y Supabase TEST: 2/2 pruebas correctas; peticiÃƒÂ³n anÃƒÂ³nima recibe 401 y un consultor con membership real recibe 403 al listar, evaluar o promover. El usuario, organizaciÃƒÂ³n y suscripciÃƒÂ³n de prueba se eliminaron; verificaciÃƒÂ³n posterior: cero filas sobrantes.
- Comando reproducible aislado: `npm run test:remote:agent-release -w @e-nora/api`, protegido por `run-remote-tests.mjs` para no apuntar a producciÃƒÂ³n.
- Typechecks de API y web, build de API y build de producciÃƒÂ³n web correctos. El build web necesitÃƒÂ³ cargar `.env.local` del monorepo, ya que el `.env.local` de la app web no define las variables pÃƒÂºblicas de Supabase.

## Pendientes para la certificaciÃƒÂ³n final

El gate actual cierra la activaciÃƒÂ³n sin evaluaciÃƒÂ³n offline/live, pero no certifica la calidad semÃƒÂ¡ntica del juez. TEST y producciÃƒÂ³n aÃƒÂºn no tienen evaluaciones reales de candidatas. Usa el resumen mutable `agent_version_evaluations` y aÃƒÂºn no exige hash del build, gold/holdout adjudicado, umbrales de calibraciÃƒÂ³n ni doble aprobaciÃƒÂ³n. La interfaz aÃƒÂºn no ejecuta la evaluaciÃƒÂ³n live con el runtime y contrato reales de cada agente; por eso la promociÃƒÂ³n aparece bloqueada hasta que se conecte ese runner.

La siguiente fase debe implementar el expediente append-only por build que define el [plan del juez](./PLAN_JUEZ_AGENTES.md), aÃƒÂ±adir esas validaciones al gate y probar el recorrido completo desde preparaciÃƒÂ³n de candidata hasta promociÃƒÂ³n y rollback.

## CorrecciÃƒÂ³n de alcance del gate (10-oct-2026)

- La matriz offline existente comprueba contratos generales del catÃƒÂ¡logo y no ejecuta el prompt, modelo ni allowlist de herramientas de la candidata. Sus resultados ahora se persisten como `incomplete`, con `scope: catalog_contract_smoke` y `release_eligible: false`; aunque los checks deterministas pasen, no pueden habilitar el trigger de activaciÃƒÂ³n.
- El ÃƒÂºnico caso live por defecto comprueba abstenciÃƒÂ³n ante ausencia de datos. Ahora tambiÃƒÂ©n se registra `incomplete` (`scope: single_missing_data_smoke`, `release_eligible: false`).
- El panel informa que esa prueba no certifica la candidata y explica quÃƒÂ© falta.
- Esto cierra el falso positivo de presentar un smoke como certificaciÃƒÂ³n. No implementa todavÃƒÂ­a el runner candidate-pinned ni la suite gold/holdout; por tanto, las promociones nuevas quedan bloqueadas hasta contar con esa evidencia real.

ActualizaciÃƒÂ³n de la correcciÃƒÂ³n (10-oct-2026): la suite live solo se considera completa con al menos 10 casos adjudicados `gold` y 3 `holdout` para el agente evaluado. Los casos sin clasificaciÃƒÂ³n o marcados `smoke` no cuentan; el runner guarda sus recuentos y status `incomplete`. El panel muestra el requisito cuando offline o live estÃƒÂ¡ incompleto.

## Huella de release (10-oct-2026)

- Nueva migraciÃƒÂ³n `20261213100000_agent_release_manifest_fingerprint.sql` aplicada a TEST (`kopcblejsxpkxoykldyh`) y producciÃƒÂ³n (`cthjwpeygpzwdmjkxeqa`).
- `capture_agent_version_release_manifest(uuid)` fija SHA-256 del contenido exacto del prompt y del manifiesto que incluye versiÃƒÂ³n/cÃƒÂ³digo, modelo, herramientas permitidas, esquema de salida, aprobaciÃƒÂ³n y configuraciÃƒÂ³n.
- Tras fijar el manifiesto, la base de datos rechaza editar o eliminar el prompt referenciado, cambiar la configuraciÃƒÂ³n del agente, registrar una evaluaciÃƒÂ³n aprobada con una huella distinta o promover sin evidencia enlazada a esa huella. La captura requiere service role; `anon` y `authenticated` no tienen permiso de lectura ni ejecuciÃƒÂ³n.
- TEST: transacciÃƒÂ³n de verificaciÃƒÂ³n cubriÃƒÂ³ captura, rechazo de cambios a la versiÃƒÂ³n y prompt, rechazo de fingerprint falso y gate cerrado sin resultados; `ROLLBACK` verificado con 0 versiones, prompts o manifiestos fixture restantes. TEST y producciÃƒÂ³n muestran la tabla y RPC presentes; ambos tienen 0 candidatos fijados.
- El runner live captura la huella antes de ejecutar y la adjunta a la evaluaciÃƒÂ³n. El offline actual continÃƒÂºa como smoke incompleto y no fija versiones.
- Sigue pendiente ejecutar la versiÃƒÂ³n candidata de cada agente contra su suite live y conectar esa evaluaciÃƒÂ³n a su promociÃƒÂ³n. El flujo aÃƒÂ±adido en 2026-10-10 calibra el modelo juez con holdout y guarda sus informes, pero no reemplaza ese gate de versiones de agentes.

## Readiness de evaluaciones tras fijar huellas (10-oct-2026)

`getAgentEvalReadinessFromClient` ya no considera suficiente un registro `passed` en la versiÃƒÂ³n activa. Para marcar cobertura release exige `release_eligible`, fingerprint SHA-256 coincidente con el manifiesto actualmente unido a `agent_versions` y, en live, al menos 10 casos gold y 3 holdout. Las evaluaciones histÃƒÂ³ricas sin esa evidencia dejan de aparecer como verificadas. Pruebas: 8/8 en `agent-eval-readiness.test.ts`, incluidos el rechazo de un smoke histÃƒÂ³rico y el caso completo de 26 cÃƒÂ³digos; typecheck de API y AI correctos.

## Puntuacion humana de referencia (10-oct-2026)

La revision por criterio permite guardar `evaluable` con puntuacion 0-4 o `no_evaluable` con puntuacion nula. La migracion `20261214100000_agent_judgment_feedback_corrections.sql` esta aplicada en TEST (`kopcblejsxpkxoykldyh`) y produccion (`cthjwpeygpzwdmjkxeqa`). La RPC conserva autorizacion por rol, scoping run/organizacion, idempotencia, y la tabla mantiene RLS sin acceso directo de `authenticated`/`anon` y escritura append-only.

La traza muestra selector para anotar estado y puntuacion corregida; API y SQL rechazan puntuaciones fuera de rango, ausencia de puntuacion evaluable, puntuacion en `no_evaluable` y correcciones fuera del decision `corrected`. E2E en TEST: envio autenticado devuelve 201, replay idempotente devuelve el mismo ID, payload incompleto devuelve 400, y no quedan filas fixture tras la limpieza. El feedback de produccion sigue separado de los gold labels del dataset ciego implementado el 2026-10-10.

La migracion `20261214110000_agent_judgment_feedback_rpc_compat.sql` conserva argumentos finales opcionales en la RPC para clientes API anteriores al despliegue. TEST confirmo envio nuevo (10 argumentos efectivos) y llamada anterior (8 argumentos) con persistencia; ambas migraciones de feedback estan aplicadas en TEST y produccion. En ambos proyectos: `anon` no ejecuta la RPC, `authenticated` solo puede ejecutarla pasando las validaciones de seguridad definer, no puede leer directamente la tabla, `service_role` puede leerla y RLS permanece activo.
## 2026-10-10 Ã‚Â· Dataset ciego para calibraciÃƒÂ³n humana

Implementado en cÃƒÂ³digo:

- Panel en `/admin/agentes` para aÃƒÂ±adir casos y etiquetar por criterio; la cola nunca devuelve etiquetas previas ni resultados del juez.
- Casos de desarrollo sintÃƒÂ©ticos separados de calibraciÃƒÂ³n/holdout, que solo aceptan procedencia de producciÃƒÂ³n con declaraciÃƒÂ³n de revisiÃƒÂ³n de privacidad.
- Dos revisiones independientes como mÃƒÂ¡ximo por caso; quien crea un caso no puede revisarlo; la adjudicaciÃƒÂ³n la hace una tercera persona.
- ValidaciÃƒÂ³n completa de rÃƒÂºbrica, puntuaciÃƒÂ³n, fallos crÃƒÂ­ticos y referencias que resuelven contra la evidencia o salida guardada.
- ExportaciÃƒÂ³n API solo de holdout anonimizado con dos revisiones y adjudicaciÃƒÂ³n terminada, en la forma que consume el calibrador.
- EjecuciÃƒÂ³n del modelo juez configurado sobre el holdout desde el panel, con tope de 0,03 USD por caso, lÃƒÂ­mite total indicado por el administrador y resultados agregados por agente.
- Informe append-only con modelo, dataset, coste y mÃƒÂ©tricas; el gate exige al menos 3 casos por agente, acuerdo de estado >=85 %, puntuaciÃƒÂ³n a una distancia <=1 en >=90 %, recall crÃƒÂ­tico del 100 % y falsos crÃƒÂ­ticos <=5 %.
- Los agentes visuales solo se evalÃƒÂºan si el caso incluye `evidence.visual_images` con bytes validados; si falta imagen, el caso queda no evaluable y el gate no pasa.
- Huella de contenido transversal a versiones y divisiones para evitar duplicar el mismo caso entre desarrollo y holdout.

Persistencia y seguridad:

- MigraciÃƒÂ³n `20261215100000_agent_judge_blind_dataset` aplicada en test y producciÃƒÂ³n.
- MigraciÃƒÂ³n `20261215110000_agent_judge_calibration_runs` aplicada en test y producciÃƒÂ³n.
- Tablas append-only con lÃƒÂ­mites y validaciones en base de datos, RLS activado y permisos directos revocados para `anon` y `authenticated`.
- El endpoint requiere `platform_admin`; el servicio usa credenciales de servidor despuÃƒÂ©s de resolver la identidad.

VerificaciÃƒÂ³n hecha el 2026-10-10:

- Typecheck de API y web: correcto.
- Pruebas del dataset ciego, feedback, runtime del juez y calibrador: 30/30 correctas; pruebas de API sin sesiÃƒÂ³n: 2/2 rechazan la peticiÃƒÂ³n (32 en total).
- Builds de API y web: correctos. La web se compilÃƒÂ³ con variables Supabase temporales de build, sin persistirlas ni contactar con esos valores.
- Las rutas remotas de mutaciÃƒÂ³n no se ejecutaron: el guard del runner rechazÃƒÂ³ `.env.local` porque no apunta a un proyecto de test aislado. No se intentÃƒÂ³ ejecutar contra producciÃƒÂ³n.
- RLS y grants comprobados directamente en ambos proyectos. Los avisos de Supabase sobre tablas RLS sin polÃƒÂ­ticas reflejan el acceso exclusivo por servicio/API; no se concedieron polÃƒÂ­ticas directas.
- La suite remota de mutaciÃƒÂ³n sigue protegida por el runner y se negÃƒÂ³ a ejecutarse porque `.env.local` no identifica un proyecto de test aislado; no se usÃƒÂ³ producciÃƒÂ³n para probar escrituras.

Estado de salida:

- La preparaciÃƒÂ³n de datasets, etiquetado ciego, API, persistencia, ejecuciÃƒÂ³n de calibraciÃƒÂ³n con coste acotado y mÃƒÂ©tricas por agente ya estÃƒÂ¡n conectados.
- No se ejecutÃƒÂ³ una calibraciÃƒÂ³n real: requiere casos gold anonimizados para los 26 agentes y consume llamadas de modelo.
- El modo del juez sigue apagado por defecto (`AI_JUDGE_MODE=off`) y la aplicaciÃƒÂ³n no se ha desplegado. Antes de activarlo hay que cargar casos gold suficientes para los 26 agentes y superar el holdout con el modelo candidato; activar el juez sin ese conjunto no demuestra calidad ni autoriza su salida visible.

## Cierre de brecha de holdout y gate del juez (10-oct-2026)

- La cola ciega filtra por `dataset_version` ademÃƒÂ¡s de split; las versiones no se mezclan en revisiÃƒÂ³n.
- `freeze_agent_judge_holdout` valida que cada caso holdout tenga procedencia anonimizada, revisiÃƒÂ³n de privacidad, dos revisores distintos y adjudicador independiente. Genera una huella SHA-256 de casos y etiquetas. Un advisory lock cubre inserciones concurrentes; despuÃƒÂ©s del congelado no se pueden aÃƒÂ±adir ni modificar casos, revisiones o adjudicaciones. Los cambios requieren una versiÃƒÂ³n nueva del dataset.
- La promociÃƒÂ³n de una versiÃƒÂ³n de agente exige ademÃƒÂ¡s una calibraciÃƒÂ³n aprobada del juez enlazada a la huella congelada. El panel de candidatas muestra este requisito como gate independiente de offline/live.
- MigraciÃƒÂ³n `20261215120000_agent_judge_holdout_freeze_release_gate.sql` aplicada en TEST (`kopcblejsxpkxoykldyh`) y producciÃƒÂ³n (`cthjwpeygpzwdmjkxeqa`). VerificaciÃƒÂ³n SQL en ambos: tabla y triggers presentes; `anon` sin EXECUTE; `service_role` con EXECUTE; la funciÃƒÂ³n de promociÃƒÂ³n contiene el requisito de calibraciÃƒÂ³n.
- API y web typecheck: correctos. Pruebas dirigidas de runner/dataset/release admin: 16/16; rutas anÃƒÂ³nimas del dataset: 2/2 con 401. `git diff --check`: correcto, con aviso de conversiÃƒÂ³n de finales de lÃƒÂ­nea en `server.ts`.

### Lo que todavÃƒÂ­a impide certificar todas las versiones

La calibraciÃƒÂ³n mide si el juez coincide con etiquetas humanas; no ejecuta por sÃƒÂ­ sola un candidato de agente. El runner offline sigue siendo un smoke de contratos y se persiste como `incomplete`. El runner live existe como contrato invocable, pero no estÃƒÂ¡ conectado a una ruta que cargue el contexto gold/holdout versionado y ejecute la configuraciÃƒÂ³n exacta de cada candidato con sus herramientas. Por ello el gate falla de forma segura y el panel no habilita la activaciÃƒÂ³n. Tampoco hay un holdout real completo para los 26 agentes ni una ejecuciÃƒÂ³n pagada del modelo juez. No se activÃƒÂ³ `AI_JUDGE_MODE` ni se desplegÃƒÂ³ el cÃƒÂ³digo; hacerlo sin esas pruebas mostrarÃƒÂ­a juicios no calibrados.

Para llegar al estado final falta construir ese runner candidate-pinned por agente (contexto y conectores aislados, artefacto reproducible, juez sobre la salida y evidencia de coste/latencia), poblar y doble etiquetar gold/holdout, probar cada una de las 26 rÃƒÂºbricas y despuÃƒÂ©s activar el despliegue gradual. Si falta fuente, snapshot, recibo, imagen o caso gold, el resultado debe ser Ã¢â‚¬Å“no evaluableÃ¢â‚¬Â, nunca una puntuaciÃƒÂ³n aprobatoria.
## CertificaciÃƒÂ³n del juez: holdout de un solo uso (10-oct-2026)

- TEST y producciÃƒÂ³n tienen `agent_judge_holdout_claims`: la restricciÃƒÂ³n ÃƒÂºnica bloquea una segunda consulta del mismo holdout y rÃƒÂºbrica, incluso si se intenta cambiar el modelo. La llamada solo estÃƒÂ¡ permitida a `service_role`; anon/authenticated no pueden reservarla.
- API de administraciÃƒÂ³n muestra si el dataset estÃƒÂ¡ congelado, cuÃƒÂ¡ntos casos holdout contiene, si ya se consumiÃƒÂ³ y el estado del informe. La UI advierte sobre la ejecuciÃƒÂ³n ÃƒÂºnica, confirma coste mÃƒÂ¡ximo y deshabilita nuevas altas/revisiones tras congelar.
- MigraciÃƒÂ³n `20261215130000_agent_judge_holdout_single_use.sql` aplicada y comprobada en TEST y producciÃƒÂ³n: tabla, ÃƒÂ­ndice ÃƒÂºnico y permisos correctos; duplicado rechazado por RPC.
- Typecheck API/web correctos; pruebas especÃƒÂ­ficas de dataset, runner, runtime y release admin: 17/17; API anÃƒÂ³nima: 2/2 con 401, incluida la nueva ruta de estado.
- La calibraciÃƒÂ³n real sigue sin ejecutarse: no hay 3 casos gold adjudicados por agente para los 26 agentes. El intento de certificaciÃƒÂ³n consume el holdout aunque falle el proveedor; el panel conserva el estado y evita reintentos que filtrarÃƒÂ­an resultados.
## Pinning de ejecuciÃƒÂ³n por caso (10-oct-2026)

El contrato live exige atestaciÃƒÂ³n del candidato efectivamente ejecutado (cÃƒÂ³digo, ID de versiÃƒÂ³n y fingerprint) en cada caso. La suite compara esos valores con el manifiesto capturado; un campo ausente o distinto invalida la elegibilidad. La evidencia incluye `dataset_split`, y la funciÃƒÂ³n de promociÃƒÂ³n comprueba los casos persistidos contra el artefacto de release.

Las migraciones `20261215150000_agent_release_requires_executed_candidate_pin.sql` y `20261215160000_agent_release_verify_candidate_cases.sql` estÃƒÂ¡n aplicadas en TEST y producciÃƒÂ³n. La prueba negativa en ambos entornos confirma rechazo al activar sin evidencia y mantiene inactiva la versiÃƒÂ³n. VerificaciÃƒÂ³n: AI live 9/9, runner API 10/10, typecheck API correcto.

El provider real aÃƒÂºn no estÃƒÂ¡ conectado y no hay gold/holdout adjudicado completo. Hasta entonces el gate permanece cerrado y no existe certificaciÃƒÂ³n semÃƒÂ¡ntica.
## Readiness visible de candidatas (10-oct-2026)

El endpoint que alimenta el panel de versiones ya no deriva `can_promote` solo de estados `passed`. Comprueba la huella de release vigente y `release_eligible`; para live valida pinning, cÃƒÂ³digo/versiÃƒÂ³n/hash en cada caso y mÃƒÂ­nimos gold/holdout. AsÃƒÂ­, los registros histÃƒÂ³ricos o incompletos no muestran una acciÃƒÂ³n de activaciÃƒÂ³n habilitada antes de que el gate SQL la rechace. La decisiÃƒÂ³n final sigue en la base de datos. Pruebas de release admin: 4/4; typecheck API y `git diff --check` correctos.
## Preflight de migraciones de release (10-oct-2026)

`db:push` ahora detecta migraciones que activan `agent_versions` directamente y, antes de ejecutarlas, verifica contra la base destino que el trigger estÃƒÂ¡ habilitado, que la funciÃƒÂ³n de evidencia valida pinning/cÃƒÂ³digo/versiÃƒÂ³n/hash/holdout y que `promote_agent_version` usa ese gate. `scripts/verify.mjs` incorpora una guarda estÃƒÂ¡tica: migraciones posteriores al baseline candidate-pinned no pueden activar versiones con DML directo; deben usar la RPC protegida. La detecciÃƒÂ³n ignora comentarios, strings SQL y el cuerpo de funciones, y revisa bloques DO.

VerificaciÃƒÂ³n: 5/5 pruebas del preflight; guarda aplicada a 498 migraciones existentes; sintaxis de los scripts y `git diff --check` correctos. Este control cubre `db:push` del repositorio y `npm run verify`; el trigger SQL continÃƒÂºa siendo la protecciÃƒÂ³n efectiva ante otras rutas privilegiadas. No se cambiÃƒÂ³ el estado de las bases en esta entrega. Falta incorporar el preflight en el CI/deploy real y demostrar que todas las rutas de despliegue lo ejecutan.
## VerificaciÃƒÂ³n general del repositorio y reparaciones (10-oct-2026)

La primera pasada de `npm run verify` encontrÃƒÂ³ cuatro fallos. Se corrigieron: la clasificaciÃƒÂ³n service-only de tablas privadas del juez y checkpoints de campaÃƒÂ±as; el inventario de pruebas API (las suites que requieren configuraciÃƒÂ³n Supabase se asignaron a `test:remote`); dos falsos positivos de idempotencia con firmas `RETURNS TABLE` que no cambian; y el checker de Markdown, que intentaba leer como archivo los enlaces vÃƒÂ¡lidos a directorios.

Resultado final: `npm run verify` con 18/18 guardas en verde. Las 10 pruebas locales incorporadas al inventario pasan 37/37; el test de rutas anÃƒÂ³nimas con configuraciÃƒÂ³n remota estÃƒÂ¡ registrado en `test:remote`, no ejecutado en esta pasada. Cobertura RLS: 315/315 tablas habilitadas, 27 clasificadas service-only. Idempotencia: 498 migraciones comprobadas. No se aplicaron migraciones ni se modificaron datos remotos en este turno.
## CI automÃƒÂ¡tico de calidad del juez (10-oct-2026)

Se aÃƒÂ±adiÃƒÂ³ `.github/workflows/quality-gates.yml`, que corre en cada `pull_request` y `push` con Node 24 y `npm ci`. Ejecuta `npm run verify` (incluye la guarda estÃƒÂ¡tica de migraciones), build de paquetes compartidos y API, pruebas completas de AI, `test:unit` de API y cinco pruebas del preflight de migraciones. El YAML se parseÃƒÂ³ y se ejecutaron en local los mismos pasos: builds correctos, AI correcto, API 1.071/1.071 y preflight 5/5; `npm run verify` pasÃƒÂ³ 18/18 guardas.

El workflow no necesita secretos. La prueba de rutas remotas sigue en `test:remote` y no forma parte de este job. La consulta del estado del gate SQL ocurre en `db:push` cuando se aplica una migraciÃƒÂ³n candidata; este CI no promueve agentes ni despliega a producciÃƒÂ³n. Faltan conectar el workflow a cualquier pipeline de despliegue existente y completar el provider y los conjuntos gold/holdout.

## Muestra estadistica del juez (10-oct-2026)

Se cerro la brecha del holdout pequeno: certificar requiere 50 casos adjudicados por cada uno de los 26 agentes, con al menos 10 casos criticos positivos y 10 negativos. Los gates exigen 92% de acuerdo de estado, 95% de puntuaciones dentro de un punto, recall critico del 100% y falsos criticos de hasta 2%. La cola pagina datasets de hasta 5.000 casos. Cada ejecucion se limita a 1.666 casos para mantener el coste maximo previsto por debajo de 50 USD; conserva el coste real y aplica el tope configurado.

La cola humana ahora pagina de 100 en 100. El panel muestra por agente los casos adjudicados y la cobertura critica; no deja congelar el holdout desde la interfaz si falta muestra. La base de datos tambien rechaza el freeze si falta cualquiera de los minimos, incluso si se omite la UI.

Migraciones `20261215170000_agent_judge_calibration_sample_floor.sql` y `20261215180000_agent_judge_holdout_coverage.sql` aplicadas en TEST y produccion. Se comprobo que el trigger esta activo y que la funcion de cobertura devuelve los 26 agentes en ambos entornos.

Verificacion: AI 248/248; API unit 1.071/1.071; typecheck API y web; `npm run verify` 18/18 guardas. El holdout real sigue sin estar certificado: se necesitan casos de produccion anonimizados, dos revisores independientes y adjudicacion para completar la muestra por agente. El juez sigue fuera del gate de promocion hasta completar esos datos y ejecutar la certificacion final.


Estado del dataset desplegado al cierre: judge-gold-v1 contiene 0 casos holdout en TEST y produccion; 0/26 agentes alcanzan la muestra. Por tanto, el sistema bloquea la certificacion y no se ha consumido el holdout.

## Consistencia entre fallo critico y puntuacion (10-oct-2026)
`finalizeAgentJudgeResult` rechaza ahora como invÃ¡lida cualquier etiqueta `critical_failure=true` si el criterio no es evaluable o tiene score mayor que 1. Antes esa contradicciÃ³n podÃ­a convertir una puntuaciÃ³n 3/4 en bloqueo. La regla coincide con validaciÃ³n de etiquetas gold y queda cubierta con regresiÃ³n para score alto y no evaluable.


## Lease de cola alineado con reintentos (10-oct-2026)

El lease del worker pasa de 120 a 240 segundos. El timeout por intento del proveedor es 45 segundos y el runtime permite dos reintentos internos; 240 segundos deja margen sobre ese mÃ¡ximo y las lecturas/persistencias del trabajo. La prueba del worker comprueba que envÃ­a 240 segundos a `claim_agent_judge_jobs`, cuya RPC permite hasta 600. Esto reduce el riesgo de que otra instancia reclame un job aÃºn activo.

## Visibilidad del runtime en administracion (10-oct-2026)

El estado protegido del dataset incluye modo del juez, modelo configurado y readiness del proveedor, sin exponer credenciales. El panel diferencia `off`, `shadow` y `visible`; si el runtime esta apagado indica la variable necesaria para empezar shadow y si falta clave/precio muestra el error de configuracion. La prueba confirma modos, readiness y ausencia de secretos en la serializacion. Esto evita confundir una calibracion del dataset con un runtime activo; no cambia el modo del servicio ni habilita ejecuciones por si solo.

## Dictamen obligatorio por salida de candidata (10-oct-2026)

La suite live ya no puede contar como aprobada solo por abstencion y contrato de evidencia. Cada salida de candidata debe incluir el resultado `passed` recomputado contra la rubrica del agente, version `judge-rubrics-v1`, puntuacion minima 3,2 y SHA-256 del output exacto; el runner compara el hash antes de marcar el caso aprobado. La API de release y el gate SQL comprueban esos campos en todos los casos gold/holdout. Migracion `20261216100000_agent_release_requires_candidate_judgment.sql` aplicada en TEST y produccion; `scripts/verify-agent-judge-release-gate.mjs` confirma definicion y registro de migracion en ambos proyectos. No hay provider productivo de ejecucion candidata aun; el gate sigue cerrado hasta implementarlo.

## Estado verificado de la implementaciÃ³n (10-oct-2026, actualizaciÃ³n)

- `npm run verify`: **19/19 guardas correctas**. El inventario actual revisa 503 migraciones, 318/318 tablas con RLS y 28 tablas service-only; la cobertura del juez sigue detectando los 26 agentes y sus rÃºbricas.
- Suite local dirigida de dataset ciego, feedback, runtime, admin de candidatas, fixtures de replay y broker: **35/35 pruebas correctas**. Incluye controles de hash, orden y argumentos exactos del replay; llamadas omitidas o fuera del allowlist no se dan por completas.
- El broker de replay es una pieza aislada que solo devuelve resultados capturados y recibos hash; por sÃ­ mismo no ejecuta un candidato ni permite certificarlo.
- Sigue sin estar verificado un recorrido candidate-pinned de extremo a extremo: proveedor que carga la versiÃ³n exacta, ejecuta el contrato de salida real, reproduce todas las herramientas del fixture, invoca al juez, persiste casos gold/holdout y compara el manifiesto antes/despuÃ©s. Tampoco hay holdout humano suficiente: 0 casos en `judge-gold-v1` y 0/26 agentes con muestra certificable segÃºn la comprobaciÃ³n documentada arriba.
- El gate de promociÃ³n permanece cerrado y `AI_JUDGE_MODE` apagado. El resultado de estas pruebas es calidad de cÃ³digo/controles, no certificaciÃ³n semÃ¡ntica, despliegue ni autorizaciÃ³n para activar el juez.

Los resultados de esta actualizaciÃ³n son locales; no se ejecutaron mutaciones remotas ni se aplicaron migraciones en esta comprobaciÃ³n.

## Runner candidato integrado â€” 10-oct-2026

La ejecuciÃ³n candidate-pinned ya estÃ¡ conectada en cÃ³digo y en el panel de fixtures. `POST /v1/admin/agent-release-eval-fixtures/run` exige `platform_admin`, carga los fixtures inmutables seleccionados y verifica agente, rÃºbrica y dataset antes de ejecutar. El panel permite elegir versiÃ³n candidata y fixtures del mismo agente, ejecutar la suite y ver el resultado por caso, coste, latencia y elegibilidad.

El proveedor vuelve a comprobar el manifiesto/prompt fijado, usa el modelo y prompt de la versiÃ³n exacta y Ãºnicamente declara herramientas que tienen replay. El candidato recibe parÃ¡metros, alcance y fuentes disponibles; no recibe constraints, grabaciones ni resultados esperados. Una discrepancia en argumentos, orden, hash o llamadas omitidas hace que el caso no pueda aprobar. Se rechaza el modelo sin precio conocido antes de llamar al proveedor y se limita cada turno candidato a 0,25 USD y cada juicio a 0,03 USD.

Los contratos especializados v3 (incluidos A19 arquitecto y revisiÃ³n) y los casos visuales sin bytes/render final quedan `no_evaluable`; no se presentan como aprobados. La suite de release necesita 10 casos de calibraciÃ³n y 3 de release por agente y no declara elegibilidad con una muestra menor. Esto deja 20 agentes de contrato v1 con ejecuciÃ³n textual disponible; la certificaciÃ³n de todo el catÃ¡logo sigue pendiente de soporte especÃ­fico para los contratos v3, evidencia multimodal vinculada y datos gold/holdout humanos adjudicados.

VerificaciÃ³n local: `npm run verify` 19/19; paquete AI 252/252; API `test:unit` 1.091/1.091; typecheck API y web; build API; `git diff --check`. El test de proveedor cubre schema no soportado, cambio de huella, agente visual sin bytes y que el candidato no ve informaciÃ³n de evaluaciÃ³n. El panel muestra la elegibilidad de la evaluaciÃ³n; la promociÃ³n continÃºa bajo el gate SQL.

No se ejecutÃ³ una campaÃ±a contra un candidato real, no se desplegÃ³ el cÃ³digo, no se activÃ³ `AI_JUDGE_MODE` y no se aplicaron migraciones en esta verificaciÃ³n. Los datos gold/holdout existentes siguen siendo insuficientes para certificar agentes.
## Holdout release y despliegue de migracion (10-oct-2026)

El runner permitia reutilizar el mismo fixture release entre candidatos. Se incorporo un ledger append-only y un reclamo atomico single-use previo al provider; development/calibration se pueden reejecutar. El test focalizado del runner fue 8/8 antes de cambios concurrentes posteriores.

La migracion 20261218090001_agent_release_eval_holdout_claims.sql esta aplicada en TEST (kopcblejsxpkxoykldyh) y produccion (cthjwpeygpzwdmjkxeqa). En ambos: RLS activo; trigger append-only activo; anon/auth sin SELECT ni EXECUTE; service_role sin INSERT directo y con EXECUTE; tabla vacia. El schema esta listo y la ruta falla cerrado si no puede reclamar.

El apply MCP registro versiones distintas por entorno: TEST 20261010105024; PROD 20261010105122. La migracion listada localmente es 20261218090001. El db push --linked --dry-run de produccion confirmo que ese archivo apareceria como pendiente y se bloqueo porque existen 24 migraciones remotas sin archivo local, incluida la version PROD de este apply. No se ejecuto migration repair ni se edito el historial. Mantener el DDL instalado; no volver a aplicar con db push hasta resolver el drift general mediante el flujo revisado del repositorio.

Validacion de repo: npm run verify 19/19; test:agent-release-preflight 5/5. En el ultimo typecheck y test focalizado aparecio un error concurrente no relacionado en apps/api/src/ai-runtime.ts: importa caminoWeeklyReviewJsonSchema, que no exporta @e-nora/ai (solo caminoWeeklyReviewSchema). El cambio propio de holdout habia pasado typecheck y 8/8 focalizado antes de esa edicion concurrente.
## Estado posterior: cobertura A19 y drift MCP (10-oct-2026)

- A19 Arquitecto ahora selecciona el contrato real `caminoPlanJsonSchema` y su validación por horizonte desde `horizon_months` y `reference_date` congelados en el fixture. La prueba `apps/api/src/agent-release-candidate-eval.test.ts` demuestra selección/fail-closed por falta de datos; aún falta una ejecución real con proveedor candidato.
- A19 Revisión tiene un fixture estricto que exige Camino aprobado/versionado, ventana, snapshot de progreso, fuentes métricas y revisión previa. El provider aún responde `no_evaluable`; no se cuenta como ejecutable hasta integrar `caminoWeeklyReviewSchema` y probarlo.
- Matriz actualizada a **21/26 ejecutables en código** y **5/26 no evaluables** (A19 Revisión y cuatro visuales). Ninguna cifra implica gold/holdout certificado.
- Migración `20261218090001_agent_release_eval_holdout_claims.sql`: MCP la aplicó en TEST y PROD. Se reportan tabla/RLS/trigger append-only, RPC accesible solo por `service_role` y ledger vacío al comprobar. El claim consume un fixture release desde el primer intento.
- El historial sigue con drift: 24 versiones remotas no tienen fichero local. La migración figura como `20261010105024` en TEST y `20261010105122` en PROD, frente al fichero local `20261218090001`. El `db push --linked --dry-run` de PROD confirmó que aparecería pendiente y se bloqueó por ese drift. No se ejecutó repair ni se editó el historial; conservar el DDL aplicado y no reintentar push hasta reconciliar ambas bases.
- Esta revisión solo actualiza documentación. El estado previo de `AI_JUDGE_MODE`, despliegue y certificación no cambia.

## Cierre de implementación de contratos A19 en candidate-runner (10-oct-2026)

La implementación posterior conecta ambos contratos A19: Arquitecto usa `caminoPlanJsonSchema` más `caminoPlanSchemaForHorizon`, exigiendo horizonte y fecha de referencia; Revisión usa `caminoWeeklyReviewJsonSchema` y `caminoWeeklyReviewSchema`, con fixture validado que congela Camino aprobado/versionado, periodo, progreso, estado de tareas/hitos, fuentes métricas y revisión anterior. Por esto se corrige el conteo anterior: **22/26 contratos candidate-pinned soportados**, **4/26 no evaluables** (A15/A16/A23/A26 por evidencia visual). Ninguna de estas pruebas representa certificación con gold/holdout adjudicado.

Verificación tras construir `@e-nora/ai`: `npm run build -w @e-nora/ai` correcto; `npx tsx --test apps/api/src/agent-release-candidate-eval.test.ts apps/api/src/agent-release-eval-fixture.test.ts` correcto, **14/14**; `npm run typecheck -w @e-nora/api` correcto. El primer intento de las suites antes de reconstruir el paquete encontró el `dist` compartido desactualizado; después del build, las suites cargaron y pasaron.

El historial de migraciones del holdout sigue en drift: el `db push --linked --dry-run` de PROD detecta 24 versiones remotas sin fichero local y marca pendiente el identificador local `20261218090001`, pese a la aplicación MCP ya realizada en TEST/PROD bajo identificadores remotos distintos. No se hizo repair ni se volvió a aplicar DDL. La reconciliación queda necesaria antes de volver a usar el flujo de `db push`.
