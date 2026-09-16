# Plan: el panel del manager

Del dashboard manual (hoja "Ecom Dashboard" + captura de AceiteCordoba) al producto. La captura
de referencia tiene 27 elementos; hoy el producto cubre 9. Este documento es la cola de ejecución.

**Referencia visual**: KPI primarios con costes desglosados → unit economics por pedido → ratios →
ads → diagnóstico hablado → 4 gráficos.

**Regla de terminado** (memoria "DoD: contrato + motor + pixel"): ningún bloque está hecho sin
migración que escriba/calcule, API que lo exponga y pantalla que lo muestre. Las tres cosas o
ninguna.

---

## F1 · El motor financiero de verdad  ✅ HECHO · en producción

Migración `20260929093000_panel_motor_financiero_real.sql`, aplicada en desarrollo y en producción.

Golden test reescrito y en verde 4/4 contra Postgres real: el beneficio del escenario baja de
403,80 € a 143,80 € por los dos términos que faltaban — 160 € de IVA que nunca fue tuyo y 100 €
de publicidad que sí pagaste.

Una sola migración, porque los cinco arreglos tocan la misma función
(`shopify_financial_summary`) y partirlos significa reescribirla cinco veces.

### 1.1 Ingresos sin IVA

Hoy `net_sales = current_total_price − refunds`: lleva dentro el IVA y el envío que paga el
cliente. Lo llamamos "facturación neta" y no lo es.

- `net_revenue_ex_tax = current_total_price − refunds − current_total_tax`
- `tax_collected`, `shipping_charged` (`current_shipping_price`) salen como columnas propias.
- `vat_pct` de `organization_financial_settings` **no se usa** para esto: el impuesto real por
  pedido ya viene de Shopify. `vat_pct` queda solo para tiendas sin desglose fiscal (fallback).
- Cuidado documentado: `refunds` es importe total del reembolso, IVA incluido. Se resta entero de
  `current_total_price`, así que el neto sin IVA de un pedido reembolsado queda ligeramente
  infravalorado. Se acepta y se anota; corregirlo exige traer las líneas de reembolso.

### 1.2 Envíos reales, no plano

- Coste: `shipping_cost_rules` por tramo de importe, con fallback a `default_shipping_cost`. La
  tabla existe desde DB-03 y nunca se había leído. Las reglas por país no se aplican: los pedidos
  no guardan país (ver F3b).
- Ingreso: suma de `current_shipping_price`.
- `shipping_net = shipping_paid − shipping_charged` → la métrica "Envíos netos −1.453 €".

### 1.3 Ads dentro del beneficio  ← el fallo grave

`net_profit` no resta la inversión publicitaria. Con los números de la captura da 4.205 € en vez
de 1.810 €: **+132 %**. Y arrastra margen neto y break-even.

- Función nueva `ads_spend_summary(org, start, end, store)`: gasto real de todas las plataformas
  conectadas. Hoy solo Meta (`meta_insight_rows_daily`, scope por `meta_ad_accounts.store_id`);
  mañana Google entra por aquí sin tocar nada más.
- **ADR-0021 no lo prohíbe**: lo que no se suma entre plataformas es la *atribución*. El *gasto*
  es un coste real facturado, y sumarlo es la única forma de saber lo que ganas.
- `net_profit = net_revenue_ex_tax − COGS − fees − envío_pagado − fijos − ads_spend`.

### 1.4 Clientes nuevos y CAC blended

- `new_customers` se deriva en SQL: primer pedido por `customer_reference_hash` dentro del
  periodo. **No** se usa `is_first_customer_order`, porque el webhook no lo escribe y los pedidos
  que entran por webhook lo tienen a `null`.
- `cac_blended = ads_spend / new_customers` (el CAC de Meta sigue existiendo, etiquetado como
  atribuido — son dos cifras distintas y se muestran como tales).

### 1.5 Unit economics, MBEE y ROAS break-even

Todo por pedido, sobre las cifras ya calculadas:

| Métrica | Fórmula |
| --- | --- |
| `cogs_per_order` | COGS / pedidos |
| `shipping_per_order` | envío pagado / pedidos |
| `fixed_per_order` | fijos prorrateados / pedidos |
| `fixed_pct_revenue` | fijos / ingresos sin IVA |
| `cac_per_order` | ads / pedidos |
| `contribution_per_order` | AOV − cogs − envío − cac  (el "+8,39 €") |
| `mbee` | margen de contribución tras CAC (el "+1,51 €") |
| `breakeven_roas` | 1 / margen de contribución antes de ads (el "5,38") |

