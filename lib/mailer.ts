import { createTransport } from "nodemailer";
import {
  BQI_EMAIL_BRAND,
  getBrandedEmailFooter,
  getBrandedEmailHeader,
  wrapBrandedEmail,
} from "./email-brand";

export async function sendVerificationEmail(email: string, code: string) {
  const transport = createTransport({
    service: "Gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  const content = `
    <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BQI_EMAIL_BRAND.darkBlue};">
      Email Verification Code
    </h1>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${BQI_EMAIL_BRAND.bodyText};">
      Your verification code is:
    </p>
    <div style="background: linear-gradient(135deg, rgba(39,32,85,0.06) 0%, rgba(49,205,255,0.1) 100%); padding: 24px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid rgba(49,205,255,0.25);">
      <strong style="font-size: 28px; letter-spacing: 6px; color: ${BQI_EMAIL_BRAND.darkBlue}; font-family: monospace;">${code}</strong>
    </div>
    <p style="margin: 0; font-size: 14px; color: ${BQI_EMAIL_BRAND.mutedText};">
      This code will expire in 10 minutes.<br />
      If you didn't request this code, please ignore this email.
    </p>
  `;

  const html = wrapBrandedEmail({
    header: getBrandedEmailHeader(),
    footer: getBrandedEmailFooter(),
    accentColor: BQI_EMAIL_BRAND.cyan,
    content,
    preheader: "Your BQI Tech verification code",
  });

  try {
    await transport.sendMail({
      from: `"BQI Technologies" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify Your Email Address – BQI Tech",
      html,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Failed to send verification email");
  }
}
