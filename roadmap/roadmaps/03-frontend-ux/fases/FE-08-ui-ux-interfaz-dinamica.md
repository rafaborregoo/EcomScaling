# FE-08 - UI/UX final e interfaz dinamica asistida por IA

## Estado

> Aclaracion de implementacion 2026-08-24: el skip link apunta a la seccion
> `#portal-content`, que tiene `tabIndex={-1}`; el `main` exterior no es el destino.

> **Corrección documental 2026-08-24:** el skip link permanece en el estado vigente: `PortalShell` lo
> renderiza, `main` tiene el destino enfocable y `scripts/assert-accessibility-surface.mjs` lo verifica.
> La mención inferior a su eliminación es histórica y queda supersedida. El catálogo reutilizable tampoco
> se duplica en `packages/ui`: ADR-0015 fija `apps/web/src/components/ui` como fuente única sobre HeroUI v3.

> **Corrección de accesibilidad 2026-08-02:** el shell compartido ya incluye skip link al contenido
> principal, destino enfocable, foco visible global, idioma de documento y reducción de movimiento.
> La fase continúa `in_progress` porque la verificación visual manual en navegador real sigue pendiente.
> Corrección 2026-08-20: el dashboard ya incorpora el bloque adaptativo `Qué requiere atención`,
> alimentado por `/operations` y ordenado de forma determinista (alertas críticas, tareas vencidas,
> tareas urgentes, salud de conectores y KPIs). No delega la composición al modelo ni inventa datos;
> mantiene loading/error y enlaza a las superficies existentes.

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** AI-00, AI-02 (Bloque B); FE-02..FE-04 (superficies a rediseñar, ya completadas)
- **Bloqueador:** ninguno
- **Historial completo:** [`../CHANGELOG-UX.md`](../CHANGELOG-UX.md). Decisiones estructurales con
  consecuencias duraderas: [`docs/decisions/ADR-0009-role-based-navigation.md`](../../../../docs/decisions/ADR-0009-role-based-navigation.md),
  [`docs/decisions/ADR-0010-global-client-store-context.md`](../../../../docs/decisions/ADR-0010-global-client-store-context.md).
  Este archivo describe **solo el estado vigente** — no es un diario de desarrollo.

## Objetivo

Convertir el esqueleto usable actual en la experiencia final del producto: una interfaz
con identidad propia cuya composicion se adapta dinamicamente al rol, al estado del
negocio y a los objetivos de cada organizacion, con la IA integrada en la superficie
(no como un chat aparte).

## Principios vigentes

1. **La IA compone, el usuario decide.** La interfaz prioriza y sugiere; nunca ejecuta
   acciones de negocio sin confirmacion (coherente con la politica de aprobacion de AI-00).
2. **Dinamica = relevancia, no movimiento.** Los bloques aparecen/desaparecen segun el
   contexto (datos disponibles, alertas activas, fase del plan), no por decoracion.
3. **Sin datos falsos.** Cada widget muestra fuente, periodo y freshness, y avisa cuando
   la informacion esta incompleta.
4. **Un solo sistema para dos audiencias.** Cliente y consultor comparten componentes;
   cambian la densidad de informacion y las acciones disponibles segun rol.
5. **Sin subtextos explicativos bajo titulos** (regla de estilo "Libro Mayor", ver changelog).
6. **Una sola fuente estandar (Inter), blanco dominante, negro/rojo como acentos.**

## Arquitectura actual (resumen — detalle en el codigo, no aqui)

- Design system HeroUI v3 (`@heroui/react`) desde 2026-07-23, catalogo en `apps/web/src/components/ui/`
  y tokens en `globals.css` — reemplaza "Libro Mayor v2"/`packages/ui` (eliminado). Ver
  [`ADR-0015-heroui-design-system.md`](../../../../docs/decisions/ADR-0015-heroui-design-system.md).
- Shell (`portal-shell.tsx`) con navegacion por rol (ADR-0009) y contexto global de
  cliente/tienda activos (ADR-0010).
- Cache de bootstrap en memoria en el shell para no remontar todo el chrome en cada
  navegacion (fix 2026-07-20, ver changelog).

## Estado por bloque

