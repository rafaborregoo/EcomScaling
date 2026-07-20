# Changelog UX — FE-00 / FE-08

> Historial cronologico del diseno de UI/UX. La especificacion vigente (objetivo, principios, entregables
> pendientes, Definition of Done) vive en
> [`fases/FE-08-ui-ux-interfaz-dinamica.md`](fases/FE-08-ui-ux-interfaz-dinamica.md) — este archivo es
> solo el registro de como se llego ahi. Decisiones estructurales con consecuencias duraderas estan
> extraidas a ADRs (`docs/decisions/ADR-0009-role-based-navigation.md`,
> `docs/decisions/ADR-0010-global-client-store-context.md`); aqui queda el detalle de implementacion.

## 2026-07-19 — Bloque A: design system v1

Tokens centralizados en `globals.css` (`@theme` Tailwind v4: brand/edge/line/muted/surface/success/warn +
radios y focus visible global) con las 12 pantallas migradas de hex ad-hoc a utilidades semanticas (24
valores colapsados en 13 tokens). `packages/ui` con componentes base (Button, Card, Badge, Banner,
Field/Input/Select/Textarea, LoadingBlock/ErrorBlock/EmptyState, SyncStateBadge con los 6 estados de
sync) adoptados en el shell.

**Pase de pulido**: shell rediseñado (navegacion agrupada consultor-first; menu movil colapsable con
hamburguesa; sidebar fijo sticky; active state con acento de marca y `aria-current`; selector de "Cliente
activo" destacado en el header), login split-screen con panel de marca y responsive, estados vacios
guiados con CTA (dashboard -> conectar Shopify, panel consultor), loaders unificados a
LoadingBlock/ErrorBlock/EmptyState en las paginas operativas.

**Segundo pase**: configuracion migrada por completo al design system (Card/Field/Input/Button/Banner/
Badge), Button con tamaños sm/md, correccion de contraste AA (token `warn-deep` oscurecido a `#856400`),
correccion ortografica del castellano (acentos y ñ) en todo el texto visible del portal (13 archivos).

## 2026-07-19 — Rediseño v2 "Libro Mayor"

A peticion de Rafa: fuera cajas/cards y subtextos. Lenguaje editorial-financiero en todo el portal —
contenido plano sobre el lienzo con separadores de linea fina en vez de cajas con borde, tipografia como
jerarquia (serif para titulares via `next/font`, mono para cifras y micro-etiquetas small caps), esquinas
rectas, formularios subrayados, botones secundarios como enlaces subrayados, badges de punto de color,
banda de avisos con regla lateral. Dashboard con cifras protagonistas y tabs de periodo tipograficos.
`/conocimiento`: subida de documento con un boton (titulo = nombre de archivo, contenido leido en el
navegador). `packages/ui` v2 reescrito al mismo lenguaje.

Regla de estilo: sin subtextos explicativos bajo titulos (registrada como memoria persistente de sesion —
ver nota en "Fuente de verdad" mas abajo).

## 2026-07-19 — Ajuste v2.1

Una sola fuente estandar (Inter) para todo — fuera la serif de titulares; los tokens
`--font-sans/--font-mono/--font-display` apuntan todos a Inter (titulares en semibold con tracking
apretado, cifras con numeros tabulares via `tnum`). Blanco dominante con matices negros y rojos: sidebar
del shell, menu movil y panel izquierdo del login pasan de fondo negro a blanco con lineas finas; el
negro queda solo en botones y acentos. Eliminado el modo oscuro automatico (`prefers-color-scheme`).

## 2026-07-20 — Ajuste v2.2 (decision estructural, ver ADR-0009)

El portal ES el panel de consultor para admins/consultores — navegacion por rol ("Clientes" primero,
luego "Cliente activo" y "Datos del cliente"; los clientes ven su navegacion de siempre sin `/consultor`),
login y home `/` redirigen por rol. La pagina pasa a titularse "Clientes" con el nombre de cada cliente
clicable. Cambio de organizacion resuelto de raiz: el backend materializa memberships virtuales
(`platform_admin` -> todas las orgs, `consultant` -> sus `consultant_assignments` activas) en
`resolveAuthContext`.

## 2026-07-20 — Ajuste v2.3 (decision estructural, ver ADR-0010)

Feedback de Rafa: "no puedo moverme entre tiendas de una organizacion". Selector global de tienda Shopify
en el header, analogo al selector de cliente — `ActiveConnectionContext` alimentado por
`/shopify/overview` de la organizacion activa, persistido por organizacion en `localStorage`. El
dashboard, que antes agregaba todas las tiendas de la organizacion sin dejar elegir, pasa `connectionId`
a `/shopify/metrics`. `/shopify` migrada al mismo contexto compartido, con salvaguarda contra que el
fetch de tiendas del shell pise una seleccion ya valida en vuelo (deep-link).

Completado del Bloque B (parte determinista, consultor-first): selector global de organizacion en el
header (contexto React + localStorage; eliminados 5 selectores duplicados por pagina), vista consultor
multi-cliente ordenada por "que cliente necesita atencion hoy" (formula determinista en
`/v1/consultant/organizations`, ver FE-07), pagina `/conocimiento` (ingerir + busqueda semantica).

## 2026-07-20 — Ajuste v2.4

Feedback directo de Rafa: "me encuentro perdido". Componentes nuevos en `packages/ui`: `Combobox`
(selector personalizado boton+panel), `Tabs` (navegacion horizontal para partir paginas densas), `Pagination`
(paginado moderno con elipsis). Mini barra de contexto: nueva franja superior en el shell con "Cliente
activo" (solo consultor/admin), "Tienda" y rol/estado. Rendimiento al cambiar de cliente: nuevo endpoint
liviano `GET /shopify/connections` (evita las ~20 queries de conteo del overview completo solo para
poblar un dropdown), mas limpieza inmediata de estado al cambiar de organizacion. `/shopify` dividida en
negocio (`/shopify`) y tecnico (`/shopify/diagnostico`, con pestañas/tablas/paginacion). CRUD de clientes
en Consultoria: conteo de tiendas, editar organizacion, añadir tienda, borrar tienda/cliente con
confirmacion de nombre exacto (solo `platform_admin`).

Fix de fondo en los diagnosticos IA (A02/A04/A06, ver AI-05): mezclaban todas las tiendas de una
organizacion sin avisarlo; ahora respetan la tienda activa del selector.

## 2026-07-20 — Dashboard multi-tienda y sincronizacion

Vista "Todas las tiendas" en el dashboard (consultor/admin, cuando hay mas de una tienda) con
facturacion/pedidos/beneficio neto por tienda y cambio de tienda activa sin salir de la pagina. Selector
de periodo (7/30/90/Todo) compartido entre esa tabla y el resumen ejecutivo. "Cobertura Shopify" (dataset
por dataset) movida del dashboard a una pestaña en Configuracion, formato tabla compacta sin subtextos.
Cron de sincronizacion de Shopify cambiado de cada 6h a diario 2am (`Europe/Madrid`). Fix de bug real:
`PortalShell` se remontaba en cada navegacion (cada pagina lo declara por separado) y repetia el fetch de
bootstrap, tapando todo el shell con un loader — se anadio una cache en memoria para que solo ocurra en
la primera carga de la sesion.

## Nota sobre fuentes de verdad

Este historial reemplaza referencias sueltas a "registrado en memoria" que aparecian en versiones
anteriores de la documentacion de FE-08 — las decisiones de diseno viven aqui y en los ADRs
correspondientes, no en la memoria de sesion del asistente.
