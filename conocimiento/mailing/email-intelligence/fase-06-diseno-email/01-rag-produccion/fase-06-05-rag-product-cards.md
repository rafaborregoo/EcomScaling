# Fase 6.5 — Product Cards

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una product card presenta un producto de forma compacta.

Puede incluir:
- imagen;
- nombre;
- precio;
- beneficio;
- rating;
- variante;
- CTA.

Debe permitir decidir rápidamente si merece exploración.

Las cards funcionan mejor cuando la información está normalizada y la comparación es fácil.

Antipatrones: demasiada información, precios incoherentes, imágenes con escalas distintas, CTAs ambiguos o cards que mezclan productos incompatibles.

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