### Cómo se comprueba

`apps/api/src/db-03-financial-engine-golden.test.ts` fija hoy los números exactos del motor. La
migración lo rompe **a propósito**: se actualiza el escenario dorado con los términos nuevos
(IVA, envío cobrado, ads) y los valores recalculados a mano en la cabecera del test. Si el test
no se actualiza conscientemente, la migración no se cierra.

`npm run test:remote -w @ecomscaling/api` contra el proyecto de test.

---

## F2 · Serie mensual  ✅ HECHO · en producción

Migración `20261003090000_panel_serie_mensual.sql`. `shopify_financial_monthly(org, months_back,
store)` → una fila por mes con pedidos, ingresos sin IVA, beneficio, ads y clientes nuevos, del
mes en curso hacia atrás. Los meses vacíos salen a cero, no ausentes: el gráfico necesita la
barra a cero para que se vea el hueco.

**La fórmula no se reimplementa: se llama.** Un `lateral` sobre `shopify_financial_summary`, un
mes por fila. Copiarla aquí habría sido más rápido de escribir y garantizaba que algún día el
gráfico y la tarjeta de beneficio se contradijeran en la misma pantalla, delante de un cliente.
El test lo fija: el mes de marzo tiene que dar exactamente el mismo beneficio que la llamada
directa a ese periodo.

No hizo falta índice nuevo: el predicado calza con `shopify_order_facts_org_processed_idx`, que
ya existía. El término caro es el conteo de clientes nuevos, que recorre el histórico una vez por
mes; si algún día roza el `statement_timeout` de 8 s, la salida es materializar los primeros
pedidos por cliente, no duplicar la fórmula.

Golden test ampliado, 5/5 en verde.

---

## F3 · Contrato y API  ✅ HECHO

No hacía falta migración: `financial` se propagaba tal cual desde la RPC, así que los 18 campos
nuevos **ya viajaban** en la respuesta desde F1 — solo faltaba declararlos para que la pantalla
pudiera usarlos.

- `apps/api/src/shopify-metrics.ts`: tipo `financial` ampliado, más `financial_monthly` y
  `metric_targets`. Las dos consultas nuevas van en el mismo `Promise.all` y son **no fatales**:
  si fallan, el panel pierde el gráfico o el "vs objetivo", no se cae entero.
- Los objetivos viajan con las métricas y no se piden a `/financial-config`: una llamada en vez
  de dos, y sin depender de un endpoint restringido a owner/manager/consultor (el dashboard del
  cliente usa el mismo payload).
- El objeto de respuesta ahora va anotado con su tipo. Sin la anotación, TypeScript infería la
  forma del literal y el contrato de arriba no comprobaba nada. Ojo: el cliente de Supabase no
  lleva el genérico `Database`, así que se verifican las claves, no la forma de cada fila.

Comprobado: 322/322 unitarios (incluido uno nuevo para la selección de objetivos vigentes) y
10/10 de aislamiento entre clientes, con dos casos nuevos para `ads_spend_summary` y
`shopify_financial_monthly`. Ese último prueba además que un usuario autenticado normal puede
llamarlas: los `grant` y la cadena de RLS a través del `lateral` funcionan fuera del service role.

---

## F3b · Que los datos se puedan meter  ✅ HECHO

**Hecho**: el puente de costes (migración `20261004090000`, ya en producción), la carga masiva de
costes, los objetivos editables en `/configuracion` (API + pantalla) y la retirada del campo País.

**`vat_pct` se queda** (decisión de Rafa, 2026-09-16). Sobra para el beneficio —el impuesto real
viene en cada pedido desde F1— pero borrarlo cuesta una migración destructiva, tocar la vista del
gateway SQL de la IA (`20260718100000_db_08b_ai_sql_gateway.sql`), `ai-runtime.ts` y regenerar
tipos, a cambio de nada que el usuario vea. El riesgo que preocupaba —que alguien lo "arreglara"
aplicando el IVA dos veces— ya lo cubre un test: `db-03-financial-engine-golden.test.ts`, "el IVA
sale del pedido, no de `vat_pct`", con la columna sembrada al 21 % a propósito. Un test que falla
protege mejor que una columna que no está, y no rompe a quien lea esa tabla. Fuera de pantalla
sigue: `/configuracion` no lo edita.

