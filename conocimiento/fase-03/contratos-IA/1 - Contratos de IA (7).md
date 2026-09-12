FASE 3 — SISTEMA DE DIAGNÓSTICO

D7 — CONTRATO DEL GRAFO CAUSAL DEL ECOMMERCE

0\. Propósito y frontera epistemológica

D7 representa explícitamente qué variables, estados, eventos, capacidades, condiciones y factores externos pueden influir sobre otros elementos del ecommerce. Su función es restringir y estructurar el espacio causal que después utilizarán D8 y D9.

D7 no demuestra por sí mismo que una causa concreta haya ocurrido en un caso. Debe mantener siempre la distinción:

PLAUSIBLE ≠ PROVEN

La existencia de una relación en el grafo global representa conocimiento causal previo o una relación estructural posible. La evidencia del caso determina si una instancia concreta de esa relación queda soportada, débilmente soportada, no probada, contradicha o rechazada.

D7 nunca debe saltar desde correlación, simultaneidad o co-movimiento a causalidad confirmada. Tampoco debe declarar root cause, constraint definitivo, prioridad ni recomendación de acción.

1\. Entradas y dependencias

D7 debe poder consumir, como mínimo cuando estén disponibles:  
\- target o diagnostic target;  
\- data quality y reliability procedentes de D1;  
\- context, events, seasonality y mix procedentes de D2;  
\- maturity y relaciones estructurales procedentes de D3;  
\- capability health y exposure procedentes de D4;  
\- active signals, stable signals y contradicting signals procedentes de D5;  
\- symptoms, symptom clusters y relaciones candidatas procedentes de D6.

La calidad de los datos limita la fuerza de cualquier inferencia causal posterior. Un dato no fiable puede dejar una rama UNTESTED o UNRESOLVED; no debe convertirla automáticamente en REJECTED.

2\. CAUSAL\_NODE — contrato de nodo

Todo nodo debe utilizar un identificador estable y machine-readable y pertenecer, cuando corresponda, a uno de estos tipos canónicos:  
\- METRIC  
\- STATE  
\- EVENT  
\- CAPABILITY  
\- CONSTRAINT  
\- CONTEXT  
\- EXTERNAL\_FACTOR

El Node Registry debe poder almacenar, como mínimo:  
\- node\_id  
\- code  
\- label  
\- type  
\- capability  
\- unit  
\- scope\_type

La observabilidad del nodo debe poder clasificarse como:  
\- DIRECTLY\_OBSERVED  
\- DERIVED  
\- LATENT  
\- EXTERNAL

Un nodo LATENT no puede alcanzar HIGH confidence a partir de una única señal. D4 conserva la responsabilidad sobre health de capacidades; D7 mantiene causal topology y no debe duplicar ese estado de salud.

D7 debe distinguir explícitamente cuando aplique entre REAL\_WORLD\_VARIABLE y OBSERVED\_METRIC para evitar interpretar un deterioro de medición como deterioro real del negocio.

3\. CAUSAL\_EDGE — contrato de arista

Toda relación causal global debe poder representarse mediante un objeto equivalente a CAUSAL\_EDGE con, como mínimo cuando aplique:  
\- edge\_id  
\- from\_node  
\- to\_node  
\- relation\_type  
\- direction  
\- mechanism  
\- expected\_sign  
\- expected\_lag  
\- expected\_lag\_min  
\- expected\_lag\_max  
\- strength o knowledge\_strength  
\- conditions  
\- confounders  
\- evidence\_requirements  
\- exceptions  
\- version

Los tipos de relación admitidos deben incluir al menos:  
\- MATHEMATICAL  
\- MECHANISTIC  
\- BEHAVIORAL  
\- ECONOMIC  
\- OPERATIONAL  
\- TECHNICAL  
\- STRUCTURAL  
\- TEMPORAL  
\- CONTEXTUAL

expected\_sign debe admitir:  
\- POSITIVE  
\- NEGATIVE  
\- NON\_MONOTONIC  
\- CONTEXT\_DEPENDENT

