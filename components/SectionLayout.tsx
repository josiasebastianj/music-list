import type { ReactNode } from "react";
import AppShell from "./AppShell";
import SectionNav, { type SectionId } from "./SectionNav";

export default function SectionLayout({ current, actions, children }: { current: SectionId; actions?: ReactNode; children: ReactNode }) {
  return (
    <AppShell actions={actions}>
      <div className="section-layout">
        <SectionNav current={current} />
        <div className="section-main">{children}</div>
      </div>
    </AppShell>
  );
}
