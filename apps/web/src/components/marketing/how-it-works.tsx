"use client";

import { useRef } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui";
import styles from "./how-it-works.module.css";

// Páginas públicas con vídeo explicativo (/como-funciona para clientes,
// /consultores para consultores): el vídeo y, debajo, los mismos seis pasos que
// cuenta, con lo que hace la app en cada uno. Los titulares y frases son los del
// vídeo (video/GUION_LANDING.md y video/GUION_CONSULTORES.md); si cambian allí,
// se cambian aquí. `at` es el segundo del vídeo en que empieza cada paso.

export type HowItWorksStep = { label: string; at: number; title: string; body: string; points: string[] };

export function HowItWorks({ id, title, lead, video: src, videoLabel, steps, cta }: {
  id: string;
  title: string;
  lead: string;
  /** Ruta sin extensión: `${video}.mp4` y su póster `${video}.jpg`. */
  video: string;
  videoLabel: string;
  steps: HowItWorksStep[];
  cta: { label: string; href: string };
}) {
  const video = useRef<HTMLVideoElement>(null);

  const play = (at: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = at;
    void el.play().catch(() => undefined);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <section className={styles.hero} aria-labelledby={id}>
        <h1 id={id}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        <video
          ref={video}
          className={styles.video}
          src={`${src}.mp4`}
          poster={`${src}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label={videoLabel}
        />
        <div className={styles.actions}>
          <Link className={buttonVariants({ size: "lg" })} href={cta.href}>{cta.label}</Link>
        </div>
      </section>

      <ol className={styles.steps} aria-label="Los seis pasos">
        {steps.map((step, i) => (
          <li key={step.label} id={`paso-${i + 1}`} className={styles.step}>
            <div>
              <span className={styles.kicker}>Paso {i + 1} de {steps.length} · {step.label}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              <button type="button" className={buttonVariants({ variant: "ghost", size: "sm", className: styles.seek })} onClick={() => play(step.at)}>
                Ver este paso en el vídeo
              </button>
            </div>
            <ul>
              {step.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section className={styles.close} aria-label="Empieza">
        <p>Tu propia línea, no hay competición.</p>
        <Link className={buttonVariants({ size: "lg" })} href={cta.href}>{cta.label}</Link>
      </section>
    </>
  );
}
