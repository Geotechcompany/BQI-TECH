"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSettings } from "@/contexts/SettingsContext";

export type AdminTheme = "light" | "dark" | "studio";

const ADMIN_THEMES: AdminTheme[] = ["light", "dark", "studio"];

function isAdminTheme(value: string | undefined | null): value is AdminTheme {
  return !!value && ADMIN_THEMES.includes(value as AdminTheme);
}

type AdminThemeContextValue = {
  theme: AdminTheme;
  setTheme: (next: AdminTheme) => void;
  toggle: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(
  undefined
);

type AdminThemeProviderProps = {
  children: React.ReactNode;
  targetId: string;
};

export function AdminThemeProvider({
  children,
  targetId,
}: AdminThemeProviderProps) {
  const { theme: settingsTheme, isLoading: settingsLoading } = useSettings();

  const [theme, setThemeState] = useState<AdminTheme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("admin-theme");
    return isAdminTheme(stored) ? stored : "light";
  });

  useEffect(() => {
    if (settingsLoading) return;
    if (isAdminTheme(settingsTheme)) {
      setThemeState(settingsTheme);
    }
  }, [settingsTheme, settingsLoading]);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    el.classList.remove("dark");
    el.removeAttribute("data-admin-theme");

    if (theme === "dark") {
      el.classList.add("dark");
    } else if (theme === "studio") {
      el.setAttribute("data-admin-theme", "studio");
    }

    window.localStorage.setItem("admin-theme", theme);
  }, [theme, targetId]);

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => setThemeState(next),
      toggle: () =>
        setThemeState((current) => {
          if (current === "light") return "dark";
          if (current === "dark") return "studio";
          return "light";
        }),
    }),
    [theme]
  );

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return ctx;
}
