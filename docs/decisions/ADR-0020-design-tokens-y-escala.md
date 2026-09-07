# ADR-0020: Tokens de diseño y escala — contrato de sincronización visual de `apps/web`

- **Fecha:** 2026-08-28
- **Estado:** Aprobada
- **Relacionada:** [`ADR-0015-heroui-design-system.md`](ADR-0015-heroui-design-system.md)
  (de dónde salen los componentes), [`ADR-0009-role-based-navigation.md`](ADR-0009-role-based-navigation.md)
  (shell). Complementa las notas de estilo del `CLAUDE.md` raíz y de `apps/web/CLAUDE.md`.

## Contexto

`ADR-0015` fijó **de qué** se construye la UI (`@/components/ui` sobre HeroUI v3). No fijó
**con qué valores**: espaciado, tamaños de fuente, pesos, radios y roles de color se re-decidían
en cada página. El resultado, revisado en agosto 2026 (módulo Tareas como caso claro): todo se
leía igual (`text-sm text-muted` en título, cuerpo y meta), valores fuera de escala sueltos
(`py-1.5`, `mt-7`, `gap-2.5`, `text-[0.65rem]`), botones en `rounded-3xl` de HeroUI junto a
tarjetas en `rounded-md`, y cuatro recetas distintas para la misma "etiqueta en mayúsculas".

La práctica de los sistemas de referencia (Linear, Vercel, Stripe, Carbon, Material) es la
misma: **un valor se define una vez, se nombra por intención, y todo lo demás lo referencia**.
La consistencia no depende de la voluntad de cada pantalla.

## Decisión

Los valores de abajo son el **vocabulario cerrado** de `apps/web`. Interfaz nueva o modificada
usa solo estos. Nada de valores arbitrarios (`text-[13px]` puntuales, `py-1.5`, `gap-2.5`,
`rounded-xl`…) salvo que esta ADR se amplíe.

### 1. Modelo de tokens — 3 niveles, una referencia hacia abajo

| Nivel | Dónde vive | Ejemplo |
|---|---|---|
| **Primitivo** (valor crudo) | `:root` / `@theme` en `globals.css` | `--accent: #1d4ed8`, `--color-edge: #d8d8d8` |
| **Semántico** (intención) | `@theme` en `globals.css`, expuesto como utilidad Tailwind | `--color-ink` (texto primario), `--color-muted` (secundario), `--color-line` (borde sutil), `--color-surface` (fondo elevado) |
| **Componente** | wrapper en `@/components/ui` o CSS sin capa en `globals.css` | `button-radius → --radius`, `.select-bare` |

Reglas: un token referencia **exactamente un nivel por debajo**; un semántico apunta a un
primitivo, nunca a otro semántico; si la intención no está clara, no se crea el token.

### 2. Espaciado — rejilla de 8 (sub-rejilla de 4)

Escala permitida (clases Tailwind): **`1` (4px), `2` (8px), `3` (12px), `4` (16px), `6` (24px),
`8` (32px), `12` (48px), `16` (64px)**. Nada de `1.5`, `2.5`, `5`, `7`, `[Npx]`.

- Regla **interno ≤ externo**: padding dentro de una tarjeta ≤ separación entre tarjetas.
- Densidades fijas:
  - Fila de lista: `py-3`, separadas por `divide-y divide-line`.
  - Contenido de `Card`: `p-4 sm:p-5` (lo pone el wrapper).
  - Bloques de una página: `space-y-6`.
  - Toolbar / grupo de filtros: `gap-2`.

### 3. Tipografía — una familia, escala corta, el contraste lo da peso+color

Familia única: IBM Plex Sans (`--font-sans`, self-hosted). `--font-mono` **solo** para cifras
en columnas (`.font-mono` ya aplica `tnum`), nunca para etiquetas ni fechas.

| Rol | Clases | Uso |
|---|---|---|
| Título de página | `text-lg font-semibold` (o `Heading`) | uno por pantalla; si ya está en el breadcrumb, se omite |
| Título de sección / `Card` | `text-base font-semibold text-ink` (lo aplica `[data-slot="card-title"]` en `globals.css`; actualizado 2026-09-03 desde `text-sm` para que la cabecera de cada módulo destaque sobre su contenido) | cabecera de tarjeta o grupo |
| Título de fila | `text-sm font-medium text-ink` | ítem de lista |
| Cuerpo / descripción | `text-[13px] leading-relaxed text-ink` | párrafo de contenido |
| Secundario | `text-[13px] text-muted` | descripción bajo un título |
| Meta | `text-xs text-muted` | fecha, módulo, estado, contador — **sin `font-mono`** |
| Eyebrow / etiqueta | `text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted` | kicker de `Card`, label de `Field`, cabecera de grupo del nav |
| Cifra KPI | componente `Metric` (`@/components/ui`): `text-2xl font-semibold tabular-nums` (`size="sm"` → `text-lg`) | tiles del dashboard; **no `font-mono`** (cae a Consolas en Windows, no hay Plex Mono), `tabular-nums` alinea las columnas |
| Gráfico | componentes `AreaChart` / `BarChart` (`@/components/ui/chart.tsx`, sobre `recharts`) | series planas (`data`, `xKey`, `series`); ejes/grid/tooltip ya tematizados con los tokens. HeroUI v3 no-Pro no trae charts; `@heroui-pro` sería el mismo `recharts` con tema. Solo cuando la comparación aporte (2+ categorías, valores reales) |

