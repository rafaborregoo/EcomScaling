# Analítica del consultor: cartera con gráficos, paleta propia y trabajo en Klaviyo

Estado: implementado (2026-10-07). Diseño aprobado en el artifact
https://claude.ai/artifact/M2qPnpDT8kKFjPQwxjqkkR (datos ficticios).

Páginas: `/shopify`, `/shopify/productos`, `/shopify/promociones`, `/meta`, `/meta/campanas`,
`/klaviyo`, `/klaviyo/emails`.

## Qué hay

1. **Cartera con gráficos** (consultor sin cliente elegido) en `/shopify`, `/meta` y `/klaviyo`.
   `components/portfolio-attention.tsx` pinta, encima de la lista por urgencia que ya existía, el reparto
   por nivel y un gráfico de burbujas: eje Y = urgencia, eje X = peso en la cartera, color = nivel,
   clic = abrir al cliente (en Shopify, a la tienda). No calcula nada: cada burbuja es una fila de la lista.
   - Shopify: `GET /v1/consultant/stores` (`score`, `level`, `reasons`); peso = facturación de 30 días de
     `GET /v1/consultant/profitability` (la de /panel), unida por `connection_id`.
   - Meta: `GET /v1/consultant/meta-accounts`; peso = gasto.
   - Klaviyo: `GET /v1/consultant/klaviyo-accounts`; peso = nº de emails de la cuenta.
   - Sin peso conocido, esa cuenta queda en el eje izquierdo y el pie lo dice.
2. **Gráficos interactivos** (`components/ui/chart.tsx`): `AreaChart` admite `actions` (clic en un punto lo
   fija y enseña botones) y `onSelectRange` (arrastrar elige un tramo); `BarChart` admite `onBarClick`
   y resalta la barra; nuevo `BubbleChart`. Animación de entrada y punto activo en todos. Cableado hoy:
   los dos gráficos diarios de Meta (inversión y ROAS) con «Preguntar a la IA» sobre ese día.
3. **Paleta del consultor** en Analítica: `portal-shell` marca `#portal-content` con `data-module` y
   `data-role`; `client-pulse.module.css` aplica los tokens del consultor (grafito + mandarina) a
   `.root` cuando el módulo es `analitica` y el rol no es cliente. El cliente conserva petróleo + azafrán.
4. **Trabajar en Klaviyo** (`/klaviyo`, solo consultor): cuatro entradas (Campañas, Flows, Plantillas,
   Audiencias) que abren la sección de Marketing que ya hace ese trabajo, con cliente y tienda puestos.

## Trampas

- **No añadir `analitica` a la lista de módulos con `trabajo-theme`** en `portal-shell`: `/klaviyo` dejó
  el renderer sin responder en el navegador. La paleta va por `data-module` + `data-role`.
- Las migas de `/panel` y de Campañas se quitaron a petición de Rafa; el periodo del panel sigue.

## Pendiente

- Tabla de colores por indicador en la cartera (el diseño la tenía): hace falta que la API devuelva los
  indicadores por cliente (hoy solo hay `reasons`).
- Usar `actions`/`onSelectRange`/`onBarClick` en el resto de gráficos (ingresos de Shopify, Klaviyo,
  productos, promociones) y que el tramo elegido filtre las cifras de la página.
- Acciones propias en Klaviyo (duplicar, reenviar a no abiertos, pausar flows, crear segmentos) en vez de
  enlaces a Marketing; editar un flow con IA.
- Pausar y activar campañas de Meta desde NORA: no se ha construido (escribe en Meta).
- Páginas de lista (Productos, Promociones, Campañas Meta, Emails) con cartera: hoy piden elegir cliente.
