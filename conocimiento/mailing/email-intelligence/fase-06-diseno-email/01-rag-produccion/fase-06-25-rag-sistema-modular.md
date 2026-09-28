# Fase 6.25 — Sistema modular

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un sistema modular construye emails mediante bloques reutilizables con funciones claras.

Ejemplos:
- hero;
- product card;
- grid;
- benefits;
- UGC;
- reviews;
- trust;
- FAQ;
- offer;
- CTA.

La modularidad permite velocidad, consistencia y experimentación.

Los módulos deben tener reglas de composición. No todo bloque debe poder seguir a cualquier otro.

La IA debe seleccionar módulos en función del objetivo y evitar componer emails como una colección arbitraria de componentes.

Antipatrones: demasiados módulos, bloques redundantes, composición sin jerarquía, módulos que no responden a mobile o componentes visualmente incompatibles.

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
