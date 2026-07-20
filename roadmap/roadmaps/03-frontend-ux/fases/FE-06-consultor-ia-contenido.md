# FE-06 - Consultor IA y contenido

## Estado

- **Estado real:** `planned_contract_incomplete` (la parte de chat ya tiene una decision real distinta a
  la que describe este documento; contenido/Instagram/creatividades siguen sin empezar).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** BE-07, DB-11, DB-10 (Instagram, bloqueada)
- **Bloqueador:** Instagram/creatividades Meta bloqueadas por credenciales (igual que DB-06/DB-10).
- **Decision ya tomada (contradice a este documento, alinear):** la contradiccion que senalaba la
  auditoria entre "FE-06 plantea un chat como pagina" y "FE-08 dice que la IA debe estar integrada, no
  ser un chat aparte" **ya esta resuelta en codigo**: existe `apps/web/src/components/copilot-panel.tsx`,
  un panel lateral global (boton flotante, ver `portal-shell.tsx`) — **no** existe ninguna pagina
  dedicada tipo `/consultor-ia`. La opcion elegida fue "copiloto lateral global", no "pagina completa" ni
  "los tres". Este documento deberia actualizarse para reflejarlo en vez de mantener ambigua la decision.
- **Evidencia:** `AiDiagnosticSection` (usado en dashboard) ya muestra fuentes/periodo/warnings por
  bloque IA — el patron de "declarar fuente, periodo, confianza" que pide la auditoria ya existe para los
  diagnosticos automaticos (A02/A04/A06), falta extenderlo al copiloto conversacional.
- **Gaps identificados:**
  - El copiloto no distingue visualmente "informacion" vs "recomendacion" vs "propuesta" vs "accion ya
    ejecutada" con estilos distintos — hoy todo el texto de respuesta se ve igual.
  - Sin estados de error especificos documentados (IA no disponible, timeout, presupuesto agotado,
    fuentes insuficientes, cita eliminada, documento procesandose, respuesta parcial, aprobacion caducada).
  - Ranking Instagram y analisis de creatividades Meta: sin empezar, bloqueados por credenciales.
- **Siguiente accion:** actualizar este documento para describir el copiloto lateral real (no un chat de
  pagina completa), y anadir la diferenciacion visual informacion/recomendacion/propuesta/accion.

Activar chat contextual, fuentes, aprobaciones e insights de contenido.

## Entregables

- Chat Consultor IA.
- Visualizacion de fuentes, periodo y limitaciones.
- Propuestas y aprobaciones.
- Ranking Instagram y ganadores manuales.
- Analisis de creatividades Meta.

## Criterios de cierre

- La respuesta IA siempre muestra fuentes cuando usa datos.
- No se muestran acciones ejecutadas si son solo propuestas.
- Instagram respeta limitaciones de API.

