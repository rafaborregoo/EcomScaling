"use client";

import { buttonVariants } from "@/components/ui/button";
import { useState } from "react";
import { createLeverTask } from "../panel/panel-data";
import s from "./task-button.module.css";

/** Botón de tarea de una fila: queda en el trabajo del consultor, no lo ve el cliente. */
export function TaskButton({ organizationId, title, description }: { organizationId: string; title: string; description: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  if (state === "done") return <span className={s.taskDone}>Tarea creada</span>;
  return (
    <button
      type="button"
      className={`${buttonVariants({ variant: "secondary", size: "sm" })} relative z-[1]`}
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        setState((await createLeverTask(organizationId, title, description)) ? "done" : "idle");
      }}
    >
      {state === "busy" ? "Creando…" : "Crear tarea"}
    </button>
  );
}
