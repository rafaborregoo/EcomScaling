D14 — CONTRATO DE SALIDA DIAGNÓSTICA, TRAZABILIDAD Y VALIDACIÓN

1\. Propósito operativo

D14 es la capa final de la Fase 3\. Su función es convertir el trabajo de D0–D13 en un objeto diagnóstico estructurado, validado, trazable, reproducible y consumible por usuario, administración, otros agentes y la Fase 4\.

D14 no decide prioridad, estrategia ni acción. Valida, empaqueta, versiona y entrega el diagnóstico.

2\. DIAGNOSTIC\_OUTPUT

Objeto diagnóstico canónico mínimo:  
DIAGNOSTIC\_OUTPUT  
diagnostic\_id  
case\_id  
version  
created\_at  
evaluated\_at  
scope  
target  
business\_context  
maturity\_context  
data\_quality  
observations  
signals  
symptoms  
hypotheses  
supporting\_evidence  
contradicting\_evidence  
confounders  
data\_gaps  
root\_cause  
constraint  
affected\_capabilities  
impact\_scope  
severity  
trajectory  
confidence  
uncertainty  
limitations  
alternative\_explanations  
diagnostic\_summary  
status  
temporal\_context  
false\_diagnosis\_risk  
robustness

Ningún campo obligatorio puede omitirse silenciosamente. Cuando no sea conocible debe expresarse mediante el estado epistemológico o de completitud correspondiente.

3\. DIAGNOSTIC\_RECORD

Metadatos mínimos del registro persistido:  
DIAGNOSTIC\_RECORD  
diagnostic\_id  
case\_id  
version  
tenant\_id  
business\_id  
source\_snapshots  
knowledge\_sources  
evidence\_ids  
model\_version  
prompt\_version  
contract\_version  
rules\_version  
created\_by  
created\_at  
supersedes  
superseded\_by

El registro final debe ser versionado y auditable. Una revisión posterior crea una nueva versión; nunca reescribe silenciosamente una conclusión histórica.

4\. Identidad, casos y versionado

DIAGNOSTIC\_ID identifica una evaluación diagnóstica concreta.  
CASE\_ID agrupa las versiones y revisiones del mismo episodio/caso cuando corresponda.

El sistema debe distinguir:  
DIFFERENT\_VERSION  
DIFFERENT\_CASE

Toda modificación material de root cause, constraint, severidad, confianza, trayectoria, alcance, confusores o conclusión final debe producir una versión nueva con motivo y evidencia del cambio.

5\. DIAGNOSTIC\_STATUS y transiciones

Estados mínimos:  
OPEN  
INVESTIGATING  
PARTIALLY\_CONFIRMED  
CONFIRMED  
RECOVERING  
CLOSED  
INCONCLUSIVE  
INSUFFICIENT\_DATA  
INVALIDATED

State machine base:  
OPEN → INVESTIGATING → PARTIALLY\_CONFIRMED → CONFIRMED → RECOVERING → CLOSED

Ramas permitidas cuando la evidencia no basta:  
INVESTIGATING → INCONCLUSIVE  
INVESTIGATING → INSUFFICIENT\_DATA

Una conclusión confirmada puede terminar en:  
CONFIRMED → INVALIDATED  
cuando nueva evidencia material contradice el diagnóstico previo.

Las transiciones deben registrar actor, timestamp, razón y evidencia.

6\. Supersession

Cuando una versión sustituye a otra debe persistirse:  
supersedes  
superseded\_by  
supersession\_reason  
supporting\_evidence

El historial no se elimina. Las versiones anteriores deben seguir disponibles para auditoría y comparación.

7\. Trazabilidad de evidencia

Toda afirmación diagnóstica material debe poder reconstruirse hasta evidencia concreta.

EVIDENCE\_ID identifica cada pieza de evidencia.

EVIDENCE\_ITEM mínimo:  
evidence\_id  
source  
source\_ref  
metric  
period  
scope  
value  
reliability  
used\_for  
transformations  
snapshot\_ref

EVIDENCE\_LEDGER debe mantener la relación entre:  
claim → evidence → source → transformation → snapshot.

