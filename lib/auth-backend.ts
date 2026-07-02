import { ResponseDecoder } from "./response-decoder";
import { ResponseDecryption } from "./encryption-decoder";
import { resolveEmailVerified } from "./resolve-email-verified";

interface User {
  id: string;
  _id?: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  adminModules?: string[];
  isEmailVerified: boolean;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  refresh_token: string;
}

interface SessionData {
  user: User;
  token: string;
  refreshToken: string;
}

import { BACKEND_URL } from "./config";

const AUTH_FETCH_TIMEOUT_MS = 15_000;

function createFetchTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function mergeFetchOptions(
  options: RequestInit,
  timeoutMs: number
): RequestInit {
  const timeoutSignal = createFetchTimeoutSignal(timeoutMs);
  const signals = [options.signal, timeoutSignal].filter(Boolean) as AbortSignal[];

  if (signals.length === 0) {
    return { ...options, signal: timeoutSignal };
  }

  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return {
      ...options,
      signal: AbortSignal.any(signals),
    };
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    ...options,
    signal: controller.signal,
  };
}

/** FastAPI may return `detail` as a string, structured object, or validation error list */
function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    if ("message" in detail && typeof (detail as { message: unknown }).message === "string") {
      return (detail as { message: string }).message;
    }
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  return "Login failed";
}

