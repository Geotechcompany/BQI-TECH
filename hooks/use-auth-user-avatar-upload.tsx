"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { userApi } from "@/lib/api-backend";
import {
  EMPLOYEE_AVATAR_ACCEPT,
  validateEmployeeAvatarFile,
} from "@/lib/employee-avatar-upload";

/**
 * Admin sidebar/header avatar upload via `/api/upload/avatar`
 * (persists on users + syncs to employee roster by email on the backend).
 */
export function useAuthUserAvatarUpload() {
  const { updateUserAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const openPicker = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateEmployeeAvatarFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = (await userApi.uploadAvatar(file)) as {
        url?: string;
      };
      const url = typeof uploaded?.url === "string" ? uploaded.url.trim() : "";
      if (!url) {
        throw new Error("Upload failed — no image URL returned.");
      }
      updateUserAvatar(url);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return {
    openPicker,
    isUploading,
    inputRef,
    onFileChange,
    accept: EMPLOYEE_AVATAR_ACCEPT,
  };
}

export function AuthUserAvatarFileInput({
  inputRef,
  accept,
  onFileChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={onFileChange}
    />
  );
}
