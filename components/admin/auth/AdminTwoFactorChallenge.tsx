"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendAdmin2faEmailOtp,
  verifyAdmin2faChallenge,
  type Admin2faMethod,
} from "@/lib/admin-2fa";
import { cn } from "@/lib/utils";

interface AdminTwoFactorChallengeProps {
  challengeToken: string;
  methods: Admin2faMethod[];
  emailHint?: string;
  onVerified: (tokens: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    user: any;
  }) => Promise<void> | void;
  onCancel: () => void;
}

export function AdminTwoFactorChallenge({
  challengeToken,
  methods,
  emailHint,
  onVerified,
  onCancel,
}: AdminTwoFactorChallengeProps) {
  const available = useMemo(() => {
    const set = new Set(methods.filter(Boolean));
    if (set.has("totp")) set.add("recovery");
    return Array.from(set) as Admin2faMethod[];
  }, [methods]);

  const defaultMethod: Admin2faMethod = available.includes("totp")
    ? "totp"
    : available.includes("email")
      ? "email"
      : "recovery";

  const [method, setMethod] = useState<Admin2faMethod>(defaultMethod);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    setMethod(defaultMethod);
  }, [defaultMethod]);

  useEffect(() => {
    if (method === "email" && !emailSent) {
      void handleSendEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      await sendAdmin2faEmailOtp(challengeToken);
      setEmailSent(true);
      toast.success("Code sent", {
        description: emailHint
          ? `Check ${emailHint} for a 6-digit code.`
          : "Check your email for a 6-digit code.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send code");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter your verification code");
      return;
    }
    setIsSubmitting(true);
    try {
      const tokens = await verifyAdmin2faChallenge({
        challenge_token: challengeToken,
        method,
        code: trimmed,
      });
      await onVerified(tokens as any);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That code is incorrect"
      );
      setIsSubmitting(false);
    }
  };

  const methodTabs: { id: Admin2faMethod; label: string; icon: typeof Smartphone }[] =
    [];
  if (available.includes("totp")) {
    methodTabs.push({ id: "totp", label: "Authenticator", icon: Smartphone });
  }
  if (available.includes("email")) {
    methodTabs.push({ id: "email", label: "Email code", icon: Mail });
  }
  if (available.includes("totp")) {
    methodTabs.push({ id: "recovery", label: "Recovery", icon: ShieldCheck });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Two-factor verification
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter a code to finish signing in
          {emailHint ? ` as ${emailHint}` : ""}.
        </p>
      </div>

      {methodTabs.length > 1 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methodTabs.map((tab) => {
            const Icon = tab.icon;
            const active = method === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMethod(tab.id);
                  setCode("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/70 text-muted-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-2fa-code">
            {method === "recovery"
              ? "Recovery code"
              : method === "email"
                ? "Email code"
                : "Authenticator code"}
          </Label>
          <Input
            id="admin-2fa-code"
            inputMode={method === "recovery" ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={method === "recovery" ? "XXXX-XXXX" : "000000"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-12 rounded-xl text-center text-lg tracking-[0.35em]"
            maxLength={method === "recovery" ? 20 : 6}
            autoFocus
          />
        </div>

        {method === "email" ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full"
            disabled={isSending}
            onClick={() => void handleSendEmail()}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Resend email code"
            )}
          </Button>
        ) : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl text-base font-semibold"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify and continue"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Back to sign in
        </Button>
      </form>
    </div>
  );
}
