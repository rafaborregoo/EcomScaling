# A18 · Plan mensual · 6 de noviembre de 2026

Cuenta TEST borregorafa99@gmail.com, consultor rafael@noraapp.es, organización SnowBorrego (prueba-borrego), tienda E-NORA Demo. Comparación por CLI con seis modelos, sin Astra, API pagada ni escrituras externas.

## Alcance

A18 propone pocas iniciativas estructurales para **los treinta días posteriores al corte**. No significa exclusivamente el mes calendario siguiente. El histórico de noventa días y su periodo anterior sirven como evidencia, no como fechas de ejecución. Mi Camino conserva la meta e hitos aprobados; A18 no los redefine. A17 desglosa las iniciativas mensuales aprobadas y A04 trabaja los pasos diarios. No se crean tareas ni se dan por aprobadas propuestas automáticamente.

La generación se programa cada 27 días por tienda elegible: 30/27 ≈ 1,11 ejecuciones por treinta días. Cliente y consultor leen el mismo resultado, por lo que abrir ambas cuentas no duplica coste. La elegibilidad, actividad, presupuestos y topes pueden reducir ejecuciones; manuales, herramientas, juez, reintentos y fallback pueden sumar consumo.

## Correcciones previas al veredicto

- El cron generaba un alcance organizativo y enviaba connectionId=null; la UI leía por tienda. Ahora A18 se programa y ejecuta por tienda, con una lectura compartida.
- La salida omitía answer. Se conserva una explicación junto con las iniciativas.
- El contexto mensual excluía especialistas; ahora recibe las lecturas recientes de stock, email, Shopify, Meta y otros, con fechas y estados, sin heredar su aprobación.
- El backlog abreviado podía ocultar duplicados. A18 recibe el índice de todos los títulos consultados; sigue indicando omisiones si la consulta alcanza su límite.
- El A02 de noventa días podía no existir aunque hubiese una lectura reciente de treinta días. A18 utiliza la última lectura de la misma tienda conservando su ventana y antigüedad, sin hacerla pasar por noventa días.
- Se añade serie mensual Shopify de 24 meses. El mes actual se marca parcial; mes calendario cerrado no acredita cobertura de sincronización completa. Meses sin pedidos observados no se convierten en ventas o demanda cero; importes desconocidos quedan null. No se infiere beneficio ni estacionalidad demostrada sin evidencia.
- Se fija el horizonte exacto [corte, corte+30 días) en objetivo, contexto y guía de sistema. El texto anterior «próximo mes» provocó una respuesta limitada a diciembre pese a que el corte era el 6 de noviembre.
- Tareas tiene una sección A18 para ambos roles, con límites del análisis. Una lectura sin escrituras no queda bloqueada por aprobación; las propuestas sí requieren revisión.

## Trazabilidad de las pruebas

`monthly-v1`: captura sin ejecución de modelos, sustituida al incorporar A02 reciente. Sus filas figuran como skipped sin llamadas.

`monthly-v2`: seis respuestas conservadas como diagnóstico; excluidas del veredicto por ambigüedad del horizonte. No se atribuye ese defecto del backend al modelo.

`a18_plan_mensual:real-store-runtime-2026-11-06-monthly-v3`: tanda final con mismo contexto y contrato nativo para Haiku 5.5, Sonnet 5.5, Opus 5.5, GPT-6 Luna, GPT-6.1 Sol y GPT-6.1 Terra. El hook beforeModel detiene el runtime antes de llamar a un proveedor de pago. Las CLI no ejecutan herramientas dinámicas: se compara lectura, síntesis y planificación sobre el snapshot persistido.

En curso: completar la tanda v3, contrastar cada campo contra evidencia/fechas/backlog, seleccionar principal y fallback y guardar la lectura elegida en TEST.

La comparación estará en Platform Admin → Laboratorio IA → A18. El resultado seleccionado estará en **Tareas → A18 · Plan mensual**, `/tareas#plan-mensual`, con E-NORA Demo seleccionada tanto en cliente como consultor.

Los costes son equivalentes API en frío calculados con tokens CLI y catálogo local del 28/10/2026; incluyen sobrecarga de CLI y no constituyen factura ni tarifas actuales verificadas. Una sola tienda TEST con datos de demostración no acredita superioridad general ni rendimiento comercial. Codex puede no confirmar el ID servido. No se declara revisión visual autenticada.
