import type { ReactNode } from "react";
import { APP_VERSION } from "@/lib/event";

export default function AppShell({ actions, className = "", children }: { actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`app ${className}`.trim()}>
      <header className="app-topbar">
        <div className="brand">
          <div className="brand-name">MD<span>CHORD</span></div>
          <div className="brand-divider" />
          <div className="brand-tagline">One Church. One Sound. One Jesus.</div>
        </div>
        <div className="top-actions">{actions}</div>
      </header>
      {children}
      <footer className="app-footer" aria-label="Application information">
        <div className="app-footer-brand">MD<span>CHORD</span></div>
        <div className="app-footer-meta">
          <span>Author: josiasebastianj</span>
          <span>Version: {APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
