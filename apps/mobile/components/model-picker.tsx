import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";

// Respuesta de GET /v1/organizations/:id/copilot/saldo: el saldo del mes y los modelos que deja elegir el plan.
type Saldo = {
  granted: number;
  used: number;
  remaining: number;
  approx_messages_left: number;
  days_to_renewal: number;
  all_models?: Array<{ id: string; label: string; description: string; available: boolean; reason: string | null }>;
  models: Array<{ id: string; label: string; description: string }>;
};

const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : `${n}`).replace(".", ",");

/** Desplegable del modelo de IA y, al lado, los tokens que quedan este mes. `onChange` recibe el id que entiende la API. */
export function ModelPicker({ base, value, onChange }: { base: string; value: string | null; onChange: (id: string) => void }) {
  const { data } = useApi<Saldo>(`${base}/copilot/saldo`);
  const [open, setOpen] = useState(false);
  const list = data?.all_models ?? data?.models.map((m) => ({ ...m, available: true, reason: null })) ?? [];
  const current = list.find((m) => m.id === value && m.available) ?? list.find((m) => m.available);
  if (!data || !current) return null;
  const left = tokens(data.remaining);
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="Elegir modelo de IA" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, fontFamily: font.semibold, color: c.ink }}>{current.label}</Text>
          <ChevronDown size={16} color={c.ink} />
        </Pressable>
        <Text style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}>{left} tokens</Text>
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Modelo de IA">
        {list.map((m) => {
          const on = m.id === current.id;
          return (
            <Pressable key={m.id} disabled={!m.available} onPress={() => { onChange(m.id); setOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.edge, opacity: m.available ? 1 : 0.45 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontFamily: on ? font.semibold : font.medium, color: c.ink }}>{m.label}</Text>
                <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{m.available ? m.description : m.reason}</Text>
              </View>
              {on && <Check size={20} color={c.ink} />}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}
