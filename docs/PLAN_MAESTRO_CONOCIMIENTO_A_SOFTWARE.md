# Plan maestro: de los .md de conocimiento al software

Como se convierten los 644 artefactos de especificacion de `conocimiento/fase-XX/`
en producto. No es un plan de contenido: es el procedimiento de traduccion, la
unidad de trabajo y el orden.

**Si vas a implementar un bloque ahora mismo**, este documento te da el que y
el orden; el **como** Ã¢â‚¬â€ el flujo paso a paso, los bugs ya encontrados y como no
repetirlos Ã¢â‚¬â€ esta en
[`conocimiento/Prompt maestro Ã¢â‚¬â€ ImplementaciÃƒÂ³n de fases (contrato + motor + pixel).md`](../conocimiento/Prompt%20maestro%20%E2%80%94%20Implementaci%C3%B3n%20de%20fases%20(contrato%20%2B%20motor%20%2B%20pixel).md).
Leelo antes de empezar.

Estado del corpus al abrir este plan: 9 fases clasificadas en 8 capas,
287 documentos en `01-rag-produccion` ya indexados (315 documentos globales /
2559 chunks, identicos en test y produccion), 644 artefactos en las capas
`02`..`06` sin implementar y 4 bloques todavia sin destilar (seccion 6).

Nota de nomenclatura: cada fase nombra sus bloques a su manera y aqui se usa la
del indice, que normaliza fase-04 (`P06` y `4.06` son el mismo bloque, se
escribe `4.06`). Fase-03 mantiene su `DNN`.

## 1. La regla de corte

La pregunta que responde cada capa no es "que dice", sino **quien lo garantiza**.

> El RAG aporta criterio. El codigo aporta garantias.

Un limite que solo vive en el prompt no es un limite: el modelo puede ignorarlo y
nadie se entera. Un criterio experto codificado en `if/else` deja de aprender y
envejece con la primera excepcion. De ahi el reparto:

| Capa | Que es | Donde aterriza | Quien lo garantiza |
| --- | --- | --- | --- |
| `00-corpus-maestro` | fuente original | nada, archivo historico | Ã¢â‚¬â€ |
| `01-rag-produccion` | juicio experto recuperable | `knowledge_documents` (hecho) | el agente, razonando |
| `02-contratos-IA` | que datos se intercambian | `packages/contracts` + migracion | el tipo y la tabla |
| `03-runtime` | flujos, estados, orquestacion | maquina de estados + `apps/worker` | el codigo |
| `04-policies-guardrails` | limites, permisos, autonomia | checks ejecutables **con test** | el test que falla |
| `05-experience-learning` | outcomes, evidencia, confianza | tablas de outcome + funciones SQL | el dato registrado |
| `06-tenant-context` | lo configurable por tienda | tablas de config + UI | la configuracion |
| `99-auditoria` | trazabilidad de la clasificacion | indice de implementacion | este plan |

Corolarios que no se negocian:

- **Un guardrail de `04-policies` nunca se implementa solo como instruccion de
  prompt.** Va como comprobacion en codigo, con un test que falla si se rompe.
  Si ademas conviene contarselo al agente, se le cuenta; pero el que manda es el
  check.
- **Conocimiento de `01-rag-produccion` no se convierte en codigo.** Si aparece
  la tentacion de escribir `if (madurez === "early")`, es senal de que ese
  contenido estaba mal clasificado: o es un criterio (se queda en RAG) o es una
  politica (se va a `04-policies` y entonces si, codigo).
- **Un contrato sin su runtime es una tabla muerta.** Ver seccion 2.
- **Un bloque que el Copiloto no puede leer no termina de cambiar el producto.**
  Cada bloque debe declarar su consumidor IA (tool, adaptador de contexto o motivo para no
  exponerlo), conservar la procedencia y los estados conservadores, y respetar el aislamiento por
  organizacion. `InsightsMenu` es el acceso navegable a la card; no sustituye al contexto o tool
  que permite al Copiloto razonar con el dato.

## 2. La unidad de trabajo es el bloque, no el fichero

Un bloque (`D05`, `7.04`, `8.05`...) reparte su contenido en varias capas: el
contrato dice que campos, el runtime cuando se evalua, las policies que limites
tiene, experience que se registra del resultado y tenant que es configurable.

**Se implementa el bloque entero o no se implementa.** Un `8.05 action envelope`
con su tabla creada pero sin los guardrails de `04-policies` que la hacen
vinculante es peor que no tenerlo: parece que hay un limite y no lo hay.

Los artefactos de un bloque se leen en este orden: `02-contratos` (que forma
tiene el dato) -> `03-runtime` (cuando se calcula) -> `04-policies` (que no
puede pasar nunca) -> `05-experience` (que se registra despues) ->
`06-tenant-context` (que decide el cliente).

## 3. Orden: fase a fase, en orden, completa

**Decision 2026-09-14: se implementa fase por fase y bloque por bloque, F3
entera antes de F4.** Este documento proponia lo contrario y se deja escrito
por que, para que la decision se pueda revisar con los dos argumentos delante
y no se re-discuta a ciegas.

Lo que pedia el vertical: F3, F4, F7, F8 y F9 son **etapas de una misma
tuberia**, no modulos independientes. Atravesarla entera con poco contenido
(una sola area de negocio) enseÃƒÂ±a antes si los contratos encajan entre si, y
evita un motor de diagnostico completo que no desemboca en nada.

Lo que compra ir por fases: cada fase queda **cerrada y correcta** Ã¢â‚¬â€ sus
invariantes completos, no el subconjunto que el vertical necesitaba Ã¢â‚¬â€ y no se
vuelve a abrir. El coste conocido y aceptado es que **el encaje entre fases se
descubre tarde**: F3 no tendra consumidor real hasta que exista F4, y hasta
entonces sus contratos de salida estan verificados contra el documento, no
contra un consumidor. Se compensa con la regla del apartado 5: un bloque no
esta hecho sin test que falle al violar sus invariantes.

```text
F3 diagnostico -> F4 priorizacion -> F7 recomendacion -> F8 ejecucion -> F9 aprendizaje
   (completa)      (completa)          (completa)         (completa)      (completa)
```

### Que significa "completa" Ã¢â‚¬â€ corregido 2026-09-25, al cerrar F3

La primera lectura de "completa" fue **esquema completo**, y con esa lectura la
fase 3 se dio por cerrada con 23 tablas, 15 contratos y 402 tests... que nadie
escribe y nadie ve. Es una fase entera de garantias sobre datos que no existen.

A partir de aqui, una fase esta completa cuando cumple **las tres**:

| | Que | Sin esto |
| --- | --- | --- |
| **Contrato** | tablas, tipos e invariantes con test | no hay garantia |
| **Motor** | codigo que **escribe** esas tablas | la garantia no protege nada: no hay filas |
| **Pixel** | alguien Ã¢â‚¬â€consultor, cliente o adminÃ¢â‚¬â€ **lo ve** | el producto no cambia |

Las tres, o la fase sigue abierta. **La fase 3 no esta terminada**: tiene el
contrato y le faltan el motor y el pixel (apartado 8).

El motivo por el que esto se colo: el orden de lectura del apartado 2 pone
`02-contratos` primero, y `03-runtime` se fue recortando bloque a bloque con un
motivo razonable cada vez ("todavia no hay senales que procesar"). Quince
recortes razonables seguidos son una fase sin motor. El recorte de runtime pasa
a ser excepcional y se justifica contra el bloque que lo desbloquea, con fecha.

## 4. Las olas, ahora como orden dentro de cada fase

La tabla de olas se escribio para el vertical. Con el orden por fases **ya no
manda el reparto entre fases**, pero se conserva porque sigue diciendo algo
cierto: que bloques de cada fase son los que sostienen el lazo minimo. Dentro
de una fase, los marcados **ola 1** van primero.

No las 5 fases de golpe. Cada ola cierra un lazo que ya sirve al consultor.

### Ola 1 Ã¢â‚¬â€ el lazo minimo (detectar -> recomendar -> aprobar -> registrar)

Sin ejecucion automatica: la recomendacion sale, el consultor la aprueba y la
ejecuta a mano, y el sistema registra que paso. Es un ciclo completo de valor y
evita toda la maquinaria cara de F8.

| Fase | Bloques | Que entrega |
| --- | --- | --- |
| F3 | D01, D05, D06, D10, D11 | senales y sintomas de retencion, con severidad y confianza |
| F4 | 4.04, 4.06, 4.10, 4.12 | ranking explicable de que atacar antes |
| F7 | 7.01, 7.02, 7.15, 7.17, 7.18 | recomendacion elegible, con expected outcome y como se comunica |
| F8 | 8.02, 8.16 | aprobacion humana y captura del resultado |
| F9 | 9.01, 9.12 | la experiencia queda registrada y clasificada |

18 bloques. Al terminar la ola, `/tareas` propone intervenciones de retencion
razonadas, con su porque y su resultado esperado, y guarda que paso de verdad.

> **Bloqueo de contenido**: `7.15`, `7.17` y `7.18` tienen corpus maestro pero
> **no estan destilados** (ninguna capa `02`..`06`). Son el expected outcome, la
> confianza y la comunicacion de la recomendacion: justo el nucleo de lo que
> hace util a la ola 1. Hay que pasarlos por el prompt maestro antes de poder
> cerrarla. Es la unica dependencia de contenido que queda en esta ola.

### Ola 2 Ã¢â‚¬â€ ejecucion supervisada con limites reales

Lo que convierte "el sistema propone" en "el sistema hace, dentro de un
perimetro". Aqui es donde `04-policies` deja de ser documentacion.

F8: 8.01 (autorizacion), 8.03 (execution plan), 8.05 (action envelope),
8.09 (guardrails y respuesta), 8.10 (lifecycle y estados), 8.12 (rollback),
8.15 (verificacion). F3: D07, D08, D09 (grafo causal, hipotesis, root cause),
que elevan el diagnostico de sintoma a causa.

`8.12` (rollback, recovery y compensacion) tampoco esta destilado. No bloquea la
ola 1, pero sin el no se puede abrir la ola 2: no se concede autonomia sin saber
como se deshace lo que se hizo.

### Ola 3 Ã¢â‚¬â€ el aprendizaje que realimenta

F9 sobre el area ya en marcha: 9.04 (calidad de evidencia), 9.05-9.07
(causalidad frente a correlacion), 9.09 (confidence), 9.19 (earned autonomy),
9.26 (knowledge promotion). Es lo que permite que la autonomia de la ola 2
crezca con evidencia en vez de por decision manual.

Solo despues de cerrar las tres olas se replica a la segunda area, y esa
segunda pasada debe ser mayoritariamente carga de contenido.

## 5. Definition of done de un bloque

Un bloque esta implementado cuando, de sus artefactos:

1. **Contrato** Ã¢â‚¬â€ los campos viven en `packages/contracts` como tipo, y en la
   base como migracion idempotente (`ADR-0014`, regla de `CLAUDE.md`).
