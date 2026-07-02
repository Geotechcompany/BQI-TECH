"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSkeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-backend";
import { toast } from "react-hot-toast";
import {
  Cloud,
  Database,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Clock,
} from "lucide-react";

type BackupDestination = {
  enabled: boolean;
  collections?: string[];
  folderPath?: string;
  userEmail?: string;
  includeDatabaseExport?: boolean;
};

type BackupCredentials = {
  dbSyncTargetUriPreview?: string;
  hasDbSyncTargetUri?: boolean;
  azureTenantId?: string;
  azureClientId?: string;
  hasAzureClientSecret?: boolean;
  dropboxAppKey?: string;
  hasDropboxAppSecret?: boolean;
  hasDropboxRefreshToken?: boolean;
  hasDropboxAccessToken?: boolean;
  mongodbReplicaConfigured?: boolean;
  oneDriveConfigured?: boolean;
  dropboxConfigured?: boolean;
};

type BackupConfig = {
  enabled: boolean;
  schedulePreset: string;
  schedule: {
    mode: string;
    intervalMinutes: number;
    cronExpression: string;
    timezone: string;
  };
  destinations: {
    mongodbReplica: BackupDestination;
    oneDrive: BackupDestination;
    dropbox: BackupDestination;
  };
  retention: { keepRunHistoryDays: number };
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  lastRunMessage?: string | null;
  nextRunAt?: string | null;
  environment?: {
    mongodbReplicaConfigured?: boolean;
    oneDriveConfigured?: boolean;
    dropboxConfigured?: boolean;
  };
};

