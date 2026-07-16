"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
      <section className="w-full max-w-md rounded-md border border-[#d8d8d8] bg-white p-6 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#dc1f26]">
          EcomScaling IA
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Acceso</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input
              className="mt-2 w-full rounded-md border border-[#cfcfcf] px-3 py-2 outline-none focus:border-[#dc1f26]"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Password</span>
            <input
              className="mt-2 w-full rounded-md border border-[#cfcfcf] px-3 py-2 outline-none focus:border-[#dc1f26]"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="rounded-md border border-[#dc1f26] bg-white px-3 py-2 text-sm text-[#b5121b]">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-[#dc1f26] disabled:cursor-not-allowed disabled:bg-[#808080]"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
