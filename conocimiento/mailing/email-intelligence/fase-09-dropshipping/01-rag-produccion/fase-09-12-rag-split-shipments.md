# Fase 9.12 — Split Shipments

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Split shipment ocurre cuando un pedido llega en varios paquetes.

En dropshipping puede ser frecuente por múltiples proveedores o almacenes.

El cliente debe entender:
- que el pedido está dividido;
- qué contiene cada paquete;
- tracking de cada envío;
- qué queda pendiente.

La IA debe evitar lenguaje que haga pensar que faltan productos cuando existe un segundo paquete planificado.

Antipatrones: un único tracking para todo, no explicar división, marcar pedido completo como entregado tras primer paquete o enviar mensajes contradictorios.

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
