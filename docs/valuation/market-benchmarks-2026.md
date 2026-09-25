# Benchmarks de mercado para valorar un SaaS y presupuestar su continuidad

**Ámbito:** España/Europa, con comparables globales cuando el mercado es transfronterizo  
**Fecha de corte y consulta:** 24 de septiembre de 2026  
**Objetivo:** aportar referencias externas para una valoración de E-NORA. Este documento **no es por sí solo una tasación del repositorio**; debe combinarse con la auditoría técnica, el estado comercial y la titularidad jurídica de los activos.

## Resumen ejecutivo

### Hechos observados

1. En 2025, los SaaS rentables vendidos en Acquire.com cerraron a una **mediana de 3,9 veces el beneficio anual**. Por precio, el informe muestra aproximadamente **3,7x por debajo de 100.000 USD** y **3,9x entre 100.000 y 1 millón USD**. Son operaciones reales de un marketplace, no valoraciones teóricas.
2. Ese múltiplo **no sirve para un producto sin ingresos o sin beneficio normalizado**. Acquire.com indica que los compradores de pre-revenue son menos numerosos y que su admisión ordinaria exige, entre otros criterios, un precio inferior a **25.000 USD**. Es una regla del marketplace, no un techo universal de valor estratégico.
3. Los múltiplos de ARR de SaaS privados —por ejemplo, 4,8x para bootstrapped y 5,3x para financiados según el modelo 2025 de SaaS Capital— presuponen **ARR, crecimiento y retención medibles**. No son comparables válidos para un activo pre-revenue.
4. En Europa, los SaaS cotizados operaban en 2025 alrededor de **6x ingresos futuros**, frente a 7,2x en EE. UU.; un índice nórdico/europeo de compañías públicas pequeñas y medianas marcó **3,0x EV/ventas LTM** en Q1 2025. Son referencias de compañías operativas, no de código sin validar.
5. Las tarifas visibles en Malt España en 2026 sitúan a perfiles experimentados aproximadamente entre **300 y 416 €/día**, y a perfiles de más experiencia entre **335 y 610 €/día**, según especialidad. Estas tarifas permiten estimar el coste actual de recrear, mantener, auditar y transferir el producto.
6. Para un SaaS operativo con ingresos, la encuesta 2026 de SaaS Capital sitúa la mediana de gasto en **22% de ARR para I+D**, **9% para soporte/customer success**, **5% para hosting** y **4% para DevOps**. Estos porcentajes sirven para una empresa con ingresos; antes de tener ARR hay que presupuestar capacidad mínima en euros, no porcentajes.
7. No existe evidencia de mercado que permita afirmar que validar dos integraciones concretas añade automáticamente **17.000–25.000 €** al precio. La validación reduce riesgo y puede desbloquear compradores, pero el incremento debe salir de escenarios de clientes, ARR, margen, retención y costes pendientes.

### Inferencia para una tasación de este proyecto

Mientras no haya ingresos recurrentes y clientes verificables, la base más defendible es:

> **Valor del activo = coste actual de sustitución útil − trabajo pendiente − obsolescencia/deuda técnica − costes de transferencia − descuento por falta de prueba comercial + prima estratégica demostrable.**

Debe contrastarse con dos límites:

- **Límite de mercado/liquidación:** lo que paga el mercado abierto por activos pre-revenue comparables.
- **Límite económico del comprador:** el valor actual de los flujos o ahorros que un comprador concreto puede justificar.

El coste histórico y el número de líneas de código no equivalen al valor de mercado. El conocimiento de dominio, documentación y automatizaciones solo añaden una prima si son transferibles, comprensibles, vigentes y reducen tiempo o riesgo para el comprador.

## 1. Múltiplos de adquisición que sí tienen respaldo

