# Fase 6.15 — Tipografía

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La tipografía debe priorizar legibilidad y compatibilidad.

Un sistema tipográfico de email necesita:
- familia principal;
- fallbacks;
- escalas;
- pesos;
- jerarquía;
- line-height.

Las fuentes web no siempre se renderizan igual en todos los clientes de correo, por lo que deben existir fallbacks razonables.

Antipatrones: demasiadas familias, tamaños muy pequeños, contrastes débiles, line-height insuficiente o depender de una fuente que no tiene fallback.

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
