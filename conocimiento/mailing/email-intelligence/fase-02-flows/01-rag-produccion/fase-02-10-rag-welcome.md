# Fase 2.10 — Welcome Flow

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El Welcome Flow inicia la relación después de una suscripción, registro o identificación válida. Su función no es únicamente vender: debe contextualizar la marca, explicar la propuesta de valor, reducir incertidumbre y aprender del nuevo contacto.

Debe distinguir entre un prospect nuevo y un comprador existente que acaba de suscribirse. La secuencia puede cambiar si durante el flow ocurre una compra.

Objetivos posibles: activar, educar, generar confianza, descubrir preferencias y facilitar una primera compra cuando sea pertinente.

Debe evitar depender siempre de descuentos. El incentivo de captación, si existe, debe respetarse, pero no convierte todo el welcome en una secuencia promocional.

Antipatrones: welcome idéntico para todos, demasiados emails, ignorar compra durante la secuencia, repetir la misma propuesta y fingir que no existe historial previo.

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
