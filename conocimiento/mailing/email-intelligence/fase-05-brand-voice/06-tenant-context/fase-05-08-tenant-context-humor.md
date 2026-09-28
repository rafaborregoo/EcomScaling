# Fase 5.8 — Humor — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de cada marca necesaria para aplicar `Humor`.

## Datos del tenant

- `humor_enabled`
- `humor_style`
- `humor_boundaries`
- `approved_humor_examples`
- `no_humor_contexts`

---

## Source of Truth

Estos datos deben provenir de fuentes aprobadas de la marca.

La IA no debe deducir información ausente como si fuera una regla confirmada.

---

## Versionado

Los cambios de voz deben poder versionarse para distinguir:
- guía actual;
- guía anterior;
- muestras obsoletas;
- excepciones temporales.

---

## Principio maestro

El RAG explica cómo funciona la voz.

El Tenant Context define cómo habla esta marca concreta.
