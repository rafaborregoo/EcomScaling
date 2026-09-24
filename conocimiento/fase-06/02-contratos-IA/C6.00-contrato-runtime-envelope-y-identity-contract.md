# **C6.0 — RUNTIME ENVELOPE & IDENTITY CONTRACT**

## **EcomScaling IA — Fase 6: Benchmarks & Guardrails**

---

# **1\. PROPÓSITO**

El Runtime Envelope & Identity Contract define la envolvente común que debe acompañar a cualquier ejecución, evaluación, análisis, detección o artefacto generado dentro de la Fase 6 — Benchmarks & Guardrails.

Su responsabilidad no es evaluar métricas.

Su responsabilidad no es determinar si algo es bueno o malo.

Su responsabilidad no es seleccionar benchmarks.

Su responsabilidad no es aplicar guardrails.

Su responsabilidad es proporcionar la identidad, contexto operativo, versionado, aislamiento multi-tenant y anclajes de trazabilidad necesarios para que todo lo anterior pueda realizarse posteriormente de forma:

* reproducible;  
* auditable;  
* versionable;  
* correlacionable;  
* observable;  
* segura;  
* multi-tenant;  
* testeable.

C6.0 constituye la infraestructura común sobre la que se apoyan todos los demás contratos de Fase 6\.

---

# **2\. PROBLEMA QUE RESUELVE**

Sin un Runtime Envelope común, distintos componentes podrían producir evaluaciones como:

CAC \= 48 €  
status \= risk

sin poder responder posteriormente:

¿De qué ecommerce era?

¿Qué ejecución produjo el resultado?

¿Qué versión del evaluator se utilizó?

¿Qué policy estaba activa?

¿Qué versión de benchmarks existía?

¿Qué configuración del tenant se aplicó?

¿Fue una ejecución real o una simulación?

¿Era producción o testing?

¿Fue un análisis nuevo o un replay?

¿Qué proceso originó esta evaluación?

¿Qué otros findings pertenecían al mismo análisis?

¿Qué versión del contrato interpretaba estos campos?

¿Qué agente inició la ejecución?

¿Cuándo se produjo exactamente?

¿Puede reconstruirse meses después?

C6.0 debe impedir esta pérdida de contexto.

---

# **3\. PRINCIPIO FUNDAMENTAL**

Ningún artefacto material generado por la Fase 6 debe existir de forma huérfana.

Todo artefacto debe poder relacionarse con una ejecución identificable.

Conceptualmente:

ARTIFACT  
    ↓  
EXECUTION  
    ↓  
TRACE  
    ↓  
TENANT  
    ↓  
BUSINESS  
    ↓  
CONFIGURATION SNAPSHOT  
    ↓  
VERSION MANIFEST

Por tanto:

No material Phase-6 artifact  
without runtime identity.

---

# **4\. RESPONSABILIDAD DEL CONTRATO**

C6.0 debe responder exclusivamente a preguntas de infraestructura como:

¿Quién está ejecutando?

¿Para qué tenant?

¿Sobre qué ecommerce?

¿En qué entorno?

¿Qué ejecución es?

¿De qué ejecución depende?

¿Qué proceso la originó?

¿Es live, simulation, replay o test?

¿Qué versiones estaban activas?

¿Qué configuración debe considerarse vigente?

¿Cuándo se ejecutó?

¿A qué momento de negocio se refiere?

¿Qué ejecución anterior está siendo reproducida?

¿Qué capacidades estaban habilitadas?

¿Cómo puede correlacionarse con el resto del sistema?

---

# **5\. LO QUE C6.0 NO DEBE HACER**

C6.0 NO debe contener:

* valores de métricas;  
* thresholds concretos;  
* benchmarks;  
* targets;  
* guardrails;  
* diagnósticos;  
* severidad de negocio;  
* hipótesis;  
* recomendaciones;  
* prioridades;  
* estrategias;  
* playbooks;  
* acciones;  
* razonamiento ecommerce.

Tampoco debe convertirse en un objeto gigantesco donde se almacene toda la ejecución.

Su función es identificar y envolver.

Los datos especializados pertenecen a contratos especializados.

---

# **6\. PRINCIPIO DE SEPARACIÓN**

Debe mantenerse:

IDENTITY  
≠  
BUSINESS CONTEXT  
≠  
METRIC DATA  
≠  
POLICY  
≠  
EVALUATION  
≠  
EVIDENCE  
≠  
OBSERVABILITY

C6.0 proporciona los enlaces necesarios entre esas capas.

No absorbe sus responsabilidades.

---

# **7\. MODELO DE IDENTIDAD**

La arquitectura debe distinguir varios niveles de identidad.

No debe utilizarse un único `id` para todo.

---

## **7.1 tenant\_id**

Identifica a la organización cliente dentro de EcomScaling.

Ejemplo conceptual:

tenant\_id \= tenant\_abc123

El tenant constituye la frontera principal de aislamiento.

Regla:

Data belonging to Tenant A  
must never be evaluated using private raw data  
from Tenant B.

Los benchmarks agregados, anónimos o externos podrán utilizar información transversal si su contrato específico lo permite, pero nunca deberán romper el aislamiento de datos privados entre tenants.

---

# **8\. workspace\_id**

Identifica un espacio de trabajo dentro del tenant cuando la arquitectura lo requiera.

Un tenant podría tener:

Tenant  
├── Workspace España  
├── Workspace Francia  
└── Workspace Internacional

No todos los tenants estarán obligados a tener múltiples workspaces.

Debe poder existir una configuración equivalente a:

tenant\_id  
workspace\_id

sin obligar a introducir complejidad cuando no sea necesaria.

---

# **9\. business\_id**

Identifica el ecommerce o unidad de negocio concreta que está siendo analizada.

Esto es importante porque un mismo tenant podría administrar:

Store A  
Store B  
Store C

o:

Brand  
├── Spain  
├── France  
└── Germany

Por tanto:

