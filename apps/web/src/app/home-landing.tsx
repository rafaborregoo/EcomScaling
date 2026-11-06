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
    title: "Tu tienda bajo control, cada día",
    body: "Consulta tus ventas, conoce tu beneficio y detecta qué necesita atención. La IA de E-NORA analiza los datos de tu tienda y te propone acciones para que puedas decidir con información clara.",
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
    title: "Cada cliente, con un plan claro",
    body: "Gestiona tu cartera de ecommerce desde un mismo lugar. Identifica qué tiendas necesitan atención, prepara sus planes de crecimiento y revisa campañas e informes con tu marca.",
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
          <h1 id="home-title">Todo tu ecommerce en una misma plataforma</h1>
          <p className={styles.lead}>
            E-NORA es el software de ecommerce con IA que reúne tus ventas, stock, publicidad y email marketing. Conecta Shopify, Meta Ads y Klaviyo para entender tu negocio, planificar tus acciones y trabajar con tu consultor desde un mismo lugar.
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
          <p>Empieza a gestionar tu ecommerce con una visión completa.</p>
          <Link className={buttonVariants({ size: "lg" })} href="/solicitar">Pedir acceso</Link>
          <p className={styles.note}>{PLAZAS}</p>
        </section>
      </main>
    </PublicEntryShell>
  );
}
