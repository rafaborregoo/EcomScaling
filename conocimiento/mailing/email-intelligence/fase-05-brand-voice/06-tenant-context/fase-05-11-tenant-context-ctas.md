# Fase 5.11 — CTAs de marca — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de cada marca necesaria para aplicar `CTAs de marca`.

## Datos del tenant

- `preferred_cta_patterns`
- `forbidden_ctas`
- `cta_formality`
- `cta_style_by_objective`

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
