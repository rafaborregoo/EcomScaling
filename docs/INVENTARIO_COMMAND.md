# Inventario: dónde usar `Command` (apps/web)

Fecha: 2026-10-26. `Command` de shadcn es una lista con buscador y teclado: escribes, se filtra, te
mueves con ↑↓ y Enter ejecuta. Se usa de tres formas, y en E-NORA caben las tres:

1. **Paleta global** (`CommandDialog`, ⌘K / Ctrl+K): ir a cualquier sitio o lanzar una acción sin el
   ratón.
2. **Buscador en línea** (`Command` suelto): listas que hoy son un `<input>` más botones hechos a mano.
3. **Combobox** (`Popover` + `Command`): sustituye a un `Select` cuando la lista es larga o el usuario
   ya sabe el nombre que busca (clientes, tiendas, zonas horarias).

Los menús cortos de acciones de una fila (⋯ Editar / Pausar / Eliminar) **no** son `Command`; son
`DropdownMenu`. Se listan al final porque también son "menú de acciones" y conviene hacerlos a la vez.

## Estado (2026-10-27)

Decidido: **Command nativo, sin cmdk** (`components/ui/command.tsx`).

| Pieza | Estado |
|---|---|
| `Command` + catálogo | Hecho |
| Paleta ⌘K | Hecha: `components/command-palette.tsx`, montada en `portal-shell` (cubre también `/admin`, que va dentro). Grupos: *Acciones* (nuevo flow si el rol ve flows, ver avisos, marcar avisos leídos), secciones del menú del rol, cambiar de cliente (consultor) o de negocio (cliente con varios), cambiar de tienda de Shopify y "Preguntar al Consultor IA". Crear tarea y nueva campaña no tienen todavía una URL que abra su alta, así que no están |
| Copiloto: atajos `/` e historial | Hecho |
| Selector de piezas del constructor de flows | Hecho (`Command` en línea, pieza elegida con check) |
| Plantillas de referencia del planificador semanal | Hecho con `MultiSearchableSelect` (chips + buscador, máximo 3) |
| `Combobox` / `SearchableSelect` | Hecho sobre `Command`; guarda `lib/one-combobox.test.ts`; el `ComboBox` de HeroUI ya no existe |
| Selectores de cliente | Hechos todos (incluido el de la barra superior) salvo "Filtrar por cliente" de `tareas/page.tsx`, que está en obras en otra sesión |
| Selectores de tienda | Hechos los de diagnóstico, notificaciones y observabilidad. **Se quedan en `Select`:** los de la barra superior (`bare`, tiendas de un solo cliente), los dos de `/informes` y "Tienda de la tarea": listan las tiendas de un cliente, que son pocas |
| Catálogos largos | Hechos zonas horarias, métricas, hitos, campañas, envíos, personas, agentes, consultores, moneda de Klaviyo. **Se quedan en `Select`:** moneda de Mi Camino (9 fijas, campo de 6rem) y cuenta publicitaria de Meta (pocas por tienda) |
| `DropdownMenu` (5) | Hechos los 5, incluido "+ Añadir paso" de flows (ya con teclado) |

## Cuántos hay

| Uso | Sitios | Hoy |
|---|--:|---|
| Paleta global ⌘K | 1 nuevo (2 shells) | No existe; 94 enlaces en el árbol del menú del portal (según rol) + 18 en el de admin |
| Buscador en línea | 4 | `listbox`/botones hechos a mano |
| Combobox de entidades | 21 | `Select` de HeroUI con listas que crecen con la cartera |
| Combobox de catálogos largos | 17 | `Select` con 10–60 opciones fijas (zonas horarias, monedas, métricas…) |
| El `Combobox` actual (HeroUI) | 1 | `configuracion/organization-identity.tsx` |
| `DropdownMenu`, no `Command` | 5 | 4 `Dropdown` de HeroUI + 1 `role="menu"` a mano |
| Se quedan como están | ~20 buscadores de tabla y ~85 `Select` cortos | |

## 1. Paleta global ⌘K (la pieza que más aporta)

Un `CommandDialog` montado una vez en [portal-shell.tsx](../apps/web/src/components/portal-shell.tsx) (y
otro en [platform-admin-shell.tsx](../apps/web/src/components/platform-admin-shell.tsx) para `/admin`),
abierto con ⌘K / Ctrl+K y con un botón "Buscar… ⌘K" en la barra superior. Grupos:

