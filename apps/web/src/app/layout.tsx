import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Una sola fuente estandar para todo el portal (titulares, cuerpo y cifras).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EcomScaling IA",
  description: "Portal operativo para clientes y consultores de EcomScaling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
