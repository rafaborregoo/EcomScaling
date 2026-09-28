# Fase 10.9 — Engagement y deliverability

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Engagement es una señal relevante para deliverability porque los proveedores observan cómo interactúan los destinatarios con el correo.

No debe depender únicamente de opens, especialmente por limitaciones de medición.

Clicks, replies, conversiones, actividad web y ausencia prolongada pueden aportar contexto.

La estrategia debe evitar enviar volumen creciente a audiencias sin señales de interés.

Antipatrones: usar opens como verdad, confundir buyer activo con email-engaged o mantener frecuencia alta en segmentos completamente dormidos.

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