### Carga masiva de costes

`POST …/shopify/product-costs/import`, con pegado de dos columnas desde Excel en `/shopify`.

Tres decisiones para que no pueda romper nada:

1. **Nunca escribe a la primera.** El botón pide previsualización (`dryRun`) y solo después
   aparece el de aplicar, diciendo cuántas líneas exactas va a escribir.
2. **Reimportar es seguro.** `product_costs` no tiene unique y el motor resuelve el coste con
   `order by valid_from desc limit 1`: dos filas del mismo artículo con la misma fecha harían que
   el COGS dependiera de cuál devolviera Postgres primero. Si ya hay coste de hoy, se actualiza.
3. **No se borra nada.** Los costes de días anteriores son el histórico con el que se valoran los
   pedidos viejos.

Lo que no se adivina: un SKU repetido en el pegado invalida **las dos** líneas (es una
contradicción del usuario), un SKU que existe en dos tiendas se deja sin tocar, y con comas de
separador un "3,40" se rechaza en vez de interpretarse. 16 tests entre el parser del pegado y la
clasificación de líneas.

Detalle de lo hecho:

- **Puente de costes**: `shopify_margin_summary` lee ahora `product_costs` y, si no hay fila que
  cubra la fecha del pedido, cae al `current_unit_cost` que Shopify ya reporta. La precedencia es
  ésa y no al revés: el sync nunca pisa lo que escribió una persona. `items_with_estimated_cost`
  declara cuántas líneas van por el respaldo, porque el coste de hoy aplicado a un pedido viejo es
  una aproximación y la pantalla tiene que poder decirlo.
- **Objetivos**: `upsertMetricTarget` / `retireMetricTarget` + tarjeta en `/configuracion` con
  diez claves fijadas por el producto (no texto libre: el panel busca por la clave exacta).
  Guardar es insertar y, si choca, actualizar — **no** `upsert`: la unicidad la da un índice sobre
  una expresión (`coalesce(store_id, …)`) que Postgres no puede inferir desde una lista de
  columnas. Comprobado contra la base: el `on conflict` daba `42P10` en cada guardado. Retirar es
  borrar, porque el CHECK `valid_until > valid_from` impide cerrar un objetivo el mismo día que se
  fija, y el trigger de auditoría ya guarda el `old_data`.
- Los objetivos de tienda ganan a los de la organización: la consulta los ordena para que el orden
  sea la regla de precedencia.

Medido en producción el 2026-09-15: el motor de F1 es correcto y aun así da un margen del 77,84 %
porque **no hay ni un solo coste de producto ni un gasto fijo cargado**. Un panel sobre esos
números es peor que no tener panel: parece exacto y no lo es.

Lo que ya se puede rellenar, en `/configuracion`:

- Costes por pedido (comisión %, comisión fija, envío medio) → alimenta `payment_fees` y el
  fallback de envío.
- Gastos fijos (alta, baja, periodicidad) → alimenta los fijos y el break-even.
- Reglas de envío por tramo → desde F1 **sí las lee el motor**.

Lo que falta:

1. **Los costes de Shopify no llegan al motor.** El sync ya pide `unitCost` y lo guarda en
   `shopify_inventory_items.current_unit_cost`, pero **nunca escribe una fila en `product_costs`**,
   y `shopify_margin_summary` solo lee `product_costs`. En producción: 44 artículos, 1 con coste en
   Shopify, **0 filas en `product_costs`** (la tabla está vacía entera). O sea que aunque el cliente
   rellene el coste en Shopify, el COGS sigue saliendo a cero. Es el arreglo más barato y el que más
   cambia el panel.
2. **Carga masiva de costes.** Hoy `/shopify` deja meterlos de uno en uno por SKU. Con 44 artículos
   es tedioso; con 400 es imposible.
3. **Objetivos por métrica.** `organization_metric_targets` se carga en `/configuracion`
   (`metric_targets: unknown[]`) y no se pinta ni se edita. Sin ellos, las tarjetas del panel no
   pueden mostrar "objetivo 30 %" ni "CAC ≤ 11,37 €", que es la mitad de lo que hace útil la cifra.
