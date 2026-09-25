import type { MetadataRoute } from "next";

// Manifest de la app instalable ("Instalar app" en Android/Chrome, "Añadir a
// pantalla de inicio" en iOS). Next enlaza <link rel="manifest"> solo por
// existir este archivo. El icono es un SVG (Chrome moderno lo acepta; iOS usa
// el apple-touch-icon / captura de pantalla).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "E-NORA IA",
    short_name: "E-NORA",
    description:
      "Portal operativo para clientes y consultores de E-NORA.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
