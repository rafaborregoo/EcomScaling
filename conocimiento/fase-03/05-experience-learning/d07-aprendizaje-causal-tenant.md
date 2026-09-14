# Fase 03 · D07 — Experience & Learning causal

## Propósito

D7 contiene aprendizaje real cuando la plataforma acumula evidencia causal específica de un tenant.

El objetivo no es reescribir automáticamente el grafo global, sino conservar y fortalecer relaciones locales respaldadas por outcomes, controles o experimentos.

---

## 1. Tenant Learned Relations

La fuente contempla relaciones aprendidas específicamente para una marca.

Ejemplo conceptual:

`TV Appearance → Branded Search Spike after 2h`

Este conocimiento pertenece al tenant y puede ser útil en diagnósticos posteriores.

---

## 2. Experiment-derived Learning

Si un experimento demuestra:

`New PDP → CVR +8 %`

puede almacenarse una relación tenant-specific con evidencia de alta calidad.

Debe conservarse:

- intervention;
- treated scope;
- control;
- before/after;
- outcome;
- effect;
- confidence.

---

## 3. Natural Experiment Memory

También pueden conservarse experiencias como:

- rollout solo en un mercado;
- cambio solo en un dispositivo;
- proveedor alternativo;
- segment exposure diferencial.

Estas experiencias ayudan a reforzar o debilitar edges locales.

---

## 4. Edge Evidence History

Una relación tenant-specific puede acumular:

- supporting cases;
- contradicting cases;
- experiments;
- natural experiments;
- multi-source corroboration;
- correlation-only episodes.

---

## 5. Case Outcome Memory

Cada causal investigation puede conservar:

- target;
- paths considered;
- paths rejected;
- final validated explanation cuando exista;
- observed outcome;
- recovery/effect.

---

## 6. Learning from Success

No solo se aprenden fallos.

También:

`Creative Winner → CTR ↑ → CPC ↓ → CAC ↓ → Contribution ↑`

puede convertirse en experiencia útil si la evidencia del tenant lo soporta.

---

## 7. Causal Path Recurrence

Con suficiente historia puede observarse:

- qué paths se repiten;
- cuáles resultan falsos;
- qué lags son típicos;
- qué nodes son frecuentemente relevantes.

Esto puede ajustar priors tenant-specific en fases posteriores.

---

## 8. Expected Lag Learning

El tenant puede aprender lags propios.

Ejemplos:

- influencer campaign → direct traffic after N hours;
- cohort quality shift → repeat change after N days.

No deben generalizarse automáticamente.

---

## 9. Scope-specific Learning

Una relación puede ser válida solo para:

- market;
- channel;
- SKU;
- device;
- customer type.

La memoria debe conservar scope.

---

## 10. Edge Confidence Evolution

Con nueva evidencia puede cambiar:

- tenant edge confidence;
- expected lag;
- expected sign;
- conditions.

No significa que el edge global deba cambiar.

---

## 11. Contradictory Learning

La memoria también debe conservar:

- failed hypotheses;
- contradicted relations;
- cases where expected downstream effects did not occur.

Esto evita confirmation bias.

---

## 12. Boundaries

D07 no define todavía:

- automatic global graph mutation;
- cross-tenant promotion;
- decay;
- federated causal learning;
- reinforcement;
- autonomous interventions.

Estos mecanismos requieren fases posteriores.
