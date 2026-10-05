import Icon, { type IconName } from "./Icon";

export type SectionId = "events" | "library" | "themes";

const LINKS: { id: SectionId; href: string; label: string; icon: IconName }[] = [
  { id: "events", href: "/dashboard", label: "Events", icon: "calendar" },
  { id: "library", href: "/library", label: "Library", icon: "music" },
  { id: "themes", href: "/themes", label: "Theme", icon: "tag" },
];

// Plain <a>: full page loads, so the editor's beforeunload guard covers unsaved edits.
export default function SectionNav({ current, compact = false, confirmLeave }: { current?: SectionId; compact?: boolean; confirmLeave?: () => boolean }) {
  return (
    <nav className={`section-nav${compact ? " compact" : ""}`} aria-label="Sections">
      {LINKS.map((l) => (
        <a
          key={l.id}
          href={l.href}
          className={`section-nav-link${l.id === current ? " active" : ""}`}
          aria-current={l.id === current ? "page" : undefined}
          aria-label={compact ? l.label : undefined}
          onClick={(e) => {
            if (confirmLeave && !confirmLeave()) e.preventDefault();
          }}
        >
          <Icon name={l.icon} />
          <span className="section-nav-label">{l.label}</span>
        </a>
      ))}
    </nav>
  );
}
