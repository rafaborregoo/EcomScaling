import { RunnableLambda } from "@langchain/core/runnables";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

/**
 * Contrato estable de un flujo de diagnóstico de solo lectura.
 *
 * LangGraph conoce este contrato únicamente dentro del adaptador. El API de
 * EcomScaling sigue trabajando con sus propios envelopes y no persiste el
 * estado interno del grafo como si fuera un contrato público.
 */
export const readOnlyDiagnosticState = new StateSchema({
  input: z.string().min(1),
  retrievedContext: z.array(z.string()).default([]),
  draft: z.string().default(""),
  output: z.string().default(""),
  status: z
    .enum(["received", "retrieved", "drafted", "completed"])
    .default("received"),
});

export type ReadOnlyDiagnosticState = typeof readOnlyDiagnosticState;

export interface ReadOnlyDiagnosticGraphDependencies {
  retrieve(input: string): Promise<string[]>;
  synthesize(input: string, context: string[]): Promise<string>;
  validate(output: string): Promise<string> | string;
}

export function createReadOnlyDiagnosticGraph(
  dependencies: ReadOnlyDiagnosticGraphDependencies,
) {
  return new StateGraph(readOnlyDiagnosticState)
    .addNode("retrieve", async (state) => ({
      retrievedContext: await dependencies.retrieve(state.input),
      status: "retrieved" as const,
    }))
    .addNode("synthesize", async (state) => ({
      draft: await dependencies.synthesize(state.input, state.retrievedContext),
      status: "drafted" as const,
    }))
    .addNode("validate", async (state) => ({
      output: await dependencies.validate(state.draft),
      status: "completed" as const,
    }))
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "synthesize")
    .addEdge("synthesize", "validate")
    .addEdge("validate", END)
    .compile();
}

export async function runReadOnlyDiagnosticGraph(
  dependencies: ReadOnlyDiagnosticGraphDependencies,
  input: string,
) {
  const graph = createReadOnlyDiagnosticGraph(dependencies);
  return graph.invoke({ input });
}

export type AgentOrchestrationMode = "direct" | "langgraph";

export function resolveAgentOrchestrationMode(
  value: string | undefined,
): AgentOrchestrationMode {
  return value === "langgraph" ? "langgraph" : "direct";
}

/**
 * Ejecuta un turno ya protegido dentro del runtime LangGraph. El callback
 * conserva los guards del runtime propio; LangGraph solo aporta el boundary
 * de orquestación y deja el modo directo como fallback seguro.
 */
export async function runOperationThroughLangGraph<Result>(
  operation: () => Promise<Result> | Result,
): Promise<Result> {
  const protectedOperation = RunnableLambda.from(async () => operation());
  const state = new StateSchema({
    input: z.string().default("agent-turn"),
    output: z.unknown().default(null),
    status: z.enum(["received", "completed"]).default("received"),
  });
  const graph = new StateGraph(state)
    .addNode("execute_protected_turn", async () => ({
      output: await protectedOperation.invoke({}),
      status: "completed" as const,
    }))
    .addEdge(START, "execute_protected_turn")
    .addEdge("execute_protected_turn", END)
    .compile();
  const result = await graph.invoke({ input: "agent-turn" });
  return result.output as Result;
}
