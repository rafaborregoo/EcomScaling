# **14\. Datos y Analítica**

## **14.1 Qué son**

Los **datos y la analítica** son el sistema encargado de:

* registrar lo que ocurre;  
* organizar la información;  
* medir resultados;  
* detectar cambios;  
* explicar causas;  
* comparar periodos;  
* generar conocimiento para tomar decisiones.

En vuestro caso, este sistema será además la base sobre la que razonará el consultor IA.

La pregunta central es:

> **¿Podemos confiar en los datos, entender qué significan y convertirlos en decisiones correctas?**

---

# **14.2 Datos no es lo mismo que información**

## **Dato**

Un valor aislado.

Ejemplo:

ROAS \= 3,2.

## **Información**

Dato con contexto.

Ejemplo:

> El ROAS de Meta fue 3,2 durante los últimos 7 días.

## **Insight**

Interpretación útil.

Ejemplo:

> El ROAS cayó de 4,1 a 3,2 debido principalmente a una subida del CAC en prospecting.

## **Decisión**

Acción derivada.

Ejemplo:

> No reducir presupuesto todavía; primero revisar el deterioro del CVR de landing porque CPM y CTR permanecen estables.

La IA debe recorrer:

**Dato → Información → Insight → Decisión**

---

# **14.3 Data Source**

**Fuente de datos.**

Sistema del que procede una información.

Ejemplos:

* Shopify;  
* Meta;  
* Klaviyo;  
* Google Ads;  
* GA4;  
* ERP;  
* banco;  
* WMS.

Toda métrica debería tener una fuente identificada.

---

# **14.4 Source of Truth**

**Fuente de verdad.**

Sistema considerado oficial para un determinado dato.

No tiene por qué existir una única fuente de verdad para todo.

Ejemplo:

### **Pedidos reales**

Shopify.

### **Gasto publicitario Meta**

Meta Ads.

### **Coste real de producto**

ERP.

### **Caja**

Banco / contabilidad.

---

# **14.5 Por qué importa la fuente de verdad**

Puede ocurrir:

Meta:

120.000 € revenue atribuido.

Shopify:

100.000 € revenue real.

No podemos decir que el negocio vendió 120.000 €.

Meta está midiendo atribución.

Shopify está registrando transacciones.

Son conceptos distintos.

---

# **14.6 Data Ownership**

Define quién controla y es responsable de cada conjunto de datos.

Puede existir ownership sobre:

* marketing;  
* producto;  
* finanzas;  
* operaciones.

En vuestro sistema, debería existir también ownership técnico sobre:

* integración;  
* calidad;  
* esquema;  
* definiciones.

---

# **14.7 Data Dictionary**

**Diccionario de datos.**

Documento que define:

* nombre de métrica;  
* significado;  
* fórmula;  
* fuente;  
* unidad;  
* frecuencia;  
* limitaciones.

Ejemplo:

### **New Customer CAC**

Definición:

Coste de adquisición / nuevos clientes.

Fuente:

Meta \+ Shopify.

Periodo:

mensual.

La IA debería consumir definiciones centralizadas.

---

# **14.8 Metric Definition**

Toda métrica debe tener una definición exacta.

Ejemplo:

“Revenue”

Puede significar:

* gross sales;  
* net sales;  
* revenue con impuestos;  
* revenue sin impuestos;  
* revenue atribuido.

Sin definición, el dato puede ser inútil.

---

# **14.9 Semantic Layer**

Capa que define de forma centralizada el significado de métricas y dimensiones.

Ejemplo:

Todos los módulos entienden exactamente qué significa:

* CAC;  
* AOV;  
* Net Revenue;  
* New Customer.

Esto evita inconsistencias.

---

# **14.10 Data Contract**

Contrato formal sobre cómo debe llegar un dato.

Puede definir:

* campo;  
* tipo;  
* unidad;  
* formato;  
* fuente;  
* obligatoriedad.

Ejemplo:

`order_total_net`

Debe ser:

* decimal;  
* moneda normalizada;  
* sin impuestos, si así se define.

---

# **14.11 Data Quality**

**Calidad del dato.**

Evalúa si los datos son:

* correctos;  
* completos;  
* consistentes;  
* actuales;  
* únicos;  
* válidos.

---

# **14.12 Accuracy**

**Exactitud.**

El dato refleja correctamente la realidad.

Ejemplo:

Shopify muestra 100 pedidos y realmente hubo 100\.

---

# **14.13 Completeness**

**Completitud.**

No faltan datos necesarios.

Ejemplo:

Si el 40 % de productos no tiene COGS:

no podemos calcular correctamente margen por producto.

---

# **14.14 Consistency**

**Consistencia.**

El mismo concepto no presenta valores incompatibles entre sistemas sin explicación.

---

# **14.15 Timeliness**

**Actualidad del dato.**

Un dato puede ser correcto pero demasiado antiguo.

Ejemplo:

Stock actualizado hace 24 horas.

Puede ser insuficiente para decisiones de publicidad en una tienda grande.

---

# **14.16 Uniqueness**

Un registro debería existir una sola vez cuando corresponde.

Duplicados pueden generar:

* doble revenue;  
* doble conversión;  
* métricas falsas.

---

# **14.17 Validity**

El dato cumple reglas esperadas.

Ejemplo:

Discount Rate:

150 %.

Probablemente inválido.

---

# **14.18 Data Freshness**

