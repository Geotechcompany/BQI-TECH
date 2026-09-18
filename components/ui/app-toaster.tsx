"use client";

import {
  Toaster as HotToaster,
  resolveValue,
  toast as hotToast,
  type Toast as HotToast,
  type ToastOptions as HotToastOptions,
  type ToastType as HotToastType,
} from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import {
  AppleToastCard,
  AppleToastStatusIcon,
  resolveAppleToastActions,
  type AppleHotToastExtras,
  type AppleToastVariant,
} from "@/components/ui/apple-toast";
import "@/components/ui/apple-toast.css";

export type AppHotToastOptions = HotToastOptions & AppleHotToastExtras;

function mapHotType(type: HotToastType): AppleToastVariant {
  switch (type) {
    case "success":
      return "success";
    case "error":
      return "error";
    case "loading":
      return "loading";
    default:
      return "default";
  }
}

function readHotExtras(toast: HotToast): AppleHotToastExtras {
  const extras = toast as HotToast & AppleHotToastExtras;
  return {
    action: extras.action,
    cancel: extras.cancel,
    actions: extras.actions,
    description: extras.description,
  };
}

function HotToastItem({ toast: t }: { toast: HotToast }) {
  const message = resolveValue(t.message, t);
  const extras = readHotExtras(t);
  const actions = resolveAppleToastActions(extras).map((action) => ({
    ...action,
    onClick: () => {
      action.onClick();
      hotToast.dismiss(t.id);
    },
  }));

  return (
    <AppleToastCard
      variant={mapHotType(t.type)}
      title={message}
      description={extras.description}
      actions={actions}
      visible={t.visible}
      icon={t.type !== "blank" && t.icon ? <>{t.icon}</> : undefined}
      onDismiss={() => hotToast.dismiss(t.id)}
    />
  );
}

const SONNER_SURFACE =
  "apple-sonner-toast group pointer-events-auto relative flex w-[min(100vw-2rem,360px)] items-start gap-3 rounded-[14px] border border-black/[0.08] bg-[#f7f7f8]/[0.96] px-3.5 py-3.5 shadow-[0_10px_32px_-10px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl";

export function AppToaster() {
  return (
    <>
      <HotToaster
        position="top-right"
        reverseOrder={false}
        gutter={10}
        containerClassName="apple-hot-toaster"
        containerStyle={{
          top: 16,
          right: 16,
          zIndex: 99999,
        }}
        toastOptions={{
          duration: 20000,
          removeDelay: 400,
          className: "apple-hot-toast",
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            margin: 0,
            maxWidth: "none",
          },
        }}
      >
        {(t) => <HotToastItem toast={t} />}
      </HotToaster>

      <SonnerToaster
        theme="light"
        position="top-right"
        closeButton
        expand
        gap={10}
        offset={16}
        visibleToasts={5}
        duration={20000}
        className="apple-sonner-toaster"
        icons={{
          success: <AppleToastStatusIcon variant="success" />,
          error: <AppleToastStatusIcon variant="error" />,
          warning: <AppleToastStatusIcon variant="warning" />,
          info: <AppleToastStatusIcon variant="info" />,
          loading: <AppleToastStatusIcon variant="loading" />,
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: SONNER_SURFACE,
            title:
              "text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-neutral-900",
            description: "mt-0.5 text-[12.5px] leading-snug text-neutral-500",
            content: "min-w-0 flex-1 gap-0.5 pr-5",
            icon: "mt-0.5 !m-0 !h-auto !w-auto shrink-0",
            closeButton:
              "!left-auto !right-2 !top-2 !h-7 !w-7 !translate-x-0 !translate-y-0 !rounded-full !border-0 !bg-transparent !text-neutral-400 hover:!bg-black/[0.05] hover:!text-neutral-700",
            actionButton:
              "!mt-2.5 !mr-auto !ml-0 !h-auto !rounded-none !bg-transparent !px-0 !py-0 !text-[12.5px] !font-medium !text-cyan-700 hover:!opacity-80",
            cancelButton:
              "!mt-2.5 !mr-0 !ml-3.5 !h-auto !rounded-none !bg-transparent !px-0 !py-0 !text-[12.5px] !font-medium !text-neutral-500 hover:!text-neutral-700",
            success: "apple-sonner-toast--success",
            error: "apple-sonner-toast--error",
            warning: "apple-sonner-toast--warning",
            info: "apple-sonner-toast--info",
            loading: "apple-sonner-toast--loading",
          },
        }}
      />
    </>
  );
}
