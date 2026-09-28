# Fase 1.13 — Reactivated Customer — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Detectar transiciones desde estados de inactividad hacia actividad renovada.

---

# 1. Estado previo

Debe existir una referencia como:
```text
AT_RISK
LAPSED
DISENGAGED
```

según la dimensión evaluada.

---

# 2. Eventos de reactivación

Configurar qué eventos reactivan:
- engagement;
- intención;
- lifecycle comercial.

---

# 3. No mezclar dimensiones

Ejemplo:
```text
EMAIL_CLICKED
```
puede cambiar engagement sin convertir automáticamente a repeat buyer activo.

---

# 4. Compra

Una compra válida puede provocar:
```text
LAPSED
→ REACTIVATED
→ ACTIVE_REPEAT_BUYER
```

---

# 5. Estado transitorio

`REACTIVATED` puede registrarse como transición o ventana temporal, no necesariamente como estado permanente.

---

# 6. Auditoría

Registrar:
```text
previous_state
reactivation_event
reactivated_at
new_state
```

---

# 7. Principio maestro

La reactivación debe derivarse de una transición verificable, no de una impresión generativa.