`text-[13px]` es la única excepción a "solo escala Tailwind": es el paso de cuerpo denso que
`text-sm` (14) y `text-xs` (12) no cubren. No se añaden más tamaños arbitrarios.

### 4. Radio de borde — vocabulario de 2 valores

- `--radius` (`0.375rem` / `rounded-md`): **todo** — botones, inputs, selects, tarjetas, modales,
  sheets, popovers, menús, dropdowns, tooltips, tabs, alerts, chips, listas/tablas.
- `rounded-full` (9999px): solo círculos — avatares, badge de conteo, control del switch,
  botones-icono circulares del shell móvil.

Mecanismo (2026-08-28): en `globals.css` se **colapsa la escala de radios de HeroUI/Tailwind**
(`--radius-xs`…`--radius-4xl` → `--radius`) en los bloques `:root` y `@theme inline`, de modo que
`rounded-sm`…`rounded-3xl` y las referencias `var(--radius-Nxl)` del CSS de HeroUI emiten todas
`--radius`. Las tres excepciones circulares se re-redondean con una regla explícita sin `@layer`
(`.avatar`, `[data-slot="badge"]`, `[data-slot="switch-*"]`). Prohibido `rounded-lg/xl/2xl/3xl`
o `rounded-[Npx]` sueltos en las páginas: ya no hacen nada distinto, pero ensucian.

### 5. Color — neutro dominante + un acento

| Rol | Token / clase | Uso |
|---|---|---|
| Fondo página | `bg-white` | dominante |
| Fondo elevado / hover sutil | `bg-surface` (`--color-surface`) | filas activas, hover de controles |
| Borde sutil | `border-line` (`--color-line`) | divisores, `divide-y` |
| Borde de campo | `border-edge` (`--color-edge`) | inputs, selects, tarjetas |
| Texto primario | `text-ink` (`--color-ink`) | |
| Texto secundario | `text-muted` (`--color-muted`) | |
| Acento (marca + acción + foco + activo) | `--accent` / `text-brand` / `bg-brand` | **solo** estado activo, acción primaria, foco. Un uso, no decoración. |
| Peligro / vencido | `--danger` / `tone="danger"` | destructivo y overdue, nada más |
| Aviso | `--warning` / `tone="warn"` | prioridad alta, permisos pendientes |
| Fondo de estado | `bg-accent-soft` / `bg-success-soft` / `bg-warning-soft` / `bg-danger-soft` | superficie teñida cuando la tarjeta **tiene** estado (KPI en aviso, fila seleccionada). Vienen con HeroUI (12–15% del color); no se inventan tints nuevos |
| Canal (Marketing) | `--color-channel-{email,meta,instagram}` (+ `-soft`) | identidad de canal en rejillas y planes. **No es una severidad**: por eso no reusa success/warn/danger. Único caso de familia de color fuera del neutro+acento |

Aclaración añadida el 2026-09-06: "neutro dominante" describe el **fondo**, no la ausencia de
color. Una pantalla en la que cinco KPIs, tres canales y cuatro estados se pintan todos en
`text-muted` sobre blanco no cumple esta tabla: la cumple mal. Si una dimensión se repite en
toda una pantalla y hay que **leerla** para distinguirla, le falta color.

`text-brand`/`text-black` heredados equivalen a `text-ink` (primario); código nuevo usa el nombre
semántico. La retirada de los alias `--color-brand*` legacy es una pasada aparte (ver `@theme`).

### 6. Interacción — "la densidad está en el comportamiento, no en los píxeles"

- Todo elemento interactivo tiene estado de **hover** (cambio de color, no de fondo salvo controles),
  **focus-visible** (regla global de `globals.css`, no se reimplementa) y, si dispara una acción de
  red, **feedback inmediato** (`disabled` + `…` en el botón + `toast` que nombra el resultado).
- Transiciones: `transition-colors` a 100–150ms. Nada de animaciones de layout.
- Jerarquía de botones por contexto: `primary` = LA acción principal; `ghost` = secundarias;
  `secondary` = neutras de toolbar. Nunca 3+ `secondary` seguidos.
- Badges: máximo uno por fila y solo si aporta (color = severidad). El resto, texto meta.

### 7. Fuente única de verdad

El contrato vive aquí. Su implementación vive en `@/components/ui` y en `globals.css`
(bloque sin `@layer` para los overrides de HeroUI). Una página **no** define estilos propios:
si falta una pieza, se añade al catálogo (regla de `ADR-0015`).

## Consecuencias

- Código nuevo se revisa contra las tablas 2–6. Un valor fuera de escala es un cambio a rechazar
  o a justificar ampliando esta ADR.
- Pasada de saneamiento pendiente (incremental, no bloqueante): sustituir en `apps/web/src` los
  valores sueltos (`py-1.5`, `mt-7`, `gap-2.5`, `text-[0.65rem]`, `rounded-xl`…) por la escala, y
  `text-black`/`text-brand` de texto por `text-ink`. Se hace por módulo, no en un commit gigante.
- El módulo **Tareas** (`apps/web/src/app/tareas/page.tsx`, reescrito 2026-08-28) es la plantilla:
  pestañas de subrayado, filas compactas, jerarquía de botones, escala tipográfica aplicada.
