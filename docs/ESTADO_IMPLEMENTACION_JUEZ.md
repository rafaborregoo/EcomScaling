# Estado de implementaciÃƒÆ’Ã‚Â³n del juez

**Actualizado:** 10 de octubre de 2026

## Gate de activaciÃƒÆ’Ã‚Â³n implementado

- El runner offline acepta IDs explÃƒÆ’Ã‚Â­citos de versiones candidatas inactivas, valida que todas existan y persiste evidencia por versiÃƒÆ’Ã‚Â³n. Los IDs ausentes fallan antes de escribir resultados.
- `agent_versions` tiene un trigger que impide activar una candidata si no hay evidencia `passed` offline y live para el mismo ID, cÃƒÆ’Ã‚Â³digo de agente y dataset vigente (`2026-09-29.v2`).
- `public.promote_agent_version(uuid)` desactiva la versiÃƒÆ’Ã‚Â³n anterior y activa la candidata en una operaciÃƒÆ’Ã‚Â³n transaccional. Si falla la validaciÃƒÆ’Ã‚Â³n, conserva la versiÃƒÆ’Ã‚Â³n anterior.
- La migraciÃƒÆ’Ã‚Â³n estÃƒÆ’Ã‚Â¡ aplicada en TEST y producciÃƒÆ’Ã‚Â³n. En ambos entornos: trigger instalado; `authenticated` no puede ejecutar la promociÃƒÆ’Ã‚Â³n; `service_role` sÃƒÆ’Ã‚Â­.
- Prueba funcional en TEST y producciÃƒÆ’Ã‚Â³n: rechazo sin evidencia tanto por RPC como por `UPDATE` directo, promociÃƒÆ’Ã‚Â³n y regreso a la versiÃƒÆ’Ã‚Â³n anterior usando filas fixture offline/live. Los fixtures se eliminaron; esto valida el enforcement transaccional, no la calidad de evaluaciones reales.

## VerificaciÃƒÆ’Ã‚Â³n local

- `apps/api/src/agent-eval-runner.test.ts`: 6/6 pruebas correctas, incluida candidata inactiva y rechazo de IDs inexistentes o fuera del catÃƒÆ’Ã‚Â¡logo.
- El panel de AdministraciÃƒÆ’Ã‚Â³n de agentes lista versiones del catÃƒÆ’Ã‚Â¡logo activo, muestra offline/live por versiÃƒÆ’Ã‚Â³n, permite ejecutar la evaluaciÃƒÆ’Ã‚Â³n offline y solo habilita promociÃƒÆ’Ã‚Â³n cuando ambas constan aprobadas.
- API de candidatas, evaluaciÃƒÆ’Ã‚Â³n offline y promociÃƒÆ’Ã‚Â³n restringidas a `platform_admin`; errores de evidencia de promociÃƒÆ’Ã‚Â³n se devuelven como conflicto y no cambian la versiÃƒÆ’Ã‚Â³n activa.
- `apps/api/src/agent-release-admin.test.ts` y runner: 8/8 pruebas correctas sobre estado visible y disponibilidad de promociÃƒÆ’Ã‚Â³n.
- E2E con API/Fastify y Supabase TEST: 2/2 pruebas correctas; peticiÃƒÆ’Ã‚Â³n anÃƒÆ’Ã‚Â³nima recibe 401 y un consultor con membership real recibe 403 al listar, evaluar o promover. El usuario, organizaciÃƒÆ’Ã‚Â³n y suscripciÃƒÆ’Ã‚Â³n de prueba se eliminaron; verificaciÃƒÆ’Ã‚Â³n posterior: cero filas sobrantes.
- Comando reproducible aislado: `npm run test:remote:agent-release -w @e-nora/api`, protegido por `run-remote-tests.mjs` para no apuntar a producciÃƒÆ’Ã‚Â³n.
- Typechecks de API y web, build de API y build de producciÃƒÆ’Ã‚Â³n web correctos. El build web necesitÃƒÆ’Ã‚Â³ cargar `.env.local` del monorepo, ya que el `.env.local` de la app web no define las variables pÃƒÆ’Ã‚Âºblicas de Supabase.

## Pendientes para la certificaciÃƒÆ’Ã‚Â³n final

El gate actual cierra la activaciÃƒÆ’Ã‚Â³n sin evaluaciÃƒÆ’Ã‚Â³n offline/live, pero no certifica la calidad semÃƒÆ’Ã‚Â¡ntica del juez. TEST y producciÃƒÆ’Ã‚Â³n aÃƒÆ’Ã‚Âºn no tienen evaluaciones reales de candidatas. Usa el resumen mutable `agent_version_evaluations` y aÃƒÆ’Ã‚Âºn no exige hash del build, gold/holdout adjudicado, umbrales de calibraciÃƒÆ’Ã‚Â³n ni doble aprobaciÃƒÆ’Ã‚Â³n. La interfaz aÃƒÆ’Ã‚Âºn no ejecuta la evaluaciÃƒÆ’Ã‚Â³n live con el runtime y contrato reales de cada agente; por eso la promociÃƒÆ’Ã‚Â³n aparece bloqueada hasta que se conecte ese runner.

La siguiente fase debe implementar el expediente append-only por build que define el [plan del juez](./PLAN_JUEZ_AGENTES.md), aÃƒÆ’Ã‚Â±adir esas validaciones al gate y probar el recorrido completo desde preparaciÃƒÆ’Ã‚Â³n de candidata hasta promociÃƒÆ’Ã‚Â³n y rollback.

## CorrecciÃƒÆ’Ã‚Â³n de alcance del gate (10-oct-2026)

- La matriz offline existente comprueba contratos generales del catÃƒÆ’Ã‚Â¡logo y no ejecuta el prompt, modelo ni allowlist de herramientas de la candidata. Sus resultados ahora se persisten como `incomplete`, con `scope: catalog_contract_smoke` y `release_eligible: false`; aunque los checks deterministas pasen, no pueden habilitar el trigger de activaciÃƒÆ’Ã‚Â³n.
- El ÃƒÆ’Ã‚Âºnico caso live por defecto comprueba abstenciÃƒÆ’Ã‚Â³n ante ausencia de datos. Ahora tambiÃƒÆ’Ã‚Â©n se registra `incomplete` (`scope: single_missing_data_smoke`, `release_eligible: false`).
- El panel informa que esa prueba no certifica la candidata y explica quÃƒÆ’Ã‚Â© falta.
- Esto cierra el falso positivo de presentar un smoke como certificaciÃƒÆ’Ã‚Â³n. No implementa todavÃƒÆ’Ã‚Â­a el runner candidate-pinned ni la suite gold/holdout; por tanto, las promociones nuevas quedan bloqueadas hasta contar con esa evidencia real.

ActualizaciÃƒÆ’Ã‚Â³n de la correcciÃƒÆ’Ã‚Â³n (10-oct-2026): la suite live solo se considera completa con al menos 10 casos adjudicados `gold` y 3 `holdout` para el agente evaluado. Los casos sin clasificaciÃƒÆ’Ã‚Â³n o marcados `smoke` no cuentan; el runner guarda sus recuentos y status `incomplete`. El panel muestra el requisito cuando offline o live estÃƒÆ’Ã‚Â¡ incompleto.

## Huella de release (10-oct-2026)

- Nueva migraciÃƒÆ’Ã‚Â³n `20261213100000_agent_release_manifest_fingerprint.sql` aplicada a TEST (`kopcblejsxpkxoykldyh`) y producciÃƒÆ’Ã‚Â³n (`cthjwpeygpzwdmjkxeqa`).
- `capture_agent_version_release_manifest(uuid)` fija SHA-256 del contenido exacto del prompt y del manifiesto que incluye versiÃƒÆ’Ã‚Â³n/cÃƒÆ’Ã‚Â³digo, modelo, herramientas permitidas, esquema de salida, aprobaciÃƒÆ’Ã‚Â³n y configuraciÃƒÆ’Ã‚Â³n.
- Tras fijar el manifiesto, la base de datos rechaza editar o eliminar el prompt referenciado, cambiar la configuraciÃƒÆ’Ã‚Â³n del agente, registrar una evaluaciÃƒÆ’Ã‚Â³n aprobada con una huella distinta o promover sin evidencia enlazada a esa huella. La captura requiere service role; `anon` y `authenticated` no tienen permiso de lectura ni ejecuciÃƒÆ’Ã‚Â³n.
- TEST: transacciÃƒÆ’Ã‚Â³n de verificaciÃƒÆ’Ã‚Â³n cubriÃƒÆ’Ã‚Â³ captura, rechazo de cambios a la versiÃƒÆ’Ã‚Â³n y prompt, rechazo de fingerprint falso y gate cerrado sin resultados; `ROLLBACK` verificado con 0 versiones, prompts o manifiestos fixture restantes. TEST y producciÃƒÆ’Ã‚Â³n muestran la tabla y RPC presentes; ambos tienen 0 candidatos fijados.
- El runner live captura la huella antes de ejecutar y la adjunta a la evaluaciÃƒÆ’Ã‚Â³n. El offline actual continÃƒÆ’Ã‚Âºa como smoke incompleto y no fija versiones.
- Sigue pendiente ejecutar la versiÃƒÆ’Ã‚Â³n candidata de cada agente contra su suite live y conectar esa evaluaciÃƒÆ’Ã‚Â³n a su promociÃƒÆ’Ã‚Â³n. El flujo aÃƒÆ’Ã‚Â±adido en 2026-10-10 calibra el modelo juez con holdout y guarda sus informes, pero no reemplaza ese gate de versiones de agentes.

## Readiness de evaluaciones tras fijar huellas (10-oct-2026)

`getAgentEvalReadinessFromClient` ya no considera suficiente un registro `passed` en la versiÃƒÆ’Ã‚Â³n activa. Para marcar cobertura release exige `release_eligible`, fingerprint SHA-256 coincidente con el manifiesto actualmente unido a `agent_versions` y, en live, al menos 10 casos gold y 3 holdout. Las evaluaciones histÃƒÆ’Ã‚Â³ricas sin esa evidencia dejan de aparecer como verificadas. Pruebas: 8/8 en `agent-eval-readiness.test.ts`, incluidos el rechazo de un smoke histÃƒÆ’Ã‚Â³rico y el caso completo de 26 cÃƒÆ’Ã‚Â³digos; typecheck de API y AI correctos.

## Puntuacion humana de referencia (10-oct-2026)

La revision por criterio permite guardar `evaluable` con puntuacion 0-4 o `no_evaluable` con puntuacion nula. La migracion `20261214100000_agent_judgment_feedback_corrections.sql` esta aplicada en TEST (`kopcblejsxpkxoykldyh`) y produccion (`cthjwpeygpzwdmjkxeqa`). La RPC conserva autorizacion por rol, scoping run/organizacion, idempotencia, y la tabla mantiene RLS sin acceso directo de `authenticated`/`anon` y escritura append-only.

La traza muestra selector para anotar estado y puntuacion corregida; API y SQL rechazan puntuaciones fuera de rango, ausencia de puntuacion evaluable, puntuacion en `no_evaluable` y correcciones fuera del decision `corrected`. E2E en TEST: envio autenticado devuelve 201, replay idempotente devuelve el mismo ID, payload incompleto devuelve 400, y no quedan filas fixture tras la limpieza. El feedback de produccion sigue separado de los gold labels del dataset ciego implementado el 2026-10-10.

La migracion `20261214110000_agent_judgment_feedback_rpc_compat.sql` conserva argumentos finales opcionales en la RPC para clientes API anteriores al despliegue. TEST confirmo envio nuevo (10 argumentos efectivos) y llamada anterior (8 argumentos) con persistencia; ambas migraciones de feedback estan aplicadas en TEST y produccion. En ambos proyectos: `anon` no ejecuta la RPC, `authenticated` solo puede ejecutarla pasando las validaciones de seguridad definer, no puede leer directamente la tabla, `service_role` puede leerla y RLS permanece activo.
## 2026-10-10 Ãƒâ€šÃ‚Â· Dataset ciego para calibraciÃƒÆ’Ã‚Â³n humana

Implementado en cÃƒÆ’Ã‚Â³digo:

- Panel en `/admin/agentes` para aÃƒÆ’Ã‚Â±adir casos y etiquetar por criterio; la cola nunca devuelve etiquetas previas ni resultados del juez.
- Casos de desarrollo sintÃƒÆ’Ã‚Â©ticos separados de calibraciÃƒÆ’Ã‚Â³n/holdout, que solo aceptan procedencia de producciÃƒÆ’Ã‚Â³n con declaraciÃƒÆ’Ã‚Â³n de revisiÃƒÆ’Ã‚Â³n de privacidad.
- Dos revisiones independientes como mÃƒÆ’Ã‚Â¡ximo por caso; quien crea un caso no puede revisarlo; la adjudicaciÃƒÆ’Ã‚Â³n la hace una tercera persona.
- ValidaciÃƒÆ’Ã‚Â³n completa de rÃƒÆ’Ã‚Âºbrica, puntuaciÃƒÆ’Ã‚Â³n, fallos crÃƒÆ’Ã‚Â­ticos y referencias que resuelven contra la evidencia o salida guardada.
- ExportaciÃƒÆ’Ã‚Â³n API solo de holdout anonimizado con dos revisiones y adjudicaciÃƒÆ’Ã‚Â³n terminada, en la forma que consume el calibrador.
- EjecuciÃƒÆ’Ã‚Â³n del modelo juez configurado sobre el holdout desde el panel, con tope de 0,03 USD por caso, lÃƒÆ’Ã‚Â­mite total indicado por el administrador y resultados agregados por agente.
- Informe append-only con modelo, dataset, coste y mÃƒÆ’Ã‚Â©tricas; el gate exige al menos 3 casos por agente, acuerdo de estado >=85 %, puntuaciÃƒÆ’Ã‚Â³n a una distancia <=1 en >=90 %, recall crÃƒÆ’Ã‚Â­tico del 100 % y falsos crÃƒÆ’Ã‚Â­ticos <=5 %.
- Los agentes visuales solo se evalÃƒÆ’Ã‚Âºan si el caso incluye `evidence.visual_images` con bytes validados; si falta imagen, el caso queda no evaluable y el gate no pasa.
- Huella de contenido transversal a versiones y divisiones para evitar duplicar el mismo caso entre desarrollo y holdout.

Persistencia y seguridad:

- MigraciÃƒÆ’Ã‚Â³n `20261215100000_agent_judge_blind_dataset` aplicada en test y producciÃƒÆ’Ã‚Â³n.
- MigraciÃƒÆ’Ã‚Â³n `20261215110000_agent_judge_calibration_runs` aplicada en test y producciÃƒÆ’Ã‚Â³n.
- Tablas append-only con lÃƒÆ’Ã‚Â­mites y validaciones en base de datos, RLS activado y permisos directos revocados para `anon` y `authenticated`.
- El endpoint requiere `platform_admin`; el servicio usa credenciales de servidor despuÃƒÆ’Ã‚Â©s de resolver la identidad.

VerificaciÃƒÆ’Ã‚Â³n hecha el 2026-10-10:

- Typecheck de API y web: correcto.
- Pruebas del dataset ciego, feedback, runtime del juez y calibrador: 30/30 correctas; pruebas de API sin sesiÃƒÆ’Ã‚Â³n: 2/2 rechazan la peticiÃƒÆ’Ã‚Â³n (32 en total).
- Builds de API y web: correctos. La web se compilÃƒÆ’Ã‚Â³ con variables Supabase temporales de build, sin persistirlas ni contactar con esos valores.
- Las rutas remotas de mutaciÃƒÆ’Ã‚Â³n no se ejecutaron: el guard del runner rechazÃƒÆ’Ã‚Â³ `.env.local` porque no apunta a un proyecto de test aislado. No se intentÃƒÆ’Ã‚Â³ ejecutar contra producciÃƒÆ’Ã‚Â³n.
- RLS y grants comprobados directamente en ambos proyectos. Los avisos de Supabase sobre tablas RLS sin polÃƒÆ’Ã‚Â­ticas reflejan el acceso exclusivo por servicio/API; no se concedieron polÃƒÆ’Ã‚Â­ticas directas.
- La suite remota de mutaciÃƒÆ’Ã‚Â³n sigue protegida por el runner y se negÃƒÆ’Ã‚Â³ a ejecutarse porque `.env.local` no identifica un proyecto de test aislado; no se usÃƒÆ’Ã‚Â³ producciÃƒÆ’Ã‚Â³n para probar escrituras.

Estado de salida:

- La preparaciÃƒÆ’Ã‚Â³n de datasets, etiquetado ciego, API, persistencia, ejecuciÃƒÆ’Ã‚Â³n de calibraciÃƒÆ’Ã‚Â³n con coste acotado y mÃƒÆ’Ã‚Â©tricas por agente ya estÃƒÆ’Ã‚Â¡n conectados.
- No se ejecutÃƒÆ’Ã‚Â³ una calibraciÃƒÆ’Ã‚Â³n real: requiere casos gold anonimizados para los 26 agentes y consume llamadas de modelo.
- El modo del juez sigue apagado por defecto (`AI_JUDGE_MODE=off`) y la aplicaciÃƒÆ’Ã‚Â³n no se ha desplegado. Antes de activarlo hay que cargar casos gold suficientes para los 26 agentes y superar el holdout con el modelo candidato; activar el juez sin ese conjunto no demuestra calidad ni autoriza su salida visible.

## Cierre de brecha de holdout y gate del juez (10-oct-2026)

- La cola ciega filtra por `dataset_version` ademÃƒÆ’Ã‚Â¡s de split; las versiones no se mezclan en revisiÃƒÆ’Ã‚Â³n.
- `freeze_agent_judge_holdout` valida que cada caso holdout tenga procedencia anonimizada, revisiÃƒÆ’Ã‚Â³n de privacidad, dos revisores distintos y adjudicador independiente. Genera una huella SHA-256 de casos y etiquetas. Un advisory lock cubre inserciones concurrentes; despuÃƒÆ’Ã‚Â©s del congelado no se pueden aÃƒÆ’Ã‚Â±adir ni modificar casos, revisiones o adjudicaciones. Los cambios requieren una versiÃƒÆ’Ã‚Â³n nueva del dataset.
- La promociÃƒÆ’Ã‚Â³n de una versiÃƒÆ’Ã‚Â³n de agente exige ademÃƒÆ’Ã‚Â¡s una calibraciÃƒÆ’Ã‚Â³n aprobada del juez enlazada a la huella congelada. El panel de candidatas muestra este requisito como gate independiente de offline/live.
- MigraciÃƒÆ’Ã‚Â³n `20261215120000_agent_judge_holdout_freeze_release_gate.sql` aplicada en TEST (`kopcblejsxpkxoykldyh`) y producciÃƒÆ’Ã‚Â³n (`cthjwpeygpzwdmjkxeqa`). VerificaciÃƒÆ’Ã‚Â³n SQL en ambos: tabla y triggers presentes; `anon` sin EXECUTE; `service_role` con EXECUTE; la funciÃƒÆ’Ã‚Â³n de promociÃƒÆ’Ã‚Â³n contiene el requisito de calibraciÃƒÆ’Ã‚Â³n.
- API y web typecheck: correctos. Pruebas dirigidas de runner/dataset/release admin: 16/16; rutas anÃƒÆ’Ã‚Â³nimas del dataset: 2/2 con 401. `git diff --check`: correcto, con aviso de conversiÃƒÆ’Ã‚Â³n de finales de lÃƒÆ’Ã‚Â­nea en `server.ts`.

### Lo que todavÃƒÆ’Ã‚Â­a impide certificar todas las versiones

La calibraciÃƒÆ’Ã‚Â³n mide si el juez coincide con etiquetas humanas; no ejecuta por sÃƒÆ’Ã‚Â­ sola un candidato de agente. El runner offline sigue siendo un smoke de contratos y se persiste como `incomplete`. El runner live existe como contrato invocable, pero no estÃƒÆ’Ã‚Â¡ conectado a una ruta que cargue el contexto gold/holdout versionado y ejecute la configuraciÃƒÆ’Ã‚Â³n exacta de cada candidato con sus herramientas. Por ello el gate falla de forma segura y el panel no habilita la activaciÃƒÆ’Ã‚Â³n. Tampoco hay un holdout real completo para los 26 agentes ni una ejecuciÃƒÆ’Ã‚Â³n pagada del modelo juez. No se activÃƒÆ’Ã‚Â³ `AI_JUDGE_MODE` ni se desplegÃƒÆ’Ã‚Â³ el cÃƒÆ’Ã‚Â³digo; hacerlo sin esas pruebas mostrarÃƒÆ’Ã‚Â­a juicios no calibrados.

Para llegar al estado final falta construir ese runner candidate-pinned por agente (contexto y conectores aislados, artefacto reproducible, juez sobre la salida y evidencia de coste/latencia), poblar y doble etiquetar gold/holdout, probar cada una de las 26 rÃƒÆ’Ã‚Âºbricas y despuÃƒÆ’Ã‚Â©s activar el despliegue gradual. Si falta fuente, snapshot, recibo, imagen o caso gold, el resultado debe ser ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œno evaluableÃƒÂ¢Ã¢â€šÂ¬Ã‚Â, nunca una puntuaciÃƒÆ’Ã‚Â³n aprobatoria.
## CertificaciÃƒÆ’Ã‚Â³n del juez: holdout de un solo uso (10-oct-2026)

- TEST y producciÃƒÆ’Ã‚Â³n tienen `agent_judge_holdout_claims`: la restricciÃƒÆ’Ã‚Â³n ÃƒÆ’Ã‚Âºnica bloquea una segunda consulta del mismo holdout y rÃƒÆ’Ã‚Âºbrica, incluso si se intenta cambiar el modelo. La llamada solo estÃƒÆ’Ã‚Â¡ permitida a `service_role`; anon/authenticated no pueden reservarla.
- API de administraciÃƒÆ’Ã‚Â³n muestra si el dataset estÃƒÆ’Ã‚Â¡ congelado, cuÃƒÆ’Ã‚Â¡ntos casos holdout contiene, si ya se consumiÃƒÆ’Ã‚Â³ y el estado del informe. La UI advierte sobre la ejecuciÃƒÆ’Ã‚Â³n ÃƒÆ’Ã‚Âºnica, confirma coste mÃƒÆ’Ã‚Â¡ximo y deshabilita nuevas altas/revisiones tras congelar.
- MigraciÃƒÆ’Ã‚Â³n `20261215130000_agent_judge_holdout_single_use.sql` aplicada y comprobada en TEST y producciÃƒÆ’Ã‚Â³n: tabla, ÃƒÆ’Ã‚Â­ndice ÃƒÆ’Ã‚Âºnico y permisos correctos; duplicado rechazado por RPC.
- Typecheck API/web correctos; pruebas especÃƒÆ’Ã‚Â­ficas de dataset, runner, runtime y release admin: 17/17; API anÃƒÆ’Ã‚Â³nima: 2/2 con 401, incluida la nueva ruta de estado.
- La calibraciÃƒÆ’Ã‚Â³n real sigue sin ejecutarse: no hay 3 casos gold adjudicados por agente para los 26 agentes. El intento de certificaciÃƒÆ’Ã‚Â³n consume el holdout aunque falle el proveedor; el panel conserva el estado y evita reintentos que filtrarÃƒÆ’Ã‚Â­an resultados.
## Pinning de ejecuciÃƒÆ’Ã‚Â³n por caso (10-oct-2026)

El contrato live exige atestaciÃƒÆ’Ã‚Â³n del candidato efectivamente ejecutado (cÃƒÆ’Ã‚Â³digo, ID de versiÃƒÆ’Ã‚Â³n y fingerprint) en cada caso. La suite compara esos valores con el manifiesto capturado; un campo ausente o distinto invalida la elegibilidad. La evidencia incluye `dataset_split`, y la funciÃƒÆ’Ã‚Â³n de promociÃƒÆ’Ã‚Â³n comprueba los casos persistidos contra el artefacto de release.

Las migraciones `20261215150000_agent_release_requires_executed_candidate_pin.sql` y `20261215160000_agent_release_verify_candidate_cases.sql` estÃƒÆ’Ã‚Â¡n aplicadas en TEST y producciÃƒÆ’Ã‚Â³n. La prueba negativa en ambos entornos confirma rechazo al activar sin evidencia y mantiene inactiva la versiÃƒÆ’Ã‚Â³n. VerificaciÃƒÆ’Ã‚Â³n: AI live 9/9, runner API 10/10, typecheck API correcto.

El provider real aÃƒÆ’Ã‚Âºn no estÃƒÆ’Ã‚Â¡ conectado y no hay gold/holdout adjudicado completo. Hasta entonces el gate permanece cerrado y no existe certificaciÃƒÆ’Ã‚Â³n semÃƒÆ’Ã‚Â¡ntica.
## Readiness visible de candidatas (10-oct-2026)

El endpoint que alimenta el panel de versiones ya no deriva `can_promote` solo de estados `passed`. Comprueba la huella de release vigente y `release_eligible`; para live valida pinning, cÃƒÆ’Ã‚Â³digo/versiÃƒÆ’Ã‚Â³n/hash en cada caso y mÃƒÆ’Ã‚Â­nimos gold/holdout. AsÃƒÆ’Ã‚Â­, los registros histÃƒÆ’Ã‚Â³ricos o incompletos no muestran una acciÃƒÆ’Ã‚Â³n de activaciÃƒÆ’Ã‚Â³n habilitada antes de que el gate SQL la rechace. La decisiÃƒÆ’Ã‚Â³n final sigue en la base de datos. Pruebas de release admin: 4/4; typecheck API y `git diff --check` correctos.
## Preflight de migraciones de release (10-oct-2026)

`db:push` ahora detecta migraciones que activan `agent_versions` directamente y, antes de ejecutarlas, verifica contra la base destino que el trigger estÃƒÆ’Ã‚Â¡ habilitado, que la funciÃƒÆ’Ã‚Â³n de evidencia valida pinning/cÃƒÆ’Ã‚Â³digo/versiÃƒÆ’Ã‚Â³n/hash/holdout y que `promote_agent_version` usa ese gate. `scripts/verify.mjs` incorpora una guarda estÃƒÆ’Ã‚Â¡tica: migraciones posteriores al baseline candidate-pinned no pueden activar versiones con DML directo; deben usar la RPC protegida. La detecciÃƒÆ’Ã‚Â³n ignora comentarios, strings SQL y el cuerpo de funciones, y revisa bloques DO.

VerificaciÃƒÆ’Ã‚Â³n: 5/5 pruebas del preflight; guarda aplicada a 498 migraciones existentes; sintaxis de los scripts y `git diff --check` correctos. Este control cubre `db:push` del repositorio y `npm run verify`; el trigger SQL continÃƒÆ’Ã‚Âºa siendo la protecciÃƒÆ’Ã‚Â³n efectiva ante otras rutas privilegiadas. No se cambiÃƒÆ’Ã‚Â³ el estado de las bases en esta entrega. Falta incorporar el preflight en el CI/deploy real y demostrar que todas las rutas de despliegue lo ejecutan.
## VerificaciÃƒÆ’Ã‚Â³n general del repositorio y reparaciones (10-oct-2026)

La primera pasada de `npm run verify` encontrÃƒÆ’Ã‚Â³ cuatro fallos. Se corrigieron: la clasificaciÃƒÆ’Ã‚Â³n service-only de tablas privadas del juez y checkpoints de campaÃƒÆ’Ã‚Â±as; el inventario de pruebas API (las suites que requieren configuraciÃƒÆ’Ã‚Â³n Supabase se asignaron a `test:remote`); dos falsos positivos de idempotencia con firmas `RETURNS TABLE` que no cambian; y el checker de Markdown, que intentaba leer como archivo los enlaces vÃƒÆ’Ã‚Â¡lidos a directorios.

Resultado final: `npm run verify` con 18/18 guardas en verde. Las 10 pruebas locales incorporadas al inventario pasan 37/37; el test de rutas anÃƒÆ’Ã‚Â³nimas con configuraciÃƒÆ’Ã‚Â³n remota estÃƒÆ’Ã‚Â¡ registrado en `test:remote`, no ejecutado en esta pasada. Cobertura RLS: 315/315 tablas habilitadas, 27 clasificadas service-only. Idempotencia: 498 migraciones comprobadas. No se aplicaron migraciones ni se modificaron datos remotos en este turno.
## CI automÃƒÆ’Ã‚Â¡tico de calidad del juez (10-oct-2026)

Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ `.github/workflows/quality-gates.yml`, que corre en cada `pull_request` y `push` con Node 24 y `npm ci`. Ejecuta `npm run verify` (incluye la guarda estÃƒÆ’Ã‚Â¡tica de migraciones), build de paquetes compartidos y API, pruebas completas de AI, `test:unit` de API y cinco pruebas del preflight de migraciones. El YAML se parseÃƒÆ’Ã‚Â³ y se ejecutaron en local los mismos pasos: builds correctos, AI correcto, API 1.071/1.071 y preflight 5/5; `npm run verify` pasÃƒÆ’Ã‚Â³ 18/18 guardas.

El workflow no necesita secretos. La prueba de rutas remotas sigue en `test:remote` y no forma parte de este job. La consulta del estado del gate SQL ocurre en `db:push` cuando se aplica una migraciÃƒÆ’Ã‚Â³n candidata; este CI no promueve agentes ni despliega a producciÃƒÆ’Ã‚Â³n. Faltan conectar el workflow a cualquier pipeline de despliegue existente y completar el provider y los conjuntos gold/holdout.

## Muestra estadistica del juez (10-oct-2026)

Se cerro la brecha del holdout pequeno: certificar requiere 50 casos adjudicados por cada uno de los 26 agentes, con al menos 10 casos criticos positivos y 10 negativos. Los gates exigen 92% de acuerdo de estado, 95% de puntuaciones dentro de un punto, recall critico del 100% y falsos criticos de hasta 2%. La cola pagina datasets de hasta 5.000 casos. Cada ejecucion se limita a 1.666 casos para mantener el coste maximo previsto por debajo de 50 USD; conserva el coste real y aplica el tope configurado.

