# Formatos de estáticos y carruseles que funcionan en Meta

Todos parten de `assets/base.html` (mismo `<head>` y variables de marca). Cambia solo el `<body>` y añade el CSS del formato. Un archivo HTML por pieza; en carruseles, un archivo por slide (`carrusel_01.html`, `carrusel_02.html`…).

## 1. Titular grande (el comodín)
Gancho del anuncio ganador como titular enorme + 1 frase de apoyo + botón. Es el formato de `base.html`. Úsalo siempre como primera versión.

## 2. Nota nativa (parece contenido, no anuncio)
Fondo claro, tarjeta tipo nota con texto manuscrito o sistema, sin logo grande.
```html
<style>
 body{background:#f4f1ea;color:#1b1b1b;justify-content:center}
 .nota{background:#fff8b8;padding:70px;border-radius:8px;box-shadow:0 20px 50px rgba(0,0,0,.15);transform:rotate(-1.5deg)}
 .nota p{font:600 52px/1.35 var(--cuerpo)} .nota b{background:var(--acento);padding:0 8px}
 .firma{margin-top:40px;font:600 30px var(--cuerpo);opacity:.7}
</style>
<div class="nota"><p>Si tu coste por venta se dispara cada vez que subes presupuesto, <b>el problema no es el algoritmo</b>.</p>
<div class="firma">— Nombre, cargo</div></div>
```

## 3. Post de texto (estilo publicación en redes, genérico)
Avatar circular + nombre + texto en grande. **No imites la interfaz ni el logo de ninguna red social concreta.**
```html
<style>
 body{background:#fff;color:#111;justify-content:center}
 .cab{display:flex;gap:24px;align-items:center;margin-bottom:40px}
 .av{width:110px;height:110px;border-radius:50%;background:var(--primario);display:grid;place-items:center;color:#fff;font:800 48px var(--titular)}
 .n{font:700 40px var(--cuerpo)} .u{font:400 32px var(--cuerpo);color:#666}
 .t{font:500 56px/1.35 var(--cuerpo)}
</style>
<div class="cab"><div class="av">E</div><div><div class="n">Nombre Apellido</div><div class="u">Fundador de Marca</div></div></div>
<p class="t">Un anuncio que lleva 6 meses activo no es suerte. Es un anuncio que vende.</p>
```

## 4. Testimonio (solo con testimonios REALES que dé el usuario)
Cita grande, 5 estrellas, nombre y negocio. Si hay foto real, úsala; si no, iniciales en círculo.

## 5. Comparativa "esto vs. aquello"
Dos columnas: "Lo que hace la mayoría" (gris, ✕) vs. "Lo que hacemos" (color de marca, ✓). 3-4 filas, frases de ≤ 6 palabras.

## 6. Lista de beneficios / checklist
Titular + 4-5 líneas con ✓ en color de acento. Ideal para ofertas y packs.

## 7. Carrusel (5-7 slides, 1080x1350)
- **Slide 1 — Portada**: el gancho ganador. Nada más. Flecha "→" o "Desliza" abajo a la derecha.
- **Slides 2-5 — Desarrollo**: una idea por slide, misma estructura que el cuerpo del anuncio (problema → error → solución → prueba). Numeración "2/6" arriba a la derecha. Máx. 25 palabras por slide.
- **Última — CTA**: qué hacer ahora + beneficio + botón.
- Consistencia: mismo fondo, misma tipografía, mismos márgenes en todas. Alterna fondo oscuro/claro solo si la marca lo usa.

## Reglas de diseño para Meta
- Texto legible en el móvil: titular ≥ 80 px, cuerpo ≥ 36 px en un lienzo de 1080.
- Máx. ~20 % de la superficie con texto pequeño; un mensaje por pieza.
- Contraste alto (texto claro sobre oscuro o al revés).
- En 9:16 deja libres ~250 px arriba y ~350 px abajo (interfaz de Stories/Reels).
- Nada de imágenes de personas, productos o resultados inventados que puedan parecer reales. Usa las fotos del cliente o diseños tipográficos.
