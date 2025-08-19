"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminHelpPage() {
  const baseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000",
    []
  );

  return (
    <AdminPageLayout title="Help & Documentation" showSearch={false}>
      <div className="space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl p-8 sm:p-10 bg-gradient-to-r from-[#272055] via-[#1c2a6b] to-[#31CDFF] text-white">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">Admin</Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">API</Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">Guides</Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">Build, Operate, and Troubleshoot with Confidence</h1>
            <p className="mt-3 text-blue-100 max-w-3xl">
              Central knowledge base for BQI Tech administrators. Learn the platform, explore the
              API, and resolve issues faster.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/overview"><Button className="bg-white text-[#272055] hover:bg-white/90">Go to Dashboard</Button></Link>
              <a href="#api"><Button variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 focus-visible:ring-white/50">Jump to API</Button></a>
              <Link href="/admin/settings"><Button variant="ghost" className="text-white hover:bg-white/10">Settings</Button></Link>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 border-blue-100/60">
            <h3 className="font-semibold mb-1">Getting Started</h3>
            <p className="text-sm text-muted-foreground mb-3">Environment, auth, and first calls.</p>
            <a href="#environment" className="text-sm text-blue-600 hover:underline">Read the basics →</a>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-cyan-50 to-white dark:from-slate-900 dark:to-slate-950 border-cyan-100/60">
            <h3 className="font-semibold mb-1">Admin API</h3>
            <p className="text-sm text-muted-foreground mb-3">Applications, jobs, notifications.</p>
            <a href="#api" className="text-sm text-blue-600 hover:underline">View endpoints →</a>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 border-indigo-100/60">
            <h3 className="font-semibold mb-1">Troubleshooting</h3>
            <p className="text-sm text-muted-foreground mb-3">Common errors and fixes.</p>
            <a href="#troubleshoot" className="text-sm text-blue-600 hover:underline">Fix issues →</a>
          </Card>
        </div>

        <Card id="environment" className="p-6 space-y-4">
          <h3 className="text-xl font-semibold">Environment</h3>
          <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
            <li>
              Base URL: <code className="text-foreground">{baseUrl}</code>
            </li>
            <li>
              Admin API prefix: <code className="text-foreground">/api/admin</code>
            </li>
            <li>
              Public API prefix: <code className="text-foreground">/api</code>
            </li>
            <li>
              Auth: Bearer JWT via the <code>Authorization</code> header
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-5">
          <h3 className="text-xl font-semibold">Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Admin endpoints require a valid access token. The frontend stores
            this in the AuthService and automatically attaches it to requests.
            When integrating externally, pass the token in the header:
          </p>
          <pre className="rounded-md bg-muted p-4 overflow-auto text-sm"><code>{`GET ${baseUrl}/api/admin/overview
Authorization: Bearer <token>
Accept: application/json`}</code></pre>
        </Card>

        <Card id="api" className="p-6 space-y-5">
          <h3 className="text-xl font-semibold">Key Admin Endpoints</h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">Overview</h4>
              <pre className="rounded-md bg-muted p-4 overflow-auto"><code>{`GET ${baseUrl}/api/admin/overview`}</code></pre>
            </div>
            <div>
              <h4 className="font-medium">Applications</h4>
              <pre className="rounded-md bg-muted p-4 overflow-auto"><code>{`GET    ${baseUrl}/api/admin/applications?skip=0&limit=10
GET    ${baseUrl}/api/admin/applications/{id}
PUT    ${baseUrl}/api/admin/applications/{id}
DELETE ${baseUrl}/api/admin/applications/bulk`}</code></pre>
            </div>
            <div>
              <h4 className="font-medium">Job Postings</h4>
              <pre className="rounded-md bg-muted p-4 overflow-auto"><code>{`GET    ${baseUrl}/api/admin/job-postings
GET    ${baseUrl}/api/admin/job-postings/{id}
POST   ${baseUrl}/api/admin/job-postings
PUT    ${baseUrl}/api/admin/job-postings/{id}
PATCH  ${baseUrl}/api/admin/job-postings/{id}/toggle-status
DELETE ${baseUrl}/api/admin/job-postings/{id}`}</code></pre>
            </div>
            <div>
              <h4 className="font-medium">Notifications</h4>
              <pre className="rounded-md bg-muted p-4 overflow-auto"><code>{`GET  ${baseUrl}/api/admin/notifications
PUT  ${baseUrl}/api/admin/notifications/{id}/read
DEL  ${baseUrl}/api/admin/notifications/{id}`}</code></pre>
            </div>
            <div>
              <h4 className="font-medium">Public Jobs</h4>
              <pre className="rounded-md bg-muted p-4 overflow-auto"><code>{`GET ${baseUrl}/api/jobs
GET ${baseUrl}/api/jobs/{id}`}</code></pre>
            </div>
          </div>

          {/* Sample requests */}
          <Tabs defaultValue="fetch" className="mt-4">
            <TabsList>
              <TabsTrigger value="fetch">fetch</TabsTrigger>
              <TabsTrigger value="axios">axios</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="fetch">
              <pre className="rounded-md bg-muted p-4 overflow-auto text-xs"><code>{`await fetch('${baseUrl}/api/admin/job-postings', {
  headers: { Authorization: 'Bearer TOKEN', Accept: 'application/json' }
}).then(r => r.json())`}</code></pre>
            </TabsContent>
            <TabsContent value="axios">
              <pre className="rounded-md bg-muted p-4 overflow-auto text-xs"><code>{`import axios from 'axios';
const res = await axios.get('${baseUrl}/api/admin/overview', {
  headers: { Authorization: 'Bearer TOKEN' }
});`}</code></pre>
            </TabsContent>
            <TabsContent value="curl">
              <pre className="rounded-md bg-muted p-4 overflow-auto text-xs"><code>{`curl -H "Authorization: Bearer TOKEN" \
  -H "Accept: application/json" \
  ${baseUrl}/api/admin/overview`}</code></pre>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-6 space-y-5">
          <h3 className="text-xl font-semibold">cURL Examples</h3>
          <pre className="rounded-md bg-muted p-4 overflow-auto text-xs"><code>{`# Get overview (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
     -H "Accept: application/json" \
     ${baseUrl}/api/admin/overview

# Create job
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Engineer","department":"Tech","location":"Nairobi","description":"..."}' \
  ${baseUrl}/api/admin/job-postings`}</code></pre>
        </Card>

        <Card id="troubleshoot" className="p-6 space-y-5">
          <h3 className="text-xl font-semibold">Troubleshooting</h3>
          <ul className="list-disc ml-6 space-y-2 text-sm text-muted-foreground">
            <li>401 Unauthorized: refresh your token or re-login.</li>
            <li>
              404 Not Found: verify the endpoint path (admin vs public) and the
              resource ID.
            </li>
            <li>
              400/500 on updates: ensure you are not sending immutable fields
              like <code>_id</code> in the payload.
            </li>
          </ul>
        </Card>

        <div className="flex items-center gap-3">
          <Link href="/admin/settings">
            <Button variant="secondary">Go to Settings</Button>
          </Link>
          <Link href="/admin/overview">
            <Button variant="outline">Back to Overview</Button>
          </Link>
        </div>
      </div>
    </AdminPageLayout>
  );
}


