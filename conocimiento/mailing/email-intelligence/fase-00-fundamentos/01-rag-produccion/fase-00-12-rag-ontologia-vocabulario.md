# Fase 0.12 — Ontología y vocabulario común

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Establecer un vocabulario conceptual común para que los agentes de Email Intelligence utilicen los mismos términos con el mismo significado.

Este documento define semántica.

No define schemas técnicos ni lógica de ejecución.

---

# 1. Fact

Dato observado o registrado.

```text
orders_count = 3
```

---

# 2. Event

Algo que ocurrió en un momento.

```text
ADD_TO_CART
```

---

# 3. Property

Atributo de una entidad.

```text
customer.country
```

---

# 4. Entity

Objeto identificable.

Ejemplos:

```text
customer
product
order
campaign
flow
```

---

# 5. State

Condición actual derivada de información disponible.

```text
AT_RISK
```

---

# 6. Inference

Conclusión obtenida a partir de evidencia.

```text
likely_product_affinity
```

No debe tratarse como hecho.

---

# 7. Confidence

Nivel de certeza asociado a una inferencia o recomendación.

---

# 8. Customer

Persona identificable relacionada con el ecommerce.

---

# 9. Subscriber

Persona vinculada al canal de email bajo las condiciones correspondientes.

No significa buyer.

---

# 10. Prospect

Persona identificada con potencial comercial que todavía no ha completado la compra relevante.

---

# 11. Buyer

Persona que ha comprado.

---

# 12. Lifecycle

Relación evolutiva entre cliente y marca.

---

# 13. Funnel

Progresión hacia una conversión concreta.

---

# 14. Intent

Proximidad estimada a una acción comercial.

---

# 15. Engagement

Nivel de interacción con la marca o sus comunicaciones.

---

# 16. Affinity

Interés probable por producto o categoría.

Puede ser observado o inferido.

---

# 17. Segment

Grupo definido mediante criterios.

---

# 18. Audience

Conjunto de personas considerado para una comunicación concreta.

---

# 19. Eligibility

Condición que determina si una persona puede recibir una comunicación.

---

# 20. Exclusion

Criterio que elimina personas de una audiencia.

---

# 21. Suppression

Impedimento de comunicación bajo una condición determinada.

---

# 22. Objective

Resultado que pretende conseguir una comunicación.

---

# 23. Primary Objective

Objetivo dominante.

---

# 24. Secondary Objective

Objetivo adicional que apoya al principal.

---

# 25. Desired Action

Acción que se desea que realice el receptor.

---

# 26. CTA

Elemento que expresa una acción propuesta.

---

# 27. Message

Unidad concreta de comunicación.

---

# 28. Campaign

Comunicación iniciada por decisión de la marca hacia una audiencia.

---

# 29. Flow

Secuencia automatizada activada por evento, condición o estado.

---

# 30. Transactional Message

Comunicación principalmente funcional ligada a una operación o servicio.

---

# 31. Trigger

Evento o condición que inicia una lógica.

---

# 32. Entry Condition

Condición necesaria para entrar en una secuencia.

---

# 33. Exit Condition

Condición que provoca salida.

---

# 34. Re-entry

Posibilidad de volver a entrar en una lógica.

---

# 35. Delay

Tiempo entre acciones dentro de una secuencia.

---

# 36. Branch

Bifurcación basada en contexto o condición.

---

# 37. Offer

Propuesta comercial adicional.

Ejemplos:

```text
discount
free_shipping
gift
bundle
```

---

# 38. Discount

Reducción de precio.

No es sinónimo de oferta.

---

# 39. Incentive

Beneficio utilizado para favorecer una acción.

---

# 40. Product Recommendation

Selección de producto considerada relevante.

---

# 41. Cross-sell

Recomendación complementaria.

---

# 42. Upsell

Recomendación de una opción de mayor valor.

---

# 43. Replenishment

Recompra asociada al agotamiento esperado de un producto.

---

# 44. Win-back

