/**
 * Puebla una tienda Shopify de desarrollo con datos de prueba realistas
 * (productos, clientes y pedidos) para poder desarrollar y demostrar
 * E-NORA sin depender de una tienda real.
 *
 * Requiere un token de una "custom app" creada DENTRO de la tienda de
 * desarrollo (Admin -> Configuracion -> Apps y canales de venta ->
 * Desarrollar apps -> Crear app), con estos scopes de Admin API:
 *   write_products, write_customers, write_draft_orders, write_orders
 * (y sus read_* equivalentes, que Shopify marca solos).
 *
 * Uso:
 *   ALLOW_SHOPIFY_SEED=true SHOPIFY_PRODUCTION_DOMAIN=mi-prod.myshopify.com
 *   SEED_SHOP_DOMAIN=mi-dev-store.myshopify.com SEED_ADMIN_TOKEN=shpat_xxx
 *   npm run seed:shopify-store
 * o anade estas variables a .env.local y ejecuta npm run seed:shopify-store.
 */
import { z } from "zod";

const envSchema = z.object({
  // Este script crea productos, clientes y pedidos en Shopify: nunca se
  // permite sin una confirmación explícita en el entorno.
  ALLOW_SHOPIFY_SEED: z.literal("true"),
  SHOPIFY_PRODUCTION_DOMAIN: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/),
  SEED_SHOP_DOMAIN: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/,
      "SEED_SHOP_DOMAIN debe ser *.myshopify.com",
    ),
  SEED_ADMIN_TOKEN: z.string().min(10),
  SEED_PRODUCT_COUNT: z.coerce.number().int().min(1).max(50).default(12),
  SEED_CUSTOMER_COUNT: z.coerce.number().int().min(1).max(50).default(10),
  SEED_ORDER_COUNT: z.coerce.number().int().min(1).max(60).default(25),
});

const env = envSchema.parse(process.env);
if (env.SEED_SHOP_DOMAIN === env.SHOPIFY_PRODUCTION_DOMAIN) {
  throw new Error(
    "SHOPIFY_SEED_PRODUCTION_DOMAIN_REFUSED: el seed requiere una tienda distinta de produccion",
  );
}
const API_VERSION = "2026-07";

async function adminGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://${env.SEED_SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SEED_ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return adminGraphql(query, variables);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `shopify_http_${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("shopify_empty_payload");
  }

  return payload.data;
}

function assertNoUserErrors(
  operation: string,
  userErrors: Array<{ field?: string[] | null; message: string }> | undefined,
) {
  if (userErrors?.length) {
    throw new Error(
      `${operation}: ${userErrors.map((item) => item.message).join("; ")}`,
    );
  }
}

const vendors = ["Nordic Wave", "Costa Sur", "Atelier Sol", "Brisa Studio"];
const productTypes = [
  "Bikini",
  "Banador",
  "Toalla",
  "Bolsa de playa",
  "Gafas",
  "Sandalias",
];
const adjectives = [
  "Coral",
  "Marina",
  "Tropical",
  "Dorada",
  "Azul",
  "Ibiza",
  "Riviera",
  "Salada",
  "Menorca",
  "Formentera",
  "Tarifa",
  "Cadiz",
];

type SeededVariant = { variantId: string; price: number };

