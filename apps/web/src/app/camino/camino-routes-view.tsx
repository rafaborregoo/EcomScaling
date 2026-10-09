"use client";

import s from "./camino-routes.module.css";

/**
 * Vista general de caminos: una tarjeta por tienda con su ruta en miniatura,
 * el hito en curso, su meta y la última revisión de la IA. La usan el cliente
 * con varias tiendas ("Todas las tiendas") y el consultor para su cartera y
 * sus tiendas propias. Las metas nunca se suman: cada tienda mide lo suyo.
 */

export type RouteStop = "done" | "current" | "late" | "pending" | "locked";

export type CaminoRoute = {
  organization_id: string;
  store_id: string | null;
  connection_id: string | null;
  store_name: string | null;
  plan: {
    id: string;
    name: string;
    status: string;
    goal: {
      metric_label?: string;
      unit?: "money" | "pct" | "count" | "ratio";
      currency_code?: string | null;
      baseline?: number | null;
      target?: number | null;
      target_date?: string;
    } | null;
    phases: Array<{ name: string; status: string; stops: RouteStop[] }>;
    focus: { code: string | null; name: string; target_date: string | null; days: number | null } | null;
    late_milestones: number;
    milestones_done: number;
    milestones_total: number;
    week_tasks: number;
    review: { summary: string; observed: number | null; expected: number | null; period_end: string } | null;
  } | null;
};

export type RouteCard = {
  key: string;
  title: string;
  subtitle: string;
  route: CaminoRoute;
};

const STOP_CLASS: Record<RouteStop, string> = {
  done: s.done,
  current: s.current,
  late: s.lateDot,
  pending: s.pending,
  locked: s.locked,
};

