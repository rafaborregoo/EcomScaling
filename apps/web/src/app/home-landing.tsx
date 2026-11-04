"use client";

import Link from "next/link";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { buttonVariants } from "@/components/ui";
import styles from "@/components/marketing/how-it-works.module.css";
import { HomeRedirect } from "./home-redirect";

const PLAZAS = "Plazas limitadas. Cualquiera puede solicitar acceso.";

const PILARES = [
  {
    label: "Para tu tienda",
    title: "Cada mañana sabes qué hacer, y por qué",
    body: "NORA lee tus pedidos, tu stock, tus anuncios y tus emails, y te propone el siguiente paso con las fuentes a la vista. Si lo aceptas, pasa a tus tareas; si no, no cambia nada.",
    points: [
      "Ventas, pedidos, beneficio y conversión frente al mes anterior.",
      "El beneficio desglosado: producto, envíos, comisiones, publicidad y gastos fijos.",
      "NORA propone y tú decides: nunca toca tus cuentas por su cuenta.",
    ],
    href: "/como-funciona",
    cta: "Ver cómo funciona",
  },
  {
    label: "Para consultores",
    title: "Toda tu cartera de clientes en una pantalla",
    body: "Ves qué cliente te necesita y por qué, qué han detectado los especialistas de NORA y qué te toca aprobar. Preparas el plan con el cliente y le envías el informe con tu marca.",
    points: [
      "Clientes ordenados por urgencia, con el motivo.",
      "Planes por fases con meta de ventas, y campañas que revisas antes de programar.",
      "Informes mensuales con el nombre, el logo y el color de tu consultoría.",
    ],
    href: "/consultores",
    cta: "Ver E-NORA para consultores",
  },
];

export function HomeLanding() {
  return (
    <PublicEntryShell active="platform">
      <HomeRedirect />
      <main id="public-content">
        <section className={styles.hero} aria-labelledby="home-title">
          <h1 id="home-title">Shopify, Meta Ads y Klaviyo en una sola pantalla.</h1>
          <p className={styles.lead}>
            NORA revisa tus números cada mañana y te dice qué hacer. Cada plataforma con su cifra, sin sumar atribuciones. Tú decides.
          </p>
          {/* Aquí irá el vídeo de la home cuando esté grabado. */}
          <div className={styles.actions}>
            <Link className={buttonVariants({ size: "lg" })} href="/solicitar">Pedir acceso</Link>
            <Link className={buttonVariants({ size: "lg", variant: "ghost" })} href="/como-funciona">Ver cómo funciona</Link>
          </div>
          <p className={styles.note}>{PLAZAS}</p>
        </section>

        <ol className={styles.steps} aria-label="Para quién es E-NORA">
          {PILARES.map((p) => (
            <li key={p.href} className={styles.step}>
              <div>
                <span className={styles.kicker}>{p.label}</span>
                <h2>{p.title}</h2>
                <p>{p.body}</p>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={p.href}>{p.cta}</Link>
              </div>
              <ul>
                {p.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <section className={styles.close} aria-label="Empieza">
          <p>Tu propia línea, no hay competición.</p>
          <Link className={buttonVariants({ size: "lg" })} href="/solicitar">Pedir acceso</Link>
          <p className={styles.note}>{PLAZAS}</p>
        </section>
      </main>
    </PublicEntryShell>
  );
}
