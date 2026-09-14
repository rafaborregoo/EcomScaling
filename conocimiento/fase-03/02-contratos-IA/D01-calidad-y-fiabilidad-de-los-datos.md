FASE 3 — SISTEMA DE DIAGNÓSTICO  
D1 — CALIDAD Y FIABILIDAD DE LOS DATOS

147\. Definition of Done de D1  
D1 estará correctamente construido cuando el sistema pueda responder:  
¿Qué fuentes tengo?  
¿Están conectadas?  
¿Están actualizadas?  
¿Tengo todo el periodo?  
¿Existen huecos?  
¿Existen duplicados?  
¿Las definiciones son consistentes?  
¿Las unidades coinciden?  
¿Las monedas coinciden?  
¿Los timezones coinciden?  
¿Las métricas derivadas cuadran?  
¿Las fuentes se contradicen?  
¿Cuál es la fuente de verdad?  
¿Existe tracking roto?  
¿Ha cambiado la atribución?  
¿Ha cambiado alguna definición?  
¿Hay suficiente volumen de datos?  
¿El periodo está cerrado?  
¿Qué datos faltan para este diagnóstico concreto?  
¿Qué diagnósticos puedo realizar?  
¿Cuáles debo degradar?  
¿Cuáles debo bloquear?  
¿Cuál es el máximo nivel de confianza permitido?

148\. Invariantes de D1  
El sistema nunca debe:  
Suponer que una API conectada está funcionando correctamente.  
Suponer que una cifra existente está completa.  
Tratar NULL como cero.  
Mezclar definiciones diferentes de una métrica.  
Sumar revenue atribuido de múltiples plataformas.  
Ignorar timezones.  
Ignorar monedas.  
Ignorar periodos incompletos.  
Ignorar datos todavía no asentados.  
Ignorar tracking roto.  
Ignorar duplicados.  
Ignorar cambios de schema.  
Ignorar cambios de atribución.  
Emitir HIGH confidence cuando los datos críticos son LOW confidence.  
Utilizar datos de otro tenant.  
Convertir conocimiento del RAG en evidencia del caso.  
Confundir falta de datos con ausencia de problema.  
Ocultar discrepancias entre fuentes.  
Construir métricas derivadas sobre inputs no fiables sin degradarlas.  
Permitir que el LLM decida arbitrariamente qué dato es fiable.

149\. Arquitectura conceptual  
EXTERNAL SOURCES  
│  
├── Shopify  
├── Meta  
├── Google  
├── Klaviyo  
├── Stripe  
├── ERP  
└── Others  
       │  
       ▼  
RAW DATA  
       │  
       ▼  
VALIDATION  
       │  
       ▼  
NORMALIZATION  
       │  
       ▼  
RECONCILIATION  
       │  
       ▼  
QUALITY ENGINE  
       │  
       ├── source health  
       ├── data issues  
       ├── confidence  
       ├── lineage  
       └── diagnostic readiness  
       │  
       ▼  
CANONICAL DATA  
       │  
       ▼  
DIAGNOSTIC ENGINE  
La IA debería trabajar principalmente sobre:  
CANONICAL DATA  
y no directamente sobre respuestas arbitrarias de APIs.

151\. Qué pertenece al RAG y qué al runtime — Runtime  
Runtime debe imponer:  
freshness checks  
completeness checks  
schema validation  
reconciliation  
confidence caps  
source hierarchy  
tenant isolation  
metric definitions  
lineage  
diagnostic readiness  
Reglas críticas no deben depender solo del LLM.

152\. Motor determinista antes del LLM  
Idealmente:  
DATA QUALITY ENGINE  
debe ser principalmente determinista.  
Ejemplo:  
last\_sync \> threshold  
→ STALE  
expected\_records \!= received\_records  
→ PARTIAL  
currency mismatch  
→ FAIL  
Shopify orders stable  
GA purchase \-70%  
→ SOURCE\_CONFLICT  
El LLM puede explicar la situación.  
Pero no debería decidir libremente hechos detectables matemáticamente.

153\. Salida hacia D2–D14  
D1 debe entregar al resto del sistema:  
trusted\_metrics  
degraded\_metrics  
rejected\_metrics  
missing\_metrics  
source\_health  
data\_issues  
data\_gaps  
confidence\_caps  
diagnostic\_readiness  
snapshot\_metadata

