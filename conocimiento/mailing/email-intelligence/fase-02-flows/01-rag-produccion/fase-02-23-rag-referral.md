# Fase 2.23 — Referral

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Referral invita a clientes adecuados a recomendar la marca a otras personas.

La oportunidad es más sólida cuando existe satisfacción, repetición, review positiva o relación estable. La recompensa, si existe, debe ser clara y coherente.

Referral no es simplemente enviar un código a toda la base. Debe distinguir invitación, generación del referral y conversión atribuida.

Antipatrones: pedir referral a cualquiera, incentivos confusos, presión excesiva, atribución defectuosa y mezclar referral con spam.

---

## Marco de decisión

La IA debe razonar:

```text
opportunity
+
customer lifecycle
+
current state
+
recency
+
operational context
+
other active flows
+
contact pressure
→ next best action
```

---

## Preguntas clave

```text
¿Qué evidencia justifica este flow?
¿Sigue vigente?
¿Qué ocurrió después?
¿Existe una condición de salida?
¿Existe otro flow superior?
¿El cliente está saturado?
¿Tenemos los datos necesarios?
¿Debemos enviar, esperar, cambiar de rama o terminar?
```

---

## Principio maestro

La automatización solo debe continuar mientras su objetivo siga siendo relevante y compatible con la experiencia global.
