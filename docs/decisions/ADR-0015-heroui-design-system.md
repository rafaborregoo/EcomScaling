# ADR-0015: HeroUI v3 como sistema de componentes obligatorio de `apps/web`

- **Fecha:** 2026-07-23
- **Estado:** Aprobada
- **Sustituye a:** [`ADR-0013-component-library-perf-conventions.md`](ADR-0013-component-library-perf-conventions.md)
  en lo relativo al paquete de componentes (`packages/ui` ya no existe); las reglas de esa ADR sobre
  paginación con memoria de posición y disciplina de carga de datos siguen vigentes sin cambios.
- **Relacionada:** [`FE-00-shell-design-system.md`](../../roadmap/roadmaps/03-frontend-ux/fases/FE-00-shell-design-system.md),
  [`FE-08-ui-ux-interfaz-dinamica.md`](../../roadmap/roadmaps/03-frontend-ux/fases/FE-08-ui-ux-interfaz-dinamica.md)

## Contexto

Petición directa de Rafa (2026-07-23): reemplazar el design system interno ("Libro Mayor v2",
`packages/ui`) por HeroUI v3 React (`@heroui/react`) como sistema de estilos principal de la aplicación.
Se ejecutó como reemplazo completo, no incremental: `packages/ui` se eliminó del monorepo, y los 12
archivos de `apps/web` que lo consumían migraron a un catálogo nuevo en `apps/web/src/components/ui/`.

Durante la migración se encontró y corrigió un bug real: `@import "@heroui/react/styles"` en
`globals.css` resolvía (via el exports map del paquete) a un placeholder casi vacío en vez del CSS real,
porque el resolvedor de CSS de Next.js/Turbopack no sigue la condición `"style"` del `package.json` de
`@heroui/styles`. El fix fue importar `@heroui/styles/css` directamente (resuelve por la condición
`"default"`, que sí alcanza el CSS real). Sin este fix los componentes se montaban en React con las
clases correctas pero sin ningún estilo visual — verificado con captura real: el CSS servido pasó de 35KB
(sin firmas de HeroUI) a 521KB con los estilos reales.

## Decisión

**Toda interfaz nueva o modificada en `apps/web` se construye a partir de `@/components/ui`
(`apps/web/src/components/ui/`), no con HTML/Tailwind ad-hoc ni con otra librería de componentes.**

`@/components/ui` es un catálogo de dos tipos de export, ambos reales (nada es un mock o placeholder):

