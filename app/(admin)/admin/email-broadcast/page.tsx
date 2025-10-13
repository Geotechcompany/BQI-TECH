"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { authService } from "@/lib/auth-backend";

export default function EmailBroadcastPage() {
  const [mode, setMode] = useState<"all" | "list">("all");
  const [recipients, setRecipients] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const url = `${
        process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000"
      }/api/admin/emails/broadcast`;
      const res = await authService.authenticatedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          recipients:
            mode === "list"
              ? recipients.split(/[\,\n\s]+/).filter(Boolean)
              : [],
          subject,
          body,
        }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ error: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminPageLayout title="Email Broadcast" showSearch={false}>
      <div className="max-w-3xl space-y-4">
        <div className="flex gap-3">
          <Button
            variant={mode === "all" ? "default" : "secondary"}
            onClick={() => setMode("all")}
          >
            All Users
          </Button>
          <Button
            variant={mode === "list" ? "default" : "secondary"}
            onClick={() => setMode("list")}
          >
            Specific Emails
          </Button>
        </div>

        {mode === "list" && (
          <div>
            <label className="text-sm font-medium">
              Recipients (comma, space or newline separated)
            </label>
            <Textarea
              rows={3}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
          />
        </div>

        <div>
          <label className="text-sm font-medium">HTML Body</label>
          <Textarea
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="<h1>Hello</h1>..."
          />
        </div>

        <Button disabled={sending || !subject || !body} onClick={onSend}>
          {sending ? "Sending..." : "Send"}
        </Button>

        {result && (
          <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </AdminPageLayout>
  );
}
