import { ReactNode } from "react";

export default function CandidateProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
      {children}
    </div>
  );
}