tenant\_id

no debe confundirse con:

business\_id

---

# **10\. TRACE\_ID**

`trace_id` identifica una cadena lógica completa de razonamiento o procesamiento.

Puede atravesar distintas fases.

Ejemplo:

Consulta del usuario  
        ↓  
Fase 3 Diagnóstico  
        ↓  
Fase 6 Benchmarks  
        ↓  
Fase 4 Priorización  
        ↓  
Fase 7 Recomendación

Todos esos procesos podrían compartir:

trace\_id \= trace\_xyz

Esto permitirá reconstruir posteriormente el recorrido completo de una consulta.

---

# **11\. RUN\_ID**

`run_id` identifica una ejecución concreta.

Cada intento de ejecución debe tener un `run_id` único.

Ejemplo:

trace\_id \= trace\_001

run\_id \= run\_001

Si la ejecución falla y vuelve a ejecutarse:

trace\_id \= trace\_001

run\_id \= run\_002

Nunca debe reutilizarse el mismo `run_id`.

---

# **12\. PARENT\_RUN\_ID**

Permite establecer relaciones jerárquicas entre ejecuciones.

Ejemplo:

run\_001  
    │  
    ├── run\_002 metric evaluation  
    ├── run\_003 metric evaluation  
    ├── run\_004 anomaly detection  
    └── run\_005 pattern detection

Los hijos contienen:

parent\_run\_id \= run\_001

Esto permite construir posteriormente un árbol de ejecución.

---

# **13\. REQUEST\_ID**

Representa la petición de entrada que originó una ejecución cuando exista.

Por ejemplo:

API request  
user interaction  
agent request  
event  
scheduled job

Puede existir:

request\_id \= req\_123

Un mismo request puede desencadenar varias ejecuciones.

---

# **14\. CORRELATION\_ID**

Debe existir un identificador opcional para relacionar procesos técnicamente independientes que formen parte de una misma operación empresarial o workflow.

Ejemplo:

weekly\_business\_review\_2026\_09\_11

No sustituye al `trace_id`.

Permite correlacionar operaciones desde una perspectiva funcional.

---

# **15\. RELACIONES ENTRE IDENTIDADES**

Conceptualmente:

tenant\_id  
   │  
workspace\_id  
   │  
business\_id

trace\_id  
   │  
   ├── run\_id  
   │      ├── child run  
   │      └── child run  
   │  
   └── run\_id

Separadamente puede existir:

request\_id  
correlation\_id

---

# **16\. REGLA DE UNICIDAD**

Los identificadores técnicos deben ser:

* globalmente únicos;  
* opacos;  
* no dependientes de nombres humanos;  
* no reutilizables;  
* seguros para sistemas distribuidos.

El contrato no obliga todavía a una tecnología concreta.

Podrían implementarse posteriormente mediante:

UUIDv7  
ULID  
UUID

u otro mecanismo apropiado.

La decisión de implementación no pertenece todavía a este contrato.

---

# **17\. EXECUTION SCOPE**

Toda ejecución debe declarar qué está intentando realizar.

Debe existir un concepto equivalente a:

execution\_scope

que permita identificar al menos:

phase  
module  
operation

Ejemplo:

phase \= 6

module \= benchmark\_evaluation

operation \= evaluate\_metric

Otro ejemplo:

phase \= 6

module \= anomaly\_detection

operation \= analyze\_time\_series

---

# **18\. EXECUTION\_KIND**

La ejecución debe poder clasificarse.

Valores conceptuales iniciales:

metric\_evaluation

batch\_evaluation

benchmark\_resolution

guardrail\_evaluation

anomaly\_detection

pattern\_detection

finding\_generation

validation

replay

simulation

La lista debe ser extensible.

No debe convertirse en una enumeración rígida imposible de evolucionar.

---

# **19\. EXECUTION MODE**

Debe diferenciarse claramente el modo en que se está ejecutando el sistema.

Valores iniciales:

live

historical\_replay

simulation

backtest

validation

test

---

# **20\. LIVE**

Representa una evaluación operativa normal utilizando el contexto vigente.

execution\_mode \= live

---

# **21\. HISTORICAL\_REPLAY**

Permite reconstruir una ejecución histórica utilizando, cuando sea posible, las mismas versiones y configuraciones originales.

execution\_mode \= historical\_replay

Debe registrar:

replay\_of\_run\_id

cuando corresponda.

---

# **22\. SIMULATION**

Permite evaluar escenarios hipotéticos sin alterar el estado real.

Ejemplo:

¿Qué ocurriría si CAC aumentara 15%?

Debe estar identificado explícitamente:

execution\_mode \= simulation

para impedir que datos simulados sean posteriormente confundidos con observaciones reales.

---

# **23\. BACKTEST**

Permite comprobar cómo habría funcionado una policy, benchmark o evaluator utilizando datos históricos.

execution\_mode \= backtest

Debe diferenciarse de `historical_replay`.

Replay:

reproducir una ejecución anterior

Backtest:

aplicar lógica sobre historia para evaluar comportamiento

---

# **24\. VALIDATION**

Representa ejecuciones asociadas a validación formal del sistema.

execution\_mode \= validation

Será especialmente utilizado por C6.16.

---

# **25\. TEST**

Permite identificar ejecuciones puramente técnicas.

Nunca deben confundirse con análisis productivos.

---

# **26\. ENVIRONMENT**

El entorno debe estar explícitamente identificado.

Valores iniciales:

production

staging

development

test

Regla:

Production artifacts  
must never be silently mixed  
with staging or test artifacts.

---

# **27\. TRIGGER**

Debe registrarse qué inició la ejecución.

Tipos conceptuales:

user

agent

api

schedule

event

workflow

system

test

Ejemplo:

trigger\_type \= agent

---

# **28\. INITIATOR**

Cuando sea posible debe poder registrarse quién o qué inició el proceso.

Puede ser:

user  
agent  
service  
workflow  
system