Toda relación debe ser direccional. Una relación con feedback o influencia bidireccional debe modelarse mediante edges dirigidos separados, no mediante una causalidad ambigua A ↔ B.

Una relación global no matemática debe tener un plausible mechanism. La mera correlación puede generar una relación candidata, pero debe permanecer como UNVALIDATED\_RELATION hasta que exista mecanismo suficiente para incorporarla como relación causal válida.

Las identidades o ecuaciones matemáticas deben vivir en un registry matemático central. D7 puede referenciarlas, pero no debe duplicar lógica de fórmulas. LINEAGE —cómo se calcula una métrica— y CAUSAL GRAPH —qué puede influir sobre ella— son conceptos diferentes.

4\. Fuerza del conocimiento y provenance

D7 debe separar conocimiento previo de evidencia concreta del caso:

EDGE PRIOR ≠ CASE CAUSAL CONFIDENCE

La fuerza conceptual de una relación puede representarse, cuando aplique, como:  
\- STRONG  
\- MODERATE  
\- WEAK  
\- CONTEXT\_DEPENDENT

El nivel de evidencia o conocimiento causal puede distinguir:  
\- DETERMINISTIC  
\- STRONGLY\_ESTABLISHED  
\- COMMON\_MECHANISM  
\- PLAUSIBLE  
\- SPECULATIVE

La provenance del edge debe poder distinguir, cuando corresponda:  
\- SYSTEM\_LOGIC  
\- INTERNAL\_EVIDENCE  
\- EXTERNAL\_KNOWLEDGE  
\- EXPERT\_HEURISTIC  
\- TENANT\_LEARNED

Un edge SPECULATIVE no debe sostener por sí solo un diagnóstico causal fuerte.

5\. GLOBAL\_CAUSAL\_GRAPH y TENANT\_CAUSAL\_OVERLAY

La arquitectura debe separar:

GLOBAL\_CAUSAL\_GRAPH  
\+  
TENANT\_CAUSAL\_OVERLAY

El grafo global contiene relaciones generales reutilizables. El overlay contiene relaciones específicas aprendidas o validadas para un tenant concreto.

Las relaciones TENANT\_LEARNED deben estar aisladas por tenant y nunca contaminar otros negocios. Deben requerir suficiente evidencia histórica. Un único caso no puede convertirse automáticamente en regla causal permanente.

6\. Scope binding y resolución del grafo

El grafo debe ser genérico y vincularse al scope real en runtime, evitando materializar todas las combinaciones posibles.

Las dimensiones de scope pueden incluir:  
\- market  
\- channel  
\- device  
\- product  
\- customer

Las relaciones generales deben poder instanciarse para un scope concreto. Por ejemplo, una relación genérica STOCK\_AVAILABILITY → CVR puede vincularse en runtime a un SKU o segmento específico cuando los datos lo soporten.

D7 debe soportar, cuando corresponda, distintas resoluciones:  
\- CAPABILITY\_LEVEL  
\- METRIC\_LEVEL  
\- EVENT\_LEVEL

El razonamiento ejecutivo puede usar resolución gruesa y el diagnóstico profundo una resolución más fina, sin sobreespecificar cuando la muestra o los datos no lo permiten.

7\. CASE\_EDGE — instancia causal del caso

Durante una investigación, una relación concreta debe poder instanciarse como CASE\_EDGE con, como mínimo:  
\- from  
\- to  
\- supporting\_evidence  
\- contradicting\_evidence  
\- temporal\_fit  
\- scope\_fit  
\- magnitude\_fit  
\- confidence

Para que una relación pueda considerarse soportada en un caso deben evaluarse, como mínimo, mecanismo, evidencia, dirección temporal, scope y magnitud cuando apliquen.

7.1 Temporal fit

Como regla general:

CAUSE must precede EFFECT

excepto relaciones simultáneas o measurement artifacts explícitamente modelados.