3\. DATA QUALITY GATE  
Antes de que el motor entre en diagnóstico empresarial debe pasar por un:  
DATA QUALITY GATE  
Conceptualmente:  
RAW DATA  
↓  
SOURCE VALIDATION  
↓  
FRESHNESS  
↓  
COMPLETENESS  
↓  
CONSISTENCY  
↓  
INTEGRITY  
↓  
RECONCILIATION  
↓  
DIAGNOSTIC SUFFICIENCY  
↓  
PASS / PASS WITH WARNINGS / FAIL  
Estados:  
PASS  
PASS\_WITH\_WARNINGS  
FAIL

4\. Regla fundamental del gate  
Si el sistema obtiene:  
FAIL  
en datos críticos para el diagnóstico solicitado, no puede emitir una root cause empresarial con confianza alta.  
Debe:  
degradar confidence  
o:  
emitir DATA\_DIAGNOSIS  
o:  
declarar INSUFFICIENT\_DATA

5\. DATA\_SOURCE\_HEALTH  
Cada integración tendrá su propio estado de salud.  
Ejemplo:  
DATA\_SOURCE\_HEALTH  
source:  
Shopify  
connection:  
ACTIVE  
last\_successful\_sync:  
2026-09-10T09:02  
expected\_sync\_interval:  
15 minutes  
freshness:  
HEALTHY  
coverage:  
99.8%  
schema\_status:  
VALID  
error\_rate:  
0.2%  
reliability:  
HIGH  
Otro:  
DATA\_SOURCE\_HEALTH  
source:  
Meta Ads  
connection:  
ACTIVE  
last\_successful\_sync:  
2026-09-09T22:00  
expected\_sync\_interval:  
1 hour  
freshness:  
STALE  
coverage:  
82%  
known\_issue:  
Missing campaign insights for latest 11 hours  
reliability:  
LOW

64\. Data Confidence Score  
Podemos utilizar internamente un score compuesto.  
Ejemplo conceptual:  
Freshness       95  
Completeness    100  
Consistency     91  
Integrity       100  
Reconciliation  88  
Granularity     100  
Resultado:  
DATA\_CONFIDENCE:  
94/100  
Pero cuidado:  
El score nunca debe sustituir las dimensiones individuales.  
Un 90/100 puede esconder un problema crítico precisamente en el dato necesario para una investigación concreta.

65\. Critical Data Dependency  
Por eso debe existir:  
CRITICAL\_FOR\_DIAGNOSIS:  
true / false  
Ejemplo:  
Para diagnosticar:  
payment failure  
tener datos perfectos de Meta no sirve.  
Necesitamos:  
checkout  
payment  
orders

66\. Diagnostic Data Requirements  
Cada familia de diagnóstico debería declarar requisitos mínimos.  
Ejemplo:  
DIAGNOSIS:  
Creative fatigue  
required:  
CTR  
creative\_id  
spend  
impressions  
creative age  
useful:  
frequency  
thumbstop  
hook rate  
CVR  
audience size  
Otro:  
DIAGNOSIS:  
Inventory constraint  
required:  
inventory  
sales velocity  
SKU  
stock status  
useful:  
lead time  
purchase orders  
forecast  
supplier SLA

67\. Required vs Optional Evidence  
Estados:  
REQUIRED  
HIGH\_VALUE  
OPTIONAL  
IRRELEVANT  
Esto ayudará al orquestador a saber qué fuentes debe consultar.

70\. DATA\_ISSUE  
Todos los problemas de información deberán representarse como objetos.  
Ejemplo:  
DATA\_ISSUE  
id:  
DQ-0041  
type:  
STALE\_DATA  
source:  
Meta Ads  
scope:  
campaign insights  
severity:  
HIGH  
detected\_at:  
...  
impact:  
Acquisition diagnosis unreliable  
status:  
OPEN

71\. Tipología de problemas de datos  
Como mínimo:  
MISSING\_DATA  
STALE\_DATA  
PARTIAL\_DATA  
DUPLICATE\_DATA  
INVALID\_DATA  
SCHEMA\_DRIFT  
METRIC\_DEFINITION\_DRIFT  
ATTRIBUTION\_DRIFT  
TIMEZONE\_MISMATCH  
CURRENCY\_MISMATCH  
SYNC\_FAILURE  
WEBHOOK\_FAILURE  
API\_PERMISSION\_GAP  
RATE\_LIMITING  
RECONCILIATION\_FAILURE  
TRACKING\_FAILURE  
EVENT\_DUPLICATION  
EVENT\_LOSS  
DATA\_BACKFILL  
LATE\_ARRIVING\_DATA  
LOW\_SAMPLE\_SIZE  
OUTLIER  
SOURCE\_CONFLICT  
UNKNOWN

