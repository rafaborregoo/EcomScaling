# META-SB-004 | Especialización del mensaje según cliente valioso

**Estado:** candidato · **Fuente:** [FUENTE] ~06:00–08:21 y ~09:53–12:21.

## Idea fuente

Con presupuesto reducido, el ponente defiende diferenciarse con mensajes dirigidos a un nicho, en vez de intentar atraer a todo el mercado. Propone observar qué clientes compran más, permanecen más o dan menos problemas y adaptar argumentos, dolores y oferta a esos perfiles. Utiliza el ejemplo de segmentos que valoran ahorro de tiempo, comodidad o estatus en lugar de precio.

## Conversión a principios e-NORA

- **[PROPUESTA e-NORA]** Analizar cohortes de compradores por contribución económica, recurrencia, devoluciones y periodo; no limitar el análisis a facturación histórica.
- Identificar diferencias verificables en intereses/beneficios asociados a productos o grupos de compradores, evitando inferir o dirigirse a atributos sensibles.
- Recomendar **especialización del mensaje** sin asumir que implica restringir el targeting en Meta a un 1 % real de población.
- La «regla 1 %» es retórica del ponente, no cifra que debe programarse.
- Distinguir `targeting_platform` (controles de audiencia) y `message_positioning` (ángulo/copy/creativo). Pueden coexistir audiencia amplia y mensaje específico.

## Hipótesis de optimización (sin causalidad implícita)

Datos históricos Shopify muestran que el segmento de recompra del producto X realiza pedidos de mayor contribución y devuelve menos. Propuesta: probar un anuncio que enfatice comodidad/reposición en vez de descuento. No afirmar que esa creatividad ya está validada sin experimento.

## Fuentes y límites

Shopify: pedidos, líneas, recurrencia, cupones, devoluciones, reembolsos, cohortes (si están disponibles).
Klaviyo: retención/recurrencia/impacto comunicacional solo según derechos y datos efectivamente accesibles.
Meta: ads + resultados, pero no asumir que atribución permite identificar qué persona concreta vio cada anuncio.

**Privacidad:** no generar perfiles individuales sensibles ni trasladar PII a prompts RAG; usar agregaciones, permisos/consentimientos y segmentación lícita según normativa.

## Solapamiento

Primer pack `META-003_estructura_objetivos_audiencias.md` y `META-005_estrategia_creativos_y_evaluacion.md`. Este vídeo añade el ángulo **valor de cliente → diferenciación del mensaje**.

## Tests/guardrails

Nicho con 2 compradores; segmento alto AOV pero alto porcentaje devoluciones; muestra sesgada por promociones; perfil sensible; tienda de un solo producto; audiencia suficientemente amplia con creativo de nicho.
