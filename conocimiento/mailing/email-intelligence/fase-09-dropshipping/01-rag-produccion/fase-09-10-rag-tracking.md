# Fase 9.10 — Tracking

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Tracking reduce incertidumbre después de compra.

La información puede pasar por estados como:
- label created;
- in transit;
- customs;
- out for delivery;
- delivered.

La IA debe interpretar cada estado con precisión y no asumir movimiento real cuando solo existe etiqueta.

Un tracking sin actualizaciones puede requerir reassurance o escalado.

Antipatrones: “en camino” cuando solo se creó etiqueta, inventar ubicación, enviar links incorrectos o no detectar tracking estancado.

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
