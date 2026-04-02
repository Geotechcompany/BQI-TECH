"use client";

import Image from "next/image";

type FailedStatusStateProps = {
  message: string;
  className?: string;
};

export function FailedStatusState({ message, className }: FailedStatusStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-10 text-center ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      <Image
        src="/Illustrations/connectionlost.png"
        alt="Connection lost"
        width={280}
        height={180}
        className="h-auto w-full max-w-[280px]"
        priority
      />
      <p className="text-sm font-medium text-red-600">{message}</p>
    </div>
  );
}
