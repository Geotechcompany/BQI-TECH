export interface JobDescriptionTemplate {
  id: string;
  title: string;
  category: string;
  content: string;
}

export const JOB_DESCRIPTION_TEMPLATES: JobDescriptionTemplate[] = [
  {
    id: "accounting-manager",
    title: "Accounting Manager",
    category: "Finance & Accounting",
    content: `<h2>About the Accounting Manager position</h2>
<p>We need an Accounting Manager to run day-to-day accounting operations and keep our financial records accurate, timely, and audit-ready. You will lead the accounting team, close the books each month, and work with leadership on reporting that supports business decisions.</p>
<h2>Accounting Manager responsibilities are:</h2>
<ul>
<li>Oversee accounts payable, accounts receivable, payroll, and general ledger activity</li>
<li>Prepare monthly, quarterly, and annual financial statements</li>
<li>Manage month-end and year-end close processes</li>
<li>Develop and maintain accounting policies, controls, and documentation</li>
<li>Coordinate with external auditors and tax advisors</li>
<li>Review reconciliations, journal entries, and variance explanations</li>
<li>Support budgeting, forecasting, and cash flow analysis</li>
<li>Coach and develop accounting staff</li>
</ul>
<h2>Accounting Manager requirements are:</h2>
<ul>
<li>Bachelor's degree in Accounting, Finance, or a related field</li>
<li>5+ years of progressive accounting experience, including supervisory responsibility</li>
<li>Professional certification (CPA, ACCA, or equivalent) preferred</li>
<li>Strong working knowledge of GAAP or IFRS</li>
<li>Experience with ERP/accounting software and Excel</li>
<li>Clear communicator who can explain financial results to non-finance leaders</li>
</ul>`,
  },
  {
    id: "accountant",
    title: "Accountant",
    category: "Finance & Accounting",
    content: `<h2>About the Accountant position</h2>
<p>We are looking for an Accountant to maintain accurate books, support month-end close, and produce reliable financial reports. You will handle core accounting tasks and help the team keep transactions organized and compliant.</p>
<h2>Accountant responsibilities are:</h2>
<ul>
<li>Record daily transactions across AP, AR, and the general ledger</li>
<li>Prepare account reconciliations and supporting schedules</li>
<li>Assist with monthly close activities and financial statement preparation</li>
<li>Process invoices, expense reports, and vendor payments</li>
<li>Support payroll inputs and statutory filings where required</li>
<li>Help maintain internal controls and documentation</li>
<li>Respond to audit and tax information requests</li>
</ul>
<h2>Accountant requirements are:</h2>
<ul>
<li>Bachelor's degree in Accounting, Finance, or a related field</li>
<li>2–4 years of hands-on accounting experience</li>
<li>Working knowledge of GAAP or IFRS</li>
<li>Proficiency with accounting software and advanced Excel</li>
<li>Strong attention to detail and ability to meet deadlines</li>
<li>Professional certification in progress or completed is a plus</li>
</ul>`,
  },
  {
    id: "software-engineer",
    title: "Software Engineer",
    category: "Technology",
    content: `<h2>About the Software Engineer position</h2>
<p>We need a Software Engineer to design, build, and maintain applications that support our products and internal operations. You will work with product and design partners to ship reliable features and improve system performance over time.</p>
<h2>Software Engineer responsibilities are:</h2>
<ul>
<li>Write clean, tested code across frontend, backend, or full-stack areas as needed</li>
<li>Participate in technical design, code review, and sprint planning</li>
<li>Build and maintain APIs, services, and user-facing features</li>
<li>Diagnose production issues and implement durable fixes</li>
<li>Improve observability, deployment workflows, and developer tooling</li>
<li>Document architecture decisions and implementation details</li>
<li>Collaborate with QA and stakeholders on release readiness</li>
</ul>
<h2>Software Engineer requirements are:</h2>
<ul>
<li>Bachelor's degree in Computer Science, Engineering, or equivalent practical experience</li>
<li>3+ years of professional software development experience</li>
<li>Strong skills in at least one modern language (TypeScript, Python, Go, or similar)</li>
<li>Experience with web frameworks, databases, and version control (Git)</li>
<li>Understanding of REST APIs, authentication, and cloud-hosted applications</li>
<li>Clear written communication and a track record of shipping in team settings</li>
</ul>`,
  },
  {
    id: "hr-manager",
    title: "HR Manager",
    category: "Human Resources",
    content: `<h2>About the HR Manager position</h2>
<p>We are hiring an HR Manager to lead people operations across recruitment, employee relations, and policy execution. You will partner with managers to build a workplace where teams can perform well and stay compliant with local employment requirements.</p>
<h2>HR Manager responsibilities are:</h2>
<ul>
<li>Own end-to-end recruitment for assigned departments</li>
<li>Administer onboarding, offboarding, and employee lifecycle processes</li>
<li>Develop and update HR policies, handbooks, and standard operating procedures</li>
<li>Handle employee relations cases with discretion and consistency</li>
<li>Coordinate performance review cycles and manager training</li>
<li>Maintain HR records and support payroll inputs where needed</li>
<li>Monitor labor law changes and recommend updates to practices</li>
<li>Track HR metrics such as time-to-fill, retention, and engagement</li>
</ul>
<h2>HR Manager requirements are:</h2>
<ul>
<li>Bachelor's degree in Human Resources, Business, or a related field</li>
<li>5+ years of HR experience with generalist scope</li>
<li>Professional HR certification (SHRM-CP, CIPD, or equivalent) preferred</li>
<li>Working knowledge of local employment law and best practices</li>
<li>Experience supporting hiring managers through structured interview processes</li>
<li>Strong interpersonal skills and sound judgment in sensitive situations</li>
</ul>`,
  },
  {
    id: "marketing-manager",
    title: "Marketing Manager",
    category: "Marketing",
    content: `<h2>About the Marketing Manager position</h2>
<p>We need a Marketing Manager to plan and execute campaigns that generate demand, strengthen our brand, and support revenue goals. You will manage channels, content, and reporting so marketing spend ties to measurable outcomes.</p>
<h2>Marketing Manager responsibilities are:</h2>
<ul>
<li>Build quarterly marketing plans aligned to business priorities</li>
<li>Manage digital campaigns across email, social, paid media, and the website</li>
<li>Oversee content production for blogs, case studies, and sales collateral</li>
<li>Partner with sales on lead generation, nurturing, and event support</li>
<li>Track campaign performance and present results to leadership</li>
<li>Manage agency or freelance partners where applicable</li>
<li>Maintain brand guidelines across internal and external materials</li>
<li>Run market research and competitor monitoring</li>
</ul>
<h2>Marketing Manager requirements are:</h2>
<ul>
<li>Bachelor's degree in Marketing, Communications, or a related field</li>
<li>4+ years of marketing experience with ownership of multi-channel programs</li>
<li>Hands-on experience with CRM, analytics, and marketing automation tools</li>
<li>Strong writing and editing skills for B2B or professional services audiences</li>
<li>Ability to manage budgets, timelines, and cross-functional stakeholders</li>
<li>Portfolio or examples of campaigns with measurable results</li>
</ul>`,
  },
  {
    id: "fractional-cfo",
    title: "Fractional CFO",
    category: "Finance & Accounting",
    content: `<h2>About the Fractional CFO position</h2>
<p>We are seeking a Fractional CFO to provide senior financial leadership on a part-time or project basis. You will guide forecasting, fundraising support, and operational finance while working closely with the CEO and department heads.</p>
<h2>Fractional CFO responsibilities are:</h2>
<ul>
<li>Lead financial planning, budgeting, and rolling forecasts</li>
<li>Prepare board-ready reporting packages and management dashboards</li>
<li>Advise on cash management, working capital, and capital allocation</li>
<li>Support fundraising, investor relations, and due diligence requests</li>
<li>Review accounting processes and strengthen internal controls</li>
<li>Partner with external accountants, auditors, and tax advisors</li>
<li>Evaluate pricing, unit economics, and growth scenario modeling</li>
<li>Mentor the finance team and raise the quality of financial decision-making</li>
</ul>
<h2>Fractional CFO requirements are:</h2>
<ul>
<li>Bachelor's degree in Finance, Accounting, or a related field; MBA or CPA preferred</li>
<li>10+ years of finance leadership experience, including CFO or VP Finance roles</li>
<li>Track record supporting growth-stage or mid-market organizations</li>
<li>Strong command of financial modeling, KPI design, and variance analysis</li>
<li>Experience with ERP systems and management reporting tools</li>
<li>Availability for regular leadership meetings and periodic on-site work if required</li>
</ul>`,
  },
  {
    id: "accounting-clerk",
    title: "Accounting Clerk",
    category: "Finance & Accounting",
    content: `<h2>About the Accounting Clerk position</h2>
<p>We need an Accounting Clerk to support daily accounting operations with accurate data entry, filing, and basic reconciliations. This role suits someone building a career in finance who values precision and steady process work.</p>
<h2>Accounting Clerk responsibilities are:</h2>
<ul>
<li>Enter invoices, receipts, and payment details into the accounting system</li>
<li>Match purchase orders to invoices and resolve basic discrepancies</li>
<li>Prepare checks, wire requests, or payment batches for approval</li>
<li>File and organize financial documents, both physical and digital</li>
<li>Assist with bank and petty cash reconciliations</li>
<li>Respond to vendor and internal inquiries about payment status</li>
<li>Support month-end close with data gathering and schedule preparation</li>
</ul>
<h2>Accounting Clerk requirements are:</h2>
<ul>
<li>High school diploma required; associate degree in Accounting preferred</li>
<li>1–2 years of bookkeeping or clerical accounting experience</li>
<li>Proficiency with Excel and common accounting software</li>
<li>Strong organizational skills and attention to detail</li>
<li>Professional demeanor when handling confidential information</li>
</ul>`,
  },
  {
    id: "accounts-payable-clerk",
    title: "Accounts Payable Clerk",
    category: "Finance & Accounting",
    content: `<h2>About the Accounts Payable Clerk position</h2>
<p>We are hiring an Accounts Payable Clerk to process vendor invoices, manage payment runs, and keep AP records current. You will help the finance team pay suppliers on time while maintaining proper approvals and documentation.</p>
<h2>Accounts Payable Clerk responsibilities are:</h2>
<ul>
<li>Review and code incoming invoices against purchase orders and contracts</li>
<li>Route invoices for approval and follow up on outstanding items</li>
<li>Prepare weekly or biweekly payment batches</li>
<li>Respond to vendor questions about invoice or payment status</li>
<li>Reconcile AP sub-ledger to the general ledger</li>
<li>Maintain vendor master files and W-9 or tax documentation</li>
<li>Identify duplicate charges before payment</li>
</ul>
<h2>Accounts Payable Clerk requirements are:</h2>
<ul>
<li>High school diploma required; coursework in accounting preferred</li>
<li>1–3 years of accounts payable experience</li>
<li>Familiarity with three-way match processes and approval workflows</li>
<li>Comfort working in ERP or AP automation tools</li>
<li>Reliable follow-through and clear communication with vendors and staff</li>
</ul>`,
  },
];

export function searchJobDescriptionTemplates(query: string): JobDescriptionTemplate[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return JOB_DESCRIPTION_TEMPLATES;

  return JOB_DESCRIPTION_TEMPLATES.filter((template) => {
    const haystack = `${template.title} ${template.category}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getJobDescriptionTemplateById(id: string): JobDescriptionTemplate | undefined {
  return JOB_DESCRIPTION_TEMPLATES.find((template) => template.id === id);
}