La cola humana ahora pagina de 100 en 100. El panel muestra por agente los casos adjudicados y la cobertura critica; no deja congelar el holdout desde la interfaz si falta muestra. La base de datos tambien rechaza el freeze si falta cualquiera de los minimos, incluso si se omite la UI.

Migraciones `20261215170000_agent_judge_calibration_sample_floor.sql` y `20261215180000_agent_judge_holdout_coverage.sql` aplicadas en TEST y produccion. Se comprobo que el trigger esta activo y que la funcion de cobertura devuelve los 26 agentes en ambos entornos.

Verificacion: AI 248/248; API unit 1.071/1.071; typecheck API y web; `npm run verify` 18/18 guardas. El holdout real sigue sin estar certificado: se necesitan casos de produccion anonimizados, dos revisores independientes y adjudicacion para completar la muestra por agente. El juez sigue fuera del gate de promocion hasta completar esos datos y ejecutar la certificacion final.


Estado del dataset desplegado al cierre: judge-gold-v1 contiene 0 casos holdout en TEST y produccion; 0/26 agentes alcanzan la muestra. Por tanto, el sistema bloquea la certificacion y no se ha consumido el holdout.

## Consistencia entre fallo critico y puntuacion (10-oct-2026)
`finalizeAgentJudgeResult` rechaza ahora como invÃƒÂ¡lida cualquier etiqueta `critical_failure=true` si el criterio no es evaluable o tiene score mayor que 1. Antes esa contradicciÃƒÂ³n podÃƒÂ­a convertir una puntuaciÃƒÂ³n 3/4 en bloqueo. La regla coincide con validaciÃƒÂ³n de etiquetas gold y queda cubierta con regresiÃƒÂ³n para score alto y no evaluable.


## Lease de cola alineado con reintentos (10-oct-2026)

El lease del worker pasa de 120 a 240 segundos. El timeout por intento del proveedor es 45 segundos y el runtime permite dos reintentos internos; 240 segundos deja margen sobre ese mÃƒÂ¡ximo y las lecturas/persistencias del trabajo. La prueba del worker comprueba que envÃƒÂ­a 240 segundos a `claim_agent_judge_jobs`, cuya RPC permite hasta 600. Esto reduce el riesgo de que otra instancia reclame un job aÃƒÂºn activo.

## Visibilidad del runtime en administracion (10-oct-2026)

El estado protegido del dataset incluye modo del juez, modelo configurado y readiness del proveedor, sin exponer credenciales. El panel diferencia `off`, `shadow` y `visible`; si el runtime esta apagado indica la variable necesaria para empezar shadow y si falta clave/precio muestra el error de configuracion. La prueba confirma modos, readiness y ausencia de secretos en la serializacion. Esto evita confundir una calibracion del dataset con un runtime activo; no cambia el modo del servicio ni habilita ejecuciones por si solo.

## Dictamen obligatorio por salida de candidata (10-oct-2026)

La suite live ya no puede contar como aprobada solo por abstencion y contrato de evidencia. Cada salida de candidata debe incluir el resultado `passed` recomputado contra la rubrica del agente, version `judge-rubrics-v1`, puntuacion minima 3,2 y SHA-256 del output exacto; el runner compara el hash antes de marcar el caso aprobado. La API de release y el gate SQL comprueban esos campos en todos los casos gold/holdout. Migracion `20261216100000_agent_release_requires_candidate_judgment.sql` aplicada en TEST y produccion; `scripts/verify-agent-judge-release-gate.mjs` confirma definicion y registro de migracion en ambos proyectos. No hay provider productivo de ejecucion candidata aun; el gate sigue cerrado hasta implementarlo.

## Estado verificado de la implementaciÃƒÂ³n (10-oct-2026, actualizaciÃƒÂ³n)

- `npm run verify`: **19/19 guardas correctas**. El inventario actual revisa 503 migraciones, 318/318 tablas con RLS y 28 tablas service-only; la cobertura del juez sigue detectando los 26 agentes y sus rÃƒÂºbricas.
- Suite local dirigida de dataset ciego, feedback, runtime, admin de candidatas, fixtures de replay y broker: **35/35 pruebas correctas**. Incluye controles de hash, orden y argumentos exactos del replay; llamadas omitidas o fuera del allowlist no se dan por completas.
- El broker de replay es una pieza aislada que solo devuelve resultados capturados y recibos hash; por sÃƒÂ­ mismo no ejecuta un candidato ni permite certificarlo.
- Sigue sin estar verificado un recorrido candidate-pinned de extremo a extremo: proveedor que carga la versiÃƒÂ³n exacta, ejecuta el contrato de salida real, reproduce todas las herramientas del fixture, invoca al juez, persiste casos gold/holdout y compara el manifiesto antes/despuÃƒÂ©s. Tampoco hay holdout humano suficiente: 0 casos en `judge-gold-v1` y 0/26 agentes con muestra certificable segÃƒÂºn la comprobaciÃƒÂ³n documentada arriba.
- El gate de promociÃƒÂ³n permanece cerrado y `AI_JUDGE_MODE` apagado. El resultado de estas pruebas es calidad de cÃƒÂ³digo/controles, no certificaciÃƒÂ³n semÃƒÂ¡ntica, despliegue ni autorizaciÃƒÂ³n para activar el juez.

Los resultados de esta actualizaciÃƒÂ³n son locales; no se ejecutaron mutaciones remotas ni se aplicaron migraciones en esta comprobaciÃƒÂ³n.

## Runner candidato integrado Ã¢â‚¬â€ 10-oct-2026

La ejecuciÃƒÂ³n candidate-pinned ya estÃƒÂ¡ conectada en cÃƒÂ³digo y en el panel de fixtures. `POST /v1/admin/agent-release-eval-fixtures/run` exige `platform_admin`, carga los fixtures inmutables seleccionados y verifica agente, rÃƒÂºbrica y dataset antes de ejecutar. El panel permite elegir versiÃƒÂ³n candidata y fixtures del mismo agente, ejecutar la suite y ver el resultado por caso, coste, latencia y elegibilidad.

El proveedor vuelve a comprobar el manifiesto/prompt fijado, usa el modelo y prompt de la versiÃƒÂ³n exacta y ÃƒÂºnicamente declara herramientas que tienen replay. El candidato recibe parÃƒÂ¡metros, alcance y fuentes disponibles; no recibe constraints, grabaciones ni resultados esperados. Una discrepancia en argumentos, orden, hash o llamadas omitidas hace que el caso no pueda aprobar. Se rechaza el modelo sin precio conocido antes de llamar al proveedor y se limita cada turno candidato a 0,25 USD y cada juicio a 0,03 USD.

Los contratos especializados v3 (incluidos A19 arquitecto y revisiÃƒÂ³n) y los casos visuales sin bytes/render final quedan `no_evaluable`; no se presentan como aprobados. La suite de release necesita 10 casos de calibraciÃƒÂ³n y 3 de release por agente y no declara elegibilidad con una muestra menor. Esto deja 20 agentes de contrato v1 con ejecuciÃƒÂ³n textual disponible; la certificaciÃƒÂ³n de todo el catÃƒÂ¡logo sigue pendiente de soporte especÃƒÂ­fico para los contratos v3, evidencia multimodal vinculada y datos gold/holdout humanos adjudicados.

VerificaciÃƒÂ³n local: `npm run verify` 19/19; paquete AI 252/252; API `test:unit` 1.091/1.091; typecheck API y web; build API; `git diff --check`. El test de proveedor cubre schema no soportado, cambio de huella, agente visual sin bytes y que el candidato no ve informaciÃƒÂ³n de evaluaciÃƒÂ³n. El panel muestra la elegibilidad de la evaluaciÃƒÂ³n; la promociÃƒÂ³n continÃƒÂºa bajo el gate SQL.

No se ejecutÃƒÂ³ una campaÃƒÂ±a contra un candidato real, no se desplegÃƒÂ³ el cÃƒÂ³digo, no se activÃƒÂ³ `AI_JUDGE_MODE` y no se aplicaron migraciones en esta verificaciÃƒÂ³n. Los datos gold/holdout existentes siguen siendo insuficientes para certificar agentes.
## Holdout release y despliegue de migracion (10-oct-2026)

El runner permitia reutilizar el mismo fixture release entre candidatos. Se incorporo un ledger append-only y un reclamo atomico single-use previo al provider; development/calibration se pueden reejecutar. El test focalizado del runner fue 8/8 antes de cambios concurrentes posteriores.

La migracion 20261218090001_agent_release_eval_holdout_claims.sql esta aplicada en TEST (kopcblejsxpkxoykldyh) y produccion (cthjwpeygpzwdmjkxeqa). En ambos: RLS activo; trigger append-only activo; anon/auth sin SELECT ni EXECUTE; service_role sin INSERT directo y con EXECUTE; tabla vacia. El schema esta listo y la ruta falla cerrado si no puede reclamar.

El apply MCP registro versiones distintas por entorno: TEST 20261010105024; PROD 20261010105122. La migracion listada localmente es 20261218090001. El db push --linked --dry-run de produccion confirmo que ese archivo apareceria como pendiente y se bloqueo porque existen 24 migraciones remotas sin archivo local, incluida la version PROD de este apply. No se ejecuto migration repair ni se edito el historial. Mantener el DDL instalado; no volver a aplicar con db push hasta resolver el drift general mediante el flujo revisado del repositorio.

Validacion de repo: npm run verify 19/19; test:agent-release-preflight 5/5. En el ultimo typecheck y test focalizado aparecio un error concurrente no relacionado en apps/api/src/ai-runtime.ts: importa caminoWeeklyReviewJsonSchema, que no exporta @e-nora/ai (solo caminoWeeklyReviewSchema). El cambio propio de holdout habia pasado typecheck y 8/8 focalizado antes de esa edicion concurrente.
## Estado posterior: cobertura A19 y drift MCP (10-oct-2026)

- A19 Arquitecto ahora selecciona el contrato real `caminoPlanJsonSchema` y su validaciÃ³n por horizonte desde `horizon_months` y `reference_date` congelados en el fixture. La prueba `apps/api/src/agent-release-candidate-eval.test.ts` demuestra selecciÃ³n/fail-closed por falta de datos; aÃºn falta una ejecuciÃ³n real con proveedor candidato.
- A19 RevisiÃ³n tiene un fixture estricto que exige Camino aprobado/versionado, ventana, snapshot de progreso, fuentes mÃ©tricas y revisiÃ³n previa. El provider aÃºn responde `no_evaluable`; no se cuenta como ejecutable hasta integrar `caminoWeeklyReviewSchema` y probarlo.
- Matriz actualizada a **21/26 ejecutables en cÃ³digo** y **5/26 no evaluables** (A19 RevisiÃ³n y cuatro visuales). Ninguna cifra implica gold/holdout certificado.
- MigraciÃ³n `20261218090001_agent_release_eval_holdout_claims.sql`: MCP la aplicÃ³ en TEST y PROD. Se reportan tabla/RLS/trigger append-only, RPC accesible solo por `service_role` y ledger vacÃ­o al comprobar. El claim consume un fixture release desde el primer intento.
- El historial sigue con drift: 24 versiones remotas no tienen fichero local. La migraciÃ³n figura como `20261010105024` en TEST y `20261010105122` en PROD, frente al fichero local `20261218090001`. El `db push --linked --dry-run` de PROD confirmÃ³ que aparecerÃ­a pendiente y se bloqueÃ³ por ese drift. No se ejecutÃ³ repair ni se editÃ³ el historial; conservar el DDL aplicado y no reintentar push hasta reconciliar ambas bases.
- Esta revisiÃ³n solo actualiza documentaciÃ³n. El estado previo de `AI_JUDGE_MODE`, despliegue y certificaciÃ³n no cambia.

## Cierre de implementaciÃ³n de contratos A19 en candidate-runner (10-oct-2026)

La implementaciÃ³n posterior conecta ambos contratos A19: Arquitecto usa `caminoPlanJsonSchema` mÃ¡s `caminoPlanSchemaForHorizon`, exigiendo horizonte y fecha de referencia; RevisiÃ³n usa `caminoWeeklyReviewJsonSchema` y `caminoWeeklyReviewSchema`, con fixture validado que congela Camino aprobado/versionado, periodo, progreso, estado de tareas/hitos, fuentes mÃ©tricas y revisiÃ³n anterior. Por esto se corrige el conteo anterior: **22/26 contratos candidate-pinned soportados**, **4/26 no evaluables** (A15/A16/A23/A26 por evidencia visual). Ninguna de estas pruebas representa certificaciÃ³n con gold/holdout adjudicado.

VerificaciÃ³n tras construir `@e-nora/ai`: `npm run build -w @e-nora/ai` correcto; `npx tsx --test apps/api/src/agent-release-candidate-eval.test.ts apps/api/src/agent-release-eval-fixture.test.ts` correcto, **14/14**; `npm run typecheck -w @e-nora/api` correcto. El primer intento de las suites antes de reconstruir el paquete encontrÃ³ el `dist` compartido desactualizado; despuÃ©s del build, las suites cargaron y pasaron.

El historial de migraciones del holdout sigue en drift: el `db push --linked --dry-run` de PROD detecta 24 versiones remotas sin fichero local y marca pendiente el identificador local `20261218090001`, pese a la aplicaciÃ³n MCP ya realizada en TEST/PROD bajo identificadores remotos distintos. No se hizo repair ni se volviÃ³ a aplicar DDL. La reconciliaciÃ³n queda necesaria antes de volver a usar el flujo de `db push`.

## ImplementaciÃ³n multimodal del runner candidato (12-oct-2026)

El fixture candidate-pinned ya puede transportar evidencia visual de A15, A16, A23 y A26. El contrato exige bytes de imagen inline, MIME con firma vÃ¡lida, SHA-256 coincidente, mÃ¡ximo cuatro imÃ¡genes y 5 MiB agregados; A15 restringe el tipo de entidad al banco de Instagram, A23 exige vÃ­nculo a activo/anuncio/periodo, A16 requiere input + render + slide vecino, y A26 requiere capturas renderizadas con viewport desktop y mobile. El HTML se conserva como source block, nunca como imagen.

El runner pasa las imÃ¡genes verificadas al candidato y vuelve a pasar los mismos objetos al juez multimodal. En el snapshot se conservan los metadatos y hashes, y se omiten los bytes base64 para no duplicar payload; el hash del fixture sigue cubriendo el fixture Ã­ntegro. Los casos visuales fallan cerrados si falta la evidencia o si la versiÃ³n usa un proveedor sin soporte de imagen. La ruta admin de creaciÃ³n admite hasta 8 MiB para fixtures visuales.

El panel `/admin/agentes` ya deja adjuntar imÃ¡genes por artefacto/rol, calcula el hash en cliente y muestra cuÃ¡ntas evidencias estÃ¡n listas; filtra HTML para que no aparezca como archivo de imagen. Admite imÃ¡genes de hasta 1,35 MB cada una y el endpoint aplica el lÃ­mite total del fixture.

