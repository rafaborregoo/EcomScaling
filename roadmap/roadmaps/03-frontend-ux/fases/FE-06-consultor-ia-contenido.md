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
- **Correccion 2026-07-22**: "el copiloto no distingue informacion/recomendacion/propuesta/accion" no era
  un gap de UI sin hacer -- es estructuralmente imposible para el copiloto (A09) tal como esta disenado.
  `chatOutputSchema` (`packages/ai/src/index.ts`) es `{ answer, sources, confidence, warnings }`: texto
  libre, sin `findings`/`recommendations`/`proposed_writes`. El copiloto es de solo lectura por diseno
  ("ver vs escribir", nunca propone escrituras), asi que esa diferenciacion no aplica ahi. **Si aplica, y
  ya existia parcialmente, en `AiDiagnosticSection`** (A02/A04/A06/A08 -- dashboard, tareas, conocimiento):
  ahi se reforzo la diferenciacion visual 2026-07-22 (kicker de color distinto para "Recomendación", y la
  seccion de propuesta ahora dice explicitamente "Propuesta, sin aplicar" vs "Propuesta ya revisada" en
  vez de solo mostrar el boton).
- **Cerrado 2026-07-29 (estados de error diferenciados)**: `copilot-panel.tsx` mostraba cualquier fallo
  (IA no configurada, presupuesto diario agotado, conversacion no encontrada, turno rechazado por control
  de calidad) como el mismo texto crudo concatenado (`error - message - detail`). Ahora mapea los codigos
  de error ya devueltos por el backend (`ai_runtime_not_configured`, `organization_daily_budget_exceeded`,
  `conversation_not_found`, `organization_access_denied`) a mensajes explicativos en español, con
  `Alert` (HeroUI) en vez de texto plano y tono `warning`/`danger` segun si es temporal (ej. presupuesto
  agotado, se reactiva solo) o un fallo real. Anadido tambien un campo `status` en la respuesta de
  `chat_turn_failed` (`apps/api/src/ai-runtime.ts`, antes solo tenia `detail` en texto libre) para
  distinguir `budget_exceeded`/`rejected_output` sin parsear texto. Build de produccion limpio; sin
  verificar visualmente en navegador (sin Playwright/Chromium en este entorno). Quedan sin cubrir (menos
  criticos, requieren mas contrato de backend): timeout, fuentes insuficientes, cita eliminada, documento
  procesandose, respuesta parcial, aprobacion caducada.
  - Ranking Instagram y analisis de creatividades Meta: sin empezar, bloqueados por credenciales.
- **Siguiente accion:** actualizar este documento para describir el copiloto lateral real (no un chat de
  pagina completa) y aclarar que la diferenciacion visual de tipos de respuesta es un criterio de
  `AiDiagnosticSection`, no del copiloto conversacional.

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

