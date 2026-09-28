# Fase 10.6 — Bounces

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Bounce indica que un mensaje no pudo entregarse.

Debe distinguirse entre:
- hard bounce;
- soft bounce;
- temporary rejection;
- policy rejection.

Un hard bounce suele indicar una dirección no entregable y requiere supresión rápida. Un soft bounce puede ser temporal.

La IA no debe interpretar todos los rechazos como iguales.

Antipatrones: reenviar indefinidamente a hard bounces, ignorar códigos SMTP o considerar cualquier temporary deferral como dirección inválida.

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

