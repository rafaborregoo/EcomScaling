import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Guard explícito: este script hace upsert/delete lógico sobre datos de demo
  // y nunca debe ejecutarse por accidente contra el proyecto de producción.
  ALLOW_DEMO_SEED: z.literal("true"),
  DEMO_USER_ID: z.string().uuid().default("95ca12f1-72b1-474c-ab53-73320f78d6a3"),
  DEMO_CLIENT_USER_ID: z.string().uuid().default("40e2d772-02d3-4884-b8b6-755c22c0b561"),
  DEMO_FULL_NAME: z.string().default("Rafa Borrego"),
  DEMO_CLIENT_FULL_NAME: z.string().default("Cliente Demo"),
  DEMO_ORG_NAME: z.string().default("EcomScaling Demo"),
  DEMO_ORG_SLUG: z.string().default("ecomscaling-demo"),
  DEMO_CLIENT_ORG_NAME: z.string().default("Cliente Demo Store"),
  DEMO_CLIENT_ORG_SLUG: z.string().default("cliente-demo-store"),
});

const env = envSchema.parse(process.env);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

const now = new Date().toISOString();

async function main() {
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: env.DEMO_USER_ID,
      full_name: env.DEMO_FULL_NAME,
      platform_role: "platform_admin",
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`Profile seed failed: ${profileError.message}`);
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .upsert(
      {
        display_name: env.DEMO_ORG_NAME,
        slug: env.DEMO_ORG_SLUG,
        timezone: "Europe/Madrid",
        currency_code: "EUR",
        status: "active",
        activated_at: now,
        created_by: env.DEMO_USER_ID,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (organizationError) {
    throw new Error(`Organization seed failed: ${organizationError.message}`);
  }

  const { error: membershipError } = await supabase.from("organization_members").upsert(
    {
      organization_id: organization.id,
      user_id: env.DEMO_USER_ID,
      role: "owner",
      is_active: true,
      joined_at: now,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (membershipError) {
    throw new Error(`Membership seed failed: ${membershipError.message}`);
  }

  const { data: existingSubscription, error: subscriptionLookupError } = await supabase
    .from("service_subscriptions")
    .select("id")
    .eq("organization_id", organization.id)
    .in("status", ["trial", "active"])
    .maybeSingle();

  if (subscriptionLookupError) {
    throw new Error(`Subscription lookup failed: ${subscriptionLookupError.message}`);
  }

  if (!existingSubscription) {
    const { error: subscriptionError } = await supabase.from("service_subscriptions").insert({
      organization_id: organization.id,
      plan_code: "internal_test",
      status: "active",
      starts_at: now,
    });

    if (subscriptionError) {
      throw new Error(`Subscription seed failed: ${subscriptionError.message}`);
    }
  }

  console.log(
    JSON.stringify({
      status: "ok",
      admin_user_id: env.DEMO_USER_ID,
      admin_organization_id: organization.id,
    }),
  );

  const { error: clientProfileError } = await supabase.from("profiles").upsert(
    {
      id: env.DEMO_CLIENT_USER_ID,
      full_name: env.DEMO_CLIENT_FULL_NAME,
      platform_role: "user",
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (clientProfileError) {
    throw new Error(`Client profile seed failed: ${clientProfileError.message}`);
  }

  const { data: clientOrganization, error: clientOrganizationError } = await supabase
    .from("organizations")
    .upsert(
      {
        display_name: env.DEMO_CLIENT_ORG_NAME,
        slug: env.DEMO_CLIENT_ORG_SLUG,
        timezone: "Europe/Madrid",
        currency_code: "EUR",
        status: "active",
        activated_at: now,
        created_by: env.DEMO_USER_ID,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (clientOrganizationError) {
    throw new Error(`Client organization seed failed: ${clientOrganizationError.message}`);
  }

  const { error: clientMembershipError } = await supabase.from("organization_members").upsert(
    {
      organization_id: clientOrganization.id,
      user_id: env.DEMO_CLIENT_USER_ID,
      role: "owner",
      is_active: true,
      joined_at: now,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (clientMembershipError) {
    throw new Error(`Client membership seed failed: ${clientMembershipError.message}`);
  }

  const { error: consultantAssignmentError } = await supabase
    .from("consultant_assignments")
    .upsert(
      {
        organization_id: clientOrganization.id,
        consultant_user_id: env.DEMO_USER_ID,
        is_primary: true,
        is_active: true,
        assigned_by: env.DEMO_USER_ID,
        assigned_at: now,
      },
      { onConflict: "organization_id,consultant_user_id" },
    );

  if (consultantAssignmentError) {
    throw new Error(`Consultant assignment seed failed: ${consultantAssignmentError.message}`);
  }

  const { data: existingClientSubscription, error: clientSubscriptionLookupError } =
    await supabase
      .from("service_subscriptions")
      .select("id")
      .eq("organization_id", clientOrganization.id)
      .in("status", ["trial", "active"])
      .maybeSingle();

  if (clientSubscriptionLookupError) {
    throw new Error(`Client subscription lookup failed: ${clientSubscriptionLookupError.message}`);
  }

  if (!existingClientSubscription) {
    const { error: clientSubscriptionError } = await supabase
      .from("service_subscriptions")
      .insert({
        organization_id: clientOrganization.id,
        plan_code: "growth",
        status: "active",
        starts_at: now,
      });

    if (clientSubscriptionError) {
      throw new Error(`Client subscription seed failed: ${clientSubscriptionError.message}`);
    }
  }

  console.log(
    JSON.stringify({
      status: "ok",
      client_user_id: env.DEMO_CLIENT_USER_ID,
      client_organization_id: clientOrganization.id,
    }),
  );

  const { error: integrationConnectionError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        organization_id: clientOrganization.id,
        provider: "shopify",
        provider_account_id: "demo-store.myshopify.com",
        provider_account_name: "Demo Store",
        status: "pending",
        scopes: ["read_products", "read_inventory", "read_locations", "read_orders"],
        api_version: "2026-07",
        connected_by: env.DEMO_USER_ID,
        metadata: {
          source: "seed",
          note: "Placeholder until OAuth is implemented.",
        },
      },
      { onConflict: "organization_id,provider,provider_account_id" },
    );

  if (integrationConnectionError) {
    const message = integrationConnectionError.message.toLowerCase();

    if (
      message.includes("integration_connections") ||
      message.includes("could not find the table")
    ) {
      console.log(
        JSON.stringify({
          status: "skipped",
          reason: "integration_connections table not available yet",
        }),
      );
      return;
    }

    throw new Error(`Integration connection seed failed: ${integrationConnectionError.message}`);
  }

  console.log(
    JSON.stringify({
      status: "ok",
      integration: "shopify",
      provider_account_id: "demo-store.myshopify.com",
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
