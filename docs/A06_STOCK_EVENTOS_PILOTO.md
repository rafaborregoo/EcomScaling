# A06: piloto de revisión de stock por eventos

Fecha: 29/10/2026. Alcance: solo A06. Los demás agentes conservan su comportamiento.

## Objetivo y criterios

Reaccionar a cambios relevantes sin esperar a la revisión periódica. Shopify ya actualiza el inventario mediante una bandeja duradera de webhooks. El piloto añade una cola duradera por tienda que agrupa cambios; las comprobaciones numéricas no usan un modelo.

La importancia es relativa al producto. No se utiliza una bajada porcentual ni un número fijo de unidades como orden de reposición. Se revisan el agotamiento de un nivel de variante/ubicación y el cruce de una cobertura configurada por tienda, calculada con ventas suficientes e inventario completo y reciente. El umbral inicial de 3 días es una señal de revisión del piloto, no un plazo de proveedor ni un punto de compra. Sin plazo de proveedor, stock de seguridad y pedidos entrantes no se recomienda una cantidad de compra.

## Diseño acordado

- Piloto por tienda, inicialmente en observación: calcula y registra decisiones sin llamar a una API ni crear tareas.
- Agrupación de cambios durante 60 segundos, con una espera máxima de 5 minutos durante ráfagas. El worker comprueba la cola cada minuto; no hay garantía de tiempo real estricto.
- Modo real explícito por tienda: mismo modelo configurado y contexto completo de A06, más el motivo del evento. No se presupone ahorro por enviar solo una cifra ni por mantener una conversación.
- Una evaluación grave puede adelantar la revisión aunque el diagnóstico anterior sea reciente o esté pendiente de revisión. Se mantienen presupuestos, permisos y aprobación de tareas.
- Límites específicos por tienda, deduplicación, lease de procesamiento y conservación de cambios que lleguen durante una ejecución.
- El coste de la vigilancia y base de datos se distingue de los tokens del modelo. Las llamadas de eventos se suman a las periódicas; 30 llamadas al mes sigue siendo solo un escenario comparable.

## Estado de implementación

- Aplicadas solo las migraciones `20261029074726` y `20261029080642` a desarrollo. Producción no se ha modificado.
- Cola transaccional por tienda sobre actualizaciones de cantidad/actividad de niveles existentes. Las importaciones iniciales no generan eventos. Se conservan revisiones, reservas con vencimiento y cambios recibidos durante un análisis.
- Consumidor propio cada minuto, separado de webhooks y trabajos de otros agentes. Inscrita en observación **E-NORA Demo**, `5e84efa9-6e7f-4759-8b87-22119401bd81`, de la cuenta indicada por el propietario. No se habilitó generación de pago. Necesita datos entrantes y API/worker funcionando; no equivale a un despliegue de producción.
- Configuración y resultados en `/admin/laboratorio-ia/a06_planificador_stock`: modo, cobertura, separación entre análisis, cupo, decisiones, calidad y coste adicional. Los 30 análisis mensuales son un escenario comparable, no uso medido.
- Se conserva el runtime y contexto completo de A06. Los productos del evento se priorizan dentro de su contexto. Se comprueban también propuestas anteriores pendientes, además de tareas abiertas; si esa comprobación no está disponible, se reintenta antes de llamar al modelo.
- Reservas, recuperación de ejecuciones terminadas, firma de señal y cupos limitan duplicados y gasto. Se mantienen presupuestos y permisos del runtime y aprobación de tareas. Hace falta una API para activar generación real; los CLI de suscripción se usan solo para las pruebas.
- El filtro busca cruces de cobertura, agotamiento de un nivel y escalada a la franja de un día. Una bajada dentro de la misma franja no provoca por sí sola otro análisis. No cubre todos los cambios comerciales ni plazos diferentes por producto.
- Modelo asignado: `claude-haiku-5-5`. Respaldo ante fallo de Anthropic: `gpt-6.1-sol`, que aporta más capacidad y un proveedor independiente. Los modelos quedaron cerrados en la decisión compartida de A06; las llamadas siguen sujetas a las claves API disponibles.
- La migración de plataforma habilita y guarda Haiku en la configuración persistida de Costes de IA, sin tocar la cadencia que ya tuviera A06.
- Haiku atiende la ejecución normal. El runtime solo intenta Sol si Anthropic falla por autenticación, límite, saldo, timeout o indisponibilidad, antes de haber recibido uso; un output inválido o el límite de presupuesto no cambia de modelo. Se registra el proveedor/modelo realmente usado en la ejecución.

## Verificación completada

