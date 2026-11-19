"use client";

import { Moon, Sun } from "lucide-react";

const KEY = "lookban-theme";

/**
 * Light / dark switch. The theme lives on <html data-theme>; the script in the root layout sets it before the
 * first paint (saved choice, else the device setting). Icons and labels swap with CSS, so the server and
 * browser always render the same HTML (no hydration flicker).
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "nav" }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice just won't be remembered */ }
  }
  const icons = (
    <>
      <Moon className="size-6 dark:hidden" aria-hidden />
      <Sun className="hidden size-6 dark:block" aria-hidden />
    </>
  );
  if (variant === "nav") {
    return (
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-blue-50">
        <span className="[&>svg]:size-4 flex">{icons}</span>
        <span className="dark:hidden">Dark Mode</span><span className="hidden dark:inline">Light Mode</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} className="pop flex size-11 items-center justify-center rounded-lg text-brand hover:bg-blue-50">
      {icons}
      <span className="sr-only dark:hidden">Switch to dark mode</span>
      <span className="sr-only hidden dark:inline">Switch to light mode</span>
    </button>
  );
}

/** Runs in <head> before first paint so there is no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