La salida debe conservar supporting\_evidence y contradicting\_evidence. La evidencia contradictoria material no puede ocultarse.

8\. Causal trace

Toda root cause material debe poder enlazarse mediante una ruta causal reconstruible:  
ROOT CAUSE  
→ INTERMEDIATE NODES  
→ SYMPTOMS  
→ BUSINESS OUTCOME

CAUSAL\_PATH debe conservar los nodos, relaciones, evidencias y validaciones relevantes. Si no puede reconstruirse la relación causal con el nivel exigido por el estado diagnóstico, el diagnóstico debe degradarse o invalidarse.

9\. Audit Trail

El audit trail debe permitir reconstruir como mínimo:  
qué estado tenía el caso  
qué cambió  
cuándo cambió  
quién o qué componente produjo el cambio  
qué regla o validación intervino  
qué evidencia lo justificó  
qué versión fue sustituida  
qué salida se generó

No debe almacenarse ni exponerse chain-of-thought privado del modelo. La trazabilidad de razonamiento debe ser estructurada y verificable: hipótesis consideradas, evidencias utilizadas, contradicciones, reglas aplicadas, confusores y motivos de aceptación/rechazo.

10\. Source / Model / RAG trace

Cada diagnóstico final debe conservar las versiones relevantes de:  
data/source snapshots  
normalization version  
metric definitions  
rules version  
contract version  
model version  
prompt version  
RAG/knowledge version o referencias recuperadas

El sistema debe poder responder qué conocimiento de referencia se recuperó y qué evidencia del caso se utilizó, sin confundir ambos conceptos.

11\. Explainability Contract

La explicación final debe ser consistente con el objeto estructurado y no añadir afirmaciones nuevas sin soporte.

EXPLAINABILITY\_RECORD debe poder reconstruir:  
what happened  
where  
when  
why  
root cause  
constraint  
impact  
trajectory  
confidence  
main evidence  
contradicting evidence  
confounders  
limitations  
remaining uncertainty

EVIDENCE\_CAPSULE debe resumir de forma compacta las pruebas clave usadas para una afirmación material.

12\. Resúmenes obligatorios

LIMITATION\_SUMMARY debe recoger las limitaciones que reducen la validez o alcance de la conclusión.

CONFIDENCE\_SUMMARY debe reflejar el nivel de confianza y las razones principales que lo sostienen o limitan.

SEVERITY\_SUMMARY debe ser coherente con D10.

TEMPORAL\_SUMMARY debe ser coherente con D13.

CONFOUNDER\_SUMMARY debe ser coherente con D12.

DATA\_GAP\_SUMMARY debe registrar las ausencias de evidencia relevantes sin convertirlas en hechos negativos.

13\. Boundary de Fase 3

SEVERITY ≠ PRIORITY.  
La severidad pertenece al diagnóstico. La prioridad pertenece a Fase 4\.

D14 no puede recomendar acciones, seleccionar estrategias ni decidir allocation de recursos.

priority debe permanecer null/no calculada en Fase 3 salvo que llegue como contexto externo, en cuyo caso no puede presentarse como conclusión de D14.

14\. DIAGNOSTIC\_HANDOFF

Salida permitida hacia Fase 4:  
DIAGNOSTIC\_HANDOFF  
diagnostic\_id  
case\_id  
version  
diagnosed\_problem  
root\_cause  
constraint  
severity  
confidence  
trajectory  
robustness  
affected\_capabilities  
value\_at\_stake  
urgency\_signal  
hard\_constraints  
remaining\_uncertainty  
ready\_for\_prioritization

El handoff describe el problema diagnosticado. No incorpora la decisión de qué atacar primero.

15\. Diagnostic Completeness

Estados mínimos:  
COMPLETE  
COMPLETE\_WITH\_LIMITATIONS  
INCOMPLETE  
BLOCKED

DIAGNOSTIC\_COMPLETENESS debe indicar:  
status  
missing\_components  
blocking\_components  
limitations

