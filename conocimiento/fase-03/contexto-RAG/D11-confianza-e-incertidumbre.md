# **FASE 3 — SISTEMA DE DIAGNÓSTICO**

## **D11 — CONFIANZA E INCERTIDUMBRE**

---

# **0\. Propósito de D11**

Hasta D10 el sistema puede responder:

qué ocurre  
dónde ocurre  
qué patrón existe  
qué hipótesis compiten  
cuál es la causa raíz más probable  
cuál es el constraint  
cuánto impacto tiene

D11 responde:

> **¿Cuánto podemos confiar realmente en cada una de esas afirmaciones y qué parte del diagnóstico sigue siendo incierta?**

Este bloque no añade otra opinión.

Añade disciplina epistemológica.

---

# **1\. Problema fundamental**

Un LLM puede escribir:

> “La caída está claramente provocada por fatiga creativa.”

aunque la evidencia real sea:

CTR ↓  
CPM unknown  
CVR unknown  
creative age unknown  
frequency unknown

El lenguaje suena seguro.

La evidencia no lo es.

D11 debe impedir esto.

---

# **2\. Principio central**

CONFIDENCE  
must come from  
EVIDENCE

not from  
LINGUISTIC CERTAINTY

---

# **5\. Qué significa HIGH**

HIGH

significa:

> Existe evidencia suficiente, fiable y coherente para sostener la conclusión, las principales explicaciones alternativas han sido contrastadas y no existen gaps críticos que puedan cambiar materialmente la interpretación.

No significa:

> certeza absoluta.

---

# **6\. Qué significa MEDIUM**

MEDIUM

significa:

> La explicación es actualmente la mejor soportada, pero existe incertidumbre relevante o alguna alternativa plausible todavía abierta.

---

# **7\. Qué significa LOW**

LOW

significa:

> La explicación es compatible con la evidencia disponible, pero existen gaps, alternativas o debilidades suficientes como para que pueda cambiar fácilmente con nueva información.

---

# **8\. Qué significa INSUFFICIENT\_DATA**

INSUFFICIENT\_DATA

significa:

> La información disponible no permite distinguir de forma responsable entre las principales explicaciones.

---

# **10\. Example**

Revenue decline:  
HIGH confidence

Payment-stage deterioration:  
HIGH

Payment provider outage:  
LOW

Payment configuration regression:  
MEDIUM

Lost revenue estimate:  
MEDIUM\_HIGH

Severity:  
HIGH

Eso es mucho más preciso.

---

# **12\. DATA\_RELIABILITY**

Proviene de D1.

Pregunta:

> ¿Podemos confiar en la información utilizada?

---

# **13\. DATA\_COVERAGE**

Pregunta:

> ¿Estamos viendo suficiente parte del fenómeno?

Ejemplo:

Meta data:  
available

Google Ads:  
missing

Puede impedir diagnosis global de adquisición.

---

# **14\. CONTEXT\_QUALITY**

Proviene de D2.

Pregunta:

> ¿Conocemos suficiente contexto para interpretar correctamente el cambio?

---

# **15\. SAMPLE\_SUFFICIENCY**

Pregunta:

> ¿Existe suficiente volumen para que la señal sea estable?

---

# **16\. TEMPORAL\_FIT**

Pregunta:

> ¿La secuencia temporal encaja con la explicación?

---

# **17\. SCOPE\_FIT**

Pregunta:

> ¿La causa candidata afecta al mismo segmento donde aparece el efecto?

---

# **18\. MECHANISM\_STRENGTH**

Pregunta:

> ¿Existe un mecanismo causal sólido que conecte causa y efecto?

---

# **19\. EVIDENCE\_CONSISTENCY**

Pregunta:

> ¿Las fuentes y señales cuentan una historia coherente?

---

# **20\. ALTERNATIVE\_SEPARATION**

Pregunta:

> ¿La explicación principal está claramente mejor soportada que las alternativas?

---

# **21\. CONTRADICTION\_LEVEL**

Pregunta:

> ¿Qué evidencia tenemos que contradice nuestra conclusión?

---

# **22\. MISSING\_EVIDENCE**

Pregunta:

> ¿Qué información relevante todavía no conocemos?

---

# **23\. EXPLANATORY\_COVERAGE**

Pregunta:

> ¿Cuánto del fenómeno consigue explicar realmente la conclusión?

---

