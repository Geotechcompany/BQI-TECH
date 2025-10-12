import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { sendBulkEmails } from "@/lib/bulkEmail";

type Payload = {
  mode: "all" | "list";
  recipients?: string[];
  subject: string;
  body: string;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof Response) return authResult;

  try {
    const body = (await request.json()) as Payload;
    const { mode, recipients = [], subject, body: html, dryRun } = body;

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: "subject and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let to: string[] = recipients;

    if (mode === "all") {
      const { db } = await connectToDatabase();
      const users = await db
        .collection("users")
        .find(
          { email: { $exists: true, $ne: null } },
          { projection: { email: 1 } }
        )
        .toArray();
      to = users.map((u: any) => u.email).filter(Boolean);
    } else if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide recipients when mode=list" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await sendBulkEmails({
      recipients: to,
      subject,
      body: html,
      dryRun,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Failed to send emails" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
