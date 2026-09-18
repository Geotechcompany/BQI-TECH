import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";

export type Admin2faPolicy = "prompt" | "require_one" | "require_both";
export type Admin2faMethod = "email" | "totp" | "recovery";

export interface Admin2faStatus {
  policy: Admin2faPolicy;
  factors: { email: boolean; totp: boolean };
  satisfied: boolean;
  prompt: boolean;
  totpEnabled: boolean;
  email2faEnabled: boolean;
  require2fa?: boolean;
  recoveryCodesRemaining: number;
}

export interface Admin2faChallengeResponse {
  requires_2fa: true;
  challenge_token: string;
  methods: Admin2faMethod[];
  email_hint?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export interface Admin2faTotpSetupStart {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

async function parseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as { detail?: unknown })?.detail;
    let message = "Request failed";
    if (typeof detail === "string") {
      message = detail;
    } else if (detail && typeof detail === "object" && "message" in detail) {
      message = String((detail as { message: string }).message);
    } else if ((data as { message?: string }).message) {
      message = String((data as { message: string }).message);
    }
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = response.status;
    if (detail && typeof detail === "object" && "code" in detail) {
      err.code = String((detail as { code: string }).code);
    }
    throw err;
  }
  return data;
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const session = authService.getSession();
  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  return headers;
}

export async function fetchAdmin2faStatus(): Promise<Admin2faStatus> {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/status`, {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJson(response) as Promise<Admin2faStatus>;
}

export async function verifyAdmin2faChallenge(input: {
  challenge_token: string;
  method: Admin2faMethod;
  code: string;
}) {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/challenge/verify`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function sendAdmin2faEmailOtp(challenge_token?: string) {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/email/send`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(
      challenge_token ? { challenge_token } : {}
    ),
  });
  return parseJson(response);
}

export async function startAdminTotpSetup(): Promise<Admin2faTotpSetupStart> {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/totp/setup/start`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: "{}",
  });
  return parseJson(response) as Promise<Admin2faTotpSetupStart>;
}

export async function confirmAdminTotpSetup(code: string) {
  const response = await fetch(
    `${BACKEND_URL}/api/auth/2fa/totp/setup/confirm`,
    {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify({ code }),
    }
  );
  return parseJson(response) as Promise<{
    ok: boolean;
    totpEnabled: boolean;
    recoveryCodes: string[];
    message?: string;
  }>;
}

export async function disableAdminTotp(input: {
  password: string;
  code: string;
}) {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/totp/disable`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function enableAdminEmail2fa(input: {
  password: string;
  code: string;
}) {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/email/enable`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function disableAdminEmail2fa(input: {
  password: string;
  code?: string;
}) {
  const response = await fetch(`${BACKEND_URL}/api/auth/2fa/email/disable`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export function policyLabel(policy: Admin2faPolicy): string {
  switch (policy) {
    case "require_both":
      return "Require authenticator + email";
    case "require_one":
      return "Require at least one factor";
    case "prompt":
    default:
      return "Prompt (optional)";
  }
}