# **25\. Example**

Data:  
HIGH

Context:  
HIGH

Causal path:  
MEDIUM

Root cause confidence:

cannot exceed MEDIUM

---

# **26\. Another**

Data:  
LOW

Todo diagnosis basado críticamente en esos datos:

cannot be HIGH

---

# **29\. Example**

DATA\_QUALITY\_CAP:  
MEDIUM

Aunque el modelo considere una hypothesis muy clara:

FINAL:  
MEDIUM

---

# **30\. Confidence Inputs must be visible**

No queremos:

confidence:  
medium

sin explicación.

Mejor:

confidence:  
MEDIUM

because:  
data high  
scope high  
temporal fit high  
one serious alternative remains open

---

# **33\. DATA\_UNCERTAINTY**

Ejemplo:

COGS missing for 18% of SKUs.

---

# **34\. CONTEXT\_UNCERTAINTY**

Ejemplo:

Unknown whether promotion was active during comparison period.

---

# **35\. MEASUREMENT\_UNCERTAINTY**

Ejemplo:

Meta and Shopify purchase counts diverge materially.

---

# **36\. MODEL\_UNCERTAINTY**

Ejemplo:

Creative fatigue and audience saturation produce similar observed pattern.

---

# **37\. CAUSAL\_UNCERTAINTY**

Ejemplo:

CTR deterioration is confirmed, but upstream cause remains unresolved.

---

# **38\. SCOPE\_UNCERTAINTY**

Ejemplo:

Issue detected globally but device breakdown unavailable.

---

# **39\. TEMPORAL\_UNCERTAINTY**

Ejemplo:

Exact onset unknown because source sync is daily.

---

# **40\. IMPACT\_UNCERTAINTY**

Ejemplo:

Lost revenue depends on counterfactual baseline with medium confidence.

---

# **41\. FORECAST\_UNCERTAINTY**

Ejemplo:

Restock timing depends on supplier ETA with low reliability.

---

# **42\. KNOWLEDGE\_UNCERTAINTY**

Ejemplo:

No validated causal rule exists for this novel interaction.

---

# **43\. Known Unknown**

D11 debe distinguir:

KNOWN\_UNKNOWN

de:

UNKNOWN\_UNKNOWN

Solo el primero puede representarse directamente.

Pero diseño robusto debe asumir que unknown unknowns existen.

---

# **44\. Known Unknown Example**

Frequency data missing.

---

# **45\. Unknown Unknown Protection**

No podemos listar lo que desconocemos.

Pero podemos reducir sobreconfianza mediante:

alternative generation  
confounder checks  
falsification  
scope discipline

---

# **47\. OBSERVED**

Directamente presente en datos fiables.

Ejemplo:

Shopify paid orders fell 18%.

---

# **48\. DERIVED**

Calculado a partir de observaciones.

Ejemplo:

CAC increased 22%.

---

# **49\. INFERRED**

Interpretación basada en varias evidencias.

Ejemplo:

Deterioration is concentrated pre-click.

---

# **50\. HYPOTHESIZED**

Explicación todavía abierta.

Creative fatigue.

---

# **51\. CONFIRMED**

Suficientemente validado.

---

# **52\. UNKNOWN**

No puede establecerse.

---

# **53\. Never flatten epistemic states**

No presentar:

orders down  
CAC up  
creative fatigue

como tres hechos equivalentes.

---

# **55\. Claim-level traceability**

Ejemplo:

CLAIM:  
The issue is isolated to Mobile Safari.

STATE:  
INFERRED

CONFIDENCE:  
HIGH

EVIDENCE:  
device conversion breakdown

---

# **56\. Confidence hierarchy**

Generalmente:

DIRECT OBSERVATION  
\>  
DERIVED METRIC  
\>  
MECHANISTIC INFERENCE  
\>  
HEURISTIC INFERENCE  
\>  
SPECULATION

si la calidad de fuente es comparable.

---

# **57\. But direct observation can still be unreliable**

Ejemplo:

GA purchase events

directamente observados pero tracking roto.

Por tanto:

source reliability

siempre importa.

---

# **59\. Direct Evidence**

Ejemplo:

Error log identifies exact failure.

---

# **60\. Strong Indirect**

Problem begins immediately after deployment and disappears after rollback.

---

# **61\. Indirect**

Support complaints increase simultaneously.

---

# **62\. Weak**

