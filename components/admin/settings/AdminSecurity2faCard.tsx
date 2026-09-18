"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Shield,
  Smartphone,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  confirmAdminTotpSetup,
  disableAdminEmail2fa,
  disableAdminTotp,
  enableAdminEmail2fa,
  fetchAdmin2faStatus,
  policyLabel,
  sendAdmin2faEmailOtp,
  startAdminTotpSetup,
  type Admin2faPolicy,
  type Admin2faStatus,
} from "@/lib/admin-2fa";
import { adminApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";

interface AdminSecurity2faCardProps {
  canEditPolicy?: boolean;
  initialPolicy?: Admin2faPolicy;
  onPolicySaved?: (policy: Admin2faPolicy) => void;
}

export function AdminSecurity2faCard({
  canEditPolicy = false,
  initialPolicy,
  onPolicySaved,
}: AdminSecurity2faCardProps) {
  const [status, setStatus] = useState<Admin2faStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Admin2faPolicy>(
    initialPolicy || "require_one"
  );
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [totpQr, setTotpQr] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [enrollingTotp, setEnrollingTotp] = useState(false);

  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAdmin2faStatus();
      setStatus(next);
      setPolicy(next.policy);
    } catch (error) {
      console.error(error);
      toast.error("Could not load 2FA status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePolicy = async () => {
    if (!canEditPolicy) return;
    setSavingPolicy(true);
    try {
      await adminApi.updateSettings({ admin_2fa_policy: policy });
      toast.success("2FA policy updated");
      onPolicySaved?.(policy);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not update policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const beginTotp = async () => {
    setBusyAction("totp-start");
    try {
      const enrollment = await startAdminTotpSetup();
      setTotpQr(enrollment.qr_data_url);
      setTotpSecret(enrollment.secret);
      setEnrollingTotp(true);
      setRecoveryCodes([]);
      setTotpCode("");
    } catch (error: any) {
      toast.error(error?.message || "Could not start authenticator setup");
    } finally {
      setBusyAction(null);
    }
  };

  const confirmTotp = async () => {
    setBusyAction("totp-confirm");
    try {
      const result = await confirmAdminTotpSetup(totpCode.trim());
      setRecoveryCodes(result.recoveryCodes || []);
      setEnrollingTotp(false);
      setTotpQr("");
      setTotpSecret("");
      setTotpCode("");
      toast.success("Authenticator enabled");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Incorrect code");
    } finally {
      setBusyAction(null);
    }
  };

  const turnOffTotp = async () => {
    if (!password || !disableCode) {
      toast.error("Password and authenticator/recovery code are required");
      return;
    }
    setBusyAction("totp-disable");
    try {
      await disableAdminTotp({ password, code: disableCode });
      toast.success("Authenticator disabled");
      setPassword("");
      setDisableCode("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not disable authenticator");
    } finally {
      setBusyAction(null);
    }
  };

  const sendEmailCode = async () => {
    setBusyAction("email-send");
    try {
      await sendAdmin2faEmailOtp();
      toast.success("Email code sent");
    } catch (error: any) {
      toast.error(error?.message || "Could not send email code");
    } finally {
      setBusyAction(null);
    }
  };

  const turnOnEmail = async () => {
    if (!password || !emailCode) {
      toast.error("Password and email code are required");
      return;
    }
    setBusyAction("email-enable");
    try {
      await enableAdminEmail2fa({ password, code: emailCode });
      toast.success("Email 2FA enabled");
      setPassword("");
      setEmailCode("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not enable email 2FA");
    } finally {
      setBusyAction(null);
    }
  };

  const turnOffEmail = async () => {
    if (!password) {
      toast.error("Password is required");
      return;
    }
    setBusyAction("email-disable");
    try {
      await disableAdminEmail2fa({
        password,
        code: emailCode || undefined,
      });
      toast.success("Email 2FA disabled");
      setPassword("");
      setEmailCode("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not disable email 2FA");
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading security factors…
      </div>
    );
  }

  const totpOn = Boolean(status?.totpEnabled);
  const emailOn = Boolean(status?.email2faEnabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Two-factor authentication</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            {status?.satisfied ? (
              <span className="text-emerald-600">Policy satisfied</span>
            ) : (
              <span className="text-amber-600">Action required</span>
            )}
            {" · "}
            {policyLabel(status?.policy || policy)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={totpOn ? "default" : "secondary"}>
            Authenticator {totpOn ? "on" : "off"}
          </Badge>
          <Badge variant={emailOn ? "default" : "secondary"}>
            Email {emailOn ? "on" : "off"}
          </Badge>
        </div>
      </div>

      {canEditPolicy ? (
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <Label>Organization 2FA policy</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={policy}
              onValueChange={(value) => setPolicy(value as Admin2faPolicy)}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prompt">Prompt (optional)</SelectItem>
                <SelectItem value="require_one">
                  Require at least one factor
                </SelectItem>
                <SelectItem value="require_both">
                  Require authenticator + email
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => void savePolicy()}
              disabled={savingPolicy || policy === status?.policy}
            >
              {savingPolicy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save policy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Required policies fail closed — admins cannot use the dashboard until
            factors are enrolled and verified at sign-in.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Current policy: {policyLabel(status?.policy || policy)}. Only super
          admins can change it.
        </p>
      )}

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          <p className="text-sm font-medium">Authenticator app</p>
        </div>

        {!totpOn && !enrollingTotp ? (
          <Button
            type="button"
            onClick={() => void beginTotp()}
            disabled={busyAction === "totp-start"}
          >
            {busyAction === "totp-start" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Set up authenticator
          </Button>
        ) : null}

        {enrollingTotp ? (
          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            {totpQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={totpQr}
                alt="Authenticator QR"
                className="h-40 w-40 rounded-lg bg-white p-2"
              />
            ) : null}
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">{totpSecret}</code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard.writeText(totpSecret).then(() =>
                    toast.success("Secret copied")
                  )
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-w-xs space-y-2">
              <Label>Confirm with 6-digit code</Label>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                className="tracking-[0.3em]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void confirmTotp()}
                disabled={busyAction === "totp-confirm"}
              >
                Enable
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEnrollingTotp(false);
                  setTotpQr("");
                  setTotpSecret("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Save recovery codes now
            </div>
            <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
              {recoveryCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() =>
                void navigator.clipboard
                  .writeText(recoveryCodes.join("\n"))
                  .then(() => toast.success("Copied"))
              }
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy codes
            </Button>
          </div>
        ) : null}

        {totpOn ? (
          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">
              Authenticator is enabled
              {typeof status?.recoveryCodesRemaining === "number"
                ? ` · ${status.recoveryCodesRemaining} recovery codes left`
                : ""}
              .
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Authenticator or recovery code</Label>
                <Input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void turnOffTotp()}
              disabled={busyAction === "totp-disable"}
            >
              Disable authenticator
            </Button>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <p className="text-sm font-medium">Email one-time codes</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Email code</Label>
              <div className="flex gap-2">
                <Input
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void sendEmailCode()}
                  disabled={busyAction === "email-send"}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>

          {emailOn ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void turnOffEmail()}
              disabled={busyAction === "email-disable"}
            >
              Disable email 2FA
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void turnOnEmail()}
              disabled={busyAction === "email-enable"}
            >
              Enable email 2FA
            </Button>
          )}
        </div>
      </div>

      {!status?.satisfied ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800"
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Enroll the required factor(s) before leaving this page. Required
          policies block the rest of admin until satisfied.
        </div>
      ) : null}
    </div>
  );
}
