/** BQI Tech brand tokens and HTML fragments for transactional emails. */

export const BQI_EMAIL_BRAND = {
  darkBlue: "#272055",
  cyan: "#31CDFF",
  accentBlue: "#2563EB",
  adminBg: "#2B2B2B",
  adminSurface: "#363636",
  adminText: "#FFFFFF",
  adminMuted: "#D1D5DB",
  adminAccent: "#94A3FF",
  bodyText: "#334155",
  mutedText: "#64748B",
  lightBg: "#F8FAFC",
  border: "#E2E8F0",
} as const;

function resolveBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://bqitech.com"
  ).replace(/\/$/, "");
}

export function getLogoUrl(variant: "light" | "dark" = "dark"): string {
  const base = resolveBaseUrl();
  return variant === "light" ? `${base}/bqilogo.png` : `${base}/bqilogo-light.png`;
}

/** Gradient header block for inline HTML email bodies (broadcast editor). */
export function getBrandedEmailHeaderBlock(): string {
  const logoUrl = getLogoUrl("dark");
  return `
    <div style="background: linear-gradient(135deg, ${BQI_EMAIL_BRAND.darkBlue} 0%, ${BQI_EMAIL_BRAND.cyan} 100%); padding: 30px 20px; text-align: center; margin-bottom: 30px;">
      <img src="${logoUrl}" alt="BQI Tech Logo" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
      <div style="color: white; font-size: 14px; opacity: 0.9;">bqitech.com</div>
    </div>
  `;
}

export function getBrandedEmailFooterBlock(): string {
  const logoUrl = getLogoUrl("dark");
  const year = new Date().getFullYear();

  return `
    <div style="background-color: ${BQI_EMAIL_BRAND.lightBg}; padding: 30px 20px; text-align: center; margin-top: 40px; border-top: 3px solid ${BQI_EMAIL_BRAND.cyan};">
      <div style="margin-bottom: 20px;">
        <img src="${logoUrl}" alt="BQI Tech Logo" style="max-width: 120px; height: auto; opacity: 0.85;" />
      </div>
      <div style="color: ${BQI_EMAIL_BRAND.bodyText}; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
        <strong>BQI Technologies</strong><br />
        Empowering businesses through innovative technology solutions
      </div>
      <div style="color: ${BQI_EMAIL_BRAND.mutedText}; font-size: 12px; margin-bottom: 20px;">
        Visit us at <a href="https://bqitech.com" style="color: ${BQI_EMAIL_BRAND.cyan}; text-decoration: none;">bqitech.com</a>
      </div>
      <div style="color: ${BQI_EMAIL_BRAND.mutedText}; font-size: 12px;">
        Best regards,<br />
        <strong>The BQI Tech Team</strong>
      </div>
      <p style="margin: 16px 0 0; color: ${BQI_EMAIL_BRAND.mutedText}; font-size: 11px;">
        © ${year} BQI Tech. All rights reserved.
      </p>
    </div>
  `;
}

/** Gradient header for public-facing emails (applications, careers, etc.). */
export function getBrandedEmailHeader(): string {
  const logoUrl = getLogoUrl("dark");
  return `
    <tr>
      <td style="background: linear-gradient(135deg, ${BQI_EMAIL_BRAND.darkBlue} 0%, ${BQI_EMAIL_BRAND.cyan} 100%); padding: 32px 40px; text-align: center;">
        <img src="${logoUrl}" alt="BQI Tech" width="160" style="width: 160px; max-width: 100%; height: auto; display: block; margin: 0 auto 12px;" />
        <div style="color: rgba(255,255,255,0.9); font-size: 13px; letter-spacing: 0.04em;">bqitech.com</div>
      </td>
    </tr>
  `;
}

/** Dark admin header matching the admin workspace email style. */
export function getAdminEmailHeader(): string {
  const logoUrl = getLogoUrl("dark");
  return `
    <tr>
      <td style="background: ${BQI_EMAIL_BRAND.adminBg}; padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(148,163,255,0.15);">
        <img src="${logoUrl}" alt="BQI Tech" width="150" style="width: 150px; max-width: 100%; height: auto; display: block; margin: 0 auto 10px;" />
        <div style="margin-top: 6px; font-size: 11px; color: ${BQI_EMAIL_BRAND.adminMuted}; letter-spacing: 0.1em; text-transform: uppercase;">
          Admin Workspace
        </div>
      </td>
    </tr>
  `;
}

