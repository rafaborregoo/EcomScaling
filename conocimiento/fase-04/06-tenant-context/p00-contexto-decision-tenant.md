# Fase 04 · P00 — Tenant context de priorización

## Propósito

La prioridad pertenece al problema + contexto + tiempo + objetivos + dependencias + constraints + risk + available options.

Por tanto, P00 necesita un contexto específico por tenant.

---

## 1. Objective Context

Debe poder contener:

- business objectives[];
- protected outcomes[].

Ejemplos conceptuales:
- cash preservation;
- contribution growth;
- revenue expansion.

Si falta:
- `OBJECTIVE_CONTEXT_MISSING`.

No asumir “maximize revenue”.

---

## 2. Current Constraints

Contexto sobre:
- current constraints[];
- binding/structural limitations;
- constraint relevance to current horizon.

Un current constraint no se convierte automáticamente en rank #1.

---

## 3. Resource Context

Puede incluir disponibilidad/escasez de:

- time;
- management attention;
- cash;
- team capacity;
- engineering;
- creative;
- inventory;
- operational bandwidth.

---

## 4. Risk Context

Debe poder representar:
- current risks;
- protected outcomes;
- survival/continuity concerns;
- forward damage;
- critical exposure.

---

## 5. Maturity Context

Referencia al maturity snapshot de F3.

La madurez puede cambiar feasibility y dependency reasoning.

---

## 6. Known Commitments

Puede contener:
- contractual commitments;
- launches;
- deadlines;
- strategic initiatives;
- operational commitments.

---

## 7. Hard Guardrails

Contexto crítico:
- survival;
- security;
- legal/compliance integrity;
- financial integrity;
- business continuity.

Los objetivos ordinarios no los invalidan.

---

## 8. Decision Horizon

Debe existir un horizonte:
- IMMEDIATE;
- DAYS;
- WEEKS;
- MONTH;
- QUARTER;
- LONG_TERM.

El ranking puede variar por horizonte.

---

## 9. Business Context Reference

P00 referencia:
- business_context_ref.

El detalle del business context viene de capas previas/tenant context.

---

## 10. Maturity Snapshot Reference

P00 consume:
- maturity_snapshot_ref.

No reconstruye maturity.

---

## 11. Diagnostic Snapshot

P00 consume:
- diagnostic_snapshot_id;
- diagnostic_candidates[].

No rediagnostica el negocio.

---

## 12. Evidence Availability

Puede incluir:
- available_evidence_refs[].

La disponibilidad de evidence condiciona:
- decision confidence;
- validation need;
- assessability.

---

## 13. Critical Path

Según modelo del tenant pueden variar:
- transaction-critical capabilities;
- continuity dependencies;
- hard prerequisites.

---

## 14. Dependency Context

Puede existir:
- prerequisite relation;
- blocker;
- mandatory dependency.

Estas relaciones pueden alterar el order.

---

## 15. Available Options

La prioridad depende también de las opciones actuales.

La fuente reconoce conceptualmente:
- available options;
- reversibility;
- option value.

P00 no define catálogo técnico de opciones.

---

## 16. Decision Risk / Reversibility Context

La misma incertidumbre puede tratarse de forma diferente según:
- reversibility;
- cost of being wrong;
- irreversibility horizon.

---

## 17. Context Freshness

Todo decision result debe tener:
- `as_of`.

La prioridad no debe reutilizarse como verdad permanente.

---

## 18. Exclusiones

No pertenecen a tenant-context:
- definición universal de priority;
- canonical enums;
- invariants;
- current decision queue;
- decision trace completo;
- historical ranking ledger.
