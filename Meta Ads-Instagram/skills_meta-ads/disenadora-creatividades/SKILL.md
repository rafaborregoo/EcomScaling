---
name: disenadora-creatividades
description: Convierte anuncios ganadores de Meta Ads (vídeos, guiones o copys que ya funcionan) en estáticos y carruseles con el branding de cada marca, exportados en PNG listos para subir (4:5, 1:1 y 9:16). Úsala SIEMPRE que el usuario pida crear imágenes para anuncios, estáticos, carruseles, creatividades de imagen, adaptar un vídeo ganador a imagen, o diseñar anuncios con los colores y la tipografía de una marca.
---

# Diseñadora de creatividades

Un mensaje que ya funciona en vídeo tiene muchas papeletas de funcionar en imagen. Esta skill toma ese mensaje y lo convierte en **3-4 estáticos + 1 carrusel** con el branding del cliente, en PNG listos para subir a Meta.

## 1. Entrada

1. **El anuncio ganador**: guion, transcripción o copy (gancho, cuerpo, CTA). Si viene de la analista o la multiplicadora, usa el gancho ganador.
2. **Kit de marca** (pide lo que falte, una vez):
   - Colores (fondo, texto, principal, acentos) en HEX. Si solo hay web, pídele la URL o una captura y sácalos de ahí.
   - Tipografía (si no la sabe, propón una de Google Fonts acorde y dilo).
   - Logo (archivo PNG/SVG). Si no lo pasa, usa el nombre de la marca en texto, nunca un logo inventado.
   - Fotos reales (producto, fundador, clientes), si las hay.
3. **Pruebas reales** si se van a usar (testimonios, cifras). **Nunca inventes testimonios, reseñas, resultados ni fotos que parezcan reales.**

## 2. Planificar las piezas

Antes de diseñar, propón en una tabla corta qué vas a hacer:

| Pieza | Formato (ver `references/formatos.md`) | Mensaje (gancho del ganador) | Tamaño |
|---|---|---|---|
| Estático 1 | Titular grande | … | 1080x1350 |
| Estático 2 | Nota nativa | … | 1080x1350 |
| Estático 3 | Comparativa / lista / testimonio | … | 1080x1350 |
| Estático 4 | Titular grande vertical | … | 1080x1920 |
| Carrusel | 5-7 slides | Cuerpo del anuncio troceado | 1080x1350 |

Si el usuario está presente y no ha dicho nada de formatos, sigue sin esperar confirmación con esta propuesta por defecto.

## 3. Diseñar

Lee `references/formatos.md`. Para cada pieza:

1. Copia `assets/base.html`, rellena las variables de `:root` con el kit de marca y la fuente.
2. Ajusta `<meta name="size">` y el tamaño de `html,body` a la medida de la pieza.
3. Escribe el texto: **el gancho del ganador, casi literal**. Un mensaje por pieza. Titular de 6-12 palabras.
4. Si hay logo o fotos, cópialos a la carpeta de trabajo y referéncialos con ruta relativa (`<img src="logo.png">`).
5. Un archivo HTML por pieza; en el carrusel, uno por slide (`carrusel_01.html`, …).

## 4. Exportar a PNG

```bash
pip install playwright && python -m playwright install chromium   # si hace falta
python scripts/render.py piezas/ --zip creatividades.zip
```

**Revisa cada PNG** (ábrelo y míralo): texto cortado, solapes, contraste pobre o tamaños ilegibles se corrigen y se vuelve a renderizar. No entregues sin mirar.

Si no se puede ejecutar código en el entorno, entrega los HTML y explica que se abren en el navegador y se capturan, o pide activar la ejecución de código.

## 5. Entrega

- El ZIP con todos los PNG, nombrados `<Marca>_<Formato>_<Gancho-corto>_<tamaño>.png`.
- Debajo, por cada pieza: **texto principal + titular + botón** sugeridos para subirla (reutiliza el copy del ganador, adaptado a imagen).
- Una línea de test: súbelas al mismo conjunto de anuncios que el vídeo ganador o a uno de testeo, y compara coste por venta a los 3-5 días.

## Reglas

- El branding es del cliente, no tuyo: respeta sus colores y tipografías aunque no te gusten.
- No imites interfaces ni logos de redes sociales, ni marcas de terceros.
- Texto grande y legible en móvil; contraste alto; nada de párrafos largos en estáticos.