| Grupo | Qué lista | De dónde sale |
|---|---|---|
| **Ir a** | Las secciones del menú que ve ese rol (94 enlaces en el árbol), con su grupo como pista ("Marketing › Flows") | [portal-navigation.ts](../apps/web/src/components/portal-navigation.ts), el mismo árbol que pinta la navegación: si cambia el menú, cambia la paleta |
| **Clientes** (consultor) | Cambiar el cliente activo, "Vista general" incluida | `clientSelectOptions` de portal-shell |
| **Tiendas** | Cambiar la tienda activa / "Todas las tiendas" | `storeSelectNode` / `ownStoreSelectNode` |
| **Acciones** | Crear tarea, nueva campaña, crear contenido, conectar integración, abrir avisos, marcar avisos leídos | Rutas y handlers que ya existen |
| **Preguntar a la IA** | "Preguntar al Consultor IA: «lo escrito»" como última opción siempre | Abre el copiloto con la pregunta, como hace hoy el botón "Consultor IA" |

Respeta los permisos sin lógica nueva: el árbol de navegación ya viene filtrado por rol (cliente,
consultor, platform_admin), así que la paleta solo enseña lo que el menú enseña. En móvil se abre desde
el botón de búsqueda; el juez de alcance de la app móvil decide aparte si la app la necesita.

## 2. Buscador en línea (4)

