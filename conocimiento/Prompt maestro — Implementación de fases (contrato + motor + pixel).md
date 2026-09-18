Estas continuando la conversion de **EcomScaling** de conocimiento (`conocimiento/fase-XX/`) a
software real. No estas empezando un modulo nuevo: estas retomando un trabajo en marcha, bloque
a bloque, con un metodo ya validado en la fase 3. Este documento es ese metodo, para que lo
repitas sin tener que redescubrirlo.

No dupliques lo que ya esta escrito en otro sitio. Este prompt te dice **como trabajar**; los
documentos de abajo te dicen **que hay que hacer y en que orden**. Leelos en este orden antes de
tocar nada:

1. **[docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md](../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md)**
   — el procedimiento, el orden entre fases (F3 -> F4 -> F7 -> F8 -> F9, cada una **completa**
   antes de abrir la siguiente) y el apartado 8, "Donde estamos", que dice exactamente en que
   bloque va la obra ahora mismo.
2. **[conocimiento/IMPLEMENTACION.md](IMPLEMENTACION.md)** — una fila por bloque de los 129, con su
   estado (`sin destilar` -> `pendiente` -> `en curso` -> `contrato` -> `hecho`) y donde vive su
   codigo. Responde "¿esto ya esta hecho?" sin abrir un solo artefacto.
3. **`conocimiento/fase-XX/IMPLEMENTACION.md`** de la fase activa — la bitacora: que se decidio en
   cada bloque, que alternativa se descarto, que quedo fuera y por que. Es el razonamiento que no
   cabe en el indice.
4. **[conocimiento/TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)** — lo que quedo abierto, separado
   por quien puede cerrarlo. Antes de dar un bloque por hecho, comprueba que no dejas ahi una
   deuda sin anotar.

Con eso sabes en que bloque estas y que dice su artefacto. Lo que sigue es **como convertirlo en
software** sin repetir los errores que ya se cometieron una vez.

## La regla que no se negocia: contrato + motor + pixel

Un bloque no esta `hecho` con solo una de las tres patas. Las tres, o el bloque se queda en
`contrato` y se dice asi en el indice:

| Pata | Que es | Sin ella |
| --- | --- | --- |
| **Contrato** | tipos en `packages/contracts`, migracion idempotente, invariantes con test | no hay garantia |
| **Motor** | codigo que **escribe** esas tablas contra datos reales, no solo las describe | la garantia no protege nada: no hay filas |
| **Pixel** | una pantalla donde alguien —consultor, cliente o platform_admin— lo ve | el producto no cambia |

Esto se corrigio el 2026-09-25 al cerrar F3 con 15 bloques "completos" que en realidad tenian
esquema y cero filas y cero pantallas. No repitas ese error: **motor y pixel se construyen en la
misma sesion que el contrato del bloque**, no en una pasada posterior "cuando toque". Si de verdad
no toca todavia (por ejemplo, el motor de un bloque depende de senales que otro bloque aun no
emite), se anota como recorte con fecha y el bloque que lo desbloquea — no se deja implicito.

## Regla transversal: Copiloto primero

EcomScaling se construye para que el Copiloto pueda razonar con datos verificables y llevar al
consultor hasta el punto exacto de la aplicacion. Por eso la pantalla no es el final del bloque:
cada bloque debe declarar tambien **como lo consume el Copiloto**, aunque la respuesta sea que aun
no lo consume porque no escribe datos o porque el contrato no permite exponerlo.

Esta regla se aplica hacia atras a los bloques ya marcados `hecho` y hacia delante a todas las
fases. No reabre silenciosamente un bloque cerrado: la deuda de integracion se anota como tarea
transversal y se cierra con su propia verificacion.

Para cada bloque, durante la misma sesion de implementacion o de auditoria, comprueba:

- **Contexto o tool de lectura:** el Copiloto tiene una fuente estable, tenant-scoped y con
  procedencia para leer el resultado. Puede ser una tool nueva, una extension de una tool
  existente o un adaptador de contexto; se escribe cual de las tres es.
