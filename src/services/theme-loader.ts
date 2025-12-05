import type { AppearanceTheme } from "../types";

type ThemeLoader = () => Promise<string>;

type ThemeModule = {
  default: string;
};

const APPEARANCE_THEME_LOADERS: Record<AppearanceTheme, ThemeLoader> = {
  classic: async () => "",
  windup: async () =>
    import("../themes/windup.css?inline").then((module: ThemeModule) => module.default)
};

const loadedThemes = new Set<AppearanceTheme>();

export async function ensureAppearanceThemeStyles(theme: AppearanceTheme): Promise<void> {
  if (theme === "classic" || loadedThemes.has(theme)) {
    return;
  }
  const loader = APPEARANCE_THEME_LOADERS[theme];
  if (!loader) {
    console.warn(`Chromnotes: missing loader for appearance theme "${theme}".`);
    return;
  }
  try {
    const css = await loader();
    if (!css.trim().length) {
      loadedThemes.add(theme);
      return;
    }
    const styleTag = document.createElement("style");
    styleTag.dataset.appearanceTheme = theme;
    styleTag.textContent = css;
    document.head.append(styleTag);
    loadedThemes.add(theme);
  } catch (error) {
    console.warn(`Chromnotes: failed to load appearance theme "${theme}".`, error);
  }
}
