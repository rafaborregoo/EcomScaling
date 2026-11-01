"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "./panel.module.css";

const SECTIONS = [
  { key: "resumen", label: "Resumen" },
  { key: "costes", label: "Tiendas y costes" },
  { key: "captacion", label: "Captación" },
  { key: "acciones", label: "Plan de acción" },
] as const;

export type PanelSection = (typeof SECTIONS)[number]["key"];

export function usePanelSection(): PanelSection {
  const params = useSearchParams();
  return (
    SECTIONS.find((item) => item.key === params.get("section"))?.key ??
    "resumen"
  );
}

export function PanelSections() {
  const params = useSearchParams();
  const section = usePanelSection();
  return (
    <>
      <nav className={s.sectionNav} aria-label="Secciones de Rentabilidad">
        {SECTIONS.map((item) => {
          const next = new URLSearchParams(params.toString());
          next.set("section", item.key);
          return (
            <Link
              key={item.key}
              href={`/panel?${next}#rentabilidad-secciones`}
              scroll={false}
              aria-current={section === item.key ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {section !== "resumen" ? (
        <h1 className={s.sectionTitle}>
          {SECTIONS.find((item) => item.key === section)?.label}
        </h1>
      ) : null}
    </>
  );
}