| Sitio | Hoy | Con `Command` |
|---|---|---|
| [copilot-panel.tsx:2511](../apps/web/src/components/copilot-panel.tsx#L2511) | `role="listbox"` a mano con los atajos `/informe`, `/comparar`, `/embudo`, `/margen`, `/campañas`, `/tareas`; solo Enter elige el primero, las flechas no mueven la selección | `CommandList` + `CommandItem` con su `CommandShortcut`: flechas, Enter y ratón, y `aria-activedescendant` bien puesto |
| [copilot-panel.tsx:2656](../apps/web/src/components/copilot-panel.tsx#L2656) | Historial: `Input` de búsqueda + botones agrupados por fecha a mano | Exactamente el ejemplo "Groups": `CommandInput` + `CommandGroup heading="Hoy"`… + `CommandEmpty` |
| [marketing/flows/flow-builder.tsx:1326](../apps/web/src/app/marketing/flows/flow-builder.tsx#L1326) | "Buscar pieza…" + rejilla de botones `aria-pressed` | `Command` con las piezas y su estado como pista |
| [marketing/weekly-mailing-planner.tsx:879](../apps/web/src/app/marketing/weekly-mailing-planner.tsx#L879) | "Buscar plantillas de referencia" + chips | `Command` con selección múltiple marcada con check |

## 3. Combobox: `Select` de entidades que crecen con la cartera (21)

Con 3 clientes un `Select` vale; con 40 hay que bajar hasta encontrarlo. Todos estos pasan a
`Combobox` (botón que abre un `Popover` con `Command`), con la misma API que el `Select` actual
(`value`, `onChange`, `options`) para que el cambio en cada sitio sea de una línea.

**Clientes (12)**

| Sitio | Etiqueta |
|---|---|
| [portal-shell.tsx:1272](../apps/web/src/components/portal-shell.tsx#L1272) | Cliente activo (barra superior; el más usado de la app) |
| [copilot-panel.tsx:2378](../apps/web/src/components/copilot-panel.tsx#L2378) | Cliente sobre el que preguntar |
| [admin/agentes/page.tsx:234](../apps/web/src/app/admin/agentes/page.tsx#L234) | Cliente para configurar agentes |
| [admin/observabilidad/page.tsx:915](../apps/web/src/app/admin/observabilidad/page.tsx#L915) | Filtrar por cliente |
| [configuracion/notifications-section.tsx:122](../apps/web/src/app/configuracion/notifications-section.tsx#L122) | Cliente a silenciar |
| [configuracion/page.tsx:882](../apps/web/src/app/configuracion/page.tsx#L882) | Cliente del que copiar |
| [consultor/objective-types.tsx:386](../apps/web/src/app/consultor/objective-types.tsx#L386) | Alcance (toda la cartera / un cliente) |
| [llamadas/calls-client.tsx:2230](../apps/web/src/app/llamadas/calls-client.tsx#L2230) | Filtrar por cliente |
| [marketing/page.tsx:2360](../apps/web/src/app/marketing/page.tsx#L2360) | Filtrar por cliente |
| [shopify/page.tsx:709](../apps/web/src/app/shopify/page.tsx#L709) | Filtrar por cliente |
| [tareas/page.tsx:1092](../apps/web/src/app/tareas/page.tsx#L1092) | Filtrar por cliente |
| [components/admin-consultant-detail.tsx:268](../apps/web/src/components/admin-consultant-detail.tsx#L268) | Cliente a asignar |

**Tiendas (9)**

| Sitio | Etiqueta |
|---|---|
| [portal-shell.tsx:1317](../apps/web/src/components/portal-shell.tsx#L1317) | Tienda (barra superior) |
| [portal-shell.tsx:1297](../apps/web/src/components/portal-shell.tsx#L1297) | Tienda propia activa |
| [informes/page.tsx:264](../apps/web/src/app/informes/page.tsx#L264) y [:359](../apps/web/src/app/informes/page.tsx#L359) | Tienda / Tienda del envío |
| [tareas/page.tsx:854](../apps/web/src/app/tareas/page.tsx#L854) | Tienda de la tarea |
| [shopify/diagnostico/health-references.tsx:183](../apps/web/src/app/shopify/diagnostico/health-references.tsx#L183) | Tienda |
| [shopify/diagnostico/intervention-effects-panel.tsx:149](../apps/web/src/app/shopify/diagnostico/intervention-effects-panel.tsx#L149) | Tienda |
| [admin/observabilidad/page.tsx:949](../apps/web/src/app/admin/observabilidad/page.tsx#L949) | Filtrar por tienda |
| [notificaciones/page.tsx:205](../apps/web/src/app/notificaciones/page.tsx#L205) | Tienda |

## 4. Combobox: catálogos largos (17)

| Qué | Sitios |
|---|---|
| Zonas horarias | [configuracion/notifications-section.tsx:331](../apps/web/src/app/configuracion/notifications-section.tsx#L331), [reuniones/staff-settings.tsx:148](../apps/web/src/app/reuniones/staff-settings.tsx#L148), [admin/onboarding/page.tsx:1185](../apps/web/src/app/admin/onboarding/page.tsx#L1185) |
| Monedas | [admin/onboarding/page.tsx:1184](../apps/web/src/app/admin/onboarding/page.tsx#L1184), [configuracion/page.tsx:958](../apps/web/src/app/configuracion/page.tsx#L958), [configuracion/organization-identity.tsx:142](../apps/web/src/app/configuracion/organization-identity.tsx#L142), [camino/page.tsx:2810](../apps/web/src/app/camino/page.tsx#L2810) y [:3556](../apps/web/src/app/camino/page.tsx#L3556) |
| Métricas y procedimientos | [camino/camino-create-panel.tsx:1225](../apps/web/src/app/camino/camino-create-panel.tsx#L1225), [camino/page.tsx:1678](../apps/web/src/app/camino/page.tsx#L1678), [tareas/page.tsx:268](../apps/web/src/app/tareas/page.tsx#L268), [tareas/page.tsx:773](../apps/web/src/app/tareas/page.tsx#L773) |
| Hitos de Mi Camino | [camino/page.tsx:1688](../apps/web/src/app/camino/page.tsx#L1688), [planificacion/calendario/page.tsx:451](../apps/web/src/app/planificacion/calendario/page.tsx#L451) |
| Campañas, envíos y cuentas | [marketing/draft-campaign-link.tsx:101](../apps/web/src/app/marketing/draft-campaign-link.tsx#L101), [marketing/mailing-delivery-panel.tsx:251](../apps/web/src/app/marketing/mailing-delivery-panel.tsx#L251), [marketing/meta-ad-plan-block.tsx:179](../apps/web/src/app/marketing/meta-ad-plan-block.tsx#L179) |
| Personas | [consultor/gestion.tsx:355](../apps/web/src/app/consultor/gestion.tsx#L355) (perfil), [:431](../apps/web/src/app/consultor/gestion.tsx#L431) (consultor), [configuracion/client-access-section.tsx:533](../apps/web/src/app/configuracion/client-access-section.tsx#L533) (nuevo propietario) |
| Agentes y consultores (admin) | [admin/observabilidad/page.tsx:932](../apps/web/src/app/admin/observabilidad/page.tsx#L932) y [:966](../apps/web/src/app/admin/observabilidad/page.tsx#L966), [admin/agentes/page.tsx:221](../apps/web/src/app/admin/agentes/page.tsx#L221) |

Más el `Combobox` de HeroUI de [organization-identity.tsx:132](../apps/web/src/app/configuracion/organization-identity.tsx#L132):
se rehace sobre `Command` y desaparece el único `ComboBox` de HeroUI.

**Regla para decidir:** `Select` si la lista es corta y fija (estado, rol, canal, intervalo, formato:
~85 sitios que se quedan); `Combobox` si puede pasar de ~10 opciones o crece con los datos.

## 5. Menús de acciones: `DropdownMenu`, no `Command` (5)

Tres o cinco acciones de una fila no necesitan buscador. Conviene sacar a la vez el `DropdownMenu` de
shadcn (mismo aspecto que el menú de la paleta: grupos, iconos, atajos, separador, acción destructiva
en rojo) para que "el menú que se abre" se vea igual en toda la app.

| Sitio | Hoy |
|---|---|
| [camino/camino-consultant.tsx:311](../apps/web/src/app/camino/camino-consultant.tsx#L311) | `ActionMenu` sobre `Dropdown` de HeroUI |
| [camino/page.tsx:451](../apps/web/src/app/camino/page.tsx#L451) | `RowMenu` sobre `Dropdown` de HeroUI (casi idéntico al anterior) |
| [consultor/gestion.tsx:836](../apps/web/src/app/consultor/gestion.tsx#L836) | Editar / Reanudar / Pausar / Eliminar cliente |
| [planificacion/calendario/page.tsx:647](../apps/web/src/app/planificacion/calendario/page.tsx#L647) | Menú de la acción del calendario |
| [marketing/flows/flow-builder.tsx:469](../apps/web/src/app/marketing/flows/flow-builder.tsx#L469) | "+ Añadir paso": `role="menu"` a mano, sin teclado |

## 6. Se quedan como están

- **Buscadores que filtran una tabla o rejilla** (`/tiendas`, `/tareas`, `/informes`, productos,
  promociones, campañas de Meta, emails de Klaviyo, banco de imágenes, `/mensajes`, cartera…): filtran
  lo que ya está en pantalla, no eligen un elemento. Siguen siendo `Input type="search"`.
- **`Select` cortos** (~85): estado, rol, canal, severidad, intervalos, días.
- **Selector de día y hora** de [reuniones/booking-dialog.tsx](../apps/web/src/app/reuniones/booking-dialog.tsx):
  es una rejilla de huecos, no una lista que se busca.

## El componente (propuesta)

- `components/ui/command.tsx` con la API de shadcn: `Command`, `CommandInput`, `CommandList`,
  `CommandEmpty`, `CommandGroup heading`, `CommandItem` (`onSelect`, `disabled`, `keywords`),
  `CommandSeparator`, `CommandShortcut` y `CommandDialog` sobre nuestro `Dialog`. Estilos
  `.ui-command` en globals.css, como el resto.
- **Nativo, sin dependencia nueva**, igual que `Accordion`, `Collapsible` y `Button`: patrón WAI-ARIA
  combobox + listbox (`aria-activedescendant`, ↑↓, Inicio/Fin, Enter, Escape), filtro sin acentos ni
  mayúsculas ("campana" encuentra "Campañas"). La alternativa es `cmdk`, que es lo que usa shadcn: menos
  código propio a cambio de una dependencia y de su forma de filtrar.
- `Combobox` reescrito encima (`Popover` + `Command`) con la API del `Select` actual.
- `useHotkey("mod+k")` en el shell para la paleta, que no salta mientras se escribe en un campo.
- Catálogo en `/componentes` con los ejemplos de la doc: básico, atajos, grupos y con scroll.

## Orden propuesto

1. `command.tsx` + catálogo.
2. **Paleta ⌘K** en los dos shells: lo que más se nota y no toca ninguna pantalla.
3. Copiloto: atajos `/` e historial (los dos `Command` en línea más visibles).
4. `Combobox` sobre `Command` y los 21 selectores de cliente y tienda, empezando por la barra superior.
5. Catálogos largos (17) y el `ComboBox` de HeroUI.
6. `DropdownMenu` y los 5 menús de acciones.
