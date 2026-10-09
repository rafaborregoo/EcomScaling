import type { ReactNode } from "react";
import { BrandLogo, Card, Heading, Link, Table } from "@/components/ui";
import type { TableColumnDef } from "@/components/ui";
import { LEGAL_DOCS, LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";

// Armazon comun de las paginas legales publicas: cabecera, secciones en Card
// y, al pie, enlaces al resto de documentos para que ninguna quede aislada.
// No cuelgan de ningun menu del portal (no estan en PORTAL_PREFIXES): son URLs
// para enlazar desde fuera (Meta, Shopify), desde el registro y desde el correo.

export function LegalPage({
  title,
  current,
  intro,
  updated = LEGAL_UPDATED,
  children,
}: {
  title: string;
  current: string;
  intro?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  const others = LEGAL_DOCS.filter((doc) => doc.href !== current);
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <BrandLogo />
        <Heading level={1} size="lg">
          {title}
        </Heading>
        <p className="text-sm text-muted">Última actualización: {updated}</p>
        {intro ? <p className="text-sm">{intro}</p> : null}
      </header>

      {children}

      {current === "/legal" ? null : (
      <nav aria-label="Documentos legales" className="flex flex-col gap-2 border-t border-edge pt-6 text-sm">
        <p className="font-medium">Más documentos</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <Link className="underline" href="/legal">
              Centro legal
            </Link>
          </li>
          {others.map((doc) => (
            <li key={doc.href}>
              <Link className="underline" href={doc.href}>
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      )}
    </main>
  );
}

export function MailLink() {
  return (
    <Link className="underline" href={`mailto:${LEGAL_ENTITY.email}`}>
      {LEGAL_ENTITY.email}
    </Link>
  );
}

// Tabla de las paginas legales. Las columnas no llevan `render` (no se pueden
// pasar funciones de un componente de servidor a uno de cliente).
export function LegalTable<T extends { id: string }>({
  columns,
  rows,
  ariaLabel,
}: {
  columns: TableColumnDef<T>[];
  rows: T[];
  ariaLabel: string;
}) {
  return <Table columns={columns} rows={rows} ariaLabel={ariaLabel} />;
}

export function LegalSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <Card title={title} id={id}>
      <div className="flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
    </Card>
  );
}

// Enlaces cortos a los documentos que mas se buscan, para el pie de login y registro.
export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legales" className={className}>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <li>
          <Link className="underline" href="/aviso-legal">
            Aviso legal
          </Link>
        </li>
        <li>
          <Link className="underline" href="/politica-privacidad">
            Privacidad
          </Link>
        </li>
        <li>
          <Link className="underline" href="/condiciones">
            Condiciones
          </Link>
        </li>
        <li>
          <Link className="underline" href="/cookies">
            Cookies
          </Link>
        </li>
      </ul>
    </nav>
  );
}
