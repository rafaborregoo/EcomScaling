import { createClient } from "@supabase/supabase-js";
import { TOOL_REGISTRY, type ToolDefinition } from "@ecomscaling/ai";
import { type AuthContext } from "./auth-context.js";

/**
 * Catalogo de tools para /admin/tools.
 *
 * Responde a "que sabe hacer el copiloto y quien puede usarlo", que hasta
 * ahora solo se podia contestar leyendo `tool-layer.ts` y tres migraciones a
 * la vez.
 *
 * Dos fuentes y ninguna copia:
 *  - `TOOL_REGISTRY` (packages/ai) da nombre, permiso, conector, estado y la
 *    misma descripcion que recibe el modelo. Si el panel dijera otra cosa que
 *    el prompt, el panel mentiria.
 *  - `agent_versions.allowed_tools` de la version ACTIVA de cada agente dice
 *    quien la tiene concedida. Una tool `implemented_partial` que ningun
 *    agente puede llamar esta construida y no la usa nadie, y eso solo se ve
 *    cruzando las dos.
 */

type ToolCatalogEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type ToolCatalogRow = ToolDefinition & {
  /** Codigos de agente cuya version activa la tiene en `allowed_tools`. */
  granted_to: string[];
};

// Mismas dos ayudas que `billing.ts` define para si mismo: no hay un modulo
// comun de acceso todavia y sacarlo aqui seria un refactor que este panel no
// necesita.
function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un platform admin puede ver el catalogo de tools.",
    };
  }
  return { ok: true as const };
}

function createServiceClient(env: ToolCatalogEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getToolCatalog(
  env: ToolCatalogEnv,
  context: AuthContext,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("agent_versions")
    .select("allowed_tools, agent_definitions!inner(code)")
    .eq("is_active", true);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "tool_catalog_load_failed",
      detail: error.message,
    };
  }

  // tool -> agentes. Se construye del lado de Node y no en SQL a proposito:
  // `allowed_tools` es un jsonb de nombres, no una tabla de union, asi que no
  // hay indice que aprovechar y son decenas de filas, no miles.
  const porTool = new Map<string, string[]>();
  for (const row of data ?? []) {
    const definicion = row.agent_definitions as unknown as { code: string };
    const permitidas = Array.isArray(row.allowed_tools) ? row.allowed_tools : [];
    for (const nombre of permitidas) {
      if (typeof nombre !== "string") continue;
      const lista = porTool.get(nombre) ?? [];
      lista.push(definicion.code);
      porTool.set(nombre, lista);
    }
  }

  const tools: ToolCatalogRow[] = TOOL_REGISTRY.map((definicion) => ({
    ...definicion,
    granted_to: (porTool.get(definicion.name) ?? []).sort(),
  }));

  return {
    ok: true as const,
    data: {
      tools,
      // Contadores para la cabecera: el interesante es `sin_agente`, las que
      // existen de verdad y ningun agente puede llamar.
      totals: {
        total: tools.length,
        implementadas: tools.filter((t) => t.status === "implemented_partial")
          .length,
        sin_agente: tools.filter(
          (t) => t.status === "implemented_partial" && t.granted_to.length === 0,
        ).length,
      },
    },
  };
}