Issue resembles previous creative fatigue case.

---

# **63\. Anecdotal**

Team member says ads feel stale.

Puede ser útil.

No debe dominar.

---

# **64\. Evidence Independence**

Confidence aumenta más cuando:

independent evidence sources agree

---

# **65\. Example**

Payment logs  
Shopify order decline  
Customer complaints

son más valiosos juntos que:

three derived metrics from same tracking event

---

# **66\. Correlated Evidence**

Debe identificarse:

DEPENDENT\_EVIDENCE

para evitar inflar confianza.

---

# **67\. Evidence Count ≠ Evidence Strength**

Diez señales derivadas del mismo dato no implican:

10x confidence

---

# **68\. Evidence Diversity**

Puede valorar:

source diversity  
measurement diversity  
method diversity

---

# **69\. Contradiction Handling**

Las contradicciones nunca deben ocultarse.

---

# **72\. Material contradiction**

Ejemplo:

Hypothesis:

Global payment outage

Evidence:

80% payment methods operate normally.

Debe reducir mucho confidence.

---

# **73\. Decisive contradiction**

Ejemplo:

Hypothesis:

Deployment caused decline.

Pero decline empieza:

3 days before deployment.

Puede invalidar.

---

# **75\. Confidence and Alternatives**

D8 proporciona hipótesis competidoras.

D11 formaliza:

ALTERNATIVE\_SEPARATION

---

# **76\. Strong separation**

Primary:  
strong evidence

challenger:  
decisively contradicted

Confidence puede subir.

---

# **77\. Weak separation**

Primary:  
medium evidence

challenger:  
medium evidence

Confidence debe permanecer MEDIUM o LOW.

---

# **78\. Alternative Count itself does not lower confidence**

Si existen cinco alternatives pero cuatro están invalidadas, no hay problema.

---

# **79\. What matters**

strength of surviving alternatives

---

# **80\. Residual Uncertainty**

Aunque root cause esté bien identificada:

some impact may remain unexplained

---

# **82\. Complete cause confidence vs complete explanation**

Una causa puede tener HIGH confidence y explicar solo parte del problema.

---

# **83\. Example**

Stockout:  
HIGH-confidence cause

pero explica:

40% of revenue decline

Diagnosis completeness:

PARTIAL

---

# **85\. Confidence ≠ Completeness**

Puede existir:

confidence:  
HIGH

completeness:  
PARTIAL

---

# **86\. Another**

confidence:  
MEDIUM

completeness:  
COMPLETE\_ENOUGH

si una única explicación cubre casi todo pero falta confirmación causal definitiva.

---

# **90\. Example**

Question:

> ¿Por qué cayó revenue?

We know:

Revenue decline:  
HIGH

Conversion decline:  
HIGH

Root cause:  
LOW

Overall answer confidence:

LOW

para la pregunta "por qué".

---

# **91\. Same evidence, different question**

Question:

> ¿Está cayendo revenue?

Confidence:

HIGH

---

# **92\. Confidence is target-dependent**

Esto es crucial.

---

# **93\. Confidence Target**

Todo confidence object debe saber:

claim being evaluated

---

# **94\. No global confidence detached from claim**

---

# **111\. Example root cause HIGH rule**

Could require:

valid causal chain  
high data quality  
strong temporal fit  
strong scope fit  
serious alternatives rejected  
no material contradiction

---

# **112\. Constraint HIGH rule**

Could require:

target defined  
capacity limit observed  
binding relation demonstrated  
counterfactual plausible

---

# **113\. Impact HIGH rule**

Could require:

reliable counterfactual  
reliable exposure  
reliable business metric

---

# **114\. Severity HIGH confidence**

Puede existir aunque impact exacto sea MEDIUM.

Ejemplo:

checkout unavailable

No necesitamos saber € exactos para saber que es crítico.

---

# **117\. Repeated Pattern caution**

Histórico tenant-specific puede aumentar prior.

Pero no sustituye evidence actual.

---

# **119\. Example**

09:00 LOW  
09:20 MEDIUM  
10:00 HIGH

---

# **120\. Why confidence changed**

Debe registrarse.

---

# **121\. Example**

LOW → MEDIUM  
because payment errors identified.

MEDIUM → HIGH  
because rollback restored payment success.

---

# **126\. Confidence decay**

Algunas conclusiones pierden vigencia.

