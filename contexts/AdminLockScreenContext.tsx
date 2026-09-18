"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";

const STORAGE_KEY = "admin.screenLocked";

type AdminLockScreenContextValue = {
  isLocked: boolean;
  lock: () => void;
  unlockWithPassword: (password: string) => Promise<void>;
  signInAsDifferentUser: () => Promise<void>;
};

const AdminLockScreenContext =
  createContext<AdminLockScreenContextValue | undefined>(undefined);

function readLockedFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLockedFlag(locked: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (locked) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private mode / storage blocked — in-memory state still applies.
  }
}

export function AdminLockScreenProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    setIsLocked(readLockedFlag());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      writeLockedFlag(false);
      setIsLocked(false);
    }
  }, [isAuthenticated]);

  const lock = useCallback(() => {
    writeLockedFlag(true);
    setIsLocked(true);
  }, []);

  const clearLock = useCallback(() => {
    writeLockedFlag(false);
    setIsLocked(false);
  }, []);

  const unlockWithPassword = useCallback(
    async (password: string) => {
      const email = user?.email?.trim();
      if (!email) {
        throw new Error("No signed-in email found. Sign in again.");
      }
      const trimmed = password.trim();
      if (!trimmed) {
        throw new Error("Enter your password.");
      }

      // Same login API as sign-in, but does not clear the session on a wrong password.
      await authService.reauthenticate(email, trimmed);
      clearLock();
    },
    [user?.email, clearLock]
  );

  const signInAsDifferentUser = useCallback(async () => {
    clearLock();
    await logout();
  }, [clearLock, logout]);

  const value = useMemo(
    () => ({
      isLocked,
      lock,
      unlockWithPassword,
      signInAsDifferentUser,
    }),
    [isLocked, lock, unlockWithPassword, signInAsDifferentUser]
  );

  return (
    <AdminLockScreenContext.Provider value={value}>
      {children}
    </AdminLockScreenContext.Provider>
  );
}

export function useAdminLockScreen() {
  const context = useContext(AdminLockScreenContext);
  if (!context) {
    throw new Error(
      "useAdminLockScreen must be used within AdminLockScreenProvider"
    );
  }
  return context;
}

/** Safe for menus that may render outside the provider (returns no-ops). */
export function useOptionalAdminLockScreen() {
  return useContext(AdminLockScreenContext);
}
