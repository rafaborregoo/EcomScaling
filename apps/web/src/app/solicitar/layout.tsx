import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar acceso a E-NORA",
  description: "Pide tu plaza para conectar Shopify, Meta Ads y Klaviyo y que NORA te diga qué hacer cada día. Plazas limitadas, pero cualquiera puede solicitar.",
  alternates: { canonical: "/solicitar" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