Un diagnóstico puede ser completo con limitaciones si las limitaciones están explicitadas y no contradicen el nivel de certeza declarado.

16\. Validator Architecture

Antes de finalización deben ejecutarse validadores de:  
STRUCTURAL  
SEMANTIC  
CAUSAL  
EVIDENCE  
CONFIDENCE  
SEVERITY  
TEMPORAL  
CONFOUNDER  
SCOPE  
CONTRADICTION  
OUTPUT\_INTEGRITY

Resultados permitidos:  
VALID  
PASS\_WITH\_WARNINGS  
INVALID

VALIDATION\_ERROR debe bloquear la salida cuando compromete la integridad requerida.  
VALIDATION\_WARNING permite salida únicamente cuando la advertencia está explicitada y es compatible con el estado/confianza.

17\. DIAGNOSTIC\_VALIDATION\_RESULT

Salida mínima:  
DIAGNOSTIC\_VALIDATION\_RESULT  
diagnostic\_id  
version  
status  
errors  
warnings  
completeness  
ready\_for\_output

Reglas mínimas:  
\- CONFIRMED requiere root cause suficientemente soportada, evidencia trazable y confianza compatible.  
\- OPEN/INVESTIGATING pueden carecer de root cause confirmada.  
\- INSUFFICIENT\_DATA debe identificar qué evidencia falta.  
\- INVALIDATED debe conservar la versión/conclusión invalidada y el motivo.  
\- supporting\_evidence y contradicting\_evidence deben ser coherentes con la confianza final.  
\- severidad, trayectoria, confusores y confianza deben ser coherentes con D10–D13.

18\. Closure y Outcome Verification

Resolver una root cause no basta para cerrar un caso.

Puede utilizarse:  
CLOSED\_PENDING\_OUTCOME  
cuando la causa ha sido tratada pero todavía falta verificar el resultado empresarial esperado.

CLOSURE mínimo:  
resolved\_at  
outcome\_verified  
recovery\_status  
residual\_issues  
followup\_required  
confidence

CLOSED requiere outcome verification suficiente para el tipo de caso o una limitación explícita que justifique el cierre administrativo.

19\. Reopen y episodios nuevos

Un caso cerrado debe poder pasar a REOPENED cuando aparezca nueva evidencia material, recaída o contradicción.

REOPEN\_RECORD:  
reopened\_at  
reason  
new\_evidence  
previous\_version  
new\_version

Una recurrencia claramente independiente puede abrir un nuevo episodio/case en vez de reescribir el anterior. La decisión debe quedar trazada.

20\. Registry, History y Lineage

Debe existir un registro append-only de versiones diagnósticas.

SUPERSESSION\_GRAPH debe permitir seguir qué versión sustituye a cuál.

DIAGNOSTIC\_LINEAGE debe poder reconstruir la relación entre casos, versiones, snapshots, evidencias y revisiones.

Los cambios materiales nunca deben eliminar el estado histórico previo.

21\. DIAGNOSTIC\_SNAPSHOT

Todo diagnóstico final debe referenciar un snapshot reproducible de los datos y contexto usados.

DIAGNOSTIC\_SNAPSHOT mínimo:  
snapshot\_id  
diagnostic\_id  
case\_id  
version  
as\_of  
source\_versions  
data\_ranges  
normalization\_version  
metric\_definition\_versions  
knowledge\_refs  
rules\_version  
model\_version  
prompt\_version  
known\_issues

Late-arriving data, backfills o correcciones materiales deben generar una nueva evaluación/versionado, no modificar retrospectivamente la salida histórica sin rastro.

22\. DIAGNOSTIC\_REPRODUCIBILITY

Objeto mínimo:  
DIAGNOSTIC\_REPRODUCIBILITY  
diagnostic\_id  
version  
reproducible  
snapshot\_available  
sources\_resolvable  
rules\_version\_available  
knowledge\_refs\_resolvable  
model\_metadata\_available  
limitations

Una salida final no debe considerarse enterprise-grade si no puede explicarse y reproducirse suficientemente a partir de sus inputs/versiones.

23\. Tenant Isolation y Scope