Estrategia para recuperar clientes cuya relación comercial se ha debilitado.

---

# 45. Re-engagement

Estrategia para recuperar interacción.

---

# 46. Sunset

Reducción o detención de comunicaciones a usuarios persistentemente desengaged.

---

# 47. Personalization

Adaptación de estrategia o contenido a contexto relevante.

---

# 48. Dynamic Content

Contenido que cambia según datos o reglas.

No equivale automáticamente a personalización estratégica.

---

# 49. Recommendation

Propuesta del sistema.

No significa ejecución.

---

# 50. Decision

Conclusión sobre qué conviene hacer.

Ejemplos conceptuales:

```text
SEND
DELAY
SUPPRESS
NO_SEND
```

---

# 51. Action

Ejecución concreta de una decisión.

---

# 52. Contact Pressure

Carga acumulada de comunicaciones recibidas.

---

# 53. Frequency

Número de comunicaciones dentro de una ventana.

---

# 54. Priority

Importancia relativa de una comunicación frente a otra.

---

# 55. Conflict

Situación en la que varias comunicaciones compiten o resultan incoherentes.

---

# 56. Arbitration

Proceso de resolver conflictos entre comunicaciones.

---

# 57. Cannibalization

Situación en la que una acción reduce valor que podría haberse generado de otra forma.

---

# 58. Deliverability

Capacidad de llegar adecuadamente al destinatario.

---

# 59. Bounce

Fallo de entrega.

---

# 60. Spam Complaint

Señal crítica de rechazo del destinatario.

---

# 61. Unsubscribe

Acción de dejar de recibir determinadas comunicaciones.

---

# 62. Consent

Estado relativo a autorización o base aplicable para comunicaciones.

---

# 63. Preference

Información declarada sobre intereses o forma de relación.

---

# 64. Metric

Medida cuantitativa.

---

# 65. KPI

Métrica prioritaria respecto a un objetivo.

---

# 66. Guardrail Metric

Métrica utilizada para evitar que una optimización deteriore otra dimensión.

---

# 67. Revenue

Ingresos.

No equivale a profit.

---

# 68. Profit

Resultado económico tras costes aplicables.

---

# 69. Margin

Relación entre ingresos y costes relevantes.

---

# 70. AOV

Average Order Value.

Valor medio de pedido.

---

# 71. LTV

Lifetime Value.

Valor económico estimado o medido de una relación con cliente.

---

# 72. Attribution

Modelo que asigna una conversión a determinados contactos.

No equivale a causalidad.

---

# 73. Incrementality

Valor adicional causado por una acción frente a lo que habría ocurrido sin ella.

---

# 74. Experiment

Prueba estructurada para evaluar una hipótesis.

---

# 75. Hypothesis

Proposición comprobable.

---

# 76. Control

Grupo o variante de referencia.

---

# 77. Holdout

Grupo deliberadamente no expuesto a una acción.

---

# 78. Observation

Resultado observado sin asumir causalidad.

---

# 79. Result

Salida medida de una acción o experimento.

---

# 80. Evidence

Información que respalda una conclusión.

---

# 81. Learning

Conclusión útil derivada de evidencia.

---

# 82. Global Knowledge

Conocimiento general aplicable de forma amplia.

---

# 83. Tenant Knowledge

Información específica de una tienda.

---

# 84. Tenant Learning

Aprendizaje obtenido en una tienda concreta.

---

# 85. Category Learning

Aprendizaje potencialmente aplicable a una categoría de ecommerce.

---

# 86. Global Learning

Aprendizaje respaldado suficientemente para considerarse generalizable.

---

# 87. Policy

Regla normativa, operativa o técnica que limita decisiones.

---

# 88. Guardrail

Restricción diseñada para impedir acciones de riesgo o fuera de límites.

---

# 89. Rule

Condición explícita que produce un comportamiento determinado.

---

# 90. Heuristic

Criterio orientativo que ayuda a decidir cuando no existe certeza absoluta.

---

# 91. Context

