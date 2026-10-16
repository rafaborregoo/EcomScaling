import type { ReactNode } from "react";
import s from "./client-pulse.module.css";

// Cabecera de cada mundo de Analitica (Shopify, Meta, Klaviyo). La pinta
// client-pulse.module.css segun el data-channel que pone portal-shell, igual
// que las cabeceras <header> de los listados (Productos, Campañas, Emails...).
export function ChannelBand({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`${s.root} ${s.bandRoot}`}>
      <header>
        <div>
          <h1>{title}</h1>
          <p className={s.bandEyebrow}>{eyebrow}</p>
        </div>
        {actions ? <div className={s.bandActions}>{actions}</div> : null}
        {children ? <div className={s.bandFoot}>{children}</div> : null}
      </header>
    </div>
  );
}