VerificaciÃ³n local: los tests focalizados de fixture y candidate-runner pasan 14/14; `npm run test:unit -w @e-nora/api` pasa 1.094/1.094; `npm test -w @e-nora/ai` pasa 254/254; `npm run verify` pasa 19/19; typecheck y build API pasan; `git diff --check` pasa. La suite de agentes visuales valida los requisitos de roles, viewport, MIME, tamaÃ±o y hash. Esto eleva la capacidad del runner a **26/26 entradas de catÃ¡logo con contrato de cÃ³digo**, incluidas las cuatro multimodales, pero no implica fixtures adjudicados ni certificaciÃ³n. A26 sigue limitado a las capturas congeladas que aporta cada fixture; no demuestra inbox ni compatibilidad con todos los clientes de correo.

El lÃ­mite de almacenamiento de `agent_release_eval_cases.fixture` tambiÃ©n se ampliÃ³ a 9 MiB, con la migraciÃ³n `20261218090002_agent_release_visual_fixture_size.sql`, aplicada por MCP en TEST (`kopcblejsxpkxoykldyh`) y producciÃ³n (`cthjwpeygpzwdmjkxeqa`). La constraint validada aparece en ambos proyectos con lÃ­mite `9437184` bytes. La migraciÃ³n de holdout ya tenÃ­a divergencia de identificador MCP/local y el historial conserva drift; no se debe considerar limpio `db push --dry-run` hasta reconciliarlo.

La lectura actual por MCP devuelve **0 casos de `agent_judge_eval_cases` y 0 adjudicaciones** en TEST y producciÃ³n. Por tanto, el siguiente tramo requiere preparar ejemplos reales anonimizados, doble revisiÃ³n independiente y adjudicaciÃ³n humana; no hay base para activar `AI_JUDGE_MODE` ni declarar calidad calibrada.

## Entrada visual en gold y holdout (12-oct-2026)

Se completÃ³ el camino de evidencias multimodales del dataset de calibraciÃ³n: cada caso visual guarda solo referencias privadas a Storage, organizaciÃ³n, hash SHA-256, MIME, rol y vÃ­nculo de entidad. La API valida scope tenant, traversal, duplicados y cobertura por agente antes de pedir URLs firmadas; despuÃ©s descarga desde el Storage propio, vuelve a comprobar hash/MIME y entrega los mismos bytes visuales al evaluador. A15 exige activos del banco Instagram; A16 input/render/vecino; A23 creativo Meta vinculado; A26 capturas renderizadas desktop y mobile. No se aceptan URLs externas ni base64 en el dataset gold, que mantiene el lÃ­mite de 100 KiB.

VerificaciÃ³n especÃ­fica: 18/18 pruebas focalizadas pasan. Esto arregla una brecha de ejecuciÃ³n detectada en calibraciÃ³n; no cambia el estado de muestra ni constituye certificaciÃ³n. La cobertura actual sigue en 0 casos adjudicados en TEST y producciÃ³n, por lo que el juez permanece sin certificar y fuera del gate.

VerificaciÃ³n completa tras este cambio: API 1.096/1.096, AI 254/254, `npm run verify` 19/19, typecheck API y web, build API y `git diff --check` correctos.

## Ejecucion HTTP autenticada y shadow (12-oct-2026)

Se levanto una instancia API aislada en `localhost:4401`, apuntando solo a TEST (`kopcblejsxpkxoykldyh`) y con `AI_JUDGE_MODE=shadow`; la instancia `localhost:4400` quedo en `off`. Las ejecuciones descritas en esta seccion ocurrieron solo en TEST; no se ejecutaron agentes ni se escribieron datos de ejecucion en produccion. El usuario de test usado fue platform admin. El endpoint A05 necesito `connectionId` de la tienda de prueba; sin tienda respondio `409 campaign_plan_store_required`, y con la conexion devolvio `201`, `pending_approval`, traza `Juez: queued` y dictamen persistido `review` para `a05_estrategia_campanas` (gpt-6-luna). No se publico ni envio una campana.

Tambien se ejecutaron por HTTP seis rutas de agente con contexto disponible: operativa Shopify (`a13`), operativa Meta (`a14`), retencion (`a20`), adquisicion (`a21`), postventa (`a22`) y contenido email (`a26`). Todas devolvieron `201`; shadow persistio cinco dictamenes `review` y un `no_evaluable` para A26 porque el caso operativo no incluia capturas desktop/mobile. A05 obtuvo `review`, puntuacion 2.14/4: el juez marco evidencia truncada/referencias insuficientes y discrepancia sin justificar entre mercado ES y zona `America/New_York`. Esa ejecucion es diagnostico de calidad, no caso gold ni certificacion. Las tres rutas Meta de marketing no se pudieron ejecutar por falta de tienda Meta en TEST; las lecturas devolvieron `marketing_store_not_found`. Se probaron 23 llamadas sin token y todas rechazaron con 401. Las rutas protegidas se ejercitaron con usuario y datos de TEST.

Verificacion de codigo tras la entrada visual: API `test:unit` 1.101/1.101; typecheck web correcto; pruebas focalizadas de runtime/dataset 19/19 y candidate-runner 7/7. La prueba de invariantes recorre los 26 cÃ³digos activos y detectÃ³/corrigiÃ³ IDs duplicados en el fixture A16. AI pasa 254/254 y typecheck API pasa. Una consulta agregada posterior a TEST confirma 0 casos en `agent_release_eval_cases` (0 agentes y 0 filas en train, validation y holdout). El gate sigue sin holdout adjudicado: no activar el juez como decisor ni declarar agentes certificados.

Alcance de la ejecucion: se observaron siete ejecuciones reales autenticadas (A05 y seis perfiles A13/A14/A20/A21/A22/A26) y 23 rechazos sin autenticacion. La invocacion compartida en `ai-runtime.ts` permite juzgar otros perfiles, y existen contratos de candidate-runner para 26/26; no se ha hecho una ejecucion E2E de producto por cada uno de los 26 perfiles. Las pruebas de contrato y la cobertura de la funcion compartida no deben presentarse como cobertura de rutas E2E completa. Para cerrar esa brecha hacen falta fixtures representativos por agente y pruebas por ruta, incluida la persistencia run/output/tenant y perfiles con salidas especiales o visuales.

Se aplicaron en TEST y produccion, con la autorizacion expresa del usuario, `agent_release_visual_fixture_size` y `configuracion_permisos`. Se verificaron en ambos proyectos el limite de fixture de 9 MiB, `organization_members.store_ids`, `organization_consultant_permissions` y `organizations.require_mfa`. El aplicador remoto registro versiones con timestamps generados por el servicio (octubre 2026), mientras que los archivos locales estan fechados en diciembre 2026; el historial ya tiene drift y no debe correrse `db push` hasta reconciliar versiones. Los avisos de advisors siguen presentes en ambas bases (38 tablas RLS sin politica y 274 FKs sin indice; categorias INFO), y no se modificaron como parte de estas pruebas.

## E2E HTTP A15 en TEST (12-oct-2026)

Con autorizaciÃ³n expresa para probar por HTTP, se lanzÃ³ el procesador interno de imÃ¡genes de la API local en `localhost:4402`, configurada en `shadow` y conectada solo a TEST (`kopcblejsxpkxoykldyh`). La cola procesÃ³ exactamente un activo de prueba existente: respuesta HTTP 200 (`processed=1`, `failed=0`, `skipped=0`), estado final `analyzed`, run `126d2ba0-3bb5-4f6d-a2bc-a6f45c993874` en `succeeded` con `gpt-6-luna`.

El snapshot persistiÃ³ `visual_evidence.sha256=dcdc372867b724a02fec0bff1a281b48fb4505505e5dd2d082d3f6e695546880` y hash de bytes `2b9216ba8fc5a230b8c5a7f4ea4f5699493d71924853f98f6abd4967efad8055`. El job del juez terminÃ³ `completed`; dictamen `review`, 3/4, coste estimado `0.000798 USD`, 10.472 ms. El criterio `asset_lineage` quedÃ³ en 1/4: el juez reconoce hashes declarados, pero dice que no puede confirmar que el hash corresponda a los bytes adjuntos y seÃ±ala falta de modelo/identidad durable. Esto descubre una brecha de contrato/prompt: el vÃ­nculo de bytes congelados estÃ¡ garantizado por el runtime, pero el juez no recibe ese hecho como recibo confiable separado de los datos del artefacto. Hay que corregir esa entrada e incluir prueba de modelo/identidad del activo; no reinterpretar el 1/4 como fallo del anÃ¡lisis visual ni como certificaciÃ³n. TEST queda con el activo reanalizado y sin cola pendiente.

### Seguimiento de A15: recibo de linaje completo (12-oct-2026)

Al repetir la E2E HTTP con una Ãºnica instancia actualizada de API en `localhost:4406` (las tres instancias locales anteriores se detuvieron para evitar consumidores de cola con versiones distintas), A15 terminÃ³ `succeeded` y el juez `passed`, puntuaciÃ³n global 3.56/4, `asset_lineage=4/4`, coste juez `0.000951 USD`. El recibo de servidor incluye run, modelo/proveedor, ID del activo y su versiÃ³n como SHA-256 de contenido; el dictamen cita los paths exactos. El juez detectÃ³ ademÃ¡s una imprecisiÃ³n de geometrÃ­a en el anÃ¡lisis, evidencia de que el criterio visual sigue activo. La cola terminÃ³ `completed`, sin error, y el activo de TEST quedÃ³ `analyzed`.

El contrato de A15 ahora transporta el ID de activo desde el procesador de cola al juez, el modelo/proveedor desde el resultado del candidato, y declara el SHA-256 como versiÃ³n de contenido. Pruebas focalizadas de runtime/candidate runner: 20/20; typecheck API correcto. Esta E2E acredita esta ruta multimodal especÃ­fica, no sustituye gold/holdout ni la E2E de los otros perfiles.

## E2E HTTP A16 en TEST (12-oct-2026)

La UI real de Marketing â†’ Banco de imÃ¡genes revelÃ³ y permitiÃ³ corregir la ruta GET/POST incorrecta del editor (`/instagram/image-bank/overlays` â†’ `/instagram/overlays`). Una primera generaciÃ³n sin brief produjo abstenciÃ³n vÃ¡lida (`blocks: []`) que el schema rechazaba; el contrato ahora permite abstenerse y las pruebas de AI pasan. Con un brief sintÃ©tico no comercial, se ejecutÃ³ y guardÃ³ un borrador en TEST; no se publicÃ³ ni enviÃ³.

Run `72f761b2-1c67-4e75-a5f9-633ffff4ebc6`: candidato `succeeded` con `gpt-6-luna`/`openai`; el payload congelado del job incluye `candidateModel` y `candidateProvider`. El job terminÃ³ y el dictamen fue `review`, 3.22/4. `factuality`, `scope`, `uncertainty`, `safety` y `copy_brief` son evaluables; `render_readability` y `carousel_consistency` quedan `no_evaluable` porque la evidencia no incluye el render compuesto ni slides vecinos. El criterio de seguridad confirma que sigue pendiente de revisiÃ³n humana.

Conteo por perfil de TEST tras esta ejecuciÃ³n: 10/26 perfiles distintos con dictamen live: A05, A13, A14, A15, A16, A17, A20, A21, A22 y A26. No confundir esto con certificaciÃ³n: siguen faltando fixtures gold/holdout adjudicados y el gate permanece cerrado.

## CorrecciÃ³n de evidencia del juez y repeticiÃ³n A19 (12-oct-2026)

El serializador de contexto admite ahora lÃ­mites opcionales por llamada; los lÃ­mites por defecto de los agentes no cambian. El juez usa 600.000 caracteres por bloque y 620.000 en total, preflight del mismo serializador y rechazo explÃ­cito ante cualquier truncado. El hash de idempotencia/fingerprint incluye la versiÃ³n del paquete de evidencia (`judge-evidence-pack-v3`) para permitir revaluar artefactos existentes con el contrato actualizado.

VerificaciÃ³n local: build de `@e-nora/ai`; 255 pruebas AI y 13 pruebas de runtime del juez aprobadas; typecheck del API aprobado. En la ejecuciÃ³n TEST de A19 `12e8a609-a25c-4a29-8ab5-b3cd26b89418`, la primera llamada de prueba se abstuvo correctamente porque el fixture usÃ³ estado `pending_approval` en vez del estado de generaciÃ³n. Con el estado corregido (`succeeded`), el runtime recibiÃ³ la llamada pero el proveedor devolviÃ³ un fallo genÃ©rico antes de registrar tokens (0/0); no se considera E2E aprobada ni se afirma que A19 haya recibido el paquete completo. El camino sigue pendiente de aprobaciÃ³n y no se activÃ³. La salida y el dictamen previos permanecen intactos; se insertaron registros de prueba no evaluables/error con nuevas claves de idempotencia.

### CorrecciÃ³n del hallazgo A19: preflight insuficiente y E2E repetida (12-oct-2026)

La investigaciÃ³n encontrÃ³ el fallo exacto: el payload serializado de A19 ocupa 321.621 caracteres y el lÃ­mite anterior (300.000) lo recortaba. El preflight ahora permite 600.000 por bloque y 620.000 total, y el runtime convierte el recorte en `judge_evidence_context_truncated` en vez de ocultarlo como fallo genÃ©rico. La conexiÃ³n/modelo se comprobÃ³ con una llamada mÃ­nima independiente; el problema era el lÃ­mite local del paquete.

ReevaluaciÃ³n real de TEST mediante el runtime y el proveedor OpenAI, con output `a43ba858-7e32-4569-b31c-3f1ad4eed7ad`, snapshot completo y recibos: juicio `cb67cebc-b4c8-476f-890a-53359cb8be4c`, modelo `gpt-6-luna`, **75.151 tokens de entrada**, 1.913 de salida, 26.026 ms, coste estimado **0,008472 USD**, estado `review`, puntuaciÃ³n 2,37/4. El resultado detecta incoherencias en objetivo/calendario y falta de capacidad confirmada; no se aprueba automÃ¡ticamente. La salida continÃºa `pending_approval`, sin crear ni activar el Camino. TEST registra ahora 11/26 perfiles distintos con dictamen: A05, A13, A14, A15, A16, A17, A19 Arquitecto, A20, A21, A22 y A26. A19 RevisiÃ³n sigue siendo un perfil distinto sin esta prueba.

La nota anterior de esta secciÃ³n sobre fallo genÃ©rico del proveedor queda supersedida: correspondÃ­a a la ejecuciÃ³n con lÃ­mite 300.000, no a un problema de conexiÃ³n. Los registros fallidos/no evaluables de esas pruebas siguen como auditorÃ­a histÃ³rica y el dictamen `review` nuevo es la evaluaciÃ³n vÃ¡lida del paquete completo.

### Cobertura estructural de rutas por catÃ¡logo (12-oct-2026)