2. **Runtime Ã¢â‚¬â€ el motor, no su descripcion.** Existe codigo que **escribe**
   las tablas del bloque: los estados y transiciones ejecutandose, y su job en
   `apps/worker` si hay trabajo periodico. Un contrato sin runtime es una tabla
   muerta (apartado 1) y **no cuenta como bloque hecho**. Si el runtime se
   recorta, se nombra el bloque que lo desbloquea y la fecha en que se vuelve.
3. **Policies** Ã¢â‚¬â€ *cada* invariante del artefacto tiene una comprobacion
   ejecutable y un test que falla si se viola. Sin este punto el bloque no
   esta hecho, aunque el resto funcione.
4. **Experience** Ã¢â‚¬â€ el outcome se escribe y se puede leer con una funcion SQL
   `stable` (mismo patron que `ADR-0006` punto 6).
5. **Tenant** Ã¢â‚¬â€ lo configurable es configurable, o esta fijado a proposito con
   el motivo escrito al lado.
6. **Trazabilidad** Ã¢â‚¬â€ la fila del bloque en `conocimiento/IMPLEMENTACION.md`
   apunta al codigo y queda en `hecho`, y la bitacora de su fase
   (`conocimiento/fase-XX/IMPLEMENTACION.md`) tiene su entrada.
7. **Audiencia Ã¢â‚¬â€ y la vista existe.** El bloque dice **quien ve cada cosa** en
   las tres vistas (cliente, consultor, platform_admin) y donde vive **y esa
   pantalla esta construida**, con su UX pensada, no solo anotada. Corregido
   2026-09-25: hasta F3 bastaba con contestarlo por escrito, y el resultado
   fueron 15 filas de requisitos y cero pixeles. "Todavia nadie lo ve" solo vale
   mientras el bloque no tenga motor; en cuanto escribe filas, se ven. Ver el
   apartado 9.
8. **Consumo por agentes y Copiloto** Ã¢â‚¬â€ el bloque dice **que agente lo usa, a
   traves de que tool o adaptador de contexto y en que version**, o que ninguno
   y por que. La lectura debe ser tenant-scoped, con procedencia y con los
   estados `UNKNOWN`/`ABSTAIN`/`VALIDATION_REQUIRED` intactos. Una tabla que
   ningun agente puede leer no cambia el comportamiento del producto. Ver el
   apartado 10.

Lo que el artefacto decia y se ha decidido **no** implementar se anota en su
fila con el motivo. Un bloque a medias con su recorte escrito es honesto; un
bloque a medias silencioso es deuda invisible.

## 6. Trazabilidad

**[`conocimiento/IMPLEMENTACION.md`](../conocimiento/IMPLEMENTACION.md)** es el
indice vivo: 129 bloques, una fila cada uno, con las capas que tiene, la ola, el
estado y donde vive el codigo. Es la respuesta a "Ã‚Â¿esto ya esta hecho?" sin
abrir 644 ficheros.

Se actualiza en el mismo commit que implementa el bloque, nunca despues.

Lo que queda abierto, separado por quien puede cerrarlo, vive en
[`conocimiento/TAREAS_PENDIENTES.md`](../conocimiento/TAREAS_PENDIENTES.md):
lo que necesita a Rafa y la deuda que dejo anotada cada bloque, con su motivo.
Una deuda que solo vive en una conversacion esta perdida.

Debajo del indice, cada fase tiene su **bitacora**:
`conocimiento/fase-XX/IMPLEMENTACION.md`. El indice responde *que* esta hecho;
la bitacora responde *como y por que* Ã¢â‚¬â€ que decision se tomo en cada bloque,
que alternativa se descarto, que quedo fuera y donde se aplico el esquema. Son
dos preguntas distintas y por eso son dos ficheros: el indice cabe en una
pantalla precisamente porque el razonamiento no esta dentro.

De los 129, **4 siguen sin destilar** (corpus maestro sin ninguna capa de
especificacion): `7.15`, `7.17`, `7.18`, `8.12`. No son opcionales ni
casuales: tres bloquean la ola 1 y uno la ola 2.

## 7. Lo que no hacemos

- **No convertir los 644 artefactos en especificacion formal por adelantado.**
  Un artefacto se toca cuando le toca su ola. Ya estan clasificados y
  versionados: ahi aguantan sin caducar.
- **No fine-tuning** mientras el comportamiento siga cambiando (`ADR-0017`).
- **No mover conocimiento entre capas para que encaje con el codigo.** Si un
  artefacto esta mal clasificado se corrige la clasificacion y se reindexa,
  no se improvisa en la implementacion.
- **No implementar F9 sobre datos que no existen.** El aprendizaje necesita
  outcomes reales; sin ola 1 y 2 cerradas, F9 es teoria.
- **No tocar fase-4 del corpus** (P02 se perdio, decision tomada 2026-09-14).

## 8. Donde estamos

**Estado canÃƒÂ³nico 2026-09-16:** F3 estÃƒÂ¡ cerrada. D13 y D14 estÃƒÂ¡n hechos con
contrato, motor, worker, workflow, pantalla y verificaciÃƒÂ³n real usando
`.env.local`; F4 queda habilitada. Las notas histÃƒÂ³ricas posteriores de esta
secciÃƒÂ³n quedan supersedidas por este estado y por el addendum final.

1. ~~Generar el indice de implementacion~~ Ã¢â‚¬â€ hecho, 129 bloques.
2. ~~`D00` contrato~~, ~~`D01` calidad de datos~~, ~~`D02`
   contextualizacion~~, ~~`D03` madurez~~, ~~`D04` salud~~, ~~`D05` senales~~ ~~`D06` sintomas~~ ~~`D07` grafo causal~~ ~~`D08` hipotesis~~ ~~`D09` causa raiz y constraints~~ ~~`D10` severidad e impacto~~ ~~`D11` confianza e incertidumbre~~ ~~`D12` confusores y falsos diagnosticos~~ ~~`D13` diagnostico temporal y regresion~~ y ~~`D14` salida diagnostica y validacion~~ Ã¢â‚¬â€ **los 15 contratos de la fase 3, en test y en producciÃƒÂ³n**. `D01`Ã¢â‚¬â€œ`D14` tienen ademÃƒÂ¡s motor y pantalla; `D00` permanece como contrato por diseÃƒÂ±o. Ver
   [`conocimiento/fase-03/IMPLEMENTACION.md`](../conocimiento/fase-03/IMPLEMENTACION.md).
3. **Fase 3 cerrada Ã¢â‚¬â€ actualizado 2026-09-16.** `D01`Ã¢â‚¬â€œ`D14` estÃƒÂ¡n hechos con
   contrato, motor y pantalla, verificados contra datos reales en `.env.local`.
   `D00` se queda en `contrato` a propÃƒÂ³sito porque solo define la forma comÃƒÂºn.
   F4 queda habilitada.
   [`conocimiento/Prompt maestro Ã¢â‚¬â€ ImplementaciÃƒÂ³n de fases (contrato + motor + pixel).md`](../conocimiento/Prompt%20maestro%20%E2%80%94%20Implementaci%C3%B3n%20de%20fases%20(contrato%20%2B%20motor%20%2B%20pixel).md).
4. **Patron confirmado en cuatro bloques** (`D04` no tiene capa de runtime, asi
   que no cuenta): la capa `03-runtime` describe un motor
   y se recorta sistematicamente, porque no hay senales que procesar hasta
   `D05`. Los contratos, invariantes y tenant-context si se implementan
   enteros. Cuando se llegue a `D05` habra que volver a `D01` y `D02` a montar
   sus flujos Ã¢â‚¬â€ esta anotado en cada entrada de la bitacora.
5. Fuera de la cola de fases, cuando estorbe: destilar `7.15`, `7.17`, `7.18`
   y `8.12`, y un ADR para el reparto de la seccion 1.

## 9. Audiencia: las tres vistas

AÃƒÂ±adido 2026-09-14, despues de `D00`, `D01` y `D02`. Los tres se implementaron
con RLS de staff **por inercia**: cada uno copio la decision del anterior sin
que nadie escribiera el criterio. Tres bloques seguidos con la misma decision no
tomada es un patron, y de ahi sale este apartado.

El sistema tiene tres vistas y cada una necesita algo distinto del mismo dato:

| Vista | Quien | Que necesita de F3..F9 |
| --- | --- | --- |
| **Cliente** | el dueno de la tienda | **lo accionable por el, y solo cuando esta resuelto.** Nunca razonamiento a medias: una hipotesis sin contrastar delante de un cliente es alarmismo |
| **Consultor** | quien asesora | **todo el razonamiento**, incluido lo descartado y por que. Es el destinatario primario: el panel existe para que sepa asesorar |
| **platform_admin** | operacion de plataforma | **si el motor funciona**: cuantos casos se bloquean, que invariantes saltan, que fuentes fallan en toda la cartera. Agregado, no caso a caso |

### La regla

**El consultor lo ve todo; el cliente ve lo que puede accionar o lo que ya esta
resuelto; platform_admin ve el agregado.** Un bloque que se aparte de esto lo
escribe y dice por que.

Esto no es nuevo: es la separacion que ya vive en `portal-shell.tsx` y en
`ADR-0020`. Lo nuevo es que a partir de aqui se decide **bloque a bloque y por
escrito**, mientras el contrato esta fresco, en vez de reconstruirlo meses
despues mirando politicas de RLS.

### Lo que NO significa

Escrito primero asi: *"no significa construir pantallas a la vez que el
esquema; una pantalla sobre tablas vacias se disena contra datos imaginados y se
tira"*. El argumento sigue siendo cierto y **la conclusion era mala**: al cerrar
F3 hay 15 filas de audiencia perfectamente escritas y ni un pixel, porque
"cuando llegue el motor" nunca llego Ã¢â‚¬â€ el motor tambien se fue recortando.

**Corregido 2026-09-25.** Lo que se aplica desde aqui:

- La pantalla **no** se disena contra tablas vacias Ã¢â‚¬â€ se disena contra las que
  el motor del propio bloque acaba de llenar. Por eso motor y pixel van juntos
  en la misma unidad de trabajo, no en fases distintas.
- La UX se piensa **al leer el contrato**, mientras esta fresco: que pregunta
  responde esta tabla, a quien, y donde se contesta. Eso es la matriz de
  audiencia, y ahora es el boceto de una pantalla, no un apunte.
- Un bloque puede quedarse sin pixel, pero entonces **es un recorte con motivo
  escrito** (apartado 5), como cualquier otro Ã¢â‚¬â€ no el estado por defecto.

La deuda ya contraida no se reescribe fase a fase: F3 se cierra con su motor y
sus pantallas antes de abrir F4 (apartado 8).

### Como se comprueba la vista de cliente

Entrando con un usuario cliente. El selector de `admin-view-mode.tsx` solo
alterna admin/consultor Ã¢â‚¬â€ eso es un atajo que no existe, no un impedimento.

