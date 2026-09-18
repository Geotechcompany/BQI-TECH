"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/lib/auth-backend";
import { resolveEmailVerified } from "@/lib/resolve-email-verified";
import { User } from "@/types/user";
import { SessionExpiredDialog } from "@/components/auth/SessionExpiredDialog";
import { isAdmin2faChallenge } from "@/lib/auth-backend";
import {
  DEFAULT_ADMIN_BASE,
  adminHref,
  isPublicAdminPath,
  readAdminBasePathCookie,
} from "@/lib/admin-path";

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  userRole?: string;
  authLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<
    | { kind: "authenticated"; requiresSetup: boolean }
    | {
        kind: "challenge";
        challenge_token: string;
        methods: Array<"email" | "totp" | "recovery">;
        email_hint?: string;
      }
  >;
  completeAdmin2faLogin: (tokens: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    user: User;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => void;
  refreshUserProfile: () => Promise<void>;
  handleAuthError: (error: any) => void;
  isEmailVerified: () => boolean;
  checkEmailVerification: () => void;
  updateEmailVerificationStatus: (isVerified: boolean) => void;
  // Session timeout
  showSessionTimeout: boolean;
  sessionTimeRemaining: number;
  refreshSession: () => Promise<void>;
  /** True while Stay Logged In is renewing tokens — layouts must not redirect */
  isExtendingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    isAdmin: false,
    user: null as User | null,
    userRole: undefined as string | undefined,
    authLoading: true,
  });
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [showSessionTimeout, setShowSessionTimeout] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [isExtendingSession, setIsExtendingSession] = useState(false);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionWarningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCountdownRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const isExtendingSessionRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const isProtectedRoute = (path: string) =>
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/login");

  // Session timeout configuration (in minutes)
  const SESSION_TIMEOUT_MINUTES = 30; // 30 minutes
  const SESSION_WARNING_MINUTES = 5; // Show warning 5 minutes before expiry

  const clearSessionTimers = () => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (sessionWarningRef.current) {
      clearTimeout(sessionWarningRef.current);
      sessionWarningRef.current = null;
    }
    if (sessionCountdownRef.current) {
      clearInterval(sessionCountdownRef.current);
      sessionCountdownRef.current = null;
    }
  };

  const dismissSessionModals = () => {
    setShowSessionTimeout(false);
    setShowSessionExpired(false);
    setSessionTimeRemaining(0);
  };

  const roleIsAdmin = (role?: string): boolean => {
    if (!role) return false;
    const upper = role.toUpperCase();
    return upper === "ADMIN" || upper === "SUPER_ADMIN";
  };

  // Check email verification and redirect if needed
  const checkEmailVerification = () => {
    if (authState.isAuthenticated && authState.user) {
      const isVerified = authState.user.isEmailVerified || false;
      console.log("Checking email verification:", {
        isVerified,
        email: authState.user.email,
        user: {
          ...authState.user,
          sensitiveDataRemoved: true,
        },
        fullVerificationStatus: {
          userIsEmailVerified: authState.user.isEmailVerified,
          authStateIsAuthenticated: authState.isAuthenticated,
          userExists: !!authState.user,
        },
      });

      if (!isVerified) {
        console.warn(
          "User email not verified, redirecting to verification page",
          {
            currentPath:
              typeof window !== "undefined"
                ? window.location.pathname
                : "unknown",
          }
        );
        const verifyUrl = `/auth/verify-email?email=${encodeURIComponent(
          authState.user.email
        )}`;
        router.push(verifyUrl);
        return false;
      }
      return true;
    }
    console.log(
      "Email verification check failed - not authenticated or no user",
      {
        isAuthenticated: authState.isAuthenticated,
        userExists: !!authState.user,
      }
    );
    return false;
  };

  // Check email verification status
  const isEmailVerified = () => {
    const verified = authState.user?.isEmailVerified || false;
    return verified;
  };

  // Auto-check email verification when user state changes
  useEffect(() => {
    if (authState.isAuthenticated && authState.user && !authState.authLoading) {
      // Only check verification for dashboard and admin routes
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "";
      const requiresVerification =
        currentPath.startsWith("/dashboard") ||
        currentPath.startsWith("/admin");

      if (requiresVerification && !authState.user.isEmailVerified) {
        console.log("User not verified, redirecting from:", currentPath);
        checkEmailVerification();
      }
    }
  }, [authState.isAuthenticated, authState.user, authState.authLoading]);

  // Handle authentication errors
  const handleAuthError = (error: any) => {
    console.error("Authentication error detected:", error);

    // Check if it's an authentication/authorization error
    const isAuthError =
      error?.response?.status === 401 ||
      error?.status === 401 ||
      error?.message?.includes("authentication") ||
      error?.message?.includes("token") ||
      error?.message?.includes("unauthorized") ||
      error?.message?.includes("expired") ||
      error?.detail?.includes("authentication") ||
      error?.detail?.includes("token") ||
      error?.detail?.includes("expired");

    // Only show session expired dialog if user was previously authenticated
    // Don't show it if user was never logged in or already logged out
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : pathname || "";
    const shouldShowAuthDialogsOnPath = isProtectedRoute(currentPath);

    if (
      isAuthError &&
      authState.isAuthenticated &&
      authState.user &&
      shouldShowAuthDialogsOnPath
    ) {
      console.log(
        "Authentication error detected for authenticated user, showing session expired dialog"
      );
      setShowSessionExpired(true);
    } else if (isAuthError && !authState.isAuthenticated) {
      console.log(
        "Authentication error for non-authenticated user, redirecting to login"
      );
      // For non-authenticated users, just redirect to login
      router.push("/login?message=Please log in to continue");
    }
  };

  // Global error handler for API calls
  useEffect(() => {
    const handleGlobalError = (event: any) => {
      if (event.detail?.error) {
        handleAuthError(event.detail.error);
      }
    };

    // Listen for global authentication errors
    window.addEventListener("auth-error", handleGlobalError);

    return () => {
      window.removeEventListener("auth-error", handleGlobalError);
    };
  }, [authState.isAuthenticated, authState.user]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = authService.getSession();
        if (session?.token && session?.user) {
          if (authService.isAccessTokenExpired(session.token)) {
            const refreshed = await authService.refreshToken();
            if (!refreshed) {
              authService.clearSession();
              setAuthState((prev) => ({
                ...prev,
                isAuthenticated: false,
                isAdmin: false,
                user: null,
                userRole: undefined,
                authLoading: false,
              }));
              return;
            }
          }

          const activeSession = authService.getSession() ?? session;
          const resolvedRole = activeSession.user.role;

          // Hydrate immediately from cached session so protected routes are not blocked
          setAuthState({
            isAuthenticated: true,
            isAdmin: roleIsAdmin(resolvedRole),
            user: activeSession.user,
            userRole: resolvedRole,
            authLoading: false,
          });

          // Refresh profile in the background so role/email changes still apply
          try {
            const updatedSession = await authService.refreshUserProfile();
            const activeUser = updatedSession?.user ?? activeSession.user;
            if (updatedSession) {
              authService.setSession(updatedSession);
            } else {
              authService.setSession(activeSession);
            }

            setAuthState({
              isAuthenticated: true,
              isAdmin: roleIsAdmin(activeUser.role),
              user: activeUser,
              userRole: activeUser.role,
              authLoading: false,
            });
          } catch (refreshError) {
            console.warn("Background profile refresh failed:", refreshError);
          }
        } else {
          setAuthState((prev) => ({ ...prev, authLoading: false }));
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        handleAuthError(error);
        setAuthState((prev) => ({ ...prev, authLoading: false }));
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);

      if (isAdmin2faChallenge(response)) {
        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: false,
          isAdmin: false,
          user: null,
          userRole: undefined,
          authLoading: false,
        }));
        return {
          kind: "challenge" as const,
          challenge_token: response.challenge_token,
          methods: response.methods,
          email_hint: response.email_hint,
        };
      }

      const updatedSession = await authService.refreshUserProfile();
      const activeUser = updatedSession?.user ?? response.user;
      if (updatedSession) {
        authService.setSession(updatedSession);
      }
      const resolvedRole = activeUser.role;

      setAuthState({
        isAuthenticated: true,
        isAdmin: roleIsAdmin(resolvedRole),
        user: activeUser,
        userRole: resolvedRole,
        authLoading: false,
      });

      return {
        kind: "authenticated" as const,
        requiresSetup: Boolean(
          response.requires_2fa_setup ||
            activeUser.admin2faPrompt ||
            activeUser.admin2faSatisfied === false
        ),
      };
    } catch (error) {
      console.error("Login error:", error);
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        userRole: undefined,
        authLoading: false,
      }));
      throw error;
    }
  };

  const completeAdmin2faLogin = async (tokens: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    user: User;
  }) => {
    const response = await authService.completeAdmin2faLogin({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || "bearer",
      user: tokens.user as any,
    });
    const updatedSession = await authService.refreshUserProfile();
    const activeUser = updatedSession?.user ?? response.user;
    if (updatedSession) {
      authService.setSession(updatedSession);
    }
    setAuthState({
      isAuthenticated: true,
      isAdmin: roleIsAdmin(activeUser.role),
      user: activeUser,
      userRole: activeUser.role,
      authLoading: false,
    });
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      await authService.register(email, password, name);
      // Do not authenticate user here; signup requires email verification first
      setAuthState((prev) => ({ ...prev, authLoading: false }));
    } catch (error) {
      console.error("Registration error:", error);
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        userRole: undefined,
        authLoading: false,
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearSessionTimers();
      dismissSessionModals();
      setIsExtendingSession(false);
      isExtendingSessionRef.current = false;
      setAuthState({
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        userRole: undefined,
        authLoading: false,
      });
      const currentPath =
        typeof window !== "undefined"
          ? window.location.pathname
          : pathname || "";
      const adminBase = readAdminBasePathCookie() || DEFAULT_ADMIN_BASE;
      if (
        isPublicAdminPath(currentPath, adminBase) ||
        isPublicAdminPath(currentPath, DEFAULT_ADMIN_BASE)
      ) {
        router.replace(adminHref("/login", adminBase));
      } else {
        router.replace("/login");
      }
    }
  };

  const refreshToken = async () => {
    const session = authService.getSession();
    if (!session?.refreshToken) {
      // Do not flip isAuthenticated here — that triggers layout hard-redirects
      // mid "Stay Logged In". Caller shows an error; user can logout explicitly.
      throw new Error("No refresh token");
    }

    // Always go through authService so concurrent refreshes share one request
    // and do not race on rotated refresh tokens.
    const refreshed = await authService.refreshToken();
    if (!refreshed) {
      const stillHasSession = Boolean(authService.getSession()?.refreshToken);
      throw new Error(
        stillHasSession
          ? "Failed to refresh session. Please try again."
          : "Your session could not be renewed. Please log in again."
      );
    }

    const activeSession = authService.getSession();
    const refreshedUser = activeSession?.user ?? refreshed.user;

    setAuthState((prev) => ({
      ...prev,
      isAuthenticated: true,
      isAdmin: roleIsAdmin(refreshedUser.role),
      user: refreshedUser,
      userRole: refreshedUser.role,
      authLoading: false,
    }));
  };

  const updateUserAvatar = (avatarUrl: string) => {
    if (!authState.user) return;

    const updatedUser = {
      ...authState.user,
      avatar: avatarUrl,
      avatarUrl: avatarUrl,
      name:
        authState.user.firstName && authState.user.lastName
          ? `${authState.user.firstName} ${authState.user.lastName}`
          : authState.user.name || authState.user.email,
      isEmailVerified: resolveEmailVerified(
        authState.user.isEmailVerified,
        false
      ),
    };

    // Update local state
    setAuthState((prev) => ({
      ...prev,
      user: updatedUser,
    }));

    // Update session storage — merge into existing user so verification/role stay intact
    const currentSession = authService.getSession();
    if (currentSession) {
      authService.setSession({
        ...currentSession,
        user: {
          ...currentSession.user,
          ...updatedUser,
          id: updatedUser.id || currentSession.user.id,
          avatar: avatarUrl,
          avatarUrl: avatarUrl,
          isEmailVerified: resolveEmailVerified(
            updatedUser.isEmailVerified,
            resolveEmailVerified(currentSession.user?.isEmailVerified, false)
          ),
        },
      });
    }
  };

  const refreshUserProfile = async () => {
    try {
      const updatedSession = await authService.refreshUserProfile();
      if (!updatedSession?.user) {
        setAuthState((prev) => ({ ...prev, authLoading: false }));
        return;
      }

      setAuthState((prev) => ({
        ...prev,
        user: updatedSession.user,
        userRole: updatedSession.user.role,
        isAdmin: roleIsAdmin(updatedSession.user.role),
        authLoading: false,
      }));
    } catch (error) {
      console.error("Error refreshing user profile:", error);
      setAuthState((prev) => ({
        ...prev,
        authLoading: false,
      }));
    }
  };

  // Method to update verification status after email verification
  const updateEmailVerificationStatus = (isVerified: boolean) => {
    console.group("🔍 Updating Email Verification Status");
    console.log("Current Auth State Before Update:", {
      isAuthenticated: authState.isAuthenticated,
      user: authState.user
        ? {
            email: authState.user.email,
            isEmailVerified: authState.user.isEmailVerified,
          }
        : null,
    });

    const currentSession = authService.getSession();
    if (currentSession?.user) {
      authService.setSession({
        ...currentSession,
        user: {
          ...currentSession.user,
          isEmailVerified: isVerified,
        },
      });
    }

    setAuthState((prevState) => {
      const updatedState = {
        ...prevState,
        user: prevState.user
          ? {
              ...prevState.user,
              isEmailVerified: isVerified,
            }
          : null,
      };

      console.log("Updated Auth State:", {
        isAuthenticated: updatedState.isAuthenticated,
        user: updatedState.user
          ? {
              email: updatedState.user.email,
              isEmailVerified: updatedState.user.isEmailVerified,
            }
          : null,
      });

      console.groupEnd();
      return updatedState;
    });
  };

  // Session timeout management
  const startSessionTimeout = () => {
    clearSessionTimers();

    // Set warning timeout (5 minutes before expiry)
    const warningTimeout =
      (SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES) * 60 * 1000;
    sessionWarningRef.current = setTimeout(() => {
      setShowSessionTimeout(true);
      setSessionTimeRemaining(SESSION_WARNING_MINUTES * 60); // 5 minutes in seconds

      // Start countdown timer — must be cleared on refresh or it will reopen the expired modal
      sessionCountdownRef.current = setInterval(() => {
        setSessionTimeRemaining((prev) => {
          if (prev <= 1) {
            if (sessionCountdownRef.current) {
              clearInterval(sessionCountdownRef.current);
              sessionCountdownRef.current = null;
            }
            handleSessionExpiry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningTimeout);

    // Set actual session timeout
    sessionTimeoutRef.current = setTimeout(() => {
      handleSessionExpiry();
    }, SESSION_TIMEOUT_MINUTES * 60 * 1000);
  };

  const handleSessionExpiry = () => {
    // Do not auto-logout while Stay Logged In is in flight
    if (isExtendingSessionRef.current) return;
    clearSessionTimers();
    setShowSessionTimeout(false);
    setShowSessionExpired(true);
    setSessionTimeRemaining(0);
  };

  const refreshSession = async () => {
    // Stop idle / countdown timers first so auto-logout cannot fire mid-refresh
    clearSessionTimers();
    isExtendingSessionRef.current = true;
    setIsExtendingSession(true);
    try {
      await refreshToken();
      dismissSessionModals();
      startSessionTimeout();
    } catch (error) {
      // Keep expired dialog open for retry; never hard-redirect from here
      setShowSessionTimeout(false);
      setShowSessionExpired(true);
      throw error;
    } finally {
      isExtendingSessionRef.current = false;
      setIsExtendingSession(false);
    }
  };

  // Start session timeout when user logs in
  useEffect(() => {
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : pathname || "";
    const shouldRunSessionTimeout = isProtectedRoute(currentPath);

    if (authState.isAuthenticated && !authState.authLoading && shouldRunSessionTimeout) {
      startSessionTimeout();
    } else {
      clearSessionTimers();
      dismissSessionModals();
    }

    return () => {
      clearSessionTimers();
    };
  }, [authState.isAuthenticated, authState.authLoading, pathname]);

  // Periodic token refresh to prevent expiration
  useEffect(() => {
    if (!authState.isAuthenticated || authState.authLoading) return;

    const refreshInterval = setInterval(async () => {
      try {
        const session = authService.getSession();
        if (session?.refreshToken) {
          await refreshToken();
        }
      } catch (error) {
        console.error("Periodic token refresh failed:", error);
        // Don't clear session on periodic refresh failure
        // Let the next API call handle it
      }
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(refreshInterval);
  }, [authState.isAuthenticated, authState.authLoading]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        completeAdmin2faLogin,
        logout,
        refreshToken,
        register,
        updateUserAvatar,
        refreshUserProfile,
        handleAuthError,
        isEmailVerified,
        checkEmailVerification,
        updateEmailVerificationStatus,
        showSessionTimeout,
        sessionTimeRemaining,
        refreshSession,
        isExtendingSession,
      }}
    >
      {children}

      {isProtectedRoute(pathname || "") ? (
        <SessionExpiredDialog
          isOpen={showSessionExpired}
          onClose={() => setShowSessionExpired(false)}
          onRefresh={refreshSession}
          countdownDuration={30}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Compatibility hooks for easier migration from NextAuth
export function useSession() {
  const { user, authLoading } = useAuth();

  return {
    data: user
      ? { user, expires: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
      : null,
    status: authLoading
      ? "loading"
      : user
      ? "authenticated"
      : "unauthenticated",
  };
}

export function signIn(provider?: string, options?: any) {
  // For now, redirect to login page
  if (typeof window !== "undefined") {
    const callbackUrl = options?.callbackUrl || "/dashboard";
    window.location.href = `/login?callbackUrl=${encodeURIComponent(
      callbackUrl
    )}`;
  }
}

export function signOut(options?: any) {
  const { logout } = useAuth();
  logout().then(() => {
    if (typeof window !== "undefined") {
      const callbackUrl = options?.callbackUrl || "/";
      window.location.href = callbackUrl;
    }
  });
}
