# Fase 2.22 — UGC Request

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

UGC Request busca contenido generado por clientes cuando existen señales razonables de satisfacción y afinidad.

Puede apoyarse en review positiva, repetición, uso demostrado o interacción voluntaria. Debe explicar claramente qué se solicita y cómo se pretende utilizar el contenido cuando corresponda.

La solicitud no debe confundir participación voluntaria con obligación ni asumir que una compra implica autorización para reutilizar contenido.

Antipatrones: pedir UGC demasiado pronto, solicitarlo a clientes con incidencias, presión repetida, reutilizar contenido sin la autorización requerida.

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
