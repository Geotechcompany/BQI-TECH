import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

type RelayPayload = {
  to?: string;
  subject?: string;
  html?: string;
  from?: string;
  sendgridApiKey?: string;
};

/**
 * Internal email relay for the Python backend (Render).
 * Runs as a Netlify serverless function — uses HTTPS instead of SMTP.
 *
 * Credentials are passed from admin settings via the backend request body.
 */
export async function POST(request: NextRequest) {
  let body: RelayPayload;
  try {
    body = (await request.json()) as RelayPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey =
    body.sendgridApiKey?.trim() || process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "SendGrid API key is required. Configure it in Admin → Settings → Email delivery.",
      },
      { status: 503 }
    );
  }

  const to = body.to?.trim();
  const subject = body.subject?.trim();
  const html = body.html?.trim();
  const from =
    body.from?.trim() ||
    process.env.FROM_EMAIL?.trim() ||
    "hr@bqitech.com";

  if (!to || !subject || !html) {
    return NextResponse.json(
      { error: "to, subject, and html are required" },
      { status: 400 }
    );
  }

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to,
      from: { email: from, name: "BQI Tech" },
      subject,
      html,
    });
    return NextResponse.json({ ok: true, message: `Email sent to ${to}` });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to send email via SendGrid";
    console.error("Email relay error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
