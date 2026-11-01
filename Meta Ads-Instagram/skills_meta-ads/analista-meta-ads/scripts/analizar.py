#!/usr/bin/env python3
"""
Analista de Meta Ads: lee un export del Administrador de Anuncios (CSV o XLSX,
en español o inglés), calcula el CPA máximo rentable y clasifica cada anuncio
en ESCALAR / MANTENER / VIGILAR / APAGAR / ESPERAR DATOS.

Uso:
  python analizar.py export.csv --precio 197 --margen 0.80
  python analizar.py export.xlsx --cpa-max 60
  python analizar.py export.csv --precio 2000 --margen 0.7 --objetivo lead --cierre 0.10

Salida: tabla en markdown por pantalla + resultado.csv junto al export.
"""
import argparse
import re
import sys
import unicodedata

import numpy as np
import pandas as pd


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


# Posibles nombres de columna (normalizados) en exports ES / EN
COLS = {
    "nombre": ["nombre del anuncio", "ad name", "nombre del conjunto de anuncios", "ad set name",
               "nombre de la campana", "campaign name"],
    "gasto": ["importe gastado", "amount spent", "gasto"],
    "compras": ["compras", "purchases", "compras en el sitio web", "website purchases"],
    "leads": ["clientes potenciales", "leads", "registros completados", "complete registration",
              "clientes potenciales en el sitio web", "website leads"],
    "resultados": ["resultados", "results"],
    "valor": ["valor de conversion de compras", "purchases conversion value",
              "valor de conversion de compras en el sitio web", "website purchases conversion value"],
    "impresiones": ["impresiones", "impressions"],
    "clics": ["clics en el enlace", "link clicks"],
    "ctr": ["ctr porcentaje de clics en el enlace", "ctr link click through rate", "ctr enlace"],
    "frecuencia": ["frecuencia", "frequency"],
    "rep3s": ["reproducciones de video de 3 segundos", "3 second video plays", "reproducciones de video de 3 s"],
}


def find_col(df, key):
    normed = {norm(c): c for c in df.columns}
    for cand in COLS[key]:
        for nc, orig in normed.items():
            if nc == cand or nc.startswith(cand + " "):  # p.ej. "importe gastado eur"
                return orig
    return None


