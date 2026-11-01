#!/usr/bin/env python3
"""
Renderiza a PNG cada archivo .html de una carpeta (una pieza = un archivo).
El tamaño se lee de <meta name="size" content="1080x1350"> (por defecto 1080x1350).

Uso:
  python render.py carpeta_con_html/            -> PNG junto a cada HTML
  python render.py carpeta/ --zip creatividades.zip

Requiere: pip install playwright && python -m playwright install chromium
"""
import argparse
import pathlib
import re
import zipfile

from playwright.sync_api import sync_playwright


def size_of(html):
    m = re.search(r'<meta\s+name="size"\s+content="(\d+)x(\d+)"', html)
    return (int(m.group(1)), int(m.group(2))) if m else (1080, 1350)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--zip", default=None)
    a = ap.parse_args()
    folder = pathlib.Path(a.carpeta)
    files = sorted(folder.glob("*.html"))
    if not files:
        raise SystemExit("No hay archivos .html en la carpeta")
    pngs = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for f in files:
            html = f.read_text(encoding="utf-8")
            w, h = size_of(html)
            page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            page.goto(f.resolve().as_uri())
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(300)  # fuentes web
            out = f.with_suffix(".png")
            page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": w, "height": h})
            page.close()
            pngs.append(out)
            print(f"OK {out.name} ({w}x{h})")
        browser.close()
    if a.zip:
        with zipfile.ZipFile(a.zip, "w") as z:
            for png in pngs:
                z.write(png, png.name)
        print(f"ZIP: {a.zip}")


if __name__ == "__main__":
    main()
