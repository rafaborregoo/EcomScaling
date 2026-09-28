# Fase 6.19 — Alt Text

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Alt text describe la función o contenido relevante de una imagen cuando esta no puede verse.

Debe ser útil, breve y contextual.

No todas las imágenes requieren la misma descripción:
- producto informativo: describir;
- CTA gráfico: explicar acción;
- decoración: puede no necesitar contenido semántico.

No debe repetir innecesariamente texto visible.

Antipatrones: nombres de archivo, descripciones genéricas, alt text demasiado largo o dejar información importante únicamente dentro de la imagen.

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