1. **Wrappers propios** sobre primitivas reales de HeroUI, cuando existía una API previa que preservar
   o un comportamiento a mantener (`Button`, `Card`, `Badge` (envuelve `Chip`), `Banner`/`ErrorBlock`
   (envuelven `Alert`), `Field`, `Input`, `Select` (nativo, ver excepción abajo), `Textarea`,
   `LoadingBlock` (envuelve `Spinner`), `EmptyState`, `Tabs`, `Pagination` (con la lógica propia de rango
   con elipsis, HeroUI no la trae), `Combobox` (sin cambios de comportamiento, ver excepción abajo),
   `Autocomplete`, `ConfirmDialog` (envuelve `AlertDialog`), `Checkbox`, `Avatar`, `Breadcrumbs`,
   `NotificationBadge` (el `Badge` "punto de notificación" de HeroUI, renombrado para no chocar con
   nuestro `Badge`/`Chip`), `Table` (ver migración 2026-07-27 abajo).
2. **Re-exports directos** de `@heroui/react`, sin wrapper propio, para componentes sin uso existente que
   migrar: `ButtonGroup`, `Calendar`, `CheckboxGroup`, `Dropdown`, `DateField`, `DatePicker`, `TextField`,
   `FieldError`, `InputGroup`, `InputOTP`, `Kbd`, `TagGroup`/`Tag`, `Fieldset`, `Surface`, `Form`,
   `ErrorMessage`, `Label`, `Description`, `Link`, `ListBox`, `Meter`, `Modal`, `NumberField`, `Popover`,
   `ProgressCircle`, `Radio`/`RadioGroup`, `RangeCalendar`, `ScrollShadow`, `SearchField`, `Separator`,
   `Skeleton`, `Switch`, `Toast`/`toast`, `Toolbar`, `ToggleButton`/`ToggleButtonGroup`,
   `Tooltip`.

**`Table` migrado de re-export directo a wrapper (2026-07-27)**: el compuesto crudo de HeroUI
(`TableRoot`/`TableHeader`/`TableColumn`/`TableBody`/`TableRow`/`TableCell`, primitivos de
react-aria-components) obliga a repetir el mismo boilerplate de columnas/filas en cada pantalla. El
wrapper (`apps/web/src/components/ui/table.tsx`) expone `columns: {key,label,render?}[]` +
`rows: (T & {id: string})[]`, columnas estáticas y filas dinámicas — sigue usando los primitivos reales
de HeroUI por dentro, no los reemplaza. Motivado por pedido explícito de Rafa de que las salidas de
agentes IA (`AiDiagnosticSection`, `CopilotPanel`) se muestren con tablas/componentes reales en vez de
listas de texto plano.

Se usan **tal cual la documentación oficial de HeroUI v3** (compound components: `Card.Header`,
`Alert.Content`, `Select.Trigger`, etc.) — no se reinventa su API.

### Excepciones documentadas (no todo se migró a compound components de HeroUI)

- **`Select`**: migrado 2026-07-23 al `Select` compound real de HeroUI (`Select.Trigger`/`Select.Popover`/
  `ListBox.Item`) en los 9 usos de 6 archivos (`configuracion`, `conocimiento`, `tareas` x2, `consultor`
  x4, `integraciones`, `llamadas`). El wrapper (`apps/web/src/components/ui/select.tsx`) expone
  `options: {value,label}[]` en vez de children `<option>`, y `onChange(value: string)` en vez de un
  evento. Nota de accesibilidad real encontrada: los usos envueltos en `Field` (un `<label>` que envuelve
  el control) dejaron de tener nombre accesible al pasar de `<select>` nativo (donde el `<label>` que
  envuelve asocia automaticamente) a un `<button>` de disparo (donde no asocia) — se añadio `aria-label`
  explicito en cada uso para no perder el nombre accesible.
- **`Combobox`**: se mantuvo la implementación propia (teclado/ARIA manual) sin cambios, porque tiene
  lógica de accesibilidad recién auditada con axe-core y verificada en navegador real la misma semana
  (ver FE-00). Migrar a `ComboBox`/`Autocomplete` de HeroUI es un cambio de comportamiento, no solo de
  estilo.
- **Tokens heredados** (`--color-brand`, `--color-edge`, `--color-surface`, etc. en `globals.css`) se
  mantienen junto a los tokens nuevos de HeroUI (`--accent`, `--danger`, `--warning`, `--success`)
  porque 16 archivos de `apps/web` los siguen usando como clases Tailwind directas
  (`bg-surface`, `border-edge`, `text-brand`) fuera de `@/components/ui`. Retirarlos es una pasada
  aparte, no parte de esta ADR.

### Qué no se construye sin que exista el dato/función real detrás

Regla explícita, reforzando el principio ya establecido en FE-08 ("sin datos falsos"): un componente del
catálogo **no se cablea a una pantalla nueva** si no hay una funcionalidad real de backend detrás.
Ejemplos concretos descartados en esta ronda por esta razón: preferencias de notificación (`CheckboxGroup`
— sin columna de BD ni endpoint, ver
[`PROPUESTA-preferencias-notificacion.md`](../../roadmap/roadmaps/03-frontend-ux/PROPUESTA-preferencias-notificacion.md)),
personalización de color de marca (`ColorField`/`ColorSwatch` — sin funcionalidad de tema por cliente).
Tener el componente listo en el catálogo no es lo mismo que tener permiso para simular una función que no
existe.

## Consecuencias

- `packages/ui` ya no existe. Nada fuera de `apps/web` lo usaba, así que no hay más consumidores que
  migrar.
- `apps/web/package.json` depende de `@heroui/react`; `globals.css` importa `@heroui/styles/css`
  (no `@heroui/react/styles`, ver bug documentado arriba) más `tailwindcss` (incluido dentro del CSS de
  HeroUI, no se importa por separado).
- Cualquier componente HeroUI usado por primera vez en una pantalla nueva se añade al catálogo
  (`apps/web/src/components/ui/index.ts`) — como wrapper si hay comportamiento propio que preservar, como
  re-export directo si no.
- La tabla de clientes de `/consultor` (filas expandibles) es candidata a migrar a `Table` de HeroUI, no
  se hizo en esta ronda por el riesgo de romper la expansión de filas sin una tarea dedicada — sigue
  pendiente, no es deuda oculta, está documentado aquí.
