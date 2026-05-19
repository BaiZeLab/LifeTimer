"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  applyThemeToDocument,
  readThemeFromDocument,
  syncThemeMeta,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync from <html> class (already set by the inline anti-FOUC script)
  useEffect(() => {
    const initial = readThemeFromDocument();
    setTheme(initial);
    syncThemeMeta(initial);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyThemeToDocument(next);
      try {
        localStorage.setItem("lt-theme", next);
      } catch {
        /* private browsing */
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
