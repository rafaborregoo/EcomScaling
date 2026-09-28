# Fase 6.20 — Dark Mode

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Dark mode puede alterar colores de fondo, texto, imágenes y logotipos.

El diseño debe anticipar que algunos clientes de correo aplican transformaciones automáticas.

Conviene usar:
- contraste robusto;
- logos preparados;
- transparencias cuidadosas;
- bordes cuando sean necesarios;
- assets que funcionen sobre fondos variables.

La IA debe evitar depender de una única combinación de color para que el mensaje sea comprensible.

Antipatrones: logos invisibles, texto claro sobre fondo transformado, PNGs con halos o asumir que todos los clientes respetan exactamente los colores.

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