Tiempo desde la última actualización.

La IA debería conocerlo.

Ejemplo:

> Datos de Meta actualizados hace 15 minutos.

> Datos de costes actualizados hace 30 días.

No deberían tratarse igual.

---

# **14.19 Data Latency**

Retraso entre que ocurre un evento y está disponible para análisis.

Ejemplo:

Compra a las 12:00.

Data warehouse la recibe a las 12:10.

Latency:

10 minutos.

---

# **14.20 Real-Time Data**

Datos disponibles prácticamente en tiempo real.

Útiles para:

* stock;  
* incidencias;  
* campañas;  
* alertas.

---

# **14.21 Batch Data**

Datos actualizados por lotes.

Ejemplo:

una vez al día.

Adecuado para:

* ciertos análisis financieros;  
* cohortes;  
* reportes.

---

# **14.22 Granularity**

**Granularidad.**

Nivel de detalle del dato.

Ejemplo:

### **Baja granularidad**

Ventas mensuales.

### **Alta granularidad**

Venta por:

* pedido;  
* SKU;  
* cliente;  
* minuto.

La IA debe utilizar el nivel correcto para cada diagnóstico.

---

# **14.23 Dimension**

Variable utilizada para segmentar una métrica.

Ejemplos:

* país;  
* producto;  
* canal;  
* dispositivo;  
* campaña.

---

# **14.24 Measure**

Valor cuantitativo.

Ejemplos:

* revenue;  
* pedidos;  
* gasto;  
* margen.

---

# **14.25 Aggregation**

Agrupar datos.

Ejemplo:

Pedidos diarios → ventas mensuales.

Una agregación excesiva puede esconder problemas.

---

# **14.26 Average**

Promedio.

Puede ser peligroso cuando existen distribuciones muy diferentes.

Ejemplo:

AOV medio:

80 €.

Pero:

* 80 % pedidos: 40 €;  
* 20 % pedidos: 240 €.

El promedio oculta la estructura.

---

# **14.27 Median**

Valor central de una distribución.

Puede ser más representativo que el promedio en datos muy sesgados.

---

# **14.28 Percentile**

Indica posición dentro de una distribución.

Ejemplo:

P90 de tiempo de entrega:

6 días.

Significa que aproximadamente el 90 % de pedidos se entrega en 6 días o menos.

---

# **14.29 Distribution**

Distribución de valores.

La IA debería analizar distribuciones cuando un promedio pueda ocultar:

* extremos;  
* grupos;  
* anomalías.

---

# **14.30 Outlier**

Valor muy alejado del comportamiento normal.

Ejemplo:

Pedido de 15.000 € en una tienda cuyo AOV habitual es 70 €.

Puede distorsionar métricas.

---

# **14.31 Anomaly**

Comportamiento fuera del patrón esperado.

Ejemplo:

CVR habitual:

2,3 %.

Hoy:

0,4 %.

Puede existir:

* bug;  
* tracking;  
* campaña;  
* stock.

---

# **14.32 Anomaly Detection**

Sistema utilizado para detectar automáticamente anomalías.

Puede utilizar:

* reglas;  
* estadística;  
* modelos.

---

# **14.33 Threshold Alert**

Alerta basada en umbral.

Ejemplo:

> Avisar si CAC \> 40 €.

Simple pero útil.

---

# **14.34 Dynamic Threshold**

Umbral que se adapta al histórico.

Ejemplo:

Alertar si:

CAC supera significativamente su rango normal.

Puede ser más útil que un valor fijo.

---

# **14.35 Baseline**

Comportamiento utilizado como referencia.

Ejemplo:

Media de las últimas 8 semanas.

---

# **14.36 Benchmark**

Referencia utilizada para comparar.

Puede ser:

* histórico propio;  
* categoría;  
* objetivo;  
* mercado.

La prioridad debería ser normalmente:

> histórico y economía propia antes que benchmark genérico.

---

# **14.37 Period Comparison**

Comparación temporal.

Ejemplos:

* día contra día;  
* semana contra semana;  
* mes contra mes;  
* año contra año.

---

# **14.38 WoW**

**Week over Week**

Comparación con semana anterior.

---

# **14.39 MoM**

**Month over Month**

Comparación con mes anterior.

---

# **14.40 YoY**

**Year over Year**

Comparación con mismo periodo del año anterior.

Muy útil para negocios estacionales.

---

# **14.41 Comparable Period**

Periodo realmente comparable.

Ejemplo:

No deberíamos comparar:

Black Friday

contra:

una semana normal de octubre.

---

# **14.42 Seasonality Adjustment**

Ajustar análisis para tener en cuenta estacionalidad.

---

# **14.43 Moving Average**

Promedio móvil.

Ejemplo:

media de últimos 7 días.

Ayuda a suavizar ruido diario.

---

# **14.44 Trend**

Dirección sostenida de una métrica.

Puede ser:

* creciente;  
* decreciente;  
* estable.

---

# **14.45 Noise**

Variación aleatoria que no necesariamente representa un cambio real.

Una IA debe evitar reaccionar excesivamente al ruido.

---

# **14.46 Signal**

Cambio relevante que probablemente contiene información real.

---

# **14.47 Signal-to-Noise Ratio**

Relación entre información útil y variabilidad aleatoria.

En tiendas pequeñas suele existir más ruido porque hay menos volumen.

Esto será importante en Fase 2\.

