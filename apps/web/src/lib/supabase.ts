"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const client =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

/**
 * El cliente se construye solo cuando existe configuración pública válida.
 * Así las páginas cliente pueden prerenderizarse en CI sin secretos, pero
 * cualquier uso real falla con un mensaje explícito en vez de enviar tráfico
 * a un endpoint inventado.
 */
export function getSupabaseClient() {
  if (!client) {
    throw new Error(
      "Supabase no esta configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return client;
}
