"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPLOYEE_AVATAR_ACCEPT,
  uploadAndSaveEmployeeAvatar,
  validateEmployeeAvatarFile,
} from "@/lib/employee-avatar-upload";
import {
  EMPLOYEE_DEFAULT_AVATAR_SRC,
  resolveEmployeeAvatarSrc,
} from "@/lib/employee-portal-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type EmployeeAvatarUploaderProps = {
  avatarUrl?: string | null;
  initials: string;
  alt?: string;
  className?: string;
  sizeClassName?: string;
};

export function useEmployeeAvatarUpload() {
  const queryClient = useQueryClient();
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
      const url = await uploadAndSaveEmployeeAvatar(file);
      queryClient.setQueryData(
        ["employee-portal-me"],
        (previous: { avatarUrl?: string | null } | undefined) =>
          previous ? { ...previous, avatarUrl: url } : previous
      );
      void queryClient.invalidateQueries({ queryKey: ["employee-portal-me"] });
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

export function EmployeeAvatarFileInput({
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

export function EmployeeAvatarUploader({
  avatarUrl,
  initials,
  alt = "",
  className,
  sizeClassName = "h-16 w-16",
}: EmployeeAvatarUploaderProps) {
  const { openPicker, isUploading, inputRef, onFileChange, accept } =
    useEmployeeAvatarUpload();
  const avatarSrc = resolveEmployeeAvatarSrc(avatarUrl);
  const isDefault = avatarSrc === EMPLOYEE_DEFAULT_AVATAR_SRC;

  return (
    <div className={cn("relative shrink-0", className)}>
      <EmployeeAvatarFileInput
        inputRef={inputRef}
        accept={accept}
        onFileChange={(event) => void onFileChange(event)}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={isUploading}
        aria-label="Change profile photo"
        className={cn(
          "group relative block overflow-hidden rounded-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/55 focus-visible:ring-offset-2",
          "disabled:cursor-wait"
        )}
      >
        <Avatar className={sizeClassName}>
          <AvatarImage
            src={avatarSrc}
            alt={alt}
            className={cn("object-cover", isDefault && "bg-[#272156]")}
          />
          <AvatarFallback className="bg-[#272156]/10 text-lg font-semibold text-[#272156]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5",
            "bg-[#272156]/70 text-white transition-opacity",
            isUploading
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
          aria-hidden
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
          ) : (
            <>
              <Camera className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[10px] font-medium leading-none">
                Change
              </span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
