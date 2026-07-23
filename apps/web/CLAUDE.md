@AGENTS.md

## Sistema de componentes: HeroUI v3

Toda interfaz nueva o modificada en `apps/web` se construye a partir de `@/components/ui`
(`apps/web/src/components/ui/`), sobre HeroUI v3 (`@heroui/react`) — no HTML/Tailwind ad-hoc, no otra
librería de componentes. Ver [`docs/decisions/ADR-0015-heroui-design-system.md`](../../docs/decisions/ADR-0015-heroui-design-system.md)
para el detalle completo: qué es wrapper propio vs re-export directo, las excepciones documentadas
(`Select` sigue nativo, `Combobox` mantiene su implementación propia), y la regla de no cablear un
componente a datos/funciones que no existen todavía en el backend.

Si un componente de HeroUI no está todavía en `@/components/ui`, añadirlo ahí (wrapper si hay
comportamiento propio que preservar, re-export directo si no) en vez de importar `@heroui/react`
directamente en una página.
