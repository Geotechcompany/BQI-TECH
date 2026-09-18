"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const METHOD_OPTIONS: {
  id: Admin2faMethod;
  label: string;
  description: string;
  icon: typeof Smartphone;
}[] = [
  {
    id: "totp",
    label: "Authenticator",
    description: "Code from your authenticator app",
    icon: Smartphone,
  },
  {
    id: "email",
    label: "Email code",
    description: "One-time code sent to your email",
    icon: Mail,
  },
  {
    id: "recovery",
    label: "Recovery code",
    description: "One of your saved backup codes",
    icon: ShieldCheck,
  },
];

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

  const methodOptions = useMemo(
    () => METHOD_OPTIONS.filter((option) => available.includes(option.id)),
    [available]
  );

  const canSwitchMethod = methodOptions.length > 1;

  useEffect(() => {
    setMethod(defaultMethod);
  }, [defaultMethod]);

  useEffect(() => {
    if (method === "email" && !emailSent) {
      void handleSendEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const selectMethod = (next: Admin2faMethod) => {
    if (next === method) return;
    setMethod(next);
    setCode("");
  };

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

        {canSwitchMethod ? (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Method unavailable? Use another
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-64">
                {methodOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = method === option.id;
                  return (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => selectMethod(option.id)}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 py-2.5",
                        isActive && "bg-accent/60"
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-none">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                      {isActive ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
