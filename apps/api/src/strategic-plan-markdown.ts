export type MarkdownTaskInput = {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: string;
};

export type MarkdownPlanInput = {
  name: string;
  description?: string | null;
  phases: Array<{
    name: string;
    description?: string | null;
    milestones: Array<{
      name: string;
      description?: string | null;
      targetDate?: string | null;
      tasks: MarkdownTaskInput[];
    }>;
  }>;
};

export type MarkdownPlanIssue = {
  line: number;
  message: string;
};

export type MarkdownPlanParseResult = {
  ok: boolean;
  data?: MarkdownPlanInput;
  errors: MarkdownPlanIssue[];
  warnings: MarkdownPlanIssue[];
  counts: {
    phases: number;
    milestones: number;
    tasks: number;
  };
};

const MAX_MARKDOWN_BYTES = 512_000;
const MAX_PHASES = 50;
const MAX_MILESTONES = 250;
const MAX_TASKS = 2_000;

function cleanHeading(value: string, prefix: string) {
  return value
    .replace(new RegExp(`^${prefix}\\s*`, "i"), "")
    .replace(/^\d+(?:\.\d+)*[.):]?\s*/, "")
    .trim();
}

function cleanText(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseFrontmatter(lines: string[]) {
  if (lines[0]?.trim() !== "---") {
    return { values: new Map<string, string>(), nextIndex: 0 };
  }
  const values = new Map<string, string>();
  let index = 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line === "---") return { values, nextIndex: index + 1 };
    const match = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (match) values.set(match[1]!.toLowerCase(), match[2]!.trim());
  }
  return { values, nextIndex: 0 };
}

function parseDate(value: string, line: number, errors: MarkdownPlanIssue[]) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push({
      line,
      message: "La fecha debe usar el formato YYYY-MM-DD.",
    });
    return null;
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    errors.push({ line, message: `La fecha ${date} no es válida.` });
    return null;
  }
  return date;
}

function stripLabel(value: string, label: string) {
  return value.replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "").trim();
}

/**
 * Parses the controlled Markdown contract used by the Mi Camino importer.
 *
 * Supported hierarchy:
 *   # Plan
 *   ## Fase: ...
 *   ### Hito: ...
 *   #### Tareas
 *   - Task title
 *
 * The parser is deliberately deterministic. It never turns arbitrary prose
 * into domain writes; the UI shows this result to a consultant first.
 */