Ejemplo:

Inventory health HIGH confidence

hace 30 días.

Hoy puede no ser válido.

---

# **129\. Capability-dependent recency**

Payments:

minutes/hours

Finance:

days/weeks

Retention:

weeks/months

---

# **130\. Confidence decay is domain-specific**

---

# **131\. Uncertainty Materiality**

No toda incertidumbre importa igual.

---

# **133\. Low Materiality**

Ejemplo:

Exact onset uncertain by 20 minutes

cuando diagnosis no depende de esa precisión.

---

# **134\. High Materiality**

Unknown whether price changed

cuando evaluamos conversion decline.

---

# **135\. Critical Unknown**

Puede bloquear diagnosis.

Payment logs unavailable  
and two equally plausible causes remain.

---

# **138\. Resolvable Now**

Query transaction logs.

---

# **139\. With New Data**

Need missing COGS mapping.

---

# **140\. Over Time**

Need 60-day cohort repeat data.

---

# **141\. Not Resolvable**

Ejemplo:

Exact lost demand from competitor activity without control data.

---

# **144\. Example**

Problem detection:  
READY\_HIGH\_CONFIDENCE

Root cause:  
READY\_WITH\_LIMITATIONS

Brand impact:  
NOT\_READY

---

# **145\. Uncertainty Budget**

Conceptualmente:

how much unresolved uncertainty remains?

---

# **146\. No single opaque uncertainty score**

Mejor mostrar:

2 critical unknowns  
1 material contradiction  
1 challenger hypothesis

que:

uncertainty \= 37%

---

# **147\. Confidence Matrix**

Ejemplo:

| Claim | Confidence | Why |
| ----- | ----- | ----- |
| Revenue declined | High | Shopify source reconciled |
| Conversion decline | High | funnel metrics consistent |
| Payment stage affected | High | upstream stable, payment down |
| Payment config root cause | Medium | temporal fit, logs incomplete |
| Lost revenue estimate | Medium | counterfactual uncertainty |
| Severity critical | High | 82% checkout affected |

---

# **148\. Confidence Narrative**

Una respuesta excelente puede decir:

> La existencia del problema y su localización en pagos tienen confianza alta. La causa raíz tiene confianza media porque el cambio de configuración encaja temporalmente, pero todavía falta verificar los logs de autenticación. La severidad sí puede considerarse crítica con confianza alta porque el 82 % del checkout está expuesto, independientemente de cuál termine siendo la causa exacta.

Eso es D11 funcionando.

---

# **149\. No one-confidence-label summary**

Evitar:

> Confianza: 75%.

---

# **150\. Confidence by conclusion layer**

Debemos mantener:

WHAT:  
HIGH

WHERE:  
HIGH

WHY:  
MEDIUM

IMPACT:  
HIGH

ROOT:  
MEDIUM

---

# **151\. Confidence and User Language**

El lenguaje debe cambiar con confidence.

---

# **152\. HIGH language**

"La evidencia indica que..."

---

# **153\. MEDIUM language**

"La explicación más probable es..."

---

# **154\. LOW language**

"Existe una señal compatible con..."

---

# **155\. INSUFFICIENT language**

"Con la información disponible no puede determinarse..."

---

# **156\. Forbidden language**

No usar:

"Está claro que..."

cuando confidence no sea HIGH.

---

# **157\. Confidence-aware generation**

La capa de generación de lenguaje debe consumir:

confidence  
epistemic\_state

---

# **158\. UI confidence representation**

Podemos mostrar:

High confidence  
Medium confidence  
Low confidence  
Insufficient data

con explicación desplegable.

---

# **159\. Avoid traffic-light oversimplification**

No hacer simplemente:

green yellow red

sin contexto.

---

# **162\. Confidence Audit**

Ejemplo:

ROOT CAUSE CONFIDENCE:  
MEDIUM

UP:  
temporal match  
scope match  
mechanism strong

DOWN:  
payment logs incomplete  
fraud-rule alternative remains open

---

# **164\. Example**

Assumption:  
AOV would have remained €78 without outage

Confidence:  
MEDIUM

---

# **166\. Unknown baseline**

If baseline confidence LOW:

impact estimate confidence

cannot be HIGH.

---

# **172\. Deterministic Claims**

Algunas afirmaciones pueden ser prácticamente exactas.

Ejemplo:

Revenue \= €420,531

