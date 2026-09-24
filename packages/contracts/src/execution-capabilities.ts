/**
 * F8.06 — Capacidades, tools y permisos.
 *
 * Del registro real de tools a cada accion del plan: que capacidad pide (§1),
 * que tools candidatas hay (§6), si estan disponibles o solo planeadas (§4),
 * si su conector esta sano (§5), que permiso tecnico exigen (§12) y cual es la
 * de menor privilegio que basta (§7). Lo que no cubre ninguna tool
 * implementada es un hueco de capacidad (§41), y se nombra: "no hay tool" y
 * "la tool existe pero el conector esta caido" son dos arreglos distintos.
 *
 * Tambien se dice si hay dry run (§17) y si la escritura exigira clave de
 * idempotencia (§23): son condiciones para 8.07, no adornos.
 */

import {
  baseResult,
  check,
  type BlockCheck,
  type ExecutionSnapshot,
  type SnapshotCapability,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const CAPABILITY_DECISIONS = [
  "COVERED",
  "PREPARE_ONLY",
  "PARTIALLY_COVERED",
  "GAP",
] as const;
export type CapabilityDecision = (typeof CAPABILITY_DECISIONS)[number];

const PERMISSION_RANK = { read: 0, propose: 1, write: 2, admin: 3 } as const;

export type ActionCapability = {
  action_id: string;
  required_permission: "read" | "write";
  candidate_tools: string[];
  selected_tool: string | null;
  availability: "AVAILABLE" | "PLANNED_ONLY" | "CONNECTOR_DOWN" | "NONE";
  requires_idempotency_key: boolean;
  dry_run_available: boolean;
};

export type CapabilityPayload = {
  actions: ActionCapability[];
  gaps: string[];
  /** Tools con mas permiso del necesario que NO se eligen (§7, least privilege). */
  excluded_over_privileged: string[];
  write_tools_implemented: number;
  write_tools_planned: number;
};

function candidatesFor(permission: "read" | "write", caps: SnapshotCapability[]) {
  return caps.filter((c) => c.permission === permission);
}

export function evaluateExecutionCapabilities(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<CapabilityDecision, CapabilityPayload> {
  const caps = snapshot.capabilities;
  const dryRun = caps.some((c) => c.name === "dry_run_write" && c.status === "implemented_partial");

  const actions: ActionCapability[] = (snapshot.plan?.actions ?? []).map((action) => {
    const required = action.change.startsWith("read") ? "read" : "write";
    const candidates = candidatesFor(required, caps);
    const live = candidates.filter((c) => c.status === "implemented_partial");
    const healthy = live.filter((c) => c.connector === "core" || c.connector_connected);
    // Least privilege: entre las sanas, la de menor permiso que alcanza.
    const selected = [...healthy].sort(
      (a, b) => PERMISSION_RANK[a.permission] - PERMISSION_RANK[b.permission],
    )[0];
    const availability: ActionCapability["availability"] = healthy.length
      ? "AVAILABLE"
      : live.length
        ? "CONNECTOR_DOWN"
        : candidates.length
          ? "PLANNED_ONLY"
          : "NONE";
    return {
      action_id: action.id,
      required_permission: required,
      candidate_tools: candidates.map((c) => c.name),
      selected_tool: selected?.name ?? null,
      availability,
      requires_idempotency_key: required === "write",
      dry_run_available: required === "write" ? dryRun : false,
    };
  });

  const gaps = actions
    .filter((a) => a.availability !== "AVAILABLE")
    .map((a) =>
      a.availability === "PLANNED_ONLY"
        ? `${a.action_id}: las tools que la cubririan (${a.candidate_tools.slice(0, 3).join(", ")}${a.candidate_tools.length > 3 ? "…" : ""}) estan solo planeadas`
        : a.availability === "CONNECTOR_DOWN"
          ? `${a.action_id}: la tool existe pero su conector no esta conectado`
          : `${a.action_id}: ninguna tool cubre esta accion`,
    );

  const writeCaps = caps.filter((c) => c.permission === "write");
  const excluded = caps
    .filter((c) => c.permission === "admin" && c.status === "implemented_partial")
    .map((c) => c.name);

  const covered = actions.filter((a) => a.availability === "AVAILABLE").length;
  const writesUncovered = actions.filter((a) => a.required_permission === "write" && a.availability !== "AVAILABLE");
  const decisionBlock: CapabilityDecision =
    actions.length > 0 && covered === actions.length
      ? "COVERED"
      : writesUncovered.length > 0 && writesUncovered.every((a) => a.dry_run_available) && covered === actions.length - writesUncovered.length
        ? "PREPARE_ONLY"
        : covered > 0
          ? "PARTIALLY_COVERED"
          : "GAP";

  const checks: BlockCheck[] = [
    check("action_capability_mapping", actions.length ? "PASS" : "FAIL", true,
      actions.length ? `${actions.length} accion(es) mapeadas a su capacidad.` : "Sin acciones no hay capacidad que mapear."),
    check("capability_coverage", covered === actions.length && actions.length ? "PASS" : "FAIL", true,
      gaps.length ? gaps.join("; ") : "Todas las acciones tienen una tool implementada y sana."),
    check("least_privilege", "PASS", true,
      "Se elige la tool de menor permiso que basta; ninguna con permiso de administracion."),
    check("dry_run", writesUncovered.length === 0 || dryRun ? "PASS" : "FAIL", false,
      dryRun ? "Hay dry run para previsualizar escrituras." : "No hay dry run: una escritura no se puede previsualizar."),
    check("idempotency_declared", "PASS", true,
      "Toda escritura exigira clave de idempotencia (lo impone el registro de tools)."),
  ];

  return baseResult(snapshot, {
    block: "8.06",
    stage: "CAPABILITIES",
    block_decision: decisionBlock,
    decision: decisionBlock === "COVERED" ? "READY" : decisionBlock === "PREPARE_ONLY" ? "CONDITIONAL" : "BLOCKED",
    why:
      decisionBlock === "COVERED"
        ? "Cada accion tiene una tool implementada, sana y de minimo privilegio."
        : decisionBlock === "PREPARE_ONLY"
          ? `Las lecturas estan cubiertas; las escrituras solo se pueden previsualizar: ${writeCaps.filter((c) => c.status === "planned").length} tools de escritura estan planeadas y ninguna implementada.`
          : `Hueco de capacidad: ${gaps.join("; ")}.`,
    checks,
    next_actions: decisionBlock === "COVERED"
      ? ["usar la tool seleccionada con su clave de idempotencia"]
      : ["handoff manual de las escrituras", "implementar la tool de escritura que falta antes de automatizar"],
    payload: {
      actions,
      gaps,
      excluded_over_privileged: excluded,
      write_tools_implemented: writeCaps.filter((c) => c.status === "implemented_partial").length,
      write_tools_planned: writeCaps.filter((c) => c.status === "planned").length,
    },
  });
}
