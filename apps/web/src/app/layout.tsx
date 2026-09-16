import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { AriaRouterProvider } from "@/components/aria-router-provider";
import { Toast } from "@/components/ui";
import "./globals.css";

// Fuente estandar de todo el CRM, self-hosted en build (sin request a Google
// en runtime). IBM Plex Sans no es variable: hay que declarar los pesos.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EcomScaling IA",
  description: "Portal operativo para clientes y consultores de EcomScaling.",
  // El portal se usa como app instalada en el móvil (Añadir a pantalla de
  // inicio): sin barra de navegador, arranque a pantalla completa.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EcomScaling",
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
          {children}
          {/* Arriba y flotando sobre el contenido, justo bajo el nav: un aviso
              de "conectada" o de error tiene que verse sin depender de donde
              este el scroll, y desaparecer solo. */}
          <Toast.Provider placement="top" />
        </AriaRouterProvider>
      </body>
    </html>
  );
}
