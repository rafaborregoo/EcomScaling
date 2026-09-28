# Fase 9.18 — Claims

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Los claims son especialmente sensibles en productos dropshipping porque la tienda puede depender de materiales de proveedor que exageran prestaciones.

La marca debe validar los claims antes de utilizarlos.

La IA debe distinguir:
```text
supplier_claim
approved_brand_claim
evidence
```

Un claim del proveedor no debe heredarse automáticamente como verdad.

Antipatrones: copiar listings del proveedor, resultados garantizados, certificaciones no verificadas, superlativos sin evidencia o before/after engañosos.

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