En **test** existe `borregorafa99@gmail.com` (`platform_role = user`, owner de
la organizacion `5ebc7b02`), asi que la vista de cliente se puede comprobar ahi
sin tocar produccion. Esa organizacion no tiene tiendas conectadas, de modo que
los modulos de datos saldran vacios: sirve para comprobar **que se ve y que no**,
no para ver cifras.

## 10. Los agentes: quien consume lo que construimos

AÃƒÂ±adido 2026-09-14, junto al apartado 9 y por el mismo motivo. La pregunta de la
UI tiene gemela: **una tabla que ningun agente puede leer no cambia el
comportamiento del producto.** Se contesta por bloque, al implementarlo.

### Lo que ya existe

Los agentes **son datos, no codigo**: `agent_definitions` (codigo, nombre,
activo) y `agent_versions` (modelo, `prompt_code`, `allowed_tools`,
`approval_mode`, `config`). Hay 26 definiciones y 24 activas. Consecuencia
practica y buena: **conectar un bloque de F3 a un agente es anadir una tool y
subir una version**, no tocar el runtime.

`allowed_tools` es lista blanca por version. Un agente no puede leer nada que no
este en su lista, por mucho que la tabla exista y la RLS se lo permita.

### El estado real, 2026-09-14

**Ninguna de las 23 tablas de F3 es accesible para ningun agente.** No hay tool
que las lea. `a09_copiloto_consultor`, que es el candidato natural, tiene 20
tools y ninguna toca `diagnostic_cases` ni `data_quality_issues`.

No es un fallo: no hay nada escrito que leer. Es el punto de conexion, y tiene
fecha Ã¢â‚¬â€ `D05`, el primer bloque que produce filas.

### La regla

Cada bloque contesta: **Ã‚Â¿que agente lo consume, con que tool, y en que version?**
"Ninguno todavia, porque nadie escribe estas tablas" es una respuesta valida.
"No me lo he planteado" no.

Cuando llegue el consumo, el patron es el de siempre: tool nueva en el runtime,
`allowed_tools` de una version nueva del agente, y el prompt contandole cuando
usarla. La version anterior se queda: asi se puede comparar.

### Copiloto como consumidor primario

El Copiloto consultor es el consumidor transversal de esta linea de producto. Desde F3 hasta la
fase activa, cada bloque se audita con estas preguntas antes de abrir la fase siguiente:

1. ¿Puede leer el resultado mediante una tool de solo lectura o mediante un adaptador de contexto
   documentado?
2. ¿La lectura esta aislada por `organization_id` y conserva `as_of`, `source_refs`,
   `reason_codes`, desconocidos y requisitos de validacion?
3. ¿El prompt y la tool dejan claro que `UNKNOWN` no es falso, que `VALIDATION_REQUIRED` limita la
   recomendacion y que confidence no autoriza escritura?
4. ¿El agente tiene esa capacidad en `allowed_tools` y en una version identificable, o esta escrito
   por que todavia no debe tenerla?
5. ¿La pregunta representativa devuelve el dato correcto y, cuando procede, enlaza mediante
   `InsightsMenu` con el ancla exacta de la card? El menu de IA permanece separado de la campana de
   notificaciones.

La integracion del Copiloto no obliga a crear una tool nueva para cada bloque: se reutiliza un
adaptador comun cuando el shape y la procedencia son suficientes. Pero no se da por integrada una
fase porque sus paneles funcionen: hay que probar tambien el camino de lectura y sus limites.

### Riesgo ya materializado, para no repetirlo

`search_knowledge` esta en 20 de los 24 agentes activos. Cuando se vacio y
resubio el RAG completo (2026-09-14, 315 documentos), **los 20 cambiaron de
comportamiento a la vez** y no se midio. Existe infraestructura para medirlo
(`packages/ai/agent-evals.ts`, `agent-eval-dataset.ts`, `release-gate.ts`), y no
se uso.

De aqui en adelante: un cambio que toque el corpus o el prompt de un agente con
`search_knowledge` pasa por sus evals antes de darse por bueno.

### Apunte suelto

`a19_arquitecto_camino` corre en `claude-opus-4-8`; los otros 23 activos, en
`claude-sonnet-5`. Puede ser deliberado Ã¢â‚¬â€ es el agente que disena el camino
completo de un cliente Ã¢â‚¬â€ pero no esta escrito en ningun sitio que lo sea.
### Addendum de cierre F3 Ã¢â‚¬â€ 2026-09-16

`D13` y `D14` ya estÃƒÂ¡n **hechos**: contrato, motor puro con tests, adaptador runtime, worker, workflow, panel de consultor y verificaciÃƒÂ³n real con `.env.local` en `kopcblejsxpkxoykldyh`, con limpieza confirmada. F3 queda cerrada con 14 bloques implementados; `D00` permanece como contrato puro por diseÃƒÂ±o. F4 puede abrirse.

### Addendum de apertura y avance F4/P00 Ã¢â‚¬â€ 2026-09-16

F4 queda abierta por `4.00/P00`, ya marcado `hecho`: contrato ejecutable,
tests, migraciÃƒÂ³n de runs y trazas, runtime, worker, workflow manual y panel de
consultor, verificados en `.env.local`. La ejecuciÃƒÂ³n real queda correctamente
`INPUT_INCOMPLETE` por ausencia del contexto que corresponde a P1; no se fabrica
una prioridad. La siguiente rebanada es `4.01`, y no se implementarÃƒÂ¡ hasta que
su contexto y objetivos sean explÃƒÂ­citos.
### Addendum de avance F4/P01 Ã¢â‚¬â€ 2026-09-16

`4.01/P01` estÃƒÂ¡ **hecho** con contrato, motor, worker, API, panel y verificaciÃƒÂ³n
real usando `.env.local`. El snapshot distingue objetivo empresarial de target,
estrategia e iniciativa, conserva conflictos/unknowns y no rankea. Sin una
declaraciÃƒÂ³n del tenant, el runtime devuelve `INCOMPLETE`; con una declaraciÃƒÂ³n
temporal validada devuelve `COMPLETE` con limitaciones explÃƒÂ­citas. La prueba se
limpiÃƒÂ³ por completo. La siguiente rebanada habilitada es `4.03`; F4 continÃƒÂºa
abierta.

### Addendum de avance F4/P03 Ã¢â‚¬â€ 2026-09-16

`4.03/P03` esta **hecho** con contrato, tests, migracion, runtime, worker,
workflow, API, panel y verificacion real usando `.env.local` sobre
`kopcblejsxpkxoykldyh`. La evaluacion solo declara urgencia temporal cuando
puede comparar una ventana, deadline o irreversibilidad con el tiempo total de
respuesta; no calcula importancia, severidad, prioridad ni accion. La corrida
real fue `5/5` organizaciones sin fallos, y la fila temporal de verificacion se
elimino por completo.

El manifiesto de P03 referencia
`06-tenant-context/p03-contexto-temporal-tenant.md`, pero ese fichero no existe
en el corpus actual. Queda documentado como hueco de contenido y el runtime
mantiene `UNKNOWN` cuando faltan tiempos observables. F4 sigue abierta; el
siguiente bloque habilitado es `4.04`.

### Addendum de avance F4/P04 Ã¢â‚¬â€ 2026-09-16

`4.04/P04` esta **hecho** con contrato, tests, migracion, runtime, worker,
workflow, API, panel y verificacion real usando `.env.local` sobre
`kopcblejsxpkxoykldyh`. Conserva el valor en juego por tipo, magnitud,
exposicion, recoverability, escenarios y confidence separadas; no convierte
exposicion en perdida, revenue en valor, ni impacto en prioridad. La corrida
real fue `5/5` organizaciones sin fallos, y la fila temporal de verificacion se
elimino por completo. F4 sigue abierta; el siguiente bloque habilitado es
`4.05`.

### Addendum de avance F4/P05 Ã¢â‚¬â€ 2026-09-16

`4.05/P05` esta **hecho** con contrato, tests, migracion, runtime, worker,
workflow, API, panel y verificacion real usando `.env.local` sobre
`kopcblejsxpkxoykldyh`. El runtime conserva objetivo, evidencia, falsifier,
blockers, slack y conflictos de recurso sin confundir dependency con constraint
ni convertir el grafo en ranking. La corrida real fue `5/5` organizaciones sin
fallos; se conservaron unknowns de objetivo y constraint primario cuando no
habia evidencia y se eliminaron los cinco snapshots temporales. F4 sigue
abierta; el siguiente bloque habilitado es `4.06`.

### Addendum de cierre F4/P06â€“P12 â€” 2026-09-16

F4 queda cerrada con P06, P07, P08, P09, P10, P11 y P12 en estado hecho.
Cada bloque tiene contrato ejecutable y tests, persistencia, runtime, worker,
API y panel de consultor. P06 dispone ademÃ¡s de workflow propio; P07â€“P12
comparten el workflow operativo de la rebanada restante.

La migraciÃ³n 20261027120000 y la migraciÃ³n compartida
20261027130000_f4_p06_p12_decision_runtime.sql se aplicaron en el proyecto de
desarrollo de .env.local (kopcblejsxpkxoykldyh). La verificaciÃ³n real recorriÃ³
las cinco organizaciones activas/onboarding en los siete motores: 35
evaluaciones correctas, 0 fallos, 5 filas temporales por bloque y cleanup a
cero.

Los contratos conservan los lÃ­mites del artefacto: factibilidad, riesgo,
asignaciÃ³n, strategic fit, portfolio y salida mantienen UNKNOWN cuando faltan
datos; ranking exige una polÃ­tica de pesos declarada por el tenant; y P12 se
abstiene o pide validaciÃ³n cuando no hay evidencia suficiente. No se fabrica
prioridad, score, capacidad, probabilidad ni causalidad.

F4 estÃ¡ cerrada; la siguiente fase habilitada por el Ã­ndice es F5.

### Addendum de apertura F5/P00 — 2026-09-17

F4 está cerrada y F5 queda abierta con 5.00 como contrato raíz universal de
estrategias y playbooks. La primera rebanada implementa contexto, templates
versionados, evaluación determinista de aplicabilidad, instancia trazable y
salida de disposición.

La migración 20261028090000_f5_p00_playbook_framework.sql se aplicó en el
proyecto de desarrollo de .env.local (kopcblejsxpkxoykldyh). La verificación
real recorrió cinco organizaciones: 5 correctas, 0 fallos, y cleanup a cero.
Al no existir todavía templates activos en el catálogo, todas las salidas
fueron NO_APPLICABLE_PLAYBOOK; el sistema no inventó recomendaciones.

F5/P00 queda hecho. El siguiente bloque habilitado es F5/P01, adquisición y
generación de demanda.

### Cierre F5/P01 — 2026-09-17

