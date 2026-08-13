import type { Metadata } from "next";
import { AriaRouterProvider } from "@/components/aria-router-provider";
import { Toast } from "@/components/ui";
import "./globals.css";

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
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AriaRouterProvider>
          {children}
          <Toast.Provider />
        </AriaRouterProvider>
      </body>
    </html>
  );
}
