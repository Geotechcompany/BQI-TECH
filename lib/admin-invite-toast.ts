import { toast } from "react-hot-toast";

export type InviteApiResponse = {
  message?: string;
  email?: string;
  emailSent?: boolean;
  resent?: boolean;
  existingUser?: boolean;
};

export function showInviteEmailToast(data?: InviteApiResponse | null) {
  if (!data?.emailSent) {
    toast.success(data?.message || "Invitation processed");
    return;
  }

  const recipient = data.email ? ` to ${data.email}` : "";

  if (data.resent) {
    toast.success(`Invitation email resent${recipient}`);
    return;
  }

  if (data.existingUser) {
    toast.success(`Invitation email sent${recipient}`);
    return;
  }

  toast.success(`Invitation email sent${recipient}`);
}

export function showInviteEmailError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Invitation email could not be sent";
  toast.error(message);
}