P01 queda hecho como extensión del framework universal: `domain_extension.acquisition`
mantiene el movimiento de adquisición, población objetivo, alcance de canal,
referencias de canal, objetivo de cualificación y evidencia requerida sin crear
un contrato raíz nuevo. El runtime solo evalúa templates `ACQUISITION` válidos,
conserva `UNKNOWN` para evidencia ausente y no inventa tráfico, audiencia,
economics ni thresholds.

La migración `20261028100000_f5_p01_acquisition_playbook.sql` se aplicó en el
proyecto de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación
real recorrió cinco organizaciones sin fallos y eliminó las filas temporales.
P01 queda hecho; el siguiente bloque habilitado es F5/P02, paid media y
eficiencia de tráfico.

### Cierre F5/P02 — 2026-09-17

P02 queda hecho como especialización del framework universal P00. El artefacto
no define una extensión contractual nueva, por lo que no se duplican métricas
ni se inventan conectores, fórmulas o thresholds. `paid-media-engine.ts`
construye el contexto del dominio y conserva `UNKNOWN` para medición,
distribución, respuesta, calidad de tráfico, conversión, economics,
incrementalidad, inventario, capacidad y cash-flow; el evaluador solo permite
avanzar cuando el template y sus precondiciones lo sostienen.

La migración `20261028110000_f5_p02_paid_media.sql`, worker, workflow,
endpoint y panel quedaron implementados. Con `.env.local` se sembró una
plantilla temporal y se evaluaron las cinco organizaciones del proyecto:
`VALIDATION_REQUIRED` en las cinco por evidencia insuficiente; después se
eliminaron plantilla y ejecuciones. El worker real terminó `5 succeeded`,
`0 failed`, `5 assessments`, con cleanup a cero. P02 está hecho; F5 sigue
abierta y el siguiente bloque habilitado es F5/P03, conversión y CRO.

### Integración transversal F4/F5 con el Copiloto — 2026-09-17

El Copiloto ya consume un resumen estructurado de F4 y F5 mediante
`decision-playbook-chat-context.ts`: contexto de decisión, salida decisional,
estado, confianza, motivos, unknowns, evidencia y evaluaciones de playbooks.
La lectura está aislada por organización y es solo lectura. Si faltan datos,
el contexto lo declara; no se inventa prioridad, estrategia, presupuesto ni
acción. En la ruta de Diagnóstico, las preguntas sugeridas también apuntan a
la decisión bloqueada, la evidencia pendiente y el playbook aplicable.

### Addendum de avance F5/P03 — 2026-09-17

`5.03` está hecho con extensión contractual CRO, tests, migración, runtime,
worker, workflow, endpoint y panel. El runtime lee el funnel Shopify real y
solo declara cobertura observable; no transforma una tasa en fuga ni inventa
benchmarks, umbrales, tráfico, economía o significancia. La verificación con
`.env.local` sobre `kopcblejsxpkxoykldyh` procesó cinco organizaciones sin
fallos y produjo `VALIDATION_REQUIRED` por evidencia insuficiente; el template
y las cinco ejecuciones temporales se eliminaron. F5 continúa abierta y el
siguiente bloque habilitado es `5.04`.

### Addendum de avance F5/P04 — 2026-09-17

`5.04` queda hecho con contrato de oferta/pricing/merchandising/AOV, validator,
migración, runtime, worker, workflow, endpoint y panel. El runtime usa las RPC
Shopify reales de ventas, margen, descuentos, stock y productos principales;
mantiene separadas las dimensiones y conserva `UNKNOWN` para elasticidad,
incrementalidad de promociones y calidad de cliente, que no tienen observación
suficiente. Los guardrails evitan optimizar AOV aislado, cambios de precio sin
diagnóstico, promociones engañosas y acciones irreversibles.

La migración `20261028130000_f5_p04_offer_pricing.sql` se aplicó en el proyecto
de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación recorrió cinco
organizaciones: `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` por evidencia
insuficiente y cleanup confirmado a cero. F5 sigue abierta; el siguiente bloque
habilitado es `5.05`, retención, CRM, lifecycle y LTV.

### Addendum de avance F5/P05 — 2026-09-17

`5.05` queda hecho con contrato de retención/CRM/lifecycle, validator,
migración, runtime, worker, workflow manual, endpoint y panel. El runtime lee
clientes y pedidos Shopify, margen disponible, configuración de Klaviyo y
eventos de consentimiento. Declara repeat y lifecycle solo cuando están
observados, pero conserva `UNKNOWN` para cohortes, churn, LTV, suscripciones,
incrementalidad y customer quality. Los guardrails impiden tratar más mensajes
como retención, Revenue atribuido como incrementalidad o un descuento como
solución a una mala experiencia.

La migración `20261028140000_f5_p05_retention_crm.sql` se aplicó en el proyecto
de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación contó directamente las
filas producidas por el motor: cinco organizaciones, cinco filas, `5 succeeded`,
`0 failed` y disposición `BLOCKED` por precondiciones no demostradas; el cleanup
quedó a cero. F5 sigue abierta; el siguiente bloque habilitado es `5.06`, unit
economics y rentabilidad.

### Addendum de avance F5/P06 — 2026-09-17

`5.06` queda hecho con contrato de unit economics, validator, migración,
runtime, worker, workflow manual, endpoint y panel. El motor usa las RPC
Shopify reales de ventas, margen y resumen financiero en una ventana de 90 días.
Expone el waterfall observado sin confundir `net_profit` con contribution, y
conserva `UNKNOWN` para CAC, payback, cash, cohortes, segmentación, escenarios
y comparabilidad cuando faltan fuentes o definiciones tenant-scoped.

La migración `20261028150000_f5_p06_unit_economics.sql` se aplicó en el proyecto
de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`) y no quedan migraciones
pendientes. La verificación recorrió cinco organizaciones: `5 succeeded`, `0
failed`, cinco filas `VALIDATION_REQUIRED` contadas directamente y cleanup a
cero. F5 sigue abierta; el siguiente bloque habilitado es `5.07`, producto,
catálogo e inventario.

### Addendum de avance F5/P07 — 2026-09-17

`5.07` queda hecho con contrato de producto/inventario, validator, migración,
runtime, worker, workflow manual, endpoint y panel. El motor usa catálogo y
variantes del tenant, stock Shopify, ventas y margen en una ventana de 90 días.
Declara la cobertura observada sin convertir stockout en compra, stock absoluto
en overstock ni baja venta en racionalización. Reposición, forecast, proveedor,
calidad, precisión, demand/supply alignment y escenarios siguen `UNKNOWN` sin
evidencia específica.

La migración `20261028160000_f5_p07_product_inventory.sql` se aplicó en el
proyecto de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación
recorrió cinco organizaciones: `5 succeeded`, `0 failed`, cinco filas
`BLOCKED` contadas directamente y cleanup a cero. F5 sigue abierta; el
siguiente bloque habilitado es `5.08`, operaciones, fulfillment y customer
experience.

### Addendum de avance F5/P08 — 2026-09-17

`5.08` queda hecho con contrato de operaciones/fulfillment/CX, validator,
migración, runtime, worker, workflow manual, endpoint y panel. El motor usa
las RPC reales `shopify_delivery_times` y `shopify_sales_summary`, más el
conteo tenant-scoped de `shopify_returns`, para declarar cobertura de pedidos,
preparación, fulfillment, tránsito, promesa y puntualidad medible. Mantiene
`UNKNOWN` para SLA, backlog, capacidad, soporte, WISMO, recuperación de servicio
y customer experience sin fuente específica; no confunde un retraso con una
causa ni atribuye el problema al carrier por defecto.

La migración `20261028170000_f5_p08_operations_cx.sql` se aplicó en el proyecto
de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación recorrió
cinco organizaciones: `5 succeeded`, `0 failed`, cinco filas
`VALIDATION_REQUIRED` contadas directamente y cleanup a cero. F5 sigue abierta;
el siguiente bloque habilitado es `5.09`, datos, tracking y experimentación.

### Addendum de avance F5/P09 — 2026-09-18

`5.09` queda hecho con contrato de datos/tracking/experimentación, validator,
migración, runtime, worker, workflow manual, endpoint y panel. El motor usa las
fuentes reales `shopify_sales_summary`, `shopify_funnel_summary` y
`shopify_sales_daily` para declarar cobertura de pedidos, sesiones, funnel y
baseline. Mantiene `UNKNOWN` para calidad, semántica de eventos, identidad,
reconciliación, atribución, causalidad y capacidad experimental cuando no hay
evidencia específica; no confunde atribución con incrementalidad ni datos
observados con datos fiables.

La migración `20261028180000_f5_p09_measurement_experimentation.sql` se aplicó
en el proyecto de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`). La
verificación recorrió cinco organizaciones: `5 succeeded`, `0 failed`, cinco
filas `VALIDATION_REQUIRED` contadas directamente y cleanup a cero. F5 sigue
abierta; el siguiente bloque habilitado es `5.10`, escalabilidad y eliminación
de constraints.

### Addendum de avance F5/P10 — 2026-09-18

`5.10` queda hecho con contrato de escalabilidad y constraints, validator,
migración, runtime, worker, workflow manual, endpoint y panel. El motor usa las
fuentes reales `shopify_sales_summary`, `shopify_margin_summary`,
`shopify_stock_summary`, `shopify_delivery_times` y `shopify_sales_daily` para
declarar demanda, throughput y cobertura operativa. No infiere capacidad,
headroom ni bottleneck del volumen actual: esos puntos siguen `UNKNOWN` hasta
que exista evidencia de capacidad y margen disponible. La UI muestra esa
separación como cobertura ordenada y está preparada para que la misma salida
alimente las cards y el `InsightsMenu` de IA existente, con enlaces profundos a
la card concreta; no se mezcla con las notificaciones generales.

La migración `20261028190000_f5_p10_scalability.sql` se aplicó en el proyecto de
desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`). La verificación recorrió
cinco organizaciones: `5 succeeded`, `0 failed`, cinco filas
`VALIDATION_REQUIRED` contadas directamente y cleanup a cero. F5 sigue abierta;
el siguiente bloque habilitado es `5.11`, recovery, crisis y playbooks
transversales.

### Cierre F5/P11 y conexión transversal de InsightsMenu — 2026-09-18

F5 queda cerrada con P11/5.11 hecho. `domain_extension.recovery_crisis` ya tiene
contrato, validator, motor, worker, workflow, endpoint y pantalla; el runtime
lee fuentes reales de Shopify y conserva `UNKNOWN` cuando no puede demostrar
crisis, severidad, blast radius, continuidad, containment, estabilización o
causa raíz.

Además se completó el canal común de IA para toda la familia de playbooks: el
`InsightsMenu` del header es independiente de las notificaciones normales,
consulta un feed tenant-scoped que conserva el último assessment por dominio y
lleva al consultor al ancla exacta `#insight-*` de la card. Esto no es una
decisión exclusiva de F5/P11: es el adaptador transversal que deben reutilizar
las fases anteriores y las siguientes. El feed actual consume los assessments
de playbooks F5; las salidas F3/F4 que todavía no tienen ese shape se
incorporarán mediante este mismo seam, sin inventar diagnósticos retrospectivos.
La verificación local sembró un
assessment temporal, lo leyó en las cinco organizaciones y lo borró al
terminar; `5 succeeded`, `0 failed`.

