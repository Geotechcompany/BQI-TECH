import {
  BQI_EMAIL_BRAND,
  getBrandedEmailFooter,
  getBrandedEmailHeader,
  getPrimaryButtonHtml,
  wrapBrandedEmail,
} from "./email-brand";

interface EmailTemplateProps {
  recipientName: string;
  content: string;
  ctaLink?: string;
  ctaText?: string;
}

export function getBaseEmailTemplate({
  recipientName,
  content,
  ctaLink,
  ctaText,
}: EmailTemplateProps): string {
  const innerContent = `
    <h1 style="color: ${BQI_EMAIL_BRAND.darkBlue}; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
      Hello ${recipientName},
    </h1>
    <div style="color: ${BQI_EMAIL_BRAND.bodyText}; font-size: 16px; line-height: 1.6;">
      ${content}
    </div>
    ${ctaLink && ctaText ? getPrimaryButtonHtml(ctaText, ctaLink) : ""}
  `;

  return wrapBrandedEmail({
    header: getBrandedEmailHeader(),
    footer: getBrandedEmailFooter(),
    accentColor: BQI_EMAIL_BRAND.cyan,
    content: innerContent,
  });
}

export function getApplicationConfirmationEmail(props: {
  applicantName: string;
  jobTitle: string;
}) {
  return getBaseEmailTemplate({
    recipientName: props.applicantName,
    content: `
      <h2 style="margin: 0 0 12px; color: ${BQI_EMAIL_BRAND.darkBlue};">Application Received</h2>
      <p>Your application for the <strong>${props.jobTitle}</strong> position has been received.</p>
      <p>We will review your application and contact you within 3-5 business days.</p>
    `,
    ctaLink: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications`,
    ctaText: "View Application Status",
  });
}

export function getInterviewInvitationEmail(
  name: string,
  position: string,
  date: string,
  location: string
): string {
  return getBaseEmailTemplate({
    recipientName: name,
    content: `
      <p>We are pleased to invite you for an interview for the ${position} position.</p>
      <p><strong>Interview Details:</strong></p>
      <ul style="padding-left: 20px; margin: 16px 0;">
        <li>Date: ${date}</li>
        <li>Location: ${location}</li>
      </ul>
      <p>Please confirm your attendance by clicking the button below.</p>
    `,
    ctaLink: `${process.env.NEXT_PUBLIC_APP_URL}/careers/interview-confirmation`,
    ctaText: "Confirm Interview",
  });
}

export function getStatusChangeEmail(
  name: string,
  position: string,
  newStatus: string
): string {
  let statusSpecificContent = "";

  switch (newStatus) {
    case "Shortlisted":
      statusSpecificContent = `
        <p>Congratulations! Your application for the ${position} position has been shortlisted.</p>
        <p>Our team was impressed with your profile and would like to proceed to the next stage of the selection process.</p>
        <p>We will contact you soon with more details about the next steps.</p>
      `;
      break;
    case "Technical Assessment":
      statusSpecificContent = `
        <p>Your application for the ${position} position has progressed to the Technical Assessment stage.</p>
        <p>You will receive a separate email with instructions for completing the technical assessment.</p>
        <p>Please complete the assessment within the specified timeframe.</p>
      `;
      break;
    case "Interviewing":
      statusSpecificContent = `
        <p>Congratulations! You have been selected for an interview for the ${position} position.</p>
        <p>We will contact you shortly to schedule the interview at a time that works best for you.</p>
        <p>Please ensure your contact information is up to date.</p>
      `;
      break;
    case "Hired":
      statusSpecificContent = `
        <p>Congratulations! We are pleased to inform you that you have been selected for the ${position} position.</p>
        <p>You will receive a formal offer letter shortly with more details about the next steps.</p>
        <p>Welcome to the team!</p>
      `;
      break;
    case "Disqualified":
      statusSpecificContent = `
        <p>Thank you for your interest in the ${position} position at BQI Tech.</p>
        <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
        <p>We encourage you to apply for future positions that match your skills and experience.</p>
      `;
      break;
    default:
      statusSpecificContent = `
        <p>Your application status for the ${position} position has been updated to ${newStatus}.</p>
        <p>You can track your application status through our career portal.</p>
      `;
  }

  return getBaseEmailTemplate({
    recipientName: name,
    content: statusSpecificContent,
    ctaLink: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications`,
    ctaText: "View Application Status",
  });
}

export {
  BQI_EMAIL_BRAND,
  getBrandedEmailFooter,
  getBrandedEmailHeader,
  getBrandedEmailFooterBlock,
  getBrandedEmailHeaderBlock,
  getAdminEmailFooter,
  getAdminEmailHeader,
  getLogoUrl,
} from "./email-brand";
