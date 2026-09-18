"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmAdminTotpSetup,
  enableAdminEmail2fa,
  sendAdmin2faEmailOtp,
  startAdminTotpSetup,
  type Admin2faPolicy,
} from "@/lib/admin-2fa";
import { cn } from "@/lib/utils";

interface AdminTwoFactorSetupProps {
  policy?: Admin2faPolicy;
  emailHint?: string;
  required?: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

type SetupStep =
  | "choose"
  | "totp_scan"
  | "totp_confirm"
  | "recovery"
  | "email_confirm";

export function AdminTwoFactorSetup({
  policy = "require_one",
  emailHint,
  required = true,
  onComplete,
  onSkip,
}: AdminTwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>("choose");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const startTotp = async () => {
    setBusy(true);
    try {
      const enrollment = await startAdminTotpSetup();
      setQrDataUrl(enrollment.qr_data_url);
      setSecret(enrollment.secret);
      setStep("totp_scan");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start authenticator setup"
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await confirmAdminTotpSetup(code.trim());
      setRecoveryCodes(result.recoveryCodes || []);
      setStep("recovery");
      toast.success("Authenticator enabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Incorrect authenticator code"
      );
    } finally {
      setBusy(false);
    }
  };

  const startEmail = async () => {
    setBusy(true);
    try {
      await sendAdmin2faEmailOtp();
      setStep("email_confirm");
      toast.success("Code sent", {
        description: emailHint
          ? `Check ${emailHint}`
          : "Check your email for a 6-digit code.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.error("Enter your password to enable email 2FA");
      return;
    }
    setBusy(true);
    try {
      await enableAdminEmail2fa({
        password: password.trim(),
        code: code.trim(),
      });
      toast.success("Email 2FA enabled");
      onComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not enable email 2FA"
      );
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Secret copied");
    } catch {
      toast.error("Could not copy secret");
    }
  };

  const copyRecovery = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Could not copy codes");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Protect your admin account
        </h2>
        <p className="text-sm text-muted-foreground">
          {required
            ? `Organization policy (${policy.replace("_", " ")}) requires two-factor authentication before you can use the admin dashboard.`
            : "Add an authenticator or email code for stronger account protection."}
        </p>
      </div>

      {step === "choose" ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startTotp()}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary/[0.03]"
            )}
          >
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">
                Authenticator app
              </span>
              <span className="block text-sm text-muted-foreground">
                Recommended — Google Authenticator, 1Password, Authy, etc.
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void startEmail()}
            className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary/[0.03]"
          >
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <Mail className="h-5 w-5" />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">Email one-time code</span>
              <span className="block text-sm text-muted-foreground">
                Receive a 6-digit code at sign-in
                {emailHint ? ` (${emailHint})` : ""}.
              </span>
            </span>
          </button>

          {busy ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing…
            </div>
          ) : null}

          {!required && onSkip ? (
            <Button type="button" variant="ghost" className="w-full" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === "totp_scan" || step === "totp_confirm" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Authenticator QR code"
                className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
              />
            ) : null}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Scan with your authenticator app, or enter the secret manually.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2">
              <code className="flex-1 truncate text-xs tracking-wider">{secret}</code>
              <Button type="button" size="sm" variant="ghost" onClick={() => void copySecret()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <form onSubmit={confirmTotp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp-confirm">6-digit code</Label>
              <Input
                id="totp-confirm"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 rounded-xl text-center text-lg tracking-[0.35em]"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl font-semibold"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                "Enable authenticator"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setStep("choose");
                setCode("");
              }}
            >
              Back
            </Button>
          </form>
        </div>
      ) : null}

      {step === "recovery" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold">Authenticator is on</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Save these recovery codes now — they won&apos;t be shown again.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 font-mono text-sm">
            <ul className="grid gap-2 sm:grid-cols-2">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void copyRecovery()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy recovery codes
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-xl font-semibold"
            onClick={onComplete}
          >
            Continue to admin
          </Button>
        </div>
      ) : null}

      {step === "email_confirm" ? (
        <form onSubmit={confirmEmail} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Enter the code we emailed you, plus your password, to turn on email
              2FA.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-2fa-password">Password</Label>
            <Input
              id="email-2fa-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-2fa-code">Email code</Label>
            <Input
              id="email-2fa-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-xl text-center text-lg tracking-[0.35em]"
              autoComplete="one-time-code"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => void startEmail()}
          >
            Resend code
          </Button>
          <Button
            type="submit"
            className="h-12 w-full rounded-xl font-semibold"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enabling…
              </>
            ) : (
              "Enable email 2FA"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setStep("choose");
              setCode("");
              setPassword("");
            }}
          >
            Back
          </Button>
        </form>
      ) : null}
    </div>
  );
}
