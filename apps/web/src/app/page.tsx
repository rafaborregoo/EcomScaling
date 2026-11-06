import type { Metadata } from "next";
import { HomeLanding } from "./home-landing";

export const metadata: Metadata = {
  title: { absolute: "E-NORA | Software de ecommerce con inteligencia artificial" },
  description:
    "Todo tu ecommerce en una misma plataforma. E-NORA conecta Shopify, Meta Ads y Klaviyo con IA para analizar tu negocio y planificar acciones. Solicita acceso.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "E-NORA",
    url: "/",
    title: "E-NORA | Todo tu ecommerce en una misma plataforma",
    description: "Ventas, stock, publicidad y email marketing conectados con IA. Una plataforma para tiendas online y consultores de ecommerce.",
    images: ["/logos/e-nora-login.svg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ecom.noraapp.es/#organization",
      name: "E-NORA",
      url: "https://ecom.noraapp.es/",
      logo: "https://ecom.noraapp.es/logos/e-nora-login.svg",
      description: "Software de ecommerce con inteligencia artificial para tiendas online y consultores. Conecta Shopify, Meta Ads y Klaviyo en una misma plataforma.",
    },
    {
      "@type": "WebSite",
      "@id": "https://ecom.noraapp.es/#website",
      name: "E-NORA",
      url: "https://ecom.noraapp.es/",
      inLanguage: "es-ES",
      publisher: { "@id": "https://ecom.noraapp.es/#organization" },
      description: "Todo tu ecommerce en una misma plataforma: ventas, stock, publicidad, email marketing y colaboración con tu consultor, con IA.",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <HomeLanding />
    </>
  );
}