| Segmento | Referencia observada | Uso correcto | Limitaciones |
|---|---:|---|---|
| SaaS rentable, normalmente EV < 10 M USD, Acquire.com 2025 | **3,9x beneficio, mediana**; promedio en la zona baja-media de 4x | Aplicar a SDE/beneficio anual normalizado y verificable | Datos anonimizados de la plataforma; sesgo hacia SaaS rentable y vendible |
| Acquire.com, tramo de precio < 100.000 USD | **3,7x beneficio** | Micro-SaaS rentable | La cifra segmenta por precio, no por geografía ni producto |
| Acquire.com, tramo 100.000–1 M USD | **3,9x beneficio** | SaaS pequeño rentable | No extrapolar a pre-revenue |
| FE International, SaaS pequeño gestionado por propietario, 2026 | **2,5–4,0x SDE** | Control cruzado para negocios con beneficio | Guía de asesor M&A; no es una base pública completa de operaciones |
| SaaS Capital, privado B2B, modelo 2025 | **4,8x ARR bootstrapped; 5,3x financiado** | SaaS con ARR, crecimiento y NRR fiables | Resultado de un modelo, no mediana de cierres; empresas de mayor madurez |
| GP Bullhound, SaaS público europeo, 2025 | **~6x forward revenue** vs. **~7,2x EE. UU.** | Contexto macro y diferencia regional | Compañías cotizadas; no comparable directo con micro-SaaS |
| Translink, índice público nórdico/europeo Q1 2025 | **3,0x EV/LTM sales**; M&A nórdico **4,5x EV/sales** en 62 operaciones | Contexto europeo | Small/mid-cap pública y operaciones nórdicas; no España ni pre-revenue |

**Fuentes:**