72\. Severity del problema de datos  
Estados:  
LOW  
MODERATE  
HIGH  
CRITICAL  
La severidad depende de su impacto sobre el diagnóstico.  
Ejemplo:  
Instagram organic impressions missing  
puede ser LOW para investigar cashflow.  
Pero:  
COGS missing  
puede ser CRITICAL para diagnosticar profitability.

73\. DATA\_DIAGNOSIS  
Los fallos de información también son diagnósticos.  
Ejemplo:  
DIAGNOSTIC\_TYPE:  
DATA  
PRIMARY\_ISSUE:  
Meta purchase attribution became inconsistent  
ROOT\_CAUSE:  
Tracking configuration changed  
SEVERITY:  
HIGH  
CONFIDENCE:  
HIGH  
BUSINESS\_DIAGNOSIS\_BLOCKED:  
Acquisition efficiency

74\. No ocultar fallos de datos  
Nunca:  
“ROAS ha caído un 35 %.”  
si existe evidencia fuerte de cambio de tracking.  
Debe decir:  
“Meta reporta una caída del 35 % en ROAS, pero la fiabilidad de esa señal es baja porque el volumen de conversiones registradas cambió inmediatamente después de una modificación de tracking.”

75\. Source Conflict  
Ejemplo:  
Shopify:  
orders \+12%  
GA4:  
purchases \-18%  
El sistema debe crear:  
SOURCE\_CONFLICT  
antes de decidir qué dato creer.

76\. Conflict Resolution  
Debe aplicarse una jerarquía:  
1\. Determine whether sources measure same phenomenon.  
2\. Check definitions.  
3\. Check timezones.  
4\. Check filters.  
5\. Check attribution.  
6\. Check coverage.  
7\. Check event integrity.  
8\. Consult source of truth.

77\. Provenance  
Toda métrica usada debería conocer:  
origin  
extraction timestamp  
transformation  
formula  
source version  
Esto permite reproducibilidad.

78\. Reproducibility  
Un diagnóstico debería poder volver a ejecutarse sobre el mismo snapshot.  
Si los inputs son iguales, el sistema debería obtener una interpretación razonablemente equivalente.  
Esto es importante para:  
testing  
debugging  
evaluation  
audit

79\. Immutable Diagnostic Snapshot  
Cuando se produce un diagnóstico importante, debería guardarse:  
DATA\_SNAPSHOT  
con los datos usados en ese momento.  
Porque mañana:  
Meta  
Shopify  
Klaviyo  
pueden haber actualizado cifras históricas.  
Sin snapshot, no podríamos reconstruir por qué la IA dijo algo.

80\. Snapshot Metadata  
Ejemplo:  
snapshot\_id  
created\_at  
sources  
time\_ranges  
data\_versions  
metric\_versions  
normalization\_version  
quality\_score  
known\_issues

81\. Data Contract  
Cada integración debería respetar un contrato.  
Ejemplo:  
source\_metric  
normalized\_metric  
unit  
currency  
timezone  
granularity  
dimensions  
expected\_frequency  
nullable  
source\_of\_truth

82\. Normalization Layer  
Nunca debería permitirse que cada agente interprete directamente APIs externas.  
Debe existir:  
Meta API  
Shopify API  
Klaviyo API  
↓  
NORMALIZATION LAYER  
↓  
CANONICAL METRICS  
↓  
DIAGNOSTIC ENGINE  
Esto evita lógica duplicada.

83\. Canonical Metrics  
Ejemplo:  
revenue\_net  
orders\_paid  
customers\_new  
ad\_spend  
sessions  
conversion\_rate  
aov  
cac  
refund\_rate  
gross\_margin  
contribution\_margin  
inventory\_units  
stock\_coverage\_days  
Cada una tendrá definición única.

