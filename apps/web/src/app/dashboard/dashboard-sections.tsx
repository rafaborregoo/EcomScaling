import s from "./client-pulse.module.css";

/** Atajos locales: conservan la URL de la vista y funcionan sin JavaScript. */
export function DashboardSections({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav className={s.sectionNav} aria-label="Secciones de esta vista">
      {items.map(({ id, label }) => <a key={id} href={`#${id}`}>{label}</a>)}
    </nav>
  );
}