| Bloque | Estado | Evidencia | Pendiente |
| --- | --- | --- | --- |
| Tokens de diseño | `done` | `globals.css`, 12+ pantallas migradas | — |
| Componentes base (`apps/web/src/components/ui`) | `done` | Catalogo HeroUI v3 con wrappers Button/Card/Badge/Banner/Field/Tabs/Pagination/Combobox; 28 usos ad-hoc de esquinas redondeadas en 11 paginas migrados a los componentes reales 2026-07-22. **Correccion 2026-07-29**: `Modal` y `Toast` no faltaban -- `Modal` ya estaba en uso real (`tareas/page.tsx`, `confirm-danger-dialog.tsx`) y `Toast.Provider` ya estaba montado en `layout.tsx`, pero con **cero llamadas a `toast(...)` en toda la app** -- ninguna accion (cambiar estado de tarea/alerta, comentar, editar cliente, aprobar/rechazar resumen de llamada) daba confirmacion positiva, solo fallos inline o exito silencioso. Anadidas llamadas `toast.success(...)` en los puntos de mutacion reales de las tres vistas: tareas/alertas (cliente y consultor, `tareas/page.tsx`), edicion de cliente (admin, `consultor/page.tsx`) y aprobacion/rechazo de resumenes de llamada (consultor, `llamadas/page.tsx`). No se toco el manejo de errores existente (`ErrorBlock` inline), solo se anadio la confirmacion de exito que faltaba. | — |
| Navegacion por rol | `done` (ADR-0009) | `portal-shell.tsx` | — |
| Contexto global cliente/tienda | `done` (ADR-0010) | `ActiveOrganizationContext`/`ActiveConnectionContext`, URL como fuente primaria desde 2026-07-21 | — |
| CRUD de clientes/tiendas (Consultoria) | `done` | `consultor/page.tsx`, soft-delete con periodo de gracia desde 2026-07-21, UI de restauracion conectada 2026-07-22 (ver FE-07) | — |
| Responsive 375px | `done` | Auditado 2026-07-22: toda tabla ancha ya tenia `overflow-x-auto`+`min-w`, grids con prefijos `md:`/`lg:`/`xl:` (1 columna por defecto en movil) | Re-auditar si se anaden layouts nuevos |
| Accesibilidad AA | `in_progress` | `Combobox` gano navegacion por teclado 2026-07-22. **Auditoria formal con axe-core 2026-07-23** (ver FE-00): 3 hallazgos reales corregidos y verificados en navegador real -- `heading-order` en 6 paginas (causa unica, `Card`/titulos de seccion promovidos a `h2`), `aria-input-field-name` + `color-contrast` 1.04:1 en el panel abierto del `Combobox`, mas `document.title` duplicado en las 7 paginas (WCAG 2.4.2) | Prueba manual con lector de pantalla real (NVDA/VoiceOver) -- axe cubre reglas automatizables, no equivale a probar con tecnologia asistiva real |
| Home adaptativo por prioridad | `implemented_partial` | `apps/web/src/app/dashboard/page.tsx`: `buildFocusItems` + `AdaptiveFocus`, alimentado por operaciones reales y estados de conectores | Falta validación visual/manual y conectar el resumen narrado de AI-02 |
| Resumen ejecutivo narrado | `implemented_partial` | `AiDiagnosticSection` en variante `summary`, conectado a A02 (`/ai/monitor`) con confianza, groundedness, completitud, fuentes y warnings | Falta validación con proveedor real y revisión visual/manual |
| Copiloto embebido | `in_progress` | `copilot-panel.tsx` (panel lateral, ver FE-06) | La diferenciacion info/recomendacion/propuesta no aplica al copiloto (chat de solo lectura sin ese contrato) -- ya reforzada donde si aplica, `AiDiagnosticSection`, ver FE-06 |

## Incremento FE-08 2026-08-26 - evidencia por respuesta en el copiloto

`AiEvidence` es un componente reutilizable y su lógica pura vive en
`ai-evidence-state.ts`. Cada mensaje del copiloto conserva sus propias fuentes
y warnings; ya no se muestra la tabla de fuentes de la última respuesta como si
fuera evidencia de todo el historial. Los estados visuales son `Fuentes
verificadas`, `Evidencia parcial` y `Sin evidencia`, sin convertir ausencia de
datos en una respuesta saludable.

## Riesgo de producto resuelto 2026-07-21

Rafa decidio soft-delete con estados. El CRUD de Consultoria (`platform_admin`) ya no borra nada de forma
inmediata: `deleteOrganization`/`deleteOrganizationStore` (`apps/api/src/consultant.ts`) marcan
`status='pending_deletion'` con `scheduled_purge_at` = ahora + `RETENTION_PERIOD_DAYS` (30 dias):

```text
active/onboarding/suspended/cancelled -> pending_deletion -> (30 dias) -> purgado fisicamente
```

