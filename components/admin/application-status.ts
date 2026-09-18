export const APPLICATION_STATUS_OPTIONS = [
  { value: "New", color: "bg-blue-100 text-blue-700" },
  { value: "Shortlisted", color: "bg-orange-100 text-orange-700" },
  { value: "Technical Assessment", color: "bg-indigo-100 text-indigo-700" },
  { value: "Interviewing", color: "bg-purple-100 text-purple-700" },
  { value: "Hired", color: "bg-green-100 text-green-700" },
  { value: "Rejected", color: "bg-red-100 text-red-700" },
  { value: "Disqualified", color: "bg-pink-100 text-pink-700" },
] as const;

export function getStatusColor(status: string): string {
  const exact = APPLICATION_STATUS_OPTIONS.find((option) => option.value === status);
  if (exact) return exact.color;

  const normalized = APPLICATION_STATUS_OPTIONS.find(
    (option) => option.value.toLowerCase() === status.toLowerCase()
  );
  return normalized?.color ?? "bg-gray-100 text-gray-700";
}
