import { ResponseDecoder } from "./response-decoder";
import { ResponseDecryption } from "./encryption-decoder";

interface User {
  id: string;
  _id?: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
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

/** FastAPI may return `detail` as a string or validation error list */
function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
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

export type AuthRequestError = Error & { status: number };

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

  return {
    title: "Invalid credentials",
    description: message || "Please check your email and password.",
  };
}

// Token storage utilities
const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";

class AuthService {
  private SESSION_KEY = "auth_session";

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

  // Set session data
  setSession(session: SessionData): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
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
        const detail = formatFastApiDetail(errorBody.detail);
        const err = new Error(detail || "Login failed") as AuthRequestError;
        err.status = response.status;
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

  // Refresh token
  async refreshToken(): Promise<AuthResponse | null> {
    try {
      const session = this.getSession();

      if (!session?.refreshToken) {
        this.clearSession();
        return null;
      }
      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: session.refreshToken,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        this.clearSession();
        return null;
      }

      const rawData = await response.json();
      // Try decryption first, then obfuscation decoding
      let data;
      try {
        data = await ResponseDecryption.decrypt(rawData);
      } catch (error) {
        data = ResponseDecoder.decode(rawData);
      }

      if (!data.access_token || !data.refresh_token) {
        console.error("Invalid refresh response:", data);
        this.clearSession();
        return null;
      }

      // Update session with new tokens while preserving user data
      const newSession: SessionData = {
        user: session.user,
        token: data.access_token,
        refreshToken: data.refresh_token,
      };

      this.setSession(newSession);

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: "bearer",
        user: session.user,
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
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

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

      return await fetch(url, {
        ...options,
        headers: newHeaders,
        credentials: "include",
      });
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
        // Try decryption with user ID first, then obfuscation decoding
        let profileData;
        try {
          const currentSession = this.getSession();
          const userId = currentSession?.user?.id;
          profileData = await ResponseDecryption.decrypt(
            rawProfileData,
            userId
          );
        } catch (error) {
          profileData = ResponseDecoder.decode(rawProfileData);
        }

        // Update session with new profile data
        const currentSession = this.getSession();
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            user: {
              ...currentSession.user,
              ...profileData,
              isEmailVerified: profileData.isEmailVerified || false,
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
