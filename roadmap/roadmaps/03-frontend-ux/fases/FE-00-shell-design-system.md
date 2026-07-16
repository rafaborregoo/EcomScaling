# FE-00 - Shell y design system

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
