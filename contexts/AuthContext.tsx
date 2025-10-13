"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/auth-backend";
import { User } from "@/types/user";
import { SessionExpiredDialog } from "@/components/auth/SessionExpiredDialog";

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  userRole?: string;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const [sessionTimeoutId, setSessionTimeoutId] =
    useState<NodeJS.Timeout | null>(null);
  const [sessionWarningId, setSessionWarningId] =
    useState<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Session timeout configuration (in minutes)
  const SESSION_TIMEOUT_MINUTES = 30; // 30 minutes
  const SESSION_WARNING_MINUTES = 5; // Show warning 5 minutes before expiry

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
    if (isAuthError && authState.isAuthenticated && authState.user) {
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
          // Fetch complete user profile
          try {
            const profileResponse = await authService.authenticatedFetch(
              `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/users/profile`
            );
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              const resolvedRole =
                (profileData &&
                  typeof profileData.role === "string" &&
                  profileData.role) ||
                (session?.user?.role as string | undefined) ||
                undefined;

              setAuthState({
                isAuthenticated: true,
                isAdmin: roleIsAdmin(resolvedRole),
                user: {
                  ...session.user,
                  ...profileData,
                  firstName: profileData.firstName || "",
                  lastName: profileData.lastName || "",
                },
                userRole: resolvedRole,
                authLoading: false,
              });
            } else {
              // Fallback to session user if profile fetch fails
              setAuthState({
                isAuthenticated: true,
                isAdmin: roleIsAdmin(session.user.role),
                user: session.user,
                userRole: session.user.role,
                authLoading: false,
              });
            }
          } catch (profileError) {
            console.error("Error fetching profile on init:", profileError);
            handleAuthError(profileError);
            // Fallback to session user if profile fetch fails
            setAuthState({
              isAuthenticated: true,
              isAdmin: roleIsAdmin(session.user.role),
              user: session.user,
              userRole: session.user.role,
              authLoading: false,
            });
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

      // Fetch complete user profile after login
      try {
        const profileResponse = await authService.authenticatedFetch(
          `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/users/profile`
        );
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const resolvedRole =
            (profileData &&
              typeof profileData.role === "string" &&
              profileData.role) ||
            (response?.user?.role as string | undefined) ||
            undefined;

          setAuthState({
            isAuthenticated: true,
            isAdmin: roleIsAdmin(resolvedRole),
            user: {
              ...response.user,
              ...profileData,
              firstName: profileData.firstName || "",
              lastName: profileData.lastName || "",
            },
            userRole: resolvedRole,
            authLoading: false,
          });
        } else {
          // Fallback to login response if profile fetch fails
          setAuthState({
            isAuthenticated: true,
            isAdmin: roleIsAdmin(response.user.role),
            user: response.user,
            userRole: response.user.role,
            authLoading: false,
          });
        }
      } catch (profileError) {
        console.error("Error fetching profile:", profileError);
        // Fallback to login response if profile fetch fails
        setAuthState({
          isAuthenticated: true,
          isAdmin: roleIsAdmin(response.user.role),
          user: response.user,
          userRole: response.user.role,
          authLoading: false,
        });
      }
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
      setAuthState({
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        userRole: undefined,
        authLoading: false,
      });
    }
  };

  const refreshToken = async () => {
    try {
      const session = authService.getSession();
      if (!session?.refreshToken) {
        throw new Error("No refresh token");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            refresh_token: session.refreshToken,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Token refresh failed:", response.status, errorData);

        // If refresh token is expired, clear session and redirect to login
        if (response.status === 401 || errorData.detail?.includes("expired")) {
          console.log("Refresh token expired, redirecting to login");
          authService.clearSession();
          setAuthState((prev) => ({
            ...prev,
            isAuthenticated: false,
            isAdmin: false,
            user: null,
            userRole: undefined,
            authLoading: false,
          }));
          router.push("/login?message=Session expired. Please log in again.");
          return;
        }

        throw new Error("Failed to refresh token");
      }

      const data = await response.json();
      const newSession = {
        ...session,
        token: data.access_token,
        refreshToken: data.refresh_token,
      };

      authService.setSession(newSession);

      // Update auth state with new session
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: true,
        isAdmin: roleIsAdmin(session.user.role),
        user: session.user,
        userRole: session.user.role,
        authLoading: false,
      }));
    } catch (error) {
      console.error("Token refresh failed:", error);
      authService.clearSession();
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        userRole: undefined,
        authLoading: false,
      }));
      router.push("/login?message=Session expired. Please log in again.");
    }
  };

  const updateUserAvatar = (avatarUrl: string) => {
    if (!authState.user) return;

    const updatedUser = {
      ...authState.user,
      avatar: avatarUrl,
      name:
        authState.user.firstName && authState.user.lastName
          ? `${authState.user.firstName} ${authState.user.lastName}`
          : authState.user.name || authState.user.email,
      isEmailVerified: authState.user.isEmailVerified || false,
    };

    // Update local state
    setAuthState((prev) => ({
      ...prev,
      user: updatedUser,
    }));

    // Update session storage
    const currentSession = authService.getSession();
    if (currentSession) {
      // Create auth-backend compatible user object
      const sessionUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || updatedUser.email, // Ensure name is always present
        role: updatedUser.role,
        isEmailVerified: updatedUser.isEmailVerified || false,
        avatarUrl: updatedUser.avatar,
      };

      authService.setSession({
        ...currentSession,
        user: sessionUser,
      });
    }
  };

  const refreshUserProfile = async () => {
    try {
      const session = authService.getSession();
      if (!session?.token) {
        throw new Error("No session token");
      }

      const response = await authService.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/users/profile`
      );
      if (response.ok) {
        const profileData = await response.json();

        const updatedUser = {
          ...session.user,
          ...profileData,
          firstName: profileData.firstName || "",
          lastName: profileData.lastName || "",
          isEmailVerified: profileData.isEmailVerified || false,
        };

        // Update session storage
        authService.setSession({
          ...session,
          user: updatedUser,
        });

        setAuthState((prev) => ({
          ...prev,
          user: updatedUser,
          userRole: profileData.role,
          isAdmin: roleIsAdmin(profileData.role),
          authLoading: false,
        }));
      } else {
        console.error("Failed to refresh user profile");
        setAuthState((prev) => ({
          ...prev,
          authLoading: false,
        }));
      }
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
    // Clear existing timeouts
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
    if (sessionWarningId) clearTimeout(sessionWarningId);

    // Set warning timeout (5 minutes before expiry)
    const warningTimeout =
      (SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES) * 60 * 1000;
    const warningId = setTimeout(() => {
      setShowSessionTimeout(true);
      setSessionTimeRemaining(SESSION_WARNING_MINUTES * 60); // 5 minutes in seconds

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setSessionTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleSessionExpiry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningTimeout);

    // Set actual session timeout
    const timeoutId = setTimeout(() => {
      handleSessionExpiry();
    }, SESSION_TIMEOUT_MINUTES * 60 * 1000);

    setSessionWarningId(warningId);
    setSessionTimeoutId(timeoutId);
  };

  const handleSessionExpiry = () => {
    setShowSessionTimeout(false);
    setShowSessionExpired(true);
    setSessionTimeRemaining(0);
  };

  const refreshSession = async () => {
    try {
      await refreshToken();
      setShowSessionTimeout(false);
      setSessionTimeRemaining(0);
      startSessionTimeout(); // Restart the timeout
    } catch (error) {
      console.error("Failed to refresh session:", error);
      handleSessionExpiry();
    }
  };

  // Start session timeout when user logs in
  useEffect(() => {
    if (authState.isAuthenticated && !authState.authLoading) {
      startSessionTimeout();
    } else {
      // Clear timeouts when not authenticated
      if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
      if (sessionWarningId) clearTimeout(sessionWarningId);
      setShowSessionTimeout(false);
      setSessionTimeRemaining(0);
    }

    // Cleanup on unmount
    return () => {
      if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
      if (sessionWarningId) clearTimeout(sessionWarningId);
    };
  }, [authState.isAuthenticated, authState.authLoading]);

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
      }}
    >
      {children}

      {/* Session Expired Dialog */}
      <SessionExpiredDialog
        isOpen={showSessionExpired}
        onClose={() => setShowSessionExpired(false)}
        onRefresh={async () => {
          try {
            await refreshToken();
            setShowSessionExpired(false);
          } catch (error) {
            console.error("Failed to refresh token:", error);
            // If refresh fails, let the dialog handle logout
            throw error;
          }
        }}
        countdownDuration={30}
      />
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