F5 queda cerrada; la siguiente fase habilitada por el índice es F6, benchmarks
y guardrails.

### Addendum F6/P00 — 2026-09-18

F6/P00 queda hecho con el framework universal de benchmarks y guardrails. El
contrato distingue referencia, contexto, economics, guardrails, evidencia y
confianza; el runtime observa fuentes Shopify e histórico propio cuando existe,
pero deja `UNKNOWN` en comparabilidad, benchmark externo, materialidad y
confianza no demostradas. Benchmark no se convierte en objetivo, diagnóstico,
prioridad ni playbook.

La migración `20261029090000_f6_p00_benchmark_guardrails.sql` se aplicó con
`.env.local` en `kopcblejsxpkxoykldyh`. La verificación sembró un template
temporal, ejecutó cinco organizaciones (`5 succeeded`, `0 failed`), obtuvo cinco
`VALIDATION_REQUIRED` y limpió todas las filas temporales. La pantalla enlaza
con `#insight-benchmark-guardrails` y reutiliza `InsightsMenu`, independiente de
las notificaciones normales.

La siguiente rebanada habilitada es F6/P01, contextualización y cohortes
comparables.

### Addendum F6/P01 — 2026-09-18

F6/P01 queda hecho con contrato, validator, motor, persistencia, worker,
workflow, endpoint y pantalla de contexto y cohortes comparables. La salida
separa la métrica observada de la referencia utilizada, comprueba que la
cohorte dependa de la métrica y conserva las limitaciones de definición,
muestra, mix y temporalidad. Con las fuentes actuales de Shopify se observa
métrica, muestra e histórico cuando existen, pero no se inventan segmentos,
peer groups, comparabilidad ni confianza.