---

# **14.48 Leading Indicator**

Métrica que puede anticipar resultados futuros.

Ejemplos:

* CTR;  
* Add to Cart;  
* stock disponible;  
* lead volume.

---

# **14.49 Lagging Indicator**

Métrica que confirma resultados después de que ocurren.

Ejemplos:

* revenue;  
* profit;  
* refunds.

---

# **14.50 KPI**

**Key Performance Indicator**

Métrica crítica para evaluar rendimiento.

No toda métrica es un KPI.

---

# **14.51 Vanity Metric**

Métrica que parece positiva pero aporta poco valor para decisiones.

Ejemplos posibles:

* seguidores;  
* impresiones;  
* likes;

si no tienen conexión con resultados.

---

# **14.52 North Star Metric**

Métrica central que representa valor generado.

No siempre existe una única métrica perfecta en ecommerce.

Un consultor avanzado debería evitar reducir todo el negocio a un solo número.

---

# **14.53 KPI Tree**

Árbol que conecta métricas.

Ejemplo:

Revenue

depende de:

Traffic  
× CVR  
× AOV

Cada una depende a su vez de otras variables.

---

# **14.54 Driver Tree**

Modelo similar que explica qué variables impulsan un resultado.

Ejemplo:

Profit

depende de:

Revenue  
− COGS  
− marketing  
− operations  
− fixed costs.

---

# **14.55 Metric Dependency**

Una métrica puede cambiar porque cambió otra.

Ejemplo:

CAC sube porque:

* CPC subió;  
* CVR cayó.

La IA debe seguir dependencias.

---

# **14.56 Root Cause Analysis**

Buscar la causa real detrás del cambio.

Ejemplo:

Revenue cae.

No concluir:

> “Marketing funciona peor.”

Primero descomponer:

* tráfico;  
* CVR;  
* AOV;  
* stock;  
* producto;  
* mix.

---

# **14.57 Diagnostic Analytics**

Responde:

> ¿Por qué ocurrió?

---

# **14.58 Descriptive Analytics**

Responde:

> ¿Qué ocurrió?

Ejemplo:

Revenue cayó 15 %.

---

# **14.59 Predictive Analytics**

Responde:

> ¿Qué probablemente ocurrirá?

Ejemplo:

riesgo de stockout en 10 días.

---

# **14.60 Prescriptive Analytics**

Responde:

> ¿Qué deberíamos hacer?

Esta será una de las capas más valiosas de vuestro consultor IA.

---

# **14.61 Analytics Maturity**

Podemos pensar en cuatro niveles:

1. Descriptive  
2. Diagnostic  
3. Predictive  
4. Prescriptive

Vuestro producto debería aspirar al cuarto.

---

# **14.62 Dashboard**

Interfaz que muestra métricas.

Un dashboard no es un consultor.

Un dashboard dice:

> CAC \= 37 €.

El consultor debería decir:

> El CAC ha subido por caída de CVR en móvil, especialmente en tráfico prospecting, y esta subida reduce el margen de seguridad frente al break-even CAC a solo 4 €.

---

# **14.63 Executive Dashboard**

Dashboard resumido para dirección.

Debe incluir pocas métricas de alto impacto.

---

# **14.64 Operational Dashboard**

Más enfocado a:

* stock;  
* fulfilment;  
* incidencias;  
* capacidad.

---

# **14.65 Marketing Dashboard**

Incluye:

* spend;  
* CAC;  
* CPM;  
* CTR;  
* ROAS;  
* creatives.

---

# **14.66 Financial Dashboard**

Incluye:

* revenue;  
* margin;  
* profit;  
* cash;  
* inventory;  
* forecast.

---

# **14.67 Single Pane of Glass**

Vista unificada de diferentes sistemas.

En vuestro caso:

Shopify \+ Meta \+ Klaviyo \+ datos internos.

Pero:

> unir dashboards no significa realmente integrar conocimiento.

---

# **14.68 Data Integration**

Combinar información de diferentes sistemas.

Ejemplo:

Meta campaign ID

→ Shopify customer/order

→ Klaviyo profile.

---

# **14.69 Entity Resolution**

Proceso de determinar si registros de varios sistemas corresponden a la misma entidad.

Ejemplo:

Cliente en Shopify y perfil en Klaviyo.

---

# **14.70 Customer Identity**

Identidad del cliente.

Puede representarse mediante:

* email;  
* customer ID;  
* phone;  
* external ID.

---

# **14.71 Identity Matching**

Relacionar diferentes identificadores.

Es difícil debido a:

* dispositivos;  
* cookies;  
* emails distintos;  
* privacidad.

---

# **14.72 Customer 360**

Vista unificada del cliente.

Puede incluir:

* pedidos;  
* gasto;  
* margen;  
* campañas;  
* emails;  
* soporte;  
* comportamiento.

---

# **14.73 Event**

Acción registrada.

Ejemplos:

* product\_view;  
* add\_to\_cart;  
* purchase;  
* email\_click.

---

# **14.74 Event Tracking**

Sistema que registra eventos.

---

# **14.75 Event Schema**

Define cómo se estructura cada evento.

Ejemplo:

`purchase`

puede contener:

* order\_id;  
* customer\_id;  
* value;  
* currency;  
* product\_ids;  
* timestamp.

---

# **14.76 Event Naming**

Los eventos deben tener nombres consistentes.

Evitar:

* `purchase`;  
* `Purchase`;  
* `order_completed`;

para representar lo mismo sin necesidad.

---

# **14.77 Event Properties**

Información adicional asociada a un evento.

Ejemplo:

Purchase:

* value;  
* currency;  
* country;  
* discount.

---

# **14.78 Timestamp**

Fecha y hora exacta.

Es fundamental para:

* secuencia;  
* atribución;  
* cohortes.

---

# **14.79 Timezone**

Zona horaria.

Puede causar diferencias entre plataformas.

Ejemplo:

Meta utiliza una zona.

Shopify otra.

Los resultados diarios pueden no coincidir.

---

# **14.80 Currency**

Moneda.

Un negocio internacional necesita normalización.

Ejemplo:

USD \+ EUR \+ GBP.

No pueden sumarse directamente.

---

# **14.81 Currency Normalization**

Convertir diferentes monedas a una moneda base.

Debe guardar:

* moneda original;  
* tipo de cambio;  
* valor normalizado.

---

# **14.82 Tax Normalization**

Definir si métricas incluyen:

* impuestos;  
* excluyen impuestos.

Debe ser consistente.

---

# **14.83 Gross vs Net Normalization**

Definir si revenue incorpora:

* refunds;  
* discounts;  
* shipping.

---

# **14.84 Data Normalization**

Proceso de convertir datos heterogéneos a un formato común.

Será crítico para vuestro software.

---

# **14.85 Canonical Model**

Modelo interno estándar.

Ejemplo:

Aunque Meta, Shopify y Klaviyo nombren diferente a una compra:

vuestro sistema la representa bajo un modelo común.

---

# **14.86 Raw Data**

Dato original recibido de la fuente.

Debe conservarse cuando sea viable.

---

# **14.87 Processed Data**

Dato transformado.

Ejemplo:

Revenue normalizado.

---

# **14.88 Derived Metric**

Métrica calculada a partir de otros datos.

Ejemplo:

CAC.

No viene directamente de Shopify.

Se deriva.

---

# **14.89 Lineage**

**Data Lineage — Linaje del dato**

Permite saber:

* de dónde vino;  
* qué transformaciones sufrió;  
* qué fórmula lo creó.

Para vuestro consultor es fundamental.

---

# **14.90 Metric Lineage**

Ejemplo:

Contribution Margin

proviene de:

Shopify Revenue  
− ERP COGS  
− Shipping Costs  
− Payment Fees  
− Meta Spend.

La IA debería poder explicar esto.

---

# **14.91 Traceability**

**Trazabilidad.**

Capacidad de reconstruir por qué se llegó a un dato o conclusión.

Ejemplo:

> “Recomiendo no escalar porque el CAC marginal está a 3 € del break-even.”

Debe poder mostrar:

* CAC;  
* fórmula;  
* costes;  
* periodo;  
* fuente.

---

# **14.92 Explainability**

Capacidad de explicar una conclusión.

No basta con:

> “La IA recomienda reducir inversión.”

Debe decir:

* qué detectó;  
* qué datos usó;  
* qué riesgo existe.

---

# **14.93 Confidence**

Nivel de confianza de una conclusión.

Ejemplo:

### **Alta**

Datos completos y consistentes.

### **Media**

Falta parte de información.

### **Baja**

Estimación basada en pocos datos.

La IA debería expresar incertidumbre.

---

# **14.94 Data Coverage**

Porcentaje del análisis cubierto con datos reales.

Ejemplo:

Tenemos:

* revenue;  
* spend;  
* orders.

Pero no:

* COGS.

Entonces:

margen no puede calcularse con alta confianza.

---

# **14.95 Missing Data**

Información ausente.

La IA debe reconocerla.

Nunca debería inventarla.

---

# **14.96 Estimated Data**

Dato estimado.

Debe etiquetarse como:

> estimación.

---

# **14.97 Observed Data**

Dato realmente observado.

---

# **14.98 Projected Data**

Dato proyectado hacia el futuro.

---

# **14.99 Observed vs Projected**

Nunca deben mezclarse.

Ejemplo:

LTV observado 90 días:

80 €.

LTV proyectado:

150 €.

No son equivalentes.

---

# **14.100 Reconciliation**

Proceso de comparar fuentes.

Ejemplo:

Shopify Purchases:

1.000.

Meta Purchases:

1.200.

Debe investigarse diferencia.

---

# **14.101 Revenue Reconciliation**

Comparar revenue entre:

* Shopify;  
* Meta;  
* Klaviyo;  
* ERP.

No buscamos necesariamente igualdad.

Buscamos explicar las diferencias.

---

# **14.102 Attribution Overlap**

Múltiples plataformas pueden atribuirse la misma venta.

Ejemplo:

Meta:

100 €.

Klaviyo:

100 €.

Google:

100 €.

Venta real:

100 €.

No existen 300 €.

---

# **14.103 Double Counting**

Contar dos veces la misma realidad.

Es uno de los principales riesgos de combinar plataformas.

---

# **14.104 Deduplication**

Eliminar duplicados mediante identificadores.

Ejemplo:

`order_id`.

---

# **14.105 Order ID**

Identificador único del pedido.

Debe utilizarse como clave cuando sea posible.

---

# **14.106 Customer ID**

Identificador único del cliente.

Puede complementarse con otros identificadores.

---

# **14.107 Campaign ID**

Identificador de campaña.

