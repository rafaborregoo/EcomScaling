import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  aiModelLabReportSchema,
  aiModelLabReviewSchema,
  aiModelLabMeetingAssessmentSchema,
} from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";

async function reportPath() {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dirname(dir) !== dir) {
    try {
      if (
        JSON.parse(await readFile(join(dir, "package.json"), "utf8")).name ===
        "e-nora"
      )
        return join(dir, ".e-nora-test-lab/ai-models/report.json");
    } catch {
      /* Continúa hasta la raíz del monorepo. */
    }
    dir = dirname(dir);
  }
  return null;
}

export async function getAdminAiModelLab(
  env: { SUPABASE_URL: string },
  context: AuthContext,
  agentCode?: string,
) {
  if (context.profile.platform_role !== "platform_admin")
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  try {
    const path = await reportPath();
    if (!path)
      return {
        ok: true as const,
        data: {
          available: false as const,
          message:
            "No se encuentra el directorio del laboratorio en este servidor.",
        },
      };
    if ((await stat(path)).size > 30_000_000)
      throw new Error("lab_report_too_large");
    const report = aiModelLabReportSchema.parse(
      JSON.parse(await readFile(path, "utf8")),
    );
    try {
      const reviews: unknown = JSON.parse(
        await readFile(join(dirname(path), "reviews.json"), "utf8"),
      );
      if (Array.isArray(reviews))
        for (const item of reviews) {
          const review = aiModelLabReviewSchema.safeParse(item.review);
          const row = report.results.find((r) => r.id === item.result_id);
          if (review.success && row) row.review = review.data;
        }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const [file, target] of [
      ["meeting-evaluations.json", "meeting_assessment"],
      ["field-evaluations.json", "field_assessment"],
    ] as const)
      try {
        const assessments: unknown = JSON.parse(
          await readFile(join(dirname(path), file), "utf8"),
        );
        if (Array.isArray(assessments))
          for (const item of assessments) {
            const parsed = aiModelLabMeetingAssessmentSchema.safeParse(
              item.assessment,
            );
            const row = report.results.find((r) => r.id === item.result_id);
            const testCase =
              row && report.cases.find((c) => c.id === row.case_id);
            if (
              parsed.success &&
              row &&
              (testCase?.meeting_benchmark ||
                testCase?.monitor_benchmark ||
                testCase?.task_benchmark ||
                testCase?.campaign_benchmark ||
                testCase?.stock_benchmark) &&
              parsed.data.reference_hash ===
                (testCase.meeting_benchmark?.reference_hash ??
                  testCase.monitor_benchmark?.reference_hash ??
                  testCase.task_benchmark?.reference_hash ??
                  testCase.campaign_benchmark?.reference_hash ??
                  testCase.stock_benchmark?.reference_hash) &&
              parsed.data.output_hash ===
                createHash("sha256")
                  .update(JSON.stringify(row.raw_response))
                  .digest("hex")
            ) {
              row[target] = parsed.data;
              if (
                target === "field_assessment" &&
                row.review.method !== "manual" &&
                parsed.data.judges.length >= 2 &&
                parsed.data.judges.every(
                  (judge) => judge.status === "completed",
                )
              ) {
                const checks = parsed.data.checks;
                const passed = checks.filter(
                  (check) => check.status === "pass",
                ).length;
                const failed = checks.filter(
                  (check) => check.status === "fail",
                ).length;
                row.review = {
                  status: "reviewed",
                  method: "automated",
                  reviewer: parsed.data.judges
                    .map((judge) => judge.id)
                    .join(" + "),
                  verdict:
                    "Campos: " +
                    passed +
                    "/" +
                    checks.length +
                    " sin fallo detectado; " +
                    failed +
                    " fallos coincidentes; " +
                    (checks.length - passed - failed) +
                    " por resolver",
                  notes: [
                    "Revisión automática por campos " +
                      parsed.data.rubric_version +
                      "; los revisores también son candidatos. No equivale a evaluación humana independiente.",
                  ],
                };
              }
            }
          }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    for (const result of report.results) {
      const agent =
        report.cases.find((c) => c.id === result.case_id)?.agent_code ?? null;
      for (const check of result.field_assessment?.checks ?? []) {
        if (check.status !== "fail") continue;
        report.issues.push({
          id: `field:${result.id}:${check.id}`,
          severity: ["facts", "decisions", "proposed_tasks"].includes(check.id)
            ? "high"
            : "medium",
          title: `${result.model_id}: fallo coincidente en ${check.id}`,
          detail: check.judgments
            .map((judgment) => `${judgment.reviewer}: ${judgment.note}`)
            .join("\n"),
          status: "open",
          agent_code: agent,
          evidence: `${result.id} · ${check.id} · ${result.field_assessment!.rubric_version}`,
          resolution:
            "Revisión automática por campo. Contrastar las dos evidencias con la transcripción, identificar si requiere corregir prompt, contrato o modelo y repetir el mismo caso tras la corrección.",
        });
      }
      if (
        result.status === "failed" ||
        (result.status === "completed" &&
          (result.checks.json_valid === false ||
            result.checks.native_contract === false))
      )
        report.issues.push({
          id: `execution:${result.id}`,
          severity: "high",
          title: `${result.model_id}: ${result.status === "failed" ? "ejecución fallida" : result.checks.native_contract === false ? "contrato nativo incumplido" : "salida no interpretable como JSON"}`,
          detail:
            result.error ??
            "Se recibió una respuesta, pero no es un objeto JSON interpretable. No se corrige automáticamente para ocultar el fallo.",
          status: "open",
          agent_code: agent,
          evidence: result.id,
          resolution:
            "Revisar la salida original y repetir con el contrato nativo antes de considerar este modelo.",
        });
      if (
        result.review.status === "reviewed" &&
        /error importante|requiere revisión/i.test(result.review.verdict ?? "")
      )
        report.issues.push({
          id: `review:${result.id}`,
          severity: "medium",
          title: `${result.model_id}: señal de revisión del contenido`,
          detail: result.review.notes.join("\n") || result.review.verdict!,
          status: "open",
          agent_code: agent,
          evidence: `${result.id} · revisión ${result.review.method}`,
          resolution:
            "Señal automática, pendiente de contrastar con la evidencia original; no equivale a un fallo confirmado ni a una aprobación.",
        });
    }
    if (
      new URL(env.SUPABASE_URL).hostname !==
      `${report.target.project_ref}.supabase.co`
    )
      return {
        ok: true as const,
        data: {
          available: false as const,
          message:
            "El informe pertenece a otro entorno. No se mezclan resultados de pruebas y producción.",
        },
      };
    if (agentCode && !report.cases.some((c) => c.agent_code === agentCode))
      return {
        ok: false as const,
        statusCode: 404,
        error: "lab_agent_not_found",
      };
    const cases = report.cases.filter(
      (c) => !agentCode || c.agent_code === agentCode,
    );
    const ids = new Set(cases.map((c) => c.id));
    const results = report.results
      .filter((r) => ids.has(r.case_id))
      .map((r) =>
        agentCode
          ? r
          : {
              ...r,
              raw_response: "",
              meeting_assessment: undefined,
              field_assessment: undefined,
              normalized: {
                summary: "",
                findings: [],
                recommendations: [],
                warnings: [],
              },
            },
      );
    return {
      ok: true as const,
      data: {
        available: true as const,
        report: {
          ...report,
          cases,
          results,
          issues: report.issues.filter(
            (i) => !agentCode || !i.agent_code || i.agent_code === agentCode,
          ),
        },
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return {
        ok: true as const,
        data: {
          available: false as const,
          message:
            "Todavía no hay resultados en este servidor. Ejecuta la exportación y la tanda CLI del laboratorio.",
        },
      };
    return {
      ok: false as const,
      statusCode: 500,
      error: "ai_model_lab_read_failed",
      message:
        "No se pudo leer un informe válido del laboratorio. Revisa su generación y vuelve a actualizar.",
    };
  }
}
