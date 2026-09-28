import type { ReactNode } from "react";
import { MarketingPortalProvider } from "./marketing-portal-context";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingPortalProvider>{children}</MarketingPortalProvider>;
}