async function createProducts() {
  const variants: SeededVariant[] = [];

  for (let index = 0; index < env.SEED_PRODUCT_COUNT; index += 1) {
    const title = `${productTypes[index % productTypes.length]} ${adjectives[index % adjectives.length]}`;
    const price = 19.9 + (index % 8) * 10;

    const result = await adminGraphql<{
      productCreate: {
        product: {
          id: string;
          variants: { nodes: Array<{ id: string }> };
        } | null;
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    }>(
      `
        mutation SeedProductCreate($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product {
              id
              variants(first: 1) { nodes { id } }
            }
            userErrors { field message }
          }
        }
      `,
      {
        product: {
          title,
          vendor: vendors[index % vendors.length],
          productType: productTypes[index % productTypes.length],
          status: "ACTIVE",
        },
      },
    );

    assertNoUserErrors("productCreate", result.productCreate.userErrors);
    const product = result.productCreate.product;
    const variantId = product?.variants.nodes[0]?.id;

    if (!product || !variantId) {
      throw new Error(
        "productCreate devolvio un producto sin variante por defecto",
      );
    }

    const priceUpdate = await adminGraphql<{
      productVariantsBulkUpdate: {
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    }>(
      `
        mutation SeedVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }
      `,
      {
        productId: product.id,
        variants: [{ id: variantId, price: price.toFixed(2) }],
      },
    );

    assertNoUserErrors(
      "productVariantsBulkUpdate",
      priceUpdate.productVariantsBulkUpdate.userErrors,
    );
    variants.push({ variantId, price });
    console.log(`Producto creado: ${title} (${price.toFixed(2)} EUR)`);
  }

  return variants;
}

async function createCustomers() {
  const customerIds: string[] = [];
  const firstNames = [
    "Lucia",
    "Marta",
    "Carla",
    "Ana",
    "Sofia",
    "Paula",
    "Elena",
    "Nerea",
    "Irene",
    "Claudia",
  ];
  const lastNames = [
    "Garcia",
    "Lopez",
    "Martin",
    "Sanchez",
    "Romero",
    "Navarro",
    "Molina",
    "Ortega",
    "Vidal",
    "Serrano",
  ];

  for (let index = 0; index < env.SEED_CUSTOMER_COUNT; index += 1) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[index % lastNames.length];
    // Dominio example.com para que nunca llegue un email real a nadie.
    const email = `seed.${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@example.com`;

    const result = await adminGraphql<{
      customerCreate: {
        customer: { id: string } | null;
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    }>(
      `
        mutation SeedCustomerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer { id }
            userErrors { field message }
          }
        }
      `,
      { input: { firstName, lastName, email } },
    );

    assertNoUserErrors("customerCreate", result.customerCreate.userErrors);
    if (result.customerCreate.customer) {
      customerIds.push(result.customerCreate.customer.id);
      console.log(`Cliente creado: ${firstName} ${lastName}`);
    }
  }

  return customerIds;
}

async function createOrders(variants: SeededVariant[], customerIds: string[]) {
  for (let index = 0; index < env.SEED_ORDER_COUNT; index += 1) {
    const lineCount = 1 + (index % 3);
    const lineItems = Array.from({ length: lineCount }, (_, lineIndex) => ({
      variantId: variants[(index + lineIndex) % variants.length].variantId,
      quantity: 1 + ((index + lineIndex) % 3),
    }));

    const draft = await adminGraphql<{
      draftOrderCreate: {
        draftOrder: { id: string } | null;
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    }>(
      `
        mutation SeedDraftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder { id }
            userErrors { field message }
          }
        }
      `,
      {
        input: {
          lineItems,
          purchasingEntity: {
            customerId: customerIds[index % customerIds.length],
          },
          tags: ["seed-data"],
        },
      },
    );

    assertNoUserErrors("draftOrderCreate", draft.draftOrderCreate.userErrors);
    const draftId = draft.draftOrderCreate.draftOrder?.id;

    if (!draftId) {
      throw new Error("draftOrderCreate no devolvio id");
    }

    const completion = await adminGraphql<{
      draftOrderComplete: {
        draftOrder: { order: { id: string; name: string } | null } | null;
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    }>(
      `
        mutation SeedDraftOrderComplete($id: ID!) {
          draftOrderComplete(id: $id, paymentPending: false) {
            draftOrder { order { id name } }
            userErrors { field message }
          }
        }
      `,
      { id: draftId },
    );

    assertNoUserErrors(
      "draftOrderComplete",
      completion.draftOrderComplete.userErrors,
    );
    console.log(
      `Pedido creado: ${completion.draftOrderComplete.draftOrder?.order?.name ?? draftId}`,
    );
  }
}

async function main() {
  console.log(`Sembrando datos de prueba en ${env.SEED_SHOP_DOMAIN}...`);

  const variants = await createProducts();
  const customerIds = await createCustomers();
  await createOrders(variants, customerIds);

  console.log("");
  console.log(
    `Listo: ${env.SEED_PRODUCT_COUNT} productos, ${env.SEED_CUSTOMER_COUNT} clientes y ${env.SEED_ORDER_COUNT} pedidos.`,
  );
  console.log(
    "Ahora conecta la tienda desde /integraciones (o pulsa 'Sincronizar ahora' en /shopify) para volcar los datos a E-NORA.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
