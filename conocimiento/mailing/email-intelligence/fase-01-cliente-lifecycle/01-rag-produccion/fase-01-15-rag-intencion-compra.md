# Fase 1.15 — Intención de compra

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente la intención de compra.

La intención es una inferencia sobre la proximidad o probabilidad de una acción comercial.

No es un hecho directamente observable.

---

# 1. Señales débiles

Ejemplos:
- homepage;
- categoría;
- single product view.

---

# 2. Señales medias

Ejemplos:
- repeated product views;
- search;
- wishlist;
- comparison.

---

# 3. Señales fuertes

Ejemplos:
- add to cart;
- checkout started;
- repeated checkout activity.

---

# 4. Recencia

Una señal reciente suele aportar más intención actual.

---

# 5. Frecuencia

La repetición puede reforzar la inferencia.

---

# 6. Secuencia

La progresión:
```text
browse → product → cart → checkout
```
suele indicar aumento de intención.

---

# 7. Lifecycle

Un repeat buyer puede requerir menos señales para interpretar una nueva intención que un visitante desconocido.

---

# 8. Ticket

Productos caros pueden requerir ciclos más largos.

---

# 9. Intent no es engagement

Una persona puede interactuar mucho sin intención inmediata.

---

# 10. Intent no es affinity

Puede existir afinidad alta sin intención actual de comprar.

---

# 11. Intent no es certainty

Incluso `VERY_HIGH_INTENT` sigue siendo una inferencia.

---

# 12. Decay

La intención pierde vigencia sin nueva actividad.

---

# 13. Fricción

Una intención fuerte puede coexistir con una barrera que impide convertir.

---

# 14. Intención y estrategia

A menor intención:
- educación;
- discovery.

A mayor intención:
- facilitar decisión;
- reducir fricción.

---

# 15. Antipatrón: un evento = score definitivo

Debe utilizarse contexto.

---

# 16. Antipatrón: intención permanente

Caduca.

---

# 17. Preguntas que debe hacerse el agente

```text
¿Qué señales existen?
¿Cuán recientes son?
¿En qué secuencia?
¿Hay progresión?
¿Existe carrito o checkout?
¿Hay fricción?
¿Qué lifecycle tiene?
```

---

# 18. Principio maestro

La intención se infiere a partir de comportamiento.

Debe expresarse con incertidumbre y actualizarse cuando cambia la evidencia.
