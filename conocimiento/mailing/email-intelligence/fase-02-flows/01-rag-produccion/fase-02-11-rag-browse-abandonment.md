# Fase 2.11 — Browse Abandonment

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Browse Abandonment intenta recuperar una exploración significativa que no avanzó hacia una intención superior.

No toda visita es abandono. Debe existir suficiente señal: categoría, búsqueda, colección o navegación repetida, seguida de una ventana razonable sin progresión.

El flow debe ceder ante Product, Cart o Checkout Abandonment cuando aparezcan señales superiores.

La comunicación puede centrarse en discovery, categoría, educación o selección, evitando mostrar al usuario un nivel de tracking que resulte invasivo.

Antipatrones: una visita = abandono, perseguir homepage views, ignorar progresión, usar señales antiguas o saturar con productos aleatorios.

---

## Cómo debe razonar el agente

```text
trigger
→ fuerza de la oportunidad
→ estado actual
→ exclusiones
→ timing
→ siguiente mejor acción
→ exit condition
```

Debe priorizar siempre el dato más reciente y el estado más avanzado del cliente.

---

## Preguntas clave

```text
¿Por qué existe esta oportunidad?
¿Sigue vigente?
¿Qué ocurrió después del trigger?
¿Existe compra o progresión posterior?
¿Qué fricción conocemos realmente?
¿El siguiente email añade valor?
¿Debe continuar, cambiar de rama o terminar?
```

---

## Principio maestro

El flow debe responder al contexto real del cliente y desaparecer cuando deja de aportar valor.
