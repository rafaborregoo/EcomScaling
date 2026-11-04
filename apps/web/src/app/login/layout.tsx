import type { Metadata } from "next";

// El acceso es para cuentas invitadas: no tiene sentido que aparezca en Google.
export const metadata: Metadata = {
  title: "Iniciar sesión en E-NORA",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
