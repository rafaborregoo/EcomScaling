# Fase 15.7 — Policy Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Policy Context selecciona las políticas y guardrails aplicables a una tarea concreta.

Puede incluir:
- legal;
- provider;
- compliance;
- claims;
- margin;
- discount;
- autonomy;
- privacy;
- frequency;
- suppression.

No debe cargar todo el repositorio de políticas.

Debe resolver versión por:
- scope;
- jurisdiction;
- provider;
- effective_at;
- action type.

Las políticas hard deben marcarse claramente.

---

## Entradas conceptuales

- `task_type`
- `action_type`
- `market`
- `provider`
- `timestamp`
- `tenant_policy_refs`
- `global_policy_registry`

---

## Salidas conceptuales

- `applicable_policies`
- `hard_rules`
- `soft_rules`
- `policy_versions`
- `unresolved_policy_gaps`

---

## Pipeline general

```text
REQUEST
→ RESOLVE REQUIRED DATA
→ FETCH AUTHORITATIVE SOURCES
→ CHECK FRESHNESS
→ NORMALIZE
→ APPLY POLICIES
→ ASSEMBLE / ROUTE / VALIDATE
→ VERSIONED OUTPUT
```

---

## Invariantes

- tenant isolation;
- source lineage;
- versionado;
- data minimization;
- no inventar campos ausentes;
- estados `UNKNOWN` explícitos;
- conflictos críticos visibles;
- mismas entradas + misma configuración = mismo resultado estructural;
- el LLM no redefine la autoridad de las fuentes.

---

## Observabilidad

El sistema debe poder responder:

```text
qué fuente se usó
por qué se eligió
qué versión tenía
qué tan fresca era
qué se omitió
qué conflicto apareció
qué policy se aplicó
```

---

## Principio maestro

El contexto no es un prompt gigante.

Es una construcción controlada, versionada y trazable de la información mínima necesaria para una tarea.