- **Semantica conservadora:** se preservan `UNKNOWN`, `NOT_ASSESSABLE`, `UNRESOLVED`, `ABSTAIN`,
  `BLOCKED` y `VALIDATION_REQUIRED`. La IA no puede convertir ausencia de evidencia en falso,
  confianza en autorizacion ni benchmark en objetivo.
- **Trazabilidad:** el contexto incluye, cuando existan, `as_of`, alcance, `source_refs`,
  `reason_codes`, desconocidos, requisitos de validacion y condiciones de parada. No se vuelca
  payload crudo ni contexto no confiable sin sanearlo.
- **Permisos:** la tool entra en `allowed_tools` y en una nueva version del agente solo cuando
  corresponda. La lectura no concede escritura; cualquier propuesta o mutacion sigue el circuito
  existente de aprobacion, idempotencia y auditoria.
- **Pixel conectado:** si el resultado genera un hallazgo visible, `InsightsMenu` es el canal de
  IA separado de las notificaciones normales y enlaza con el ancla exacta de la card. El panel de
  diagnostico sigue siendo la vista ordenada y completa; el menu es el acceso contextual.
- **Prueba del agente:** hay un test de contrato/contexto, aislamiento entre organizaciones y
  comportamiento ante datos desconocidos. La verificacion real incluye una pregunta o lectura
  representativa y confirma que el Copiloto cita el resultado correcto sin inventar el que falta.

Un bloque no esta completamente integrado si tiene contrato, motor y pantalla pero el Copiloto no
puede leerlo y tampoco existe una razon escrita para no exponerlo. En ese caso el bloque puede
seguir siendo `hecho` en el indice de contrato/motor/pixel, pero queda una tarea de integracion
abierta que bloquea la apertura de la siguiente fase cuando afecte al consumidor comun.

## El procedimiento por bloque

Sigue este orden. Es el que uso `D07`, `D08` y `D09` en fase 3 y funciono; saltarse pasos es lo
que produjo los bugs de la seccion siguiente.

1. **Lee el bloque en las cinco capas**, en orden: `02-contratos` (que forma tiene el dato) ->
   `03-runtime` (cuando se calcula) -> `04-policies` (que no puede pasar nunca) -> `05-experience`
   (que se registra despues) -> `06-tenant-context` (que decide el cliente). No implementes contra
   un resumen tuyo del artefacto: contra el artefacto.
2. **Motor puro primero, con tests.** Toda la logica de decision va en una funcion pura en
   `packages/contracts/src/<bloque>.ts` — sin I/O, sin `fetch`, sin cliente de Supabase — con su
   fichero `.test.ts` al lado. Si el artefacto dice "no elige, enumera todas las candidatas" o
   "nunca cierra con evidencia de correlacion", eso es un test, no un comentario.
3. **Migracion si hace falta**, idempotente (`create table if not exists`, `add column if not
   exists`, etc. — regla de `CLAUDE.md`). Se aplica primero en **test** con `npm run db:push`, se
   verifica el esquema ahi, y solo entonces se aplica a **produccion** con `npm run db:push:prod`.
   Nunca con `apply_migration` del MCP de Supabase: ejecuta el SQL pero no lo anota en
   `schema_migrations`, y a partir de ahi `db:push` cree que sigue pendiente. Dos proyectos:
   test `kopcblejsxpkxoykldyh`, produccion `cthjwpeygpzwdmjkxeqa` — confirma en cual estas antes
   de tocar nada.
4. **Motor impuro**, un solo fichero de I/O en `apps/api/src/<bloque>-engine.ts`: lee lo que el
   motor puro necesita, llama a la funcion pura, escribe el resultado. Job en
   `apps/worker/src/<bloque>-once.ts` y su workflow en `.github/workflows/<bloque>-engine.yml`
   con `workflow_dispatch` solamente — no `schedule` salvo que este decidido explicitamente para
   ese bloque.