Es más fiable que utilizar solo nombre de campaña.

---

# **14.108 UTM**

Parámetros utilizados para identificar origen de tráfico.

Ejemplos:

* utm\_source;  
* utm\_medium;  
* utm\_campaign.

---

# **14.109 UTM Governance**

Reglas para nombrar UTMs de forma consistente.

Sin gobierno aparecen:

* Meta;  
* meta;  
* Facebook;  
* FB;

como cuatro canales distintos.

---

# **14.110 Attribution Model**

Regla utilizada para asignar crédito.

Debe estar documentada.

---

# **14.111 Platform Attribution**

Atribución reportada por la propia plataforma.

Tiene sesgos propios.

---

# **14.112 Independent Attribution**

Medición externa que intenta utilizar un criterio común entre canales.

---

# **14.113 Blended Measurement**

Analizar resultados globales.

Ejemplo:

Total Spend vs Total Revenue.

Reduce dependencia de atribución.

---

# **14.114 Incrementality Measurement**

Busca saber qué resultados fueron realmente causados por una acción.

Es una capa superior de medición.

---

# **14.115 Cohort Analysis**

Agrupar clientes por:

* fecha;  
* producto;  
* canal;  
* campaña;  
* oferta.

Permite estudiar calidad en el tiempo.

---

# **14.116 Segmentation**

Analizar métricas por grupos.

Una media global rara vez es suficiente.

---

# **14.117 Slice and Dice**

Explorar datos desde diferentes dimensiones.

Ejemplo:

CAC

por:

* país;  
* producto;  
* campaña;  
* dispositivo.

---

# **14.118 Drill Down**

Ir desde una métrica general hacia más detalle.

Ejemplo:

Revenue cayó.

↓ País

↓ Producto

↓ Canal

↓ Campaña.

---

# **14.119 Drill Up**

Volver desde detalle a nivel agregado.

---

# **14.120 Correlation**

Dos variables cambian juntas.

Ejemplo:

Frequency sube.

CTR baja.

Pero:

> correlación no demuestra causalidad.

---

# **14.121 Causation**

Una variable provoca realmente un cambio en otra.

Demostrarla suele requerir:

* experimentos;  
* evidencia adicional.

---

# **14.122 Confounding Variable**

Variable externa que explica aparentemente una relación.

Ejemplo:

Ventas y gasto publicitario suben simultáneamente durante Navidad.

Quizá parte del crecimiento proviene de estacionalidad.

---

# **14.123 Simpson's Paradox**

Un resultado agregado puede mostrar una tendencia opuesta a la existente dentro de sus segmentos.

La IA debe segmentar antes de concluir.

---

# **14.124 Attribution Bias**

Sesgo causado por el método de atribución.

---

# **14.125 Survivorship Bias**

Analizar solo quienes permanecen y olvidar quienes abandonaron.

Ejemplo:

Estudiar clientes VIP sin analizar todos los clientes adquiridos que nunca repitieron.

---

# **14.126 Selection Bias**

La muestra analizada no representa correctamente la población.

---

# **14.127 Recency Bias**

Dar demasiada importancia a datos recientes.

---

# **14.128 Confirmation Bias**

Buscar datos que confirmen una idea previa.

El consultor debería buscar también evidencia contraria.

---

# **14.129 Statistical Significance**

Indica evidencia estadística de diferencia.

Pero no significa:

> importancia económica.

---

# **14.130 Practical Significance**

Importancia real para el negocio.

Ejemplo:

Un test puede detectar una mejora estadísticamente significativa del 0,05 %.

Pero quizá no justifica el coste de implementación.

---

# **14.131 Confidence Interval**

Rango probable para una estimación.

Ayuda a expresar incertidumbre.

---

# **14.132 Sample Size**

Cantidad de observaciones.

En tiendas pequeñas:

* métricas diarias;  
* segmentos muy específicos;

pueden ser extremadamente ruidosos.

---

# **14.133 Data Sufficiency**

Determinar si existe suficiente información para tomar una decisión.

La IA debería poder responder:

> “Todavía no hay suficiente volumen para concluir esto con confianza.”

---

# **14.134 Minimum Detectable Effect**

Cambio mínimo que un experimento puede detectar razonablemente con la muestra disponible.

---

# **14.135 Forecasting**

Utilizar históricos y variables para predecir futuro.

Puede aplicarse a:

* revenue;  
* inventory;  
* CAC;  
* LTV;  
* cash.

---

# **14.136 Forecast Confidence**

Toda previsión debe incluir nivel de incertidumbre.

---

# **14.137 Scenario Forecasting**

En lugar de una única predicción:

* conservador;  
* base;  
* agresivo.

---

# **14.138 Model Drift**

Un modelo predictivo pierde precisión porque cambia el negocio.

Ejemplo:

comportamiento de clientes cambia después de una expansión internacional.

---

# **14.139 Data Drift**

La distribución de datos cambia.

Puede hacer que modelos antiguos dejen de funcionar.

---

# **14.140 Monitoring**

Supervisar continuamente:

* datos;  
* métricas;  
* integraciones;  
* modelos.

---

# **14.141 Observability**

**Observabilidad.**

Capacidad de entender el estado interno del sistema a partir de sus señales.

Para vuestro consultor debería incluir:

* datos;  
* integraciones;  
* cálculos;  
* recomendaciones;  
* errores;  
* confianza.

---