si source of truth es cerrado y fiable.

---

# **173\. But meaning remains uncertain**

Revenue \-18%

puede ser exacto.

Por qué:

uncertain

---

# **174\. Measurement uncertainty vs interpretive uncertainty**

Separar.

---

# **180\. Example complete confidence profile**

Measurement:  
HIGH

Signal:  
HIGH

Symptom:  
HIGH

Root Cause:  
MEDIUM

Constraint:  
HIGH

Current Impact:  
HIGH

Future Impact:  
MEDIUM

Overall Diagnostic Answer:  
MEDIUM

---

# **181\. Why overall medium?**

Porque pregunta:

why?

depende de root cause.

---

# **184\. High Severity \+ Low Root Confidence**

Ejemplo:

Orders:  
\-70%

Severity:  
CRITICAL

Root cause:  
LOW confidence

Representación correcta.

---

# **185\. Low Severity \+ High Confidence**

Ejemplo:

Minor email flow bug

Cause:

HIGH confidence

Severity:

LOW

---

# **186\. Confidence and Risk**

Un futuro riesgo puede ser:

potential severity:  
CRITICAL

likelihood confidence:  
LOW

---

# **187\. Do not collapse risk into certainty**

---

# **188\. Confidence Decay after context change**

Si:

price changed  
market changed  
campaign strategy changed

historical conclusions may become less applicable.

---

# **189\. Applicability Confidence**

Para knowledge/RAG:

APPLICABILITY\_CONFIDENCE

---

# **190\. General Rule vs Tenant Case**

RAG principle:

creative fatigue can reduce CTR

does not prove:

this store has creative fatigue

---

# **191\. Retrieval confidence ≠ diagnosis confidence**

Critical rule:

VECTOR\_SIMILARITY  
≠  
BUSINESS\_TRUTH

---

# **192\. RAG Retrieval Confidence**

Should be treated separately from:

case evidence confidence

---

# **193\. Source Authority**

Documents may have:

authority  
validity  
version

---

# **194\. Stale RAG document**

Should reduce:

knowledge applicability

not directly business metric reliability.

---

# **195\. General Expert Heuristic Confidence**

Can be:

LOW/MEDIUM prior support

unless verified against case.

---

# **196\. Never let authoritative tone override evidence**

---

# **202\. Example**

20 complaints mentioning shipping

Without knowing:

20 of how many orders?

cannot infer prevalence.

---

# **204\. Confidence by Granularity**

Global diagnosis may be HIGH.

Subsegment diagnosis may be LOW due small sample.

---

# **205\. Example**

Global payment issue:  
HIGH

Amex / France / mobile:  
LOW

---

# **206\. Fine-grained claims require sufficient data**

---

# **207\. Confidence and Time Window**

Different windows can yield different confidence.

---

# **208\. Short window**

1 hour

high confidence for payment outage.

Low for retention.

---

# **209\. Long window**

90 days

better for retention.

Could obscure short technical outage.

---

# **210\. Domain Appropriate Horizon**

Confidence should consider whether:

analysis window

matches phenomenon.

---

# **211\. Incorrect horizon downgrade**

Example:

7-day repeat conclusion from 2 days of cohort data

should be:

INSUFFICIENT

---

# **212\. Confidence and Maturity**

D3 maturity confidence can influence interpretation.

If stage uncertain:

stage-relative health judgment

should degrade.

---

# **213\. Example**

Retention sophistication insufficient for stage

cannot be HIGH if:

business stage itself uncertain

---

# **214\. Confidence and Business Complexity**

Complex businesses require broader evidence before global claims.

---

# **215\. Example**

Single-country store:

global claim easier

10-market store:

global claim requires broader coverage

---

# **216\. Coverage-adjusted confidence**

---

# **217\. Confidence and Structural Claims**

Claims like:

The organization is not prepared to scale.

are broad.

Require:

multiple capability evidence

---

# **218\. Broad claim evidence burden**

The broader the claim:

higher evidence requirement

---

# **219\. Specific claim**

Safari payment completion deteriorated after deployment.

can be HIGH with narrow evidence.

---

# **220\. Global claim**

Technology is the main problem of the business.

needs much more.

---

# **221\. Confidence Burden Principle**

CLAIM BREADTH ↑  
→  
REQUIRED EVIDENCE ↑

---

# **222\. Confidence and Novelty**