La nueva prueba AST `agent-judge-route-coverage.test.ts` compara los 26 cÃ³digos activos con llamadas literales a `runGenericDiagnosticAgent` y llamadas especializadas a `judgePersistedAgentOutput`. DetectÃ³ los tres perfiles de planificaciÃ³n A04/A17/A18, que llegan al runner por `PLAN_HORIZONS[horizon].agentCode`; verifica explÃ­citamente el enlace dinÃ¡mico. La suite API completa pasa **1.104/1.104**, incluido este guard, y el typecheck API pasa. Esto evita que se aÃ±ada un perfil sin un call path estructural al juez; no sustituye E2E autenticadas por cada endpoint. Tras la prueba real de A04 del 12-oct-2026, TEST registra **12/26 cÃ³digos distintos con dictamen**. Esta cobertura runtime no sustituye las E2E HTTP autenticadas.

### EjecuciÃ³n real A04 y dictamen en TEST (12-oct-2026)

Se ejecutÃ³ runTaskPlannerAgent contra TEST con la membresÃ­a real de la organizaciÃ³n y el scope de tienda de la aplicaciÃ³n. Run aae67b0d-18b9-4a36-914a-c73dcedf3ac5 quedÃ³ succeeded; output 4eb57055-3555-458d-9715-6ff3a9bf1a59 continÃºa pending_approval con approval_required=true. El juez del runtime real generÃ³ review, 2,59/4, con gpt-6-luna: 18.785 tokens de entrada, 1.468 de salida, 11.565 ms y coste estimado de 0,002613 USD. No se aprobÃ³ la propuesta ni se crearon tareas. AI_JUDGE_MODE=visible se asignÃ³ solo en memoria al proceso de prueba para ejecutar judgePersistedAgentOutput; el modo global de TEST/producciÃ³n no cambiÃ³.

La prueba HTTP directa de POST /v1/organizations/:organizationId/ai/task-planner-run sin bearer devuelve 401 missing_bearer_token, como exige la autenticaciÃ³n. Esta ejecuciÃ³n se hizo con el runtime y la persistencia reales de TEST, no con una sesiÃ³n HTTP autenticada; por tanto, no cuenta como E2E HTTP autenticada. La consulta remota de juicios confirma ahora 13/26 cÃ³digos distintos: A04, A05, A13, A14, A15, A16, A17, A18, A19 Arquitecto, A20, A21, A22 y A26. A19 RevisiÃ³n sigue siendo un contrato independiente pendiente. La cobertura E2E HTTP autenticada vigente suma 9/26 perfiles: A05 (planificaciÃ³n), A13, A14, A15, A16, A20, A21, A22 y A26; A05 ediciÃ³n sigue siendo otro path pendiente.

### ActualizaciÃ³n de rÃºbrica A05 y gate de release v2 (12-oct-2026)

La prueba HTTP de A05 mostrÃ³ una falsa alarma potencial: el juez confundiÃ³ el mercado comercial EspaÃ±a con la zona `America/New_York`, aunque esta es la zona IANA configurada en la tienda de TEST. La rÃºbrica nueva separa ambos datos y exige contrastar las horas con la zona de la tienda; tambiÃ©n pide evaluar preparaciones/acciones condicionales cuando el stock impide una promociÃ³n segura. Se versionÃ³ como `judge-rubrics-v2` y el panel inicia con `judge-gold-v2`; los casos v1 no se reinterpretan ni pasan al conjunto nuevo.

La migraciÃ³n `20261220100000_agent_judge_rubric_v2_release_gate.sql` quedÃ³ aplicada y registrada en TEST y producciÃ³n. Los verificadores remotos `verify:agent-judge-release-gate` y `verify:agent-judge-release-gate:prod` pasan: el gate requiere dictamen v2 con hash exacto y certificaciÃ³n holdout v2. Ambos entornos tienen **0** certificados holdout v2, por lo que la promociÃ³n continÃºa cerrada hasta crear/adjudicar la nueva muestra. VerificaciÃ³n local: paquete AI 12/12; dataset/release 38/38; runtime/coverage 15/15; typecheck API y web correctos. La cobertura se mantiene en 13/26 perfiles con dictamen y 9/26 con E2E HTTP.

La captura guiada del panel estÃ¡ disponible y conserva JSON avanzado. El ID de ejecuciÃ³n se guarda como referencia; contexto, comportamiento esperado y salida aÃºn se introducen/resumen manualmente. No se afirma una importaciÃ³n automÃ¡tica de outputs existentes.

### Prueba HTTP adicional A05 y versiÃ³n del servicio (12-oct-2026)

Con la sesiÃ³n autenticada del navegador se probÃ³ A05 en el modo sin cantidades fijadas. La primera llamada fallÃ³ el schema porque el primer paso de un flow Klaviyo devolviÃ³ `wait_days > 0`. Se reforzÃ³ localmente el prompt: ese paso debe llevar `wait_days=0` y las esperas posteriores se cuentan desde el paso previo. La repeticiÃ³n finalizÃ³ `succeeded` (36 s, 4 llamadas a herramientas), con output pendiente de aprobaciÃ³n y juez `review` 2,71/4. La salida se abstuvo de proponer iniciativas porque el inventario tenÃ­a 77,7 horas, 7 referencias agotadas y 4 bajo mÃ­nimos; no habÃ­a producto, audiencia ni oferta confirmados. No se guardaron campaÃ±as, ni se enviÃ³/publicÃ³ nada.

La respuesta HTTP se persistiÃ³ en TEST bajo la rÃºbrica `judge-rubrics-v1`, aunque el cÃ³digo local y el gate de base ya requieren v2. Esto demuestra que el servicio que atiende la prueba aÃºn ejecuta una versiÃ³n anterior; la migraciÃ³n sola no actualiza el servicio desplegado. El ajuste del prompt tampoco se considera probado en esa ejecuciÃ³n, hasta ejecutarlo contra un servicio que incluya el cÃ³digo local actualizado. Antes de usar resultados de esta ruta para evidenciar v2, hay que actualizar el servicio de TEST y repetir la llamada; producciÃ³n permanece fuera de esta prueba. La prueba de campaÃ±a y AI pasa 102/102, el typecheck API pasa y `git diff --check` no detecta errores de formato.

### A17/A18: ejecuciÃ³n por horizonte y dictamen real en TEST (12-oct-2026)

Se ejecutaron `runPlanAgent` para `week` y `month` con scope real de TEST. A17 (`fcbb777f-34c7-467f-a7b1-c16fb4e363f6`) y A18 (`7846556b-f9e9-4f3c-840b-8b2f61e4d851`) finalizaron `succeeded`; sus outputs (`3f91e7c1-4948-49e1-8940-efb94e7c0acf` y `c021098a-fa1c-4a5e-8f7a-e6230ccfdfe9`) siguen `pending_approval` con `approval_required=true`. Jueces `review`: A17 3,04/4, 19.132 tokens de entrada, 1.342 de salida, 15.544 ms, 0,002584 USD; A18 3,05/4, 19.601 tokens de entrada, 1.397 de salida, 12.928 ms, 0,002659 USD. No se aprobaron propuestas ni se crearon tareas. `AI_JUDGE_MODE=visible` se fijÃ³ solo en memoria para este proceso de TEST; el modo global no cambiÃ³. A17 ya estaba incluido en el recuento anterior; A18 lo eleva a 13/26 perfiles con dictamen. Estas ejecuciones no cuentan como E2E HTTP autenticadas.

### Pruebas HTTP locales autorizadas y correcciÃ³n del contrato A02 (12-oct-2026)

El usuario autorizÃ³ expresamente probar las rutas por HTTP en TEST y producciÃ³n, con la restricciÃ³n de no borrar el proyecto. Las pruebas actuales se han realizado en TEST; no se han ejecutado mutaciones en producciÃ³n.

Desde la sesiÃ³n autenticada del navegador se disparÃ³ A02 para el dashboard Shopify de 30 dÃ­as. Run `82e6dacc-1945-43fa-84bc-a65ceef69e77` fallÃ³ antes del modelo porque el proveedor rechazÃ³ `maxItems` en el JSON Schema del array `sections`. Se retirÃ³ ese lÃ­mite del esquema enviado al proveedor; la validaciÃ³n de aplicaciÃ³n conserva sus lÃ­mites. Se aÃ±adiÃ³ una regresiÃ³n y el paquete AI pasa 92/92 pruebas; el build de `@e-nora/ai` tambiÃ©n pasa.

La repeticiÃ³n HTTP A02 (`640169c5-f624-4a8f-9f6b-4a96c586aeec`) superÃ³ el rechazo del esquema y llegÃ³ a `claude-sonnet-5`, pero terminÃ³ `timeout` (`agent_provider_timeout_45000ms`) sin llamadas a herramientas ni salida evaluable; por ello no cuenta como validaciÃ³n E2E del juez. La lentitud de esta ruta queda registrada como problema abierto de ejecuciÃ³n/proveedor.

Se iniciÃ³ por HTTP el anÃ¡lisis Shopify de adquisiciÃ³n/conversiÃ³n para obtener una segunda verificaciÃ³n del servicio con `AI_JUDGE_MODE=shadow` y el paquete AI reconstruido con `judge-rubrics-v2`. El run `875503a3-1497-4868-b75f-b3eb1612b951` estaba aÃºn `running` al cierre de esta nota; no se anticipa su resultado. Las propuestas de anÃ¡lisis quedan sujetas al flujo de decisiÃ³n humana y no se aplicaron.

### A21: evidencia analÃ­tica real, juez v2 y fecha de ejecuciÃ³n (13-oct-2026)

La segunda ejecuciÃ³n autenticada por HTTP del panel Shopify en TEST completÃ³ A21 (`29f68693-fc90-4b0b-b2d5-0bc808cd7575`), guardÃ³ output `312c8099-37d1-48f9-b44e-c07dd47779c7` en `pending_approval` y produjo dictamen v2 `review` (`a913d8d8-f16f-4bbb-ac3e-6d635b498c8b`), 2,54/4. El candidato usÃ³ `gpt-6-luna` (46.202 tokens de entrada, 2.250 de salida). El juez consumiÃ³ 24.031 tokens de entrada, 1.339 de salida, tardÃ³ 15.632 ms y estimÃ³ 0,003073 USD.

La prueba valida la correcciÃ³n del paquete de evidencia: `shopify_funnel_health` y `shopify_margin_health` ahora persisten resultados analÃ­ticos acotados como `judge_evidence`; `search_knowledge` conserva solo la telemetrÃ­a de metadatos. La evidencia del funnel contiene 78.357 sesiones, 2.315 compras y cobertura de 91/91 dÃ­as. El juez contrastÃ³ las afirmaciones y citÃ³ rutas exactas del snapshot; no confundiÃ³ el recibo de llamada con prueba de una cifra. La rÃºbrica detectÃ³ (a) cifras de atribuciÃ³n presentadas sin reconciliar claramente todos los pedidos del periodo, y (b) una tarea de descuento que parece repetir una propuesta todavÃ­a abierta. TambiÃ©n verificÃ³ incertidumbre sobre abandono y atribuciÃ³n, y que no hubo acciÃ³n ejecutada. La valoraciÃ³n queda en `review`; no es certificaciÃ³n ni caso gold.

La primera pulsaciÃ³n HTTP de este ciclo recibiÃ³ 503 sin crear un `agent_run`; al repetirla, la ruta concluyÃ³ correctamente. El API permaneciÃ³ saludable. En la respuesta inmediata del run, la interfaz mostrÃ³ `Invalid Date`: el runner genÃ©rico no devolvÃ­a `generated_at`. Se corrigiÃ³ para devolver el `created_at` persistido de `agent_outputs`; la tarjeta tambiÃ©n oculta fechas invÃ¡lidas con el texto "fecha no disponible". Tras recargar la pantalla, la tarjeta A21 muestra la fecha vÃ¡lida `13/10/2026, 11:23:35`. El output mantiene dos propuestas pendientes; no se aprobaron, rechazaron ni aplicaron.

VerificaciÃ³n local de este ciclo: typecheck web y API correctos; 120 pruebas focalizadas de AI, runtime del juez y cobertura de rutas correctas; `git diff --check` sin errores (solo avisos de conversiÃ³n CRLF/LF del workspace). El servicio local `AI_JUDGE_MODE=shadow` siguiÃ³ en TEST. No se realizaron ejecuciones ni escrituras en producciÃ³n. El estado de muestra certificada sigue en 0 holdouts v2 y el gate de release continÃºa cerrado.

### A22: recibos de herramientas logÃ­sticas y scope de tienda (13-oct-2026)

La primera repeticiÃ³n de A22 en TEST terminÃ³ `review` 2,98/4: el juez detectÃ³ que las consultas de entregas y excepciones tenÃ­an solo `{ok:true}` en telemetrÃ­a, aunque la herramienta de comparaciÃ³n sÃ­ aportaba resultado. AÃ±adÃ­ sus salidas agregadas a la lista explÃ­cita de evidencia permitida. La repeticiÃ³n autenticada `7e292ec9-ff1f-452d-976a-ed3f478ae953` persistiÃ³ resultados acotados para `shopify_delivery_diagnostics`, `shopify_open_delivery_exceptions` y `shopify_return_delay_comparison`; el dictamen v2 terminÃ³ `passed` 3,27/4. El juez reconociÃ³ que las listas vacÃ­as no demuestran ausencia de incidencias y que no se ejecutaron cambios. DetectÃ³ que el resumen de devoluciones por producto estaba respaldado por el snapshot, pero no por recibo analÃ­tico explÃ­cito; lo tratÃ³ como lÃ­mite y pidiÃ³ que el artefacto hiciera visible el scope de las consultas.

Por ello, los recibos analÃ­ticos incluyen ahora `runtime_scope` con organizaciÃ³n y tienda asignadas por el servidor, y `result` separado con la salida acotada. El prompt del juez declara confiable ese scope generado por runtime para la consulta concreta y prohÃ­be inferirlo del texto del agente o de la propia herramienta. Se extendiÃ³ el allowlist a fulfillment/devoluciones, diagnÃ³sticos de logÃ­stica y excepciones abiertas; las herramientas de bÃºsqueda RAG siguen excluidas.

La tarjeta A22 muestra una fecha de generaciÃ³n vÃ¡lida y presenta abstenciÃ³n prudente: no propone tareas cuando las consultas estÃ¡n vacÃ­as. La validaciÃ³n final del nuevo `runtime_scope` y del paquete v5 queda registrada en la subsecciÃ³n siguiente. Estas pruebas crean outputs de diagnÃ³stico en TEST en estado sujeto al flujo de revisiÃ³n; no se aprobaron tareas ni se tocaron datos de producciÃ³n.

### A22: scope de herramientas verificado por el juez (13-oct-2026)

El paquete de evidencia pasÃ³ a `judge-evidence-pack-v5` para que la clave de idempotencia refleje la estructura nueva. La ejecuciÃ³n HTTP autenticada final `a814edf6-5b07-4c58-8f0a-5208bc043162` persistiÃ³ `runtime_scope` del servidor para las cuatro herramientas analÃ­ticas: organizaciÃ³n `5ebc7b02-ca86-402e-bd61-9abd22f1ee04` y tienda `5e84efa9-6e7f-4759-8b87-22119401bd81`; el resultado analÃ­tico aparece separado en `result`. `search_knowledge` no recibe este recibo especializado.