# **14.142 Data Observability**

Detectar problemas como:

* datos que dejan de llegar;  
* caída brusca de volumen;  
* campos nulos;  
* duplicados;  
* retrasos.

---

# **14.143 Pipeline**

Flujo mediante el que los datos pasan de:

Fuente  
→ Ingesta  
→ Transformación  
→ Almacenamiento  
→ Métricas  
→ IA.

---

# **14.144 Pipeline Failure**

Fallo en alguna etapa.

Ejemplo:

Meta deja de sincronizar.

El consultor debe saber que:

> el dato está incompleto.

No debería seguir emitiendo recomendaciones como si nada.

---

# **14.145 Data Health Status**

Cada fuente podría tener un estado:

* Healthy;  
* Delayed;  
* Partial;  
* Failed.

Esto debería ser visible para la IA y para administración.

---

# **14.146 Last Successful Sync**

Última sincronización correcta.

---

# **14.147 Sync Lag**

Tiempo transcurrido desde la última actualización.

---

# **14.148 Schema Change**

Una plataforma externa cambia:

* campo;  
* estructura;  
* API.

Puede romper pipelines.

---

# **14.149 Schema Validation**

Validar que la información recibida mantiene la estructura esperada.

---

# **14.150 Data Versioning**

Mantener versiones de:

* esquemas;  
* fórmulas;  
* definiciones.

Permite saber:

> qué lógica produjo un resultado histórico.

---

# **14.151 Metric Versioning**

Ejemplo:

CAC v1:

solo Meta Spend.

CAC v2:

Paid Media Total.

Los valores no deben mezclarse sin indicar versión.

---

# **14.152 Historical Consistency**

Cuando cambia una fórmula, debemos decidir si:

* recalcular histórico;  
* conservar versión anterior.

La IA necesita saberlo.

---

# **14.153 Audit Trail**

Registro de:

* dato;  
* cálculo;  
* modificación;  
* decisión.

Ejemplo:

Recomendación:

> Reducir campaña A.

Audit Trail:

* fecha;  
* datos;  
* regla/modelo;  
* usuario;  
* resultado.

---

# **14.154 Decision Log**

Histórico de decisiones del consultor.

Puede guardar:

* diagnóstico;  
* recomendación;  
* confianza;  
* evidencia;  
* resultado posterior.

Esto permite aprendizaje.

---

# **14.155 Recommendation Outcome**

Después de recomendar algo:

¿qué ocurrió?

Ejemplo:

IA recomendó aumentar presupuesto 20 %.

Resultado:

* revenue \+15 %;  
* contribution \+11 %.

El sistema debería aprender del resultado.

---

# **14.156 Feedback Loop**

Ciclo:

Datos  
→ Análisis  
→ Decisión  
→ Acción  
→ Resultado  
→ Nuevos datos.

Esto es esencial para un consultor 24/7.

---

# **14.157 Ground Truth**

Resultado real utilizado para evaluar una predicción o recomendación.

---

# **14.158 Model Evaluation**

Comparar:

* predicción;  
* realidad.

---

# **14.159 Recommendation Accuracy**

No debería medirse únicamente como “acierto/error”.

También puede evaluarse:

* impacto;  
* riesgo;  
* beneficio generado;  
* confianza.

---

# **14.160 Decision Confidence**

La IA debería ponderar:

* calidad de datos;  
* cantidad de información;  
* estabilidad histórica;  
* complejidad causal.

---

# **14.161 Evidence**

Datos concretos que respaldan una conclusión.

Cada recomendación importante debería tener evidencia.

---

# **14.162 Evidence Hierarchy**

No toda evidencia tiene el mismo peso.

Podemos priorizar:

1. datos transaccionales reales;  
2. experimentos;  
3. históricos consistentes;  
4. correlaciones;  
5. benchmarks;  
6. hipótesis.

---

# **14.163 Recommendation Priority**

Una recomendación puede clasificarse según:

* impacto esperado;  
* urgencia;  
* confianza;  
* esfuerzo;  
* riesgo.

---

# **14.164 Impact**

Valor económico potencial.

---

# **14.165 Confidence**

Grado de evidencia.

---

# **14.166 Effort**

Esfuerzo necesario.

---

# **14.167 Risk**

Posible impacto negativo.

---

# **14.168 Prioritization Score**

El sistema puede combinar estas variables.

Ejemplo conceptual:

Priority \= Impact × Confidence / Effort

No debe tratarse como una fórmula universal.

---

# **14.169 Alert Fatigue**

Demasiadas alertas hacen que ninguna importe.

El consultor debe evitar:

* avisar por cada pequeña variación;  
* generar ruido constante.

---

# **14.170 Severity**

Clasificación de importancia.

Ejemplo:

* info;  
* low;  
* medium;  
* high;  
* critical.

---

# **14.171 Urgency**

Qué tan rápido debe actuar el usuario.

No es lo mismo que impacto.

Ejemplo:

Stockout mañana:

alta urgencia.

Optimizar SEO:

baja urgencia.

---

# **14.172 Business Impact**

Cuánto dinero o riesgo puede representar una anomalía.

---

# **14.173 Opportunity Detection**

No todo análisis debe buscar problemas.

La IA también debe detectar:

* productos con potencial;  
* canales infrautilizados;  
* segmentos rentables;  
* oportunidades de pricing;  
* stock que puede escalar.

---