export function parseStrategicPlanMarkdown(
  markdown: string,
): MarkdownPlanParseResult {
  const errors: MarkdownPlanIssue[] = [];
  const warnings: MarkdownPlanIssue[] = [];
  const source = markdown.replace(/^\uFEFF/, "");
  const byteLength = new TextEncoder().encode(source).length;
  if (byteLength > MAX_MARKDOWN_BYTES) {
    return {
      ok: false,
      errors: [{ line: 1, message: "El archivo supera el límite de 512 KB." }],
      warnings,
      counts: { phases: 0, milestones: 0, tasks: 0 },
    };
  }

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const frontmatter = parseFrontmatter(lines);
  const contentStart = frontmatter.nextIndex;
  const plan: MarkdownPlanInput = { name: "", description: null, phases: [] };
  let currentPhase: MarkdownPlanInput["phases"][number] | null = null;
  let currentMilestone:
    MarkdownPlanInput["phases"][number]["milestones"][number] | null = null;
  let inTasks = false;
  let planBody: string[] = [];
  let phaseBody: string[] = [];
  let milestoneBody: string[] = [];

  const flushPlanBody = () => {
    const body = cleanText(planBody);
    if (body && !plan.description) plan.description = body;
    planBody = [];
  };
  const flushPhaseBody = () => {
    if (currentPhase) currentPhase.description = cleanText(phaseBody) || null;
    phaseBody = [];
  };
  const flushMilestoneBody = () => {
    if (currentMilestone)
      currentMilestone.description = cleanText(milestoneBody) || null;
    milestoneBody = [];
  };

  const frontmatterName = frontmatter.values.get("name");
  if (frontmatterName) plan.name = frontmatterName;
  const frontmatterDescription = frontmatter.values.get("description");
  if (frontmatterDescription) plan.description = frontmatterDescription;

  for (let index = contentStart; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1]!.length;
      const title = heading[2]!.trim();
      if (level === 1) {
        flushMilestoneBody();
        flushPhaseBody();
        flushPlanBody();
        if (!plan.name) plan.name = cleanHeading(title, "(?:plan|camino)");
        continue;
      }
      if (level === 2) {
        flushMilestoneBody();
        flushPhaseBody();
        flushPlanBody();
        inTasks = false;
        const name = cleanHeading(title, "fase");
        if (!name)
          errors.push({
            line: lineNumber,
            message: "La fase no tiene nombre.",
          });
        currentPhase = { name, description: null, milestones: [] };
        plan.phases.push(currentPhase);
        continue;
      }
      if (level === 3) {
        flushMilestoneBody();
        if (!currentPhase) {
          errors.push({
            line: lineNumber,
            message: "El hito debe estar dentro de una fase.",
          });
          continue;
        }
        inTasks = false;
        const name = cleanHeading(title, "hito");
        if (!name)
          errors.push({
            line: lineNumber,
            message: "El hito no tiene nombre.",
          });
        currentMilestone = {
          name,
          description: null,
          targetDate: null,
          tasks: [],
        };
        currentPhase.milestones.push(currentMilestone);
        continue;
      }
      if (level >= 4 && /^(tareas|tasks?)\b/i.test(title)) {
        if (!currentMilestone) {
          errors.push({
            line: lineNumber,
            message: "La sección de tareas debe estar dentro de un hito.",
          });
        }
        inTasks = Boolean(currentMilestone);
        continue;
      }
      if (level >= 4) inTasks = false;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    const targetDate = trimmed.match(
      /^(?:[-*]\s*)?(?:fecha objetivo|target date)\s*:\s*(.+)$/i,
    );
    if (targetDate && currentMilestone) {
      currentMilestone.targetDate = parseDate(
        targetDate[1]!,
        lineNumber,
        errors,
      );
      continue;
    }

    const description = trimmed.match(
      /^(?:[-*]\s*)?descripci[oó]n\s*:\s*(.*)$/i,
    );
    if (description) {
      if (currentMilestone) milestoneBody.push(description[1]!);
      else if (currentPhase) phaseBody.push(description[1]!);
      else planBody.push(description[1]!);
      continue;
    }

    const task = trimmed.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/);
    if (task && inTasks && currentMilestone) {
      const titleValue = stripLabel(task[1]!, "tarea");
      if (titleValue) currentMilestone.tasks.push({ title: titleValue });
      continue;
    }

    if (currentMilestone) milestoneBody.push(trimmed);
    else if (currentPhase) phaseBody.push(trimmed);
    else planBody.push(trimmed);
  }

  flushMilestoneBody();
  flushPhaseBody();
  flushPlanBody();

  if (!plan.name.trim())
    errors.push({ line: 1, message: "El camino necesita un nombre." });
  if (plan.phases.length === 0)
    errors.push({ line: 1, message: "El camino necesita al menos una fase." });

  let milestones = 0;
  let tasks = 0;
  for (const phase of plan.phases) {
    if (!phase.name.trim())
      errors.push({ line: 1, message: "Hay una fase sin nombre." });
    milestones += phase.milestones.length;
    for (const milestone of phase.milestones) {
      if (!milestone.name.trim())
        errors.push({ line: 1, message: "Hay un hito sin nombre." });
      tasks += milestone.tasks.length;
    }
  }
  if (plan.phases.length > MAX_PHASES)
    errors.push({ line: 1, message: `El máximo son ${MAX_PHASES} fases.` });
  if (milestones > MAX_MILESTONES)
    errors.push({ line: 1, message: `El máximo son ${MAX_MILESTONES} hitos.` });
  if (tasks > MAX_TASKS)
    errors.push({ line: 1, message: `El máximo son ${MAX_TASKS} tareas.` });
  if (milestones === 0)
    warnings.push({ line: 1, message: "El camino no contiene hitos todavía." });
  if (tasks === 0)
    warnings.push({
      line: 1,
      message: "El camino no contiene tareas todavía.",
    });

  return {
    ok: errors.length === 0,
    ...(errors.length === 0 ? { data: plan } : {}),
    errors,
    warnings,
    counts: { phases: plan.phases.length, milestones, tasks },
  };
}
