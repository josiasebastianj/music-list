"use client";

import { useSyncExternalStore } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const getServerTheme = (): Theme => "light";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("setlistApp_theme", next);
    } catch {
      // storage blocked (private mode): the theme still applies for this page
    }
  }

  return (
    <button className="theme-top-toggle" type="button" aria-label="Switch theme" onClick={toggle}>
      <span className="theme-icon"><Icon name={theme === "dark" ? "moon" : "sun"} /></span>
      <span id="themeLabel">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
    </button>
  );
}
