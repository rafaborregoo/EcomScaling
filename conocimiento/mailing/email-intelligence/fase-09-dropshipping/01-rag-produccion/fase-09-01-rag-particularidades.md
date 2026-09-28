# Fase 9.1 — Particularidades del dropshipping

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El dropshipping introduce una estructura operativa distinta a ecommerce con inventario propio.

La tienda puede no controlar directamente:
- almacenamiento;
- preparación;
- última milla;
- stock físico;
- packaging;
- tiempos reales de proveedor.

Esto aumenta la importancia de:
- claridad;
- expectativas;
- seguimiento;
- control de proveedor;
- confianza;
- soporte.

La IA debe distinguir entre lo que la marca controla y lo que depende del proveedor. Nunca debe afirmar como certeza algo que la tienda no puede garantizar.

Antipatrones: prometer logística propia cuando no existe, ocultar plazos, inventar disponibilidad o utilizar la misma estrategia postcompra que una operación con fulfillment totalmente controlado.

---

## Marco de razonamiento

En dropshipping, el agente debe evaluar:

```text
PRODUCT
+
SUPPLIER REALITY
+
FULFILLMENT
+
SHIPPING
+
CUSTOMER EXPECTATIONS
+
TRUST
+
POST-PURCHASE STATE
+
BRAND STRATEGY
→ COMMUNICATION
```

La IA no debe convertir información de proveedor en verdad de marca sin validación.

---

## Principios

- transparencia antes que promesa agresiva;
- expectativa correcta antes que reducción artificial de fricción;
- shipping y post-purchase forman parte del marketing;
- soporte y confianza pueden ser más importantes que el descuento;
- los claims deben validarse;
- el estado operativo actual prevalece sobre copy preprogramado;
- la marca debe sobrevivir al producto concreto.

---

## Preguntas que debe hacerse el agente

```text
¿Qué controla realmente la tienda?
¿Qué depende del proveedor?
¿Qué podemos afirmar con certeza?
¿Qué espera ahora el cliente?
¿Existe un riesgo de confianza?
¿Hay una incidencia logística?
¿El mensaje comercial debería pausarse?
¿El producto o claim está validado?
```

---

## Principio maestro

Dropshipping exige comunicar con más disciplina operativa, no con más exageración.