Ejemplo conceptual:

initiator\_type \= agent  
initiator\_ref \= monitor\_business\_v3

C6.0 no almacena datos personales innecesarios.

Debe preferirse una referencia técnica.

---

# **29\. TIME MODEL**

La temporalidad debe estar correctamente representada.

No basta con:

date \= 11/09/2026

El runtime debe distinguir al menos:

requested\_at

started\_at

completed\_at

as\_of\_at

---

# **30\. REQUESTED\_AT**

Momento en que se solicitó la evaluación.

---

# **31\. STARTED\_AT**

Momento real de comienzo de ejecución.

---

# **32\. COMPLETED\_AT**

Momento en que terminó.

Puede ser nulo mientras la ejecución esté activa.

---

# **33\. AS\_OF\_AT**

Este campo es especialmente importante.

Representa:

> el momento de negocio respecto al cual debe interpretarse el análisis.

Ejemplo:

La evaluación puede ejecutarse:

11 septiembre 2026

pero analizar:

estado del negocio al 31 agosto 2026

Entonces:

executed\_at ≠ as\_of\_at

Esta separación es obligatoria para análisis históricos.

---

# **34\. TIMEZONE**

Las fechas persistidas deberían normalizarse técnicamente en UTC.

Sin embargo debe poder conservarse la timezone empresarial relevante.

Ejemplo:

business\_timezone \= Europe/Madrid

Esto será necesario para interpretar correctamente:

* días;  
* semanas;  
* campañas;  
* cierres mensuales;  
* ventanas de atribución;  
* cohortes.

---

# **35\. VERSION MANIFEST**

Una de las responsabilidades más importantes de C6.0 es congelar las versiones relevantes utilizadas por una ejecución.

Debe existir un objeto conceptual:

version\_manifest

No debe utilizarse simplemente:

latest

como referencia histórica.

---

# **36\. VERSIONES QUE EL MANIFEST DEBE PODER REPRESENTAR**

Como mínimo debe poder referenciar:

runtime\_contract\_version

metric\_registry\_version

context\_contract\_version

data\_quality\_contract\_version

benchmark\_catalog\_version

guardrail\_catalog\_version

policy\_bundle\_version

resolver\_version

confidence\_model\_version

evaluation\_engine\_version

anomaly\_engine\_version

pattern\_catalog\_version

finding\_contract\_version

handoff\_contract\_version

No todos serán obligatorios en todas las ejecuciones.

---

# **37\. VERSIONES DE COMPONENTES IA**

Cuando una parte de la ejecución dependa de un modelo de IA también debe ser posible registrar:

agent\_version

prompt\_version

reasoning\_profile\_version

model\_provider

model\_family

model\_version

cuando esa información sea técnicamente relevante y disponible.

El contrato no debe asumir que toda la Fase 6 depende de un LLM.

Algunas evaluaciones deberían ser deterministas.

---

# **38\. PRINCIPIO DE VERSION PINNING**

Una ejecución material debe saber qué versiones utilizó.

Incorrecto:

policy \= latest  
benchmark \= latest  
evaluator \= current

Correcto conceptualmente:

policy\_bundle\_version \= policy\_2026\_09\_04

benchmark\_catalog\_version \= bench\_2026\_09

evaluation\_engine\_version \= eval\_3.2.1

Esto permite explicar por qué dos evaluaciones realizadas en fechas diferentes producen resultados distintos.

---

# **39\. VERSIONADO DEL CONTRATO**

C6.0 debe tener su propia versión.

Ejemplo conceptual:

contract\_id \= C6.0  
contract\_version \= 1.0.0

Se recomienda utilizar semántica equivalente a Semantic Versioning.

---

# **40\. MAJOR VERSION**

Debe incrementarse cuando exista un cambio incompatible.

Ejemplo:

1.x.x → 2.0.0

si cambia el significado estructural de campos obligatorios.

---

# **41\. MINOR VERSION**

Debe incrementarse cuando se incorporen capacidades compatibles.

Ejemplo:

1.2.0 → 1.3.0

por añadir un campo opcional nuevo.

---

# **42\. PATCH VERSION**

Debe representar correcciones compatibles que no modifiquen el contrato funcional.

---

# **43\. CONFIGURATION SNAPSHOT**

Debe existir una referencia inmutable a la configuración efectiva del tenant utilizada durante la evaluación.

Conceptualmente:

configuration\_snapshot\_id

Este snapshot podrá representar posteriormente:

* objetivos;  
* economics;  
* configuración;  
* políticas;  
* capabilities;  
* overrides;  
* settings.

C6.0 NO almacena dicha configuración.

Únicamente registra qué snapshot fue utilizado.

---

# **44\. POR QUÉ ES NECESARIO EL SNAPSHOT**

Supongamos:

1 septiembre  
maximum\_sustainable\_cac \= 45 €

Posteriormente:

1 octubre  
maximum\_sustainable\_cac \= 52 €

Una evaluación del 10 de septiembre no debe reinterpretarse meses después usando automáticamente:

52 €

Debe poder reconstruirse con:

configuration\_snapshot\_id

original.

---

# **45\. CAPABILITY PROFILE**

La arquitectura debe admitir capacidades configurables.

Puede existir:

capability\_profile\_version

Esto permitirá activar en el futuro determinadas funcionalidades.

Sin embargo existe una regla fundamental:

Capability configuration  
may modify available functionality.

It must not silently degrade  
reasoning quality.

---

# **46\. PLAN COMERCIAL NO ES UN INPUT DE RAZONAMIENTO**

No debe existir lógica equivalente a:

if plan \== "Growth":  
    shallow\_reasoning \= true

if plan \== "Scale":  
    deep\_reasoning \= true

Growth y Scale no deben producir distinta calidad intelectual.

Si en el futuro existen funcionalidades diferentes deben expresarse mediante:

capabilities

no mediante degradación de inteligencia.

---

# **47\. INPUT SNAPSHOT REFERENCE**

