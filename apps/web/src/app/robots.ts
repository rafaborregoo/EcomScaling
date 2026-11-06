import type { MetadataRoute } from "next";

// Solo las páginas públicas se rastrean; el portal (login, admin, dashboard…) queda fuera.
// Los recursos públicos deben seguir abiertos para que Google pueda renderizar la landing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/como-funciona", "/consultores", "/solicitar", "/legal", "/aviso-legal", "/politica-privacidad", "/condiciones", "/cookies", "/_next/", "/logos/", "/video/", "/favicon.ico", "/sitemap.xml"],
        disallow: "/",
      },
    ],
    sitemap: "https://ecom.noraapp.es/sitemap.xml",
  };
}
