import { employeePortalApi } from "@/lib/api-backend";

/** Aligns with document uploads (10MB) and `/api/upload` default. */
export const EMPLOYEE_AVATAR_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

export const EMPLOYEE_AVATAR_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";

export function validateEmployeeAvatarFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = file.type.startsWith("image/");
  const extOk = ALLOWED_EXTENSIONS.has(ext);
  if (!mimeOk && !extOk) {
    return "Choose a JPG, PNG, GIF, or WebP image.";
  }
  if (file.size > EMPLOYEE_AVATAR_MAX_BYTES) {
    return "Image must be 10MB or smaller.";
  }
  return null;
}

/** Upload via `/api/upload`, then persist `avatarUrl` on the employee profile. */
export async function uploadAndSaveEmployeeAvatar(file: File): Promise<string> {
  const validationError = validateEmployeeAvatarFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploaded = await employeePortalApi.uploadFile(file);
  const url = typeof uploaded?.url === "string" ? uploaded.url.trim() : "";
  if (!url) {
    throw new Error("Upload failed — no image URL returned.");
  }

  await employeePortalApi.updateMe({ avatarUrl: url });
  return url;
}