4. **El campo País de las reglas de envío no puede funcionar.** La UI lo pide, pero los pedidos no
   guardan país desde `20260910130000_shopify_customers_drop_location.sql` (dato protegido que se
   dejó de pedir a propósito). O se quita el campo, o se decide volver a solicitar ese acceso. Hoy
   la pantalla promete algo que el motor no puede cumplir.
5. **`vat_pct` sobra.** Se carga en `/configuracion` pero no se edita, y tras F1 el IVA sale del
   propio pedido. ~~Retirarlo del modelo~~ → cerrado el 2026-09-16: se queda, el doble IVA lo
   guarda un test. Ver F3b.

## F4 · El panel  ✅ HECHO

**Ruta nueva `/panel`, solo del consultor** (decisión de Rafa, 2026-09-15). No se toca el
dashboard del cliente. El panel dice cosas que hay que saber interpretar — un CAC de break-even,
un margen de contribución por pedido — y en manos de un cliente sin contexto asustan o se
malinterpretan.

Ruta nueva y no una pestaña más del dashboard por dos razones: `dashboard/page.tsx` ya tiene 3.262
líneas, y el panel se entra a mirar entero, no se cruza de paso. Va segundo en el nav del
consultor, pegado al Dashboard, porque es su versión de asesoramiento.

### Distribución

El orden no es decorativo: es el orden en el que se diagnostica una tienda.

1. **Lo que invalida el panel, arriba del todo.** Sin costes de producto ni gastos fijos, el
   beneficio es ficción. Eso no puede ir en una nota al pie: va en un aviso antes de la primera
   cifra, con los dos enlaces para arreglarlo.
2. **Cuánto ganas** (4 tarjetas) — beneficio neto, ingresos sin IVA, pedidos + clientes nuevos, y
   costes totales con su desglose.
3. **Cada pedido** (5 cifras) — ticket medio, producto, envío, fijos y lo que deja tras captarlo.
4. **Publicidad** (4 cifras) — inversión con desglose por plataforma, CAC real contra su techo,
   margen tras CAC, y ROAS real contra el de break-even.
5. **Tres cifras sueltas** — conversión, envíos netos y margen neto.
6. **Dos gráficos** — ingresos y beneficio por mes (12 meses) y a dónde va el dinero (barras
   horizontales, de mayor a menor).

Los objetivos de F3b se pintan como insignia junto a la cifra que juzgan, con la dirección
correcta: en el CAC cumplir es estar por **debajo**.

### Derivaciones aparte, con test

`panel-view-model.ts` + 11 tests: desglose de costes, estado contra objetivo, etiqueta de mes y
variación contra el periodo anterior. Un fallo ahí no rompe nada visible — pinta un número
equivocado con aspecto de correcto.

Dos trampas fijadas por test: la etiqueta del mes se lee de la cadena y **no** con `new Date()`
(una fecha sin hora es medianoche UTC y en España sale el mes anterior — ya se comió una
comprobación de la serie mensual), y la variación contra un periodo anterior en pérdidas da una
mejora, no un porcentaje negativo.

### Lo que NO entró

Recurrencia, cohortes, atribución por canal, recuperación de carrito, coste de descuentos y valor
de cliente siguen existiendo solo en SQL y para los agentes. El panel se queda en la ruta del
dinero; sacarlos a pantalla es trabajo aparte y no depende de nada de esto.

El embudo sigue en sesiones → pedidos (F5).

---

## F5 · Embudo  ✅ HECHO · en producción

Migración `20261010090000_embudo_paso_de_pago_iniciado.sql`.

**El `raw` no traía los pasos.** La idea del plan era que la respuesta cruda de ShopifyQL ya los
tuviera sin modelar. Comprobado en producción: `{"day", "sessions", "online_store_visitors"}` y
nada más, porque es exactamente lo que pide la consulta.

**Primer intento, con dato propio (20261010090000).** `shopify_abandoned_checkouts` no lista ni un
checkout con `completed_at`: Shopify solo guarda los que se quedaron sin terminar. De ahí
`pagos iniciados = checkouts abandonados + pedidos`, sin doble conteo. Servía, pero mezclaba dos
unidades en la misma columna de porcentajes. **Superado por 20261015090000**, abajo.

