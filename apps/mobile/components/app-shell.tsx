import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { apiGet, type Bootstrap } from "../lib/api";
import { supabase } from "../lib/supabase";
import { clearApiCache } from "../lib/use-api";
import { registerForPush, unregisterPush } from "../lib/push";
import { c, font } from "../lib/theme";
import { AdminShell } from "./shell-admin";
import { ClientShell } from "./shell-cliente";
import { ConsultantShell } from "./shell-consultor";

// Tres interfaces, una por rol (README): el cliente ve SU tienda, el consultor trabaja sobre una cartera de clientes
// y el administrador de plataforma vigila la plataforma. Se elige al abrir, según `platform_role`; no hay conmutador.
export function AppShell() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registerForPush();
    apiGet<Bootstrap>("/v1/bootstrap").then(setBoot, (e: Error) => setError(e.message));
  }, []);

  const signOut = async () => {
    await unregisterPush();
    clearApiCache();
    await supabase.auth.signOut();
  };

  if (!boot) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20, backgroundColor: c.bg }}>
        {error ? <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={c.accent} />}
      </View>
    );
  }
  const role = boot.profile.platform_role;
  return role === "platform_admin" ? <AdminShell boot={boot} onSignOut={signOut} /> : role === "consultant" ? <ConsultantShell boot={boot} onSignOut={signOut} /> : <ClientShell boot={boot} onSignOut={signOut} />;
}
