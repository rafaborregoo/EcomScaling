# FE-00 - Shell y design system

## Estado

- **Estado real:** `superseded_by_FE-08` (el shell/design system original de esta fase fue reemplazado por
  el rediseno "Libro Mayor" v2 documentado en FE-08; mantener este documento como si describiera el
  sistema actual es enganoso).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:** `apps/web/src/components/portal-shell.tsx` (shell actual, con mini barra de contexto,
  navegacion por rol, cache de bootstrap en memoria anadida esta semana); `packages/ui/src/index.tsx`
  (Button, Card, Badge, Banner, Field/Input/Select/Textarea, LoadingBlock/ErrorBlock/EmptyState,
  SyncStateBadge, Tabs, Pagination, Combobox) — todo esto es el sistema **v2**, no el descrito aqui.
- **Gaps identificados:**
  - "Estado: Completado, Migraciones aplicadas en Supabase remoto" era una plantilla copiada de los
    documentos de DB-XX — este es un documento de frontend, sin migraciones.
  - Sin catalogo exacto de componentes de `packages/ui` mantenido aqui (esta desactualizado desde el
    rediseno v2).
  - Sin Storybook ni pagina `/ui` de referencia visual.
  - "Accesibilidad base validada" sin auditoria adjunta (teclado, foco, contraste, lector de pantalla) —
    afirmacion sin evidencia.
  - Sin definicion de tokens canonicos mas alla de color.
- **Siguiente accion:** este documento deberia reescribirse para describir el sistema v2 actual (o
  fusionarse formalmente en la seccion "current spec" que resulte de dividir FE-08), no mantenerse como
  una version historica presentada como vigente.

## Objetivo

Crear la experiencia comun antes de los modulos de datos.

## Entregables

- Next.js. Estado: creado en `apps/web`.
- Layout portal cliente y panel consultor. Estado: shell inicial en `apps/web/src/components/portal-shell.tsx`.
- Componentes base: botones, formularios, tablas, badges, skeletons, modales y estados vacios.
- Navegacion responsive. Estado: menu lateral desktop y cabecera movil inicial.
- Manejo global de errores. Estado: errores de bootstrap y endpoints privados visibles.

## Avance 2026-07-15

- Login Supabase en `/login`.
- Shell privado con rutas `/dashboard`, `/integraciones`, `/configuracion` y `/consultor`.
- Paleta aplicada: negro, blanco y rojo EcomScaling.
- Estados vacios de integraciones sin datos ficticios.
- Panel consultor consume `GET /v1/consultant/organizations`.

## Criterios de cierre

- La app permite navegar sin datos ficticios. Estado: cubierto para shell inicial.
- Estados vacios explican la siguiente accion. Estado: cubierto parcialmente en integraciones/modulos.
- Accesibilidad base validada.