Para facilitar reproducibilidad debe poder existir:

input\_snapshot\_id

Este campo no contiene los datos.

Referencia al conjunto de entradas utilizadas.

Ejemplo:

input\_snapshot\_id \= snap\_inputs\_9834

C6.12 será responsable de la trazabilidad detallada.

C6.0 únicamente proporciona el ancla.

---

# **48\. SOURCE DATA CUTOFF**

Debe poder registrarse:

source\_data\_cutoff\_at

que indica hasta qué momento se consideraron datos disponibles.

Ejemplo:

source\_data\_cutoff\_at \=  
2026-09-10T23:59:59Z

Esto evita que una evaluación histórica parezca haber tenido acceso a datos que todavía no existían.

---

# **49\. REPLAY RELATIONSHIPS**

Una ejecución nueva puede estar relacionada con una anterior.

Debe poder expresarse:

replay\_of\_run\_id

retry\_of\_run\_id

derived\_from\_run\_id

No deben confundirse.

---

# **50\. RETRY**

retry\_of\_run\_id

significa:

> el proceso anterior falló o necesita repetirse como nuevo intento.

El nuevo intento recibe un `run_id` nuevo.

---

# **51\. REPLAY**

replay\_of\_run\_id

significa:

> estamos intentando reproducir explícitamente una ejecución anterior.

---

# **52\. DERIVED EXECUTION**

derived\_from\_run\_id

permite indicar:

> esta ejecución se ha generado utilizando el resultado de otra.

---

# **53\. IDEMPOTENCY**

El runtime debe permitir idempotencia cuando la operación lo necesite.

Debe poder existir:

idempotency\_key

Esto evita que una misma petición accidentalmente genere múltiples ejecuciones equivalentes cuando no corresponde.

Sin embargo:

idempotency\_key  
≠  
run\_id

El identificador de idempotencia controla duplicados.

El `run_id` identifica una ejecución.

---

# **54\. EXECUTION STATUS**

C6.0 debe poder representar el estado técnico de una ejecución.

Estados iniciales:

created

running

completed

partial

failed

cancelled

---

# **55\. CREATED**

La ejecución ha sido registrada pero todavía no ha comenzado.

---

# **56\. RUNNING**

La ejecución está activa.

---

# **57\. COMPLETED**

Terminó correctamente.

---

# **58\. PARTIAL**

La ejecución produjo resultados parciales pero una parte no pudo completarse.

Esto es importante.

No debe forzarse:

success / failure

cuando existe una realidad intermedia.

---

# **59\. FAILED**

La ejecución no pudo producir el resultado requerido.

---

# **60\. CANCELLED**

La ejecución fue detenida intencionadamente.

---

# **61\. STATUS TÉCNICO ≠ STATUS DE NEGOCIO**

No deben confundirse:

execution\_status \= completed

con:

metric\_status \= critical

El primero pertenece a C6.0.

El segundo pertenecerá a C6.9/C6.13.

Ejemplo perfectamente válido:

execution\_status \= completed

business\_status \= critical

La ejecución funcionó correctamente y descubrió un problema crítico.

---

# **62\. ERROR SUMMARY**

Cuando una ejecución falle o termine parcialmente debe poder registrar una referencia estructurada al error.

Ejemplo conceptual:

error\_code

error\_category

retryable

error\_ref

C6.0 no debe convertirse en sistema de logging.

Los logs detallados pertenecerán a observabilidad.

---

# **63\. DATA ISOLATION**

La frontera multi-tenant debe ser un invariante.

Regla:

private tenant data  
cannot cross tenant boundaries.

Una evaluación de:

tenant\_A

no puede consumir datos privados de:

tenant\_B

por error de retrieval, query, cache, contexto o agente.

---

# **64\. EXCEPCIÓN CONTROLADA: BENCHMARKS AGREGADOS**

Puede existir información derivada de múltiples negocios cuando:

* esté anonimizada;  
* esté agregada;  
* tenga provenance;  
* cumpla los requisitos de privacidad;  
* esté autorizada para benchmarking;  
* sea consumida mediante C6.4.

El evaluator nunca deberá acceder directamente a datos privados de otros tenants.

---

# **65\. BUSINESS SCOPE**

Toda ejecución debe declarar la unidad de negocio sobre la que opera.

No debe ocurrir:

business\_id \= unknown

en una evaluación productiva material.

Si el business no puede determinarse:

evaluation should not proceed

salvo en casos explícitos de benchmarking genérico o testing.

---

# **66\. IMMUTABILITY**

Los siguientes elementos deben considerarse inmutables después de crear la ejecución:

tenant\_id

business\_id

trace\_id

run\_id

execution\_mode

environment

version\_manifest

configuration\_snapshot\_id

input\_snapshot\_id

Si alguno necesita cambiar:

create a new run.

No reescribir silenciosamente el histórico.

---

# **67\. LIFECYCLE MUTABILITY**

Algunos campos sí pueden evolucionar durante la ejecución:

execution\_status

started\_at

completed\_at

error\_summary

Cualquier cambio relevante deberá quedar observable mediante C6.15.

---

# **68\. AUDIT PRINCIPLE**

Nunca debe poder alterarse una evaluación histórica de forma que parezca que siempre utilizó la configuración actual.

Debe mantenerse:

historical truth

frente a:

current truth

---

# **69\. REPRODUCIBILITY**

Una ejecución debería poder reconstruirse conceptualmente mediante:

run\_id  
    ↓  
input\_snapshot  
    ↓  
configuration\_snapshot  
    ↓  
version\_manifest  
    ↓  
source\_data\_cutoff  
    ↓  
runtime environment

La reproducibilidad perfecta puede no ser posible cuando intervienen modelos probabilísticos.

En esos casos el sistema debe preservar suficiente información para realizar:

explainable reproduction

aunque no pueda garantizar:

bit-for-bit reproduction

---

# **70\. DETERMINISTIC VS PROBABILISTIC COMPONENTS**

