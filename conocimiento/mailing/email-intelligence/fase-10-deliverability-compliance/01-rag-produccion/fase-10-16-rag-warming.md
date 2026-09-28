# Fase 10.16 — Warming

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Warming aumenta gradualmente el volumen de una infraestructura nueva o poco utilizada para construir historial de envío.

Debe priorizar audiencia de mayor calidad y engagement.

No existe una curva universal correcta. Depende de:
- dominio;
- IP;
- proveedor;
- volumen previo;
- calidad de lista.

Warming no puede compensar mala autenticación, spam complaints o listas deficientes.

Antipatrones: duplicar volumen mecánicamente, empezar por contactos dormidos, cambiar simultáneamente dominio e IP sin control o considerar warming una garantía.

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

