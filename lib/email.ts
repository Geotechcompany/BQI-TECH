import { BACKEND_URL } from "./config";
import {
  BQI_EMAIL_BRAND,
  getBrandedEmailFooter,
  getBrandedEmailHeader,
  getPrimaryButtonHtml,
  wrapBrandedEmail,
} from "./email-brand";

/**
 * Send HTML email via the Python backend (Microsoft Graph).
 * Nodemailer/SMTP has been removed — Graph must be configured on the API.
 */
export const sendEmail = async (options: {
  to: string;
  subject: string;
  body: string;
}) => {
  if (typeof window !== "undefined") {
    console.log("Email sending is not available on the client-side");
    return;
  }

  const relaySecret = process.env.EMAIL_RELAY_SECRET?.trim() || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (relaySecret) {
    headers["X-Email-Relay-Key"] = relaySecret;
  }

  const response = await fetch(`${BACKEND_URL}/api/internal/send-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: options.to,
      subject: options.subject,
      html: options.body,
      from: process.env.FROM_EMAIL || process.env.BQI_EMAIL_FROM || undefined,
    }),
  });

  if (!response.ok) {
    let detail = "Failed to send email via Microsoft Graph";
    try {
      const data = (await response.json()) as { error?: string; detail?: string };
      detail = data.detail || data.error || detail;
    } catch {
      /* ignore */
    }
    console.error("Email sending error:", detail);
    throw new Error(detail);
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email?token=${token}`;

  const content = `
    <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BQI_EMAIL_BRAND.darkBlue};">
      Email Verification
    </h1>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: ${BQI_EMAIL_BRAND.bodyText};">
      Please click the button below to verify your email address:
    </p>
    ${getPrimaryButtonHtml("Verify Email", verificationLink)}
    <p style="margin: 20px 0 0; font-size: 14px; color: ${BQI_EMAIL_BRAND.mutedText};">
      This link will expire in 1 hour.
    </p>
    <p style="margin: 12px 0 0; font-size: 14px; color: ${BQI_EMAIL_BRAND.mutedText};">
      If you didn't create an account with BQI Tech, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: "Verify Your Email Address – BQI Tech",
    body: wrapBrandedEmail({
      header: getBrandedEmailHeader(),
      footer: getBrandedEmailFooter(),
      accentColor: BQI_EMAIL_BRAND.cyan,
      content,
      preheader: "Verify your BQI Tech email address",
    }),
  });
};

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  const content = `
    <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BQI_EMAIL_BRAND.darkBlue};">
      Password Reset Request
    </h1>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: ${BQI_EMAIL_BRAND.bodyText};">
      We received a request to reset your BQI Tech account password. Click the button below to proceed:
    </p>
    ${getPrimaryButtonHtml("Reset Password", resetUrl)}
    <p style="margin: 20px 0 0; font-size: 14px; color: ${BQI_EMAIL_BRAND.mutedText};">
      This link will expire in 1 hour.
    </p>
    <p style="margin: 12px 0 0; font-size: 14px; color: ${BQI_EMAIL_BRAND.mutedText};">
      If you didn't request this password reset, please ignore this email.
    </p>
  `;

  await sendEmail({
    to: email,
    subject: "BQI Tech Password Reset Request",
    body: wrapBrandedEmail({
      header: getBrandedEmailHeader(),
      footer: getBrandedEmailFooter(),
      accentColor: BQI_EMAIL_BRAND.cyan,
      content,
      preheader: "Reset your BQI Tech password",
    }),
  });
}