Todo registro debe incluir tenant\_id y business\_id cuando aplique.

El sistema nunca puede mezclar:  
evidence  
snapshots  
tenant baselines  
historical diagnoses  
private knowledge  
entre tenants distintos.

Visibilidad mínima:  
INTERNAL  
ADMIN  
USER\_VISIBLE

El acceso a datos de diagnóstico debe respetar roles/permisos y el scope del tenant.

24\. Admin Observability

El panel administrativo debe permitir inspeccionar:  
diagnostic\_id  
case\_id  
version  
status  
completeness  
validation status  
errors  
warnings  
sources  
snapshots  
evidence ledger  
root cause  
constraint  
severity  
confidence  
trajectory  
confounders  
limitations  
model/prompt/rules/RAG versions  
supersession history  
reopen history  
finalization status

También debe poder verse la diferencia entre versiones y por qué cambió una conclusión.

25\. User vs Admin vs Machine Output

USER\_DIAGNOSTIC\_OUTPUT mínimo:  
summary  
root\_cause  
impact  
status  
confidence  
confidence\_language  
what\_we\_know  
what\_we\_dont\_know  
limitations

USER\_CONFIDENCE\_LANGUAGE:  
HIGH  
MEDIUM  
LOW  
INSUFFICIENT\_DATA

La interfaz puede simplificar, pero no puede alterar el significado del objeto interno ni convertir una confianza limitada en lenguaje categórico.

ADMIN\_DIAGNOSTIC\_OUTPUT debe conservar el detalle técnico necesario para auditoría.

MACHINE\_DIAGNOSTIC\_OUTPUT debe ser estructurado, tipado, versionado y estable para consumo multiagente.

La simplificación de la UI nunca puede eliminar los campos estructurados internos.

26\. Knowledge vs Evidence Boundary

CASE\_EVIDENCE \= datos, eventos y documentos del caso concreto.  
REFERENCE\_KNOWLEDGE \= doctrina, patrones, benchmarks/contexto y conocimiento recuperado por RAG.  
RULES\_ENGINE \= reglas deterministas/contractuales.

REFERENCE\_KNOWLEDGE no se convierte por sí mismo en CASE\_EVIDENCE.  
Un patrón recuperado por similitud no demuestra que ese patrón ocurra en el negocio analizado.

DIAGNOSTIC\_REFERENCE\_RECORD mínimo:  
reference\_id  
source\_ref  
knowledge\_type  
retrieval\_context  
used\_for  
applicability  
version

27\. Consistency, Diff y Manual Review

DIAGNOSTIC\_DIFF debe registrar diferencias materiales entre versiones.

MANUAL\_REVIEW\_REQUIRED debe poder activarse cuando existan, por ejemplo:  
conflicto fuerte entre agentes  
validación semántica irresoluble  
high-confidence contradiction  
material tenant-sensitive ambiguity  
caso fuera de cobertura contractual

Las correcciones humanas deben quedar versionadas y atribuidas; nunca sobrescribirse sin rastro.

28\. Multi-agent Compatibility y Arbitration

Los agentes deben intercambiar objetos tipados y versionados, no narrativas ambiguas como contrato de integración.

Ningún agente puede sobrescribir silenciosamente la conclusión de otro. Los conflictos deben producir un resultado explícito de arbitraje/revisión.

ARBITRATION\_RESULT debe poder registrar:  
claims\_in\_conflict  
agents\_or\_sources  
resolution  
supporting\_evidence  
remaining\_disagreement  
confidence\_effect

29\. Observability Metrics

El sistema debe poder medir como mínimo:  
diagnostic\_completion\_rate  
validation\_failure\_rate  
reopen\_rate  
invalidated\_diagnosis\_rate  
insufficient\_data\_rate  
confidence\_distribution  
high\_confidence\_error\_rate  
unsupported\_high\_confidence\_rate  
manual\_review\_rate  
reproducibility\_rate

Puede mantenerse un Diagnostic Reliability Index (DRI) como métrica de observabilidad/calibración, sin presentarlo automáticamente al usuario como probabilidad exacta de verdad.