A novel pattern without historical analogues should generally start more cautiously.

---

# **223\. Novelty is not evidence against**

But:

less prior support

---

# **224\. Repeated tenant pattern**

Can increase prior plausibility.

---

# **225\. However current evidence remains required**

---

# **226\. Confidence and External Events**

External explanations are often hard to prove.

Example:

competition increased

needs:

external evidence

Not acceptable just because:

CPM rose.

---

# **227\. External Cause Confidence Cap**

If external phenomenon not observed:

LOW/MEDIUM

at most.

---

# **228\. Confidence and Hidden Variables**

Acknowledge:

unobserved variables may exist

especially in causal claims.

---

# **229\. Causal caution increases when observation is limited**

---

# **230\. Confidence of Negative Conclusions**

Saying:

> “No hay un problema de conversión.”

also needs evidence.

---

# **231\. Absence claim requires coverage**

If only homepage data exists:

cannot conclude conversion healthy.

---

# **232\. Negative Confidence**

Example:

No evidence of payment deterioration

is safer than:

Payment is healthy

when coverage partial.

---

# **233\. NO\_EVIDENCE vs EVIDENCE\_OF\_NO\_PROBLEM**

Separate.

---

# **234\. Example**

Payment data missing

→

NO\_EVIDENCE

---

# **235\. Payment data stable and complete**

→

EVIDENCE\_OF\_STABILITY

---

# **236\. Confidence in invalidation**

We also need confidence when rejecting hypotheses.

---

# **237\. Invalidation Confidence**

Example:

Auction inflation invalidated:  
HIGH confidence  
because CPM stable and complete.

---

# **238\. Weak invalidation**

Audience saturation unlikely:  
LOW confidence  
because frequency data partial.

---

# **239\. Reject vs deprioritize**

An hypothesis can be:

LESS\_SUPPORTED

without being:

INVALIDATED

---

# **240\. Confidence of Root Cause vs Confidence of Rejection**

Both useful.

---

# **242\. Example**

KNOWN:  
Revenue \-18%  
Payment success \-24%

HIGH:  
Problem localized to payment stage

MEDIUM:  
Payment configuration regression

LOW:  
Fraud rule interaction

UNKNOWN:  
Exact failing configuration parameter

---

# **243\. This is ideal for admin and user transparency**

---

# **244\. Diagnostic Certainty Ladder**

Could represent:

KNOWN  
↓  
STRONGLY\_SUPPORTED  
↓  
MOST\_LIKELY  
↓  
PLAUSIBLE  
↓  
UNKNOWN

Mapping to language.

---

# **245\. Avoid pretending every layer needs numeric scoring**

Categorical epistemic states are enough initially.

---

# **252\. Example**

Target:

> Why is contribution falling?

We know direct accounting drivers with HIGH confidence.

But upstream reasons MEDIUM.

Case confidence:

MEDIUM

if user asked "why".

---

# **255\. High-quality but partial data**

Can yield:

Evidence quality:  
HIGH

Sufficiency:  
PARTIAL

Confidence:  
MEDIUM

---

# **256\. Low-quality but broad data**

Coverage:  
HIGH

Reliability:  
LOW

Confidence:  
LOW

---

# **257\. Completeness vs Reliability**

Keep separate.

---

# **259\. Confidence Improvement Requirement**

Example:

To move MEDIUM → HIGH:  
validate payment authentication logs

---

# **262\. Useful for orchestrator**

It can decide whether another diagnostic query is worthwhile.

---

# **264\. Example**

Missing:

daily weather

for payment issue:

LOW value.

---

# **265\. Missing:**

3DS error code

HIGH value.

---

# **267\. Confidence Saturation**

Sometimes additional data will not materially increase confidence.

---

# **268\. Example**

Five more correlated ad metrics:

low incremental information

---

# **273\. Confidence and Cost of Error**

Even in diagnosis, claim wording should be more conservative where false certainty is costly.

---

# **274\. High-cost error domains**

Examples:

cash survival  
major inventory commitments  
critical platform outages

---

# **275\. Conservative reporting**

If severity high and evidence incomplete:

say:

> Hay indicios compatibles con X, pero la causa todavía no está suficientemente confirmada.

---

# **276\. Do not hide serious risk because confidence is low**

---

# **277\. Uncertainty Transparency**

User should understand:

what we know  
what we think  
what we do not know

---

