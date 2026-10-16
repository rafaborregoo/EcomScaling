import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Image as ImageIcon, Minus, Plus, X } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { c, font } from "../lib/theme";
import { colorOf, isHttpUrl, type ColorRef, type StudioBrand } from "../lib/studio";
import { Sheet } from "./sheet";

// Campos de formulario del editor del Estudio: planos, de una columna y con el dedo gordo en mente.

export const labelStyle = { fontSize: 13, fontFamily: font.medium, color: c.muted } as const;

export function Field({ label, value, onChange, multiline, placeholder, keyboard, hint, counter }: { counter?: string; label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; keyboard?: "default" | "url" | "email-address" | "numeric"; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text style={labelStyle}>{label}</Text>
        {counter ? <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{counter}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#a0a0a0"
        keyboardType={keyboard ?? "default"}
        autoCapitalize={keyboard === "url" || keyboard === "email-address" ? "none" : "sentences"}
        autoCorrect={keyboard === "url" || keyboard === "email-address" ? false : undefined}
        style={{ minHeight: multiline ? 96 : 48, textAlignVertical: multiline ? "top" : "center", fontSize: 16, fontFamily: font.regular, color: c.ink, backgroundColor: c.surface, borderWidth: 1, borderColor: c.edge, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
      />
      {hint ? <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{hint}</Text> : null}
    </View>
  );
}

/** Bloque con título para agrupar campos de un formulario. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 14, marginTop: 10 }}>
      <Text style={{ fontSize: 16, fontFamily: font.semibold, color: c.ink }}>{title}</Text>
      {children}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 15, fontFamily: font.regular, color: c.ink }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.edge }} />
    </View>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={labelStyle}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? c.ink : c.edge, backgroundColor: on ? c.ink : c.bg }}>
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: on ? "#fff" : c.ink }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Stepper({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const btn = { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.edge, alignItems: "center", justifyContent: "center" } as const;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 15, fontFamily: font.regular, color: c.ink }}>{label}</Text>
      <Pressable onPress={() => set(value - step)} style={btn} hitSlop={6}><Minus size={16} color={c.ink} /></Pressable>
      <Text style={{ minWidth: 52, textAlign: "center", fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{`${value}${suffix}`}</Text>
      <Pressable onPress={() => set(value + step)} style={btn} hitSlop={6}><Plus size={16} color={c.ink} /></Pressable>
    </View>
  );
}

const ROLES: Array<{ ref: ColorRef; label: string }> = [
  { ref: "primary", label: "Principal" },
  { ref: "accent", label: "Acento" },
  { ref: "text", label: "Texto" },
  { ref: "bg", label: "Fondo" },
  { ref: "card", label: "Tarjeta" },
  { ref: "white", label: "Blanco" },
];

/** Un color es un rol de la marca (se repinta si cambia la marca) o un hex. */
export function ColorField({ label, value, brand, onChange }: { label: string; value: ColorRef; brand: StudioBrand; onChange: (v: ColorRef) => void }) {
  const isRole = ROLES.some((r) => r.ref === value);
  return (
    <View style={{ gap: 8 }}>
      <Text style={labelStyle}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {ROLES.map((r) => {
          const on = r.ref === value;
          return (
            <Pressable key={r.ref} onPress={() => onChange(r.ref)} accessibilityLabel={r.label} style={{ alignItems: "center", gap: 4 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colorOf(r.ref, brand), borderWidth: on ? 3 : 1, borderColor: on ? c.ink : c.edge }} />
              <Text style={{ fontSize: 11, fontFamily: font.regular, color: c.muted }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={isRole ? "" : value}
        onChangeText={(t) => onChange(t.startsWith("#") || t === "" ? (t as ColorRef) : (`#${t}` as ColorRef))}
        placeholder="O un color propio, p. ej. #1d4ed8"
        placeholderTextColor="#a0a0a0"
        autoCapitalize="none"
        maxLength={7}
        style={{ fontSize: 15, fontFamily: font.regular, color: c.ink, borderBottomWidth: 1, borderBottomColor: c.edge, paddingVertical: 6 }}
      />
    </View>
  );
}

/** Fecha (y hora si `withTime`) en el formato del diseño: YYYY-MM-DD o YYYY-MM-DDTHH:mm. */
export function DateField({ label, value, withTime, onChange }: { label: string; value: string; withTime?: boolean; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const parsed = value ? new Date(withTime ? value : `${value}T12:00`) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${withTime ? `T${pad(d.getHours())}:${pad(d.getMinutes())}` : ""}`;
  const shown = value ? date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) + (withTime ? ` · ${pad(date.getHours())}:${pad(date.getMinutes())}` : "") : "Elegir";
  return (
    <View style={{ gap: 6 }}>
      <Text style={labelStyle}>{label}</Text>
      <Pressable onPress={() => setMode("date")} style={{ borderBottomWidth: 1, borderBottomColor: c.edge, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, fontFamily: font.regular, color: c.ink }}>{shown}</Text>
      </Pressable>
      {mode && (
        <DateTimePicker
          value={date}
          mode={mode}
          onChange={(_e, d) => {
            const next = mode === "date" && withTime ? "time" : null;
            setMode(next);
            if (d) onChange(fmt(d));
          }}
        />
      )}
    </View>
  );
}

export type ImageOption = { src: string; label: string };

/** Elegir una imagen: de las que ya hay en la pieza y los productos, por enlace o subiendo una de la galería. */
export function ImageField({ label, value, images, orgId, onChange, onUploaded }: { label: string; value: string; images: ImageOption[]; orgId: string; onChange: (src: string, label?: string) => void; onUploaded: (img: ImageOption) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function pickFromGallery() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    setBusy(true);
    try {
      const mime = asset.mimeType ?? "image/jpeg";
      const { url } = await apiSend<{ url: string }>("POST", `/v1/organizations/${orgId}/marketing/assets`, { filename: asset.fileName ?? "imagen.jpg", content_base64: `data:${mime};base64,${asset.base64}` }, 60_000);
      const img = { src: url, label: asset.fileName ?? "Imagen" };
      onUploaded(img);
      onChange(img.src, img.label);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={labelStyle}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {isHttpUrl(value) ? <Image source={{ uri: value }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.surface }} /> : <View style={{ width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: c.edge, alignItems: "center", justifyContent: "center" }}><ImageIcon size={22} color={c.muted} /></View>}
        <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.accent }}>{value ? "Cambiar imagen" : "Elegir imagen"}</Text>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Imagen">
        <Pressable onPress={pickFromGallery} disabled={busy} style={{ borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: c.ink }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>Subir desde la galería</Text>}
        </Pressable>
        {error ? <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text> : null}
        <Field label="O pega un enlace (https://…)" value={link} onChange={setLink} keyboard="url" />
        {isHttpUrl(link) && (
          <Pressable onPress={() => { onChange(link); setOpen(false); }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.accent }}>Usar este enlace</Text>
          </Pressable>
        )}
        {images.length > 0 && <Text style={labelStyle}>De esta pieza y de tus productos</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {images.map((img) => (
            <Pressable key={img.src} onPress={() => { onChange(img.src, img.label); setOpen(false); }} accessibilityLabel={img.label}>
              <Image source={{ uri: img.src }} style={{ width: 96, height: 96, borderRadius: 8, backgroundColor: c.surface, borderWidth: img.src === value ? 3 : 0, borderColor: c.ink }} />
            </Pressable>
          ))}
        </View>
        {value ? (
          <Pressable onPress={() => { onChange(""); setOpen(false); }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.danger }}>Quitar imagen</Text>
          </Pressable>
        ) : null}
      </Sheet>
    </View>
  );
}

/** Fila de lista con botón de quitar. */
export function RemovableRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: 1, borderTopColor: c.edge, paddingTop: 12 }}>
      <View style={{ flex: 1, gap: 10 }}>{children}</View>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel="Quitar"><X size={20} color={c.muted} /></Pressable>
    </View>
  );
}

export const Scroll = ({ children }: { children: ReactNode }) => (
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }}>
    {children}
  </ScrollView>
);