function extractFastApiErrorCode(detail: unknown): string | undefined {
  if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) {
    const code = (detail as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export type AuthRequestError = Error & { status: number; code?: string };

/** Maps login failures to user-facing toast copy (avoids labeling DB outages as wrong password). */
export function getLoginToastFromError(error: unknown): {
  title: string;
  description: string;
} {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const status =
    error instanceof Error &&
    "status" in error &&
    typeof (error as AuthRequestError).status === "number"
      ? (error as AuthRequestError).status
      : undefined;
  const code =
    error instanceof Error &&
    "code" in error &&
    typeof (error as AuthRequestError).code === "string"
      ? (error as AuthRequestError).code
      : undefined;

  if (status === 503) {
    return {
      title: "Service temporarily unavailable",
      description:
        message ||
        "The application could not reach the database. Please try again shortly.",
    };
  }

  if (
    /replicasetnoprimary|no replica set members|topology_type|serverselectiontimeout|mongodb|waiting for suitable server/i.test(
      message
    )
  ) {
    return {
      title: "Service temporarily unavailable",
      description:
        "The application could not reach the database. Please try again shortly. If you manage the database, check MongoDB Atlas for cluster health.",
    };
  }

  if (status === 500) {
    return {
      title: "Something went wrong",
      description: message || "Please try again.",
    };
  }

  if (code === "email_not_found") {
    return {
      title: "Email not recognized",
      description:
        message ||
        "We couldn't find an account with that email address. Please check for typos or sign up for a new account.",
    };
  }

  if (code === "invalid_password") {
    return {
      title: "Incorrect password",
      description:
        message ||
        "The password you entered is incorrect. If you recently reset your password, use your new password or request another reset link.",
    };
  }

  if (code === "pending_verification") {
    return {
      title: "Verify your email",
      description:
        message ||
        "Please verify your email to complete registration before signing in.",
    };
  }

  if (/couldn't find an account with that email/i.test(message)) {
    return {
      title: "Email not recognized",
      description: message,
    };
  }

  if (/password you entered is incorrect|recently reset your password/i.test(message)) {
    return {
      title: "Incorrect password",
      description: message,
    };
  }

  if (/verify your email/i.test(message)) {
    return {
      title: "Verify your email",
      description: message,
    };
  }

  return {
    title: "Sign-in unsuccessful",
    description: message || "Please check your email and password, then try again.",
  };
}

// Token storage utilities
const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const json =
      typeof atob === "function"
        ? atob(padded)
        : typeof Buffer !== "undefined"
          ? Buffer.from(padded, "base64").toString("utf8")
          : "";
    if (!json) return null;
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

class AuthService {
  private SESSION_KEY = "auth_session";
  private refreshPromise: Promise<AuthResponse | null> | null = null;

  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Store auth data in localStorage
  private setAuthData(token: string, user: User): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  // Get stored auth data
  private getAuthData(): { token: string | null; user: User | null } {
    if (typeof window === "undefined") {
      return { token: null, user: null };
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const userData = localStorage.getItem(USER_KEY);

    return {
      token,
      user: userData ? JSON.parse(userData) : null,
    };
  }

  // Clear auth data
  private clearAuthData(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  // Set session data (localStorage + cookie for middleware)
  setSession(session: SessionData): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      const maxAge = 30 * 24 * 60 * 60;
      document.cookie = `${this.SESSION_KEY}=${encodeURIComponent(
        JSON.stringify(session)
      )}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }

  // Get current session
  getSession(): SessionData | null {
    if (typeof window === "undefined") return null;

    const session = localStorage.getItem(this.SESSION_KEY);

    if (!session) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(session);
      return parsedSession;
    } catch (error) {
      console.error("Error parsing session:", error);
      this.clearSession();
      return null;
    }
  }

  // Clear session data
  clearSession(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.SESSION_KEY);
      document.cookie = `${this.SESSION_KEY}=; path=/; max-age=0; SameSite=Lax`;
    }
  }

  // Decode/Decrypt API response if encoded or encrypted
  private async decodeResponse(
    response: Response,
    userId?: string
  ): Promise<any> {
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();

      // First try decryption (for encrypted responses)
      try {
        const decrypted = await ResponseDecryption.decrypt(data, userId);
        return decrypted;
      } catch (error) {
        // If decryption fails, try obfuscation decoding
        return ResponseDecoder.decode(data);
      }
    }
    return response;
  }

  // Login with email and password
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Use URLSearchParams for form data as required by FastAPI
      const formData = new URLSearchParams();
      formData.append("username", email.toLowerCase());
      formData.append("password", password);

      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Login error response:", errorBody);
        const detail = errorBody.detail;
        const message = formatFastApiDetail(detail);
        const err = new Error(message || "Login failed") as AuthRequestError;
        err.status = response.status;
        err.code = extractFastApiErrorCode(detail);
        throw err;
      }

      const rawData = await response.json();
      // Try decryption first, then obfuscation decoding
      let data: AuthResponse;
      try {
        data = await ResponseDecryption.decrypt(rawData);
      } catch (error) {
        data = ResponseDecoder.decode(rawData);
      }

      if (!data.access_token || !data.refresh_token || !data.user) {
        console.error("Invalid login response:", data);
        throw new Error("Invalid login response");
      }

      // Normalize user ID
      const user = {
        ...data.user,
        id: data.user.id || data.user._id,
        isEmailVerified: resolveEmailVerified(data.user?.isEmailVerified, false),
      };

      // Store session data
      const sessionData: SessionData = {
        user,
        token: data.access_token,
        refreshToken: data.refresh_token,
      };

      this.setSession(sessionData);

      return {
        ...data,
        user,
      };
    } catch (error) {
      console.error("Login error:", error);
      this.clearSession();
      throw error;
    }
  }

  // Register new user (no auto-login; returns initiation info only)
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ message: string; email: string }> {
    try {
      // Use FormData as required by the backend
      const formData = new FormData();
      formData.append("email", email.toLowerCase());
      formData.append("password", password);
      formData.append("name", name);

      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = error?.detail || error?.error || "Registration failed";
        console.error("Registration error response:", error);
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. ${detail}`);
        }
        throw new Error(detail);
      }

      // Return server message and normalized email; do not login
      const result = await response.json().catch(() => ({}));
      return {
        message:
          result?.message ||
          "Registration initiated. Please verify your email.",
        email: result?.email || email.toLowerCase(),
      };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        headers: this.getAuthHeader(),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Clear session data
      this.clearSession();
      this.clearAuthData();

      // Redirect to login page with success message
      if (typeof window !== "undefined") {
        window.location.href = "/login?message=Successfully logged out";
      }
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  isAccessTokenExpired(token: string, bufferSeconds = 60): boolean {
    const payload = decodeJwtPayload(token);
    const exp = payload?.exp;
    if (typeof exp !== "number") {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return now >= exp - bufferSeconds;
  }

  async ensureValidSession(): Promise<boolean> {
    const session = this.getSession();
    if (!session?.token) {
      return false;
    }
    if (!this.isAccessTokenExpired(session.token)) {
      return true;
    }
    const refreshed = await this.refreshToken();
    return Boolean(refreshed?.access_token);
  }

  // Refresh token (deduplicated — parallel 401s share one refresh request)
  async refreshToken(): Promise<AuthResponse | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefreshToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefreshToken(): Promise<AuthResponse | null> {
    try {
      const session = this.getSession();

      if (!session?.refreshToken) {
        this.clearSession();
        return null;
      }
      const response = await fetch(
        `${BACKEND_URL}/api/auth/refresh`,
        mergeFetchOptions(
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh_token: session.refreshToken,
            }),
            credentials: "include",
          },
          AUTH_FETCH_TIMEOUT_MS
        )
      );

      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        this.clearSession();
        return null;
      }

      const rawData = await response.json();
      const userId = session.user?.id;
      let data;
      try {
        data = await ResponseDecryption.decrypt(rawData, userId);
      } catch {
        data = ResponseDecoder.decode(rawData);
      }

      if (!data.access_token || !data.refresh_token) {
        console.error("Invalid refresh response:", data);
        this.clearSession();
        return null;
      }

      const refreshedUser = data.user
        ? {
            ...session.user,
            ...data.user,
            id: data.user.id || data.user._id || session.user.id,
          }
        : session.user;

      // Update session with new tokens and latest user (role) from the server
      const newSession: SessionData = {
        user: refreshedUser,
        token: data.access_token,
        refreshToken: data.refresh_token,
      };

      this.setSession(newSession);

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: "bearer",
        user: refreshedUser,
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      this.clearSession();
      return null;
    }
  }

  // Helper methods
  getCurrentUser(): User | null {
    const session = this.getSession();
    return session?.user || null;
  }

  isAuthenticated(): boolean {
    const session = this.getSession();
    return !!(session?.token && session?.user);
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return (
      user?.role?.toUpperCase() === "ADMIN" ||
      user?.role?.toUpperCase() === "SUPER_ADMIN"
    );
  }

  getAuthHeader(): { Authorization: string } | {} {
    const session = this.getSession();
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
  }

  // Authenticated fetch with automatic token refresh
  async authenticatedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const session = this.getSession();

    if (!session?.token) {
      throw new Error("No authentication token");
    }

    // Add security headers to obfuscate API calls
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const isBlob = typeof Blob !== "undefined" && options.body instanceof Blob;
    const isURLSearchParams =
      typeof URLSearchParams !== "undefined" &&
      options.body instanceof URLSearchParams;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.token}`,
      "X-Requested-With": "XMLHttpRequest",
      "X-Client-Version": "2.4.0",
      "X-Request-ID": Math.random().toString(36).substr(2, 9),
      Accept: "application/json, text/plain, */*",
      ...((options.headers as Record<string, string>) || {}),
    };

    // Only set JSON content type when not sending FormData/Blob/URLSearchParams
    if (
      !isFormData &&
      !isBlob &&
      !isURLSearchParams &&
      !("Content-Type" in headers)
    ) {
      headers["Content-Type"] = "application/json";
    } else if ((isFormData || isBlob) && "Content-Type" in headers) {
      // Let the browser set the boundary for multipart or appropriate type for Blob
      delete (headers as any)["Content-Type"];
    }

    // First attempt with current token
    try {
      const response = await fetch(
        url,
        mergeFetchOptions(
          {
            ...options,
            headers,
            credentials: "include",
          },
          AUTH_FETCH_TIMEOUT_MS
        )
      );

      // If token is valid, return response
      if (response.ok || response.status !== 401) {
        return response;
      }

      // If 401, try to refresh token
      const refreshResult = await this.refreshToken();

      if (!refreshResult) {
        this.clearSession();
        throw new Error("Authentication failed");
      }

      // Retry with new token
      const newHeaders = {
        ...headers,
        Authorization: `Bearer ${refreshResult.access_token}`,
      };

      return await fetch(
        url,
        mergeFetchOptions(
          {
            ...options,
            headers: newHeaders,
            credentials: "include",
          },
          AUTH_FETCH_TIMEOUT_MS
        )
      );
    } catch (error) {
      console.error("Authenticated fetch error:", error);
      throw error;
    }
  }

  // Check if user's email is verified
  isEmailVerified(): boolean {
    const session = this.getSession();
    return session?.user?.isEmailVerified || false;
  }

  // Refresh user profile data
  async refreshUserProfile(): Promise<SessionData | null> {
    try {
      const response = await this.authenticatedFetch(
        `${BACKEND_URL}/api/users/profile`
      );

      if (response.ok) {
        const rawProfileData = await response.json();
        const currentSession = this.getSession();
        const userId = currentSession?.user?.id;
        let profileData;
        try {
          profileData = await ResponseDecryption.decrypt(
            rawProfileData,
            userId
          );
        } catch {
          profileData = ResponseDecoder.decode(rawProfileData);
        }

        if (
          profileData &&
          typeof profileData === "object" &&
          (profileData as { encrypted?: boolean }).encrypted
        ) {
          return currentSession;
        }

        if (currentSession && profileData && typeof profileData === "object") {
          const isEmailVerified = resolveEmailVerified(
            profileData.isEmailVerified,
            resolveEmailVerified(currentSession.user?.isEmailVerified, false)
          );
          const updatedSession = {
            ...currentSession,
            user: {
              ...currentSession.user,
              ...profileData,
              id:
                profileData.id ||
                profileData._id ||
                currentSession.user.id,
              firstName: profileData.firstName || "",
              lastName: profileData.lastName || "",
              isEmailVerified,
              adminModules: profileData.adminModules || currentSession.user.adminModules,
            },
          };
          this.setSession(updatedSession);
          return updatedSession;
        }
      }

      return null;
    } catch (error) {
      console.error("Error refreshing user profile:", error);
      return null;
    }
  }
}

// Create singleton instance
const authService = AuthService.getInstance();

export { authService };
export type { User, AuthResponse, SessionData };

// Export convenience methods
export const login = (email: string, password: string) =>
  authService.login(email, password);
export const register = (email: string, password: string, name: string) =>
  authService.register(email, password, name);
export const logout = () => authService.logout();
export const getSession = () => authService.getSession();
export const getCurrentUser = () => authService.getCurrentUser();
export const isAuthenticated = () => authService.isAuthenticated();
export const isAdmin = () => authService.isAdmin();
export const getAuthHeader = () => authService.getAuthHeader();
export const authenticatedFetch = (url: string, options?: RequestInit) =>
  authService.authenticatedFetch(url, options);