Si la supuesta causa aparece después del inicio del efecto, no puede explicar ese onset. El runtime debe respetar expected\_lag y, cuando existan, expected\_lag\_min y expected\_lag\_max.

7.2 Scope fit

La causa candidata debe afectar al mismo scope que el efecto o a un scope compatible capaz de producirlo. Una causa localizada en un mercado no puede explicar automáticamente un deterioro de otro mercado.

7.3 Magnitude fit

La exposición o magnitud de la causa debe ser capaz de explicar una proporción razonable del efecto. Una causa que afecta a una fracción mínima del negocio no puede explicar por sí sola un movimiento global mucho mayor.

D7 debe poder representar causal contribution parcial. Los tipos conceptuales de causa pueden incluir:  
\- NECESSARY  
\- SUFFICIENT  
\- CONTRIBUTORY

No debe existir obsesión por una única root cause: el sistema debe soportar multicausalidad.

8\. Interacciones, confounders y no linealidad

D7 debe poder representar interacciones entre varios nodos cuando A \+ B → C describe mejor el mecanismo que edges aislados. El modelo puede soportar INTERACTION o una representación equivalente de hyperedge.

Debe poder representar confounders explícitamente. Un confounder que afecta simultáneamente a dos variables impide atribuir ingenuamente el cambio de una a la otra.

El grafo no debe asumir relaciones lineales ni monotónicas. Debe admitir threshold effects, saturation effects, NON\_MONOTONIC y CONTEXT\_DEPENDENT cuando correspondan.

Los feedback loops pueden representarse mediante edges dirigidos y, cuando sea útil, clasificarse como REINFORCING\_LOOP o balancing loop equivalente. Dynamic feedback no debe confundirse con circular reasoning.

9\. Measurement boundary

D7 debe conservar una frontera explícita entre realidad y medición:

REAL BUSINESS  
→ MEASUREMENT SYSTEM  
→ OBSERVED DATA

Un fallo de tracking puede reducir un OBSERVED\_METRIC sin cambiar la REAL\_WORLD\_VARIABLE correspondiente. El motor debe poder representar esta capa y no inferir deterioro empresarial desde un cambio puramente instrumental.

10\. Evidencia causal del caso

El sistema debe poder distinguir niveles de evidencia causal del caso. Como jerarquía conceptual, de mayor a menor fuerza:  
\- RANDOMIZED\_EXPERIMENT  
\- NATURAL\_EXPERIMENT  
\- BEFORE\_AFTER\_WITH\_CONTROL  
\- TEMPORAL \+ MECHANISTIC EVIDENCE  
\- MULTI\_SOURCE\_CORROBORATION  
\- CORRELATION\_ONLY

CORRELATION\_ONLY no puede producir HIGH causal confidence.

Cuando existan controles, segmentos no afectados, mercados de control, dispositivos no afectados, periodos comparables, experimentos o natural experiments, pueden utilizarse como evidencia para contrastar una relación.

Cada edge instanciado debe enlazar supporting\_evidence y contradicting\_evidence mediante un Causal Evidence Ledger o estructura equivalente.

11\. Traversal y causal search

D7 debe permitir recorrido lógico en ambas direcciones aunque los edges sean causales y dirigidos:  
\- backward traversal: effect → candidate causes;  
\- forward traversal: cause/event → expected downstream effects.

El runtime debe poder realizar operaciones equivalentes a:  
\- get\_parents(node)  
\- get\_ancestors(node, depth)  
\- get\_descendants(node)  
\- find\_paths(from, to)  
\- find\_supported\_paths(...)

La implementación concreta no está obligada a usar literalmente BFS o DFS, pero debe soportar búsqueda estructurada por el grafo.

Para controlar el espacio de búsqueda debe poder establecerse search radius o depth. La generación de candidatos debe priorizar DIRECT PARENTS y ampliar a PARENTS OF PARENTS solo cuando sea necesario.

Si una rama candidata se invalida, el sistema debe hacer backtracking hacia ramas alternativas en lugar de forzar la narrativa inicial.

