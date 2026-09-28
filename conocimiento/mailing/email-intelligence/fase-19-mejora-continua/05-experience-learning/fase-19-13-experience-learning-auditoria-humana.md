# Fase 19.13 — Auditoría humana

## Tipo de artefacto
`05-experience-learning`

## Objetivo

La auditoría humana revisa periódicamente el sistema de aprendizaje para evitar deriva, generalizaciones erróneas o contaminación del conocimiento.

Debe revisar:
- promoción;
- deprecación;
- confidence;
- evidencia contradictoria;
- aprendizajes de alto impacto;
- privacidad;
- cross-tenant leakage;
- reglas que afectan autonomía.

La revisión humana no sustituye al pipeline; es una capa de gobernanza.

---

## Flujo de aprendizaje

```text
RESULT
→ NORMALIZE
→ OBSERVE
→ HYPOTHESIZE
→ TEST / VALIDATE
→ EVIDENCE
→ LEARNING
→ PROMOTE / DEPRECATE
→ REVIEW
```

---

## Reglas

- conservar contexto;
- conservar evidence lineage;
- separar correlación y causalidad;
- expresar scope;
- expresar confidence;
- mantener contradicciones;
- no borrar resultados negativos;
- no convertir un resultado aislado en regla universal.

---

## Principio maestro

El sistema mejora cuando transforma resultados en conocimiento trazable, no cuando acumula más datos.