El dictamen del juez v2 fue `passed`, 3,59/4, coste estimado 0,002807 USD. El juez confirmÃ³ que el scope de tienda/periodo coincide con la evidencia y que no hay propuestas ni acciones ejecutadas. SeÃ±alÃ³ un matiz de calidad todavÃ­a abierto para A22: la herramienta de salud sÃ­ observÃ³ cero entregas tardÃ­as (y cero fulfillments), pero como los promedios son desconocidos no debe interpretarse como prueba de buen desempeÃ±o. El agente mantuvo una conclusiÃ³n prudente; conviene que explicite ambos datos y la limitaciÃ³n en una prÃ³xima revisiÃ³n del prompt.

### A02: ejecuciÃ³n detenida en la llamada al proveedor (13-oct-2026)

La primera repeticiÃ³n autenticada A02, run `84db253a-4879-41f9-8422-37e3bd59a9b9`, quedÃ³ huÃ©rfana porque el watcher del API reiniciÃ³ el servidor mientras estaba activa la llamada, despuÃ©s de editar un test dentro de `apps/api/src`. No se debe atribuir ese run por sÃ­ solo a un fallo del proveedor. Para separar ambas causas, se repitiÃ³ A02 sin tocar cÃ³digo durante la peticiÃ³n: run `f06d26eb-3d21-40be-8d7c-958d29a56329`, fijado a `claude-sonnet-5`, terminÃ³ `timeout` con `agent_provider_timeout_45000ms`, una llamada de modelo, cero herramientas y coste registrado de 0,015528 USD. La ruta llegÃ³ a la llamada real y no produjo output ni dictamen; esta segunda ejecuciÃ³n sÃ­ confirma un timeout reproducible de A02 y no cuenta como E2E aprobada. El servicio local permaneciÃ³ disponible. No se hicieron mÃ¡s reintentos de A02.

La suite API completa se repitiÃ³ despuÃ©s de reconstruir `@e-nora/contracts`: **1.109/1.109 aprobadas**. La primera corrida encontrÃ³ una prueba A22 frÃ¡gil: anclaba la lectura del RPC a la sintaxis antigua y no normalizaba CRLF. Se actualizÃ³ `shopify-delivery-comparison.test.ts` para localizar el registro actual del tool y normalizar saltos de lÃ­nea; su suite focalizada pasa **4/4** y la corrida API completa pasa sin fallos.

### A12: E2E autenticada de anÃ¡lisis de email en TEST (13-oct-2026)

Desde la vista Klaviyo autenticada se ejecutÃ³ el anÃ¡lisis A12. Run `ad6dd7c5-d068-4159-8bb5-6d678172ef69` terminÃ³ `succeeded` con `gpt-6-luna`, 3 llamadas de modelo, 3 herramientas y coste candidato de 0,007257 USD. Output `376d50f8-d9dc-4047-a4bd-0d2836b241a9`; dictamen `ef88ceae-7bbe-420d-879f-fdc9194f326c`, `judge-rubrics-v2`, `review` 2,50/4, 21.098 tokens de entrada, 1.662 de salida, 13.545 ms y 0,002941 USD estimados. La UI mostrÃ³ riesgos y una propuesta pendiente de decisiÃ³n. No se aprobÃ³ ni aplicÃ³ la propuesta. Esta es la primera E2E autenticada A12 y eleva la cobertura persistida a 14/26 perfiles con dictamen y 10/26 perfiles E2E HTTP autenticados (sin contar dos veces perfiles previos). Los dos intentos A02 no suman. La certificaciÃ³n gold/holdout sigue en 0.

### A28: E2E autenticada de arquitectura de flujos en TEST (13-oct-2026)

Desde el panel Klaviyo se ejecutÃ³ A28. Run `e54d9d38-e218-4cae-b684-6c9ceba4f3a4` terminÃ³ `succeeded` con `gpt-6-luna`, 2 llamadas de modelo, 1 herramienta y coste candidato de 0,004768 USD. Output `af709953-ac71-4d14-9e0d-bf6fec86b932` permanece `pending_approval` con `approval_required=true`. El juez `6ec57319-8730-4f94-a96f-2769158a08dd`, `judge-rubrics-v2`, quedÃ³ `review`, 2,83/4, con 22.133 tokens de entrada, 1.378 de salida, 11.787 ms y 0,002902 USD estimados. La tarjeta se abstuvo de diseÃ±ar flows: inventario, volumen elegible, filtros y audiencia no estaban disponibles; pidiÃ³ validar primero la conexiÃ³n y la cobertura. No se ejecutÃ³ ningÃºn cambio en Klaviyo ni se aprobÃ³ la propuesta. TEST registra 15/26 perfiles distintos con dictamen y 11/26 con E2E HTTP autenticada; siguen 0 gold/holdout adjudicados.

### A19 RevisiÃ³n: ruta especial y scope de TEST (13-oct-2026)

La revisiÃ³n de un Camino activo se ejecuta desde el orquestador de diagnÃ³sticos, no desde el generador de propuestas. El endpoint de reintento exige que la revisiÃ³n de la semana actual exista y estÃ© fallida o tenga su lease caducado; devuelve 409 si no es reintentable. TEST tiene un Camino activo (`a3cc6664-14ee-4a7a-a4b9-76dddcead931`) ligado al store `b61b5417-aaa0-4522-a325-f58e12e66021`, pero la UI autenticada solo ofrece `e-nora-demo.myshopify.com` (store `5e84efa9-6e7f-4759-8b87-22119401bd81`) y Â«Todas las tiendasÂ». La Ãºltima revisiÃ³n del plan activo fue `succeeded` el 5-oct; no existe revisiÃ³n de esta semana. No se disparÃ³ el orquestador global para evitar ejecutar diagnÃ³sticos ajenos a esta prueba, ni se cambiÃ³ el scope para forzarla. A19 RevisiÃ³n sigue sin E2E autenticada; requiere un plan activo del mismo store que el selector, o un trigger de orquestaciÃ³n acotado a organizaciÃ³n/plan en TEST.

### A27: acceso al planificador semanal no verificable desde el panel actual (13-oct-2026)

La vista Marketing mostrÃ³ inicialmente Â«Crear secuencia de emailsÂ», pero el estado terminÃ³ de cargar y cambiÃ³ a una vista con tres piezas pendientes de aprobaciÃ³n. Al volver a Hoy, el botÃ³n habÃ­a desaparecido; CampaÃ±as ofrece Â«Planificar campaÃ±as con A05Â», que no es el runner de A27. No apareciÃ³ el diÃ¡logo `WeeklyMailingPlanner`, no se creÃ³ fila en `marketing_mailing_sequences` y no se creÃ³ `agent_run`. No se aprobÃ³ ni enviÃ³ ninguna pieza. La ruta API de A27 existe, pero esta sesiÃ³n no dispone de un formulario A27 estable/verificable ni de un caso de entrada visible para llamar su endpoint sin inventar el brief. A27 continÃºa pendiente de E2E; la evaluaciÃ³n de la UX debe comprobar por quÃ© el acceso a A27 solo se muestra en un estado transitorio de carga.

### A06: previsiÃ³n de demanda y riesgo de stock en TEST (13-oct-2026)

La acciÃ³n Â«Actualizar previsiÃ³nÂ» del panel de Productos ejecutÃ³ el run autenticado `0125840c-948b-4050-8496-840e96004a16` para la tienda E-NORA Demo (`5e84efa9-6e7f-4759-8b87-22119401bd81`). TerminÃ³ `succeeded` con `gpt-6-luna`, una llamada al modelo, cero herramientas, 14.082 ms y coste estimado de 0,002634 USD. El output `9627e430-22b1-477e-9ad9-d86d6c5f4e0b` quedÃ³ `pending_approval`; no se escribiÃ³ ninguna propuesta de compra ni se aprobÃ³ acciÃ³n. El juez v2 (`85128f6b-0e35-4e20-a57f-bd2561d7c76f`) dio `review`, 2,95/4.

El resultado fue prudente sobre el inventario obsoleto (99,9 horas), la falta de cobertura y la ausencia de campaÃ±a/oferta confirmada para Black Friday. Sin embargo, el juez detectÃ³ que A06 seleccionÃ³ solo tres productos e ignorÃ³ otras seÃ±ales relevantes del mismo snapshot: Sudadera Capucha Arcilla (132 unidades vendidas y 6 disponibles) y Chaqueta Boreal Negra (123 y 8). TambiÃ©n detectÃ³ que el periodo indicado como 30 dÃ­as contiene 31 dÃ­as con ventas para dos productos, aunque A06 lo describe como demanda sostenida. Son defectos de priorizaciÃ³n y coherencia temporal que hay que corregir: incluir todos los candidatos con seÃ±al de riesgo, explicar la discrepancia de ventana y no cerrar el anÃ¡lisis en Â«ninguna reposiciÃ³nÂ» basÃ¡ndose solo en el subconjunto priorizado. La UI sÃ­ mostrÃ³ la advertencia de obsolescencia y que no se envÃ­an pedidos automÃ¡ticamente. Tras esta prueba: 16/26 perfiles distintos con dictamen y 12/26 con E2E HTTP autenticada; 0 casos gold/holdout adjudicados.

### A24: mediciÃ³n y entrega de Meta en TEST (13-oct-2026)

La ejecuciÃ³n autenticada desde el panel Meta generÃ³ el run `1ec114f1-f5e9-41cf-8d60-0fa061869c41`, output `f124b50c-8244-41a3-a61f-3110b623dcca` en `pending_approval`, y dictamen `d1d501b2-0933-4f54-b80c-7816525fbe7f`: `review`, 3,14/4 con `judge-rubrics-v2`. A24 mantuvo correctamente el veredicto determinista `unknown` y no concluyÃ³ que el pÃ­xel estuviera roto. El juez detectÃ³ sobreafirmaciones: la salida calificÃ³ account sync y actividad como stale/desconocidas aunque el snapshot solo marcaba stale pedidos/sesiones, y llamÃ³ Â«sin pÃ­xel sincronizadoÂ» a la falta de filas/mapeo, que no demuestra el estado de sync. La propuesta queda pendiente; no se aplicÃ³.

### A23: creatividad y subasta de Meta en TEST (13-oct-2026)

El run autenticado `a4b7a632-29a8-4347-8e2b-995d0c8280c9` terminÃ³ correctamente; output `91c16402-9bd7-464a-bd40-f94cdef3ebc3` quedÃ³ `pending_approval`. El dictamen `f7914996-ff10-4e85-b3f7-a39a7b3a25c3` quedÃ³ `no_evaluable` (`visual_bytes_or_render_not_attached`), no como aprobaciÃ³n: el A23 especÃ­fico usa `creative_decisions` y necesita evidencia visual para juzgar la decisiÃ³n. La abstenciÃ³n observada fue adecuada ante veredictos `SIN_VEREDICTO`, mediciÃ³n A24 desconocida y 3.977,75 EUR de gasto; no hubo escritura ni cambio de anuncios. Este resultado revela una brecha de integraciÃ³n: el flujo visual debe adjuntar el mismo render/bytes inmutables que se evalÃºan en el caso, o mostrar explÃ­citamente que el juez no pudo evaluar.

### A25: cambios de la cuenta Meta en TEST (13-oct-2026)

El run autenticado `519947ca-3dd2-4539-8ce8-0c4de88bae3b` produjo output `8d07aec1-9445-471c-81a8-19f1581005b9` `pending_approval` y dictamen `63efc11a-5501-4d4d-be88-ced65f29c907`, `review` 2,39/4. La abstenciÃ³n evita recomendar cambios ante una comparativa vacÃ­a, pero el juez detectÃ³ que no recoge actividad reciente de campaÃ±as/tareas, da por abierta una tarea compartida (`store_id=null`) sin explicar su alcance y concluye Â«sin trabajo nuevoÂ» sin explicitar que los registros vacÃ­os no prueban ausencia de cambios. No se aprobÃ³ ninguna propuesta ni se modificÃ³ Meta.

La cobertura acumulada de TEST, recalculada desde las 26 definiciones activas, queda en **19/26** perfiles con dictamen persistido (incluye tres `no_evaluable` y no debe presentarse como cobertura aprobatoria), **15/26** con ejecuciÃ³n HTTP autenticada y **0** casos gold/holdout adjudicados. A23 requiere completar la canalizaciÃ³n visual; para A24/A25 las salidas `review` son hallazgos para corregir antes de contar calidad aceptada.

### A23: juicio parcial de mÃ©tricas con visual no evaluable (13-oct-2026)

El snapshot del run `a4b7a632-29a8-4347-8e2b-995d0c8280c9` confirma que dos anuncios considerados no tenÃ­an asignaciÃ³n (`no_creative_assignment`), captura disponible ni bytes visuales. El preflight anterior bloqueaba toda la evaluaciÃ³n. Ahora permite juzgar evidencia numÃ©rica independiente y deja solo `visual_evidence` como `no_evaluable`; si falta un criterio crÃ­tico, el resultado no puede ser `passed`. VerificaciÃ³n: AI **258/258**, typecheck y build correctos; API **1.110/1.110** y typecheck correctos.

ReejecuciÃ³n HTTP autenticada en TEST: run `608718c6-dd1b-4f5e-b7fd-071814c22a6b`; output `dfacab5f-9d00-4a0c-b2f2-fd18ff443aff` sigue `pending_approval`; juicio `review`, 2,62/4, seis criterios evaluados, coste estimado 0,002587 USD. No se aprobÃ³ ni ejecutÃ³ ninguna propuesta. El juez encontrÃ³ que el texto de A23 atribuye falta de activo al anuncio `bd65af44`, que no aparece en los dos IDs de `visual_coverage.ads`, y que los recibos no traen `runtime_scope`. El agente debe alinear los anuncios sobre los que decide con los que incluye en su muestreo visual o marcar claramente el lÃ­mite por ID. La interfaz aÃºn no enseÃ±a cobertura de criterios del juez.

### A23 v3: HTTP repetido y trazabilidad de herramientas (13-oct-2026)

La migracion del gate `judge-rubrics-v3` esta aplicada y registrada en TEST y produccion; el gate sigue cerrado porque aun no existen casos v3 de calibracion/holdout. La ejecucion autenticada de TEST `1281ba7c-ae54-4bf4-84d1-42902f7f8d53` genero el dictamen v3 `03cb8c5e-c996-40a0-adc3-069411370857`: `review`, 2,96/4, seis criterios evaluados y `visual_evidence` no evaluable. El juez permitio evaluar metricas/decision sin imagen y mantuvo el resultado fuera de `passed`. No hubo escrituras ni propuestas aprobadas.

