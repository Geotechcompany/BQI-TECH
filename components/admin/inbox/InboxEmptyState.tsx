"use client";

export function InboxEmptyState() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-6 h-20 w-24" aria-hidden>
        <svg
          viewBox="0 0 96 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <path
            d="M8 22c0-4.4 3.6-8 8-8h36c4.4 0 8 3.6 8 8v20c0 4.4-3.6 8-8 8H28l-10 10V50H16c-4.4 0-8-3.6-8-8V22z"
            stroke="#272055"
            strokeOpacity="0.28"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 32h28M20 40h16"
            stroke="#272055"
            strokeOpacity="0.28"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M36 10c0-4.4 3.6-8 8-8h36c4.4 0 8 3.6 8 8v20c0 4.4-3.6 8-8 8H56l-10 10V38h-2c-4.4 0-8-3.6-8-8V10z"
            stroke="#31CDFF"
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M48 20h28M48 28h18"
            stroke="#31CDFF"
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[#272055]">
        No Active Conversation
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        To start a conversation, visit a candidate profile and send them an SMS
        message or email.
      </p>
    </div>
  );
}
