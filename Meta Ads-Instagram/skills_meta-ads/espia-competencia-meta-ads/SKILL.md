---
name: espia-competencia-meta-ads
description: Espía los anuncios de Meta Ads de la competencia y devuelve ángulos e ideas de anuncios con más papeletas de funcionar. Úsala SIEMPRE que el usuario pegue enlaces de la Biblioteca de Anuncios de Meta (facebook.com/ads/library), nombre a un competidor y quiera ver sus anuncios, pida los anuncios que más tiempo llevan activos, los anuncios ganadores de la competencia, o ideas y ángulos para sus propios anuncios a partir de lo que hace su mercado.
---

# Espía de la competencia (Meta Ads)

Objetivo: encontrar los anuncios que **están vendiendo** a la competencia, entender **por qué** funcionan y convertirlo en **ideas de anuncios para el negocio del usuario**.

Principio de fondo: en Meta nadie paga meses por un anuncio que pierde dinero. Un anuncio que lleva **mucho tiempo activo de forma continua** es, casi siempre, rentable. La antigüedad es la mejor señal pública de "ganador".

## 1. Qué pedir (solo lo que falte)

1. **Competidores**: enlaces de la Biblioteca de Anuncios de cada página (`...ads/library/?...view_all_page_id=123...`). También vale el nombre de la marca.
2. **País**: por defecto España (ES).
3. **Cliente ideal y oferta del usuario**, en 2-3 frases: a quién vende, qué vende, precio aproximado, principal dolor que resuelve. Sin esto no se pueden adaptar las ideas; pregúntalo una sola vez y, si no contesta, trabaja con lo que haya y dilo.

No bloquees el trabajo: si falta el país, asume ES y avísalo.

## 2. Conseguir los anuncios activos

Usa la primera vía disponible, por este orden:

**Vía A — Conector de Meta Ads** (si la herramienta `ads_library_search` está disponible):
- Saca el `page_id` del enlace (`view_all_page_id=NÚMERO`). Si solo hay nombre, busca con `search_terms` y confirma la página correcta con el usuario si hay varias.
- Llama con `page_ids=[id]`, `countries=["ES"]`, `ad_active_status="ACTIVE"`, `limit=50`.
- Si `estimated_total_count` > 50, avisa de que es una muestra.
- La API da fecha de inicio (`ad_delivery_start_time`) y enlace (`ad_snapshot_url`), pero **no** da copy completo ni formato: eso se ve abriendo cada anuncio (navegador) o pidiendo al usuario capturas de los 5-10 más antiguos.

**Vía B — Navegador** (si puedes navegar): abre la biblioteca con filtro "Activos" y el país, ordena/recorre y anota para cada anuncio "En circulación desde", formato, texto y enlace.

**Vía C — Capturas o texto pegado**: pide al usuario capturas de la biblioteca donde se vea la fecha "En circulación desde" y el anuncio completo. Analiza sobre eso.

Nunca inventes copy, fechas ni formatos. Lo que no veas, marca "no visible".

## 3. Filtrar ganadores

1. Calcula **días activo** = hoy − fecha de inicio. Ordena de más antiguo a más reciente.
2. Lista corta = los **8-10 más antiguos** que siguen activos.
3. Señales extra de ganador:
   - El mismo creativo/ángulo aparece **duplicado en varias variantes** (lo están escalando).
   - Un anuncio "viejo" convive con versiones nuevas del mismo mensaje (están iterando sobre lo que funciona).
4. Descarta: anuncios de contratación, sorteos, eventos puntuales y anuncios con alcance mínimo (si el panel de transparencia de la UE muestra la banda más baja, apenas gasta).

## 4. Diseccionar cada ganador

Para cada anuncio de la lista corta, rellena esta ficha (corta y concreta):

- **Enlace** y **días activo**
- **Formato**: imagen / vídeo (UGC, a cámara, producción) / carrusel
- **Gancho**: primera frase del texto o primeros 3 segundos del vídeo, literal si se ve. Tipo: pregunta, dolor, resultado, polémica, error común, "esto es para ti si…", historia, dato.
- **Ángulo**: desde dónde vende (ahorro de tiempo, miedo a quedarse atrás, facilidad, autoridad, mecanismo único, identidad, precio/oferta…).
- **Estructura**: gancho → problema → solución → prueba → CTA, lista de beneficios, historia, oferta directa…
- **Oferta y CTA**: qué promete, botón, a dónde lleva (landing, VSL, formulario, WhatsApp).
- **Por qué funciona**: una o dos frases.

## 5. Convertirlo en ideas para el usuario

Cruza los patrones con el cliente ideal del usuario. La regla: **inspirarse en el ángulo, nunca copiar el anuncio**.

Entrega **10 ideas de anuncio** priorizadas. Cada una con:
- Ángulo (y de qué ganador viene)
- Gancho propuesto (escrito, listo para usar)
- Formato recomendado
- Por qué encaja con su cliente ideal
- Prioridad (Alta / Media) según cuántas veces aparece el patrón en el mercado

## Formato de salida

```
# Espía de la competencia — <mercado / competidores>
País: ES · Fecha del análisis: <hoy>

## Ranking de anuncios activos por antigüedad
| # | Competidor | Anuncio | Activo desde | Días | Formato | Gancho (resumen) |

## Ganadores diseccionados
### 1. <Competidor> — <días> días activo — [Ver anuncio](enlace)
(ficha)

## Patrones del mercado
- Ángulos que más se repiten
- Formatos dominantes
- Huecos que nadie está atacando (oportunidad)

## 10 ideas de anuncio para tu negocio
| # | Ángulo | Gancho | Formato | Prioridad |
(debajo, 1-2 líneas por idea explicando el porqué)

## Siguiente paso
Pasa las 3 ideas de prioridad Alta a la skill de copywriter.
```

## Reglas

- Español de España, tuteo, directo, sin relleno.
- Siempre el enlace de cada anuncio citado.
- Ordena siempre por días activo.
- Lo que no hayas visto, "no visible". Cero invenciones.