El runtime debe distinguir conceptualmente componentes:

deterministic

probabilistic

Ejemplo:

CAC calculation \= deterministic

pattern interpretation by LLM \= probabilistic

Esta distinción puede almacenarse posteriormente dentro de los componentes ejecutados.

---

# **71\. COMPONENT MANIFEST**

Debe poder registrarse qué componentes participaron en una ejecución.

Modelo conceptual:

execution\_components:  
    \- component\_id  
    \- component\_type  
    \- component\_version

Ejemplos de tipo:

calculator

resolver

rules\_engine

agent

llm

statistical\_engine

retriever

No es obligatorio registrar componentes irrelevantes.

---

# **72\. CONTRACT SHAPE CONCEPTUAL**

La forma conceptual del Runtime Envelope será aproximadamente:

runtime\_envelope

identity  
    tenant\_id  
    workspace\_id  
    business\_id

execution  
    trace\_id  
    run\_id  
    parent\_run\_id  
    request\_id  
    correlation\_id

scope  
    phase  
    module  
    operation  
    execution\_kind  
    execution\_mode

environment

trigger  
    trigger\_type  
    initiator\_type  
    initiator\_ref

time  
    requested\_at  
    started\_at  
    completed\_at  
    as\_of\_at  
    source\_data\_cutoff\_at  
    business\_timezone

versions  
    contract\_version  
    version\_manifest

snapshots  
    configuration\_snapshot\_id  
    input\_snapshot\_id

capabilities  
    capability\_profile\_version

relationships  
    retry\_of\_run\_id  
    replay\_of\_run\_id  
    derived\_from\_run\_id

execution\_components

lifecycle  
    execution\_status  
    error\_summary

idempotency\_key

Esta estructura es conceptual.

No constituye todavía una implementación JSON definitiva.

---

# **73\. EJEMPLO CONCEPTUAL COMPLETO**

Ejemplo de una evaluación productiva de CAC:

runtime\_envelope:

    identity:  
        tenant\_id: tenant\_8F2  
        workspace\_id: ws\_main  
        business\_id: store\_es

    execution:  
        trace\_id: trace\_A91  
        run\_id: run\_B72  
        parent\_run\_id: run\_B60  
        request\_id: req\_C31  
        correlation\_id: weekly\_review\_2026\_W37

    scope:  
        phase: 6  
        module: benchmark\_evaluation  
        operation: evaluate\_metric  
        execution\_kind: metric\_evaluation  
        execution\_mode: live

    environment:  
        production

    trigger:  
        trigger\_type: agent  
        initiator\_type: agent  
        initiator\_ref: business\_monitor\_v4

    time:  
        requested\_at: 2026-09-11T08:13:02Z  
        started\_at: 2026-09-11T08:13:03Z  
        completed\_at: 2026-09-11T08:13:04Z

        as\_of\_at:  
            2026-09-10T23:59:59Z

        source\_data\_cutoff\_at:  
            2026-09-10T23:59:59Z

        business\_timezone:  
            Europe/Madrid

    versions:  
        contract\_version:  
            C6.0@1.0.0

        version\_manifest:  
            metric\_registry\_version: metrics\_2.4  
            benchmark\_catalog\_version: bench\_2026\_09  
            guardrail\_catalog\_version: guardrails\_3.1  
            policy\_bundle\_version: policy\_tenant8F2\_v18  
            resolver\_version: resolver\_2.0  
            confidence\_model\_version: confidence\_1.4  
            evaluation\_engine\_version: evaluator\_3.2

    snapshots:  
        configuration\_snapshot\_id:  
            cfg\_snapshot\_982

        input\_snapshot\_id:  
            input\_snapshot\_778

    capabilities:  
        capability\_profile\_version:  
            capability\_profile\_v3

    relationships:  
        retry\_of\_run\_id: null  
        replay\_of\_run\_id: null  
        derived\_from\_run\_id: run\_B60

    execution\_status:  
        completed

---

# **74\. QUÉ NO APARECE EN EL EJEMPLO**

Deliberadamente NO aparecen:

CAC \= 48

benchmark \= 35

guardrail \= 43

status \= risk

confidence \= high

porque estos datos no son responsabilidad de C6.0.

Se incorporarán a través de contratos posteriores.

---

# **75\. EJEMPLO DE REPLAY**

Una reproducción histórica podría identificarse como:

execution\_mode:  
    historical\_replay

run\_id:  
    run\_REPLAY\_002

replay\_of\_run\_id:  
    run\_B72

La nueva ejecución tiene su propia identidad.

Nunca debe sobrescribir:

run\_B72

---

# **76\. EJEMPLO DE SIMULACIÓN**

execution\_mode:  
    simulation

run\_id:  
    run\_SIM\_083

Los resultados derivados de este run deben conservar esa naturaleza.

No pueden almacenarse posteriormente como si fueran observaciones reales.

---

# **77\. EJEMPLO DE RETRY**

Ejecución original:

run\_id \= run\_100  
execution\_status \= failed

Nuevo intento:

run\_id \= run\_101

retry\_of\_run\_id \= run\_100

Nunca:

run\_id \= run\_100

reutilizado.

---

# **78\. INVARIANTES DEL CONTRATO**

C6.0 debe imponer los siguientes invariantes.

---

## **INV-C6.0-001 — Tenant obligatorio**

Toda ejecución productiva debe tener:

tenant\_id

---

## **INV-C6.0-002 — Business obligatorio**

Toda evaluación empresarial material debe estar vinculada a:

business\_id

---

## **INV-C6.0-003 — Run único**

run\_id

no puede reutilizarse.

---

## **INV-C6.0-004 — Trace obligatorio**

Toda ejecución debe poder relacionarse con:

trace\_id

---

## **INV-C6.0-005 — Versiones congeladas**

Una evaluación material debe conservar las versiones efectivamente utilizadas.

---

## **INV-C6.0-006 — Configuración histórica**