**Segundo, "añadir al carrito" (20261014090000).** Aquí se acabó el bloqueo: no hizo falta sondear
la API porque la referencia del schema `sessions` publica los identificadores exactos, y ninguno de
los que iba a probar a ojo (`cart_sessions`, `view_sessions`…) era el bueno.

**Y la costura se cerró el mismo día.** Migración `20261015090000_embudo_de_una_sola_fuente.sql`,
en test y en producción. El esquema `sessions` publica los cuatro pasos en la misma unidad —visitas
a la tienda online—, así que el embudo entero pasa a salir de ahí:

| Paso | Métrica |
| --- | --- |
| Sesiones | `sessions` |
| Añadió al carrito | `sessions_with_cart_additions` |
| Llegó al pago | `sessions_that_reached_checkout` |
| Compró | `sessions_that_completed_checkout` |

**El apaño de los checkouts abandonados queda jubilado dentro del embudo.** El bloque de sync y la
tabla siguen (son su propia función); lo que se retira es su uso como paso, que nunca fue su
trabajo. `shopify_funnel_summary` ya solo lee `shopify_sessions_daily`.

**«Compró» no son los pedidos**, y por eso se llama así. Los pedidos incluyen los demás canales:
un paso medido en pedidos detrás de uno medido en visitas puede dar más del 100 % del anterior sin
que nadie se haya equivocado. Los pedidos del periodo tienen su propia tarjeta.

**Las tres métricas viajan juntas o no viajan.** Una sola consulta, y `funnel_data_since` exige las
tres no nulas: medio embudo es peor que ninguno, porque la caída sale donde no está. Sin ellas
queda la vista corta, sesiones y pedidos, que es lo único afirmable entonces.

**Backfill**: un sync completo de la tienda trae 365 días de golpe. Hasta entonces el panel explica
por qué faltan los pasos en vez de pintarlos a cero.

Pantalla: tarjeta de embudo en `/panel`, barras horizontales con la caída respecto al paso
anterior. 17 tests en el view-model, cinco de ellos del embudo, más cuatro en la API para la regla de null-vs-cero.

**La cautela sobre el 93 % de finalización queda resuelta de raíz**: ese número salía de dividir
pedidos entre checkouts abandonados + pedidos, o sea de mezclar dos fuentes. Ahora el paso lo da
Shopify con la misma unidad que el resto.

---

## F6 · YoY  ✅ HECHO

Sin migración: dos RPC más (ventas y financiero) sobre la misma ventana desplazada un año, no
fatales como el resto de añadidos.

**Va junto al delta del periodo anterior, no en su lugar.** Responden preguntas distintas: en una
tienda con temporada, "agosto contra julio" puede caer y ser una temporada excelente, y "agosto
contra el agosto pasado" es el único que lo dice. Las cuatro tarjetas principales llevan las dos
insignias.

**El desplazamiento es por calendario, no restando 365 días.** Con la resta fija, un año bisiesto
de por medio corre la ventana un día y el "mismo periodo" deja de serlo. Y el 29 de febrero se
lleva al 28, porque `setUTCFullYear` por sí solo lo desbordaría al 1 de marzo, que ya es otro
mes. Cuatro tests lo fijan.

**Sin año pasado no se enseña nada.** Si en esa ventana no hubo pedidos, la comparación sería
"+∞ % contra cero", que no informa: el bloque viaja como `null` y la insignia no aparece.

### La preocupación de rendimiento, medida

Llevaba tres fases avisando de que `shopify_financial_summary` recorre el histórico completo para
contar clientes nuevos, y que el panel la llama muchas veces. Medido en producción (789 pedidos):

| Llamada | Tiempo |
| --- | --- |
| Financiero, periodo actual (en frío) | 293 ms |
| Financiero, periodo anterior | 48 ms |
| Financiero, año anterior | 57 ms |
| Serie mensual (12 periodos por dentro) | 201 ms |
| Embudo | 93 ms |

Van en paralelo, así que el techo es la más lenta: ~300 ms contra un `statement_timeout` de 8 s.
A esta escala no es un problema. El plan si algún día lo fuera sigue siendo el mismo: materializar
el primer pedido por cliente, no duplicar la fórmula.