- [Acquire.com — Acquisition Multiples Report, enero de 2026](https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/) y [PDF del informe](https://blog.acquire.com/wp-content/uploads/2026/02/Acquire.com-Multiples-Report-2025.pdf), publicado el 11-02-2026 y actualizado el 01-09-2026.
- [Acquire.com — recap del informe 2025](https://blog.acquire.com/acquisition-multiples-report-2025-findings-webinar-recap/), 20-03-2026, actualizado el 09-04-2026. Señala más de 136 operaciones con precio y múltiplo y un estándar de 3–5x beneficio neto.
- [FE International — SaaS Due Diligence Checklist](https://www.feinternational.com/blog/saas-due-diligence-checklist-buyers), 13-04-2026.
- [SaaS Capital — 2025 Private SaaS Company Valuations](https://www.saas-capital.com/blog-posts/private-saas-company-valuations-multiples/), 24-01-2025. Su encuesta subyacente superó 1.500 compañías privadas B2B SaaS.
- [SaaS Capital — metodología de valoración, actualización 2026](https://www.saas-capital.com/research/whats-your-saas-company-worth/). Identifica mercado de capitales, crecimiento de ARR y NRR como las tres entradas principales.
- [GP Bullhound — European SaaS Report 2025](https://www.gpbullhound.com/articles/european-saas-report-2025/), 16-12-2025; incluye más de 100 SaaS privados europeos en sus benchmarks operativos.
- [Translink Corporate Finance — SaaS Valuation Insights Q1 2025](https://translinkcf.fi/wp-content/uploads/2025/04/Translink-Corporate-Finance-SaaS-Valuation-Insights-Q1-2025.pdf), Q1 2025.

### Qué no debe hacerse

- No aplicar 3,9x a beneficio cero.
- No aplicar 4,8x ARR a una previsión sin contratos o cobros verificables.
- No usar múltiplos de unicornios o de empresas cotizadas como valoración directa del repositorio.
- No contar como ARR pagos puntuales, servicios de consultoría o pilotos no renovables.
- No sumar sin más el valor del software, el de la empresa y el valor presente de futuras ventas: puede producir doble contabilización.

## 2. Pre-revenue, pocos clientes y descuentos por riesgo

### Hechos observados

- Acquire.com dice expresamente que **no recomienda listar sin ingresos**, porque los compradores suelen mostrar menos interés. Para admitir una excepción pre-revenue exige actualmente: modelo SaaS, precio inferior a **25.000 USD**, propósito útil o de nicho, usuarios/clientes activos y web segura. [Seller FAQs de Acquire.com](https://help.acquire.com/seller-faqs-1), consultado el 24-09-2026.
- El análisis de salidas de Acquire.com de 2025 recomienda conseguir al menos algunos clientes: la tracción hace más defendible el product-market fit y el precio, especialmente cuando el software es cada vez más fácil de replicar. [Inside 2025's Winning Exits](https://blog.acquire.com/inside-2025s-winning-exits-on-acquire-what-founders-can-learn-going-into-2026-webinar-recap/), 24-01-2026.
- En el webinar de valoración de Acquire.com, un precio **10% por debajo del fair market value** obtuvo mucho más interés serio que uno 10% por encima. La propia fuente recomienda un descuento del **5–10%** para priorizar velocidad de venta. Esto es una observación comercial de la plataforma, no una regla universal. [Strategic Pricing](https://blog.acquire.com/strategic-pricing-how-to-sell-for-more-less-time/), consultado el 24-09-2026.
- FE International señala un descuento habitual de **30–50% para compañías privadas frente a cotizadas** por iliquidez, escala y menor auditoría. También trata como riesgo relevante que un cliente represente más de **15–20% del ARR**. Es aplicable a SaaS con ingresos, no como fórmula automática para pre-revenue.
- Empire Flippers exige para listar, como regla general, **2.000 USD/mes de beneficio neto medio** y doce meses de ingresos. Por tanto, su universo de transacciones tampoco representa un producto sin clientes. [Empire Flippers — Listing Requirements](https://empireflippers.com/business-listing-requirements/), 04-08-2025.

### Inferencias y criterio propuesto

1. **Sin ARR ni beneficio:** usar coste de sustitución ajustado y el mercado pre-revenue como control. El múltiplo financiero da cero o una cifra engañosa.
2. **Con 3–5 clientes de pago:** ya puede existir una prueba inicial de demanda, pero todavía hay concentración extrema. Si uno o dos clientes explican gran parte del ARR, el comprador puede exigir menor precio, escrow, holdback o earn-out.
3. **Integración implementada pero no probada con una cuenta real:** deducir del precio el coste de terminar y validar, más una contingencia por defectos desconocidos. La validación aumenta la confianza, pero por sí sola no demuestra ingresos ni retención.
4. **Dependencia del fundador:** valorar explícitamente el tiempo de transferencia y el riesgo de que la operación no funcione sin él.
5. **Documentación de dominio:** puede elevar el coste de sustitución y reducir el tiempo de incorporación del comprador, pero debe auditarse por actualidad, duplicidad, estructura, derechos de uso y capacidad real de convertirse en producto o servicio vendible.

No hay un “descuento pre-revenue” único y defendible. Para la sensibilidad financiera conviene presentar tres columnas —bajo, base y alto— y mostrar de forma separada:

- coste de completar y estabilizar;
- coste de validar integraciones externas;
- coste de obtener los primeros clientes;
- deuda técnica y seguridad;
- transferencia y documentación;
- probabilidad y plazo hasta ingresos.

## 3. Coste de sustitución: tarifas observables en España

El barómetro 2026 de Malt usa datos en tiempo real de profesionales activos en España. Son **tarifas publicadas de freelance**, no salarios, tarifas de agencia ni precios finales garantizados.

| Perfil | Media experimentados | Media en tramo de mayor experiencia |
|---|---:|---:|
| Expertos TI y desarrollo | 313 €/día | 390 €/día |
| Full-stack | 300 €/día | 335 €/día |
| Back-end | 306 €/día | no publicada de forma consistente en el resumen |
| Product manager | 386 €/día | 457 €/día |
| Director de proyecto | 384 €/día | 480 €/día |
| Sistemas/redes, proxy DevOps | 317 €/día | 368 €/día |
| Ciberseguridad | 353 €/día | 445 €/día |
| Consultoría de estrategia, proxy parcial de CTO | 416 €/día | 610 €/día |

**Fuentes Malt, consultadas el 24-09-2026:**

- [Barómetro general de tarifas freelance en España](https://www.malt.es/t/barometro-tarifas)
- [TI y desarrollo](https://www.malt.es/t/barometro-tarifas/tech)
- [Full-stack](https://www.malt.es/t/barometro-tarifas/tech/desarrollador-backend/desarrollador-fullstack)
- [Product managers](https://www.malt.es/t/barometro-tarifas/projectmanagers-agilecoaches/product-manager)
- [Directores de proyecto](https://www.malt.es/t/barometro-tarifas/projectmanagers-agilecoaches/directores-de-proyecto)
- [Sistemas y redes](https://www.malt.es/t/barometro-tarifas/tech/administradores-de-sistemas-y-redes)
- [Ciberseguridad](https://www.malt.es/t/barometro-tarifas/tech/expertos-ciberseguridad)
- [Consultores de estrategia](https://www.malt.es/t/barometro-tarifas/business-consulting/consultore-strategia)

Eurostat sitúa el coste laboral total medio de 2025 en **26,4 €/hora en España**, frente a **34,9 €/hora en la UE** y **38,2 €/hora en la zona euro**. Es un promedio de toda la economía, no de tecnología, y por ello solo sirve como control macro; no debe sustituir las tarifas especializadas. [Eurostat — Hourly labour costs 2025](https://ec.europa.eu/eurostat/en/web/products-eurostat-news/w/ddn-20260331-2), 31-03-2026; [tabla y metodología](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/23015.pdf).

### Inferencias para reconstrucción

Con 220 días facturables/año y las tarifas Malt anteriores:

- Un senior full-stack a dedicación completa equivale a unos **73.700–85.800 €/año**, antes de IVA, herramientas, cloud, gestión, QA, diseño, bajas, riesgo del proveedor y margen de agencia.
- Un equipo muy ajustado de **2 senior full-stack + 0,25 product manager + 0,15 DevOps + 0,10 seguridad** ronda **195.000 €/año** en coste freelance directo.
- Dos años de ese equipo rondarían **390.000 €** antes de costes no incluidos. Esto es coste potencial de recreación, **no precio de venta**.

La valoración debe estimar cuántos meses-equipo se ahorra realmente el comprador al adquirir el activo. No deben contarse código generado, dependencias, vendored code, migraciones repetitivas o documentación duplicada como si fueran desarrollo original equivalente.

El enfoque está alineado con las normas de valoración de intangibles:

- RICS señala que el coste de sustitución se usa en software comprado o desarrollado internamente y que debe ajustarse por obsolescencia, mantenimiento y valor temporal. [RICS Red Book/IVS, cost approach](https://www.rics.org/content/dam/ricsglobal/documents/standards/Red-Book-Global-Standards-incorporating-IVS.pdf).
- La UK Intellectual Property Office describe los enfoques de coste, mercado e ingresos; considera el coste útil en activos tempranos, pero advierte que no captura por sí mismo el valor futuro. [UK IPO — Valuing your intellectual property](https://www.gov.uk/valuing-your-intellectual-property), actualizado el 04-01-2022.
- La guía de activos de conocimiento del gobierno británico reitera que no existe un método único y define reproducción y sustitución como coste de crear un activo similar o de igual utilidad. [Knowledge Asset Evaluation Tool, anexo B](https://www.gov.uk/government/publications/knowledge-asset-management-in-government/objective-of-the-knowledge-asset-evaluation-tool-annex-b).

## 4. Mantenimiento, soporte y mejoras

### Hechos observados

La encuesta 2026 de SaaS Capital, con más de 1.000 SaaS B2B privados, publicó estas medianas como porcentaje de ARR:

| Partida | Mediana de ARR |
|---|---:|
| I+D/producto | 22% |
| Soporte y customer success | 9% |
| Hosting | 5% |
| DevOps | 4% |

Fuente: [SaaS Capital — 2026 Spending Benchmarks for Private B2B SaaS Companies](https://www.saas-capital.com/blog-posts/spending-benchmarks-for-private-b2b-saas-companies/), 10-06-2026.

Estos porcentajes no son una tarifa de mantenimiento de software a medida: describen cómo distribuyen ingresos compañías operativas y mezclan continuidad, evolución y crecimiento.

Como control histórico de ciclo de vida, la NASA observó esfuerzos anuales de mantenimiento entre **1% y 23% del coste de desarrollo original**; recomendaba aproximadamente **5%** para sistemas estables y de vida corta y **15%** para sistemas grandes y longevos. La evidencia procede de sistemas antiguos y no debe trasladarse mecánicamente a un SaaS moderno. [NASA Software Manager's Handbook](https://sw-eng.larc.nasa.gov/wp-content/uploads/sites/23/2013/05/Managers-Handbook1.pdf), sección “Cost of Software Maintenance”.

### Inferencia de presupuestos mensuales para España

Usando las tarifas Malt como base y separando mantenimiento correctivo de evolución:

| Nivel | Capacidad orientativa | Presupuesto mensual inferido, sin IVA ni cloud |
|---|---|---:|
| Continuidad básica | 2–4 días/mes de sistemas, seguridad o desarrollo; parches, backups, incidentes menores | **650–1.800 €** |
| Mantenimiento + mejoras pequeñas | 6–10 días de desarrollo + 1–2 días de producto/arquitectura | **2.500–5.100 €** |
| Roadmap activo | 12–20 días de desarrollo + 2–4 de producto/arquitectura + 1–2 de DevOps/seguridad | **5.300–11.100 €** |

Para un producto con varios conectores externos, migraciones de base de datos y requisitos de datos sensibles, el primer nivel solo cubre guardia limitada y correcciones menores; no incluye una cadencia real de producto.

Todo contrato de mantenimiento debería definir, al menos:

- horario y tiempo de respuesta por severidad;
- días incluidos y precio del exceso;
- qué es incidencia, deuda técnica o mejora;
- ownership de cloud, dominios, tiendas de apps y cuentas de proveedores;
- actualizaciones de dependencias y migraciones;
- monitorización, backups y pruebas de restauración;
- seguridad, privacidad y respuesta a incidentes;
- documentación y bus factor;
- exclusiones de costes de terceros.

## 5. Costes de auditoría, venta y transferencia

### Costes publicados — hechos

| Concepto | Referencia pública | Observación |
|---|---:|---|
| Pentest de aplicación web | **3.500 USD/test** en promoción Cobalt; Intruder publica desde **3.500 USD/test** | Alcance acotado; complejidad y APIs pueden elevarlo |
| Pentest SaaS + API en proveedor europeo | desde **4.500 €** estándar; **8.000–12.000 €** enterprise | Precio publicado de un proveedor, no promedio de mercado |
| Due diligence legal de pyme en España | desde **2.400 €** | Ejemplo publicado; excluye IVA y terceros |
| Redacción/revisión APA o SPA | desde **1.200 €** | Ejemplo publicado; excluye IVA y terceros |
| Tech due diligence legal en firma española | desde **5.000 € + IVA** | Mapa de riesgos legales, no auditoría integral de código |
| Acquire.com, venta inferior a 250.000 USD | **8% de closing fee + 25 USD/mes**; escrow incluido | Tarifa vigente del marketplace |
| Asesor español M&A para SaaS/ecommerce | **3.750 € setup + 4,5% success fee vendedor** | Ejemplo de proveedor; no promedio sectorial |

**Fuentes:**

- [Cobalt — Pentest Pricing](https://www.cobalt.io/platform/pricing), consultado el 24-09-2026.
- [Intruder — Pentest Pricing](https://www.intruder.io/pentest-pricing), consultado el 24-09-2026.
- [Optimum Web — Penetration Testing](https://www.optimum-web.com/security/penetration-testing/), consultado el 24-09-2026. Sus precios son una referencia comercial europea, no un benchmark independiente.
- [Acquire.com — Seller Pricing](https://acquire.com/seller-pricing/), consultado el 24-09-2026; [términos de suscripción](https://help.acquire.com/subscription-terms), actualizados el 04-03-2026.
- [Vamos Spanish Legal Services — adquisición en España](https://vamospanish.com/spain-legal-services/buying-a-business-spain/), consultado el 24-09-2026.
- [PASSAS — servicios legales Tech Due Diligence](https://passas.io/en/servicios), consultado el 24-09-2026.
- [Markulia — tarifas M&A para SaaS/ecommerce](https://markulia.com/servicio/ma/), consultado el 24-09-2026.

### Tiempo de transferencia — hechos e inferencia

Acquire.com indica que la mayoría de transiciones requieren **30–90 días** de handover; otra guía de la misma plataforma sitúa cierre y entrega en 2–4 semanas dentro de procesos más amplios. [Founder’s Guide to a High-Value Exit](https://blog.acquire.com/how-to-sell-your-saas-company-the-founder-s-guide-to-a-high-value-exit/), 2026; [SaaS Business Broker Service](https://blog.acquire.com/why-a-saas-business-broker-service-can-make-or-break-your-exit/), 08-05-2026.

Con 4–8 horas semanales de apoyo del fundador durante 12 semanas y una tarifa proxy de producto/estrategia de 457–610 €/día, el coste económico del handover sería aproximadamente **2.700–7.300 €**. Es una inferencia y debe convertirse en horas, disponibilidad, SLA y precio de exceso dentro del contrato.

### Presupuesto total de fricción para una venta pequeña — inferencia

Para una transmisión de activos tecnológica de baja complejidad societaria, un presupuesto prudente separaría:

- auditoría técnica/código: **3.000–9.000 €**;
- pentest y remediación inicial: **3.500–12.000 €**, más el trabajo de corrección;
- legal/IP/GDPR y contrato de compraventa: **3.600–8.000 €**;
- handover: **2.700–7.300 €**;
- comisión de marketplace o asesor: **4,5–8% del precio**, según canal, además de posibles setup fees.

No todos los importes recaen en la misma parte ni son siempre necesarios. El vendedor debe mostrar el precio bruto, costes de transacción y neto recibido por separado.

## 6. Cómo aplicar estos benchmarks a la valoración final

### Escenario A — venta del activo hoy, sin tracción verificable

1. Estimar meses-equipo necesarios para recrear **la funcionalidad útil y transferible**, no el volumen bruto del repositorio.
2. Multiplicar por tarifas actuales y sumar QA, producto, seguridad y puesta en producción.
3. Restar:
   - funcionalidad incompleta o no validada;
   - deuda técnica y fallos conocidos;
   - dependencia de cuentas o conocimiento del fundador;
   - costes de auditoría y transferencia;
   - obsolescencia y partes recreables con componentes estándar;
   - riesgo comercial por ausencia de clientes.
4. Contrastar contra la regla de admisión pre-revenue de Acquire.com (<25.000 USD) como referencia de liquidez minorista, no como techo estratégico.

### Escenario B — integraciones validadas, aún sin clientes

La deducción por “trabajo técnico pendiente” baja, pero el riesgo de demanda permanece. El aumento de precio defendible será como máximo el coste/riesgo que un comprador evita, salvo que la validación desbloquee un contrato, una certificación o una ventaja exclusiva. No hay benchmark que respalde sumar automáticamente 17.000–25.000 €.

### Escenario C — primeros clientes de pago

Registrar como mínimo:

- MRR/ARR cobrado y conciliado;
- margen bruto real, incluido soporte humano e IA;
- churn y cohortes, aunque sean tempranas;
- concentración por cliente;
- duración y renovabilidad de contratos;
- CAC, pipeline y ciclo de venta;
- horas mensuales del fundador;
- incidencias y coste de servicio.

Con 3–5 clientes el valor puede mejorar de forma material, pero todavía no debe aplicarse sin ajuste un múltiplo de SaaS diversificado. Es preferible presentar:

- valor por activos como suelo negociador;
- múltiplo sobre beneficio/SDE si ya es positivo y repetible;
- múltiplo sobre ARR solo como escenario, con descuento por concentración y corta historia;
- parte variable/earn-out ligada a renovaciones si comprador y vendedor discrepan sobre la prueba de mercado.

## 7. Jerarquía y calidad de las fuentes

1. **Mayor peso:** operaciones cerradas verificadas por marketplace (Acquire.com), estadísticas oficiales (Eurostat), normas profesionales (RICS/IVS) y datos first-party de más de 1.000 SaaS (SaaS Capital).
2. **Peso medio:** informes first-party de asesores/inversores reconocidos (GP Bullhound, Translink, FE International), porque combinan datos propios y juicio profesional.
3. **Solo como cotización observable:** páginas de precios de proveedores legales, M&A y seguridad. Demuestran qué cobra ese proveedor, no la media del mercado.
4. **No usados como base:** blogs agregadores, artículos sin muestra, múltiplos de unicornios, valoraciones de rondas VC y estimaciones basadas solo en líneas de código.

## Conclusión de mercado

La evidencia actual respalda una posición más conservadora que una tasación basada en tamaño del código. El activo técnico y el conocimiento de dominio pueden tener un coste de sustitución alto, pero **el mercado de adquisiciones paga sobre todo beneficio verificable, ingresos de calidad, retención, baja dependencia del fundador y facilidad de transferencia**. Antes de eso, el precio es el de un activo de riesgo y no el de un SaaS probado.

La mejor inversión previa a una venta no es únicamente “terminar conectores”: es convertir validación técnica en **evidencia comercial repetible**. Validar Meta y Klaviyo puede eliminar una deducción técnica; conseguir clientes que usen, paguen y renueven es lo que permite cambiar de método de valoración.