Debe conservarse:

configuration\_snapshot\_id

cuando la configuración influya en el resultado.

---

## **INV-C6.0-007 — No cross-tenant leakage**

Datos privados de diferentes tenants no pueden mezclarse.

---

## **INV-C6.0-008 — Retry genera nuevo run**

Un retry nunca reutiliza la identidad anterior.

---

## **INV-C6.0-009 — Replay genera nuevo run**

Un replay conserva referencia al original pero tiene identidad propia.

---

## **INV-C6.0-010 — Simulation explícita**

Los escenarios simulados deben estar etiquetados como simulación.

---

## **INV-C6.0-011 — Test separado de producción**

Los artefactos de test no deben confundirse con producción.

---

## **INV-C6.0-012 — Status técnico separado de status empresarial**

execution\_status  
≠  
evaluation\_status

---

## **INV-C6.0-013 — Plan comercial no degrada inteligencia**

El plan comercial no puede utilizarse para disminuir la calidad del razonamiento.

---

## **INV-C6.0-014 — No utilizar "latest" como historia**

Las versiones relevantes de ejecuciones materializadas deben quedar fijadas.

---

## **INV-C6.0-015 — As-of explícito**

El sistema debe poder distinguir:

execution time

de:

business analysis time

---

## **INV-C6.0-016 — Relaciones explícitas**

Retries, replays y derivados deben estar identificados mediante relaciones explícitas.

---

## **INV-C6.0-017 — Artefactos no huérfanos**

Todo finding, evaluación, anomalía o pattern material debe poder enlazarse con un `run_id`.

---

# **79\. VALIDACIONES MÍNIMAS**

Antes de iniciar una evaluación productiva, C6.0 debe poder validar:

tenant exists?

business exists?

tenant owns/accesses business?

environment valid?

execution\_mode valid?

trace\_id present?

run\_id unique?

contract version valid?

required version references available?

configuration snapshot accessible?

timestamps coherent?

---

# **80\. VALIDACIONES TEMPORALES**

Debe impedir inconsistencias obvias como:

completed\_at \< started\_at

o:

started\_at \< requested\_at

cuando no exista una razón explícita.

También debe permitir ejecuciones retrospectivas donde:

as\_of\_at \< executed\_at

lo cual es completamente válido.

---

# **81\. VALIDACIÓN MULTI-TENANT**

Debe verificarse como mínimo:

business\_id belongs to tenant\_id

y, cuando exista workspace:

business\_id accessible from workspace\_id

---

# **82\. COMPATIBILIDAD DE VERSIONES**

El runtime debe detectar combinaciones incompatibles.

Ejemplo:

evaluation\_engine v4

podría requerir:

metric\_registry \>= v3

Si no se cumple:

execution should fail explicitly

o utilizar una ruta de compatibilidad declarada.

Nunca debe continuar silenciosamente.

---

# **83\. FAIL CLOSED VS FAIL OPEN**

Para campos críticos de identidad, aislamiento o versionado debe preferirse:

fail closed

Ejemplo:

Si no sabemos para qué tenant se ejecuta:

do not evaluate

No intentar inferirlo.

---

# **84\. PARTIAL EXECUTION**

Una ejecución parcial es válida cuando:

* algunas métricas pudieron evaluarse;  
* otras no;  
* algunos benchmarks estaban disponibles;  
* otros no;  
* una parte del pipeline falló.

Debe producir:

execution\_status \= partial

en lugar de fingir éxito total.

---

# **85\. RELACIÓN CON C6.1**

C6.1 — Metric Semantics & Observation recibirá el Runtime Envelope o una referencia a él.

Permitirá afirmar:

esta observación pertenece a este run

C6.0 no define la métrica.

---

# **86\. RELACIÓN CON C6.2**

C6.2 utilizará:

tenant  
business  
as\_of\_at

para construir contexto comparable.

C6.0 no construye cohorts.

---

# **87\. RELACIÓN CON C6.3**

C6.3 relacionará los assessments de calidad de datos con:

run\_id  
input\_snapshot\_id

C6.0 no juzga calidad de datos.

---

# **88\. RELACIÓN CON C6.4**

Los benchmarks seleccionados posteriormente podrán relacionarse con:

benchmark\_catalog\_version

C6.0 no selecciona el benchmark.

---

# **89\. RELACIÓN CON C6.5**

Los guardrails utilizados podrán referenciar:

guardrail\_catalog\_version

C6.0 no determina si existe breach.

---

# **90\. RELACIÓN CON C6.6**

C6.6 utilizará:

tenant\_id  
business\_id  
configuration\_snapshot\_id  
policy\_bundle\_version

para resolver policies.

C6.0 no contiene thresholds.

---

# **91\. RELACIÓN CON C6.7**

C6.7 podrá utilizar el Version Manifest para saber qué catálogos y policies resolver.

C6.0 no selecciona referencias.

---

# **92\. RELACIÓN CON C6.8**

La confianza se calculará sobre artefactos pertenecientes a una ejecución identificada.

C6.0 no asigna confidence.

---

# **93\. RELACIÓN CON C6.9**

Cada Benchmark Evaluation deberá referenciar:

run\_id

o el identificador correspondiente de ejecución.

C6.0 no genera el status de evaluación.

---

# **94\. RELACIÓN CON C6.10**

Las anomalías deberán ser trazables hacia la ejecución que las detectó.

---

# **95\. RELACIÓN CON C6.11**

Los patterns y red flags deberán conservar el mismo árbol de trazabilidad.

---

# **96\. RELACIÓN CON C6.12**

C6.12 — Evidence, Provenance & Lineage utilizará como anclas:

trace\_id

run\_id

input\_snapshot\_id

configuration\_snapshot\_id

version\_manifest

C6.0 proporciona identidad.

C6.12 proporciona lineage detallado.

---

# **97\. RELACIÓN CON C6.13**

Todos los Findings deberán poder reconstruir:

which run produced me?

---

# **98\. RELACIÓN CON C6.14**

Los handoffs hacia:

Fase 3  
Fase 4  
Fase 7

deberán mantener:

trace\_id

para conservar continuidad entre fases.

---

# **99\. RELACIÓN CON C6.15**

C6.15 — Observability & Audit utilizará C6.0 como columna vertebral de observabilidad.

Eventos como:

run created

run started

resolver executed

benchmark selected

guardrail evaluated

finding produced

run completed

deberán poder correlacionarse mediante:

trace\_id  
run\_id

---

# **100\. RELACIÓN CON C6.16**

Los fixtures de testing deberán poder ejecutar runtime envelopes controlados y reproducibles.

Ejemplo:

execution\_mode \= validation

---

# **101\. RELACIÓN CON OTRAS FASES**

El `trace_id` debe poder atravesar otras fases.

Ejemplo:

F3 Diagnosis Run  
        ↓  
same trace\_id  
        ↓  
F6 Benchmark Run  
        ↓  
same trace\_id  
        ↓  
F4 Prioritization Run  
        ↓  
same trace\_id  
        ↓  
F7 Recommendation Run

Esto permitirá una observabilidad end-to-end.

---

# **102\. ANTI-PATRÓN: UN ÚNICO ID**

Incorrecto:

id \= 123

utilizado simultáneamente para:

request  
evaluation  
trace  
run  
finding

Esto destruye la semántica de identidad.

---

# **103\. ANTI-PATRÓN: SOBRESCRIBIR EJECUCIONES**

Incorrecto:

run\_001

falla y posteriormente se actualiza como si nunca hubiera fallado.

Debe existir:

run\_001 \= failed

run\_002 \= retry of run\_001

---

# **104\. ANTI-PATRÓN: POLICY LATEST**

Incorrecto:

policy\_version \= latest

persistido como histórico.

Dentro de seis meses:

latest

significará otra cosa.

---

# **105\. ANTI-PATRÓN: VERSIONES IMPLÍCITAS**

Incorrecto:

the evaluator just uses whatever  
is deployed today

Una evaluación material debe saber qué versión produjo el resultado.

---

# **106\. ANTI-PATRÓN: PLAN COMO CALIDAD DE RAZONAMIENTO**

Incorrecto:

Growth:  
confidence engine disabled

Scale:  
confidence engine enabled

si ambas funcionalidades forman parte del razonamiento básico del consultor.

---

# **107\. ANTI-PATRÓN: MEZCLAR SIMULACIÓN CON OBSERVACIÓN**

Incorrecto:

simulated CAC \= 62

almacenado posteriormente como:

observed CAC \= 62

---

# **108\. ANTI-PATRÓN: TIMESTAMPS SIN CONTEXTO**

Incorrecto:

date \= 09/11/26

Debe conocerse:

* formato;  
* timezone;  
* significado temporal.

---

# **109\. ANTI-PATRÓN: TENANT INFERIDO**

No debe inferirse tenant automáticamente a partir de información ambigua.

Si el aislamiento no puede garantizarse:

stop execution.

---

# **110\. ANTI-PATRÓN: CONTRATO GIGANTE**

C6.0 no debe absorber:

metrics  
benchmarks  
evidence  
guardrails  
patterns  
findings  
recommendations

Eso destruiría la modularidad.

---

# **111\. AUDITABILIDAD ESPERADA**

Dado:

finding\_id \= finding\_882

el sistema deberá poder reconstruir posteriormente:

finding\_882  
    ↓  
run\_B72  
    ↓  
trace\_A91  
    ↓  
tenant\_8F2  
    ↓  
store\_es  
    ↓  
configuration\_snapshot\_982  
    ↓  
policy\_tenant8F2\_v18  
    ↓  
bench\_2026\_09  
    ↓  
evaluator\_3.2  
    ↓  
input\_snapshot\_778

Este es uno de los resultados fundamentales de C6.0.

---

# **112\. REPLAYABILITY ESPERADA**

Dado:

run\_B72

deberíamos poder preguntar:

¿Qué datos tenía?

¿Qué configuración tenía?

¿Qué versiones tenía?

¿Qué catálogos utilizaba?

¿Qué componentes participaron?

¿En qué contexto temporal se ejecutó?

¿Qué ejecución lo originó?

y obtener respuestas verificables.

---

# **113\. SECURITY BOUNDARY**

C6.0 debe tratar:

tenant\_id  
business\_id  
workspace\_id

no solo como metadata funcional sino como fronteras de autorización.

Los contratos posteriores nunca deben asumir que recibir un identificador implica automáticamente tener permiso para acceder a sus datos.

La autorización real corresponderá a la infraestructura de seguridad del sistema.

---

# **114\. MINIMIZACIÓN DE DATOS**

El envelope no debe almacenar información personal innecesaria.

Preferir:

initiator\_ref \= user\_83H

frente a:

name  
email  
phone

salvo necesidad explícita de otra capa.

---

# **115\. EXTENSIBILIDAD**

Debe ser posible añadir en el futuro:

region

data\_residency

organization\_unit

experiment\_id

deployment\_id

feature\_set

workflow\_id

sin romper los consumidores existentes.

---

# **116\. FORWARD COMPATIBILITY**

Los consumidores deben ignorar campos opcionales desconocidos cuando la versión contractual lo permita.

No deben fallar automáticamente por extensiones compatibles.

---

# **117\. BACKWARD COMPATIBILITY**

Los cambios incompatibles deben producir una nueva major version.

No se debe reutilizar silenciosamente la misma versión para cambiar semántica.

---

# **118\. OBSERVABILITY HOOKS**

C6.0 debe permitir que C6.15 observe al menos:

run created

run started

run completed

run partial

run failed

run cancelled

retry created

replay created

No definimos todavía el Event Contract.

Eso será responsabilidad posterior.

---

# **119\. MÉTRICAS OPERATIVAS FUTURAS**

