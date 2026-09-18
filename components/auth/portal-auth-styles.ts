import { cn } from "@/lib/utils";

/** Shared Apple-style field / CTA classes for portal login & signup. */
export const portalAuthInputClass = cn(
  "h-12 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] px-4",
  "text-[15px] text-[#1d1d1f] caret-[#272156]",
  "placeholder:text-[#86868b]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
  "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
  "focus-visible:border-[#272156]/35 focus-visible:bg-white",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#272156]/22",
  "focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-55"
);

export const portalAuthLabelClass =
  "text-[13px] font-medium tracking-[-0.01em] text-[#6e6e73]";

export const portalAuthButtonClass = cn(
  "h-12 w-full rounded-2xl bg-[#272156] text-[15px] font-semibold text-white",
  "shadow-[0_8px_24px_-8px_rgba(39,33,86,0.45)]",
  "transition-[transform,background-color,box-shadow] duration-100 ease-out",
  "hover:bg-[#1f1a45] hover:shadow-[0_10px_28px_-8px_rgba(39,33,86,0.5)]",
  "active:scale-[0.97] active:shadow-[0_4px_14px_-6px_rgba(39,33,86,0.4)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/50",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:opacity-60"
);

export const portalAuthLinkClass =
  "font-medium text-[#272156] underline-offset-4 transition-opacity hover:opacity-70 hover:underline";

export const portalAuthAutofillCss = `
  .portal-auth-form input:-webkit-autofill,
  .portal-auth-form input:-webkit-autofill:hover,
  .portal-auth-form input:-webkit-autofill:focus {
    -webkit-text-fill-color: #1d1d1f;
    caret-color: #272156;
    border-color: rgba(0, 0, 0, 0.08);
    -webkit-box-shadow: 0 0 0 1000px #F5F5F7 inset;
    box-shadow: 0 0 0 1000px #F5F5F7 inset;
    transition: background-color 9999s ease-in-out 0s;
  }
`;

export const criticallyDampedSpring = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.5,
};
