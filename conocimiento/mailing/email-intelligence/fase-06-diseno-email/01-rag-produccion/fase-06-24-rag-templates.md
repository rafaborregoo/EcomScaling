# Fase 6.24 — Templates

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Los templates permiten reutilizar estructuras de alto nivel sin convertir todos los emails en copias.

Un template debe representar un patrón de comunicación, no una pieza rígida.

Puede existir:
- product launch;
- promo;
- editorial;
- founder;
- cart;
- post-purchase.

La IA debe elegir template según objetivo y permitir variación.

Antipatrones: un único template para todo, contenido forzado para encajar, estructura demasiado rígida o templates sin versionado.

---

## Marco de razonamiento visual

El agente debe pensar:

```text
OBJECTIVE
+
CONTENT HIERARCHY
+
AUDIENCE
+
DEVICE
+
BRAND SYSTEM
+
ACCESSIBILITY
+
EMAIL CLIENT CONSTRAINTS
→ DESIGN DECISION
```

El diseño debe servir al mensaje y no sustituirlo.

---

## Principios de calidad

- claridad antes que decoración;
- mobile-first;
- jerarquía visible;
- compatibilidad razonable;
- legibilidad;
- continuidad con marca y landing;
- cada módulo debe tener una función;
- el email debe seguir teniendo sentido si una imagen falla.

---

## Preguntas que debe hacerse el agente

```text
¿Qué debe entender primero el lector?
¿Qué elemento necesita mayor peso visual?
¿Funciona en móvil?
¿El CTA principal es evidente?
¿El contenido sigue siendo comprensible sin imágenes?
¿Hay elementos redundantes?
¿Respeta el sistema visual de la marca?
¿La landing continúa la misma promesa?
```

---

## Principio maestro

El diseño de email debe reducir fricción cognitiva y dirigir atención hacia la información y acción correctas.