# **278\. Three-Layer Summary**

Excellent default:

KNOWN

LIKELY

UNKNOWN

---

# **279\. Example**

KNOWN:  
Conversion fell 19%.

LIKELY:  
Payment-stage regression.

UNKNOWN:  
Whether the origin is provider config or fraud rules.

---

# **281\. Limitations must not be boilerplate**

No generic:

> “Data may be imperfect.”

Need specific limitation.

---

# **282\. Good limitation**

> Meta frequency is only available at ad-set level, so we cannot fully distinguish audience saturation from creative fatigue at asset level.

---

# **285\. Confidence in Positive Diagnosis**

Same rigor applies to good news.

Example:

CAC improving

Need enough persistence before saying:

sustained acquisition improvement

---

# **286\. Avoid celebrating noise**

---

# **287\. Positive improvement confidence**

Could be:

MEDIUM

until pattern persists.

---

# **288\. Confidence in Opportunity**

Opportunity claims often have lower certainty because counterfactual.

Example:

There may be additional scaling headroom.

not:

You can safely double spend.

---

# **297\. Example admin card**

ROOT CAUSE

Payment config regression

Confidence:  
MEDIUM

Positive factors:  
✓ same onset as config change  
✓ payment-stage localization  
✓ strong causal mechanism

Negative factors:  
✗ no authentication logs  
✗ fraud-rule alternative still open

To reach HIGH:  
validate error codes/config diff

---

# **299\. Example**

MEDIUM → HIGH

Reason:  
Rollback restored payment success.

---

# **303\. RAG Architecture**

Recommended chunks:

confidence\_principles

confidence\_levels

epistemic\_states

data\_uncertainty

context\_uncertainty

causal\_uncertainty

evidence\_strength

contradiction\_handling

confidence\_caps

claim\_specific\_confidence

confidence\_calibration

uncertainty\_invariants

Metadata:

phase:  
F3

block:  
D11

domain:  
confidence\_uncertainty

knowledge\_type:  
epistemic\_contract

---

# **337\. Example Final Result**

TARGET:  
Why has CAC increased?

PROBLEM:  
CAC deterioration  
Confidence HIGH

LOCATION:  
Meta prospecting / pre-click  
Confidence HIGH

SYMPTOM:  
Pre-click efficiency deterioration  
Confidence HIGH

ROOT CAUSE:  
Creative renewal deficit  
Confidence MEDIUM

CHALLENGER:  
Audience saturation  
Still open

CONSTRAINT:  
Creative supply  
Confidence MEDIUM

IMPACT:  
Contribution pressure  
Confidence HIGH

OVERALL DIAGNOSTIC CONFIDENCE:  
MEDIUM

CRITICAL UNKNOWN:  
Frequency by audience

TO REACH HIGH:  
Discriminate creative fatigue vs audience saturation

---

# **338\. User-facing version**

> Tenemos confianza alta en que el deterioro del CAC nace antes del clic y no en la conversión de la tienda. La causa raíz todavía tiene confianza media: el déficit de renovación creativa es actualmente la explicación mejor soportada, pero la saturación de audiencia sigue siendo una alternativa viable porque falta frecuencia desglosada por audiencia. Por tanto, podemos localizar el problema con bastante certeza, pero todavía no afirmar su causa última con el mismo grado de confianza.

---

# **339\. Another User-facing Example**

> La gravedad del problema está confirmada con confianza alta: los pedidos han caído más del 60 %. Sin embargo, todavía no existe evidencia suficiente para atribuir la causa raíz. La conclusión correcta en este momento es `INSUFFICIENT_DATA`, no una explicación especulativa.

---

# **340\. This is a feature, not a weakness**

Un buen sistema de diagnóstico debe poder decir:

I DON'T KNOW YET

cuando realmente no lo sabe.

---

# **343\. Principio final**

La inteligencia de un sistema de diagnóstico no se mide solo por cuántas causas es capaz de proponer.

También se mide por cuántas veces sabe decir:

ESTO LO SÉ.

ESTO ES LO MÁS PROBABLE.

ESTO SOLO ES POSIBLE.

ESTO NO LO PUEDO SABER TODAVÍA.

D11 convierte la incertidumbre en una parte explícita de la arquitectura.

Y eso evita uno de los principales fallos de cualquier consultor IA:

> **sonar más seguro de lo que la evidencia realmente permite.**

