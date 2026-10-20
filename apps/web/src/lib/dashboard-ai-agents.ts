export type DashboardAiAgentConfig = {
  key: string;
  label: string;
  description: string;
  getPath: string;
  runPath: string;
  loadingLabel: string;
  tasksLabelSingular: string;
  variant: "full" | "summary" | "tasks";
  consultantOnly: boolean;
};

export const DECISION_AI_AGENTS: DashboardAiAgentConfig[] = [
  {
    key: "monitor",
    label: "Resumen ejecutivo",
    description:
      "Situación global, riesgos y decisiones que requieren atención.",
    getPath: "/ai/monitor",
    runPath: "/ai/monitor-run",
    loadingLabel:
      "Analizando el negocio con IA... la primera vez puede tardar 1-2 minutos.",
    tasksLabelSingular: "tarea",
    variant: "summary",
    consultantOnly: false,
  },
  {
    key: "task-planner",
    label: "Plan diario",
    description: "Trabajo que conviene resolver hoy para mantener el avance.",
    getPath: "/ai/task-planner",
    runPath: "/ai/task-planner-run",
    loadingLabel: "Priorizando el backlog con IA...",
    tasksLabelSingular: "tarea",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "plan-week",
    label: "Plan semanal",
    description: "Prioridades coordinadas para los próximos siete días.",
    getPath: "/ai/plan/week",
    runPath: "/ai/plan/week/run",
    loadingLabel: "Preparando el plan de la semana...",
    tasksLabelSingular: "tarea",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "plan-month",
    label: "Plan mensual",
    description: "Objetivos y frentes que deben ordenar el mes.",
    getPath: "/ai/plan/month",
    runPath: "/ai/plan/month/run",
    loadingLabel: "Preparando el plan del mes...",
    tasksLabelSingular: "tarea",
    variant: "tasks",
    consultantOnly: true,
  },
];

export const KNOWLEDGE_AI_AGENT: DashboardAiAgentConfig = {
  key: "knowledge-manager",
  label: "Conocimiento de la tienda",
  description:
    "Qué sabe la IA de este negocio y qué información sigue faltando.",
  getPath: "/ai/knowledge-manager",
  runPath: "/ai/knowledge-manager-run",
  loadingLabel: "Revisando la base de conocimiento con IA...",
  tasksLabelSingular: "tarea de redacción",
  variant: "full",
  consultantOnly: true,
};

export const STOCK_PLANNER_AI_AGENT: DashboardAiAgentConfig = {
  key: "stock-planner",
  label: "Stock y reposición",
  description: "Riesgos de inventario y necesidades de reposición.",
  getPath: "/ai/stock-planner",
  runPath: "/ai/stock-planner-run",
  loadingLabel: "Cruzando stock y ventas con IA...",
  tasksLabelSingular: "tarea de reposición",
  variant: "full",
  consultantOnly: false,
};

export const SHOPIFY_DASHBOARD_AI_AGENTS: DashboardAiAgentConfig[] = [
  {
    key: "operativa-shopify",
    label: "Operativa de Shopify",
    description: "Diagnóstico Shopify, prioridades y tareas conectadas con el objetivo vigente de Mi Camino.",
    getPath: "/ai/operativa-shopify",
    runPath: "/ai/operativa-shopify-run",
    loadingLabel: "Revisando la operativa de Shopify...",
    tasksLabelSingular: "tarea de Shopify",
    variant: "tasks",
    consultantOnly: false,
  },
  STOCK_PLANNER_AI_AGENT,
];

export const META_DASHBOARD_AI_AGENT: DashboardAiAgentConfig = {
  key: "operativa-meta",
  label: "Operativa de Meta Ads",
  description: "Trabajo operativo detectado en la cuenta publicitaria.",
  getPath: "/ai/operativa-meta",
  runPath: "/ai/operativa-meta-run",
  loadingLabel: "Revisando la operativa de Meta Ads...",
  tasksLabelSingular: "tarea de Meta Ads",
  variant: "tasks",
  consultantOnly: true,
};

export const KLAVIYO_DASHBOARD_AI_AGENT: DashboardAiAgentConfig = {
  key: "email-analyst",
  label: "Análisis de email",
  description:
    "Lectura de campañas, automatizaciones y oportunidades de mejora.",
  getPath: "/ai/email-analyst",
  runPath: "/ai/email-analyst-run",
  loadingLabel: "Analizando el rendimiento de email...",
  tasksLabelSingular: "tarea de email",
  variant: "full",
  consultantOnly: false,
};