12\. Causal pruning

D7 debe podar o degradar ramas incompatibles utilizando evidencia del caso.

Pruning mínimo:  
\- por stable metric: una métrica estable puede contradecir una ruta que exigiría su deterioro;  
\- por scope: scopes incompatibles deben rechazarse o perder peso;  
\- por time: una causa posterior al efecto no explica su onset;  
\- por data quality: si la evidencia necesaria no es fiable, la rama queda unresolved/untested, no necesariamente rechazada;  
\- por contradiction: evidencia contraria reduce o invalida la rama;  
\- por magnitude: exposición insuficiente impide atribuir el efecto completo.

REJECTED ≠ UNTESTED.

Los estados de un CASE\_EDGE deben admitir como mínimo:  
\- SUPPORTED  
\- WEAKLY\_SUPPORTED  
\- UNTESTED  
\- CONTRADICTED  
\- REJECTED

Stable metrics son evidencia negativa válida y no deben ignorarse.

13\. CAUSAL\_PATH

Una ruta causal debe poder representarse mediante un objeto equivalente a CAUSAL\_PATH con:  
\- nodes  
\- edges  
\- start  
\- target  
\- supporting\_evidence  
\- contradictions  
\- path\_confidence  
\- scope  
\- time\_window

La confianza de una ruta debe obedecer al weakest-link principle: si uno de los edges críticos es débil, overall path confidence debe degradarse.

D7 debe conservar competing paths y branching cuando varias explicaciones sigan siendo compatibles. No debe ocultar alternativas para producir una narrativa más limpia.

D7 puede buscar el deepest supported ancestor, pero no decidir que ese nodo sea la root cause. Esa decisión pertenece a D9.

14\. Constraint relationships

El grafo puede representar relaciones estructurales de restricción. Los tipos mínimos son:  
\- LIMITS  
\- CAPS  
\- BLOCKS  
\- REQUIRES

Una relación de constraint no debe confundirse con una relación causal ordinaria ni con root cause. D9 determinará el constraint efectivo del caso.

15\. Centrality, critical path y blast radius

El runtime puede calcular propiedades estructurales como degree, betweenness o critical path centrality y representar critical paths o blast radius cuando sea útil.

CAUSAL CENTRALITY ≠ BUSINESS PRIORITY.

Un nodo muy conectado no es automáticamente prioritario si está sano o si su exposición real es baja.

16\. Causal Graph Registry

El runtime debe mantener una estructura equivalente a:  
\- causal\_nodes  
\- causal\_edges  
\- causal\_conditions  
\- causal\_exceptions  
\- causal\_versions

Node Registry mínimo:  
\- node\_id  
\- code  
\- label  
\- type  
\- capability  
\- unit  
\- scope\_type

Edge Registry mínimo:  
\- edge\_id  
\- from\_node  
\- to\_node  
\- relation\_type  
\- expected\_sign  
\- mechanism  
\- conditions  
\- expected\_lag  
\- knowledge\_strength

Los códigos e identificadores deben ser estables. Los cambios de definición o semántica deben versionarse, no sobrescribirse silenciosamente.

17\. Gobernanza de edges y aprendizaje

Toda relación propuesta fuera del grafo vigente debe entrar como PROPOSED\_EDGE o estado equivalente. No puede incorporarse automáticamente al grafo global por una inferencia del LLM.

Los estados de gobernanza deben admitir como mínimo:  
\- DRAFT  
\- VALIDATED  
\- ACTIVE  
\- DEPRECATED  
\- REJECTED

Las relaciones TENANT\_LEARNED requieren evidencia histórica suficiente y aislamiento por tenant. Un único evento o diagnóstico no debe crear una causal rule permanente.

18\. Versionado y reproducibilidad

Debe existir causal\_graph\_version. Cada diagnóstico debe registrar la versión utilizada.

Para reproducir el razonamiento deben conservarse, cuando apliquen:  
\- data snapshot  
\- context snapshot  
\- signal model/version  
\- symptom model/version  
\- causal graph version