La migración `20261029100000_f6_p01_cohort_context.sql` se aplicó con
`.env.local` en el proyecto de desarrollo `kopcblejsxpkxoykldyh`. La
verificación sembró un template temporal, ejecutó cinco organizaciones
(`5 succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas
las filas temporales. La pantalla enlaza con `#insight-cohort-context` y
reutiliza `InsightsMenu`, independiente de las notificaciones normales.

P01 queda hecho. La siguiente rebanada habilitada es F6/P02.

### Addendum F6/P02 — 2026-09-18

F6/P02 queda hecho con contrato, validator, motor, persistencia, worker,
workflow, endpoint y pantalla de calidad, suficiencia y fiabilidad de datos.
La salida reutiliza las evaluaciones D01 y las fuentes Shopify para separar
dato observado de evidencia utilizable: una cobertura o frescura observada no
se convierte automáticamente en definición correcta, reconciliación,
causalidad ni confianza alta.

La migración `20261029110000_f6_p02_data_quality_reliability.sql` se aplicó con
`.env.local` en el proyecto de desarrollo `kopcblejsxpkxoykldyh`. La
verificación sembró un template temporal, ejecutó cinco organizaciones
(`5 succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas
las filas temporales. La pantalla enlaza con
`#insight-data-quality-reliability` y reutiliza `InsightsMenu`, independiente
de las notificaciones normales y de la pantalla operativa D01.

P02 queda hecho. La siguiente rebanada habilitada es F6/P03.

### Addendum F6/P03 — 2026-09-18

F6/P03 queda hecho con contrato, validator, motor, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de adquisición y
generación de demanda. La salida separa pedidos nuevos/recurrentes,
economics, calidad de cliente e inventario de las afirmaciones que requieren
gasto, CAC, canal, demanda generada, maduración o incrementalidad. No se
confunde tráfico con demanda ni atribución con causalidad.

La migración `20261029120000_f6_p03_acquisition_demand.sql` se aplicó con
`.env.local` en el proyecto de desarrollo `kopcblejsxpkxoykldyh`. La
verificación sembró un template temporal, ejecutó cinco organizaciones
(`5 succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas
las filas temporales. La pantalla enlaza con `#insight-acquisition-demand` y
reutiliza `InsightsMenu`, independiente de las notificaciones normales.

P03 queda hecho. La siguiente rebanada habilitada es F6/P04.

### Addendum F6/P04 — 2026-09-18

F6/P04 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de Paid Media. Se
mantiene separado de F5.02 con el dominio `PAID_MEDIA_BENCHMARKS` para no
mezclar el playbook operativo con la capa de evaluación contextual.

La salida recorre spend/delivery, respuesta, tráfico, post-click, adquisición,
revenue, economics, atribución y guardrails. El motor no convierte ROAS en
beneficio, atribución en incrementalidad ni promedio en eficiencia marginal, y
conserva `UNKNOWN` cuando faltan objetivo, contexto, mix, escala, causalidad o
límites del tenant. La card enlaza con
`#insight-paid-media-benchmarks` desde `InsightsMenu`, separado de las
notificaciones normales.

La migración `20261029130000_f6_p04_paid_media_benchmarks.sql` y la verificación
de cinco organizaciones se ejecutaron con `.env.local`: `5 succeeded`, `0
failed`, cinco `VALIDATION_REQUIRED` y cleanup completo. La siguiente rebanada
habilitada es F6/P05.

### Addendum F6/P05 — 2026-09-18

F6/P05 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de conversión/CRO.
Se mantiene separado de F5.03 mediante `CONVERSION_CRO_BENCHMARKS`. La salida
comprueba definición y denominador, mezcla de tráfico, funnel, economics,
returns, oferta, inventario y operaciones según las fuentes disponibles, y no
confunde una caída de CVR con una causa, un experimento válido ni una
oportunidad totalmente recuperable.

La migración `20261029140000_f6_p05_conversion_cro_benchmarks.sql` se aplicó
con `.env.local`. La verificación temporal recorrió cinco organizaciones
(`5 succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` conservadores
por `problem_refs` desconocidos y limpió todas las filas sembradas. La card
queda anclada en `#insight-conversion-cro-benchmarks` y conectada al
`InsightsMenu`, independiente de las notificaciones normales.

P05 queda hecho. La siguiente rebanada habilitada es F6/P06.

### Addendum F6/P06 — 2026-09-18

F6/P06 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de oferta, pricing,
merchandising y AOV. Se mantiene separado de F5.04 mediante
`OFFER_PRICING_BENCHMARKS`: evalúa evidencia y guardrails, pero no cambia
precios, asigna promociones ni reordena productos automáticamente.

La salida descompone AOV en pedidos, revenue y UPT cuando existe evidencia,
contrasta contribution, funnel, product mix, promociones, returns, inventario
y merchandising, y conserva `UNKNOWN` para pricing, elasticidad,
incrementalidad, customer quality y comparabilidad no medidos. La migración
`20261029150000_f6_p06_offer_pricing_benchmarks.sql` se aplicó con
`.env.local`; la verificación recorrió cinco organizaciones (`5 succeeded`,
`0 failed`), obtuvo cinco `VALIDATION_REQUIRED` conservadores y limpió todas
las filas temporales. La card está anclada en
`#insight-offer-pricing-benchmarks` y conectada al `InsightsMenu`.

P06 queda hecho. La siguiente rebanada habilitada es F6/P07.

### Addendum F6/P07 — 2026-09-18

F6/P07 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de retención, CRM y
LTV. Se mantiene separado de F5.05 mediante `RETENTION_CRM_BENCHMARKS`.
La salida observa identidad, base de clientes, repeat, contribution,
configuración CRM, consentimiento e histórico; no declara ciclo natural,
cohortes maduras, churn, LTV o incrementalidad sin evidencia compatible.

La migración `20261029160000_f6_p07_retention_crm_benchmarks.sql` se aplicó con
`.env.local`. La verificación recorrió cinco organizaciones (`5 succeeded`,
`0 failed`), obtuvo cinco `VALIDATION_REQUIRED` conservadores y limpió todas
las filas temporales. La card está anclada en
`#insight-retention-crm-benchmarks` y conectada al `InsightsMenu`.

P07 queda hecho. La siguiente rebanada habilitada es F6/P08.

### Addendum F6/P08 — 2026-09-18

F6/P08 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de unit economics y
rentabilidad. Se mantiene separado de F5.06 mediante
`UNIT_ECONOMICS_BENCHMARKS`. La salida distingue revenue, descuentos, refunds,
COGS, costes variables, costes fijos y gross profit; no llama contribution al
net profit ni inventa CAC, payback, cash o escenarios.

La migración `20261029170000_f6_p08_unit_economics_benchmarks.sql` se aplicó
con `.env.local`; la verificación recorrió cinco organizaciones (`5
succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas las
filas temporales. La card está anclada en
`#insight-unit-economics-benchmarks` y conectada al `InsightsMenu`.

P08 queda hecho. La siguiente rebanada habilitada es F6/P09.

### Addendum F6/P09 — 2026-09-18

F6/P09 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de operaciones y CX.
Se mantiene separado de F5.08 mediante `OPERATIONS_CX_BENCHMARKS`. La salida
valida promesa y timestamps antes de juzgar delivery; no inventa capacidad,
backlog, support, CX ni coste desde una media de tiempos.

La migración `20261029180000_f6_p09_operations_cx_benchmarks.sql` se aplicó con
`.env.local`; la verificación recorrió cinco organizaciones (`5 succeeded`,
`0 failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas las filas
temporales. La card está anclada en
`#insight-operations-cx-benchmarks` y conectada al `InsightsMenu`.

P09 queda hecho. La siguiente rebanada habilitada es F6/P10.

### Addendum F6/P10 — 2026-09-18

F6/P10 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de benchmarks y guardrails de inventario. El
dominio `PRODUCT_INVENTORY_BENCHMARKS` se mantiene separado de F5.07. La
salida observa stock, available-to-sell, demanda, velocity, stockouts, margen e
histórico, y deja `UNKNOWN` para coverage, forecast, aging, accuracy, lead time,
supplier y replenishment sin evidencia compatible.

La migración `20261029190000_f6_p10_product_inventory_benchmarks.sql` se aplicó
con `.env.local`; la verificación recorrió cinco organizaciones (`5
succeeded`, `0 failed`), obtuvo cinco `VALIDATION_REQUIRED` conservadores y
limpió todas las filas temporales. La card está anclada en
`#insight-product-inventory-benchmarks` y conectada al `InsightsMenu`.

P10 queda hecho. La siguiente rebanada habilitada es F6/P11.

### Addendum F6/P11 — 2026-09-18

F6/P11 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de escalabilidad. El dominio
`SCALABILITY_BENCHMARKS` no reutiliza la conclusión de F5.10: mide cobertura de
objetivo, economics, inventario, operaciones e histórico sin inventar headroom,
bottleneck, cash, peak capacity ni scale state.

La migración `20261029200000_f6_p11_scalability_benchmarks.sql` se aplicó con
`.env.local`; la verificación recorrió cinco organizaciones (`5 succeeded`, `0
failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas las filas
temporales. La card está anclada en `#insight-scalability-benchmarks` y
conectada al `InsightsMenu`.

P11 queda hecho. La siguiente rebanada habilitada es F6/P12.

### Addendum F6/P12 — 2026-09-18

F6/P12 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de anomalías y red flags. El dominio
`ANOMALIES_RED_FLAGS` registra observación, fuentes e histórico, pero no declara
anomalía, pattern ni alerta sin baseline, desviación, relación esperada y
validación de tracking.

La migración `20261029210000_f6_p12_anomalies_red_flags.sql` se aplicó con
`.env.local`; la verificación recorrió cinco organizaciones (`5 succeeded`, `0
failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas las filas
temporales. La card está anclada en `#insight-anomalies-red-flags` y conectada al
`InsightsMenu`.

P12 queda hecho. La siguiente rebanada habilitada es F6/P13.

### Addendum F6/P13 — 2026-09-18

F6/P13 queda hecho con contrato, validator, motor puro, persistencia, worker,
workflow, endpoint y pantalla de confianza e incertidumbre. El dominio
`BENCHMARK_CONFIDENCE` separa claim, evidencia, scope, data, comparator,
pattern, cause e intervention; no calcula un score global ni convierte
confidence en autorización.

La migración `20261029220000_f6_p13_benchmark_confidence.sql` se aplicó con
`.env.local`; la verificación recorrió cinco organizaciones (`5 succeeded`, `0
failed`), obtuvo cinco `VALIDATION_REQUIRED` y limpió todas las filas
temporales. La card está anclada en `#insight-benchmark-confidence` y conectada
al `InsightsMenu`.

F6 queda cerrada completa (`P00`–`P13`) en contrato, motor y pixel. Antes de
abrir F7 se establece una pausa transversal obligatoria para adaptar y verificar
el consumo por Copiloto de F3, F4, F5 y F6. F7 sigue siendo la siguiente fase
planificada, pero no se abre hasta cerrar esta auditoria de integracion.

### Pausa transversal Copiloto-first — 2026-09-18

El producto se construye para que el Copiloto consulte diagnosticos,
priorizaciones, playbooks y benchmarks con procedencia, aislamiento por
organizacion y semantica conservadora. `InsightsMenu` ya proporciona el salto
desde el indicador de IA hasta la card concreta y sigue separado de las
notificaciones normales; no sustituye a la tool o al adaptador que alimenta el
razonamiento del agente.

Antes de F7 se revisara fase a fase que cada bloque de F3–F6 tenga consumidor
de Copiloto declarado, contexto/tool de lectura, `allowed_tools` y version del
agente cuando corresponda, tests de aislamiento y una pregunta representativa
verificada con datos reales. La auditoria puede cerrar varios bloques mediante
un adaptador comun; no se crearan tools de escritura por defecto. Las acciones
seguiran pasando por propuesta, aprobacion, idempotencia y auditoria.

### Cierre de la pausa Copiloto-first — 2026-09-18

La auditoria F3-F6 queda cerrada. El consumidor primario es A09, activo como
`v8` con prompt `v4`. El adaptador común
`loadDecisionPlaybookContextBlocks` entrega el snapshot del caso D00-D11, las
revisiones D12/D13, la salida D14, el contexto y salida decisional de F4 y los
playbooks/benchmarks F5/F6 con `organization_id`, procedencia, `as_of`,
`source_refs`, facts tri-state y estados de abstención.

Las queries fijan el tenant y aplican un segundo filtro en memoria. Los tests
cubren unknowns, aislamiento, contexto no confiable, permisos y navegación de
`InsightsMenu`. D12/D13/D14 disponen además de feed de IA con anclas exactas,
separado de las notificaciones normales. La prueba transaccional real sobre
`.env.local` sembró dos tenants, obtuvo los tres dominios F3 para el tenant
solicitado y terminó con rollback y cero filas residuales.

Con esta pausa cerrada, F7 queda desbloqueada para una siguiente decisión de
trabajo; no se abre ni se implementa automáticamente en esta auditoria.

### Apertura y cierre F7/P01 - 2026-09-18

La primera rebanada de F7 queda abierta y `7.01` queda hecha con contrato,
motor puro probado, runtime persistente, worker, workflow, API y panel. El
bloque evalúa la elegibilidad de cada candidato del catálogo activo, pero no
prioriza, no selecciona ni autoriza ejecución. Las conclusiones no demostradas
conservan `UNKNOWN` y el run se expone al Copiloto con `organization_id`,
`as_of`, `source_refs`, `reason_codes` y unknowns.

La migración `20261030100000_f7_p01_intervention_eligibility.sql` se aplicó y
verificó con `.env.local`; el smoke real dejó `VALIDATION_REQUIRED`, una
evaluación persistida, aislamiento tenant y cero filas tras cleanup. La card
está anclada en `#insight-intervention-eligibility` y conectada al
`InsightsMenu` separado de las notificaciones normales.

La siguiente rebanada habilitada es `7.02`. Los bloques `7.15`, `7.17` y `7.18`
siguen pendientes de su destilación/implementación y no se consideran cerrados
por este avance.

### Cierre F7/P02 - 2026-09-18

F7/P02 queda hecho con contrato, motor puro probado, runtime persistente,
worker, workflow, endpoint, panel y consumo Copiloto-first. El matching solo
mantiene candidatos cuya cadena `problema -> driver -> causa -> mecanismo ->
palanca -> intervención` puede trazarse; cuando falta el problema upstream, la
salida es `VALIDATION_REQUIRED` y no se inventa encaje causal.

La migración `20261030200000_f7_p02_intervention_matching.sql` se aplicó con
`.env.local`; el smoke real confirmó aislamiento tenant, cero selección y
cleanup a cero. La card está anclada en
`#insight-intervention-matching` y conectada al `InsightsMenu` separado de las
notificaciones normales.

La siguiente rebanada habilitada es `7.03`. Los bloques `7.15`, `7.17` y `7.18`
siguen pendientes y no se consideran cerrados por este avance.

### Cierre F7/P03 - 2026-09-18

F7/P03 queda hecho con contrato cualitativo, motor puro probado, runtime
tenant-bound que consume elegibilidad y matching, persistencia, worker,
workflow, endpoint, pantalla y consumo Copiloto-first. La prioridad principal
solo se expone cuando una candidata domina sin trade-off no resuelto; si faltan
datos o hay empate cualitativo, el sistema conserva `VALIDATION_REQUIRED`.

No se introduce score, ROI ni pesos arbitrarios. Guardrails fallidos producen
`DO_NOT_DO`, los unknowns no se convierten en valores bajos y cada salida
incluye `execution_authorized: false`. `InsightsMenu` enlaza la card exacta de
F7.03 y permanece separado de las notificaciones normales.

La migracion `20261030300000_f7_p03_intervention_prioritization.sql` se aplico
con `.env.local`. El smoke real sembro temporalmente un candidato
`MATCHED`/`ELIGIBLE_NOW`, obtuvo `PRIORITY_AVAILABLE`, confirmo el tenant y la
ausencia de autorizacion de ejecucion, y termino con cleanup a cero. La
siguiente rebanada habilitada es F7/P04 (`7.04`).

### Cierre F7/P04 - 2026-09-19

F7/P04 queda hecho. Se implemento la expectativa de impacto de la intervencion
como una cadena trazable desde mecanismo e indicador lider hasta KPI y outcome,
con magnitud cualitativa por defecto, incrementabilidad/contrafactual,
trade-offs, unknowns y guardrails. No se anaden score, ROI, forecast ni
autorizacion de ejecucion; el contrato conserva `execution_authorized: false`.

El bloque incluye contrato y tests, migracion
`20261030400000_f7_p04_intervention_impact.sql`, runtime
`apps/api/src/intervention-impact-engine.ts`, worker/workflow, API y panel
`#insight-intervention-impact`. El Copiloto recibe F7.04 como bloque separado
y `InsightsMenu` navega a la card cuando la evidencia exige validacion. La
verificacion real con `.env.local` persistio un caso `IMPACTS_AVAILABLE` y
termino con cleanup a cero. F7/P04 se mantiene separado de la evaluacion de
impacto decisional de F4.

La siguiente rebanada habilitada es F7/P05 (`7.05`); `7.15`, `7.17` y `7.18`
siguen pendientes.

### Cierre F7/P05 - 2026-09-19

F7/P05 queda hecho. Se implemento la factibilidad de recursos como una
evaluacion cualitativa que mantiene separadas capacidad, esfuerzo y coste.
La salida reconstruye recurso requerido -> disponibilidad -> bottleneck/gap ->
factibilidad -> adaptacion o alternativa. No introduce score, ROI, formula de
coste, hourly rates ni umbrales universales; los importes sin soporte explicito
se descartan y el contexto faltante conserva `VALIDATION_REQUIRED`.

El bloque incluye contrato y tests, migracion
`20261030500000_f7_p05_intervention_feasibility.sql`, runtime
`apps/api/src/intervention-feasibility-engine.ts`, worker/workflow, API y panel
`#insight-intervention-feasibility`. El Copiloto recibe F7.05 como bloque
separado y `InsightsMenu` navega a la card cuando falta contexto. La
verificacion real con `.env.local` persistio `FEASIBILITY_AVAILABLE` y
`FEASIBLE_NOW`, sin bottleneck inventado, con `execution_authorized: false` y
cleanup a cero.

La siguiente rebanada habilitada es F7/P06 (`7.06`); `7.15`, `7.17` y `7.18`
siguen pendientes.

### Cierre F7/P06 - 2026-09-19

F7/P06 queda hecho con contrato, motor puro probado, runtime persistente,
worker, workflow, endpoint, pantalla y consumo Copiloto-first. La evaluación
mantiene separados upside, downside, incertidumbre, exposición, blast radius,
reversibilidad, evidencia, riesgo de inacción, guardrails, observabilidad y
coste del error. No calcula `risk score`, probabilidades ni autoriza acciones.

Guardrails duros fallidos y riesgo existencial producen `DO_NOT_PROCEED`; el
resto se degrada proporcionalmente a mitigación o validación. Claims numéricos
sin soporte se descartan, y el Copiloto recibe la trazabilidad con
`execution_authorized: false`. La card está anclada en
`#insight-intervention-risk` y conectada al `InsightsMenu` separado de las
notificaciones normales.

La migración `20261030600000_f7_p06_intervention_risk.sql` se aplicó con
`.env.local`; el smoke real persistió `RISK_ASSESSMENTS_AVAILABLE` y terminó
con cleanup a cero. La siguiente rebanada habilitada es F7/P07 (`7.07`).

### Cierre F7/P07 - 2026-09-19

F7/P07 queda hecho con contrato, motor puro probado, runtime persistente,
worker, workflow, endpoint, pantalla y consumo Copiloto-first. La salida
construye una ruta condicional de decisión a partir de prerequisitos,
bloqueadores, desbloqueos, gates, ramas, paralelismo explícito, `NOT YET`,
esperas y condiciones de salida. No es un DAG técnico, scheduler, backlog,
calendario, asignación de owners ni autorización de ejecución.

La migración `20261030700000_f7_p07_intervention_sequencing.sql` se aplicó con
`.env.local`; el smoke real persistió `SEQUENCES_AVAILABLE`, confirmó el camino
`NOW/THEN`, gate, aislamiento tenant y `execution_authorized: false`, y terminó
con cleanup a cero. La card está anclada en
`#insight-intervention-sequencing` y conectada al `InsightsMenu` separado de
las notificaciones normales.

La siguiente rebanada habilitada es F7/P08 (`7.08`).

### Cierre F7/P08 - 2026-09-19

F7/P08 queda hecho con contrato, motor puro probado, runtime persistente,
worker, workflow, endpoint, pantalla y consumo Copiloto-first. La salida decide
cualitativamente entre fijar un defecto, ejecutar directamente, testear,
pilotar, recopilar evidencia, esperar u ordenar no proceder. Conserva
hipótesis, pregunta de aprendizaje, outcome primario, guardrails, exposición,
observación, contaminación, fidelidad, transferencia y decisión posterior.

El bloque no calcula sample size, significancia, duración exacta, porcentajes,
asignación de tráfico ni ganador automático; tampoco lanza experimentos,
cambia producción o autoriza ejecución. La migración
`20261030800000_f7_p08_intervention_test_execute.sql` se aplicó con
`.env.local`; el smoke real persistió `DECISIONS_AVAILABLE` con modo `TEST`,
confirmó hipótesis, handoff, aislamiento tenant y `execution_authorized: false`,
y terminó con cleanup a cero. La card está anclada en
`#insight-intervention-test-execute` y conectada al `InsightsMenu` separado de
las notificaciones normales.

La siguiente rebanada habilitada es F7/P09 (`7.09`).

### Cierre F7/P09 - 2026-09-20

F7/P09 queda hecho con contrato multidimensional de intensidad, motor puro con
tests, runtime tenant-bound, persistencia idempotente, worker, workflow, API,
panel y seam transversal de Copiloto/`InsightsMenu`. La salida separa magnitud,
scope, velocidad y duracion, explica limiter, rampa y observacion, y conserva
la abstencion cuando faltan observabilidad, economia marginal o saturacion.

No calcula porcentaje universal, presupuesto, asignacion, rollout, scheduler,
aprobacion ni ejecucion. `execution_authorized` permanece en `false`. La
migracion `20261030900000_f7_p09_intervention_intensity.sql` se aplico con
`.env.local`; el smoke real produjo `INTENSITY_PROFILES_AVAILABLE` con modo
`INCREASE` y cleanup a cero. Contratos, API y web pasan sus suites enfocadas.

La siguiente rebanada habilitada es F7/P10 (`7.10`).

### Cierre F7/P10 - 2026-09-20

F7/P10 queda hecho con contrato y motor puro de recomendaciones adaptadas a
madurez, runtime tenant-bound, persistencia idempotente, worker, workflow, API,
panel y seam transversal de Copiloto/`InsightsMenu`. La salida distingue
madurez funcional de readiness, separa `NOW/LATER`, emite `NOT YET` y
`BUILD_CAPABILITY_FIRST` cuando corresponde, detecta reset local y evita
sofisticación por encima de la capacidad de absorción.

No calcula maturity score, no usa revenue, tamaño o tooling como proxy, no
cambia organización, no compra herramientas y no autoriza ejecución.
`execution_authorized` permanece en `false`. La migración
`20261031000000_f7_p10_maturity_recommendations.sql` se aplicó con
`.env.local`; el smoke real produjo `MATURITY_RECOMMENDATIONS_AVAILABLE` con
`BUILD_CAPABILITY_FIRST`/`LATER` y cleanup a cero. Contratos, API, worker y web
pasan sus verificaciones enfocadas.

La siguiente rebanada habilitada es F7/P11 (`7.11`).

### Cierre F7/P11 - 2026-09-20

F7/P11 queda hecho con contrato, motor puro probado, runtime persistente desde
F7.10, worker, workflow, endpoint, panel y consumo Copiloto-first. El bloque
evita la recomendación de mundo ideal: descubre y valida el constraint
vinculante antes de decidir, distingue hard/soft y temporal/estructural,
comprueba si el sistema puede absorber un resultado positivo y propone la
mejor acción factible mediante reducir alcance, reasignar, sustituir,
resecuenciar, preparar o esperar. Mantiene separadas restricción, riesgo,
dependencia, guardrail e incertidumbre y no asigna recursos ni ejecuta cambios.

La migración `20261031100000_f7_p11_constraint_recommendations.sql` se aplicó
con `.env.local`. El smoke real produjo
`CONSTRAINT_RECOMMENDATIONS_AVAILABLE` con `REDUCE_SCOPE`, outcome ajustado y
cleanup a cero. Contratos, API, worker y web pasan sus verificaciones enfocadas.

La siguiente rebanada habilitada es F7/P12 (`7.12`).

### Cierre F7/P12 - 2026-09-20

F7/P12 queda implementado end-to-end y Copiloto-first: contrato, motor puro
con tests, runtime, persistencia, migración, worker, workflow, endpoint, panel,
feed de InsightsMenu y bloque de contexto del Copiloto. La cartera se construye
alrededor de una prioridad dominante y conserva Primary, Enabling, Supporting,
Parallel, Deferred y Excluded; valida interferencias, recursos agregados,
secuencia, riesgo y simplicidad sin convertirse en optimizer, WIP manager,
scheduler ni ejecución autónoma.

La migración se aplicó con `.env.local`; el smoke real produjo
`PORTFOLIO_AVAILABLE` y confirmó cleanup a cero. F7/P12 está hecho; el siguiente
bloque habilitado es F7/P13 (`7.13`).
### Cierre F7/P13 - 2026-09-20

F7/P13 queda implementado end-to-end y Copiloto-first. La decisión dinámica
actualiza una recomendación con evidencia observada y devuelve `STOP`,
`CONTINUE`, `SCALE` o `ROLLBACK`, también en cartera mixta por unidad. Conserva
fidelidad, estado previo, causalidad, incrementalidad, guardrails, headroom,
economía marginal, readiness, reversibilidad, exposición y aprendizaje; si
faltan datos devuelve `VALIDATION_REQUIRED` y no completa por inferencia.

Incluye contrato, motor puro con tests, runtime desde F7.12, persistencia,
migración `20261031120000_f7_p13_dynamic_decisions.sql`, worker, workflow,
endpoint, panel `#insight-dynamic-decision`, feed de `InsightsMenu` y contexto
del Copiloto. No monitoriza ni ejecuta cambios: `execution_authorized` queda en
`false`. Smoke real con `.env.local`: `DECISIONS_AVAILABLE` / `SCALE`,
persistencia y cleanup a cero; desarrollo sin migraciones pendientes. F7/P13
está hecho; el siguiente bloque es F7/P14.
### Cierre F7/P14 - 2026-09-20

F7/P14 queda implementado end-to-end y Copiloto-first. El bloque decide si
conviene `NO_ACTION`, `WAIT`, `GATHER_EVIDENCE`, `ACT_SMALL` o `ACT`, separando
la materialidad del problema, señal frente a ruido, riesgo de acción y de
inacción, timing, natural resolution, coste de delay y valor de la información.
Cuando falta el hecho capaz de cambiar la decisión devuelve
`VALIDATION_REQUIRED`; no convierte toda incertidumbre en investigación.

Incluye contrato, motor puro con tests, runtime desde F7.13, persistencia,
migración `20261031130000_f7_p14_restraint_decisions.sql`, worker, workflow,
endpoint, panel `#insight-restraint-decision`, feed de `InsightsMenu` y bloque
del Copiloto. No monitoriza, no programa revisiones, no recopila evidencia de
forma automática y no ejecuta cambios: `execution_authorized` permanece en
`false`. Smoke real con `.env.local`: `DECISION_AVAILABLE / WAIT`, persistencia
y cleanup a cero; desarrollo sin migraciones pendientes. F7/P14 está hecho y
el siguiente bloque es F7/P15.
### Cierre F7/P15 — 2026-09-20

F7/P15 queda implementado end-to-end y Copiloto-first. Construye una tesis
causal y expected outcomes por capas, separados de success criteria y de la
observación posterior. Conserva evidencia de mecanismo, outcome primario,
guardrails, baseline/contrafactual, incrementalidad, economía, horizonte,
repetibilidad, escalabilidad, sostenibilidad y condiciones para continuar,
detener, escalar o revertir. Si faltan hechos decisivos devuelve
`VALIDATION_REQUIRED`; no inventa magnitudes, no convierte un piloto en
readiness de escala y no promete resultados.

Incluye contrato, motor puro con 6 tests, runtime desde F7.14, tabla
`expected_outcome_runs`, migración `20261031140000_f7_p15_expected_outcomes.sql`,
worker, workflow, endpoint, panel `#insight-expected-outcome`, feed de
`InsightsMenu` y contexto del Copiloto. `execution_authorized` permanece en
`false`; la medición y comparación expected-vs-observed pertenecen al flujo
posterior de observación/aprendizaje.

Verificado con `.env.local`: smoke real temporal, persistencia y cleanup a
cero; 802/802 contratos, suites API/web, typecheck y builds pasan. Se aplicaron
en producción las migraciones F7.13, F7.14 y F7.15, y el dry-run final informa
cero pendientes. F7.17 y F7.18 siguen abiertos; F7 no se cierra hasta que
ambos estén hechos.
### Cierre F7/P17 — 2026-09-20

F7/P17 queda implementado end-to-end y Copiloto-first. La IA ya puede
expresar confianza calibrada sin colapsar diagnóstico, recomendación, impacto,
riesgo, ejecución, durabilidad, escala y transferencia en una cifra. Conserva
la evidencia, su integridad, relevancia, consistencia, encaje causal,
incertidumbre principal, contradicciones y contexto de transferencia; adapta
el compromiso cualitativo cuando la confianza, el riesgo, la reversibilidad,
el coste de error/delay y la factibilidad lo exigen.

Incluye contrato, motor puro con tests, runtime desde F7.15, tabla
`recommendation_confidence_runs`, migración
`20261031150000_f7_p17_recommendation_confidence.sql`, worker, workflow,
endpoint, panel `#insight-recommendation-confidence`, feed de `InsightsMenu` y
contexto del Copiloto. No calcula probabilidades, porcentajes, scores ni
umbrales universales; tampoco ejecuta, pilota, escala, revierte ni modifica
presupuestos. `execution_authorized` permanece en `false`.

Verificado con `.env.local`: smoke real, persistencia y cleanup a cero;
807/807 contratos, API/Copiloto, UI, typecheck y builds pasan. La migración se
aplicó en desarrollo y producción; ambos dry-runs informan cero pendientes.
F7.18 sigue abierto y es el siguiente bloque.

### Cierre F7/P18 — 2026-09-20

F7/P18 queda implementado end-to-end y Copiloto-first, cerrando la cadena de
comunicación del Motor de Recomendaciones. La IA ya presenta una recomendación
principal antes de la explicación y conserva por qué, por qué ahora, qué no
hacer, outcome condicional, riesgo, hechos frente a inferencias, incertidumbre
crítica, señal de éxito, condición invalidante y siguiente decisión. La
comunicación adapta claridad, alcance y profundidad, pero no degrada el
razonamiento por audiencia o plan; tampoco ejecuta ni autoriza cambios.

Incluye contrato, motor puro TDD, runtime tenant-bound desde F7.17/F7.15, tabla
`recommendation_communication_runs`, migración
`20261031160000_f7_p18_recommendation_communication.sql`, worker, workflow,
endpoint, panel `#insight-recommendation-communication`, feed de
`InsightsMenu` y contexto del Copiloto. No inventa ROI, uplift, plazos ni
certeza; `execution_authorized` permanece en `false`.

Verificado con `.env.local`: smoke real temporal, persistencia y cleanup a
cero; contratos, API/Copiloto, UI, typechecks y builds pasan. La migración se
aplicó en desarrollo y producción; ambos dry-runs informan cero pendientes.
F7 queda cerrada completa y F8 queda habilitada.


### Cierre F8/P02 — 2026-09-20

F8/P02 queda implementado end-to-end y Copiloto-first. El contrato y el motor distinguen autonomía graduada, requisito de aprobación, gate, autoridad, vigencia, revocación, escalado y estado de ejecución. Una aprobación no se convierte en ejecución: el resultado conserva `execution_authorized: false` y una acción material permanece bloqueada hasta que el runtime ejecutor de los siguientes bloques la consuma con sus propios guardrails.

Incluye `packages/contracts/src/hitl-approval.ts`, tests TDD, runtime tenant-bound en `apps/api/src/hitl-approval-engine.ts`, tabla `hitl_approval_assessment_runs`, migración `20260920182834_f8_p02_hitl_approval_assessments.sql`, worker, workflow, API, panel `#insight-hitl-approval`, feed de `InsightsMenu` y bloque específico del Copiloto. La tabla tiene RLS para consultor/platform admin y la escritura queda en el worker service-role.

Smoke real con `.env.local`: acción temporal material → `APPROVAL_REQUIRED/PENDING/BLOCKED`; tras aprobación → `AUTONOMY_AVAILABLE/APPROVED/BLOCKED`, freshness `CURRENT` y `execution_authorized=false`; cleanup a cero. Desarrollo y producción tienen la migración aplicada y ambos dry-runs quedan sin pendientes. El siguiente bloque habilitado es F8/P16.


### Cierre F8/P16 — 2026-09-20

F8/P16 queda implementado end-to-end y Copiloto-first. El sistema distingue completion de closure: lee la salida aprobada y las tareas realmente materializadas, detecta acciones activas, conserva el estado esperado frente al real, exige verificación/cleanup/riesgo/ownership explícitos y genera un paquete de outcome y learning handoff para Fase 9. `CLOSED` no se interpreta como éxito de negocio ni como causalidad demostrada.

Incluye `packages/contracts/src/closure-handoff.ts`, tests TDD, `apps/api/src/closure-handoff-engine.ts`, tabla `execution_closure_runs`, migración `20260920191350_f8_p16_execution_closure_runs.sql`, worker, API, panel `#insight-closure-handoff`, feed de `InsightsMenu` y bloque del Copiloto. El runtime no ejecuta, no autoriza y no reescribe acciones; solo captura hechos observados y conserva unknowns/bloqueos.

Smoke real con `.env.local`: `COMPLETED/gate=false/active_actions` antes de completar la tarea temporal y `CLOSED/gate=true/SUCCESS` después; cleanup a cero. Desarrollo y producción tienen la migración aplicada y ambos dry-runs quedan sin pendientes. La ola 1 de F8 (`8.02` + `8.16`) queda completa; el siguiente bloque técnico es `8.03`.

### Cierre F8/P03 — 2026-09-20

F8/P03 queda implementado end-to-end y Copiloto-first. El sistema transforma la recomendación comunicada en un plan verificable, con intención, alcance, acciones mínimas, dependencias, orden seguro, camino crítico, checkpoints, rollout, ventanas, budgets, criterios de parada y rollback. La validación separa `READY`, `READY_WITH_APPROVAL`, `BLOCKED` e `INVALID`; el plan no ejecuta herramientas, no crea tareas y conserva `execution_authorized: false`.

Incluye `packages/contracts/src/execution-plan.ts`, tests TDD, `apps/api/src/execution-plan-engine.ts`, tabla `execution_plan_runs`, migración `20260920200847_f8_p03_execution_plans.sql`, worker, workflow, endpoint, panel `#insight-execution-plan`, feed de `InsightsMenu` y bloque del Copiloto. Smoke real con `.env.local` validó secuencia y camino crítico y dejó cleanup a cero; desarrollo y producción tienen la migración aplicada.

El siguiente bloque técnico habilitado es F8/P04 (`8.04`); F8 sigue abierta.

### Cierre F8/P04 — 2026-09-20

F8/P04 queda implementado end-to-end y Copiloto-first. La IA ya separa plan válido de entorno preparado: evalúa precondiciones por dimensión, evidencia, autorización/freshness, estado del target, medición, recovery, ventana, freeze y concurrencia. Los unknowns críticos y la aprobación no lista bloquean; los degradados pueden exigir controles compensatorios y remediation. La readiness se revalida y no autoriza ejecución.

Incluye `packages/contracts/src/readiness.ts`, tests TDD, `apps/api/src/readiness-engine.ts`, tabla `readiness_assessment_runs`, migración `20260920202151_f8_p04_readiness_assessments.sql`, worker, workflow, endpoint, panel `#insight-readiness`, feed de `InsightsMenu` y bloque del Copiloto. Smoke real con `.env.local` validó `BLOCKED`, remediation y `execution_authorized=false`; cleanup a cero. Desarrollo y producción tienen la migración aplicada.

El siguiente bloque técnico habilitado es F8/P05 (`8.05`); F8 sigue abierta.
### Cierre F8/P05 — 2026-09-20

F8/P05 queda implementado end-to-end y Copiloto-first. El sistema construye y
valida el action envelope efectivo: alcance, tipos y tools, objetos,
tenant/entorno, magnitud, budgets, condiciones, invariantes, frescura y
capacidad restante. Las acciones fuera de scope, prohibidas, destructivas,
con otro tenant/entorno o con límites excedidos se bloquean; no existe
ampliación silenciosa ni autoridad derivada de que un tool esté disponible.
`execution_authorized` permanece en `false`.

Incluye `packages/contracts/src/action-envelope.ts`, tests TDD,
`apps/api/src/action-envelope-engine.ts`, tabla `action_envelope_runs`,
migración `20260920203023_f8_p05_action_envelopes.sql`, worker, workflow,
endpoint `GET /v1/consultant/action-envelope`, panel
`#insight-action-envelope`, feed de `InsightsMenu` y bloque del Copiloto.

Verificado con `.env.local`: envelope temporal dentro de scope → `INSIDE`,
persistencia confirmada, `execution_authorized=false` y cleanup a cero. La
migración se aplicó en desarrollo y producción. F8 permanece abierta; el
siguiente bloque es F8/P06.
### Cierre F8/P06–P15 y P17 — 2026-09-20

F8 queda cerrada completa. La supervisión de ejecución ya no es un concepto
único: se evalúan por separado capabilities y permisos, safe execution,
monitoring, guardrails, lifecycle, incidentes, rollback/recovery, override
humano, concurrencia, verificación y reporting. Cada etapa conserva checks,
evidencia, bloqueos, warnings, siguientes acciones, tenant y trazabilidad.

La implementación común usa `packages/contracts/src/execution-supervision.ts`,
`apps/api/src/execution-supervision-engine.ts`, la tabla
`execution_supervision_runs`, worker, workflow, endpoint, panel
`#insight-execution-supervision`, feed de `InsightsMenu` y contexto del
Copiloto. No ejecuta tools, no escala permisos, no hace retries destructivos y
mantiene `execution_authorized=false`.

Verificado con `.env.local`: las once etapas reales producen estados
conservadores (`READY`, `CONDITIONAL` o `BLOCKED` según evidencia), todas las
filas quedan sin autorización y el cleanup es cero. Migración aplicada en
desarrollo y producción; F9 queda habilitada.
### Cierre F8/P00–P17 — 2026-09-20

Con las etapas raíz `UNIVERSAL` y `EXECUTABILITY_AUTHORIZATION`, F8 queda
cerrada completa. El contrato universal separa decisión y ejecución, y la
evaluación de ejecutabilidad distingue capacidad técnica, acceso, permisos,
readiness, envelope, aprobación y autoridad empresarial. Ninguna de esas
señales se convierte por sí sola en permiso de ejecutar.

La migración `20260920204900_f8_p00_p01_stage_roots.sql` actualiza el catálogo
de etapas y la pantalla/Copiloto muestran F8.00 y F8.01 junto a F8.02–F8.17.
F9 queda habilitada.
### Auditoría Copiloto-first F8/F9 — 2026-09-21

El turno A09 compone ahora vista, historial, restricciones y snapshots F3–F9
antes de llamar al modelo. Las tools siguen verificando cifras actuales con
aislamiento tenant; los snapshots no conceden autoridad ni sustituyen
`allowed_tools` o aprobación. La migración A09 v6/v10 deja esta política
persistida, y los fallos de lectura se exponen como indisponibilidad. La UI de
Diagnóstico y `InsightsMenu` enlazan las cards exactas F8/F9 separadas de las
notificaciones.

### Cierre F9 — aprendizaje continuo — 2026-09-21

F9 queda cerrada en software para sus 40 bloques reales (`9.00`, `9.01`,
`9.03–9.20`, `9.22–9.41`). `9.21` no se implementa porque el índice canónico
lo declara inexistente. El contrato común de Experience/LearningAssessment y
los perfiles runtime por bloque preservan contexto, ejecución, evidencia,
atribución, outcome, confianza, límites y unknowns.

La cadena real parte de `execution_closure_runs`/`agent_outputs` de F8,
persiste `continuous_learning_runs`, se ejecuta mediante worker/workflow,
aparece en API, Copiloto, panel de diagnóstico y `InsightsMenu`. No convierte
éxito operacional en aprendizaje causal sin evidencia suficiente y distingue
`NEUTRAL` de `INCONCLUSIVE`. Migración aplicada en desarrollo y producción.
