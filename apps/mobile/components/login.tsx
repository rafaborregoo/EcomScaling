import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { c, font } from "../lib/theme";

const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? "";

// Misma estructura que apps/web/src/app/login: logo, "Inicia sesión", Email, Contraseña, Entrar.
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setError(error?.message ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  const input = {
    borderWidth: 1,
    borderColor: c.edge,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: font.regular,
    color: c.ink,
    backgroundColor: c.bg,
  } as const;
  const label = { fontSize: 14, fontFamily: font.medium, color: c.ink, marginBottom: 6 } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.edge, borderRadius: 16, padding: 24 }}>
          <Image source={require("../assets/logo-letras.png")} style={{ width: 120, height: 33 }} resizeMode="contain" accessibilityLabel="E-NORA" />
          <Text style={{ marginTop: 24, fontSize: 22, fontFamily: font.semibold, color: c.ink }}>Inicia sesión</Text>
          <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 21, fontFamily: font.regular, color: c.muted }}>
            Accede al centro operativo de tu organización.
          </Text>

          <View style={{ marginTop: 24 }}>
            <Text style={label}>Email</Text>
            <TextInput
              style={input}
              placeholder="tu@empresa.com"
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={{ marginTop: 16 }}>
            <Text style={label}>Contraseña</Text>
            <View>
              <TextInput
                style={{ ...input, paddingRight: 84 }}
                placeholder="••••••••"
                placeholderTextColor={c.muted}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={signIn}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>{showPassword ? "Ocultar" : "Mostrar"}</Text>
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={{ marginTop: 16, borderRadius: 10, padding: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
              <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={signIn}
            disabled={busy}
            style={{ marginTop: 24, borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: busy ? c.muted : c.accent }}
          >
            <Text style={{ fontSize: 16, fontFamily: font.semibold, color: "#fff" }}>{busy ? "Entrando..." : "Entrar"}</Text>
          </Pressable>

          {webUrl !== "" && (
            <Pressable onPress={() => Linking.openURL(`${webUrl}/recuperar`)} style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted, textDecorationLine: "underline" }}>He olvidado mi contraseña</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