30\. Calibration y QA

La calidad diagnóstica debe evaluarse por buckets de confianza y tipos de diagnóstico.

La calibración debe comprobar si los resultados HIGH/MEDIUM/LOW se corresponden con la tasa real de acierto observada en casos evaluables.

QA debe incluir:  
semantic consistency  
cross-field consistency  
version consistency  
output/schema consistency  
causal/evidence consistency

31\. Evals

EVAL\_CASE mínimo:  
eval\_case\_id  
input\_fixture  
expected\_behavior  
forbidden\_behavior  
expected\_status  
expected\_confidence\_range  
required\_evidence\_behavior  
notes

EVAL\_RESULT mínimo:  
eval\_case\_id  
model\_version  
prompt\_version  
rules\_version  
RAG\_version  
schema\_version  
result  
passed  
failures  
warnings

La suite de evals debe cubrir:  
correct diagnoses  
insufficient-data cases  
contradictory evidence  
confounders  
false positives  
false negatives  
version changes  
schema changes  
RAG changes  
model/prompt changes  
multi-agent conflicts  
privacy/tenant isolation  
phase-boundary violations

EVAL\_SET\_VERSION debe ser versionado e inmutable para comparar releases.

32\. Release Gate

Un cambio de modelo, prompts, reglas, RAG, schemas o contratos debe poder bloquearse si degrada materialmente los evals críticos.

Estados mínimos:  
RELEASE\_ALLOWED  
RELEASE\_BLOCKED

Los casos sintéticos/edge cases pueden complementar, pero no sustituir, los casos de regresión representativos.

33\. Error Taxonomy

DIAGNOSTIC\_ERROR tipos mínimos:  
DATA\_ERROR  
SYSTEM\_ERROR  
REASONING\_FAILURE  
VALIDATION\_FAILURE  
TIMEOUT

Debe distinguirse un diagnóstico inválido por evidencia insuficiente de un fallo técnico del sistema.

El sistema debe poder producir un failure/degraded result explícito sin fingir una conclusión empresarial.

34\. Atomicity, Idempotency y Retry

La persistencia final debe ser atómica respecto al record/version que se declara final.

Una operación interrumpida no puede dejar una salida marcada como final si faltan evidencias, validación o metadatos requeridos.

Las escrituras deben ser idempotentes cuando se reintenten con la misma identidad de operación.

Los retries no pueden duplicar diagnósticos, evidencias, eventos o versiones.

35\. Timeout y Degraded Output

Un timeout debe registrarse explícitamente y no convertirse en una respuesta parcial presentada como diagnóstico completo.

DEGRADED\_OUTPUT puede utilizarse cuando existe información útil pero faltan componentes no bloqueantes. Debe mostrar warnings, limitaciones y readiness real.

FAILURE\_RESULT debe permitir distinguir el fallo técnico de INSUFFICIENT\_DATA o INCONCLUSIVE.

36\. Privacy, Sensitive Fields y Retention

La salida debe aplicar minimización de datos y evitar exponer PII o información sensible innecesaria.

Los campos internos sensibles no deben trasladarse automáticamente a USER\_DIAGNOSTIC\_OUTPUT.

La política de retention/deletion debe poder aplicarse a registros, snapshots, evidencias y logs según clasificación y obligaciones aplicables, preservando solo lo permitido/necesario.

37\. Telemetry y Tracing

Cada ejecución debe disponer de TRACE\_ID.

Los spans pueden cubrir:  
data fetch  
normalization  
retrieval  
rules evaluation  
agent calls  
validation  
persistence  
formatting

Los logs técnicos y los eventos de negocio/diagnóstico deben mantenerse conceptualmente separados. La telemetría no sustituye al audit trail diagnóstico.

38\. DIAGNOSTIC\_FINALIZATION\_GATE

Antes de emitir una salida final deben cumplirse o evaluarse explícitamente:  
data\_gate\_valid  
context\_valid  
stage\_valid  
hypothesis\_review\_completed  
root\_cause\_condition\_satisfied  
confounder\_review\_completed  
severity\_computed  
confidence\_calibrated  
temporal\_review\_completed  
traceability\_complete  
validation\_passed  
phase\_boundary\_respected

