"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
  maxSizeBytes: number;
  isCircular?: boolean;
  className?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function ImageUploadField({
  value,
  onChange,
  placeholder,
  maxSizeBytes,
  isCircular = false,
  className,
}: ImageUploadFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Use a JPEG, PNG, or WebP image");
        return;
      }

      if (file.size > maxSizeBytes) {
        const actualSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        toast.error(
          `Image is ${actualSizeMB}MB; max is ${formatFileSize(maxSizeBytes)}`
        );
        return;
      }

      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await authService.authenticatedFetch(
          `${BACKEND_URL}/api/upload/`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || error.message || "Upload failed");
        }

        const data = await response.json();
        onChange(String(data.url));
        toast.success("Image uploaded");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload image"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [maxSizeBytes, onChange]
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed p-6 transition-colors",
          isDragOver
            ? "border-[#31CDFF] bg-[#31CDFF]/10"
            : "border-[#272055]/20 hover:border-[#272055]/40",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {isUploading ? (
            <>
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#31CDFF]" />
              <p className="text-sm text-[#272055]/70">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="mb-2 h-8 w-8 text-[#272055]/40" />
              <p className="mb-1 text-sm font-medium text-[#272055]">
                {placeholder}
              </p>
              <p className="mb-2 text-xs text-[#272055]/55">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-[#272055]/40">
                Max {formatFileSize(maxSizeBytes)} · JPEG, PNG, WebP
              </p>
            </>
          )}
        </div>
      </div>

      {value ? (
        <div
          className={cn(
            "relative overflow-hidden bg-[#272055]/5",
            isCircular
              ? "mx-auto h-32 w-32 rounded-full"
              : "aspect-video w-full max-w-2xl rounded-xl"
          )}
        >
          <Image
            src={value}
            alt="Upload preview"
            fill
            className="object-cover"
            sizes={
              isCircular
                ? "128px"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            }
          />
        </div>
      ) : null}
    </div>
  );
}
