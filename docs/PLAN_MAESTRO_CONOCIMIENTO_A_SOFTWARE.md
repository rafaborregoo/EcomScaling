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
`02`..`06` sin implementar y 5 bloques todavia sin destilar (seccion 6).

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
8. **Consumo por agentes** Ã¢â‚¬â€ el bloque dice **que agente lo usa y a traves de
   que tool**, o que ninguno y por que. Una tabla que ningun agente puede leer
   no cambia el comportamiento del producto. Ver el apartado 10.

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

De los 129, **5 siguen sin destilar** (corpus maestro sin ninguna capa de
especificacion): `6.04`, `7.15`, `7.17`, `7.18`, `8.12`. No son opcionales ni
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
5. Fuera de la cola de fases, cuando estorbe: destilar `6.04`, `7.15`, `7.17`,
   `7.18` y `8.12`, y un ADR para el reparto de la seccion 1.

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
