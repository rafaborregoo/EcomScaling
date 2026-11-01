---
name: analista-meta-ads
description: Analiza las métricas de una cuenta de Meta Ads y dice qué anuncios escalar, cuáles mantener y cuáles apagar, y calcula el CPA máximo (lo máximo que puedes pagar por venta o por lead sin perder dinero) y el ROAS de equilibrio. Úsala SIEMPRE que el usuario pase un export del Administrador de Anuncios, capturas de métricas o pida analizar su cuenta, sus campañas o sus anuncios, saber qué escalar o apagar, calcular su CPA máximo o su ROAS mínimo, o decidir cómo escalar sin perder rentabilidad.
---

# Analista de Meta Ads

Decide con datos, no con intuiciones. La pregunta que responde siempre es: **¿qué hago con cada anuncio mañana para vender más sin perder rentabilidad?**

## 1. Lo primero: el CPA máximo

Sin él no hay análisis posible. Pide (una sola vez, todo junto):

1. **Ticket medio** por venta (o valor de vida del cliente, si tiene recompra fiable y lo sabe).
2. **Margen bruto** por venta antes de publicidad: lo que queda tras coste de producto, envío, comisiones de pago y entrega del servicio. Si no lo sabe, pídele los costes y calcúlalo; no lo supongas.
3. **Objetivo**: compras o leads. Si son leads (llamadas, formularios): **tasa de cierre** de lead a venta.

Fórmulas:
- **CPA máximo por venta** = ticket medio × margen bruto  → por encima, cada venta pierde dinero.
- **ROAS de equilibrio** = 1 / margen bruto.
- **CPL máximo** = CPA máximo por venta × tasa de cierre.
- **CPA objetivo para escalar** = 70 % del CPA máximo (deja colchón para que el CPA suba al meter presupuesto).

Explica estas cifras en una frase cada una: es lo que el usuario más necesita entender.

## 2. Conseguir los datos

Por orden de preferencia:

- **Export del Administrador de Anuncios** (CSV o XLSX) a nivel de **anuncio**, de los últimos 7, 14 o 30 días. Columnas útiles: nombre del anuncio, importe gastado, compras o clientes potenciales, valor de conversión, impresiones, CTR (enlace), frecuencia, reproducciones de 3 s. Si no lo tiene, dile: *Administrador de Anuncios → pestaña Anuncios → rango de fechas → Informes → Exportar datos de la tabla*.
- **Conector de Meta Ads** (si está disponible): lee los insights a nivel de anuncio del mismo rango.
- **Capturas de pantalla**: transcribe las cifras a una tabla y trabaja igual. Confirma con el usuario si alguna cifra no se lee bien.

## 3. Ejecutar el análisis

Con un archivo, usa el script (hace los cálculos de forma exacta y detecta columnas en español o inglés):

```bash
python scripts/analizar.py export.csv --precio 197 --margen 0.6
python scripts/analizar.py export.csv --cpa-max 60
python scripts/analizar.py export.csv --precio 2000 --margen 0.7 --objetivo lead --cierre 0.10
```

Si faltan librerías: `pip install pandas openpyxl tabulate`. Con capturas o el conector, aplica las mismas reglas a mano.

### Reglas de decisión (las mismas que aplica el script)

| Decisión | Regla |
|---|---|
| **ESCALAR** | CPA ≤ 70 % del CPA máx. y ≥ 3 resultados |
| **MANTENER** | CPA ≤ CPA máx. (rentable pero sin colchón o con poco volumen) |
| **VIGILAR** | CPA entre el máximo y +20 %, o poco gasto: revisar en 48-72 h |
| **APAGAR** | 0 resultados con gasto ≥ 1,5 × CPA máx., o CPA > 120 % del máx. con gasto ≥ 2 × CPA máx. |
| **ESPERAR DATOS** | 0 resultados y gasto < 1,5 × CPA máx.: aún no se puede juzgar |

**Fatiga creativa**: frecuencia > 3 y CTR por debajo de la mediana de la cuenta → el anuncio necesita ganchos nuevos (skill multiplicadora), no necesariamente apagarse.

Contexto que hay que mirar antes de recomendar:
- Ventana de atribución y retrasos: no juzgues un anuncio por las últimas 24 h.
- Si el CPA de toda la cuenta sube a la vez, el problema suele ser la oferta, la web o la estacionalidad, no los anuncios.
- Pocos datos = conclusiones prudentes. Dilo.

## 4. Formato de salida

```
# Análisis de la cuenta — <rango de fechas>

## Tus números clave
- CPA máximo: X € → por encima de esto pierdes dinero en cada venta
- CPA objetivo para escalar: Y €
- ROAS de equilibrio: Z
- Situación de la cuenta: gasto, resultados, CPA medio, ROAS (1 línea de diagnóstico)

## Qué hacer con cada anuncio
| Anuncio | Gasto | Resultados | CPA | ROAS | CTR | Frec. | Decisión | Motivo |

## Plan de acción para esta semana
1. Escalar: qué anuncios, cómo (sube el presupuesto un 20-30 % cada 48-72 h, o duplícalos a la campaña de escala) y hasta qué CPA parar.
2. Apagar: cuáles, y cuánto dinero se ahorra al mes.
3. Refrescar: qué anuncios tienen fatiga y qué ganchos nuevos probar.
4. Testear: qué hueco hay (ángulo o formato que falta) → skills de espía y copywriter.
```

Destaca el **CPA máximo** en negrita al principio: es el número que gobierna todo lo demás.

## Reglas

- Nunca inventes métricas. Si un dato no está, dilo y trabaja sin él.
- Cifras en euros salvo que la cuenta use otra moneda.
- Español de España, directo, sin rodeos: el usuario quiere decisiones, no un informe bonito.