# **14.174 Problem Detection**

Detectar:

* deterioros;  
* riesgos;  
* errores;  
* pérdidas.

---

# **14.175 Diagnosis**

Determinar por qué ocurre.

---

# **14.176 Recommendation**

Proponer una acción.

---

# **14.177 Actionability**

Una recomendación debe poder ejecutarse.

Malo:

> “Mejora tu conversión.”

Bueno:

> “La principal fuga está entre carrito y checkout en móvil; revisa primero los costes de envío y errores del checkout antes de aumentar tráfico.”

---

# **14.178 Prescriptive Context**

La IA debe entender restricciones.

Ejemplo:

Una oportunidad puede existir, pero:

* no hay stock;  
* no hay caja;  
* margen insuficiente.

Por tanto no debe recomendarla todavía.

---

# **14.179 Cross-System Analysis**

Analizar información combinada.

Ejemplo:

Meta:

CAC sube.

Shopify:

CVR cae.

Klaviyo:

sin cambios.

Conclusión:

problema probablemente en adquisición/conversión, no retención.

---

# **14.180 Cross-System Causality**

Las mejores conclusiones aparecerán cuando conectemos sistemas.

Ejemplo:

Meta:

campaña escala.

Shopify:

Producto A acelera ventas.

Inventario:

quedan 8 días.

Finanzas:

reposicionar inventario requiere 40.000 €.

La recomendación debe considerar todo.

---

# **14.181 Data Enrichment**

Añadir información externa.

Ejemplos:

* clima;  
* competencia;  
* Google Trends;  
* calendario.

Puede mejorar análisis.

---

# **14.182 External Data Risk**

Los datos externos pueden ser:

* menos fiables;  
* incompletos;  
* difíciles de comparar.

Deben etiquetarse.

---

# **14.183 First-Party Data**

Datos propios del negocio.

Ejemplos:

* pedidos;  
* clientes;  
* emails;  
* comportamiento.

Son extremadamente valiosos.

---

# **14.184 Second-Party Data**

Datos compartidos directamente por un socio.

---

# **14.185 Third-Party Data**

Datos obtenidos de terceros.

Su disponibilidad y regulación pueden variar.

---

# **14.186 Privacy**

La analítica debe respetar:

* privacidad;  
* consentimiento;  
* minimización de datos;  
* normativa aplicable.

---

# **14.187 Data Minimization**

Recoger únicamente la información necesaria.

---

# **14.188 PII**

**Personally Identifiable Information**

Datos que pueden identificar a una persona.

Ejemplos:

* nombre;  
* email;  
* teléfono.

Deben tratarse con controles adecuados.

---

# **14.189 Sensitive Data**

Determinados datos requieren protección adicional.

El consultor debería evitar utilizar información personal innecesaria para decisiones comerciales.

---

# **14.190 Access Control**

No todos los usuarios deben tener acceso a todos los datos.

---

# **14.191 Role-Based Access Control — RBAC**

Permisos según rol.

Ejemplo:

Marketing:

campañas.

Finanzas:

márgenes y costes.

Admin:

vista completa.

---

# **14.192 Data Retention**

Cuánto tiempo se conservan los datos.

Debe existir política definida.

---

# **14.193 Data Deletion**

Capacidad de eliminar información cuando corresponda.

---

# **14.194 Data Security**

Protección frente a:

* acceso no autorizado;  
* pérdida;  
* modificación;  
* filtración.

---

# **14.195 Encryption**

Cifrado de datos:

* en tránsito;  
* en reposo.

---

# **14.196 Audit Logging**

Registrar accesos y cambios importantes.

---

# **14.197 Señales de buena salud**

* fuentes de verdad definidas;  
* métricas documentadas;  
* alta calidad de datos;  
* sincronizaciones fiables;  
* trazabilidad;  
* datos reconciliados;  
* poco double counting;  
* alertas útiles;  
* datos suficientemente frescos;  
* métricas segmentables;  
* decisiones respaldadas por evidencia.

---

# **14.198 Señales de mala salud**

* cada herramienta muestra una cifra distinta sin explicación;  
* revenue atribuido tratado como revenue real;  
* COGS incompleto;  
* datos duplicados;  
* UTMs inconsistentes;  
* integraciones que fallan silenciosamente;  
* decisiones tomadas con datos obsoletos;  
* dashboards con cientos de métricas;  
* ausencia de definiciones;  
* recomendaciones sin trazabilidad.

---

# **14.199 Problemas habituales**

## **Data Silos**

Cada herramienta contiene información aislada.

---

## **Metric Conflicts**

Dos equipos utilizan definiciones distintas.

---

## **Tracking Gaps**

Faltan eventos.

---

## **Duplicate Events**

Eventos duplicados.

---

## **Attribution Overlap**

Varias plataformas reclaman la misma venta.

---

## **Missing Costs**

Rentabilidad artificialmente alta.

---

## **Bad Naming**

Campañas, UTMs o eventos inconsistentes.

---

## **Stale Data**

Información desactualizada.

---

## **Broken Pipeline**

La sincronización deja de funcionar.

---

# **14.200 Causas posibles de datos incorrectos**

* API;  
* tracking;  
* timezone;  
* moneda;  
* duplicados;  
* schema change;  
* error humano;  
* permisos;  
* integración;  
* filtros.

---

# **14.201 Relaciones con otros sistemas**

## **Datos → Adquisición**