Gracias al envelope será posible observar posteriormente:

runs per tenant

runs per business

failure rate

partial rate

average execution duration

retries

replays

version adoption

evaluation volume

execution mode distribution

Estas son métricas del sistema.

No métricas ecommerce.

---

# **120\. TESTS MÍNIMOS DE C6.0**

C6.16 deberá incluir como mínimo los siguientes escenarios.

---

## **TEST 1 — Ejecución válida**

Debe aceptar:

tenant válido  
business válido  
trace válido  
run único  
versiones válidas  
production

---

## **TEST 2 — Tenant ausente**

Debe rechazar evaluación productiva.

---

## **TEST 3 — Business de otro tenant**

Debe bloquear ejecución.

---

## **TEST 4 — Run duplicado**

Debe rechazar la reutilización.

---

## **TEST 5 — Retry**

Debe generar nuevo run y conservar:

retry\_of\_run\_id

---

## **TEST 6 — Replay**

Debe generar nuevo run y conservar:

replay\_of\_run\_id

---

## **TEST 7 — Simulation**

Debe impedir que sea interpretada posteriormente como live.

---

## **TEST 8 — Policy version inexistente**

Debe fallar explícitamente.

---

## **TEST 9 — Version incompatibility**

Debe detectar incompatibilidad contractual.

---

## **TEST 10 — Historical configuration**

Debe poder recuperar el snapshot original aunque la configuración actual haya cambiado.

---

## **TEST 11 — Growth vs Scale**

Con los mismos:

inputs  
configuration  
policies  
capabilities

el plan comercial no debe cambiar el razonamiento.

---

## **TEST 12 — Cross-tenant isolation**

Debe ser imposible consumir datos privados de otro tenant.

---

## **TEST 13 — Time consistency**

Debe detectar timestamps imposibles.

---

## **TEST 14 — Production vs test**

Los resultados de test no deben aparecer como findings productivos.

---

## **TEST 15 — Historical replay**

Debe conservar referencias suficientes para explicar la ejecución original.

---

# **121\. ACCEPTANCE CRITERIA**

C6.0 estará correctamente implementado cuando el sistema pueda responder para cualquier resultado material de Fase 6:

1\. ¿A qué tenant pertenece?

2\. ¿A qué ecommerce pertenece?

3\. ¿Qué ejecución lo produjo?

4\. ¿A qué trace pertenece?

5\. ¿Qué proceso lo inició?

6\. ¿Cuándo se produjo?

7\. ¿A qué momento del negocio se refería?

8\. ¿Qué configuración utilizó?

9\. ¿Qué versiones utilizó?

10\. ¿Fue live, simulation, backtest, validation o replay?

11\. ¿Es un retry o derivado de otra ejecución?

12\. ¿Qué input snapshot utilizó?

13\. ¿Qué componentes participaron?

14\. ¿Puede diferenciarse de testing?

15\. ¿Puede reconstruirse históricamente?

Si cualquiera de estas preguntas críticas no puede responderse, la infraestructura todavía no cumple el contrato.

---

# **122\. DEFINITION OF DONE**

C6.0 se considera terminado cuando exista formalmente:

Runtime Identity Model

Multi-Tenant Scope

Trace Model

Run Model

Parent/Child Execution Model

Request Correlation Model

Execution Scope

Execution Mode

Environment

Trigger Identity

Temporal Model

Version Manifest

Configuration Snapshot Reference

Input Snapshot Reference

Capability Profile Reference

Retry Model

Replay Model

Idempotency Model

Execution Lifecycle

Isolation Invariants

Versioning Rules

Compatibility Rules

Audit Anchors

Validation Rules

Acceptance Tests

---

# **123\. RESULTADO ARQUITECTÓNICO**

C6.0 transforma ejecuciones anónimas como:

Evaluate CAC

en operaciones identificables:

Tenant  
    ↓  
Business  
    ↓  
Trace  
    ↓  
Run  
    ↓  
Execution Scope  
    ↓  
Input Snapshot  
    ↓  
Configuration Snapshot  
    ↓  
Version Manifest  
    ↓  
Execution  
    ↓  
Artifacts

De este modo, cuando EcomScaling IA produzca posteriormente:

CAC deterioration  
status \= risk  
confidence \= high

el sistema podrá saber exactamente:

para quién

sobre qué negocio

utilizando qué datos

en qué fecha

con qué configuración

con qué policies

con qué benchmarks

con qué versión de evaluator

dentro de qué razonamiento

y como parte de qué ejecución

---

# **124\. PRINCIPIO FINAL DE C6.0**

La regla central de este contrato es:

No intelligence without identity.  
No evaluation without version context.  
No historical result without reproducibility anchors.  
No tenant data without explicit isolation.

C6.0 no hace inteligente al sistema por sí mismo.

Hace posible que toda la inteligencia posterior sea:

identificable  
versionable  
auditada  
reproducible  
correlacionable  
segura  
observable

y evita que EcomScaling IA termine siendo una colección de respuestas cuya procedencia no pueda reconstruirse.

---

# **125\. SALIDA FORMAL DE C6.0**

C6.0 produce conceptualmente:

RUNTIME\_ENVELOPE

que será consumido o referenciado por todos los contratos posteriores de Fase 6\.

No produce:

BENCHMARK\_EVALUATION  
GUARDRAIL\_BREACH  
ANOMALY  
PATTERN  
FINDING  
RECOMMENDATION

Su única responsabilidad es proporcionar la identidad y contexto operativo necesarios para que esos artefactos puedan existir correctamente.

---

# **C6.0 — ESTADO**

CONTRACT:  
C6.0 Runtime Envelope & Identity

TYPE:  
Infrastructure / Runtime Foundation

PHASE:  
6 — Benchmarks & Guardrails

STATUS:  
Architecture Defined

IMPLEMENTATION:  
Not yet implemented

NEXT CONTRACT:  
C6.1 — Metric Semantics & Observation Contract