---

## F7 · Dinero sobre la mesa  ✅ HECHO

Sin migración ni API: todo se deriva de lo que el panel ya recibe. Tarjeta nueva en `/panel`.

Es la cifra que un consultor le va a decir a un cliente en voz alta, así que se construye con
tres reglas duras:

1. **Solo con objetivo puesto.** Sin objetivo no hay escenario. No se inventan "medias del
   sector": el número tiene que poder defenderse delante del cliente, y para eso alguien ha
   tenido que decidirlo. Sin objetivos, la tarjeta manda a `/configuracion` en vez de rellenar.
2. **Todo en euros de beneficio al mes.** Mezclar euros de facturación con euros de beneficio en
   la misma lista es como se construye una cifra bonita que no significa nada. El periodo se
   normaliza a un mes medio de 30,44 días — el mismo divisor que el prorrateo de gastos fijos —
   así que mirar 90 días no triplica la oportunidad.
3. **Solo si vas por debajo.** Una métrica que ya cumple sale de la lista en vez de restar.

Cada escenario lleva su cuenta en palabras ("100 pedidos más con el mismo tráfico, a 20 € de
margen cada uno") para poder discutirla.

### Las tres palancas

| Palanca | Cuenta |
| --- | --- |
| Margen neto al objetivo | puntos que faltan × facturación sin IVA |
| Conversión al objetivo | pedidos extra con el mismo tráfico × contribución por pedido |
| CAC al objetivo | ahorro por cliente × clientes nuevos |

**El ticket medio se queda fuera a propósito.** Subirlo da más facturación, pero cuánto de eso es
beneficio depende de si sube por precio (casi todo) o por unidades (casi nada, porque el producto
cuesta). Sin saber cuál, el número sería inventado. El "email al 40 %" de la captura tampoco
entra: la atribución de Klaviyo no viaja en este payload y por ADR-0021 no se suma a nada.

**La tarjeta desaparece si el COGS es cero.** Un "dinero sobre la mesa" calculado sobre un margen
ficticio es exactamente la cifra que no puede salir de aquí.

Once tests nuevos en el view-model (22 en total).

---

## F8 · Google Ads  ⏸ APARCADO

**Aparcado por decisión de Rafa (2026-09-16): no se despliega ahora, se hará más adelante.** Lo de
abajo queda como el estudio hecho, no como trabajo en curso.

**Sí es posible.** La API existe, es estable y da lo que necesitamos (gasto, conversiones, coste
por conversión por campaña/día). El trabajo técnico es el de siempre; lo que manda el calendario
son los permisos de Google.

Lo que hace falta antes de escribir código:

1. **Developer token** con acceso *Basic*, pedido desde una cuenta de Google Ads Manager (MCC).
   Google lo revisa a mano: días, a veces semanas, y puede pedir explicación del uso. Con acceso
   *Test* se puede desarrollar contra cuentas de prueba mientras tanto.
2. **Cliente OAuth** en Google Cloud con el scope `adwords`, y verificación de la app (pantalla
   de consentimiento) para que la use gente fuera del equipo.
3. **El cliente concede acceso** a su cuenta, igual que en Shopify/Meta.

Y luego, ADR-0006 desde el primer commit: tablas con upsert in-place, sync por bloques con su
fila en `integration_sync_runs`, import completo + incremental con el mismo código, backoff ante
rate limiting, métricas en SQL `stable`, escrituras con service role.

Encaje: `ads_spend_summary` de F1.3 ya suma por plataforma. Cuando Google entre, la inversión
total y el CAC blended se corrigen solos sin tocar el panel. La atribución de Google **no se
suma** a la de Meta (ADR-0021): cada cifra con su ventana y su fuente.

**Bloqueador externo, no técnico.** Va a `BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`. El paso 1 (el
developer token) es el que tarda semanas y no depende de nosotros: se puede pedir cualquier día,
también ahora que F8 está aparcada, para que el reloj corra mientras tanto.

---

## Fuera de alcance

- **Horas ahorradas / tareas entregadas** como KPI: no hay dato que lo sostenga. Las tareas sí
  existen (`tasks`), las horas serían inventadas. Si se quiere la banda de valor del servicio,
  primero hay que decidir de dónde sale el número.
