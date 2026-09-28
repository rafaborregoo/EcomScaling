# Fase 10.10 — Domain Reputation

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Domain Reputation refleja cómo los receptores perciben el comportamiento de envío asociado a un dominio.

Puede verse afectada por:
- complaints;
- volumen;
- autenticación;
- engagement;
- patrones de envío;
- calidad de lista.

La reputación no es una puntuación universal única; cada proveedor puede evaluar señales distintas.

La IA debe evitar atribuir un problema de entrega a una sola causa sin evidencia.

Antipatrones: cambiar de dominio para escapar de mala práctica, mezclar marketing riesgoso con correo crítico o ignorar subdominios.

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

