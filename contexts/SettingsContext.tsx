"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from "react-hot-toast";
import { useAuth } from './AuthContext';
import { adminApi, userApi } from '@/lib/api-backend';
import { useTheme } from 'next-themes';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebarCollapsed';

function readSidebarCollapsedFromStorage(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

function writeSidebarCollapsedToStorage(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // localStorage may be unavailable
  }
}

interface SettingsContextType {
  emailNotifications: boolean;
  pushNotifications: boolean;
  jobAlerts: boolean;
  applicationUpdates: boolean;
  autoLogout: number;
  tableRowsPerPage: number;
  sidebarCollapsed: boolean;
  profile: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  theme: 'light' | 'dark' | 'system' | 'studio';
  updateSettings: (settings: Partial<SettingsContextType>) => Promise<void>;
  updateTheme: (theme: 'light' | 'dark' | 'system' | 'studio') => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme: setSystemTheme } = useTheme();
  
  const [settings, setSettings] = useState<Omit<SettingsContextType, 'updateSettings' | 'updateTheme' | 'isLoading'>>({
    // Initialize with default values
    emailNotifications: true,
    pushNotifications: true,
    jobAlerts: true,
    applicationUpdates: true,
    autoLogout: 30,
    tableRowsPerPage: 25,
    sidebarCollapsed: false,
    profile: {
      name: '',
      email: '',
      avatarUrl: ''
    },
    theme: 'light'
  });

  // Load settings when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Update profile when user data changes
  useEffect(() => {
    if (user) {
      setSettings(prev => ({
        ...prev,
        profile: {
          name: user.name || '',
          email: user.email || '',
          avatarUrl: prev.profile.avatarUrl
        }
      }));
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const storedCollapsed = readSidebarCollapsedFromStorage();
      const api = isAdmin ? adminApi : userApi;
      const response = await api.getSettings();
      const payload: any = isAdmin ? (response?.settings ?? response) : response?.settings;
      
      if (payload) {
        const nextCollapsed =
          typeof payload.sidebarCollapsed === 'boolean'
            ? payload.sidebarCollapsed
            : storedCollapsed;
        if (typeof nextCollapsed === 'boolean') {
          writeSidebarCollapsedToStorage(nextCollapsed);
        }
        setSettings(prev => ({
          ...prev,
          ...payload,
          // Prefer API when present; else localStorage (user API omits this field)
          sidebarCollapsed:
            typeof nextCollapsed === 'boolean'
              ? nextCollapsed
              : prev.sidebarCollapsed,
          profile: {
            name: user?.name || '',
            email: user?.email || '',
            avatarUrl: (payload.profile?.avatarUrl) || prev.profile.avatarUrl
          }
        }));
      } else if (storedCollapsed !== null) {
        setSettings(prev => ({
          ...prev,
          sidebarCollapsed: storedCollapsed,
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      const storedCollapsed = readSidebarCollapsedFromStorage();
      if (storedCollapsed !== null) {
        setSettings(prev => ({
          ...prev,
          sidebarCollapsed: storedCollapsed,
        }));
      }
      // Don't show error toast on load failure, just use defaults
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<SettingsContextType>) => {
    const previous = settings;
    const sidebarOnly =
      Object.keys(newSettings).length === 1 &&
      Object.prototype.hasOwnProperty.call(newSettings, 'sidebarCollapsed');

    try {
      // Optimistic update
      setSettings(prev => ({ ...prev, ...newSettings }));

      if (typeof newSettings.sidebarCollapsed === 'boolean') {
        writeSidebarCollapsedToStorage(newSettings.sidebarCollapsed);
      }

      // Employee/user settings API does not accept sidebarCollapsed — keep it local only.
      if (sidebarOnly && !isAdmin) {
        return;
      }
      
      const api = isAdmin ? adminApi : userApi;
      await api.updateSettings(newSettings);
      // Sidebar collapse is a chrome toggle — skip toast noise
      if (!sidebarOnly) {
        toast.success("Settings updated successfully");
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      // Sidebar chrome toggle already persisted to localStorage — keep UI state.
      if (sidebarOnly && typeof newSettings.sidebarCollapsed === 'boolean') {
        return;
      }
      setSettings(previous);
      toast.error('Failed to update settings');
      throw error;
    }
  };

  const updateTheme = (theme: 'light' | 'dark' | 'system' | 'studio') => {
    setSettings(prev => ({ ...prev, theme }));
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      // Scope theme class to user dashboard root so public pages are unaffected
      const root = document.getElementById('user-root');
      if (root) {
        root.classList.remove('light', 'dark');
        if (theme === 'dark') root.classList.add('dark');
        if (theme === 'light') root.classList.add('light');
      }
    }
    // Also update system/theme for components that rely on next-themes
    if (theme !== 'studio') {
      try { setSystemTheme(theme); } catch {}
    }
  };

  // Load theme + sidebar chrome preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCollapsed = readSidebarCollapsedFromStorage();
      if (storedCollapsed !== null) {
        setSettings(prev => ({ ...prev, sidebarCollapsed: storedCollapsed }));
      }

      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | 'studio' | null;
      if (savedTheme) {
        setSettings(prev => ({ ...prev, theme: savedTheme }));
        const root = document.getElementById('user-root');
        if (root) {
          root.classList.remove('light', 'dark');
          if (savedTheme === 'dark') root.classList.add('dark');
          if (savedTheme === 'light') root.classList.add('light');
        }
        if (savedTheme !== 'studio') {
          try { setSystemTheme(savedTheme); } catch {}
        }
      }
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      ...settings, 
      updateSettings,
      updateTheme,
      isLoading
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 