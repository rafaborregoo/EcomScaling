import type { Metadata } from "next";
import { HomeLanding } from "./home-landing";

export const metadata: Metadata = {
  title: { absolute: "E-NORA: Shopify, Meta Ads y Klaviyo en una pantalla, con IA que propone y tú decides" },
  description:
    "NORA revisa cada mañana tus números de Shopify, Meta Ads y Klaviyo y te dice qué hacer. Para tiendas online y consultores de ecommerce. Plazas limitadas.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeLanding />;
}