Si el gate no se satisface, la salida no puede marcarse como FINALIZED\_VALID.

Estados mínimos:  
FINALIZED\_VALID  
INVALID\_OUTPUT

39\. D14\_RESULT

Salida contractual final:  
D14\_RESULT  
diagnostic\_id  
case\_id  
version  
tenant\_id  
finalization\_status  
validation\_status  
completeness\_status  
traceability\_status  
reproducibility\_status  
user\_output\_ready  
admin\_output\_ready  
machine\_output\_ready  
handoff\_ready  
errors  
warnings  
final\_record\_ref

DIAGNOSTIC\_OUTPUT contiene la conclusión empresarial estructurada.  
D14\_RESULT contiene el resultado del proceso de validación/finalización de esa conclusión. No deben confundirse.

40\. Definition of Done

D14 está correctamente construido cuando puede responder de forma trazable:  
¿Existe un diagnóstico canónico y versionado?  
¿Puedo reconstruir cada claim material hasta su evidencia?  
¿Puedo identificar las fuentes, snapshots y versiones utilizadas?  
¿La causalidad propuesta está trazada?  
¿La evidencia contradictoria está preservada?  
¿Las limitaciones e incertidumbre están explícitas?  
¿La severidad coincide con D10?  
¿Los confusores coinciden con D12?  
¿La trayectoria y temporalidad coinciden con D13?  
¿El nivel de confianza es coherente con D11 y los caps previos?  
¿El output ha superado validación estructural, semántica, causal y de integridad?  
¿El diagnóstico puede reproducirse suficientemente?  
¿Existe aislamiento correcto por tenant?  
¿La salida de usuario no expone detalle interno innecesario?  
¿La salida administrativa conserva trazabilidad completa?  
¿La salida máquina es estable y tipada?  
¿Los conflictos multiagente quedan registrados?  
¿Los cambios crean nuevas versiones en vez de mutar el historial?  
¿El caso cerrado tiene outcome verification o cierre limitado explícito?  
¿El handoff hacia Fase 4 respeta el límite diagnóstico?  
¿La suite de evals permite detectar regresiones del sistema?  
¿El finalization gate ha sido satisfecho?

41\. Invariantes de D14

El sistema nunca debe:  
\- emitir como final un diagnóstico no validado;  
\- perder la procedencia de una evidencia material;  
\- ocultar evidencia contradictoria material;  
\- ocultar limitaciones que afecten la interpretación;  
\- marcar CONFIRMED sin soporte compatible;  
\- mutar silenciosamente diagnósticos históricos;  
\- cerrar un caso solo porque la root cause fue modificada;  
\- confundir REFERENCE\_KNOWLEDGE con CASE\_EVIDENCE;  
\- convertir retrieval similarity en prueba del caso;  
\- mezclar información entre tenants;  
\- exponer trazas internas sensibles al usuario final;  
\- exponer chain-of-thought privado como mecanismo de auditoría;  
\- presentar un score numérico de confianza como probabilidad exacta si no está calibrado como tal;  
\- permitir que un agente sobrescriba silenciosamente a otro;  
\- perder el historial de supersession/reopen;  
\- producir una salida final sin referencia suficiente al snapshot/versiones que la originaron;  
\- duplicar resultados por retries;  
\- confundir fallo técnico con diagnóstico empresarial;  
\- degradar silenciosamente una salida por timeout o error parcial;  
\- usar D14 para recomendar acciones;  
\- usar D14 para decidir prioridades;  
\- usar D14 para seleccionar estrategias;  
\- saltarse la validación por querer producir una respuesta completa;  
\- preferir una narrativa convincente a un registro incompleto pero fiel a la evidencia.

Principio de cierre: el resultado de Fase 3 no es simplemente una respuesta plausible. Es un objeto diagnóstico auditable, versionado, reproducible y preparado para que Fase 4 tome decisiones sin tener que reconstruir ni adivinar cómo se obtuvo la conclusión.  