`POST .../restore` revierte dentro del periodo de gracia. El borrado fisico real (la cascada de FK que
limpia pedidos, metricas, costes, campañas, conversaciones, conocimiento, llamadas, auditoria) sigue
existiendo pero solo la ejecuta `purgeExpiredDeletions`, corrida por un cron diario
(`.github/workflows/purge-expired-deletions.yml`), nunca un clic directo desde la UI. No habia frontend
consumiendo estas rutas todavia, asi que no hizo falta cambiar UI existente. Ver `RIESGOS.md` R-008.

## Entregables pendientes

### Bloque A - Design system y rediseño (resto)

- Responsive real en movil para flujos de cliente (dashboard, tareas, camino, notificaciones).
- Accesibilidad: navegacion por teclado, focus visible, contraste AA, labels y aria en formularios y tablas.

### Bloque B - Interfaz dinamica asistida por IA

- **Resumen narrado y refinamiento por rol**: el dashboard ya tiene una primera composición
  determinista por prioridad y muestra el resumen cacheado de A02 en una variante compacta con
  fuentes, confianza, completitud y warnings. Queda pendiente la validación con proveedor real y
  el refinamiento de densidad por rol. El modelo no cambia el layout.
- **Home adaptativo por rol y contexto**: el dashboard deja de ser una lista fija de
  secciones y pasa a componerse por prioridad: alertas criticas > tareas vencidas >
  hito activo de Mi Camino > KPIs del periodo > modulos sin conectar. El orden lo
  decide una funcion determinista alimentada por los mismos datos que el motor de
  reglas; la IA (A02 monitor de negocio) aporta el resumen narrativo, no el layout.
- **Resumen ejecutivo narrado**: bloque "Que esta pasando" generado por IA con el
  contrato de salida de AI-00 (schema validado, fuentes citadas: metricas + periodo),
  regenerado con cada sync relevante y cacheado.
- **Acciones sugeridas en contexto**: cada alerta/KPI critico ofrece la siguiente
  accion recomendada como CTA tipado (`IntegrationAction`, ver FE-02), reutilizando
  el catalogo de acciones de la banda superior.
- **Diferenciacion visual del copiloto**: informacion / recomendacion / propuesta / accion ya ejecutada
  con estilos distintos (ver FE-06).

## Dependencias

- AI-00 (contratos y schema de salida) y AI-02 (monitor de negocio) para el bloque B;
  el bloque A puede ejecutarse en paralelo sin el runtime IA.
- FE-02..FE-04 completadas (lo estan) como superficies a rediseñar.
- SQO-02 (observabilidad) recomendable para medir latencia y coste de los bloques IA.

## Criterios de cierre

- Ninguna pantalla usa estilos ad-hoc fuera del design system.
- El home de un cliente con alertas criticas y el de uno sin conexiones muestran
  composiciones distintas y correctas sin intervencion manual.
- Todo bloque generado por IA declara fuente y momento de generacion, valida contra
  schema y degrada a version estatica si el runtime IA falla o excede presupuesto.
- Flujos de cliente completos usables en movil (375px) sin scroll horizontal.
- Auditoria de accesibilidad AA sin errores bloqueantes en los flujos de cliente.
- El selector global de organizacion sustituye a los selectores por pagina (cumplido, ADR-0010).
- El riesgo de borrado irreversible tiene una decision de producto explicita, tomada por Rafa (cumplido
  2026-07-21, soft-delete con periodo de gracia).

### Validacion adicional 2026-07-22

Se incorporaron mejoras transversales de accesibilidad en `apps/web`: foco visible global, soporte
`prefers-reduced-motion`, dialogs con `role="dialog"`/`aria-modal`, nombres accesibles, estados live del
copiloto y ciclo de foco por teclado con Escape. La nota histórica que indicaba la eliminación del skip link
queda supersedida por la corrección vigente de 2026-08-02: el enlace existe en `PortalShell` y está cubierto
por el gate de accesibilidad. Los títulos de sección siguen la jerarquía vigente del sistema, sin duplicar
componentes fuera del catálogo común.

### Auditoria formal con axe-core, 2026-07-23

Ejecutada por primera vez (ver detalle completo en FE-00): 3 clases de hallazgo real corregidas y
verificadas dos veces en navegador real (auditoria + re-verificacion tras el fix). Pendiente real que sigue
abierto: prueba manual con lector de pantalla (NVDA/VoiceOver) -- axe cubre reglas WCAG automatizables, no
sustituye una prueba real con tecnologia asistiva.
