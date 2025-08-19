"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

type AdminTheme = "light" | "dark"

type AdminThemeContextValue = {
  theme: AdminTheme
  setTheme: (next: AdminTheme) => void
  toggle: () => void
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined)

type AdminThemeProviderProps = {
  children: React.ReactNode
  targetId: string
}

export function AdminThemeProvider({ children, targetId }: AdminThemeProviderProps) {
  const [theme, setThemeState] = useState<AdminTheme>(() => {
    if (typeof window === "undefined") return "light"
    const stored = window.localStorage.getItem("admin-theme") as AdminTheme | null
    return stored === "dark" ? "dark" : "light"
  })

  useEffect(() => {
    const el = document.getElementById(targetId)
    if (!el) return
    if (theme === "dark") {
      el.classList.add("dark")
    } else {
      el.classList.remove("dark")
    }
    window.localStorage.setItem("admin-theme", theme)
  }, [theme, targetId])

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => setThemeState(next),
      toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme]
  )

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext)
  if (!ctx) throw new Error("useAdminTheme must be used within AdminThemeProvider")
  return ctx
}


