/** Normalize job ID arrays from API (strings, ObjectIds, or { _id | id | value }). */
export function normalizeJobIds(jobIds: unknown): string[] {
  if (!Array.isArray(jobIds)) return [];

  return jobIds
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if (typeof obj._id === "string") return obj._id;
        if (obj._id != null) return String(obj._id);
        if (typeof obj.id === "string") return obj.id;
        if (obj.id != null) return String(obj.id);
        if (typeof obj.value === "string") return obj.value;
      }
      return "";
    })
    .filter((id) => id.length > 0);
}