def num(series):
    if series is None:
        return None
    s = series.astype(str).str.replace("€", "").str.replace("%", "").str.strip()
    # formato europeo 1.234,56 -> 1234.56
    eu = s.str.contains(r",\d{1,2}$", regex=True)
    s = s.where(~eu, s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    return pd.to_numeric(s.str.replace(",", "", regex=False), errors="coerce").fillna(0)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("archivo")
    p.add_argument("--precio", type=float, help="Ticket medio por venta (o LTV si se prefiere)")
    p.add_argument("--margen", type=float, help="Margen bruto por venta antes de publicidad (0-1)")
    p.add_argument("--cpa-max", type=float, help="CPA máximo directo (si ya lo sabes)")
    p.add_argument("--objetivo", choices=["compra", "lead"], default="compra")
    p.add_argument("--cierre", type=float, default=None, help="Tasa lead->venta (0-1) si objetivo=lead")
    p.add_argument("--colchon", type=float, default=0.30, help="Margen de seguridad para escalar (0.30 = escalar por debajo del 70%% del CPA máx.)")
    p.add_argument("--min-resultados", type=int, default=3)
    a = p.parse_args()

    if a.cpa_max:
        cpa_venta_max = a.cpa_max
    elif a.precio and a.margen:
        cpa_venta_max = a.precio * a.margen
    else:
        sys.exit("Falta --cpa-max o bien --precio y --margen")

    cpa_max = cpa_venta_max
    if a.objetivo == "lead":
        if not a.cierre:
            sys.exit("Con objetivo lead hace falta --cierre (tasa de lead a venta)")
        cpa_max = cpa_venta_max * a.cierre

    df = pd.read_excel(a.archivo) if a.archivo.lower().endswith(("xlsx", "xls")) else pd.read_csv(a.archivo, sep=None, engine="python")
    c = {k: find_col(df, k) for k in COLS}
    if not c["nombre"] or not c["gasto"]:
        sys.exit(f"No encuentro columnas de nombre o gasto. Columnas: {list(df.columns)}")

    res_key = "compras" if a.objetivo == "compra" else "leads"
    res_col = c[res_key] or c["resultados"]
    if not res_col:
        sys.exit("No encuentro columna de compras/leads/resultados")

    out = pd.DataFrame({"Anuncio": df[c["nombre"]].astype(str)})
    out["Gasto"] = num(df[c["gasto"]])
    out["Resultados"] = num(df[res_col])
    out = out[~out["Anuncio"].str.lower().isin(["nan", "total", "totales", "results", "resultados"])]
    idx = out.index
    out["Valor"] = num(df[c["valor"]]).loc[idx] if c["valor"] else 0
    out["Impresiones"] = num(df[c["impresiones"]]).loc[idx] if c["impresiones"] else 0
    if c["ctr"]:
        out["CTR %"] = num(df[c["ctr"]]).loc[idx]
    elif c["clics"] and c["impresiones"]:
        out["CTR %"] = (num(df[c["clics"]]).loc[idx] / out["Impresiones"].replace(0, np.nan) * 100).fillna(0)
    out["Frecuencia"] = num(df[c["frecuencia"]]).loc[idx] if c["frecuencia"] else 0
    if c["rep3s"] and c["impresiones"]:
        out["Hook rate %"] = (num(df[c["rep3s"]]).loc[idx] / out["Impresiones"].replace(0, np.nan) * 100).fillna(0)

    out = out[out["Gasto"] > 0].copy()
    out["CPA"] = out["Gasto"] / out["Resultados"].replace(0, np.nan)
    if a.objetivo == "compra":
        out["ROAS"] = (out["Valor"] / out["Gasto"]).round(2)

    ctr_med = out["CTR %"].median() if "CTR %" in out else None

    def decide(r):
        g, n, cpa = r["Gasto"], r["Resultados"], r["CPA"]
        if n == 0:
            return ("APAGAR", "Ha gastado 1,5x el CPA máx. sin resultados") if g >= 1.5 * cpa_max else \
                   ("ESPERAR DATOS", "Aún no ha gastado lo suficiente para juzgar")
        if cpa > 1.2 * cpa_max and g >= 2 * cpa_max:
            return ("APAGAR", "CPA por encima del máximo con gasto suficiente")
        if cpa <= (1 - a.colchon) * cpa_max and n >= a.min_resultados:
            return ("ESCALAR", "CPA holgado y volumen suficiente")
        if cpa <= cpa_max:
            return ("MANTENER", "Rentable; falta volumen o margen para escalar")
        return ("VIGILAR", "Por encima del CPA máx.; revisar en 48-72 h")

    dec = out.apply(decide, axis=1, result_type="expand")
    out["Decisión"], out["Motivo"] = dec[0], dec[1]

    fat = (out["Frecuencia"] > 3)
    if ctr_med is not None:
        fat &= out["CTR %"] < ctr_med
    out["Fatiga"] = fat.map({True: "Posible", False: ""})

    orden = {"ESCALAR": 0, "MANTENER": 1, "VIGILAR": 2, "APAGAR": 3, "ESPERAR DATOS": 4}
    out = out.sort_values(by=["Decisión", "CPA"], key=lambda s: s.map(orden) if s.name == "Decisión" else s)

    tot_g, tot_n, tot_v = out["Gasto"].sum(), out["Resultados"].sum(), out["Valor"].sum()
    print("## Resumen de la cuenta")
    print(f"- CPA máximo ({'por lead' if a.objetivo == 'lead' else 'por venta'}): **{cpa_max:.2f}**")
    if a.margen:
        print(f"- ROAS de equilibrio: **{1 / a.margen:.2f}**")
    print(f"- CPA objetivo para escalar: **≤ {(1 - a.colchon) * cpa_max:.2f}**")
    print(f"- Gasto total: {tot_g:.2f} · Resultados: {tot_n:.0f} · CPA medio: {tot_g / tot_n if tot_n else float('nan'):.2f}")
    if a.objetivo == "compra" and tot_g:
        print(f"- ROAS cuenta: {tot_v / tot_g:.2f}")
    print()
    cols = [x for x in ["Anuncio", "Gasto", "Resultados", "CPA", "ROAS", "CTR %", "Hook rate %", "Frecuencia", "Decisión", "Motivo", "Fatiga"] if x in out]
    tabla = out[cols].round(2).astype(object).where(out[cols].notna(), "—")
    try:
        print(tabla.to_markdown(index=False))
    except ImportError:
        print(tabla.to_string(index=False))

    dest = re.sub(r"\.(csv|xlsx|xls)$", "", a.archivo, flags=re.I) + "_resultado.csv"
    out[cols].round(2).to_csv(dest, index=False)
    print(f"\nGuardado: {dest}")


if __name__ == "__main__":
    main()