84\. Raw vs Canonical  
Debe conservarse:  
RAW\_VALUE  
y:  
NORMALIZED\_VALUE  
Ejemplo:  
Meta:  
amount\_spent\_usd  
normalizado a:  
ad\_spend\_eur

85\. Transformations  
Cada transformación debería ser trazable.  
Ejemplo:  
USD → EUR  
Gross → Net  
Local timezone → canonical timezone  
Platform metric → internal metric

86\. Error Propagation  
Si una transformación falla:  
RAW:  
VALID  
pero:  
NORMALIZATION:  
FAILED  
el dato final no puede ser fiable.

87\. Confidence Propagation  
Conceptualmente:  
source reliability  
×  
transformation reliability  
×  
coverage  
×  
reconciliation  
\=  
usable evidence reliability  
No necesariamente será una fórmula matemática literal, pero el razonamiento debe respetar esa estructura.

96\. Free-text Risk  
El RAG puede recuperar documentos internos obsoletos.  
Por tanto, el conocimiento también necesita:  
version  
valid\_from  
valid\_until  
owner  
status

97\. RAG Data Reliability  
D1 no solo aplica a APIs.  
También aplica al propio conocimiento recuperado.  
Ejemplo:  
Document A:  
Meta attribution rule from 2024  
Document B:  
updated internal rule from 2026  
El copiloto debe preferir la versión vigente.

98\. Knowledge Source Status  
Documentos del RAG deberían poder tener:  
ACTIVE  
SUPERSEDED  
DRAFT  
DEPRECATED  
EXPERIMENTAL

99\. Knowledge Authority  
No todos los documentos tienen el mismo peso.  
Ejemplo:  
INTERNAL\_POLICY  
puede superar a:  
TEAM\_NOTE  
para reglas operativas.

100\. RAG Conflict  
Si dos documentos dicen cosas incompatibles:  
KNOWLEDGE\_CONFLICT  
El copiloto no debe elegir silenciosamente.  
Debe utilizar:  
version  
authority  
date  
scope  
para resolverlo.

101\. Retrieval Confidence  
Recuperar un documento semánticamente parecido no significa que sea relevante.  
El sistema debería distinguir:  
retrieval\_similarity  
de:  
business\_applicability

102\. RAG hallucination protection  
Nunca:  
retrieved text  
→ assumed business fact  
Ejemplo:  
El RAG contiene:  
“Una causa frecuente de caída de CTR es fatiga creativa.”  
Eso no significa:  
“Esta tienda tiene fatiga creativa.”  
El RAG aporta:  
diagnostic knowledge  
Los datos aportan:  
case evidence

103\. Regla crítica para el copiloto  
Debe distinguirse siempre:  
KNOWLEDGE  
de:  
CASE DATA  
de:  
INFERENCE  
Ejemplo:  
KNOWLEDGE:  
Stockout can reduce conversion.  
CASE DATA:  
Hero SKU availability fell 63%.  
INFERENCE:  
Stockout is a plausible contributor to CVR decline.

104\. DATA QUALITY RESULT  
D1 debe producir una salida normalizada.  
Ejemplo:  
DATA\_QUALITY\_RESULT  
overall\_status:  
PASS\_WITH\_WARNINGS  
overall\_confidence:  
MEDIUM\_HIGH  
critical\_sources:  
Shopify: HIGH  
Meta: MEDIUM  
Klaviyo: HIGH  
issues:  
DQ-003  
DQ-009  
blocked\_diagnostics:  
none  
degraded\_diagnostics:  
creative fatigue  
recommendation\_confidence\_cap:  
MEDIUM

105\. Confidence Cap  
Concepto importante:  
La calidad de los datos puede imponer un máximo de confianza diagnóstica.  
Ejemplo:  
DATA CONFIDENCE:  
LOW  
Entonces:  
DIAGNOSTIC CONFIDENCE:  
cannot exceed LOW  
aunque el LLM “crea” que la explicación es evidente.

113\. Observability  
Cada pipeline de datos debería registrar:  
records\_requested  
records\_received  
records\_inserted  
records\_updated  
records\_rejected  
processing\_duration  
API\_errors  
sync\_timestamp  
watermark

114\. Watermarks  
Para evitar huecos:  
last\_processed\_timestamp  
debe conservarse.  
Ejemplo:  
last successful order:  
2026-09-10 09:14:32  
El siguiente proceso continúa desde ahí.