- 16 pruebas de reglas y 4 existentes de evidencia/deduplicación, sin fallos: ritmos de venta, umbrales, inventario parcial/antiguo, muestra insuficiente, varias ubicaciones, reposición durante ráfaga, escalada, restauración de datos y redondeo.
- 8 comprobaciones SQL: agrupación, reserva exclusiva, preservación de cambios, confirmación con token antiguo, tienda apagada, pertenencia de tienda, RLS y permisos. Las cantidades se modifican en una transacción que se revierte.
- 5 comprobaciones del flujo con tablas/RPC reales: observación sin modelo, reposición que cancela el riesgo, reserva verificada antes del adaptador, cupo con reintento pendiente y ausencia de tareas automáticas. El adaptador de modelo está simulado. Cero llamadas API de pago; fixtures aisladas eliminadas al terminar.
- TypeScript de API, web y worker; rutas sin credenciales rechazadas (401) y página A06 con HTTP 200.
- Se corrigió una suposición del test: la base de datos estaba unos dos segundos detrás del host y una fecha artificial de vencimiento de un segundo aún no estaba vencida. Se usa margen de un minuto, sin alterar relojes ni introducir espera real.

## Comparación de modelos por CLI

Tres casos sintéticos con el mismo snapshot de especialista: control periódico con 10 unidades, evento 30→10 y evento con propuesta anterior pendiente. Ventas 120/30 días, 4 al día y cobertura 2,5 días. Se añade la señal sin recortar el contexto. Sonnet y Opus revisan los 16 campos de cada respuesta y también son candidatos. No se incluye Astra.

| Modelo     | Control: sin fallo / fallo / duda | Evento     | Propuesta pendiente | Tareas nuevas con propuesta pendiente |
| ---------- | --------------------------------- | ---------- | ------------------- | ------------------------------------- |
| Haiku 5.5  | 16 / 0 / 0                        | 16 / 0 / 0 | 16 / 0 / 0          | 0                                     |
| Sonnet 5.5 | 15 / 0 / 1                        | 15 / 0 / 1 | 16 / 0 / 0          | 0                                     |
| Opus 5.5   | 13 / 0 / 3                        | 15 / 0 / 1 | 13 / 0 / 3          | 0                                     |
| Luna       | 12 / 0 / 4                        | 15 / 0 / 1 | 14 / 0 / 2          | 0                                     |
| Sol        | 15 / 0 / 1                        | 15 / 0 / 1 | 15 / 0 / 1          | 0                                     |
| Terra      | 15 / 0 / 1                        | 15 / 0 / 1 | 15 / 0 / 1          | 0                                     |

Las 18 respuestas cumplen el contrato. En control y evento los seis proponen una revisión sin inventar una compra; con propuesta pendiente los seis evitan añadir otra tarea. Los recuentos no son porcentajes de precisión ni equivalencia estadística.

Hallazgo manual: Opus considera incoherente que haya cero productos por debajo de 5 unidades y poca cobertura. Son indicadores distintos: con 10 unidades el contador descriptivo puede ser cero y la cobertura 2,5 días. Se conserva la respuesta y la duda de los revisores, sin ocultar la discrepancia.

Coste estimado del caso de evento, sin caché y con tokens informados por CLI: Haiku 0,0041648 USD; Sonnet 0,039424; Opus 0,085192; Luna 0,0026702; Sol 0,071072; Terra 0,033012. No es una factura ni incluye infraestructura. Codex no acredita el ID servido. **No se ha reducido el coste por análisis por cambiar solo una cifra:** el ahorro procede del filtro y de agrupar llamadas.

## Antes de extenderlo

Observar eventos reales, medir falsas alarmas/omisiones y contrastar tareas con el propietario. Validar una generación API con herramientas y aprobación cuando haya credenciales, probar catálogos grandes y varios productos por evento, definir umbrales más específicos si hay plazos de proveedor y revisar capacidad/retención al ampliar. Ningún otro agente se ha convertido a este patrón.

Comandos de desarrollo:

```powershell
npx tsx --test apps/api/src/a06-stock-event-policy.test.ts apps/api/src/stock-risk-evidence.test.ts
npx dotenv -e .env.local -- tsx scripts/a06-stock-event-db.test.mts
npx dotenv -e .env.local -- tsx scripts/a06-stock-event-flow.test.mts
npx dotenv -e .env.local -- tsx scripts/a06-stock-event-pilot.mts
npx dotenv -e .env.local -- tsx apps/worker/src/a06-stock-events-only.ts
npx tsx scripts/ai-model-lab-a06-events-summary.mts
```
