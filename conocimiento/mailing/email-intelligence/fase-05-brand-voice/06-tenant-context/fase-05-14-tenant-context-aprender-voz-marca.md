# Fase 5.14 — Cómo aprender la voz de una marca — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de cada marca necesaria para aplicar `Cómo aprender la voz de una marca`.

## Datos del tenant

- `brand_source_priority`
- `approved_voice_corpus`
- `deprecated_samples`
- `voice_review_status`
- `last_voice_update`

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