function formatGoal(value: number, goal: NonNullable<NonNullable<CaminoRoute["plan"]>["goal"]>) {
  if (goal.unit === "money") {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: goal.currency_code ?? "EUR", maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value.toLocaleString("es-ES")} ${goal.currency_code ?? ""}`.trim();
    }
  }
  if (goal.unit === "pct") return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  if (goal.unit === "ratio") return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}×`;
  return value.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function shortDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Primero lo que va tarde, luego lo que está en marcha, después lo que falta
// por arrancar o crear, y al final lo terminado.
function attention(route: CaminoRoute) {
  const plan = route.plan;
  if (!plan) return 3;
  if (plan.late_milestones > 0) return 0;
  if (plan.status === "active") return 1;
  if (plan.status === "draft") return 2;
  return 4;
}

export function sortRouteCards(cards: RouteCard[]) {
  return cards.slice().sort((a, b) => attention(a.route) - attention(b.route) || a.title.localeCompare(b.title, "es"));
}

export function CaminoRoutesView({
  variant,
  eyebrow,
  title,
  description,
  sections,
  openLabel,
  onOpen,
  footnote,
}: {
  variant: "client" | "consultant";
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{ title: string | null; cards: RouteCard[] }>;
  openLabel: string;
  onOpen: (route: CaminoRoute) => void;
  footnote?: string;
}) {
  const all = sections.flatMap((section) => section.cards.map((card) => card.route));
  const live = all.filter((route) => route.plan && route.plan.status !== "archived");
  const late = live.reduce((sum, route) => sum + (route.plan?.late_milestones ?? 0), 0);
  const week = live.reduce((sum, route) => sum + (route.plan?.week_tasks ?? 0), 0);
  const without = all.length - live.length;
  const running = live.filter((route) => route.plan?.status === "active").length;

  return (
    <div className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>{eyebrow}</span>
        <h2 className={s.title}>{title}</h2>
        <p className={s.desc}>{description}</p>
      </div>

      <div className={s.summary}>
        <div>
          <b>{running}</b>
          <span>{running === 1 ? "camino en marcha" : "caminos en marcha"}</span>
        </div>
        <div>
          <b style={late ? { color: "var(--bad)" } : undefined}>{late}</b>
          <span>{late === 1 ? "hito va tarde" : "hitos van tarde"}</span>
        </div>
        <div>
          <b>{week}</b>
          <span>tareas con fecha esta semana</span>
        </div>
        <div>
          <b>{without}</b>
          <span>sin camino</span>
        </div>
      </div>

      {sections.map((section, index) =>
        section.cards.length ? (
          <section key={section.title ?? index} className={s.section}>
            {section.title ? (
              <h3 className={s.sectionTitle}>
                {section.title} <small>{section.cards.length}</small>
              </h3>
            ) : null}
            <div className={s.cards}>
              {sortRouteCards(section.cards).map((card) => (
                <RouteCardView key={card.key} card={card} openLabel={openLabel} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {footnote ? <p className={s.note}>{footnote}</p> : null}
    </div>
  );
}

function RouteCardView({ card, openLabel, onOpen }: { card: RouteCard; openLabel: string; onOpen: (route: CaminoRoute) => void }) {
  const plan = card.route.plan;

  if (!plan) {
    return (
      <article className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h3>{card.title}</h3>
            <p className={s.meta}>{card.subtitle}</p>
          </div>
          <span className={s.chip}>Sin camino</span>
        </div>
        <div className={s.none}>
          <p>Todavía no tiene camino. Se puede pedir una propuesta a la IA con sus datos, importar una plantilla o escribirlo a mano.</p>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => onOpen(card.route)}>
            Crear el camino
          </button>
        </div>
      </article>
    );
  }

  const focus = plan.focus;
  const lateDays = focus?.days !== null && focus?.days !== undefined && focus.days < 0 ? -focus.days : null;
  const chip =
    plan.status === "draft"
      ? [s.chipAcc, "Borrador"]
      : plan.status === "completed"
        ? [s.chipGood, "Completado"]
        : lateDays !== null
          ? [s.chipBad, `Va ${lateDays} ${lateDays === 1 ? "día" : "días"} tarde`]
          : plan.late_milestones > 0
            ? [s.chipBad, `${plan.late_milestones} ${plan.late_milestones === 1 ? "hito tarde" : "hitos tarde"}`]
            : [s.chipGood, "Al ritmo"];

  const goal = plan.goal;
  const observed = plan.review?.observed ?? null;
  const base = goal?.baseline ?? null;
  const target = goal?.target ?? null;
  const ratio = (value: number | null) =>
    value !== null && base !== null && target !== null && target !== base ? Math.max(0, Math.min(1, (value - base) / (target - base))) : null;

  return (
    <article className={`${s.card} ${lateDays !== null || plan.late_milestones > 0 ? s.late : ""}`}>
      <div className={s.cardHead}>
        <div>
          <h3>{card.title}</h3>
          <p className={s.meta}>
            {card.subtitle} · {plan.name}
          </p>
        </div>
        <span className={`${s.chip} ${chip[0]}`}>{chip[1]}</span>
      </div>

      <div className={s.body}>
        <div className={s.route} role="img" aria-label={`Ruta: ${plan.milestones_done} de ${plan.milestones_total} hitos hechos`}>
          {plan.phases.length ? (
            <div className={s.routeInner}>
              {plan.phases.map((phase, index) => (
                <div key={index} className={s.phase}>
                  <span className={s.phaseLabel}>Fase {index + 1}</span>
                  <div className={s.dots}>
                    {phase.stops.map((stop, i) => (
                      <span key={i} style={{ display: "contents" }}>
                        {i > 0 ? <span className={s.link} /> : null}
                        <i className={`${s.dot} ${STOP_CLASS[stop]}`} />
                      </span>
                    ))}
                    <span className={`${s.goal} ${phase.status === "completed" ? s.goalDone : ""}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className={s.emptyRoute}>El camino aún no tiene fases.</span>
          )}
        </div>
        <div className={s.facts}>
          <div>
            <span className={s.lbl}>Ahora</span>
            <p className={s.value}>{focus ? `Hito ${focus.code} · ${focus.name}` : plan.status === "draft" ? "Pendiente de activar" : "Sin hito en curso"}</p>
            {focus?.target_date ? (
              <p className={s.meta}>
                {lateDays !== null ? "Vencía" : "Vence"} el {shortDate(focus.target_date)}
              </p>
            ) : null}
          </div>
          <div>
            <span className={s.lbl}>{goal?.metric_label ?? "Meta"}</span>
            {goal && target !== null ? (
              <>
                <p className={s.value}>
                  {observed !== null ? formatGoal(observed, goal) : "—"} <small>/ {formatGoal(target, goal)}</small>
                </p>
                {ratio(observed) !== null ? (
                  <div className={s.bar} title="La marca es donde debería estar hoy">
                    <i style={{ width: `${ratio(observed)! * 100}%` }} />
                    {ratio(plan.review?.expected ?? null) !== null ? <b style={{ left: `${ratio(plan.review!.expected)! * 100}%` }} /> : null}
                  </div>
                ) : (
                  <p className={s.meta}>Se mide con la primera revisión periódica</p>
                )}
              </>
            ) : (
              <p className={s.value}>
                {plan.milestones_done} <small>/ {plan.milestones_total} hitos</small>
              </p>
            )}
          </div>
        </div>
      </div>

      {plan.review ? (
        <p className={s.review}>
          <span className={s.ia}>IA</span>
          {plan.review.summary}
        </p>
      ) : null}

      <div className={s.foot}>
        <span className={s.meta}>
          {plan.week_tasks} {plan.week_tasks === 1 ? "tarea con fecha" : "tareas con fecha"} esta semana
        </span>
        <button type="button" className={s.btn} onClick={() => onOpen(card.route)}>
          {openLabel}
        </button>
      </div>
    </article>
  );
}