115\. Idempotency  
Reprocesar datos no debería duplicarlos.  
Ejemplo:  
order\_id  
o:  
event\_id  
debe funcionar como identificador estable.

116\. Deduplication  
Debe existir una estrategia para detectar:  
same event  
same order  
same transaction  
same webhook

117\. Observability vs Business Diagnosis  
El panel de administración debería separar:  
BUSINESS HEALTH  
de:  
DATA HEALTH  
Una tienda puede estar sana mientras una integración está rota.

118\. Global Data Health  
Ejemplo:  
DATA HEALTH  
Shopify        99/100  
Meta Ads       71/100  
Google Ads     96/100  
Klaviyo        94/100  
GA4            62/100  
Stripe         100/100

119\. Diagnostic Readiness  
Más importante todavía:  
DIAGNOSTIC READINESS  
Revenue:  
READY  
Profitability:  
PARTIAL  
Creative:  
PARTIAL  
Conversion:  
READY  
Retention:  
READY  
Inventory:  
NOT\_READY  
Esto le dice al sistema qué sabe diagnosticar realmente.

120\. Diagnostic Readiness Matrix  
Ejemplo:  
Área  
Estado  
Motivo  
Revenue  
READY  
Shopify completo  
Acquisition  
READY WITH WARNINGS  
Meta attribution issue  
Creative  
PARTIAL  
Falta histórico creativo  
Conversion  
READY  
Funnel completo  
Retention  
READY  
Shopify \+ Klaviyo  
Profitability  
PARTIAL  
COGS incompletos  
Inventory  
NOT READY  
Sin integración ERP

121\. Quality-aware Orchestration  
El orquestador debería utilizar esta matriz antes de llamar agentes.  
Ejemplo:  
Usuario pregunta:  
“¿Por qué estoy perdiendo dinero?”  
Antes:  
Finance data readiness:  
PARTIAL  
COGS:  
MISSING  
Fulfillment costs:  
MISSING  
Resultado:  
El Finance Agent no debe fingir precisión.

122\. Progressive Diagnosis  
El sistema puede diagnosticar hasta el nivel permitido.  
Ejemplo:  
Revenue decline:  
CONFIRMED  
Conversion decline:  
CONFIRMED  
Checkout problem:  
CONFIRMED  
Payment provider failure:  
UNCONFIRMED  
porque faltan logs del proveedor.  
Esto sigue siendo útil.

123\. Evidence Boundary  
El sistema debe detenerse donde termina la evidencia.  
Nunca debe completar la última parte de la cadena causal por intuición.

124\. Data Quality Alerts  
Algunos problemas deben producir alertas aunque el usuario no haya preguntado.  
Ejemplo:  
CRITICAL:  
Shopify orders sync stopped 4h ago.  
Porque todos los diagnósticos posteriores quedarían comprometidos.

125\. Data Issue Persistence  
Un error puntual puede no importar.  
Pero si:  
Meta data stale  
durante:  
7 days  
se convierte en un problema estructural de observabilidad.

126\. Temporal State del dato  
Estados:  
NEW  
INTERMITTENT  
PERSISTENT  
WORSENING  
RECOVERING  
RESOLVED

127\. Data Quality History  
Debe guardarse histórico.  
Ejemplo:  
DQ-122  
Detected:  
Sept 3  
Resolved:  
Sept 4  
Reappeared:  
Sept 8  
Esto puede revelar:  
unstable integration

128\. Data Root Cause  
Incluso los problemas de datos deben diagnosticarse causalmente.  
Ejemplo:  
SYMPTOM:  
Meta revenue disappeared  
ROOT CAUSE:  
purchase event no longer sent  
UNDERLYING ROOT CAUSE:  
pixel removed during theme deployment

129\. Data Constraint  
Ejemplo:  
ROOT CAUSE:  
COGS integration missing  
CONSTRAINT:  
Profitability observability  
Esto es distinto de:  
profitability problem

130\. Confidence Transparency  
El usuario no necesita ver siempre todos los detalles técnicos.  
Pero el sistema sí debe conservarlos.  
Interfaz simplificada:  
Data confidence:  
High  
Al desplegar:  
Shopify:  
High  
Meta:  
Medium  
Reason:  
Attribution discrepancy detected

131\. Admin Trace  
El panel administrativo debería poder mostrar:  
Diagnostic ID  
Data snapshot  
Source statuses  
Detected data issues  
Confidence cap  
Metrics rejected  
Metrics accepted  
Reconciliation results

