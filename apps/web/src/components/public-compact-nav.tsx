"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import styles from "./public-entry.module.css";

/** Al bajar, la cabecera pública se reduce a logo (esquina izquierda) y «Ingresar» (esquina derecha). */
export function PublicCompactNav() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(window.scrollY > 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div className={styles.compact} data-on={on} aria-hidden={!on}>
      <Link href="/conoce-e-nora" aria-label="E-NORA, inicio" tabIndex={on ? 0 : -1} className={styles.compactLogo}><BrandLogo /></Link>
      <Link href="/login" tabIndex={on ? 0 : -1} className={styles.compactLogin}>Ingresar</Link>
    </div>
  );
}