5. **Pixel.** Ruta de API para el consultor en `apps/api/src/server.ts` (+ funcion en
   `apps/api/src/consultant.ts`), decisiones de presentacion puras en un `*-view-model.ts` con sus
   propios tests, y el panel en `apps/web/src/app/shopify/diagnostico/*.tsx`, montado en
   `page.tsx`. Quien ve que: el consultor lo ve **todo**, incluido lo descartado y por que; el
   cliente solo lo accionable o lo ya resuelto, nunca un razonamiento a medias; platform_admin ve
   el agregado de cartera, no caso a caso (apartado 9 del plan maestro). Un bloque que se aparte de
   esto lo escribe y dice por que. Sigue `ADR-0020` (tokens, escala de 8pt, HeroUI v3 nativo, una
   fuente, blanco dominante) y "UI sin subtextos": nada de texto de ayuda que no evite un error o
   una consecuencia real. La card que alimente al Copiloto debe tener ancla estable y entrada en
   `InsightsMenu`, separado de las notificaciones normales.
6. **Verifica contra datos reales en el proyecto de test**, nunca solo con los tests unitarios:
   siembra filas minimas con `execute_sql`, corre el motor, **cuenta las filas resultantes
   directamente** (no confies en lo que el motor dice que hizo — ver el bug de idempotencia mas
   abajo), corre una **mutacion deliberada** de la logica de decision para confirmar que el test
   dedicado y los invariantes del esquema la detectan a la vez, revierte, y **borra todo lo
   sembrado** al terminar. Si el bloque encadena con otro ya construido (D07 con D09, por ejemplo),
   pruébalos juntos sobre el mismo caso — los bugs de encaje no aparecen en ningun test aislado.
7. **Sweep completo**: tests y typecheck en los cuatro workspaces (`contracts`, `api`, `web`,
   `worker`) antes de dar el bloque por cerrado.
8. **Documenta en la misma sesion**, nunca despues:
   - Entrada nueva en `fase-XX/IMPLEMENTACION.md`, con el formato de las entradas ya escritas:
     titulo `## \`Dxx\` — <tema> · **hecho** AAAA-MM-DD`, tabla "Que se ha construido", apartado
     "Decisiones" (el porque de cada eleccion no obvia, citando el apartado del artefacto que la
     exige), apartado "Verificacion" (lo del paso 6, con cifras concretas) y "Lo que quedo fuera, a
     proposito" (recortes con motivo).
   - Fila actualizada en `conocimiento/IMPLEMENTACION.md` (columna `Estado` a `hecho`, columna
     `Codigo` con la ruta de migracion + contrato + motor + pantalla) y el contador del indice
     global.
   - `conocimiento/TAREAS_PENDIENTES.md` actualizado: tacha lo que este bloque resolvia, anade lo
     nuevo que descubriste (incluida deuda en **otro** bloque ya cerrado, si la encontraste — no la
     arregles sin que te lo pidan, anotala).

## Lo que ya se aprendio por las malas — no lo repitas

Esto es mas valioso que el procedimiento en si: son fallos reales, encontrados en fase 3,
que un test unitario aislado no habria detectado.

- **"El motor devuelve lo mismo" no es idempotencia.** El motor de `D07` decia "3 rutas" en dos
  pasadas seguidas mientras la tabla acumulaba filas en silencio: un borrado fallaba porque una FK
  creada por `D08` (`on delete set null`) chocaba con un check constraint posterior que prohibia
  ese null, y el motor no comprobaba el error del borrado. **Verifica idempotencia contando filas
  en la base, nunca leyendo el valor que devuelve la funcion.**
- **Patron borrar-y-reinsertar por caso** (cuando cada pasada es "la foto de hoy", no un historial):
  depende de que las FK de las tablas hijas sean `on delete cascade`, no `on delete set null`. Si
  una tabla del bloque anterior no lo es, se descubre tarde y en silencio — comprueba las FK antes
  de asumir que el borrado limpia lo que crees que limpia.
- **Las palabras no coinciden entre bloques que hablan del mismo concepto**: alcance de negocio
  como `business_global`/`global`/`business` segun el bloque que lo escribio, `target_node_id` que
  en una tabla guarda el origen causal y no el objetivo. No lo arregles con una migracion que
  unifique nombres a mitad de fase: escribe una funcion de traduccion explicita (tipo
  `alcanceDelCaso()`) y documenta por que existe.
