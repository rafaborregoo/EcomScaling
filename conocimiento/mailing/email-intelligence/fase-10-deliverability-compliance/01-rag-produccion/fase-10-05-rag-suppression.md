# Fase 10.5 — Suppression

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Suppression bloquea comunicaciones dentro de un ámbito definido.

Puede originarse por:
- unsubscribe;
- complaint;
- hard bounce;
- sunset;
- policy;
- restricción operativa.

La supresión es más fuerte que una exclusión puntual.

Debe preservarse incluso cuando cambia la segmentación.

Antipatrones: eliminar la evidencia de suppression, reactivar por importación, crear listas paralelas para saltarla o confundir suppression con borrar todos los datos del cliente.

---

## Marco de razonamiento

La IA debe separar:

```text
LEGAL / PROVIDER REQUIREMENT
+
TECHNICAL STATE
+
SENDER REPUTATION
+
AUDIENCE QUALITY
+
MESSAGE TYPE
+
ENGAGEMENT
→ DELIVERABILITY / COMPLIANCE INTERPRETATION
```

---

## Principios

- autenticación no sustituye calidad de lista;
- buena creatividad no compensa una mala reputación;
- marketing y transaccional deben clasificarse correctamente;
- suppressions y complaints son restricciones fuertes;
- datos externos cambiantes requieren versionado;
- no inferir cumplimiento cuando faltan evidencias;
- `UNKNOWN` es preferible a inventar un estado.

---

## Preguntas que debe hacerse el agente

```text
¿Qué tipo de mensaje es?
¿Qué proveedor/jurisdicción aplica?
¿Existe consentimiento o base válida?
¿SPF, DKIM y DMARC están correctamente configurados?
¿Qué reputación y spam signals existen?
¿La persona está suprimida?
¿La regla citada sigue vigente?
¿Estamos ante requisito, recomendación o heurística?
```

---

## Principio maestro

Deliverability sostenible combina consentimiento, autenticación, calidad de audiencia, reputación y comportamiento de envío.

