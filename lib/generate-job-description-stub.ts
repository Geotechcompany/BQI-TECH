/**
 * Offline draft when the AI provider is unavailable.
 * Produces TipTap-friendly HTML from the hiring notes and role fields.
 */
export function buildStubJobDescription({
  prompt,
  title,
  department,
  location,
  employmentType,
  existingDescription,
  mode,
}: {
  prompt: string;
  title: string;
  department?: string;
  location?: string;
  employmentType?: string;
  existingDescription?: string;
  mode?: "generate" | "adjust";
}): string {
  const role = title.trim() || "this position";
  const notes = prompt.trim();

  if (mode === "adjust" && existingDescription?.trim()) {
    return `${existingDescription.trim()}
<p><em>Revision notes applied: ${escapeHtml(notes)}</em></p>`;
  }

  const meta: string[] = [];
  if (department?.trim()) meta.push(`Department: ${escapeHtml(department.trim())}`);
  if (location?.trim()) meta.push(`Location: ${escapeHtml(location.trim())}`);
  if (employmentType?.trim()) {
    meta.push(`Employment type: ${escapeHtml(employmentType.trim())}`);
  }

  return `<h2>About the ${escapeHtml(role)} role</h2>
<p>We are hiring for ${escapeHtml(role)}. ${escapeHtml(notes)}</p>
${meta.length ? `<p>${meta.join(" · ")}</p>` : ""}
<h2>Responsibilities</h2>
<ul>
<li>Own day-to-day work for this position and deliver clear outcomes</li>
<li>Collaborate with teammates and stakeholders across the organisation</li>
<li>Document progress and surface risks early</li>
</ul>
<h2>Requirements</h2>
<ul>
<li>Relevant experience for ${escapeHtml(role)}</li>
<li>Strong written and verbal communication</li>
<li>Comfort working in a paced, accountable environment</li>
</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