export function getBrandedEmailFooter(): string {
  const base = resolveBaseUrl();
  const year = new Date().getFullYear();
  const logoUrl = getLogoUrl("dark");

  return `
    <tr>
      <td style="padding: 24px 40px 32px; background: ${BQI_EMAIL_BRAND.lightBg}; border-top: 3px solid ${BQI_EMAIL_BRAND.cyan}; text-align: center;">
        <img src="${logoUrl}" alt="BQI Tech" width="100" style="width: 100px; height: auto; opacity: 0.85; margin-bottom: 16px;" />
        <p style="margin: 0 0 8px; color: ${BQI_EMAIL_BRAND.bodyText}; font-size: 14px; line-height: 1.6;">
          <strong>BQI Technologies</strong><br />
          Empowering businesses through innovative technology solutions
        </p>
        <p style="margin: 0 0 12px; color: ${BQI_EMAIL_BRAND.mutedText}; font-size: 12px;">
          Visit us at <a href="https://bqitech.com" style="color: ${BQI_EMAIL_BRAND.cyan}; text-decoration: none;">bqitech.com</a>
        </p>
        <p style="margin: 0; color: ${BQI_EMAIL_BRAND.mutedText}; font-size: 12px;">
          © ${year} BQI Tech. All rights reserved.
          &nbsp;•&nbsp;
          <a href="${base}/privacy" style="color: ${BQI_EMAIL_BRAND.cyan}; text-decoration: none;">Privacy</a>
          &nbsp;•&nbsp;
          <a href="${base}/terms" style="color: ${BQI_EMAIL_BRAND.cyan}; text-decoration: none;">Terms</a>
        </p>
      </td>
    </tr>
  `;
}

export function getAdminEmailFooter(contactEmail?: string): string {
  const year = new Date().getFullYear();
  const contact = contactEmail
    ? `<a href="mailto:${contactEmail}" style="color: ${BQI_EMAIL_BRAND.adminAccent}; text-decoration: underline;">${contactEmail}</a>`
    : "your administrator";

  return `
    <tr>
      <td style="padding: 20px 40px 28px; background: ${BQI_EMAIL_BRAND.adminSurface}; border-top: 1px solid rgba(148,163,255,0.12);">
        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9CA3AF; text-align: center;">
          If you were not expecting this email, you can ignore it or contact ${contact}.
        </p>
        <p style="margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: #6B7280; text-align: center;">
          © ${year} BQI Tech. All rights reserved.
        </p>
      </td>
    </tr>
  `;
}

export function getPrimaryButtonHtml(
  label: string,
  href: string,
  accent: string = BQI_EMAIL_BRAND.cyan
): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto 0; border-collapse: collapse;">
      <tr>
        <td align="center" style="border-radius: 10px; background: ${accent};">
          <a href="${href}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

type BrandedEmailLayoutOptions = {
  header: string;
  footer: string;
  accentColor?: string;
  outerBg?: string;
  cardBg?: string;
  content: string;
  preheader?: string;
};

export function wrapBrandedEmail({
  header,
  footer,
  accentColor = BQI_EMAIL_BRAND.cyan,
  outerBg = BQI_EMAIL_BRAND.lightBg,
  cardBg = "#FFFFFF",
  content,
  preheader = "",
}: BrandedEmailLayoutOptions): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BQI Tech</title>
</head>
<body style="margin:0;padding:0;background:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${outerBg};padding:40px 16px;border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${cardBg};border:1px solid ${BQI_EMAIL_BRAND.border};border-radius:16px;overflow:hidden;border-collapse:collapse;box-shadow:0 10px 30px rgba(39,32,85,0.08);">
          <tr>
            <td style="height:4px;background:${accentColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          ${header}
          <tr>
            <td style="padding:36px 40px 28px;">
              ${content}
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
