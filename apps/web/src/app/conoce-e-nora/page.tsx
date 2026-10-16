import type { Metadata } from "next";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { ProcessStory } from "@/components/marketing/process-story";

export const metadata: Metadata = {
  title: "Cómo funciona E-NORA · Tu ecommerce, claro y en un solo sitio",
  description: "Une Shopify, Meta y Klaviyo, entiende qué vende y qué solo gasta, recibe avisos cuando algo se tuerce y decide el siguiente paso con tu equipo.",
};

export default function PlatformPage() {
  return (
    <PublicEntryShell active="platform">
      <main id="public-content" className="enoraMarketingPage">
        <ProcessStory />
      </main>
    </PublicEntryShell>
  );
}
