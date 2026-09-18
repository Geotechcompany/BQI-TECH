export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  adminModules?: string[];
  isEmailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  profileImage?: string;
  phone?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  experience?: any[];
  education?: any[];
  socialLinks?: Record<string, string>;
  totpEnabled?: boolean;
  email2faEnabled?: boolean;
  admin2faPolicy?: "prompt" | "require_one" | "require_both";
  admin2faSatisfied?: boolean;
  admin2faPrompt?: boolean;
  admin2faFactors?: { email?: boolean; totp?: boolean };
  settings?: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    theme: 'light' | 'dark' | 'system';
  };
} 