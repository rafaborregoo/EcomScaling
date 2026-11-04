import type { NextConfig } from "next";

// Cabeceras de seguridad sin riesgo para el portal. No se pone X-Frame-Options
// porque la app de Shopify es `embedded` (el admin de Shopify la carga en un
// iframe); una CSP con frame-ancestors queda para cuando se pruebe el portal entero.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