132\. No contaminar el RAG  
Los snapshots de negocio no deberían convertirse automáticamente en conocimiento general.  
Ejemplo:  
Brand A CAC normal \= €42  
no debe convertirse en:  
ecommerce CAC normal \= €42  
Debe conservar scope:  
tenant  
business  
period  
market  
channel

133\. Tenant Isolation  
En un SaaS multiempresa:  
Los datos, benchmarks internos, diagnósticos y experiencia específica de un cliente nunca deben filtrarse hacia otro cliente.  
El sistema debe separar:  
GLOBAL KNOWLEDGE  
de:  
TENANT KNOWLEDGE

134\. Tenant-specific Baselines  
Una tienda puede aprender su propio:  
normal CAC  
normal CVR  
normal AOV  
normal return rate  
normal stock coverage  
pero esto sigue siendo conocimiento scoped a esa tienda.

135\. Data Governance Metadata  
Toda fuente puede tener:  
tenant\_id  
source\_id  
owner  
data\_classification  
retention\_policy  
sync\_policy  
permissions

136\. Privacy Boundary  
D1 también debe impedir que el motor utilice datos personales innecesarios para diagnósticos agregados.  
Ejemplo:  
Para analizar:  
repeat purchase rate  
normalmente no necesita exponer al LLM:  
customer full name  
email  
phone  
address  
Debe aplicarse minimización.

137\. Aggregation First  
Siempre que sea posible:  
raw personal data  
     ↓  
aggregation  
     ↓  
diagnostic metrics  
     ↓  
LLM  
y no:  
all customers  
     ↓  
LLM

138\. PII Boundary  
El contrato de datos debería etiquetar:  
PII  
SENSITIVE  
FINANCIAL  
AGGREGATED  
ANONYMIZED  
PUBLIC  
para controlar qué componentes pueden consumirlos.

139\. Quality vs Privacy  
Un diagnóstico técnicamente mejor no justifica automáticamente usar más datos personales.  
Debe aplicarse:  
minimum necessary data

140\. Data Quality Tests  
D1 debe validarse con casos automatizados.  
Ejemplos:  
test\_missing\_orders  
test\_duplicate\_purchase\_events  
test\_stale\_meta\_data  
test\_timezone\_mismatch  
test\_currency\_mismatch  
test\_source\_conflict  
test\_attribution\_change  
test\_partial\_sync  
test\_schema\_drift  
test\_low\_sample  
test\_backfill  
test\_open\_period  
test\_tracking\_regression

141\. Fixture 1 — Tracking roto  
Input:  
Shopify orders:  
stable  
Meta purchases:  
\-60%  
Meta clicks:  
stable  
Pixel deployment:  
same timestamp as decline  
Expected:  
DATA\_DIAGNOSIS:  
tracking regression  
business acquisition diagnosis:  
DEGRADED

142\. Fixture 2 — Negocio realmente deteriorado  
Shopify orders:  
\-25%  
Stripe transactions:  
\-24%  
GA4 purchases:  
\-27%  
Sessions:  
stable  
Expected:  
DATA QUALITY:  
PASS  
BUSINESS SIGNAL:  
conversion/revenue deterioration

143\. Fixture 3 — Missing period  
Days available:  
1–10  
15–30  
Expected:  
DATA\_CONTINUITY:  
FAIL  
monthly comparison:  
INVALID / DEGRADED

144\. Fixture 4 — Duplicate event  
GA purchases:  
2,000  
Shopify orders:  
1,010  
GA purchase event ratio:  
\~2x  
Expected:  
possible event duplication

145\. Fixture 5 — FX distortion  
Local revenue:  
stable  
Reported EUR revenue:  
\+9%  
FX:  
\+9%  
Expected:  
business growth:  
NOT CONFIRMED  
currency effect:  
probable

146\. Fixture 6 — Low sample  
Sessions:  
31  
Conversion:  
\-60%  
Expected:  
LOW\_SAMPLE\_SIZE  
signal confidence:  
LOW

CIERRE D1 — ESTADOS FORMALES Y GOBERNANZA