type BackupRun = {
  id: string;
  status: string;
  message?: string;
  trigger?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

const COLLECTION_OPTIONS = [
  "users",
  "applications",
  "jobpostings",
  "jobquestions",
  "settings",
  "notifications",
  "user_notifications",
  "email_campaigns",
  "email_logs",
  "admin_invites",
  "backup_runs",
];

const PRESET_LABELS: Record<string, string> = {
  off: "Off (manual only)",
  hourly: "Every hour",
  every_6h: "Every 6 hours",
  every_12h: "Every 12 hours",
  daily_2am: "Daily at 2:00 AM UTC",
  weekly_sunday: "Weekly (Sunday 3:00 AM UTC)",
  custom: "Custom cron expression",
};

function statusBadge(status?: string | null) {
  const value = (status || "unknown").toLowerCase();
  if (value === "success") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Success</Badge>;
  }
  if (value === "partial") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Partial</Badge>;
  }
  if (value === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function BackupPageContent() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [credentials, setCredentials] = useState<BackupCredentials | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    dbSyncTargetUri: "",
    azureTenantId: "",
    azureClientId: "",
    azureClientSecret: "",
    dropboxAppKey: "",
    dropboxAppSecret: "",
    dropboxRefreshToken: "",
    dropboxAccessToken: "",
  });
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const [settingsRes, runsRes, credentialsRes] = await Promise.all([
        adminApi.getBackupSettings(),
        adminApi.getBackupRuns({ limit: 15 }),
        adminApi.getBackupCredentials(),
      ]);
      setConfig((settingsRes as any).config);
      setRuns((runsRes as any).runs ?? []);
      const loadedCredentials = (credentialsRes as any).credentials ?? {};
      setCredentials(loadedCredentials);
      setCredentialForm((current) => ({
        ...current,
        azureTenantId: loadedCredentials.azureTenantId ?? "",
        azureClientId: loadedCredentials.azureClientId ?? "",
        dropboxAppKey: loadedCredentials.dropboxAppKey ?? "",
      }));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load backup settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDestination = (
    key: keyof BackupConfig["destinations"],
    patch: Partial<BackupDestination>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      destinations: {
        ...config.destinations,
        [key]: { ...config.destinations[key], ...patch },
      },
    });
  };

  const toggleCollection = (name: string) => {
    if (!config) return;
    const current = config.destinations.mongodbReplica.collections ?? [];
    const next = current.includes(name)
      ? current.filter((c) => c !== name)
      : [...current, name];
    updateDestination("mongodbReplica", { collections: next });
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const res = await adminApi.updateBackupSettings({
        enabled: config.enabled,
        schedulePreset: config.schedulePreset,
        schedule: config.schedule,
        destinations: config.destinations,
        retention: config.retention,
      });
      setConfig((res as any).config);
      toast.success("Backup schedule and destinations saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save backup settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    setIsSavingCredentials(true);
    try {
      const payload: Record<string, string> = {};
      if (credentialForm.dbSyncTargetUri.trim()) {
        payload.dbSyncTargetUri = credentialForm.dbSyncTargetUri.trim();
      }
      if (credentialForm.azureTenantId.trim()) {
        payload.azureTenantId = credentialForm.azureTenantId.trim();
      }
      if (credentialForm.azureClientId.trim()) {
        payload.azureClientId = credentialForm.azureClientId.trim();
      }
      if (credentialForm.azureClientSecret.trim()) {
        payload.azureClientSecret = credentialForm.azureClientSecret.trim();
      }
      if (credentialForm.dropboxAppKey.trim()) {
        payload.dropboxAppKey = credentialForm.dropboxAppKey.trim();
      }
      if (credentialForm.dropboxAppSecret.trim()) {
        payload.dropboxAppSecret = credentialForm.dropboxAppSecret.trim();
      }
      if (credentialForm.dropboxRefreshToken.trim()) {
        payload.dropboxRefreshToken = credentialForm.dropboxRefreshToken.trim();
      }
      if (credentialForm.dropboxAccessToken.trim()) {
        payload.dropboxAccessToken = credentialForm.dropboxAccessToken.trim();
      }

      if (Object.keys(payload).length === 0) {
        toast.error("Enter at least one credential value to save");
        return;
      }

      const res = await adminApi.updateBackupCredentials(payload);
      const saved = (res as any).credentials ?? {};
      setCredentials(saved);
      setCredentialForm((current) => ({
        ...current,
        dbSyncTargetUri: "",
        azureClientSecret: "",
        dropboxAppSecret: "",
        dropboxRefreshToken: "",
        dropboxAccessToken: "",
        azureTenantId: saved.azureTenantId ?? current.azureTenantId,
        azureClientId: saved.azureClientId ?? current.azureClientId,
        dropboxAppKey: saved.dropboxAppKey ?? current.dropboxAppKey,
      }));
      await load();
      toast.success("Integration credentials saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save credentials");
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      const res = await adminApi.runBackup();
      const result = (res as any).result;
      const status = result?.status;
      const message = result?.message || (res as any).message;
      if (status === "success") {
        toast.success(message || "Backup completed successfully");
      } else if (status === "partial") {
        toast.error(message || "Backup completed with warnings");
      } else {
        toast.error(message || "Backup failed");
      }
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to run backup");
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading || !config) {
    return (
      <AdminPageLayout title="Backup & Recovery" showSearch={false}>
        <div className="mx-auto max-w-screen-2xl px-4 pb-8">
          <FormSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  const env = credentials ?? config.environment ?? {};

  return (
    <AdminPageLayout
      title="Backup & Recovery"
      showSearch={false}
      headerActions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleRunNow} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run backup now
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 pb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Schedule
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure automated off-site backups. The server checks every minute
                and runs when the next run time is due.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="backup-enabled">Enabled</Label>
              <Switch
                id="backup-enabled"
                checked={config.enabled}
                onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={config.schedulePreset}
                  onValueChange={(schedulePreset) =>
                    setConfig({ ...config, schedulePreset })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Run history retention (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.retention?.keepRunHistoryDays ?? 30}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      retention: {
                        keepRunHistoryDays: Number(e.target.value) || 30,
                      },
                    })
                  }
                />
              </div>
            </div>

            {config.schedulePreset === "custom" && (
              <div className="space-y-2">
                <Label>Cron expression (UTC)</Label>
                <Input
                  value={config.schedule.cronExpression}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      schedule: {
                        ...config.schedule,
                        mode: "cron",
                        cronExpression: e.target.value,
                      },
                    })
                  }
                  placeholder="0 2 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Five-field cron: minute hour day month weekday. Example:{" "}
                  <code>0 2 * * *</code> = daily at 2:00 AM UTC.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <span className="text-muted-foreground">Last run: </span>
                {formatWhen(config.lastRunAt)}{" "}
                {config.lastRunStatus && statusBadge(config.lastRunStatus)}
              </div>
              <div>
                <span className="text-muted-foreground">Next run: </span>
                {config.enabled ? formatWhen(config.nextRunAt) : "—"}
              </div>
            </div>
            {config.lastRunMessage && (
              <p className="text-sm text-muted-foreground">{config.lastRunMessage}</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                MongoDB replica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable replica sync</Label>
                <Switch
                  checked={config.destinations.mongodbReplica.enabled}
                  onCheckedChange={(enabled) =>
                    updateDestination("mongodbReplica", { enabled })
                  }
                />
              </div>
              <Badge variant={env.mongodbReplicaConfigured ? "outline" : "destructive"}>
                {env.mongodbReplicaConfigured
                  ? credentials?.dbSyncTargetUriPreview || "MongoDB sync URI configured"
                  : "MongoDB sync URI not configured"}
              </Badge>
              <div className="space-y-2">
                <Label>MongoDB sync URI</Label>
                <Input
                  type="password"
                  value={credentialForm.dbSyncTargetUri}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      dbSyncTargetUri: e.target.value,
                    }))
                  }
                  placeholder={
                    credentials?.hasDbSyncTargetUri
                      ? "Saved — enter a new URI to replace"
                      : "mongodb+srv://user:pass@cluster.mongodb.net/BQITECH-DEV"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Collections</Label>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {COLLECTION_OPTIONS.map((name) => {
                    const selected =
                      config.destinations.mongodbReplica.collections?.includes(
                        name
                      );
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleCollection(name)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="h-4 w-4" />
                Microsoft OneDrive
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable OneDrive export</Label>
                <Switch
                  checked={config.destinations.oneDrive.enabled}
                  onCheckedChange={(enabled) =>
                    updateDestination("oneDrive", { enabled })
                  }
                />
              </div>
              <Badge variant={env.oneDriveConfigured ? "outline" : "destructive"}>
                {env.oneDriveConfigured
                  ? "Azure app credentials configured"
                  : "Azure credentials not configured"}
              </Badge>
              <div className="space-y-2">
                <Label>Azure tenant ID</Label>
                <Input
                  value={credentialForm.azureTenantId}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      azureTenantId: e.target.value,
                    }))
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Azure client ID</Label>
                <Input
                  value={credentialForm.azureClientId}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      azureClientId: e.target.value,
                    }))
                  }
                  placeholder="Application (client) ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Azure client secret</Label>
                <Input
                  type="password"
                  value={credentialForm.azureClientSecret}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      azureClientSecret: e.target.value,
                    }))
                  }
                  placeholder={
                    credentials?.hasAzureClientSecret
                      ? "Saved — enter a new secret to replace"
                      : "Client secret value"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Microsoft 365 user email</Label>
                <Input
                  type="email"
                  value={config.destinations.oneDrive.userEmail ?? ""}
                  onChange={(e) =>
                    updateDestination("oneDrive", { userEmail: e.target.value })
                  }
                  placeholder="hr@bqitech.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Folder path</Label>
                <Input
                  value={config.destinations.oneDrive.folderPath ?? "/BQI-Backups"}
                  onChange={(e) =>
                    updateDestination("oneDrive", { folderPath: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Exports selected MongoDB collections as JSON to the user&apos;s
                OneDrive. Requires Graph API app permission Files.ReadWrite.All.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                Dropbox
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Dropbox export</Label>
                <Switch
                  checked={config.destinations.dropbox.enabled}
                  onCheckedChange={(enabled) =>
                    updateDestination("dropbox", { enabled })
                  }
                />
              </div>
              <Badge variant={env.dropboxConfigured ? "outline" : "destructive"}>
                {env.dropboxConfigured
                  ? "Dropbox credentials configured"
                  : "Dropbox credentials not configured"}
              </Badge>
              <div className="space-y-2">
                <Label>Dropbox app key</Label>
                <Input
                  value={credentialForm.dropboxAppKey}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      dropboxAppKey: e.target.value,
                    }))
                  }
                  placeholder="App key"
                />
              </div>
              <div className="space-y-2">
                <Label>Dropbox app secret</Label>
                <Input
                  type="password"
                  value={credentialForm.dropboxAppSecret}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      dropboxAppSecret: e.target.value,
                    }))
                  }
                  placeholder={
                    credentials?.hasDropboxAppSecret
                      ? "Saved — enter a new secret to replace"
                      : "App secret"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dropbox refresh token</Label>
                <Input
                  type="password"
                  value={credentialForm.dropboxRefreshToken}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      dropboxRefreshToken: e.target.value,
                    }))
                  }
                  placeholder={
                    credentials?.hasDropboxRefreshToken
                      ? "Saved — enter a new token to replace"
                      : "Refresh token (recommended)"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dropbox access token (optional)</Label>
                <Input
                  type="password"
                  value={credentialForm.dropboxAccessToken}
                  onChange={(e) =>
                    setCredentialForm((current) => ({
                      ...current,
                      dropboxAccessToken: e.target.value,
                    }))
                  }
                  placeholder={
                    credentials?.hasDropboxAccessToken
                      ? "Saved — enter a new token to replace"
                      : "Long-lived access token fallback"
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use refresh token + app key/secret, or a single access token.
              </p>
              <div className="space-y-2">
                <Label>Folder path</Label>
                <Input
                  value={config.destinations.dropbox.folderPath ?? "/BQI-Backups"}
                  onChange={(e) =>
                    updateDestination("dropbox", { folderPath: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleSaveCredentials}
            disabled={isSavingCredentials}
          >
            {isSavingCredentials ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save credentials
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save backup settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent backup runs</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No backup runs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Started</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Trigger</th>
                      <th className="py-2 pr-4">Duration</th>
                      <th className="py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-b border-border/50">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {formatWhen(run.startedAt)}
                        </td>
                        <td className="py-3 pr-4">{statusBadge(run.status)}</td>
                        <td className="py-3 pr-4 capitalize">{run.trigger}</td>
                        <td className="py-3 pr-4">
                          {run.durationMs != null
                            ? `${Math.round(run.durationMs / 1000)}s`
                            : "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {run.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
}

export default function BackupPage() {
  return (
    <ProtectedRoute requireAdmin>
      <BackupPageContent />
    </ProtectedRoute>
  );
}
