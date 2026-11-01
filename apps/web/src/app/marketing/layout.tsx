import type { ReactNode } from "react";
import { MarketingPortalProvider } from "./marketing-portal-context";
import "./marketing-polish.css";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingPortalProvider>
      <div className="mk-polish">{children}</div>
    </MarketingPortalProvider>
  );
}