0\. Propósito contractual de D1  
Antes de diagnosticar el negocio, el sistema debe diagnosticar los datos.  
Esta regla es obligatoria.  
Un ecommerce puede aparentar:  
caída de revenue;  
empeoramiento del ROAS;  
incremento del CAC;  
descenso de conversión;  
caída de retención;  
incremento de refunds;  
deterioro del funnel;  
cuando en realidad el problema puede estar en:  
tracking roto;  
integraciones incompletas;  
duplicación de eventos;  
retrasos de sincronización;  
cambios de atribución;  
problemas de timezone;  
datos parciales;  
eventos desaparecidos;  
cambios de definición de métricas;  
permisos API insuficientes;  
webhooks fallando;  
discrepancias entre plataformas.  
Por tanto:  
Ningún diagnóstico empresarial importante debe considerarse fiable hasta haber evaluado primero la fiabilidad de los datos que lo soportan.

1\. Principio central  
El sistema nunca debe asumir:  
dato disponible \= dato correcto  
Debe diferenciar:  
AVAILABLE  
de:  
TRUSTWORTHY  
y además diferenciar:  
TRUSTWORTHY  
de:  
SUFFICIENT\_FOR\_THIS\_DIAGNOSIS  
Un dato puede ser correcto pero insuficiente para responder una determinada pregunta.

2\. Los tres niveles de confianza de información  
Todo dato debe evaluarse en tres dimensiones principales.

2.1 Availability  
Pregunta:  
¿Tenemos el dato?  
Estados:  
AVAILABLE  
PARTIAL  
MISSING  
UNAVAILABLE

2.2 Reliability  
Pregunta:  
¿Podemos confiar en él?  
Estados:  
RELIABLE  
DEGRADED  
UNRELIABLE  
UNKNOWN

2.3 Diagnostic Sufficiency  
Pregunta:  
¿Es suficiente para resolver esta investigación?  
Estados:  
SUFFICIENT  
PARTIALLY\_SUFFICIENT  
INSUFFICIENT  
Ejemplo:  
Meta spend:  
AVAILABLE  
RELIABLE  
pero:  
Creative-level historical data:  
MISSING  
Por tanto, para diagnosticar fatiga creativa:  
DIAGNOSTIC\_SUFFICIENCY:  
PARTIALLY\_SUFFICIENT

6\. Dimensiones de calidad de datos  
El sistema debe evaluar al menos:  
Freshness  
Completeness  
Consistency  
Accuracy  
Validity  
Uniqueness  
Integrity  
Coverage  
Granularity  
Continuity  
Reconciliation  
Traceability

91\. Data Reliability Label  
Toda evidencia puede portar:  
VERY\_HIGH  
HIGH  
MEDIUM  
LOW  
VERY\_LOW  
UNKNOWN

93\. Manual User Input  
El usuario también puede proporcionar información.  
Ejemplo:  
“Ayer cambiamos Stripe.”  
Debe registrarse como:  
USER\_REPORTED\_EVENT  
No debe tratarse automáticamente como verdad confirmada.  
Estados:  
REPORTED  
VERIFIED  
UNVERIFIED  
CONTRADICTED

150\. Relación con el RAG  
D1 debería dividirse en chunks semánticos como:  
data\_quality\_principles  
source\_health  
freshness  
completeness  
reconciliation  
metric\_definitions  
tracking\_integrity  
attribution\_integrity  
data\_lineage  
diagnostic\_readiness  
rag\_reliability  
tenant\_isolation  
data\_quality\_invariants  
Metadata:  
phase:  
F3  
block:  
D1  
domain:  
data\_quality  
knowledge\_type:  
diagnostic\_rule

151\. Qué pertenece al RAG — RAG  
Debe enseñar:  
cómo interpretar discrepancias  
qué significa attribution drift  
qué problemas puede producir tracking roto  
qué fuentes suelen ser source of truth  
qué patrones son sospechosos

154\. Principio final  
Un sistema de consultoría mediocre pregunta:  
“¿Qué dicen las métricas?”  
Un sistema serio pregunta primero:  
“¿Qué métricas merecen ser creídas?”  
Y después:  
“¿Qué parte de la realidad podemos reconstruir con ellas?”  
Solo entonces empieza el diagnóstico empresarial.  
D1 existe para impedir que el copiloto produzca una explicación sofisticada basada en una mentira técnica.  
Su función no es hacer que la IA responda más.  
Su función es hacer que responda solo hasta donde llegan los datos.  
