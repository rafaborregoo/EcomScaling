# Fase 2.31 — Sunset

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Sunset reduce o detiene marketing para contactos persistentemente desengaged cuando el coste de seguir enviando supera el valor esperado.

Protege atención, calidad de lista y deliverability. No debe verse como castigo ni como simple limpieza de base.

Puede existir una última oportunidad razonable de re-engagement antes de la supresión, según estrategia.

La reactivación posterior debe depender de señales válidas.

Antipatrones: mantener contactos por vanity metrics, sunset demasiado agresivo, basarse solo en opens, reactivar automáticamente sin evidencia.

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
