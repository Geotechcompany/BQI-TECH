"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminLockScreen } from "@/contexts/AdminLockScreenContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APP_VERSION_LABEL,
  APP_VERSION_TITLE,
  Version2Badge,
} from "@/components/admin/AdminBrandTitle";
import { ADMIN_COVER_SRC } from "@/components/auth/PortalBrandPanel";
import {
  EMPLOYEE_DEFAULT_AVATAR_SRC,
  resolveEmployeeAvatarSrc,
} from "@/lib/employee-portal-avatar";
import { cn } from "@/lib/utils";

const BRAND_NAVY = "#272156";

function getInitials(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
} | null): string {
  const fromNames = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join("");
  if (fromNames) return fromNames.toUpperCase();
  if (user?.name?.trim()) return user.name.trim().slice(0, 2).toUpperCase();
  if (user?.email?.trim()) return user.email.trim().slice(0, 2).toUpperCase();
  return "A";
}

export function AdminLockScreen() {
  const { user } = useAuth();
  const { isLocked, unlockWithPassword, signInAsDifferentUser } =
    useAdminLockScreen();
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

  const firstName =
    user?.firstName?.trim() ||
    user?.name?.trim()?.split(/\s+/)[0] ||
    "there";
  const displayName =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Admin";
  const email = (user?.email || "").trim();
  const initials = getInitials(user);

  useEffect(() => {
    if (!isLocked) {
      setPassword("");
      setError(null);
      setShowPassword(false);
      setIsUnlocking(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLocked]);

  if (!isLocked) return null;

  const handleUnlock = async (event: FormEvent) => {
    event.preventDefault();
    if (isUnlocking || isSwitchingUser) return;
    setIsUnlocking(true);
    setError(null);
    try {
      await unlockWithPassword(password);
      setPassword("");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Incorrect password. Try again.";
      setError(message);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDifferentUser = async () => {
    if (isUnlocking || isSwitchingUser) return;
    setIsSwitchingUser(true);
    setError(null);
    try {
      await signInAsDifferentUser();
    } catch {
      setError("Could not sign out. Try again.");
      setIsSwitchingUser(false);
    }
  };

  const formBusy = isUnlocking || isSwitchingUser;
  const avatarSrc = resolveEmployeeAvatarSrc(
    user?.avatar,
    user?.avatarUrl,
    user?.profileImage
  );
  const isDefaultAvatar = avatarSrc === EMPLOYEE_DEFAULT_AVATAR_SRC;

  return (
    <div
      className="fixed inset-0 z-[200000] grid min-h-[100dvh] bg-white lg:grid-cols-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-lock-title"
      aria-describedby="admin-lock-description"
    >
      {/* Left — unlock form */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-y-auto bg-white px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/bqilogo.png"
              alt="BQI"
              width={148}
              height={44}
              priority
              className="h-10 w-auto object-contain"
            />
            <Version2Badge variant="primary" />
          </div>

          <div className="mb-8 space-y-1.5">
            <h1
              id="admin-lock-title"
              className="text-[1.65rem] font-semibold leading-tight tracking-tight"
              style={{ color: BRAND_NAVY }}
            >
              Welcome back, {firstName}
            </h1>
            <p
              id="admin-lock-description"
              className="text-sm leading-relaxed text-slate-500"
            >
              Your session is locked. Enter your password to continue.
            </p>
          </div>

          <div className="mb-6 flex items-center gap-3.5">
            <Avatar className="h-14 w-14 ring-2 ring-[#272156]/10 ring-offset-2 ring-offset-white">
              <AvatarImage
                src={avatarSrc}
                alt={displayName}
                className={cn(
                  "object-cover",
                  isDefaultAvatar && "bg-[#272156]"
                )}
              />
              <AvatarFallback
                delayMs={0}
                className="bg-[#272156]/10 text-base font-semibold tracking-wide"
                style={{ color: BRAND_NAVY }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className="truncate text-[15px] font-semibold leading-tight"
                style={{ color: BRAND_NAVY }}
              >
                {displayName}
              </p>
              {email ? (
                <p className="mt-0.5 truncate text-[13px] text-slate-500">
                  {email}
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoFocus
                  disabled={formBusy}
                  className="h-12 rounded-xl border-border bg-background pl-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={formBusy}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={formBusy || !password.trim()}
              className="h-12 min-h-[44px] w-full rounded-xl text-base font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: BRAND_NAVY }}
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlocking…
                </>
              ) : (
                "Unlock"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => void handleDifferentUser()}
              disabled={formBusy}
              className="text-sm font-medium text-[#272156] underline-offset-4 transition-colors hover:underline disabled:opacity-60"
            >
              {isSwitchingUser ? "Signing out…" : "Sign in as different user"}
            </button>
          </div>
        </div>
      </section>

      {/* Right — brand panel */}
      <aside
        className="relative hidden min-h-[100dvh] overflow-hidden bg-[#272156] text-white lg:flex lg:flex-col"
        aria-label="BQI HR Platform"
      >
        <Image
          src={ADMIN_COVER_SRC}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, rgba(39,33,86,0.92) 0%, rgba(39,33,86,0.72) 38%, rgba(15,12,40,0.94) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 70% at 0% 0%, rgba(49,205,255,0.34), transparent 58%), radial-gradient(70% 55% at 100% 100%, rgba(49,205,255,0.12), transparent 55%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between gap-12 p-12 xl:p-16">
          <div
            className="inline-flex w-fit items-center rounded-2xl px-5 py-4 bg-white/10 ring-1 ring-inset ring-white/20 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl"
          >
            <Image
              src="/bqilogo-light.png"
              alt="BQI Tech"
              width={180}
              height={54}
              priority
              className="h-12 w-auto object-contain xl:h-14"
            />
          </div>

          <div className="max-w-md space-y-4">
            <p className="text-sm font-medium tracking-wide text-[#31CDFF]/90">
              BQI HR Platform
            </p>
            <h2 className="text-3xl font-semibold leading-[1.15] tracking-[-0.03em] xl:text-4xl">
              Your teams, leave, and hiring stay where you left them.
            </h2>
            <p className="text-base leading-relaxed text-white/78 xl:text-lg">
              Unlock to pick up admin work across employees, applicants, and
              operations without starting a new session.
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm tracking-wide text-white/55">
            <span title={APP_VERSION_TITLE} aria-label={APP_VERSION_TITLE}>
              {APP_VERSION_LABEL}
            </span>
            <span aria-hidden className="text-white/35">
              ·
            </span>
            <span>Admin Console</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
