export interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  active?: boolean;
  avatarUrl?: string;
  adminModules?: string[];
  invitePending?: boolean;
  isEmailVerified?: boolean;
  totpEnabled?: boolean;
  email2faEnabled?: boolean;
  require2fa?: boolean;
  createdAt?: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  name: string;
  role: string;
  adminModules?: string[];
  status: "pending" | "accepted" | "revoked";
  invitedByName?: string;
  createdAt?: string;
  expiresAt?: string;
}
