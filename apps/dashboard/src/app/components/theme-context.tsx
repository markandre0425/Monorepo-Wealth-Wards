import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("ww-theme");
      return stored ? stored === "dark" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ww-theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/* Shared color tokens */
export function themeColors(isDark: boolean) {
  return {
    // Page / shell
    pageBg: isDark ? "#0b0b0f" : "#f0f2f7",
    cardBg: isDark ? "rgba(28,28,28,0.6)" : "rgba(255,255,255,0.82)",
    cardBorder: isDark ? "transparent" : "rgba(0,0,0,0.06)",
    inputBg: isDark ? "#2b2b2b" : "#eef0f5",
    inputText: isDark ? "#ffffff" : "#1a1a2e",
    placeholder: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.38)",
    // Text
    textPrimary: isDark ? "#ffffff" : "#1a1a2e",
    textSecondary: isDark ? "#86909c" : "#6b7280",
    textMuted: isDark ? "#ddd" : "#4b5563",
    // Interactive
    hoverBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    divider: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)",
    badgeBg: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.08)",
    statBg: isDark ? "rgba(176,176,176,0.1)" : "rgba(0,0,0,0.04)",
    tooltipBg: isDark ? "#1c1c1c" : "#ffffff",
    tooltipBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    // Chart
    gridStroke: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    axisStroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
    dotFill: isDark ? "#1c1c1c" : "#ffffff",
    // Sidebar
    sidebarBg: isDark ? "transparent" : "rgba(255,255,255,0.5)",
    selectBg: isDark ? "#2b2b2b" : "#eef0f5",
    // Dropdown
    dropdownBg: isDark ? "#2b2b2b" : "#ffffff",
    dropdownBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    dropdownActiveBg: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
    dropdownHoverBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
  };
}