Los cambios posteriores del grafo no deben alterar silenciosamente diagnósticos históricos.

19\. Arquitectura runtime \+ LLM

Arquitectura conceptual obligatoria:

CAUSAL NODE REGISTRY  
\+  
CAUSAL EDGE REGISTRY  
\+  
METRIC EQUATIONS  
\+  
SCOPE BINDING  
\+  
TIME/LAG RULES  
→ CASE SIGNALS  
→ GRAPH TRAVERSAL  
→ PATH PRUNING  
→ SUPPORTED / UNTESTED / CONTRADICTED CAUSAL BRANCHES

El runtime debe responsabilizarse especialmente de:  
\- graph structure;  
\- node IDs;  
\- edge registry;  
\- conditions;  
\- scope binding;  
\- lags;  
\- versions;  
\- search radius;  
\- edge/path status;  
\- deterministic formula relationships;  
\- pruning comprobable;  
\- tenant isolation.

El LLM puede utilizarse para:  
\- traverse relevant paths;  
\- explain mechanisms;  
\- synthesize cross-capability reasoning;  
\- interpret evidence;  
\- propose candidate relations;  
\- expresar incertidumbre y alternativas.

El LLM no puede inventar edges arbitrariamente ni razonar causalmente en free-form fuera del espacio permitido por el grafo y la evidencia del caso.

Structured reasoning boundary mínimo para el modelo:  
\- Target  
\- Signals  
\- Context  
\- Valid causal ancestors/paths  
\- Contradictions  
\- Missing evidence

Toda relación propuesta por el modelo debe pasar por validación contractual antes de utilizarse como evidencia causal.

20\. CAUSAL\_GRAPH\_RESULT — contrato de salida

D7 debe producir un objeto equivalente a CAUSAL\_GRAPH\_RESULT capaz de incluir:  
\- target\_node  
\- candidate\_ancestors  
\- candidate\_paths  
\- supported\_edges  
\- contradicted\_edges  
\- untested\_edges  
\- confounders  
\- missing\_evidence  
\- scope  
\- time\_alignment  
\- graph\_version

Debe preservar por separado rutas soportadas, ramas no probadas y relaciones contradichas.

Handoff mínimo hacia D8:  
\- SUPPORTED PATHS  
\- UNTESTED BRANCHES  
\- CONTRADICTIONS  
\- MISSING EVIDENCE

D8 convertirá las ramas causales supervivientes en hipótesis explícitas. D7 no debe hacerlo pasar por causalidad confirmada.

21\. Observabilidad administrativa

Para cada diagnóstico, el panel administrativo debe poder reconstruir como mínimo:  
\- Target  
\- causal paths considered  
\- branches rejected  
\- reason rejected  
\- edges supported  
\- edges contradicted/untested cuando aplique  
\- confidence  
\- supporting evidence  
\- contradicting evidence  
\- missing evidence  
\- scope/time fit  
\- graph version

Debe ser posible explicar por qué una ruta permaneció abierta, perdió peso, fue contradicha o fue rechazada.

22\. Invariantes D7

El sistema nunca debe:  
\- confundir correlación con causalidad;  
\- crear relaciones sin mecanismo plausible;  
\- ignorar dirección temporal;  
\- aceptar causas que aparecen después del efecto como explicación de su inicio;  
\- ignorar scopes incompatibles;  
\- ignorar magnitud insuficiente;  
\- tratar todos los edges como igual de fuertes;  
\- confundir conocimiento causal general con evidencia del caso;  
\- convertir un edge plausible en causa confirmada;  
\- ignorar confounders;  
\- confundir OBSERVED\_METRIC con REAL\_WORLD\_VARIABLE;  
\- ignorar measurement layer;  
\- buscar siempre una única causa;  
\- ignorar interacciones;  
\- asumir relaciones lineales;  
\- conectar todo con todo;  
\- introducir acciones dentro del grafo diagnóstico;  
\- mezclar tenants;  
\- aprender relaciones permanentes desde un único caso;  
\- ocultar ramas alternativas;  
\- confundir causal centrality con prioridad;  
\- permitir que el LLM invente edges sin validación;  
\- ignorar stable metrics como evidencia negativa;  
\- sobreespecificar una causa sin datos suficientes;  
\- confundir constraint con root cause.

