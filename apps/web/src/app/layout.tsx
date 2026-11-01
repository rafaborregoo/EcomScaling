import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AriaRouterProvider } from "@/components/aria-router-provider";
import { PersistentPortalFrame } from "@/components/persistent-portal-frame";
import { Toast } from "@/components/ui";
import "./globals.css";

// Archivos locales para evitar depender de Google Fonts durante el build.
const plexSans = localFont({
  src: [
    {
      path: "./fonts/ibm-plex-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/ibm-plex-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/ibm-plex-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/ibm-plex-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "E-NORA IA",
  description: "Portal operativo para clientes y consultores de E-NORA.",
  icons: {
    icon: [{ url: "/logos/e-nora-simple.svg", type: "image/svg+xml" }],
  },
  // El portal se usa como app instalada en el móvil (Añadir a pantalla de
  // inicio): sin barra de navegador, arranque a pantalla completa.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "E-NORA",
  },
};

// `viewport-fit=cover` habilita las env(safe-area-inset-*) que usan la barra
// inferior y el contenido para respetar el notch / franja del gesto en iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Con el teclado virtual abierto, el viewport de maquetacion NO encoge por
  // defecto: los contenedores `position: fixed` (el drawer del Consultor IA, la
  // hoja inferior del menu, la de notificaciones) mantienen su alto y su campo
  // de texto queda debajo del teclado. `resizes-content` encoge el viewport, que
  // es lo que hace una app nativa.
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${plexSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AriaRouterProvider>
          <PersistentPortalFrame>{children}</PersistentPortalFrame>
          {/* Arriba y flotando sobre el contenido, justo bajo el nav: un aviso
              de "conectada" o de error tiene que verse sin depender de donde
              este el scroll, y desaparecer solo. */}
          <Toast.Provider placement="top" />
        </AriaRouterProvider>
      </body>
    </html>
  );
}
