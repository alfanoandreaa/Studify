"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "studify-theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setLight(document.documentElement.dataset.theme === "light");
    });
    return () => { cancelled = true; };
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next ? "light" : "dark"); } catch {}
  }

  return <button type="button" className="theme-switch" onClick={toggle} aria-label={light ? "Attiva tema scuro" : "Attiva tema chiaro"} aria-pressed={light}>
    {light ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    <span>{light ? "Tema scuro" : "Tema chiaro"}</span>
  </button>;
}
