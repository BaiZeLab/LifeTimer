export type Theme = "light" | "dark";

export const THEME_COLORS: Record<Theme, string> = {
  light: "#F1EBDF",
  dark:  "#222232",
};

/** Apply theme class on <html> and sync PWA / iOS chrome meta tags. */
export function applyThemeToDocument(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle("dark", theme === "dark");
  html.classList.toggle("light", theme === "light");
  syncThemeMeta(theme);
}

/** Update theme-color and iOS status bar style to match app theme. */
export function syncThemeMeta(theme: Theme): void {
  if (typeof document === "undefined") return;

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = THEME_COLORS[theme];

  let statusBar = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );
  if (!statusBar) {
    statusBar = document.createElement("meta");
    statusBar.name = "apple-mobile-web-app-status-bar-style";
    document.head.appendChild(statusBar);
  }
  statusBar.content = theme === "dark" ? "black-translucent" : "default";
}

export function readThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
