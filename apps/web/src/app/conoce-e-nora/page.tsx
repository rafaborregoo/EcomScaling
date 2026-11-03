import { permanentRedirect } from "next/navigation";

// La página pública pasó a /como-funciona; los enlaces viejos siguen llegando.
export default function PlatformPage() {
  permanentRedirect("/como-funciona");
}
