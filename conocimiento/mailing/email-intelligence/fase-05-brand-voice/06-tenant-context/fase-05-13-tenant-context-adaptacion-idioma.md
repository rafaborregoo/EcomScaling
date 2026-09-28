# Fase 5.13 — Adaptación por idioma — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de cada marca necesaria para aplicar `Adaptación por idioma`.

## Datos del tenant

- `supported_languages`
- `locale_variants`
- `translation_glossary`
- `brand_terms_by_language`
- `language_specific_restrictions`

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