Sin datos fiables, CAC y ROAS pueden ser incorrectos.

---

## **Datos → Conversión**

Necesitamos eventos correctamente medidos.

---

## **Datos → Retención**

Cohortes requieren identidad e histórico.

---

## **Datos → Finanzas**

Los cálculos necesitan costes y revenue correctos.

---

## **Datos → Operaciones**

Stock y pedidos deben estar actualizados.

---

## **Datos → IA**

La calidad del razonamiento depende directamente de la calidad de la información.

---

# **14.202 Datos disponibles desde Shopify**

Shopify puede funcionar como fuente principal para:

* pedidos;  
* productos;  
* clientes;  
* revenue;  
* refunds;  
* discounts;  
* inventory.

---

# **14.203 Datos disponibles desde Meta**

Meta aporta:

* spend;  
* campañas;  
* anuncios;  
* métricas publicitarias;  
* atribución.

Debe mantenerse separado conceptualmente del revenue transaccional.

---

# **14.204 Datos disponibles desde Klaviyo**

Klaviyo aporta:

* perfiles;  
* flows;  
* campañas;  
* engagement;  
* eventos;  
* atribución CRM.

---

# **14.205 Datos adicionales recomendables**

Más adelante pueden resultar importantes:

* GA4;  
* Google Ads;  
* Search Console;  
* ERP;  
* WMS;  
* helpdesk;  
* reviews;  
* banco;  
* contabilidad;  
* marketplaces.

---

# **14.206 Qué debería calcular el consultor IA**

Como mínimo:

* freshness por fuente;  
* cobertura de datos;  
* reconciliación de revenue;  
* gaps;  
* duplicados;  
* calidad de métricas;  
* tendencias;  
* anomalías;  
* comparaciones;  
* cohortes;  
* segmentos;  
* drivers;  
* nivel de confianza.

---

# **14.207 Qué debería detectar el consultor IA**

### **Caso 1**

> Meta atribuye 128.000 € de revenue durante el periodo, pero Shopify registra 104.000 € de ventas totales. El dato de Meta no debe interpretarse como revenue incremental ni sumarse al revenue de Shopify.

### **Caso 2**

> El margen de contribución tiene baja confianza porque el 37 % de los SKUs vendidos no tiene COGS configurado.

### **Caso 3**

> El CAC parece haber caído un 22 %, pero la integración de Meta dejó de importar gasto durante seis horas. La mejora es artificial.

### **Caso 4**

> El revenue diario de Shopify permanece normal, mientras Meta reporta una caída abrupta de purchases. Existe una probable incidencia de tracking y no una caída real de ventas.

### **Caso 5**

> Existen pedidos duplicados en el modelo analítico debido a una reingesta de datos. El revenue agregado está sobreestimado.

### **Caso 6**

> La caída global del CVR se explica por un cambio en el mix de tráfico y no por deterioro dentro de los segmentos existentes.

### **Caso 7**

> El AOV medio subió significativamente debido a tres pedidos corporativos excepcionales. La mediana permanece estable.

### **Caso 8**

> Los datos de inventario tienen 18 horas de retraso. No existe suficiente frescura para recomendar un aumento inmediato del presupuesto de un SKU con stock limitado.

### **Caso 9**

> La definición de CAC utilizada actualmente incluye únicamente Meta, mientras la tienda también invierte en Google. El CAC está infraestimado.

### **Caso 10**

> La IA tiene evidencia suficiente para afirmar que existe una caída de Contribution Margin, pero no para determinar todavía la causa porque faltan los costes logísticos de la última semana.

---

# **14.208 Qué NO debería hacer la IA**

No debería afirmar:

> “Meta generó 100.000 €.”

Cuando realmente significa:

> “Meta se atribuye 100.000 €.”

Tampoco debería:

> combinar directamente cifras de plataformas diferentes.

Ni emitir recomendaciones críticas cuando:

* datos están incompletos;  
* integración está caída;  
* muestra es insuficiente.

Tampoco debería ocultar incertidumbre.

Debe poder decir:

> “No tengo suficiente información para concluirlo con alta confianza.”

---

# **14.209 Orden correcto de análisis**

Antes de diagnosticar un problema:

### **1\. Validar fuente**

¿De dónde viene el dato?

### **2\. Validar frescura**

¿Está actualizado?

### **3\. Validar cobertura**

¿Falta información?

### **4\. Reconciliar**

¿Existen conflictos?

### **5\. Segmentar**

¿Dónde ocurre realmente?

### **6\. Comparar**

¿Es ruido o cambio relevante?

### **7\. Buscar drivers**

¿Qué variables lo explican?

### **8\. Diagnosticar**

¿Qué causa es más probable?

### **9\. Recomendar**

¿Qué acción tiene mejor relación impacto/riesgo?

---

# **14.210 Regla fundamental**

La analítica no consiste en acumular dashboards ni métricas.

Consiste en construir una representación suficientemente fiable de la realidad para tomar mejores decisiones.

La pregunta incorrecta es:

> “¿Qué dicen los datos?”

La pregunta correcta es:

> **“¿Podemos confiar en estos datos, qué realidad representan, qué está cambiando, por qué está ocurriendo y con qué nivel de confianza podemos actuar?”**

Y para vuestro consultor IA:

> **Toda recomendación importante debe poder rastrearse hasta los datos, fórmulas, fuentes y supuestos que la justifican.**