Hallazgo operativo: la ejecucion `f85c972e-e924-4e44-8e52-ed293bff518f` registro 3 llamadas de herramientas en `agent_runs`, pero solo un recibo en `agent_tool_calls`; el juez la marco `no_evaluable` por discrepancia. En una consulta de los ultimos 30 dias, 2 de 253 ejecuciones muestran mas llamadas que recibos (una es una ejecucion previa de A09). No se relajo este control. `recordToolCall` ahora registra explicitamente errores de insercion en los logs de API para que la siguiente reproduccion identifique si falla la persistencia; el typecheck API y `git diff --check` pasan. Sigue pendiente repetir un caso que invoque herramientas y confirmar conteos iguales antes de cerrar esta brecha.

El dictamen v3 tambien detecta dos ajustes de calidad para A23: `SIN_VEREDICTO` no prueba por si solo que Meta no emitiera un veredicto o que faltara volumen; y falta `runtime_scope` cuando no se usa ninguna herramienta. Debe conservar la redaccion descriptiva respaldada por el snapshot y hacer visible el alcance de la tienda desde la propia evidencia congelada.

### Seguimiento v4 y prueba de interfaz (13-oct-2026)

La migracion `20261220120000_agent_judge_rubric_v4_release_gate` esta presente en TEST y produccion; `db:push:dry` y `db:push:prod:dry` no detectan pendientes, y ambos verificadores del gate responden `AGENT_JUDGE_RELEASE_GATE_OK`. Esto solo confirma que el gate exige el dictamen correcto ligado al hash; no acredita que el juez este certificado ni que produccion ejecute el codigo v4. Los datos de TEST siguen teniendo cero casos gold/holdout adjudicados para certificar v4.

Se comprobo A23 desde la interfaz autenticada local. El run `f6e988f7-362c-4727-a350-d771a47b7ca1` termino `succeeded`, con dos herramientas y un dictamen `review` v3 de 3,17/4. La salida fue mas precisa: no dedujo que `SIN_VEREDICTO` fuera desfavorable y mantuvo la abstencion economica ante A24 desconocido. El juez senalo limites de periodo/recibos y la falta de bytes visuales sigue dejando el criterio visual fuera de evaluacion. Esta ejecucion demuestra que la interfaz crea y persiste un run, pero no prueba v4: el registro conserva `judge-rubrics-v3`.

Tras compilar `@e-nora/ai` (que exporta desde `dist`), un segundo clic devolvio en UI Â«No se pudo regenerar el diagnostico IA por un error de redÂ». La base no muestra un run A23 nuevo: el dictamen de `f6e988f7-362c-4727-a350-d771a47b7ca1` se persistio a las 10:42 UTC, minutos despues de crear ese run, y sigue siendo v3. El endpoint `/health` de la API local respondio 200, pero no se capturaron logs del proceso que identifiquen la causa. Por tanto, el error de regeneracion queda abierto; no se debe presentar A23 v4 como probado en vivo. La cobertura persistida actual es 20/26 perfiles distintos con dictamen y 0 casos gold/holdout adjudicados. Los typechecks AI/API, build AI, suite AI (258/258), suite focalizada API (36/36), los verificadores TEST/PROD, ambos dry-run de migraciones y `git diff --check` pasan en esta tanda.

### A23 v4: runtime recargado, recibos incompletos (13-oct-2026)

Se recargo la API local tras compilar `@e-nora/ai` porque el servidor anterior mantenia la constante de rubrica en memoria. La vista autenticada creo el run TEST `6ad64cb5-517e-47ab-9159-b4f82e3ad290`, `succeeded`, con cuatro llamadas de herramienta contabilizadas, tres llamadas de modelo y output persistido. El dictamen `bae60559-371a-4e33-8f17-ba9a864ed471` usa `judge-rubrics-v4`, lo que confirma el arreglo de carga de version, pero es `no_evaluable` (`tool_receipts_incomplete`). El run-step registra `tool_calls=4`; `agent_tool_calls` conserva solo dos filas (`meta_creative_diagnostics` y `search_knowledge`). No se relajo el control ni se conto como validacion de calidad A23. Investigar la diferencia de dos recibos es ahora el bloqueo tecnico inmediato para una evaluacion v4 con herramientas; despues sigue pendiente el criterio visual por falta de bytes.

Se agrego a `recordToolCall` una anotacion `tool_receipt_persist_failed` en `agent_run_steps`, con nombre de herramienta y error tecnico acotado (sin payload), cuando Supabase devuelve un error al insertar el recibo. La API typecheck y las pruebas focalizadas de runtime/dataset/cobertura (22/22) pasan. La siguiente repeticion desde UI creo el run `1ba61167-0fa9-42b9-b07d-72de4060c734`, con cero tool calls y cero recibos; su dictamen v4 `5169bb92-21d4-4ac7-8482-c70e985c8c70` fue `review` (no certificacion), y detecto que la salida usa compras/ROAS reportados pese a A24 desconocido y que no aclara la ventana temporal. Esta ejecucion no reprodujo la discrepancia 4/2, asi que la causa de aquellas dos inserciones perdidas sigue abierta. El criterio visual continua no evaluable sin bytes adjuntos.

### A23: rechazo de argumentos y recibo ausente (13-oct-2026)

ReproducciÃ³n desde Â«Actualizar ahoraÂ» en TEST: run `ebd8a9ed-7665-4c0b-a891-a79d57ade759`, completado; `tool_call_count=4`, 2 recibos (`meta_creative_diagnostics`, `search_knowledge`) y dictamen v4 `no_evaluable` por `tool_receipts_incomplete`. No hubo error de inserciÃ³n ni evento de herramienta no autorizada. El rastro confirma que el proveedor informÃ³ cuatro `tool_use`; no permite recuperar los argumentos de las dos llamadas sin recibo.

Causa probable verificada en el flujo: las herramientas que fallan `parseToolInput` retornaban antes de `recordToolCall`. Ese camino dejaba contar el intento en `tool_call_count` sin guardar evidencia de que se rechazÃ³ de forma segura. Ahora `rejectToolInputWithReceipt` persiste el nombre, argumentos sanitizados y error de contrato, sin ejecutar esos argumentos; los ocho puntos de validaciÃ³n usan el camino asÃ­ncrono comÃºn. Prueba unitaria nueva: **1/1**; typecheck API: **correcto**.

La repeticiÃ³n posterior al cambio, run `35f3f1f8-1bca-4b38-bb58-27b512408e81`, terminÃ³ con cero llamadas de herramientas, por lo que no ejercitÃ³ el camino corregido; al consultar aÃºn no habÃ­a dictamen persistido. La correcciÃ³n queda pendiente de verificaciÃ³n E2E con un run que invoque una herramienta y, en particular, rechace argumentos. La API local respondiÃ³ 200 en `/health` tras el cambio.

### A23 post-correcciÃ³n: snapshot y cobertura de anuncios; rÃºbrica v5 (13-oct-2026)

El run `6ec12105-76a8-4c54-b914-db41db0bd200` terminÃ³ con 0 llamadas a herramientas, 0 recibos y un dictamen v4 `review` 2,84/4. El juez fue prudente sobre A24=unknown, pero penalizÃ³ las cifras de gasto/impresiones/CTR por no tener recibos aunque esos valores sÃ­ estÃ¡n en `immutable_snapshot.blocks[3].data`. Ese dictamen tambiÃ©n comprobÃ³ que el snapshot contenÃ­a tres anuncios y que A23 produjo decisiones solo para Prospecting y el agregado general; omitiÃ³ explicar los otros dos anuncios. El criterio visual siguiÃ³ `no_evaluable` por ausencia de bytes/render.

La rÃºbrica v5 de A23 aclara que el snapshot es evidencia directa de los valores que contiene; exige recibos para validar llamadas, scope o datos ausentes del snapshot. TambiÃ©n requiere cubrir cada anuncio o explicar omisiones, y separa resultados descriptivos de atributos visuales/causalidad. Se versionaron `judge-rubrics-v5` y el dataset operativo de referencia `judge-gold-v5`; el gate fuerza una nueva certificaciÃ³n antes de promociÃ³n.

La correcciÃ³n de recibos de argumentos invÃ¡lidos estÃ¡ en `rejectToolInputWithReceipt`: registra de forma sanitizada las llamadas que el contrato rechaza antes de entrar al ejecutor. Prueba especÃ­fica 1/1; no se pudo verificar E2E porque los runs posteriores (`35f3f1f8-1bca-4b38-bb58-27b512408e81` y `6ec12105-76a8-4c54-b914-db41db0bd200`) no invocaron herramientas.

MigraciÃ³n `20261220130000_agent_judge_rubric_v5_release_gate.sql` aplicada y verificada en TEST y producciÃ³n; `db:push:dry` y `db:push:prod:dry` sin pendientes, y ambos verificadores de gate devuelven `AGENT_JUDGE_RELEASE_GATE_OK`. VerificaciÃ³n local: AI **14/14**, API focalizada **28/28**, typecheck API y build AI correctos. Falta reejecutar con el servicio cargando v5, revisar el dictamen resultante y certificar casos adjudicados de gold/holdout v5; hasta entonces la promociÃ³n sigue bloqueada.

### A23: recibos de rechazos validados en E2E; juez v5 en servicio (13-oct-2026)

Tras recargar la API y ejecutar A23 desde la interfaz autenticada, el run `3478e1a6-4167-4370-baf1-ccee52bcad98` terminÃ³ `succeeded` con **6 llamadas y 6 recibos**. La base contiene cuatro recibos explÃ­citos `is_error=true`, `output.error=invalid_tool_input` para `meta_creative_diagnostics`, mÃ¡s dos llamadas vÃ¡lidas. Esto confirma la causa del antiguo 4/2: los argumentos rechazados por contrato antes del executor no se persistÃ­an. La nueva ruta los conserva sanitizados sin ejecutar argumentos invÃ¡lidos.

El juez persistiÃ³ el dictamen `review` **2,84/4** bajo `judge-rubrics-v5`. La rÃºbrica usÃ³ valores del snapshot sin exigir recibos adicionales; mantuvo `visual_evidence` no evaluable por falta de bytes. A23 cubriÃ³ los tres anuncios en un resumen agrupado, pero no emitiÃ³ una decisiÃ³n especÃ­fica para dos IDs y el juez lo penalizÃ³. Sus criterios distinguieron que compras y ROAS sÃ­ estÃ¡n en el snapshot, aunque A24 desconocido impide usarlos para decisiones econÃ³micas.

Se corrigiÃ³ tambiÃ©n el resumen contradictorio del proveedor: ahora se deriva de los criterios adjudicados y sus racionales. La verificaciÃ³n local pasa: AI **15/15**, API **28/28**, typecheck API y build AI; migraciÃ³n y release gate v5 permanecen aplicados/verificados en TEST y producciÃ³n. Pendiente: mejorar la cobertura por anuncio de A23 y completar adjudicaciÃ³n gold/holdout v5 antes de abrir promociÃ³n.

## AuditorÃ­a de cobertura vigente (13-oct-2026, TEST)

La comparaciÃ³n del catÃ¡logo `AGENT_EVAL_AGENT_CODES` con `AGENT_JUDGE_RUBRICS` confirma **26/26 perfiles** con criterios de dominio: 81 criterios especÃ­ficos en total, todos con ID Ãºnico. Tener rÃºbrica definida no demuestra que el agente haya sido juzgado en una ejecuciÃ³n real.

Consulta de solo lectura a TEST (`kopcblejsxpkxoykldyh`) a `agent_run_judgments`: **63 decisiones para 20/26 cÃ³digos**. Hay ejecuciones juzgadas para A04, A05, A06, A09, A12, A13, A14, A15, A16, A17, A18, A19 arquitecto, A20, A21, A22, A23, A24, A25, A26 y A28. Sin decisiones persistidas: **A01, A02, A08, A11, A19 revisiÃ³n y A27**. Los estados incluyen `error`, `no_evaluable`, `review` y `passed`; el conteo mide cobertura de ejecuciÃ³n, no aprobaciones.

La consulta de TEST a `agent_judge_eval_cases` devolviÃ³ **0 casos**, por lo que no hay muestras gold/holdout ni adjudicaciones humanas utilizables en ese entorno. El juez no estÃ¡ certificado para ningÃºn agente por evidencia de referencia, aunque existan decisiones `passed` de ejecuciÃ³n.

La ruta `judgePersistedAgentOutputNow` valida pertenencia al catÃ¡logo, captura snapshot y recibos, construye paquete de evidencia y persiste el dictamen con versiÃ³n/hash. Las verificaciones globales de evidencia pueden cerrar en `no_evaluable`; requieren casos y artefactos especÃ­ficos por contrato para distinguir falta real de evidencia de ausencia de soporte del runner. La siguiente tarea prioritaria es habilitar una ejecuciÃ³n real con datos/snapshot/recibos para A01, A02, A08, A11, A19 revisiÃ³n y A27; en paralelo, poblar gold y holdout adjudicados por criterio, sin etiquetar automÃ¡ticamente resultados del juez como referencia humana.

## A27 ejecuciÃ³n autenticada y correcciÃ³n de rÃºbrica v6 (13-oct-2026)

Se incorporÃ³ un acceso permanente Â«Planificar secuencia de emailsÂ» en Marketing â†’ CampaÃ±as. Antes, el acceso de A27 solo aparecÃ­a en el estado vacÃ­o de Hoy (Â«No hay nada pendienteÂ»); al existir campaÃ±as o piezas pendientes, desaparecÃ­a. El CTA abre el planificador y aclara que genera una propuesta para revisar, sin enviar ni publicar.

E2E en portal autenticado y TEST: secuencia Â«TEST juez A27 Â· secuencia octubreÂ», tres emails para el 19, 21 y 23 de octubre. Run `93910949-0f4a-4d40-b530-081181b8f839`: `succeeded` con `gpt-6-luna`, 47.055 ms y coste de agente estimado de 0,005901 USD. Output `12d0e54c-c49c-4b3a-aab5-f2d9fde18c85`: `pending_approval`, `approval_required=true`. Juicio `660608c9-58a3-4c4a-af52-42d6a3722b20`: `review`, **2,90/4**, `judge-rubrics-v5`, coste 0,003361 USD y 15.169 ms. La estrategia detecta el conflicto con la campaÃ±a prevista del 20â€“21, preserva las fechas solicitadas y evita inventar producto/urgencia. ComprobaciÃ³n SQL: secuencia `planned`, cero borradores; no se aprobÃ³ ni se redactÃ³ pieza final.

El juicio v5 revelÃ³ desajustes del contrato del juez, no fallos de la salida: (1) exigÃ­a `scheduled_for` en cada elemento aunque el schema de A27 lo vincula por `sequence_number` a `scheduled_dates[]` del snapshot; (2) penalizaba `copy_brief`, aunque es el brief que A27 prepara para que A11 redacte despuÃ©s. La rÃºbrica v6 explicita esa correspondencia, permite briefs estructurados y mantiene el lÃ­mite contra copy final, borradores y envÃ­os. TambiÃ©n aclara que una recuperaciÃ³n RAG vacÃ­a no puede fingirse ni penalizarse como si hubiera contenido recuperado; debe seÃ±alarse si la falta de recuperaciÃ³n afecta materialmente la recomendaciÃ³n.

