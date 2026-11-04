import type { MetadataRoute } from "next";

// Solo las páginas públicas se rastrean; el portal (login, admin, dashboard…) queda fuera.
// /_next/ debe seguir abierto: Google lo necesita para pintar las páginas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/como-funciona", "/consultores", "/solicitar", "/legal", "/aviso-legal", "/politica-privacidad", "/condiciones", "/cookies", "/_next/"],
        disallow: "/",
      },
    ],
    sitemap: "https://ecom.noraapp.es/sitemap.xml",
  };
}
