# Fase 03 · D11 — Experience & Learning de confianza

## Propósito

D11 genera memoria útil para calibrar cómo cambia la confianza de las conclusiones, qué evidencias realmente discriminan y dónde el sistema suele sobreestimar o subestimar certainty.

---

## 1. Confidence History

Debe conservar por claim:

- initial confidence;
- updates;
- evidence added;
- contradictions discovered;
- final confidence;
- reason for each transition.

---

## 2. Confidence Calibration

Puede compararse posteriormente:

- predicted confidence;
- eventual validation/invalidation;
- false certainty;
- excessive caution.

Esto permite F9 calibration.

---

## 3. Evidence Value Learning

Puede aprenderse qué evidence types suelen mover realmente confidence.

Ejemplo:
- 3DS logs;
- rollback;
- device split;
- independent source reconciliation.

---

## 4. Information Gain History

Puede registrarse:
- evidence requested;
- confidence before;
- confidence after;
- branches eliminated;
- incremental diagnostic value.

---

## 5. Confidence Saturation Learning

El sistema puede aprender qué queries añaden poco valor por ser redundantes.

No debe generalizarse automáticamente entre tenants.

---

## 6. Domain-specific Freshness

Histórico puede ayudar a conocer cuánto dura la validez práctica de:
- payments evidence;
- finance evidence;
- retention evidence;
- inventory evidence.

La fuente exige decay domain-specific, no una fórmula global.

---

## 7. Historical Applicability

Cuando context cambia, puede observarse qué conclusions históricas dejaron de ser aplicables.

---

## 8. Tenant-specific Priors

Repeated patterns pueden elevar prior plausibility.

Pero evidence actual siempre sigue siendo necesaria.

---

## 9. Invalidation Learning

Debe conservarse:
- hypotheses rejected;
- invalidation confidence;
- decisive evidence;
- later outcome.

Esto ayuda a detectar invalidaciones débiles o demasiado agresivas.

---

## 10. Uncertainty Resolution History

Puede registrar:
- critical unknown;
- how it was resolved;
- time/cost;
- whether it changed diagnosis.

---

## 11. Forecast / Impact Confidence Calibration

Comparar:
- projected impact;
- confidence;
- realized outcome.

Permite calibrar impact uncertainty sin inventar probability models.

---

## 12. Positive Diagnosis Calibration

También debe medirse si “mejoras” inicialmente reportadas se sostuvieron o eran noise.

---

## 13. Agent / System Calibration

F9 puede estudiar:
- overconfidence;
- underconfidence;
- confidence by claim type;
- calibration by agent/domain;
- frequency of INSUFFICIENT_DATA;
- false confirmations.

---

## 14. Known/Unknown Learning

Puede observarse qué tipos de unknowns aparecen recurrentemente y qué integrations/data gaps los generan.

Esto puede orientar mejoras estructurales futuras.

---

## 15. Boundaries

D11 no define:
- automatic retraining;
- Bayesian numeric updating;
- cross-tenant promotion;
- automatic confidence formula;
- reinforcement learning;
- business actions.

Es memoria de calibración para fases posteriores.
