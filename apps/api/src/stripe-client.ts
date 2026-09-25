import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

type StripeClientEnv = {
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_API_VERSION?: string | undefined;
};

/** Cliente unico para que todas las llamadas usen la misma version y SDK. */
export function createStripeClient(env: StripeClientEnv) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("stripe_not_configured");
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: (env.STRIPE_API_VERSION ??
      STRIPE_API_VERSION) as Stripe.LatestApiVersion,
    appInfo: { name: "E-NORA", version: "0.1.0" },
  });
}

export function stripeErrorDetail(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

export function stripeErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}