Información disponible para una decisión.

---

# 92. Tenant Context

Información particular de un ecommerce.

---

# 93. RAG

Recuperación de conocimiento relevante para ayudar al modelo a razonar.

No debe sustituir datos operativos en tiempo real.

---

# 94. Corpus Maestro

Conocimiento amplio de origen del que pueden derivarse artefactos posteriores.

---

# 95. RAG de Producción

Conocimiento seleccionado y preparado para recuperación durante ejecución.

---

# 96. Source of Truth

Fuente autoritativa para un dato concreto.

---

# 97. Freshness

Actualidad de un dato.

---

# 98. Data Quality

Fiabilidad de la información según completitud, consistencia y actualidad.

---

# 99. Audit Trail

Registro que permite reconstruir contexto, decisión y resultado.

---

# 100. Human-in-the-loop

Participación humana necesaria para revisar o aprobar determinadas acciones.

---

# 101. Brand Voice

Forma estable en que una marca se expresa.

---

# 102. Tone

Adaptación contextual de la voz.

---

# 103. Creative Brief

Definición estructurada de objetivo, audiencia, mensaje y dirección creativa.

---

# 104. Template

Estructura visual reutilizable.

---

# 105. Module

Bloque reutilizable dentro de un email.

---

# 106. Copy

Texto persuasivo o informativo.

---

# 107. Subject Line

Texto principal visible antes de abrir un email.

---

# 108. Preheader

Texto complementario al asunto.

---

# 109. Hook

Elemento inicial utilizado para captar atención.

---

# 110. Value Proposition

Razón principal por la que una oferta o producto aporta valor.

---

# 111. Benefit

Resultado o ventaja para el cliente.

---

# 112. Feature

Característica del producto.

---

# 113. Objection

Razón que puede impedir o retrasar una acción.

---

# 114. Social Proof

Evidencia procedente de terceros o clientes.

---

# 115. UGC

Contenido generado por usuarios.

---

# 116. Urgency

Necesidad temporal real de actuar.

---

# 117. Scarcity

Disponibilidad limitada real.

---

# 118. Risk Reversal

Mecanismo que reduce riesgo percibido.

---

# 119. Friction

Obstáculo que dificulta una acción.

---

# 120. Timing

Momento de una comunicación.

---

# 121. Send Window

Periodo durante el cual una comunicación mantiene relevancia.

---

# 122. Cooldown

Periodo de separación entre determinadas comunicaciones o acciones.

---

# 123. Relevance Decay

Pérdida de relevancia con el paso del tiempo.

---

# 124. Unknown

```text
UNKNOWN
```

significa que falta información.

No debe sustituirse por una invención.

---

# 125. Not Applicable

```text
NOT_APPLICABLE
```

significa que la dimensión no corresponde.

No es lo mismo que `UNKNOWN`.

---

# 126. Términos que deben evitarse sin definición

Ejemplos:

```text
cliente bueno
cliente frío
email ganador
mejor asunto
segmento de calidad
```

Deben sustituirse por criterios observables o contexto explícito.

---

# 127. Hecho vs inferencia

Ejemplo correcto:

```text
FACT:
customer bought product_A

INFERENCE:
customer may have affinity with category_A
```

---

# 128. Resultado vs aprendizaje

```text
RESULT:
Variant B obtuvo mayor CTR en este experimento.

LEARNING:
En este contexto existe evidencia para seguir investigando esa dirección.
```

Un resultado aislado no crea automáticamente una regla universal.

---

# 129. Jerarquía conceptual de información

El agente debería confiar primero en datos operativos válidos y contexto específico antes que en conocimiento genérico.

El conocimiento general orienta.

Los datos reales describen el caso concreto.

---

# 130. Principio maestro

Todos los agentes deben hablar el mismo lenguaje conceptual.

```text
same_concept
=
same_meaning
```

La ontología reduce ambigüedad y permite que estrategia, análisis, RAG y futuras capas del sistema trabajen sobre conceptos compatibles.
