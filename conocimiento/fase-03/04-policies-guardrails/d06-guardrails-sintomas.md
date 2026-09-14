# Fase 03 · D06 — Policies y guardrails del motor de síntomas

## Separaciones fundamentales

1. **SIGNAL ≠ SYMPTOM.**
2. **SYMPTOM ≠ HYPOTHESIS.**
3. **SYMPTOM ≠ CAUSE.**
4. **SYMPTOM ≠ CONSTRAINT.**
5. **SYMPTOM ≠ HEALTH.**
6. **SYMPTOM ≠ MATURITY GAP.**
7. **SYMPTOM ≠ PRIORITY.**
8. **SYMPTOM ≠ RECOMMENDATION.**

---

## Coherencia

9. No crear un síntoma solo porque varias señales ocurran simultáneamente.
10. Exigir relación temporal, funcional, matemática, funnel, económica u operacional.
11. Exigir scope compatible.
12. Exigir signal quality suficiente.
13. Preservar evidence contradictoria.

---

## Causalidad

14. No convertir “compatible con” en “causado por”.
15. Pre-click deterioration no equivale a creative fatigue.
16. Post-deployment regression no identifica automáticamente el componente responsable.
17. Event timing no prueba causalidad.
18. Candidate relations (`may_precede`, `may_follow`, `often_cooccurs`) no son edges causales confirmados.

---

## Contexto

19. D2 debe poder corregir patrones que cambian por mix, promotion, price, launch o audience composition.
20. No generar creative deterioration si el patrón se explica mejor como audience mix response change.
21. La valencia de un síntoma debe ser contextual.
22. CAC ↑ no significa automáticamente síntoma negativo.

---

## Scope

23. No generalizar un síntoma localizado al negocio global.
24. No ocultar síntomas locales porque el agregado esté estable.
25. Usar la granularidad más específica que la evidencia soporte.
26. No crear especificidad que los datos no permitan.

---

## Granularidad

27. Evitar síntomas demasiado amplios como “sales problem”.
28. Evitar síntomas excesivamente específicos sin logs/evidencia.
29. El objetivo es máxima diagnostic utility compatible con confidence.

---

## Narrativa

30. No forzar una única narrativa cuando existen síntomas independientes.
31. Permitir coexistencia de síntomas positivos, negativos y mixtos.
32. No cancelar un síntoma económico negativo por un síntoma comercial positivo.

---

## Evidence

33. D1 limita qué señales pueden utilizarse.
34. No elevar un cluster débil a síntoma fuerte.
35. Evidencia textual debe considerar representatividad y calidad.
36. Un histórico similar no confirma el mismo mecanismo actual.

---

## Positive symptoms

37. Detectar patrones positivos además de fallos.
38. No interpretar mejora como causa confirmada.
39. Localizar la mejora al scope real.

---

## Health y maturity

40. D4 health es estado; D6 symptom es patrón observable.
41. Un maturity gap de D3 no es un síntoma.
42. Una capability HEALTHY puede presentar un leading symptom de riesgo.

---

## Downstream

43. Outcome symptoms deben impulsar investigación hacia upstream.
44. No detener el diagnóstico en ROAS decline, revenue decline o cash pressure si existe evidencia para descomponer.
45. Un deeper symptom sigue sin ser necesariamente root cause.

---

## Actions

46. No almacenar reglas doctrinales como “CTR ↓ → crear anuncios”.
47. D6 no prescribe acciones.
48. D6 no prioriza qué síntoma atacar primero.