23\. Tests obligatorios iniciales

Como mínimo:  
\- test\_revenue\_decomposition  
\- test\_cac\_decomposition  
\- test\_payment\_path  
\- test\_stockout\_to\_conversion  
\- test\_conversion\_to\_cac  
\- test\_inventory\_to\_cash  
\- test\_operations\_to\_retention  
\- test\_tracking\_to\_observed\_data  
\- test\_scope\_mismatch\_prunes\_edge  
\- test\_temporal\_mismatch\_prunes\_edge  
\- test\_stable\_metric\_prunes\_branch  
\- test\_multicausal\_path  
\- test\_weak\_edge\_caps\_path\_confidence  
\- test\_no\_causality\_from\_correlation\_only  
\- test\_tenant\_edge\_isolation

24\. Fixtures obligatorios iniciales

Fixture 1 — CAC  
Input: CAC \+25%, CTR \-20%, CPM stable, CVR stable.  
Expected: ruta CTR ↓ → CPC ↑ → CAC ↑ soportada; ramas CVR ↓ y CPM ↑ contradichas.

Fixture 2 — Payment  
Input: Payment errors \+180%, Payment success \-25%, Orders \-20%.  
Expected: Errors → Payment Success → Orders fuertemente soportado.

Fixture 3 — Scope mismatch  
Input: France price \+20%, Spain CVR \-30%, France CVR stable.  
Expected: el cambio de precio de Francia no explica la caída de España.

Fixture 4 — Temporal mismatch  
Input: CVR decline began Sept 1; Site deployment Sept 4\.  
Expected: el deployment no puede explicar el onset de la caída.

Fixture 5 — Stockout material  
Input: Hero SKU 60% revenue, stockout yes, PDP CVR \-30%, overall revenue \-18%.  
Expected: Stockout → PDP conversion → Revenue como ruta plausible con alto soporte.

Fixture 6 — Minor stockout  
Input: SKU 1% revenue, stockout yes, Revenue \-30%.  
Expected: magnitud insuficiente para explicar la caída global.

Fixture 7 — Tracking  
Input: GA purchases \-60%, Shopify orders stable, tracking deployment same day.  
Expected: Tracking change → observed GA purchases; no inferir Tracking change → actual orders.

Fixture 8 — Multi-causal economics  
Input: Contribution \-20%, CAC \+10%, Discount \+20%, Shipping subsidy \+15%.  
Expected: múltiples contributing paths; no forzar una única root cause.

25\. Definition of Done

D7 estará correctamente construido cuando el sistema pueda responder de forma reproducible y trazable:  
\- qué variables pueden afectar al target;  
\- qué relaciones son matemáticas;  
\- qué relaciones son causales plausibles;  
\- cuáles son directas e indirectas;  
\- qué mecanismo conecta cada relación;  
\- qué condiciones requiere;  
\- qué lag temporal es compatible;  
\- qué ramas están respaldadas por señales actuales;  
\- qué ramas están contradichas;  
\- qué ramas permanecen sin probar;  
\- qué scopes coinciden;  
\- qué causas tienen magnitud suficiente;  
\- si existen varias causas simultáneas;  
\- si existen interacciones;  
\- si existen confounders;  
\- si el nodo representa realidad o medición;  
\- qué paths permanecen abiertos;  
\- qué evidencia falta para discriminar entre ellos;  
\- qué versión del grafo se utilizó;  
\- por qué cada rama fue soportada, degradada, contradicha o rechazada.

D7 debe reducir el espacio causal de forma estructurada sin convertir plausibilidad en certeza y sin invadir las responsabilidades de D8 y D9.  