La migraciÃ³n `20261220140000_agent_judge_rubric_v6_release_gate.sql` se generÃ³ con Supabase CLI 2.109.1, revisando la guÃ­a oficial de migraciones; aplicada en TEST y producciÃ³n. Verificaciones: `AGENT_JUDGE_RELEASE_GATE_OK` en ambos entornos y `db:push:dry`/`db:push:prod:dry` sin pendientes. El gate exige juicio candidato y holdout de rÃºbrica v6. Se revisaron los advisors de seguridad y rendimiento de ambos proyectos; reportan avisos globales de base (entre ellos RLS privado sin policy y FKs sin Ã­ndice), no relacionados con la funciÃ³n reemplazada por esta migraciÃ³n.

Pruebas locales: AI **260/260**, API focalizada **28/28**, build AI y typecheck web correctos. TEST ahora tiene **64 dictÃ¡menes para 21/26 perfiles**; A27 ya estÃ¡ incluido. Quedan sin dictamen A01, A02, A08, A11 y A19 RevisiÃ³n. `agent_judge_eval_cases` continÃºa en cero; v6 no estÃ¡ certificado. El cÃ³digo local aÃºn no se ha desplegado a producciÃ³n; la migraciÃ³n sÃ­, y el gate productivo queda cerrado hasta desplegar cÃ³digo compatible y certificar referencias v6.

### Hallazgo A27: corpus RAG vacÃ­o en una ejecuciÃ³n real

El snapshot de la ejecuciÃ³n A27 informa `internalMailingPlaybook.status=available` con `entries=[]`. La estrategia sigue siendo Ãºtil, pero no demuestra adaptaciÃ³n a conocimiento interno recuperado. La rÃºbrica v6 no debe atribuir este fallo de retrieval al modelo: el release dossier debe medir retrieval por separado (corpus habilitado, consultas/filtros, candidatos, ranking, freshness y cita de principio aplicable) y exigir cobertura mÃ­nima de referencias A27 antes de certificar la calidad estratÃ©gica. No se debe considerar `available` equivalente a Â«se recuperÃ³ conocimiento relevanteÂ».

### A11: generaciÃ³n y juez en TEST (13-oct-2026)

La ejecuciÃ³n autenticada `a8fdcc0c-8f8c-4e4c-bea4-a8f21a2c6da3` terminÃ³ `succeeded` con A11 y `gpt-6-luna` (36.370 ms; coste estimado 0,015584 USD). Output `d3db5497-9f52-4481-99ef-feb572a3ebe5` quedÃ³ `pending_approval`; el borrador no se aprobÃ³ ni enviÃ³. El juez v6 terminÃ³ `review`, 2,58/4, 7 criterios, coste 0,001199 USD y 12.829 ms. El worker reintentÃ³ dos veces tras un error temporal del proveedor/validaciÃ³n y completÃ³ el juicio; el job quedÃ³ `completed`.

El juez encontrÃ³ hallazgos Ãºtiles: el borrador mantiene `URL_COLECCION`, `DIRECCION_POSTAL` y `ENLACE_BAJA` sin resolver; afirma novedad de temporada sin evidencia; el brief usa `integration_connections.id` y los recibos `shopify_stores.id`, dos IDs que corresponden a la misma tienda activa segÃºn la relaciÃ³n verificada en TEST. Para reducir ese falso positivo y fortalecer la verificaciÃ³n, el snapshot A11 incorpora el cruce de IDs generado por servidor y los recibos conservan evidencia acotada del catÃ¡logo, sin datos de clientes. La salida debe seguir en revisiÃ³n por sus placeholders y claims; el cruce de IDs no convierte esas faltas de contenido en aprobaciÃ³n.

Las dos primeras ejecuciones de diagnÃ³stico fueron rechazadas antes de crear outputs: tono de mÃ¡s de 120 caracteres y `href` invÃ¡lido. A11 ahora permite tono de hasta 300 caracteres y usa un contrato intermedio que deja al runtime retirar enlaces invÃ¡lidos sin inventar destino; el contrato persistido final continÃºa exigiendo URL vÃ¡lida o `null`. TambiÃ©n se eliminan del HTML los `href` no verificables y se aÃ±ade aviso al output. Suite AI **261/261** y build API correctos tras los cambios; no se enviÃ³ ni publicÃ³ contenido.

El recuento directo posterior en TEST queda en **66 juicios para 22/26 cÃ³digos**. Faltan A01, A02, A08 y A19 RevisiÃ³n. Hay 9 estados `error`, 8 `no_evaluable`, 43 `review` y 6 `passed`; estos estados son ejecuciones, no una certificaciÃ³n. Los casos gold/holdout adjudicados siguen en 0 y el gate permanece cerrado. La migraciÃ³n v6 estÃ¡ en TEST/producciÃ³n; el cÃ³digo local de esta tanda aÃºn no estÃ¡ desplegado a producciÃ³n.


### A01: live judge exercise in TEST (13-Oct-2026)

Ran the existing five-scenario A01 harness with `AI_JUDGE_MODE=visible`; synthetic organizations were deleted by the harness after each scenario. The harness now reads the persisted `agent_run_judgments` row before cleanup, so a provider error cannot disappear from the test report. API typecheck passes.

Results captured before cleanup: `tareas_claras` = `error` (`judge_provider_or_validation_failed`); `sin_tareas_accionables` = `review` 2.97/4; `tarea_sin_responsable` = `passed` 3.32/4; `audio_deficiente` = `passed` 3.46/4; `varios_interlocutores` = `passed` 3.21/4. Agent checks: 0 hard failures, 2/13 soft heuristic failures. Estimated agent generation cost: $0.0042, excluding the judge. This is a live behavioral probe, not a gold/holdout case or certification.

Findings for A01: the judge error path is real and the prior harness hid it; preserve per-run judge status/error in future eval output. Candidate outputs repeatedly miscount transcript turns (5 turns reported as 6), and a task description invents the name Elena although the transcript identifies only the role Client. For multi-speaker calls, task owners remain role-level (`cliente`) even when Marta and Pedro are named; the rubric should evaluate attribution in both the narrative and the task artifact, and the output contract may need to preserve person-level assignees. Three `passed` results do not erase these criteria-level findings. TEST remains at 66 persisted judgments because the harness removes its synthetic organizations; A01 is not counted as persisted live coverage. Evaluation cases and adjudicated gold remain at zero.

### A02: bounded TEST probe stopped after a runaway case (13-Oct-2026)

Ran the existing A02 scenario harness with `AI_JUDGE_MODE=visible`, adding a pre-cleanup query of the persisted judgment row to the harness. Stopped after three scenarios when `stock_roto` cost reached $1.081286 and latency 163,566 ms, over the harness gates of $0.15 and 45,000 ms; the run made 8 model calls, 8 tool calls, and reported 502,518 input tokens. The scenario's deterministic check also failed: no stock evidence tied the finding to the seeded product and its 40 sold / 2 available values. The judge itself errored (`judge_provider_or_validation_failed`).

Earlier scenarios: `sin_datos` returned 502 because `headline` exceeded the 255-character contract; `sin_configuracion_financiera` completed at $0.1431 and 123,470 ms, failed the latency gate, and received `review` 2.73/4. The remaining three scenarios were not run. The active synthetic organization and A02 eval user were deleted after stopping; no existing client record was changed. These are diagnostic probes, not gold labels. They show A02 needs hard token/tool-call budgets, shorter evidence packs, schema-constrained headline length, a tested timeout strategy, and a runtime cost circuit that interrupts work before the harness's post-run gate. As expected from cleanup, persisted judge count remains 66 and A02 has no durable run judgment.

### A08: RAG scope, stale fixture, and judge errors in TEST (13-Oct-2026)

Ran the isolated `catalogo_vacio` scenario twice with `AI_JUDGE_MODE=visible`; each synthetic organization was removed by the harness. TEST currently contains 316 active global knowledge documents, all `visibility=global` and `audience=consultant_only`; therefore the fixture's former claim that the global catalog was empty was false. Its soft check expected the agent to say the catalog was empty and produced a misleading failure. Updated the fixture to describe an empty organization scope inside a populated global corpus, and check for scope separation and explicit coverage limits. The second run passes its hard scope check and soft coverage check.

The first two runs produced useful, cautious reports based on a truncated catalog sample and semantic search, without editing or creating knowledge documents or tasks; both reported `judge_provider_or_validation_failed` before cleanup. A third run confirmed the async judge job can complete: job `completed`, 1 attempt, no `last_error`; persisted judgment `review` 2.48/4 on `judge-rubrics-v6`. The earlier failures remain unexplained and could not be inspected after cleanup. The current output's `sources` include document titles, visibility and audience labels, but not stable document IDs/checksums; A08's judge rubric and evidence pack should require those identifiers for claims about corpus coverage, duplication or freshness. The test now captures both the judgment and queue job before cleanup, so future runs distinguish queue/provider failure from candidate quality. The successful third run cost $0.00302, 25,205 input tokens, 2 model calls, 1 tool call and 12.75 s. These are live probes only; no gold labels were created.

### A19 Revision: synthetic end-to-end judge evaluation in TEST (13-Oct-2026)

Added `apps/api/src/eval-a19-weekly-review.ts` and `eval:a19:review`: it creates a synthetic tenant and an active Camino with no phases/hitos, invokes the actual weekly-review runtime, reads the persisted review/plan/judgment/job before cleanup, and deletes the synthetic tenant and user in `finally`. API typecheck passes. This is a direct runtime probe, not an authenticated HTTP-route test or gold case.

The latest run `9e3a0269-fab7-4ede-9095-7a6394423fbc` saved review `0c35f353-582d-4d79-bdd8-c1bedd81b0ee` as `succeeded`, output `303be8fa-838c-4d43-94e7-013fe5835740`, and judge job `completed` in 1 attempt. Judgment: `passed`, 3.41/4, `judge-rubrics-v6`; generation cost $0.001408, judge cost $0.001205. The plan remained `active`, version 1; `change_proposals` was empty, no task or plan mutation was made, and cleanup removed the synthetic tenant. A second run scored `review`, 2.86/4, showing run-to-run variance.

The agent correctly abstained from measuring progress on the synthetic Camino: no target/baseline, phases or milestones, and no connected sources. It did not treat zero-valued summaries as proof of no sales and kept recommendations pending human review. The rubric caught a window mismatch: the three-day review period and `measurement_window_days=1` were not reconciled; it also noted the missing store identifier in the snapshot. In the latest `passed` run, factuality, scope, uncertainty and progress-measurement scored 3/4 while safety, goal-drift and revision-safety scored 4/4. The judge should require the time windows and store scope to agree before A19 Revisión can pass; this is not yet enforced as a critical gate. TEST still has no persisted A19 Revisión judgment after cleanup, and its earlier live review from 2026-10-05 predates judge activation and has no linked judgment.

### Rúbrica v7: mínimos por criterio de dominio (13-oct-2026)

La v6 permitía `passed` por media global aunque un criterio de dominio quedara en 3/4. Se añadió `minimumPassScore`, que el servidor aplica al finalizar el juicio: si un criterio no llega a su mínimo o queda no evaluable, el estado final no puede ser `passed`; el resumen también expone el criterio que no alcanza el mínimo. A02 `prioritization` exige 4/4 porque la prueba de stock usaba solo un día de demanda y aun así se describió el riesgo como claro. A19 Revisión `progress_measurement` exige 4/4 porque una prueba `passed` dejó sin conciliar la ventana revisada frente a `measurement_window_days` y carecía de identificador de tienda. La instrucción del juez incluye ambos requisitos. Pruebas cubren una media superior a 3.2 con el criterio por debajo del mínimo y verifican que termina en `review`.

La versión activa local cambia a `judge-rubrics-v7`; el panel inicia un dataset `judge-gold-v7` y el verificador de release exige la función SQL con v7. La migración `20261221130000_agent_judge_rubric_v7_minimum_domain_thresholds.sql` quedó aplicada y registrada mediante `db:push --only=20261221130000` en TEST y producción. Verificación SQL en ambos: una fila de migración, la función `private.agent_version_has_release_evidence` exige v7, y continúan 0 casos y 0 adjudicaciones. Los verificadores de release devolvieron `AGENT_JUDGE_RELEASE_GATE_OK` en ambos entornos. La aplicación backend/frontend v7 todavía no está desplegada; el gate sigue cerrado por falta de certificación gold/holdout.

Verificación local de esta tanda: AI **262/262**, API focalizada **1.111/1.111**, typecheck API y web correctos, `git diff --check` sin errores. Las suites verifican lógica y contratos, no calibración humana ni calidad de producción. TEST continúa con 66 juicios durables y 22/26 perfiles; las pruebas sintéticas se limpian y no cuentan como cobertura.

### A02: result after enforcing the runtime budget (13-Oct-2026)

The initial runaway probe above ran with the agent's ordinary $2 runtime budget; the $0.15 check was only post-run. A later isolated `stock_roto` run applied `AI_MODEL_ROUTING_JSON` with `maxCostUsd=0.15` and `maxToolCalls=24` before starting the agent. One run completed for $0.042798 in 39,416 ms and the visible judge returned `passed`, 3.31/4. The deterministic stock check passed, and the immutable snapshot showed 40 units sold, 2 available, one selling day and `stock_coverage_sample_sufficient=false`. The judgment still described a clear stockout risk; its uncertainty/prioritization scores were 3/4, so the aggregate threshold allowed `passed` despite the weak demand sample. This is a rubric calibration finding, not evidence that the case is gold-labelled.

Repeated the same isolated scenario under the same $0.15 runtime cap. Run `108d1551-8def-4e1c-a1cb-58669557d6e4` ended `timeout` after the provider's 45,000 ms limit, with $0.013826 accumulated generation cost, one model call, no tool calls, no candidate output and no judge job. The runtime cap therefore bounded spend, while the latency/provider timeout still prevented usable completion. The harness printed the cost in run diagnostics but incorrectly reported total scenario cost as $0.0000; updated its failure path to include persisted failed-run cost in the aggregate and apply the same cost gate. The runScenario `finally` cleanup removed its synthetic organization; the harness's outer `finally` removed the eval user. This is a live probe, not a gold/holdout case. TEST remains at 66 durable judgments, 22/26 agent codes, 0 eval cases and 0 adjudications.

### Hallazgo de arquitectura visible/shadow (13 oct 2026)

Revisé `judgePersistedAgentOutput` en el runtime: `shadow` persiste el job y devuelve `queued` para que lo procese el worker; `visible` persiste el job, ejecuta el juicio con `await` dentro de la petición original y devuelve el resultado/error al caller. El job durable ofrece recuperación/reintento, pero no hace asíncrono el modo visible. Corregí el diagrama de `PLAN_FINAL_JUEZ_26.md` para representar rutas distintas. Antes de habilitar visible faltan mediciones de p95/p99 de latencia, timeout/fallback bajo carga y verificación de cómo los callers presentan `error`, `review` y `no_evaluable`. Si se exige que la generación no espere al juez, hace falta un contrato visible asíncrono con estado `pending`, endpoint/polling o evento de actualización y UX correspondiente. Los probes de A02 también muestran timeout de generación; no son evidencia de latencia del juez ni gold.