- **Los check constraints de Supabase son una herramienta de diseno, no solo una red de
  seguridad.** Cuando una insercion de siembra rebota, no es un obstaculo: es el dominio valido
  ensenandote su forma. Itera sobre el rechazo en vez de rodearlo.
- **Un lote multi-sentencia de `execute_sql` es una sola transaccion.** Si la ultima sentencia del
  lote falla, las anteriores tambien se revierten aunque su sintaxis fuera correcta. No asumas que
  una insercion "aislada dentro del lote" quedo escrita solo porque su SQL era valido.
- **Un bug de encaje entre bloques solo aparece corriendolos encadenados sobre datos reales.** El
  motor de `D07` nunca emitia su explicacion causal mas corta y mejor sostenida por si sola —
  solo se veia al correr `D07` + `D08` + `D09` juntos y notar que `D09` nunca llegaba a una
  conclusion parcial pese a tener una cadena perfectamente medida. Ni `D07` ni `D09` por separado
  lo habrian delatado. Cuando termines un bloque que consume la salida de otro, corre el par
  encadenado antes de darlo por bueno.
- **Si la herramienta Bash empieza a devolver un volcado de variables de entorno en vez de
  ejecutar el comando**, esta rota para el resto de la sesion: cambia a la herramienta PowerShell,
  no reintentes Bash en bucle.

## Guardrails de contenido que se repiten fase tras fase

- **"No lo se" no es "no lo hay".** Una rama sin datos que la contrasten es `untested`/`unknown`,
  nunca evidencia en contra. Se aplica a cualquier bloque que evalue hipotesis, capacidad o
  confianza.
- **No inventes un umbral que el propio artefacto dice que no esta definido.** La respuesta
  correcta es un estado honesto (`unknown`, `not_assessable`, `unresolved`), no un numero elegido a
  ojo. Es la razon por la que `D03`, `D04`, `D09` y `D10` devuelven "no puedo saberlo" en la
  mayoria de los casos hoy — no es un motor flojo, es el techo real de los datos que existen.
  Cuando la plataforma mida lo que hoy no mide, el mismo motor empezara a cerrar mas sin que haga
  falta tocarlo.
- **Si el artefacto prohibe elegir una "ganadora", el motor enumera, no rankea.** Nunca ordenes por
  confianza cuando el guardrail dice que todas las candidatas vivas se presentan igual.
- **La cadena vale lo que vale su eslabon mas debil.** Si algun tramo de un razonamiento causal no
  esta medido, la conclusion entera se queda en el estado mas bajo, por fuerte que sea el resto.
- **Una correlacion nunca cierra una causa por si sola.** Si el bloque toca causalidad, la
  evidencia de solo co-movimiento tiene techo (`probable`/`confirmed` fuera de alcance) hasta que
  exista otra clase de evidencia.

## Restricciones que ya estan fijadas, no las reabras

- **No hagas `git commit` ni `git push`** sin permiso explicito de Rafa en esa sesion concreta.
  Deja los cambios en el working tree.
- **No ofrezcas comandos de commit** al cerrar el turno; limitate a avanzar.
- Antes de decir que una migracion esta "pendiente", comprueba `schema_migrations` en el proyecto
  real — no lo asumas por la lista de ficheros.
- Antes de hacer push a produccion, clona `main` limpio, `npm ci` y construye: el working tree
  esconde ficheros sin subir.
- La UI admin/consultor existe primero para que el consultor sepa asesorar — es "consultor first",
  no una ocurrencia tardia.

## Al terminar un bloque

Informa a Rafa con el mismo formato que se ha usado en fase 3: que hace el bloque, el encaje
honesto de por que la mayoria de los casos salen en un estado conservador (si es el caso, y casi
siempre lo es), y cualquier bug de encaje entre bloques que hayas encontrado y corregido. Despues
sigue con el siguiente bloque de la fase activa segun el apartado 8 del plan maestro, o pregunta
antes de saltar a una fase nueva — **una fase no se abre hasta que la anterior esta completa**,
decision del 2026-09-14 que sigue en pie.

Si el metodo de este documento deja de encajar con como se esta trabajando de verdad, actualiza
este mismo fichero en la sesion en que lo notes. Es una bitacora de metodo, no un contrato fijo.
